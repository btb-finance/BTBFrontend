'use client';
import { TokenPanel } from './TokenPanel';
import type { Tab } from '../types';

/** Home is the Earn screen. Markets and trading live on the Trade tab. */
export function HomeScreen({ address, onConnectWallet, goto, onEarn, onBuyBtb }: {
  goto: (t: Tab) => void;
  address?: string;
  onEarn?: () => void;
  onConnectWallet?: () => void;
  onBuyBtb?: () => void;
}) {
  return (
    <TokenPanel
      address={address}
      onSwap={onBuyBtb ?? (() => {})}
      onConnect={onConnectWallet ?? (() => {})}
      onEarn={onEarn ?? (() => {})}
      goto={goto}
    />
  );
}
