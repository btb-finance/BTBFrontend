"use client"

import { useState, useEffect, useMemo } from "react"
import { ExternalLink, Copy, Check, Search, ArrowUpDown, ChevronDown } from "lucide-react"

const HooksDashboard = () => {
  const [hooks, setHooks] = useState([])
  const [filteredHooks, setFilteredHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedAddresses, setCopiedAddresses] = useState({})
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNetwork, setSelectedNetwork] = useState("all")
  const [sortConfig, setSortConfig] = useState({
    key: "deployedAt",
    direction: "asc",
  })
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const networks = [
    { id: "all", name: "All Networks" },
    { id: "ethereum", name: "Ethereum" },
    { id: "base", name: "Base" },
    { id: "optimism", name: "Optimism" },
    { id: "arbitrum", name: "Arbitrum" },
    { id: "polygon", name: "Polygon" },
    { id: "avalanche", name: "Avalanche" },
    { id: "bsc", name: "BSC" },
  ]

  const sortOptions = [
    { key: "name", label: "Name" },
    { key: "deployedAt", label: "Deployed at" },
    { key: "totalVolume.amount", label: "Transaction Volume" },
    { key: "fee", label: "Fee" },
    { key: "tvl.amount", label: "TVL" },
  ]

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

  const fetchPage = async (page, limit) => {
    try {
      const response = await fetch(`https://api.hookrank.io/api/public/v1/uniswap/hooks?page=${page}&limit=${limit}`, {
        headers: {
            "X-API-Key": process.env.NEXT_PUBLIC_HOOKRANK_API_KEY,
        },
      })
      const data = await response.json()
      if (data.status === "success") {
        return data
      } else {
        throw new Error(`API Response Status: ${data.status}`)
      }
    } catch (error) {
      throw new Error(`Failed to fetch page ${page}: ${error.message}`)
    }
  }

  const fetchAllHooks = async () => {
    let allHooks = []
    let page = 1
    const limit = 100

    try {
      while (true) {
        const response = await fetchPage(page, limit)
        if (response.data.length === 0) break
        allHooks = allHooks.concat(response.data)
        page++
      }
      setHooks(allHooks)
      setFilteredHooks(allHooks)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === "asc" ? "desc" : "asc",
    }))
    setShowSortDropdown(false)
  }

  const getSortedHooks = useMemo(() => {
    return (hooksToSort) => {
      return [...hooksToSort].sort((a, b) => {
        let aValue = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj, key) => obj[key], a)
          : a[sortConfig.key]
        let bValue = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj, key) => obj[key], b)
          : b[sortConfig.key]

        // Handle null/undefined values
        if (!aValue) aValue = ""
        if (!bValue) bValue = ""

        // Convert to numbers for numeric comparisons
        if (typeof aValue === "string" && !isNaN(aValue)) {
          aValue = Number.parseFloat(aValue)
          bValue = Number.parseFloat(bValue)
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }
  }, [sortConfig])

  useEffect(() => {
    let filtered = hooks

    // Filter by verified status
    if (showVerifiedOnly) {
      filtered = filtered.filter((hook) => hook.isVerified)
    }

    // Filter by network
    if (selectedNetwork !== "all") {
      filtered = filtered.filter((hook) => hook.network.name.toLowerCase() === selectedNetwork.toLowerCase())
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (hook) =>
          (hook.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          hook.address.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Apply sorting
    filtered = getSortedHooks(filtered)

    setFilteredHooks(filtered)
  }, [selectedNetwork, searchTerm, hooks, showVerifiedOnly, getSortedHooks])

  useEffect(() => {
    fetchAllHooks()
  }, [])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatAmount = (amount) => {
    return Number.parseFloat(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
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
      {/* Header Section */}
      <div className="mb-12 w-full">
        <h1 className="text-4xl font-bold text-white mb-2">Uniswap Hooks</h1>
        <p className="text-orange-500 mb-8">Uniswap V4 Hooks Analytics</p>

        {/* Top Controls */}
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="relative">
            <select
              className="w-full pl-3 pr-10 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
            >
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select className="w-full pl-3 pr-10 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Select pair</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full mb-8">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search hook by name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Controls - Moved to right */}
        <div className="flex justify-end w-full">
          <div className="flex items-center gap-4">
            {/* Verified Toggle */}
            <div className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                id="verifiedOnly"
                checked={showVerifiedOnly}
                onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
              />
              <label htmlFor="verifiedOnly">Only verified</label>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowUpDown className="h-4 w-4" />
                Sort by: {sortOptions.find((opt) => opt.key === sortConfig.key)?.label}
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    {sortOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => handleSort(option.key)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                        role="menuitem"
                      >
                        {option.label}
                        {sortConfig.key === option.key && (
                          <span className="float-right text-xs text-gray-400">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Horizontal Line */}
      <div className="w-full mb-8">
        <hr className="border-gray-700" />
      </div>

      {/* Hooks Data */}
      <div className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredHooks.map((hook, index) => (
            <div key={index} className="bg-gray-800 rounded-lg p-6 text-gray-300">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white truncate">
                  {hook.name || (hook.address ? hook.address.slice(0, 8) : "Unknown")}
                </h2>
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
                      {copiedAddresses[`contract-${index}`] ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
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
                      {copiedAddresses[`deployer-${index}`] ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
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
      </div>

      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-white">Loading all hooks, please wait...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
          <div className="text-red-500">Error: {error}</div>
        </div>
      )}
    </div>
  )
}

export default HooksDashboard

