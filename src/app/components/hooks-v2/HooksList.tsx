"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Copy, Check } from "lucide-react"

const HooksList = ({ hooks }) => {
  const [copiedAddresses, setCopiedAddresses] = useState({})

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatAmount = (amount) => {
    return Number.parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getExplorerUrl = (network, address) => {
    const explorers = {
      Ethereum: `https://etherscan.io/address/${address}`,
      Base: `https://basescan.org/address/${address}`,
      Polygon: `https://polygonscan.com/address/${address}`,
      "Arbitrum One": `https://arbiscan.io/address/${address}`,
      Optimism: `https://optimistic.etherscan.io/address/${address}`,
      Avalanche: `https://snowtrace.io/address/${address}`,
      BSC: `https://bscscan.com/address/${address}`,
      Goerli: `https://goerli.etherscan.io/address/${address}`,
      Sepolia: `https://sepolia.etherscan.io/address/${address}`,
    }

    return explorers[network] || `https://etherscan.io/address/${address}`
  }

  const handleExplore = (network, address) => {
    if (address) {
      const url = getExplorerUrl(network.name, address)
      window.open(url, "_blank")
    }
  }

  const copyToClipboard = async (text, id) => {
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedAddresses((prev) => ({ ...prev, [id]: true }))
        setTimeout(() => {
          setCopiedAddresses((prev) => ({ ...prev, [id]: false }))
        }, 2000)
      } catch (err) {
        console.error("Failed to copy text: ", err)
      }
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {hooks.map((hook, index) => (
        <div key={index} className="bg-gray-800 rounded-lg p-6 text-gray-300">
          <div className="flex justify-between items-center mb-4">
            <Link
              href={`/hooks-v2/${hook.network.chainId}/${hook.address}`}
              className="hover:text-blue-400 transition-colors"
            >
              <h2 className="text-xl font-semibold text-white truncate">
                {hook.name || (hook.address ? hook.address.slice(0, 8) : "Unknown")}
              </h2>
            </Link>
            <div className="flex items-center gap-2">
              {hook.isVerified && (
                <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded">Verified</span>
              )}
              {hook.isNoOp && <span className="px-2 py-1 text-xs bg-blue-900 text-blue-300 rounded">NoOp</span>}
              {!hook.isVerified && (
                <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">Unverified</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Chain</span>
              <div className="flex items-center gap-2">
                <span>{hook.network.name}</span>
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Contract Address</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExplore(hook.network, hook.address)}
                  className="text-gray-400 hover:text-gray-200 no-underline"
                >
                  {hook.address ? `${hook.address.slice(0, 8)}...` : "Unknown"}
                </button>
                <button
                  onClick={() => copyToClipboard(hook.address, `contract-${index}`)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  {copiedAddresses[`contract-${index}`] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span>Deployer Address</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExplore(hook.network, hook.deployerAddress)}
                  className="text-gray-400 hover:text-gray-200 no-underline"
                >
                  {hook.deployerAddress ? `${hook.deployerAddress.slice(0, 8)}...` : "Unknown"}
                </button>
                <button
                  onClick={() => copyToClipboard(hook.deployerAddress, `deployer-${index}`)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  {copiedAddresses[`deployer-${index}`] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <span>Transaction volume</span>
              <span>${formatAmount(hook.totalVolume.amount)}</span>
            </div>

            <div className="flex justify-between">
              <span>TVL</span>
              <span>${formatAmount(hook.tvl.amount)}</span>
            </div>

            <div className="flex justify-between">
              <span>Total Earnings</span>
              <span>${formatAmount(hook.totalEarning.amount)}</span>
            </div>

            <div className="flex justify-between">
              <span>Success rate</span>
              <span className="text-green-400">{hook.successRate}%</span>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center text-sm text-gray-500">
            <span>Deployed: {formatDate(hook.deployedAt)}</span>
            <button
              onClick={() => handleExplore(hook.network, hook.address)}
              className="flex items-center gap-1 px-3 py-1 rounded border border-gray-700 hover:bg-gray-700 transition-colors"
            >
              Explore
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default HooksList

