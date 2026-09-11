'use client';
import { TokenPanel } from './TokenPanel';
import type { Tab } from '../types';

/** Home is the Earn screen. Markets and trading live on the Trade tab. */
export function HomeScreen({ address, onConnectWallet, goto, onBuyBtb }: {
  goto: (t: Tab) => void;
  address?: string;
  onConnectWallet?: () => void;
  onBuyBtb?: () => void;
}) {
  return (
    <TokenPanel
      address={address}
      onSwap={onBuyBtb ?? (() => {})}
      onConnect={onConnectWallet ?? (() => {})}
      goto={goto}
    />
  );
}
