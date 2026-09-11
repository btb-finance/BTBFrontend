'use client';
import { useEffect } from 'react';
import { useConnect, useConnectors, useConnection } from 'wagmi';

/** Inside the Safe{Wallet} iframe, connect through the Safe automatically —
 * a Safe App has exactly one wallet, the Safe itself, so there is nothing to
 * pick. Outside an iframe this renders nothing and does nothing. */
export function SafeAutoConnect() {
  const connectors = useConnectors();
  const { connect } = useConnect();
  const { isConnected } = useConnection();
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window || isConnected) return;
    const safe = connectors.find((c) => c.id === 'safe');
    if (safe) connect({ connector: safe });
  }, [connectors, connect, isConnected]);
  return null;
}
