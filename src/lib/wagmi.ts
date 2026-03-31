import { http, createConfig, fallback, webSocket } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { getDefaultConfig } from 'connectkit'

export const config = createConfig(
  getDefaultConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: fallback([
        http('https://eth.llamarpc.com'),
        webSocket('wss://ethereum-rpc.publicnode.com'),
        webSocket('wss://0xrpc.io/eth'),
        webSocket('wss://eth.drpc.org'),
        http('https://rpc.flashbots.net'),
        http('https://rpc.flashbots.net/fast'),
        http('https://api.zan.top/eth-mainnet'),
        http('https://ethereum-rpc.publicnode.com'),
        http('https://eth-mainnet.rpcfast.com?api_key=xbhWBI1Wkguk8SNMu1bvvLurPGLXmgwYeC4S6g2H7WdwFigZSmPWVZRxrskEQwIf'),
        http('https://ethereum-mainnet.gateway.tatum.io'),
      ]),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '',
    appName: 'BTB Finance',
    appDescription: 'BTB Finance - DeFi Innovation on Ethereum',
    appUrl: 'https://www.btb.finance',
  })
)
