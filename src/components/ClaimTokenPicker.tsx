'use client';
/**
 * Pick the token rewards are sold into: common Base tokens, then what the wallet holds on Base, or any token by
 * pasting its address. Uses the shared picker sheet so it looks like Swap's.
 */
import { useMemo, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { erc20Abi, isAddress, type Address } from 'viem';
import { PickerSheet, PickerTokenRow } from './PickerSheet';
import { TokenIcon } from './TokenIcon';
import { useTokenStore, useTokenLogos } from '../lib/TokenStore';
import { AERO, AERO_CHAIN_ID } from '../lib/aero/allocator';
import { BASE_USDC, NATIVE, type SellTarget } from '../lib/aero/claimSell';

export const COMMON_TARGETS: SellTarget[] = [
  { address: BASE_USDC, symbol: 'USDC', decimals: 6 },
  { address: NATIVE, symbol: 'ETH', decimals: 18 },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  { address: AERO.aero, symbol: 'AERO', decimals: 18 },
  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', decimals: 8 },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18 },
];

export function ClaimTokenPicker({ selected, onPick, onClose }: { selected: string; onPick: (t: SellTarget) => void; onClose: () => void }) {
  const config = useConfig();
  const { positions } = useTokenStore();
  const logo = useTokenLogos();
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo((): (SellTarget & { balance?: string; usd?: number })[] => {
    const held = positions
      .filter((t) => t.chainId === AERO_CHAIN_ID && t.address !== 'ETH' && (t.usdValue ?? 0) >= 1)
      .map((t) => ({ address: t.address as Address, symbol: t.symbol, decimals: t.decimals, balance: t.balance, usd: t.usdValue }));
    const seen = new Set<string>();
    return [...COMMON_TARGETS, ...held].filter((t) => {
      const k = t.address.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [positions]);

  const needle = q.trim().toLowerCase();
  const shown = needle ? list.filter((t) => t.symbol.toLowerCase().includes(needle) || t.address.toLowerCase() === needle) : list;

  // A pasted address that is not listed: read it from the chain and offer it.
  async function pickAddress() {
    setErr(null);
    const client = getPublicClient(config, { chainId: AERO_CHAIN_ID });
    if (!client) return;
    try {
      const [symbol, decimals] = await Promise.all([
        client.readContract({ address: q.trim() as Address, abi: erc20Abi, functionName: 'symbol' }),
        client.readContract({ address: q.trim() as Address, abi: erc20Abi, functionName: 'decimals' }),
      ]);
      onPick({ address: q.trim() as Address, symbol, decimals });
    } catch { setErr('No token at that address on Base.'); }
  }

  return (
    <PickerSheet title="Receive rewards as" query={q} onQuery={(v) => { setQ(v); setErr(null); }} placeholder="Search or paste a Base token address" onClose={onClose}
      footer={err ?? 'Each reward token is swapped into this one in the same confirmation.'}>
      {shown.map((t) => (
        <PickerTokenRow key={t.address} symbol={t.symbol} selected={t.address.toLowerCase() === selected.toLowerCase()}
          icon={<TokenIcon symbol={t.symbol} size={30} logoUrl={logo(t.address, AERO_CHAIN_ID, t.symbol)}/>}
          balance={t.balance}
          usd={t.usd ? `$${t.usd.toFixed(2)}` : undefined}
          onClick={() => onPick({ address: t.address, symbol: t.symbol, decimals: t.decimals })}/>
      ))}
      {shown.length === 0 && isAddress(q.trim()) && (
        <PickerTokenRow symbol="Use this address" name={q.trim()} icon={<TokenIcon symbol="?" size={30}/>} onClick={pickAddress}/>
      )}
    </PickerSheet>
  );
}
