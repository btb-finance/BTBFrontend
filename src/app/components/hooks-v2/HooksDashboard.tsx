"use client"

import { useState, useEffect, useMemo } from "react"
import HooksControls from "./HooksControls"
import HooksList from "./HooksList"
import { getHookrankApiKey } from '../../hooks-v2/usePublicApi'

export interface Hook {
  id: string;
  name: string;
  address: string;
  deployerAddress: string;
  network: {
    name: string;
    chainId: number;
  };
  deployedAt: string;
  totalVolume: {
    amount: number;
  };
  tvl: {
    amount: number;
  };
  totalEarning: {
    amount: number;
  };
  isVerified: boolean;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

const HooksDashboard = () => {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [filteredHooks, setFilteredHooks] = useState<Hook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNetwork, setSelectedNetwork] = useState("all")
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "deployedAt",
    direction: "asc",
  })
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)

  const fetchPage = async (page: number, limit: number): Promise<Hook[]> => {
    try {
      // Get API key from our utility function
      const apiKey = getHookrankApiKey();
      
      const response = await fetch(`https://api.hookrank.io/api/public/v1/uniswap/hooks?page=${page}&limit=${limit}`, {
        headers: {
          "X-API-Key": apiKey,
        },
      })
      
      if (!response.ok) {
        throw new Error(`API Response Status: ${response.status}`);
      }
      
      const data = await response.json()
      if (data.status === "success") {
        return data.data
      } else {
        throw new Error(`API Response Status: ${data.status}`)
      }
    } catch (error) {
      console.error("Fetch error details:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to fetch page ${page}: ${error.message}`);
      }
      throw new Error(`Failed to fetch page ${page}`);
    }
  }

  const fetchAllHooks = async () => {
    let allHooks: Hook[] = []
    let page = 1
    const limit = 100

    try {
      while (true) {
        const response = await fetchPage(page, limit)
        if (response.length === 0) break
        allHooks = allHooks.concat(response)
        page++
      }
      setHooks(allHooks)
      setFilteredHooks(allHooks)
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('An unknown error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  const getSortedHooks = useMemo(() => {
    return (hooksToSort: Hook[]) => {
      return [...hooksToSort].sort((a, b) => {
        let aValue: any = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj: any, key: string) => obj[key], a)
          : (a as any)[sortConfig.key]
        let bValue: any = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj: any, key: string) => obj[key], b)
          : (b as any)[sortConfig.key]

        if (typeof aValue === "string") {
          aValue = aValue.toLowerCase()
          bValue = bValue.toLowerCase()
        }

        if (sortConfig.direction === "asc") {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })
    }
  }, [sortConfig])

  useEffect(() => {
    let filtered = hooks

    if (showVerifiedOnly) {
      filtered = filtered.filter((hook) => hook.isVerified)
    }

    if (selectedNetwork !== "all") {
      filtered = filtered.filter((hook) => hook.network.name.toLowerCase() === selectedNetwork.toLowerCase())
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (hook) =>
          (hook.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          hook.address.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    filtered = getSortedHooks(filtered)

    setFilteredHooks(filtered)
  }, [selectedNetwork, searchTerm, hooks, showVerifiedOnly, getSortedHooks])

  useEffect(() => {
    fetchAllHooks()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">Loading all hooks, please wait...</div>
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

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="mb-12 w-full">
        <h1 className="text-4xl font-bold text-white mb-2">Uniswap Hooks</h1>
        <p className="text-orange-500 mb-8">Uniswap V4 Hooks Analytics</p>

        <HooksControls
          selectedNetwork={selectedNetwork}
          setSelectedNetwork={setSelectedNetwork}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          showVerifiedOnly={showVerifiedOnly}
          setShowVerifiedOnly={setShowVerifiedOnly}
          sortConfig={sortConfig}
          setSortConfig={setSortConfig}
        />
      </div>

      <div className="w-full mb-8">
        <hr className="border-gray-700" />
      </div>

      <HooksList hooks={filteredHooks} />

      {loading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-white">Loading all hooks, please wait...</div>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-red-500">Error: {error}</div>
        </div>
      )}
    </div>
  )
}

export default HooksDashboard
