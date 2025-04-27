"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ExternalLink, Copy, Check } from "lucide-react"

interface Currency {
  currency1: string
  currency2: string
  pair: string
}

interface Hook {
  name: string
  address: string
  network: {
    name: string
  }
  deployerAddress: string
  totalVolume: {
    amount: string
  }
  tvl: {
    amount: string
  }
  totalEarning: {
    amount: string
  }
  successRate: number
  deployedAt: string
  isVerified: boolean
  isNoOp: boolean
}

const HookDetail = () => {
  const params = useParams();
  const chainId = params?.chainId as string;
  const address = params?.address as string;
  const [hook, setHook] = useState<Hook | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: HeadersInit = {};
        if (process.env.NEXT_PUBLIC_HOOKRANK_API_KEY) {
          headers["X-API-Key"] = process.env.NEXT_PUBLIC_HOOKRANK_API_KEY;
        }

        const [hookResponse, currenciesResponse] = await Promise.all([
          fetch(`https://api.hookrank.io/api/public/v1/hooks/${chainId}/${address}`, {
            headers
          }),
          fetch(`https://api.hookrank.io/api/public/v1/uniswap/hooks/currencies?hookAddress=${address}`, {
            headers
          }),
        ])

        const [hookData, currenciesData] = await Promise.all([hookResponse.json(), currenciesResponse.json()])

        if (hookData.status === "success") {
          setHook(hookData.data)
        } else {
          throw new Error(`Hook API Response Status: ${hookData.status}`)
        }

        if (currenciesData.data) {
          setCurrencies(currenciesData.data)
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [address, chainId])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatAmount = (amount: string) => {
    return Number.parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const copyToClipboard = async (text: string) => {
    if (text) {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedAddress(true)
        setTimeout(() => {
          setCopiedAddress(false)
        }, 2000)
      } catch (err) {
        console.error("Failed to copy text: ", err)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Loading hook details, please wait...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  if (!hook) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Hook not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <Link href="/hooks-v2" className="text-blue-400 hover:underline mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>
      <div className="bg-gray-800 rounded-lg p-6 text-gray-300">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">{hook.name || "Unknown Hook"}</h1>
          <div className="flex items-center gap-2">
            {hook.isVerified && <span className="px-2 py-1 text-xs bg-green-900 text-green-300 rounded">Verified</span>}
            {hook.isNoOp && <span className="px-2 py-1 text-xs bg-blue-900 text-blue-300 rounded">NoOp</span>}
            {!hook.isVerified && <span className="px-2 py-1 text-xs bg-red-900 text-red-300 rounded">Unverified</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Contract Address</h2>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{hook.address}</span>
                <button onClick={() => copyToClipboard(hook.address)} className="text-gray-400 hover:text-gray-200">
                  {copiedAddress ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Network</h2>
              <span>{hook.network.name}</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Deployer Address</h2>
              <span>{hook.deployerAddress}</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Transaction Volume</h2>
              <span>${formatAmount(hook.totalVolume.amount)}</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">TVL</h2>
              <span>${formatAmount(hook.tvl.amount)}</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Total Earnings</h2>
              <span>${formatAmount(hook.totalEarning.amount)}</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Success Rate</h2>
              <span className="text-green-400">{hook.successRate}%</span>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-2">Deployed At</h2>
              <span>{formatDate(hook.deployedAt)}</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Pairs</h2>
            <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto pr-2">
              {currencies.map((currency) => (
                <div
                  key={currency.pair}
                  className="px-3 py-2 bg-gray-700 rounded-full text-sm text-white text-center truncate"
                >
                  {currency.currency1}/{currency.currency2}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <a
            href={`https://etherscan.io/address/${hook.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:underline"
          >
            View on Etherscan
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

export default HookDetail
