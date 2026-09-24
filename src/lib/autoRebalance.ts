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
import { UP_V3_DEPLOYMENT } from '@/protocols/dexs/robinhood';
import { uniswapV3DeploymentForChain, type V3Deployment } from '@/protocols/dexs/uniswap/v3/addresses';
import { deploymentOfPosition } from '@/protocols/lpChains';
import {
  AUTO_CHAINS, AUTO_CHAIN_NAMES, Action, FACTORY_ABI, REBALANCE_AGENT, V6, WALLET_ABI, adapterFor, encodeLpConfig,
  encodeSwapConfig, gaugeParams, walletSetup,
} from '../../convex/autoRebalanceConfig';

export * from '../../convex/autoRebalanceConfig';

const NFT_ABI = parseAbi(['function safeTransferFrom(address from, address to, uint256 tokenId)']);

export type AutoSupport = { chainId: number; positionManager: `0x${string}`; adapter: `0x${string}`; gauge?: `0x${string}` };

/** Whether auto-rebalance can take this position, and how. Null when it cannot. */
export function autoSupport(p: LiquidityPosition): AutoSupport | null {
  const chainId = p.chainId ?? 1;
  if (!(AUTO_CHAINS as readonly number[]).includes(chainId) || p.liquidity === 0n) return null;
  // MasterChef-style farms (Giga) are not supported inside the auto wallet.
  if (p.staked && p.staked.kind === 'masterchef') return null;
  const positionManager = (p.positionManager ?? deploymentOfPosition(p).positionManager) as `0x${string}`;
  const adapter = adapterFor(chainId, positionManager);
  if (!adapter) return null;
  return { chainId, positionManager, adapter, gauge: p.staked?.gauge };
}

/** The DEX deployment and position protocol behind an auto-rebalanced position's manager. */
export function autoDeployment(chainId: number, positionManager: string): { deployment: V3Deployment; protocol: LiquidityPosition['protocol'] } | null {
  const pm = positionManager.toLowerCase();
  const aero = chainId === 8453 ? AERODROME_CL_DEPLOYMENTS.find((d) => d.positionManager.toLowerCase() === pm) : undefined;
  if (aero) return { deployment: aero, protocol: 'aerodrome-cl' };
  if (chainId === 4663 && UP_V3_DEPLOYMENT.positionManager.toLowerCase() === pm) return { deployment: UP_V3_DEPLOYMENT, protocol: 'up-v3' };
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
  } else {
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
      data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [V6.aerodromeAdapter, gaugeParams(Action.Stake, s.gauge, tokenId)] }),
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

/** One owner call that runs a gauge action for a position held in the auto wallet. */
export function walletGaugeCall(wallet: string, kind: 'stake' | 'unstake' | 'claim', gauge: string, tokenId: string | bigint): Call {
  const action = kind === 'stake' ? Action.Stake : kind === 'unstake' ? Action.Unstake : Action.Claim;
  return {
    to: wallet as `0x${string}`,
    label: kind === 'stake' ? 'Stake inside your auto wallet' : kind === 'unstake' ? 'Unstake inside your auto wallet' : 'Claim rewards into your auto wallet',
    data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [V6.aerodromeAdapter, gaugeParams(action, gauge as `0x${string}`, BigInt(tokenId))] }),
  };
}

const ERC20_BALANCE_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);
const POSITIONS_HEAD_ABI = parseAbi(['function positions(uint256) view returns (uint96, address, address token0, address token1)']);
const GAUGE_REWARD_ABI = parseAbi(['function rewardToken() view returns (address)', 'function earned(address account, uint256 tokenId) view returns (uint256)']);

/**
 * Take a position back out: unstake it inside the wallet if it is staked, send
 * the NFT to the owner, and send any spare tokens (fees on the other side,
 * gauge rewards) along with it. Everything only ever goes to the owner.
 */
export async function buildTakeOutCalls(client: PublicClient, job: { wallet: string; positionManager: string; tokenId: string; gauge: string | null }) {
  const wallet = job.wallet as `0x${string}`;
  const pm = job.positionManager as `0x${string}`;
  const tokenId = BigInt(job.tokenId);
  const calls: Call[] = [];
  const holder = await client.readContract({ address: pm, abi: parseAbi(['function ownerOf(uint256) view returns (address)']), functionName: 'ownerOf', args: [tokenId] }).catch(() => null);
  if (job.gauge && holder?.toLowerCase() === job.gauge.toLowerCase()) {
    calls.push({ to: wallet, label: 'Unstake', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'run', args: [V6.aerodromeAdapter, gaugeParams(Action.Unstake, job.gauge as `0x${string}`, tokenId)] }) });
  }
  if (holder) calls.push({ to: wallet, label: 'Send the position to your wallet', data: encodeFunctionData({ abi: WALLET_ABI, functionName: 'withdrawNft', args: [pm, tokenId] }) });
  const staked = !!job.gauge && holder?.toLowerCase() === job.gauge.toLowerCase();
  calls.push(...await buildSweepCalls(client, job, staked));
  return calls;
}

/**
 * Send the wallet's spare tokens to the owner: the pool's two tokens and, with
 * a gauge, its reward token. `includeUnclaimed` adds the rewards an unstake in
 * the same batch will pay out, which are not in the wallet yet.
 */
export async function buildSweepCalls(client: PublicClient, job: { wallet: string; positionManager: string; tokenId: string; gauge: string | null }, includeUnclaimed = false) {
  const wallet = job.wallet as `0x${string}`;
  const tokens = new Set<string>();
  let rewardToken: string | null = null;
  let pending = 0n;
  const head = await client.readContract({ address: job.positionManager as `0x${string}`, abi: POSITIONS_HEAD_ABI, functionName: 'positions', args: [BigInt(job.tokenId)] }).catch(() => null);
  if (head) { tokens.add(head[2].toLowerCase()); tokens.add(head[3].toLowerCase()); }
  if (job.gauge) {
    const reward = await client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_REWARD_ABI, functionName: 'rewardToken' }).catch(() => null);
    if (reward) { rewardToken = reward.toLowerCase(); tokens.add(rewardToken); }
    // Rewards the unstake earlier in this batch pays into the wallet. A little
    // more accrues by the time it lands; that dust can be swept later.
    if (includeUnclaimed) pending = await client.readContract({ address: job.gauge as `0x${string}`, abi: GAUGE_REWARD_ABI, functionName: 'earned', args: [wallet, BigInt(job.tokenId)] }).catch(() => 0n);
  }
  const calls: Call[] = [];
  for (const token of tokens) {
    const held = await client.readContract({ address: token as `0x${string}`, abi: ERC20_BALANCE_ABI, functionName: 'balanceOf', args: [wallet] }).catch(() => 0n);
    const bal = held + (token === rewardToken ? pending : 0n);
    if (bal > 0n) calls.push({ to: wallet, label: 'Send spare tokens to your wallet', data: encodeFunctionData({ abi: parseAbi(['function withdraw(address token, uint256 amount)']), functionName: 'withdraw', args: [token as `0x${string}`, bal] }) });
  }
  return calls;
}
