import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-700">
          Connected to {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
        <button
          onClick={() => disconnect()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          onClick={() => connect({ connector })}
          className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
            !connector.ready ? 'bg-gray-400 cursor-not-allowed' :
            isLoading && connector.id === pendingConnector?.id ? 'bg-blue-400' :
            'bg-blue-600 hover:bg-blue-700'
          }`}
          disabled={!connector.ready || (isLoading && connector.id === pendingConnector?.id)}
        >
          {isLoading && connector.id === pendingConnector?.id ? (
            'Connecting...'
          ) : (
            `Connect ${connector.name}`
          )}
        </button>
      ))}
      {error && (
        <div className="text-red-500 text-sm mt-2">
          {error.message}
        </div>
      )}
    </div>
  )
}
