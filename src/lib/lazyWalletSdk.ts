import type { CreateConnectorFn } from 'wagmi';

/**
 * Keeps a wallet SDK (MetaMask SDK, WalletConnect, Coinbase) out of the page until this browser has a reason to load it.
 *
 * Unwrapped, every visit downloaded all three (~1 MB of JS) and opened a WalletConnect relay socket: wagmi calls
 * `setup()` on every connector when the config is created (WalletConnect's builds its provider there), and its
 * reconnect calls `getProvider()` on every connector, even for someone who has never connected a wallet.
 *
 * The SDK is loaded when:
 *  - the user picks the connector (`connect`), or
 *  - this browser connected with it before: it is the recent connector, or it is in the saved connections.
 * Otherwise `getProvider()` resolves to undefined, which wagmi's reconnect already treats as "skip this connector".
 */
export function lazyWalletSdk<T extends CreateConnectorFn>(connectorFn: T): T {
  return ((params: Parameters<T>[0]) => {
    const inner = connectorFn(params);
    const { setup, getProvider, connect } = inner;
    let armed: Promise<boolean> | null = null;
    let setUp = false;

    // Has this browser used this connector before? Read once from wagmi's own storage.
    const wasUsed = async (id: string) => {
      try {
        const recent = await params.storage?.getItem('recentConnectorId');
        if (recent === id) return true;
        const saved = await params.storage?.getItem('store' as never);
        return JSON.stringify(saved ?? '').includes(`"id":"${id}"`);
      } catch {
        return false;
      }
    };

    return {
      ...inner,
      async setup() {
        // Deferred: run with the provider once it is loaded (below), not at config creation.
      },
      async connect(this: typeof inner, args?: Parameters<typeof connect>[0]) {
        armed = Promise.resolve(true);
        return connect.call(this, args as never);
      },
      async getProvider(this: typeof inner, args?: Parameters<typeof getProvider>[0]) {
        armed ??= wasUsed(this.id);
        if (!(await armed)) return undefined as never;
        const provider = await getProvider.call(this, args as never);
        if (!setUp && setup) {
          setUp = true;
          // The SDK's own listeners (WalletConnect session events); its getProvider call returns the cached provider.
          await setup.call(this).catch(() => {});
        }
        return provider;
      },
    };
  }) as T;
}
