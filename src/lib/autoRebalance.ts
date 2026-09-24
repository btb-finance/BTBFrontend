/**
 * Auto-rebalance, browser side: which positions qualify, and the one batch of
 * calls that hands a position to the owner's V6 auto wallet. Prices, contract
 * addresses and the wallet setup live in convex/autoRebalanceConfig.ts so the
 * app and the checker never disagree.
 */
import { encodeFunctionData, parseAbi, zeroAddress, type PublicClient } from 'viem';
import type { Call } from './txRunner';
import type { LiquidityPosition } from '@/protocols/types';
import { AERODROME_CL_DEPLOYMENTS } from '@/protocols/dexs/aerodrome';
import { GIGA_TOKEN, GIGA_V3_DEPLOYMENT, UP_V3_DEPLOYMENT } from '@/protocols/dexs/robinhood';
import { uniswapV3DeploymentForChain, type V3Deployment } from '@/protocols/dexs/uniswap/v3/addresses';
import { deploymentOfPosition } from '@/protocols/lpChains';
import { BLOCKSCOUT_HOSTS } from './blockscout';
import { getTokenPricesUsd } from './defillama';
import { dexTokenPrices } from './robinhoodBalances';
import {
  AUTO_CHAINS, AUTO_CHAIN_NAMES, AUTO_STABLES, AUTO_WETH, Action, FACTORY_ABI, GIGA_FARM, REBALANCE_AGENT, REWARD_TOKEN, V6, WALLET_ABI, adapterFor, encodeLpConfig,
  encodeSwapConfig, gaugeParams, isFarmManager, stakeAdapterFor, walletSetup,
} from '../../convex/autoRebalanceConfig';

export * from '../../convex/autoRebalanceConfig';

const NFT_ABI = parseAbi(['function safeTransferFrom(address from, address to, uint256 tokenId)']);

export type AutoSupport = { chainId: number; positionManager: `0x${string}`; adapter: `0x${string}`; gauge?: `0x${string}` };

/** Whether auto-rebalance can take this position, and how. Null when it cannot. */
export function autoSupport(p: LiquidityPosition): AutoSupport | null {
  const chainId = p.chainId ?? 1;
  if (!(AUTO_CHAINS as readonly number[]).includes(chainId) || p.liquidity === 0n) return null;
  const positionManager = (p.positionManager ?? deploymentOfPosition(p).positionManager) as `0x${string}`;
  const adapter = adapterFor(chainId, positionManager);
  if (!adapter) return null;
  // A farm stake is supported only for the Giga farm, through the farm adapter.
  if (p.staked?.kind === 'masterchef' && (!isFarmManager(chainId, positionManager) || p.staked.gauge.toLowerCase() !== GIGA_FARM)) return null;
  return { chainId, positionManager, adapter, gauge: p.staked?.gauge };
}

/** The DEX deployment and position protocol behind an auto-rebalanced position's manager. */
export function autoDeployment(chainId: number, positionManager: string): { deployment: V3Deployment; protocol: LiquidityPosition['protocol'] } | null {
  const pm = positionManager.toLowerCase();
  const aero = chainId === 8453 ? AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm) : undefined;
  if (aero) return { deployment: aero, protocol: 'aerodrome-cl' };
  if (chainId === 4663 && UP_V3_DEPLOYMENT.positionManager.toLowerCase() === pm) return { deployment: UP_V3_DEPLOYMENT, protocol: 'up-v3' };
  if (chainId === 4663 && GIGA_V3_DEPLOYMENT.positionManager.toLowerCase() === pm) return { deployment: GIGA_V3_DEPLOYMENT, protocol: 'giga-v3' };
  const uni = uniswapV3DeploymentForChain(chainId);
  return uni && uni.positionManager.toLowerCase() === pm ? { deployment: uni, protocol: 'uniswap-v3' } : null;
}

export function autoLabel(p: LiquidityPosition): string {
  return `${p.symbol0} / ${p.symbol1} on ${AUTO_CHAIN_NAMES[p.chainId ?? 1] ?? 'chain'}`;
}

/** The owner's auto wallet on this chain, and whether it still has to be created. */
export async function autoWalletOf(client: PublicClient, owner: `0x${string}`) {
  const existing = await client.readContract({ address: V6.factory, abi: FACTORY_ABI, functionName: 'accountOf', args: [owner] });
  if (existing !== zeroAddress) return { wallet: existing, created: true };
  const wallet = await client.readContract({ address: V6.factory, abi: FACTORY_ABI, functionName: 'predictAccount', args: [owner] });
  return { wallet, created: false };
}

/**
 * Every call to put position `tokenId` under auto-rebalance, in order, for one
 * confirmation: create the auto wallet (first time on this chain), make sure
 * the BTB agent and this DEX are allowed in it, unstake (`unstake`, when it is
 * staked from the owner's wallet), move the NFT in, and stake it in `s.gauge`
 * from inside the wallet so it keeps earning gauge rewards.
 */
export async function buildEnableCalls(client: PublicClient, owner: `0x${string}`, tokenId: bigint, s: AutoSupport, unstake: Call[] = []) {
  const { wallet, created } = await autoWalletOf(client, owner);
  const calls: Call[] = [];
  if (!created) {
    calls.push({
      to: V6.factory, label: 'Create your auto wallet',
      data: encodeFunctionData({ abi: FACTORY_ABI, functionName: 'createAccount', args: [walletSetup(s.chainId, Math.floor(Date.now() / 1000))] }),
    });
    // A new wallet starts on the first version; move it to the latest in the same confirmation.
    calls.push(...upgradeCallsFor(wallet, false, true));
  } else {
    calls.push(...await upgradeCalls(client, wallet));
    const [agentUntil, adapterHash] = await Promise.all([
      client.readContract({ address: wallet, abi: WALLET_ABI, functionName: 'agentExpiry', args: [REBALANCE_AGENT as `0x${string}`] }),
      client.readContract({ address: wallet, abi: WALLET_ABI, functionName: 'adapterCodeHash', args: [s.adapter] }),
    ]);
    const setup = walletSetup(s.chainId, Math.floor(Date.now() / 1000));
    if (Number(agentUntil) * 1000 < Date.now() + 30 * 24 * 60 * 60_000) {
      calls.push({ to: wallet, label: 'Allow the BTB agent', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setAgent', args: [REBALANCE_AGENT as `0x${string}`, setup.agentExpiresAt] }) });
    }
    if (/^0x0{64}$/.test(adapterHash)) {
      calls.push({ to: wallet, label: 'Turn on this DEX', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setAdapter', args: [s.adapter, true, encodeLpConfig(s.chainId)] }) });
    }
    calls.push(...await swapAdapterCalls(client, wallet, s.chainId));
  }
  calls.push(...unstake.map((c) => ({ ...c, label: 'Unstake' })));
  calls.push({
    to: s.positionManager, label: 'Move the position into your auto wallet',
    data: encodeFunctionData({ abi: NFT_ABI, functionName: 'safeTransferFrom', args: [owner, wallet, tokenId] }),
  });
  if (s.gauge) {
    calls.push({
      to: wallet, label: 'Stake it inside your auto wallet',
      data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [stakeAdapterFor(s.chainId, s.positionManager), gaugeParams(Action.Stake, s.gauge, tokenId)] }),
    });
  }
  return { wallet, created, calls };
}

/**
 * Start auto-rebalance once the move-in has confirmed. The server re-reads the
 * chain, and its RPC can trail the wallet's by a block or two, so a "not there
 * yet" answer is retried for a short while before it counts.
 */
export async function enableWhenVisible<R extends { ok: boolean; reason?: string }>(start: () => Promise<R>): Promise<R> {
  let res = await start();
  for (let i = 0; i < 6 && !res.ok && /yet|not in your auto wallet|not created/i.test(res.reason ?? ''); i++) {
    await new Promise((r) => setTimeout(r, 3000));
    res = await start();
  }
  return res;
}

/**
 * Turn on the swap adapter in a wallet created before it was part of the setup.
 * It only ever sells staking rewards into a position's tokens, at no worse than
 * the time-weighted price less 1%.
 */
export async function swapAdapterCalls(client: PublicClient, wallet: string, chainId: number): Promise<Call[]> {
  const hash = await client.readContract({ address: wallet as `0x${string}`, abi: WALLET_ABI, functionName: 'adapterCodeHash', args: [V6.swapAdapter] }).catch(() => null);
  if (hash && !/^0x0{64}$/.test(hash)) return [];
  return [{ to: wallet as `0x${string}`, label: 'Allow selling rewards', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setAdapter', args: [V6.swapAdapter, true, encodeSwapConfig(chainId)] }) }];
}

/**
 * Move a wallet to version 2 (farm staking) and turn on the farm adapter. Only the owner can, and only while the
 * wallet is paused, so it is paused around the upgrade (left paused if it already was).
 */
function upgradeCallsFor(wallet: string, alreadyPaused: boolean, needsFarmAdapter: boolean): Call[] {
  const w = wallet as `0x${string}`;
  const calls: Call[] = [];
  if (!alreadyPaused) calls.push({ to: w, label: 'Pause for the upgrade', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setPaused', args: [true] }) });
  calls.push({ to: w, label: 'Upgrade your auto wallet', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'upgradeToAndCall', args: [V6.walletV2, '0x'] }) });
  if (!alreadyPaused) calls.push({ to: w, label: 'Resume', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setPaused', args: [false] }) });
  if (needsFarmAdapter) calls.push({ to: w, label: 'Allow farm staking', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'setAdapter', args: [V6.farmAdapter, true, '0x'] }) });
  return calls;
}

/** Whether a wallet is on version 2 yet. The first version has no VERSION(). */
export async function walletVersion(client: PublicClient, wallet: string): Promise<number> {
  const v = await client.readContract({ address: wallet as `0x${string}`, abi: WALLET_ABI, functionName: 'VERSION' }).catch(() => 1n);
  return Number(v);
}

/** The calls, if any, that bring an existing wallet to version 2 with the farm adapter on. */
export async function upgradeCalls(client: PublicClient, wallet: string): Promise<Call[]> {
  const w = wallet as `0x${string}`;
  const [version, paused, farmHash] = await Promise.all([
    walletVersion(client, w),
    client.readContract({ address: w, abi: WALLET_ABI, functionName: 'paused' }).catch(() => false),
    client.readContract({ address: w, abi: WALLET_ABI, functionName: 'adapterCodeHash', args: [V6.farmAdapter] }).catch(() => null),
  ]);
  const needsFarm = !farmHash || /^0x0{64}$/.test(farmHash);
  if (version >= 2) return needsFarm ? upgradeCallsFor(w, true, true).filter((c) => c.label === 'Allow farm staking') : [];
  return upgradeCallsFor(w, paused, needsFarm);
}

/** One owner call that runs a gauge or farm action for a position held in the auto wallet. */
export function walletGaugeCall(wallet: string, kind: 'stake' | 'unstake' | 'claim', gauge: string, tokenId: string | bigint, adapter: `0x${string}` = V6.aerodromeAdapter): Call {
  const action = kind === 'stake' ? Action.Stake : kind === 'unstake' ? Action.Unstake : Action.Claim;
  return {
    to: wallet as `0x${string}`,
    label: kind === 'stake' ? 'Stake inside your auto wallet' : kind === 'unstake' ? 'Unstake inside your auto wallet' : 'Claim rewards into your auto wallet',
    data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [adapter, gaugeParams(action, gauge as `0x${string}`, BigInt(tokenId))] }),
  };
}

const ERC20_BALANCE_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);
const POSITIONS_HEAD_ABI = parseAbi(['function positions(uint256) view returns (uint96, address, address token0, address token1)']);
const GAUGE_REWARD_ABI = parseAbi(['function rewardToken() view returns (address)', 'function earned(address account, uint256 tokenId) view returns (uint256)']);
const FARM_PENDING_ABI = parseAbi(['function pendingReward(uint256 tokenId) view returns (uint256)']);

/**
 * Take a position back out: unstake it inside the wallet if it is staked, send
 * the NFT to the owner, and send any spare tokens (fees on the other side,
 * gauge rewards) along with it. Everything only ever goes to the owner.
 */
export async function buildTakeOutCalls(client: PublicClient, job: { wallet: string; positionManager: string; tokenId: string; gauge: string | null; chainId?: number }, owner?: `0x${string}`) {
  const wallet = job.wallet as `0x${string}`;
  const pm = job.positionManager as `0x${string}`;
  const tokenId = BigInt(job.tokenId);
  const calls: Call[] = [];
  const holder = await client.readContract({ address: pm, abi: parseAbi(['function ownerOf(uint256) view returns (address)']), functionName: 'ownerOf', args: [tokenId] }).catch(() => null);
  if (job.gauge && holder?.toLowerCase() === job.gauge.toLowerCase()) {
    calls.push({ to: wallet, label: 'Unstake', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [stakeAdapterFor(Number(job.chainId ?? 0), job.positionManager), gaugeParams(Action.Unstake, job.gauge as `0x${string}`, tokenId)] }) });
  }
  if (holder) calls.push({ to: wallet, label: 'Send the position to your wallet', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'withdrawNft', args: [pm, tokenId] }) });
  const staked = !!job.gauge && holder?.toLowerCase() === job.gauge.toLowerCase();
  calls.push(...await buildSweepCalls(client, job, staked, owner));
  return calls;
}

const WITHDRAW_ABI = parseAbi(['function withdraw(address token, uint256 amount)', 'function withdrawNative(uint256 amount)']);

/** ERC-20s the wallet holds, as the chain's Blockscout indexes them, with its spam flag. */
async function indexedTokens(chainId: number, wallet: string): Promise<{ address: string; scam: boolean }[]> {
  const host = BLOCKSCOUT_HOSTS[chainId];
  if (!host) return [];
  try {
    const res = await fetch(`${host}/api/v2/addresses/${wallet}/token-balances`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const rows = await res.json() as { token?: { address_hash?: string; type?: string; reputation?: string | null } }[];
    return rows.filter((r) => r.token?.type === 'ERC-20' && /^0x[0-9a-fA-F]{40}$/.test(r.token.address_hash ?? ''))
      .map((r) => ({ address: r.token!.address_hash!.toLowerCase(), scam: r.token!.reputation === 'scam' }));
  } catch { return []; }
}

/** USD prices for tokens outside the known list; a token no market prices is treated as spam. */
async function marketPrices(chainId: number, tokens: string[]): Promise<Record<string, number>> {
  if (tokens.length === 0) return {};
  if (chainId === 4663) return dexTokenPrices(tokens).catch(() => ({}));
  return getTokenPricesUsd(tokens, chainId === 8453 ? 'base' : 'ethereum').catch(() => ({}));
}

/**
 * Send everything spare in the auto wallet to the owner: every token it holds
 * and any ETH, not just this position's pair. Known tokens (the pair, reward
 * tokens, WETH, stables) always go; any other token only when a market prices
 * it and the indexer does not flag it, so airdropped spam stays behind. With
 * the owner given, each withdrawal is simulated first and a token that cannot
 * be transferred is skipped instead of failing the whole batch.
 * `includeUnclaimed` adds the rewards an unstake earlier in the same batch
 * pays out, which are not in the wallet yet.
 */
export async function buildSweepCalls(
  client: PublicClient,
  job: { wallet: string; positionManager: string; tokenId: string; gauge: string | null; chainId?: number },
  includeUnclaimed = false,
  owner?: `0x${string}`,
) {
  const wallet = job.wallet as `0x${string}`;
  const chainId = Number(job.chainId ?? client.chain?.id ?? 0);
  const known = new Set<string>([AUTO_WETH[chainId], ...(AUTO_STABLES[chainId] ?? []), REWARD_TOKEN[chainId]?.address].filter(Boolean).map((t) => t!.toLowerCase()));
  if (chainId === 4663) known.add(GIGA_TOKEN.toLowerCase());
  let rewardToken: string | null = null;
  let pending = 0n;
  const head = await client.readContract({ address: job.positionManager as `0x${string}`, abi: POSITIONS_HEAD_ABI, functionName: 'positions', args: [BigInt(job.tokenId)] }).catch(() => null);
  if (head) { known.add(head[2].toLowerCase()); known.add(head[3].toLowerCase()); }
  if (job.gauge && job.gauge.toLowerCase() === GIGA_FARM) {
    // Giga's farm pays GIGA and reads pending rewards by position alone.
    rewardToken = GIGA_TOKEN.toLowerCase(); known.add(rewardToken);
    if (includeUnclaimed) pending = await client.readContract({ address: job.gauge as `0x${string}`, abi: FARM_PENDING_ABI, functionName: 'pendingReward', args: [BigInt(job.tokenId)] }).catch(() => 0n);
  } else if (job.gauge) {
    const reward = await client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_REWARD_ABI, functionName: 'rewardToken' }).catch(() => null);
    if (reward) { rewardToken = reward.toLowerCase(); known.add(rewardToken); }
    // Rewards the unstake earlier in this batch pays into the wallet. A little
    // more accrues by the time it lands; that dust can be swept later.
    if (includeUnclaimed) pending = await client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_REWARD_ABI, functionName: 'earned', args: [wallet, BigInt(job.tokenId)] }).catch(() => 0n);
  }

  const indexed = await indexedTokens(chainId, wallet);
  const candidates = [...new Set([...known, ...indexed.filter((t) => !t.scam).map((t) => t.address)])];
  const balances = await Promise.all(candidates.map((t) =>
    client.readContract({ address: t as `0x${string}`, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [wallet] }).catch(() => 0n)));
  const unknownHeld = candidates.filter((t, i) => !known.has(t) && balances[i] > 0n);
  const prices = await marketPrices(chainId, unknownHeld);

  const calls: Call[] = [];
  await Promise.all(candidates.map(async (token, i) => {
    const bal = balances[i] + (token === rewardToken ? pending : 0n);
    if (bal <= 0n) return;
    if (!known.has(token) && !(prices[token] > 0)) return; // unpriced: most likely an airdropped spam token
    const data = encodeFunctionData({ abi: WITHDRAW_ABI, functionName: 'withdraw', args: [token as `0x${string}`, bal] });
    // The simulation cannot see rewards the unstake will pay, so only what is already there is tried.
    if (owner && token !== rewardToken) {
      const ok = await client.call({ account: owner, to: wallet, data }).then(() => true, () => false);
      if (!ok) return;
    }
    calls.push({ to: wallet, label: 'Withdraw leftover tokens', data });
  }));
  const eth = await client.getBalance({ address: wallet }).catch(() => 0n);
  if (eth > 0n) calls.push({ to: wallet, label: 'Withdraw leftover ETH', data: encodeFunctionData({ abi: WITHDRAW_ABI, functionName: 'withdrawNative', args: [eth] }) });
  return calls;
}
