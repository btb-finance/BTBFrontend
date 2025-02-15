'use client'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { optimism } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'
import WalletConnect from '../components/WalletConnect'
import TokenInfo from '../components/TokenInfo'

// Configure chains
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [optimism],
  [publicProvider()]
)

// Set up connectors
const connectors = [
  new MetaMaskConnector({ chains }),
  new WalletConnectConnector({
    chains,
    options: {
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
      showQrModal: true,
    },
  }),
]

// Create wagmi config
const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

export default function Home() {
  return (
    <WagmiConfig config={config}>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">BTB Finance</h1>
        <div className="mb-8">
          <WalletConnect />
        </div>
        <TokenInfo />
      </main>
    </WagmiConfig>
  )
}
