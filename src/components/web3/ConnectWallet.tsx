'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export const ConnectWallet = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="gradient-border glow px-6 py-2.5 bg-[var(--background-light)] text-sm font-medium hover:bg-[var(--background-dark)] transition-colors"
                    type="button"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="px-6 py-2.5 bg-red-500/20 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500/30 transition-colors"
                    type="button"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-3">
                  <button
                    onClick={openChainModal}
                    className="gradient-border px-4 py-2.5 bg-[var(--background-light)] text-sm font-medium hover:bg-[var(--background-dark)] transition-colors flex items-center gap-2"
                    type="button"
                  >
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="gradient-border px-4 py-2.5 bg-[var(--background-light)] text-sm font-medium hover:bg-[var(--background-dark)] transition-colors"
                    type="button"
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
