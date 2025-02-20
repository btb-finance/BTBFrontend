"use client"

import { useState, useEffect, useMemo } from "react"
import HooksControls from "./HooksControls"
import HooksList from "./HooksList"

const HooksDashboard = () => {
  const [hooks, setHooks] = useState([])
  const [filteredHooks, setFilteredHooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedNetwork, setSelectedNetwork] = useState("all")
  const [sortConfig, setSortConfig] = useState({
    key: "deployedAt",
    direction: "asc",
  })
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false)

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

  const getSortedHooks = useMemo(() => {
    return (hooksToSort) => {
      return [...hooksToSort].sort((a, b) => {
        let aValue = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj, key) => obj[key], a)
          : a[sortConfig.key]
        let bValue = sortConfig.key.includes(".")
          ? sortConfig.key.split(".").reduce((obj, key) => obj[key], b)
          : b[sortConfig.key]

        if (!aValue) aValue = ""
        if (!bValue) bValue = ""

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

