"use client"

import { useState } from "react"
import { Search, ArrowUpDown, ChevronDown } from "lucide-react"

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

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface HooksControlsProps {
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showVerifiedOnly: boolean;
  setShowVerifiedOnly: (show: boolean) => void;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig | ((prev: SortConfig) => SortConfig)) => void;
}

const HooksControls = ({
  selectedNetwork,
  setSelectedNetwork,
  searchTerm,
  setSearchTerm,
  showVerifiedOnly,
  setShowVerifiedOnly,
  sortConfig,
  setSortConfig,
}: HooksControlsProps) => {
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const handleSort = (key: string) => {
    setSortConfig((prevConfig: SortConfig): SortConfig => ({
      key,
      direction: (prevConfig.key === key && prevConfig.direction === "asc" ? "desc" : "asc") as SortDirection,
    }))
    setShowSortDropdown(false)
  }

  return (
    <>
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

      <div className="flex justify-end w-full">
        <div className="flex items-center gap-4">
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
    </>
  )
}

export default HooksControls
