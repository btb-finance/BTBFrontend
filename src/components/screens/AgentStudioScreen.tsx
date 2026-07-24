'use client';
import { useCallback, useEffect, useState } from 'react';
import { useConnection, useConfig, useSwitchChain, useWriteContract } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, keccak256, parseEventLogs, parseUnits, stringToHex, type Address, type Hex } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { AgentStudioFilm } from './AgentStudioFilm';
import {
  ACCOUNT_ABI, ACTION, ACTION_ORDER, BTB_CHAIN_ID, BTB_V2, CAPABILITY_EPOCH,
  ERC20_ABI, FACTORY_ABI, NPM_ABI, POOL_ABI, REGISTRY_ABI, UNI_FACTORY_ABI,
  defaultPolicy, deriveStrategy, encodeBurnData, encodeCollectData, encodeDecreaseData, encodeMintData,
  clearStrategy, loadStrategy, merkleRoot, rangeTicks, saveStrategy, callLeaf, NPM_SELECTOR,
  MAX_UINT128, positionAmounts, sqrtPriceToPrice, tickToPrice,
  type DerivedStrategy, type StoredStrategy, type StrategyInputs,
} from '../../lib/btbStudio';

/**
 * Agent Studio — the live Uniswap V3 strategy manager for BTB Smart Account V2
 * on Robinhood Chain. A linear flow that mirrors the contracts exactly:
 * create account, activate the adapter release, install permission and
 * policies, fund reserves, then mint, collect, unwind. Real transactions only.
 */

const ZERO = '0x0000000000000000000000000000000000000000' as Address;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Canned AI helper answers, one per step. */
const HELP = {
  wallet: 'Your wallet is the key to everything here. It signs every rule and every action, and it is the only address that can ever change your setup. We connect it to Robinhood Chain, a fast low fee network where your smart account lives. Nothing happens without your signature, and connecting alone moves no funds.',
  account: 'A smart account is your personal vault contract on chain. It holds your tokens and positions instead of your wallet doing it directly. The magic is the rule system inside it. You write spending limits and permissions once, and then agents or bots can operate the account without ever being able to withdraw, redirect, or break those rules. Only your wallet controls it, forever, and you can predict its address before it even exists.',
  pool: 'A Uniswap pool is a market between two tokens where you deposit both sides and earn a cut of every trade. The fee tier is what traders pay you, so stable pairs use low tiers and volatile pairs use higher ones. The range is the price zone where your money works. A tight range earns much more while the price stays inside it, but the price can walk out. Full range always earns something but much less. If the price leaves your range the position stops earning and holds mostly one token until you recenter it. Your daily caps become hard on chain rules that nothing can spend past.',
  release: 'Every adapter build must be registered before an account can use it. This testing registry has no delay, so a scheduled build can be activated immediately. Your account still verifies the adapter code hash on every execution, so swapped or upgraded code is rejected.',
  install: 'Installing writes your strategy into your account as one permission plus five action policies for mint, increase, decrease, collect, and burn. Each policy carries the exact hashes of your spending rules. From then on the account enforces them on every execution, checking amounts, tokens, and targets against cryptographic proofs. Nobody can loosen these rules but your wallet. Not us, not an agent, not a hacker with the agent key.',
  fund: 'Funding moves tokens from your wallet into your own smart account and reserves them for this one strategy. Reserved means fenced. Another strategy on the same account can never touch them, and even the withdraw function respects the fence until you release it. The approve step is a standard token permission that lets your account pull the exact amount, nothing more.',
  run: 'Mint deposits your reserved tokens into a Uniswap position, which arrives as an NFT owned by your account. Collect harvests the trading fees it has earned, and they land back in your reserves. Remove liquidity pulls your tokens out of the pool, and burn deletes the empty position. Withdraw sends reserved funds back to your wallet whenever you want. Every one of these runs through your on chain rules with a cryptographic proof attached.',
} as const;

type TokenMeta = { symbol: string; decimals: number; balance: bigint; reserved: bigint };
type Position = {
  id: bigint; liquidity: bigint; owed0: bigint; owed1: bigint;
  tickLower: number; tickUpper: number; fees0: bigint; fees1: bigint;
};

interface Loaded {
  predicted: Address;
  deployed: boolean;
  paused: boolean;
  strategy: StoredStrategy | null;
  inputs: StrategyInputs | null;
  derived: DerivedStrategy | null;
  npmCodeHash: Hex;
  adapterCodeHash: Hex;
  releaseKnown: boolean;
  releaseExecutableAt: bigint;
  permissionInstalled: boolean;
  policiesInstalled: boolean;
  token0: TokenMeta | null;
  token1: TokenMeta | null;
  positions: Position[];
  currentTick: number | null;
  sqrtPriceX96: bigint | null;
}

function Field({ label, value, onChange, placeholder, width }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: width ?? 150 }}>
      <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 10, outline: 'none',
          color: btb.text, fontSize: 13, padding: '10px 12px', fontFamily: 'inherit', width: '100%',
        }}
      />
    </label>
  );
}

/** Canned explainer that types itself out like a live agent answer. */
function AiExplain({ text, onClose }: { text: string; onClose: () => void }) {
  const [n, setN] = useState(0);
  const words = text.split(' ');
  useEffect(() => {
    setN(0);
    const t = setInterval(() => {
      setN(v => {
        if (v >= words.length) { clearInterval(t); return v; }
        return v + 1;
      });
    }, 34);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  const done = n >= words.length;
  return (
    <div style={{
      marginTop: 12, padding: '12px 14px', borderRadius: 12,
      background: 'rgba(82,227,164,0.06)', border: '1px solid rgba(82,227,164,0.22)',
    }}>
      <style>{'@keyframes aiBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 20, height: 20, borderRadius: 7, background: 'rgba(82,227,164,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="bolt" size={11} color={btb.green}/>
        </span>
        <span style={{ color: btb.green, fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4 }}>BTB AGENT</span>
        {!done && <span style={{ color: btb.textDim, fontSize: 11 }}>is typing</span>}
        <div style={{ flex: 1 }}/>
        <span onClick={onClose} style={{ cursor: 'pointer', display: 'flex' }}>
          <Icon name="close" size={12} color={btb.textDim}/>
        </span>
      </div>
      <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.65 }}>
        {words.slice(0, n).join(' ')}
        {!done && <span style={{
          display: 'inline-block', width: 7, height: 14, marginLeft: 2, verticalAlign: 'text-bottom',
          background: btb.green, borderRadius: 2, animation: 'aiBlink 0.9s step-end infinite',
        }}/>}
      </div>
    </div>
  );
}

function StepCard({ n, title, state, help, children }: {
  n: number; title: string; state: 'done' | 'active' | 'locked'; help?: string; children?: React.ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <Glass padding={18} radius={18} style={{ opacity: state === 'locked' ? 0.45 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: state === 'locked' && !showHelp ? 0 : 12 }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: 12, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: state === 'done' ? btb.gradGreen : 'rgba(255,255,255,0.1)',
          color: '#fff',
        }}>
          {state === 'done' ? <Icon name="check" size={12} color="#fff"/> : n}
        </span>
        <span style={{ color: btb.text, fontSize: 15, fontWeight: 800, flex: 1 }}>{title}</span>
        {help && (
          <span onClick={() => setShowHelp(s => !s)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', flexShrink: 0,
            padding: '4px 10px', borderRadius: 999,
            background: showHelp ? 'rgba(82,227,164,0.15)' : 'rgba(255,255,255,0.06)',
            border: showHelp ? '1px solid rgba(82,227,164,0.35)' : btb.borderSoft,
          }}>
            <Icon name="bolt" size={11} color={showHelp ? btb.green : btb.textMuted}/>
            <span style={{ color: showHelp ? btb.green : btb.textMuted, fontSize: 11, fontWeight: 800 }}>ask AI</span>
          </span>
        )}
      </div>
      {help && showHelp && <AiExplain text={help} onClose={() => setShowHelp(false)}/>}
      {state !== 'locked' && children}
    </Glass>
  );
}

export function AgentStudioScreen() {
  const [film, setFilm] = useState(false);
  const { address } = useConnection();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [publicReleaseState, setPublicReleaseState] = useState<'loading' | 'active' | 'pending' | 'none'>('loading');

  const [tokenA, setTokenA] = useState('');
  const [tokenB, setTokenB] = useState('');
  const [fee, setFee] = useState(3000);
  const [rangeInput, setRangeInput] = useState('10');
  const [capA, setCapA] = useState('');
  const [capB, setCapB] = useState('');
  const [fund0, setFund0] = useState('');
  const [fund1, setFund1] = useState('');
  const [mint0, setMint0] = useState('');
  const [mint1, setMint1] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Robinhood Chain is always in the wagmi config, so the client exists.
  const client = getPublicClient(config, { chainId: BTB_CHAIN_ID })!;

  const codeHash = useCallback(async (target: Address): Promise<Hex> => {
    const code = await client.getCode({ address: target });
    if (!code || code === '0x') throw new Error(`No code at ${target}`);
    return keccak256(code);
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [npmCodeHash, adapterCodeHash] = await Promise.all([
          codeHash(BTB_V2.positionManager),
          codeHash(BTB_V2.uniV3Adapter),
        ]);
        const capabilityRoot = merkleRoot(ACTION_ORDER.map(a =>
          callLeaf(BTB_V2.uniV3Adapter, ACTION[a], BTB_V2.positionManager, NPM_SELECTOR[a], 0n, npmCodeHash)));
        const releaseK = await client.readContract({
          address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'releaseKey',
          args: [BTB_V2.uniV3Adapter, adapterCodeHash, capabilityRoot, CAPABILITY_EPOCH],
        });
        const [release, pending] = await Promise.all([
          client.readContract({ address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'releases', args: [releaseK] }),
          client.readContract({ address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'pendingReleases', args: [releaseK] }),
        ]);
        if (!cancelled) setPublicReleaseState(release[0] ? 'active' : BigInt(pending[0]) > 0n ? 'pending' : 'none');
      } catch {
        if (!cancelled) setPublicReleaseState('none');
      }
    })();
    return () => { cancelled = true; };
  }, [client, codeHash]);

  const refresh = useCallback(async () => {
    if (!address) { setData(null); return; }
    try {
      const [predicted, actual] = await Promise.all([
        client.readContract({ address: BTB_V2.accountFactory, abi: FACTORY_ABI, functionName: 'predictAccount', args: [address] }),
        client.readContract({ address: BTB_V2.accountFactory, abi: FACTORY_ABI, functionName: 'accountOf', args: [address] }),
      ]);
      const deployed = actual !== ZERO;
      const account = deployed ? actual : predicted;
      const strategy = loadStrategy(predicted);
      const [npmCodeHash, adapterCodeHash] = await Promise.all([codeHash(BTB_V2.positionManager), codeHash(BTB_V2.uniV3Adapter)]);

      let inputs: StrategyInputs | null = null;
      let derived: DerivedStrategy | null = null;
      let releaseKnown = false;
      let releaseExecutableAt = 0n;
      let permissionInstalled = false;
      let policiesInstalled = false;
      let token0: TokenMeta | null = null;
      let token1: TokenMeta | null = null;
      let positions: Position[] = [];
      let currentTick: number | null = null;
      let sqrtPriceX96: bigint | null = null;

      // The capability root only depends on the deployment, so the release
      // status is checkable even before a pool is chosen.
      const capLeaves = ACTION_ORDER.map(a =>
        callLeaf(BTB_V2.uniV3Adapter, ACTION[a], BTB_V2.positionManager, NPM_SELECTOR[a], 0n, npmCodeHash));
      const capabilityRoot = merkleRoot(capLeaves);
      const releaseK = await client.readContract({
        address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'releaseKey',
        args: [BTB_V2.uniV3Adapter, adapterCodeHash, capabilityRoot, CAPABILITY_EPOCH],
      });
      const [release, pending] = await Promise.all([
        client.readContract({ address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'releases', args: [releaseK] }),
        client.readContract({ address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'pendingReleases', args: [releaseK] }),
      ]);
      releaseKnown = release[0];
      releaseExecutableAt = BigInt(pending[0]);

      if (strategy) {
        inputs = {
          pool: strategy.pool, token0: strategy.token0, token1: strategy.token1, fee: strategy.fee,
          tickLower: strategy.tickLower, tickUpper: strategy.tickUpper,
          cap0: BigInt(strategy.cap0), cap1: BigInt(strategy.cap1),
          window0: BigInt(strategy.window0), window1: BigInt(strategy.window1),
        };
        derived = deriveStrategy(inputs, npmCodeHash);
        const slot0 = await client.readContract({ address: strategy.pool, abi: POOL_ABI, functionName: 'slot0' });
        currentTick = slot0[1];
        sqrtPriceX96 = slot0[0];

        const [sym0, sym1, dec0, dec1, bal0, bal1] = await Promise.all([
          client.readContract({ address: strategy.token0, abi: ERC20_ABI, functionName: 'symbol' }),
          client.readContract({ address: strategy.token1, abi: ERC20_ABI, functionName: 'symbol' }),
          client.readContract({ address: strategy.token0, abi: ERC20_ABI, functionName: 'decimals' }),
          client.readContract({ address: strategy.token1, abi: ERC20_ABI, functionName: 'decimals' }),
          client.readContract({ address: strategy.token0, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
          client.readContract({ address: strategy.token1, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
        ]);
        let res0 = 0n; let res1 = 0n;
        if (deployed) {
          [res0, res1] = await Promise.all([
            client.readContract({ address: account, abi: ACCOUNT_ABI, functionName: 'reserved', args: [derived.permissionId, strategy.token0] }),
            client.readContract({ address: account, abi: ACCOUNT_ABI, functionName: 'reserved', args: [derived.permissionId, strategy.token1] }),
          ]);
          const [perm, policy] = await Promise.all([
            client.readContract({ address: account, abi: ACCOUNT_ABI, functionName: 'permissions', args: [derived.permissionId] }),
            client.readContract({ address: account, abi: ACCOUNT_ABI, functionName: 'actionPolicies', args: [derived.permissionId, ACTION.MINT] }),
          ]);
          permissionInstalled = perm[0] !== ZERO;
          policiesInstalled = policy[0];
          positions = (await Promise.all(strategy.tokenIds.map(async id => {
            const p = await client.readContract({ address: BTB_V2.positionManager, abi: NPM_ABI, functionName: 'positions', args: [BigInt(id)] }).catch(() => null);
            if (!p) return null;
            // Static call collect as the account to learn the exact claimable
            // fees, including growth not yet accounted in tokensOwed.
            let fees0 = p[10]; let fees1 = p[11];
            try {
              const sim = await client.simulateContract({
                address: BTB_V2.positionManager, abi: NPM_ABI, functionName: 'collect',
                args: [{ tokenId: BigInt(id), recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
                account,
              });
              [fees0, fees1] = sim.result;
            } catch { /* fall back to tokensOwed */ }
            return { id: BigInt(id), liquidity: p[7], owed0: p[10], owed1: p[11], tickLower: p[5], tickUpper: p[6], fees0, fees1 };
          }))).filter((p): p is Position => p !== null);
        }
        token0 = { symbol: sym0, decimals: dec0, balance: bal0, reserved: res0 };
        token1 = { symbol: sym1, decimals: dec1, balance: bal1, reserved: res1 };
      }

      const paused = deployed
        ? await client.readContract({ address: account, abi: ACCOUNT_ABI, functionName: 'automationPaused' })
        : false;

      setData({
        predicted: account, deployed, paused, strategy, inputs, derived, npmCodeHash, adapterCodeHash,
        releaseKnown, releaseExecutableAt, permissionInstalled, policiesInstalled, token0, token1, positions,
        currentTick, sqrtPriceX96,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 200) : 'Failed to load chain state');
    }
  }, [address, client, codeHash]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setErr(null); setOk(null);
    try {
      try { await switchChainAsync({ chainId: BTB_CHAIN_ID }); } catch { /* already on chain or user handled */ }
      await fn();
      setOk(`${label} confirmed`);
      await refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m.split('\n')[0].slice(0, 220));
    } finally {
      setBusy(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const write = async (params: { address: Address; abi: any; functionName: string; args?: readonly unknown[]; value?: bigint }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await writeContractAsync({ ...params, chainId: BTB_CHAIN_ID } as any);
    return client.waitForTransactionReceipt({ hash });
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const createAccount = () => run('Create account', async () => {
    if (!address) throw new Error('Connect a wallet');
    await write({ address: BTB_V2.accountFactory, abi: FACTORY_ABI, functionName: 'createAccount', args: [address] });
  });

  const loadPool = () => run('Load pool', async () => {
    if (!data) throw new Error('Connect a wallet');
    const a = tokenA.trim() as Address; const b = tokenB.trim() as Address;
    if (!/^0x[0-9a-fA-F]{40}$/.test(a) || !/^0x[0-9a-fA-F]{40}$/.test(b)) throw new Error('Enter two token addresses');
    const [t0, t1] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
    const pool = await client.readContract({ address: BTB_V2.uniV3Factory, abi: UNI_FACTORY_ABI, functionName: 'getPool', args: [t0, t1, fee] });
    if (pool === ZERO) throw new Error('No pool exists for that pair and fee');
    const rangeRaw = rangeInput.trim().toLowerCase();
    const rangePct = rangeRaw === '' || rangeRaw === 'full' ? 0 : parseFloat(rangeRaw);
    if (!Number.isFinite(rangePct) || rangePct < 0 || rangePct > 5000) {
      throw new Error('Range must be a percent like 0.5, 10, or 25, or the word full');
    }
    const [spacing, slot0] = await Promise.all([
      client.readContract({ address: pool, abi: POOL_ABI, functionName: 'tickSpacing' }),
      client.readContract({ address: pool, abi: POOL_ABI, functionName: 'slot0' }),
    ]);
    const { tickLower, tickUpper } = rangeTicks(slot0[1], rangePct, spacing);
    const [dec0, dec1] = await Promise.all([
      client.readContract({ address: t0, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: t1, abi: ERC20_ABI, functionName: 'decimals' }),
    ]);
    const [capForA, capForB] = t0 === a ? [capA, capB] : [capB, capA];
    const c0 = parseUnits(capForA || '0', dec0); const c1 = parseUnits(capForB || '0', dec1);
    if (c0 === 0n || c1 === 0n) throw new Error('Set a spending cap for both tokens');
    saveStrategy(data.predicted, {
      pool, token0: t0, token1: t1, fee, tickLower, tickUpper, rangePct,
      cap0: c0.toString(), cap1: c1.toString(), window0: c0.toString(), window1: c1.toString(),
      tokenIds: [],
    });
  });

  const changeStrategy = () => {
    if (!data?.strategy) return;
    const hasFunds = (data.token0?.reserved ?? 0n) > 0n || (data.token1?.reserved ?? 0n) > 0n;
    if (hasFunds || data.positions.length > 0) {
      setErr('Close positions and withdraw reserved funds first, then change the strategy. Your funds stay tied to the current rules until you release them.');
      return;
    }
    setErr(null); setOk(null);
    setTokenA(data.strategy.token0);
    setTokenB(data.strategy.token1);
    setFee(data.strategy.fee);
    setRangeInput(data.strategy.rangePct > 0 ? String(data.strategy.rangePct) : 'full');
    if (data.token0) setCapA(formatUnits(BigInt(data.strategy.cap0), data.token0.decimals));
    if (data.token1) setCapB(formatUnits(BigInt(data.strategy.cap1), data.token1.decimals));
    clearStrategy(data.predicted);
    refresh();
  };

  /// Owner signed recenter: unwind every position, install the same strategy at
  /// a fresh range around the current price, migrate reservations, retire the
  /// old permission. Uses only functions the deployed contracts already have.
  const recenter = () => run('Recenter range', async () => {
    if (!data?.derived || !data.strategy || !data.inputs) return;
    const old = data.derived;
    const s = data.strategy;

    for (const p of data.positions) {
      const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 1200);
      if (p.liquidity > 0n) await execute('DECREASE', encodeDecreaseData(old, p.id, p.liquidity, deadline()));
      await execute('COLLECT', encodeCollectData(old, p.id));
      await execute('BURN', encodeBurnData(old, p.id));
    }

    const [spacing, slot0] = await Promise.all([
      client.readContract({ address: s.pool, abi: POOL_ABI, functionName: 'tickSpacing' }),
      client.readContract({ address: s.pool, abi: POOL_ABI, functionName: 'slot0' }),
    ]);
    const next = rangeTicks(slot0[1], s.rangePct ?? 10, spacing);
    const nextStored: StoredStrategy = { ...s, tickLower: next.tickLower, tickUpper: next.tickUpper, tokenIds: [] };
    const nextInputs: StrategyInputs = { ...data.inputs, tickLower: next.tickLower, tickUpper: next.tickUpper };
    const nextDerived = deriveStrategy(nextInputs, data.npmCodeHash);
    if (nextDerived.permissionId === old.permissionId) throw new Error('Price has not moved, range is unchanged');

    await write({
      address: data.predicted, abi: ACCOUNT_ABI, functionName: 'setPermission',
      args: [nextDerived.permissionId, {
        adapter: BTB_V2.uniV3Adapter, adapterCodeHash: data.adapterCodeHash, strategyId: nextDerived.permissionId,
        configHash: nextDerived.configHash, capabilityRoot: nextDerived.capabilityRoot, assetRoot: nextDerived.assetRoot,
        positionCommitment: '0x0000000000000000000000000000000000000000000000000000000000000000',
        capabilityEpoch: CAPABILITY_EPOCH, enabled: true,
      }, nextDerived.configBytes],
    });
    for (const a of ACTION_ORDER) {
      await write({
        address: data.predicted, abi: ACCOUNT_ABI, functionName: 'setActionPolicy',
        args: [nextDerived.permissionId, ACTION[a], defaultPolicy(nextDerived)],
      });
    }
    for (const token of [s.token0, s.token1]) {
      const amount = await client.readContract({
        address: data.predicted, abi: ACCOUNT_ABI, functionName: 'reserved', args: [old.permissionId, token],
      });
      if (amount > 0n) {
        await write({
          address: data.predicted, abi: ACCOUNT_ABI, functionName: 'moveReservation',
          args: [old.permissionId, nextDerived.permissionId, token, amount],
        });
      }
    }
    await write({ address: data.predicted, abi: ACCOUNT_ABI, functionName: 'disablePermission', args: [old.permissionId] });
    saveStrategy(data.predicted, nextStored);
  });

  const scheduleRelease = () => run('Schedule release', async () => {
    if (!data) return;
    const capLeaves = ACTION_ORDER.map(a =>
      callLeaf(BTB_V2.uniV3Adapter, ACTION[a], BTB_V2.positionManager, NPM_SELECTOR[a], 0n, data.npmCodeHash));
    await write({
      address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'scheduleRelease',
      args: [BTB_V2.uniV3Adapter, data.adapterCodeHash, merkleRoot(capLeaves), CAPABILITY_EPOCH, keccak256(stringToHex('BTB Uniswap V3 adapter release 1'))],
    });
  });

  const activateRelease = () => run('Activate release', async () => {
    if (!data) return;
    const capLeaves = ACTION_ORDER.map(a =>
      callLeaf(BTB_V2.uniV3Adapter, ACTION[a], BTB_V2.positionManager, NPM_SELECTOR[a], 0n, data.npmCodeHash));
    await write({
      address: BTB_V2.registry, abi: REGISTRY_ABI, functionName: 'activateRelease',
      args: [BTB_V2.uniV3Adapter, data.adapterCodeHash, merkleRoot(capLeaves), CAPABILITY_EPOCH],
    });
  });

  const installStrategy = () => run('Install strategy', async () => {
    if (!data?.derived || !data.inputs) return;
    const d = data.derived;
    if (!data.permissionInstalled) {
      await write({
        address: data.predicted, abi: ACCOUNT_ABI, functionName: 'setPermission',
        args: [d.permissionId, {
          adapter: BTB_V2.uniV3Adapter, adapterCodeHash: data.adapterCodeHash, strategyId: d.permissionId,
          configHash: d.configHash, capabilityRoot: d.capabilityRoot, assetRoot: d.assetRoot,
          positionCommitment: '0x0000000000000000000000000000000000000000000000000000000000000000',
          capabilityEpoch: CAPABILITY_EPOCH, enabled: true,
        }, d.configBytes],
      });
    }
    for (const a of ACTION_ORDER) {
      await write({
        address: data.predicted, abi: ACCOUNT_ABI, functionName: 'setActionPolicy',
        args: [d.permissionId, ACTION[a], defaultPolicy(d)],
      });
    }
  });

  const fundToken = (idx: 0 | 1) => run(`Fund ${idx === 0 ? data?.token0?.symbol : data?.token1?.symbol}`, async () => {
    if (!data?.derived || !data.strategy || !address) return;
    const token = idx === 0 ? data.strategy.token0 : data.strategy.token1;
    const meta = idx === 0 ? data.token0 : data.token1;
    const amount = parseUnits((idx === 0 ? fund0 : fund1) || '0', meta?.decimals ?? 18);
    if (amount === 0n) throw new Error('Enter an amount');
    const allowance = await client.readContract({ address: token, abi: ERC20_ABI, functionName: 'allowance', args: [address, data.predicted] });
    if (allowance < amount) {
      await write({ address: token, abi: ERC20_ABI, functionName: 'approve', args: [data.predicted, amount] });
    }
    await write({ address: data.predicted, abi: ACCOUNT_ABI, functionName: 'fundAndReserve', args: [data.derived.permissionId, token, amount] });
  });

  const execute = async (action: keyof typeof ACTION, actionData: Hex) => {
    if (!data?.derived || !data.inputs) throw new Error('Strategy not ready');
    const d = data.derived;
    const state = await client.readContract({
      address: data.predicted, abi: ACCOUNT_ABI, functionName: 'actionStates', args: [d.permissionId, ACTION[action]],
    });
    return write({
      address: data.predicted, abi: ACCOUNT_ABI, functionName: 'executePermission',
      args: [
        d.permissionId, ACTION[action], d.configBytes, actionData, state[3],
        d.spendLimits.map(l => ({ token: l.token, maximumAmount: l.maximumAmount })),
        d.outputTokens, [],
      ],
    });
  };

  const mintPosition = () => run('Mint position', async () => {
    if (!data?.derived || !data.inputs || !data.strategy || !data.token0 || !data.token1) return;
    const a0 = parseUnits(mint0 || '0', data.token0.decimals);
    const a1 = parseUnits(mint1 || '0', data.token1.decimals);
    if (a0 === 0n && a1 === 0n) throw new Error('Enter amounts to deposit');
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    const receipt = await execute('MINT', encodeMintData(data.derived, data.inputs, a0, a1, deadline));
    const logs = parseEventLogs({ abi: ACCOUNT_ABI, logs: receipt.logs, eventName: 'PositionAssigned' });
    if (logs.length > 0) {
      const tokenId = logs[0].args.tokenId.toString();
      saveStrategy(data.predicted, { ...data.strategy, tokenIds: [...data.strategy.tokenIds, tokenId] });
    }
  });

  const collect = (id: bigint) => run('Collect fees', async () => {
    if (!data?.derived) return;
    await execute('COLLECT', encodeCollectData(data.derived, id));
  });

  const decrease = (id: bigint, liquidity: bigint) => run('Remove liquidity', async () => {
    if (!data?.derived) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
    await execute('DECREASE', encodeDecreaseData(data.derived, id, liquidity, deadline));
  });

  const burn = (id: bigint) => run('Burn position', async () => {
    if (!data?.derived || !data.strategy) return;
    await execute('BURN', encodeBurnData(data.derived, id));
    saveStrategy(data.predicted, { ...data.strategy, tokenIds: data.strategy.tokenIds.filter(t => t !== id.toString()) });
  });

  const exitToken = (idx: 0 | 1) => run('Release funds to wallet', async () => {
    if (!data?.derived || !data.strategy) return;
    const token = idx === 0 ? data.strategy.token0 : data.strategy.token1;
    const meta = idx === 0 ? data.token0 : data.token1;
    if (!meta || meta.reserved === 0n) throw new Error('Nothing reserved');
    await write({
      address: data.predicted, abi: ACCOUNT_ABI, functionName: 'releaseReservation',
      args: [data.derived.permissionId, token, meta.reserved, true],
    });
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (film) {
    return (
      <Screen gap={12} style={{ maxWidth: 660, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span onClick={() => setFilm(false)} style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Back to studio
          </span>
        </div>
        <AgentStudioFilm/>
      </Screen>
    );
  }

  const fmt = (v: bigint, dec: number) => {
    const s = formatUnits(v, dec);
    const n = parseFloat(s);
    return n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : s.length > 10 ? n.toPrecision(6) : s;
  };

  const releaseState: 'loading' | 'active' | 'pending' | 'none' = data?.releaseKnown ? 'active'
    : data && data.releaseExecutableAt > 0n ? 'pending' : publicReleaseState;
  const releaseReady = data ? data.releaseExecutableAt > 0n && BigInt(now) >= data.releaseExecutableAt : false;
  const countdown = data && data.releaseExecutableAt > BigInt(now) ? Number(data.releaseExecutableAt - BigInt(now)) : 0;
  const hh = Math.floor(countdown / 3600); const mm = Math.floor((countdown % 3600) / 60); const ss = countdown % 60;
  const isRegistryOwner = address?.toLowerCase() === BTB_V2.registryOwner.toLowerCase();

  const step2 = data?.deployed ? 'done' : address ? 'active' : 'locked';
  const step3 = data?.strategy ? 'done' : data?.deployed ? 'active' : 'locked';
  const step4 = releaseState === 'active' ? 'done' : data?.strategy ? 'active' : 'locked';
  const step5 = data?.permissionInstalled && data?.policiesInstalled ? 'done'
    : data?.strategy && releaseState === 'active' && data.deployed ? 'active' : 'locked';
  const funded = (data?.token0?.reserved ?? 0n) > 0n || (data?.token1?.reserved ?? 0n) > 0n;
  const step6 = funded ? 'done' : step5 === 'done' ? 'active' : 'locked';
  const step7 = step6 === 'done' || (step5 === 'done' && funded) ? 'active' : 'locked';

  return (
    <Screen gap={12} style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: btb.green, boxShadow: `0 0 8px ${btb.green}` }}/>
          <span style={{ color: btb.text, fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>Agent Studio</span>
        </span>
        <Badge color={btb.green} bg="rgba(82,227,164,0.12)" border="1px solid rgba(82,227,164,0.35)">Live on Robinhood Chain</Badge>
        <div style={{ flex: 1 }}/>
        <span onClick={() => setFilm(true)} style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Watch the film
        </span>
      </div>

      <Glass padding={14} radius={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
          <span style={{ color: btb.text, fontSize: 12.5, fontWeight: 800 }}>V2 modules</span>
          <span style={{ color: btb.textDim, fontSize: 10.5 }}>live contract status</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {[
            { name: 'Smart account', address: BTB_V2.accountFactory, note: 'Factory + fixed implementation', status: 'Ready', color: btb.green },
            { name: 'Adapter registry', address: BTB_V2.registry, note: 'Testing · zero-delay releases', status: 'Ready', color: btb.green },
            {
              name: 'Uniswap V3', address: BTB_V2.uniV3Adapter, note: 'Mint, add, remove, collect, burn',
              status: releaseState === 'active' ? 'Active' : releaseState === 'pending' ? 'Ready to activate' : releaseState === 'loading' ? 'Checking' : 'Needs release',
              color: releaseState === 'active' ? btb.green : '#FFB36B',
            },
            { name: 'ERC-4626 vaults', address: BTB_V2.erc4626Adapter, note: 'Deposit, mint, withdraw, redeem', status: 'Deployed', color: '#78A8FF' },
            { name: 'Keeper incentives', address: BTB_V2.keeperIncentives, note: 'Optional sponsored automation', status: 'Deployed', color: '#78A8FF' },
            { name: 'Uniswap contracts', address: BTB_V2.positionManager, note: 'Official manager + factory', status: 'Connected', color: btb.green },
          ].map(module => (
            <a
              key={module.name}
              href={`https://robinhoodchain.blockscout.com/address/${module.address}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 11px', borderRadius: 12,
                background: btb.surfaceSoft, border: btb.borderSoft, textDecoration: 'none', minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: btb.text, fontSize: 11.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {module.name}
                </span>
                <span style={{ flex: 1 }}/>
                <Badge size="sm" color={module.color} bg={`${module.color}18`} border={`1px solid ${module.color}45`}>
                  {module.status}
                </Badge>
              </div>
              <span style={{ color: btb.textDim, fontSize: 9.5, lineHeight: 1.35 }}>{module.note}</span>
              <span style={{ color: btb.textMuted, fontSize: 9.5, fontFamily: 'monospace' }}>{short(module.address)} ↗</span>
            </a>
          ))}
        </div>
      </Glass>

      {(err || ok || busy) && (
        <div style={{
          padding: '10px 14px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, wordBreak: 'break-word',
          background: err ? 'rgba(255,107,122,0.1)' : 'rgba(82,227,164,0.08)',
          border: err ? '1px solid rgba(255,107,122,0.35)' : '1px solid rgba(82,227,164,0.3)',
          color: err ? btb.loss : btb.green, fontWeight: 600,
        }}>
          {busy ? `${busy}…` : err ?? ok}
        </div>
      )}

      {/* 1. Wallet */}
      <StepCard n={1} title="Connect your wallet" state={address ? 'done' : 'active'} help={HELP.wallet}>
        <div style={{ color: btb.textMuted, fontSize: 13 }}>
          {address ? <>Connected as <span style={{ color: btb.text, fontFamily: 'monospace' }}>{short(address)}</span></>
            : 'Use the Connect Wallet button in the sidebar, then come back here.'}
        </div>
      </StepCard>

      {/* 2. Account */}
      <StepCard n={2} title="Your smart account" state={step2} help={HELP.account}>
        {data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: btb.textMuted, fontSize: 13 }}>
              {data.deployed ? 'Deployed at' : 'Will deploy at'}{' '}
              <span style={{ color: btb.text, fontFamily: 'monospace' }}>{short(data.predicted)}</span>
              {data.deployed && <span style={{ color: btb.green, fontWeight: 700 }}> · yours forever, only your wallet controls it</span>}
            </div>
            {!data.deployed && (
              <Button size="sm" variant="success" fullWidth={false} style={{ padding: '0 18px' }}
                loading={busy === 'Create account'} disabled={busy !== null} onClick={createAccount}>
                Create account
              </Button>
            )}
          </div>
        )}
      </StepCard>

      {/* 3. Strategy */}
      <StepCard n={3} title="Choose your Uniswap V3 pool" state={step3} help={HELP.pool}>
        {data?.strategy && data.token0 && data.token1 ? (
          <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.7 }}>
            <span style={{ color: btb.text, fontWeight: 700 }}>{data.token0.symbol} / {data.token1.symbol}</span>
            {' '}at {data.strategy.fee / 10000}% fee,{' '}
            {data.strategy.rangePct > 0 ? `plus minus ${data.strategy.rangePct}% range` : 'full range'}
            {data.currentTick !== null && data.strategy.rangePct > 0 && (
              data.currentTick >= data.strategy.tickLower && data.currentTick < data.strategy.tickUpper
                ? <Badge color={btb.green} bg="rgba(82,227,164,0.12)" border="1px solid rgba(82,227,164,0.35)" style={{ marginLeft: 8 }}>In range</Badge>
                : <Badge color="#FFB36B" bg="rgba(255,179,107,0.12)" border="1px solid rgba(255,179,107,0.35)" style={{ marginLeft: 8 }}>Out of range</Badge>
            )}
            <br/>
            Spending caps {fmt(BigInt(data.strategy.cap0), data.token0.decimals)} {data.token0.symbol} and{' '}
            {fmt(BigInt(data.strategy.cap1), data.token1.decimals)} {data.token1.symbol} per day.
            <span onClick={busy ? undefined : changeStrategy} style={{
              color: btb.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 10,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Change strategy
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Field label="Token A address" value={tokenA} onChange={setTokenA} placeholder="0x…"/>
              <Field label="Token B address" value={tokenB} onChange={setTokenB} placeholder="0x…"/>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Fee tier</span>
                <select value={fee} onChange={e => setFee(parseInt(e.target.value))} style={{
                  background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 10, color: btb.text,
                  fontSize: 13, padding: '10px 12px', outline: 'none',
                }}>
                  <option value={100}>0.01%</option><option value={500}>0.05%</option>
                  <option value={3000}>0.3%</option><option value={10000}>1%</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 140 }}>
                <span style={{ color: btb.textDim, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Range, plus minus %
                </span>
                <input
                  value={rangeInput}
                  onChange={e => setRangeInput(e.target.value)}
                  placeholder="10"
                  inputMode="decimal"
                  spellCheck={false}
                  style={{
                    background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 10, outline: 'none',
                    color: btb.text, fontSize: 13, padding: '10px 12px', fontFamily: 'inherit', width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['0.5', '1', '5', '10', '30', 'full'].map(p => (
                    <span key={p} onClick={() => setRangeInput(p)} style={{
                      padding: '2px 8px', borderRadius: 999, cursor: 'pointer', fontSize: 10.5, fontWeight: 700,
                      background: rangeInput === p ? 'rgba(82,227,164,0.15)' : 'rgba(255,255,255,0.05)',
                      border: rangeInput === p ? '1px solid rgba(82,227,164,0.35)' : btb.borderSoft,
                      color: rangeInput === p ? btb.green : btb.textMuted,
                    }}>
                      {p === 'full' ? 'Full' : `${p}%`}
                    </span>
                  ))}
                </div>
              </label>
              <Field label="Max spend token A / day" value={capA} onChange={setCapA} placeholder="1000"/>
              <Field label="Max spend token B / day" value={capB} onChange={setCapB} placeholder="1000"/>
            </div>
            <Button size="sm" fullWidth={false} style={{ padding: '0 18px' }}
              loading={busy === 'Load pool'} disabled={busy !== null || step3 === 'locked'} onClick={loadPool}>
              Load pool
            </Button>
            <div style={{ color: btb.textDim, fontSize: 11.5 }}>
              The caps become your on chain rules. Nothing can ever spend past them, not even you, without changing them first.
            </div>
          </div>
        )}
      </StepCard>

      {/* 4. Release */}
      <StepCard n={4} title="Adapter release" state={step4 === 'done' ? 'done' : step4} help={HELP.release}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {releaseState === 'active' && (
            <div style={{ color: btb.green, fontSize: 13, fontWeight: 700 }}>
              The Uniswap V3 adapter release is active in the registry. Accounts can install it.
            </div>
          )}
          {releaseState === 'pending' && (
            <>
              <div style={{ color: btb.textMuted, fontSize: 13 }}>
                Release scheduled behind the 24 hour timelock.{' '}
                {releaseReady ? 'Ready to activate now.' : (
                  <span style={{ color: '#FFB36B', fontWeight: 700, fontFamily: 'monospace' }}>
                    {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')} remaining
                  </span>
                )}
              </div>
              {releaseReady && (
                <Button size="sm" variant="success" fullWidth={false} style={{ padding: '0 18px' }}
                  loading={busy === 'Activate release'} disabled={busy !== null} onClick={activateRelease}>
                  Activate release
                </Button>
              )}
            </>
          )}
          {releaseState === 'none' && (
            <>
              <div style={{ color: btb.textMuted, fontSize: 13 }}>
                No release scheduled yet for this adapter build.
                {isRegistryOwner ? ' You are the registry owner, schedule it below.' : ' The registry owner must schedule it first.'}
              </div>
              {isRegistryOwner && (
                <Button size="sm" fullWidth={false} style={{ padding: '0 18px' }}
                  loading={busy === 'Schedule release'} disabled={busy !== null || !data} onClick={scheduleRelease}>
                  Schedule release
                </Button>
              )}
            </>
          )}
        </div>
      </StepCard>

      {/* 5. Install */}
      <StepCard n={5} title="Install strategy on your account" state={step5} help={HELP.install}>
        {step5 === 'done' ? (
          <div style={{ color: btb.textMuted, fontSize: 13 }}>
            Permission and all five action policies installed. Your rules are on chain.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.6 }}>
              One permission plus five action policies: mint, increase, decrease, collect, burn.
              Six wallet confirmations, each one a rule your account will enforce forever.
            </div>
            <Button size="sm" variant="success" fullWidth={false} style={{ padding: '0 18px' }}
              loading={busy === 'Install strategy'} disabled={busy !== null || step5 !== 'active'} onClick={installStrategy}>
              Install strategy
            </Button>
          </div>
        )}
      </StepCard>

      {/* 6. Fund */}
      <StepCard n={6} title="Fund the strategy" state={step6 === 'done' ? 'done' : step5 === 'done' ? 'active' : 'locked'} help={HELP.fund}>
        {data?.token0 && data.token1 && data.strategy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[{ meta: data.token0, val: fund0, set: setFund0, idx: 0 as const }, { meta: data.token1, val: fund1, set: setFund1, idx: 1 as const }].map(r => (
              <div key={r.idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label={`${r.meta.symbol} amount`} value={r.val} onChange={r.set} placeholder="0.0" width={120}/>
                <Button size="sm" fullWidth={false} style={{ padding: '0 16px' }}
                  loading={busy === `Fund ${r.meta.symbol}`} disabled={busy !== null} onClick={() => fundToken(r.idx)}>
                  Approve and fund
                </Button>
                <span style={{ color: btb.textDim, fontSize: 11.5, paddingBottom: 14 }}>
                  wallet {fmt(r.meta.balance, r.meta.decimals)} · reserved {fmt(r.meta.reserved, r.meta.decimals)}
                </span>
              </div>
            ))}
            <div style={{ color: btb.textDim, fontSize: 11.5 }}>
              Funds move into your own account and are reserved to this strategy only.
            </div>
          </div>
        )}
      </StepCard>

      {/* 7. Run */}
      <StepCard n={7} title="Run it" state={step7} help={HELP.run}>
        {data?.token0 && data.token1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <Field label={`${data.token0.symbol} to deposit`} value={mint0} onChange={setMint0} placeholder="0.0" width={120}/>
              <Field label={`${data.token1.symbol} to deposit`} value={mint1} onChange={setMint1} placeholder="0.0" width={120}/>
              <Button size="sm" variant="success" fullWidth={false} style={{ padding: '0 18px' }}
                loading={busy === 'Mint position'} disabled={busy !== null || step7 !== 'active'} onClick={mintPosition}>
                Mint LP position
              </Button>
            </div>

            {data.positions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.positions.map(p => {
                  const t0 = data.token0!; const t1 = data.token1!;
                  const inRange = data.currentTick !== null && data.currentTick >= p.tickLower && data.currentTick < p.tickUpper;
                  const [rawA0, rawA1] = data.sqrtPriceX96 !== null
                    ? positionAmounts(p.liquidity, data.sqrtPriceX96, p.tickLower, p.tickUpper) : [0, 0];
                  const amt0 = rawA0 / 10 ** t0.decimals;
                  const amt1 = rawA1 / 10 ** t1.decimals;
                  const pLow = tickToPrice(p.tickLower, t0.decimals, t1.decimals);
                  const pHigh = tickToPrice(p.tickUpper, t0.decimals, t1.decimals);
                  const pNow = data.sqrtPriceX96 !== null ? sqrtPriceToPrice(data.sqrtPriceX96, t0.decimals, t1.decimals) : 0;
                  const fmtP = (v: number) => v >= 1e9 || v === 0 ? v.toExponential(2)
                    : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(5);
                  const fmtA = (v: number) => v === 0 ? '0' : v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toPrecision(5);
                  const hasFees = p.fees0 > 0n || p.fees1 > 0n;
                  return (
                    <div key={p.id.toString()} style={{
                      background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 14, padding: '12px 14px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>
                          {t0.symbol} / {t1.symbol} #{p.id.toString()}
                        </span>
                        {p.liquidity > 0n ? (inRange
                          ? <Badge size="sm" color={btb.green} bg="rgba(82,227,164,0.12)" border="1px solid rgba(82,227,164,0.35)">In range, earning</Badge>
                          : <Badge size="sm" color="#FFB36B" bg="rgba(255,179,107,0.12)" border="1px solid rgba(255,179,107,0.35)">Out of range, not earning</Badge>
                        ) : <Badge size="sm" color={btb.textDim}>Closed</Badge>}
                        <div style={{ flex: 1 }}/>
                        <Button size="sm" fullWidth={false} variant="ghost" style={{ padding: '0 12px', height: 32 }}
                          disabled={busy !== null || !hasFees && p.liquidity === 0n} onClick={() => collect(p.id)}>Collect</Button>
                        {p.liquidity > 0n && (
                          <Button size="sm" fullWidth={false} variant="ghost" style={{ padding: '0 12px', height: 32 }}
                            disabled={busy !== null} onClick={() => decrease(p.id, p.liquidity)}>Remove</Button>
                        )}
                        {p.liquidity === 0n && p.fees0 === 0n && p.fees1 === 0n && (
                          <Button size="sm" fullWidth={false} variant="danger" style={{ padding: '0 12px', height: 32 }}
                            disabled={busy !== null} onClick={() => burn(p.id)}>Burn</Button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>In position</div>
                          <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                            {fmtA(amt0)} {t0.symbol}<br/>{fmtA(amt1)} {t1.symbol}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Unclaimed fees</div>
                          <div style={{ color: hasFees ? btb.green : btb.textMuted, fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>
                            {fmt(p.fees0, t0.decimals)} {t0.symbol}<br/>{fmt(p.fees1, t1.decimals)} {t1.symbol}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Range, {t1.symbol} per {t0.symbol}</div>
                          <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                            {p.tickLower <= -887200 && p.tickUpper >= 887200
                              ? 'Full range'
                              : <>{fmtP(pLow)} to {fmtP(pHigh)}</>}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>Current price</div>
                          <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>
                            {fmtP(pNow)} {t1.symbol}
                          </div>
                        </div>
                      </div>

                      {/* Range visual: where the price sits inside the band */}
                      {p.liquidity > 0n && p.tickUpper > p.tickLower && data.currentTick !== null && !(p.tickLower <= -887200 && p.tickUpper >= 887200) && (
                        <div style={{ position: 'relative', height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'visible' }}>
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0, left: '15%', right: '15%',
                            borderRadius: 999, background: inRange ? 'rgba(82,227,164,0.35)' : 'rgba(255,179,107,0.3)',
                          }}/>
                          <div style={{
                            position: 'absolute', top: -3, width: 2, height: 12, borderRadius: 2, background: '#fff',
                            left: `${Math.max(2, Math.min(98, 15 + 70 * (data.currentTick - p.tickLower) / (p.tickUpper - p.tickLower)))}%`,
                          }}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {data.strategy && data.strategy.rangePct > 0 && data.currentTick !== null
              && !(data.currentTick >= data.strategy.tickLower && data.currentTick < data.strategy.tickUpper) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 14px',
                borderRadius: 12, background: 'rgba(255,179,107,0.08)', border: '1px solid rgba(255,179,107,0.3)',
              }}>
                <span style={{ color: '#FFB36B', fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                  The price left your range, so the position stopped earning fees.
                  Recenter unwinds it, moves your funds to a fresh range around the current price, and retires the old rules.
                </span>
                <Button size="sm" fullWidth={false} style={{ padding: '0 16px' }}
                  loading={busy === 'Recenter range'} disabled={busy !== null} onClick={recenter}>
                  Recenter range
                </Button>
              </div>
            )}

            {funded && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(data.token0.reserved > 0n) && (
                  <Button size="sm" fullWidth={false} variant="ghost" style={{ padding: '0 14px' }}
                    disabled={busy !== null} onClick={() => exitToken(0)}>
                    Withdraw {data.token0.symbol} to wallet
                  </Button>
                )}
                {(data.token1.reserved > 0n) && (
                  <Button size="sm" fullWidth={false} variant="ghost" style={{ padding: '0 14px' }}
                    disabled={busy !== null} onClick={() => exitToken(1)}>
                    Withdraw {data.token1.symbol} to wallet
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </StepCard>

      <div style={{ textAlign: 'center', color: btb.textDim, fontSize: 11.5, padding: '4px 0 10px' }}>
        Every action above is enforced by your account contract. Funds only ever move between your wallet, your account, and the pool.
      </div>
    </Screen>
  );
}
