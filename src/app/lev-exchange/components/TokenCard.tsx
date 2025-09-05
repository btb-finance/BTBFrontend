'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  TrendingUpIcon, 
  TrendingDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  InfoIcon,
  StarIcon,
  CopyIcon
} from 'lucide-react';
import { TokenInfo, getTokenSymbolFromAddress } from '../services/leverageTokenService';

interface TokenCardProps {
  token: TokenInfo;
  isSelected: boolean;
  onSelect: (token: TokenInfo) => void;
  onTrade?: (token: TokenInfo) => void;
}

export default function TokenCard({ token, isSelected, onSelect, onTrade }: TokenCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const openEtherscan = (address: string) => {
    window.open(`https://sepolia.basescan.org/address/${address}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`cursor-pointer transition-all duration-300 ${
        isSelected ? 'ring-2 ring-btb-primary' : ''
      }`}
    >
      <Card className={`p-4 hover:shadow-lg ${
        isSelected 
          ? 'border-btb-primary bg-btb-primary/5 shadow-md' 
          : 'border-gray-200 dark:border-gray-700 hover:border-btb-primary/30'
      }`}>
        <div className="flex items-center justify-between" onClick={() => onSelect(token)}>
          <div className="flex items-center space-x-4">
            {/* Token Logo/Avatar */}
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-btb-primary to-btb-primary-light rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">
                  {token.symbol.replace('lev', '').slice(0, 2)}
                </span>
              </div>
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                token.active ? 'bg-green-500' : 'bg-gray-400'
              }`} />
            </div>

            {/* Token Info */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{token.symbol}</h3>
                <Badge variant={token.active ? "success" : "secondary"}>
                  {token.active ? "Active" : "Inactive"}
                </Badge>
                {token.leverage && (
                  <Badge variant="outline" className="text-btb-primary border-btb-primary">
                    {token.leverage}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{token.name}</p>
              <p className="text-xs text-gray-400">
                Backing: {getTokenSymbolFromAddress(token.backingToken)}
              </p>
            </div>
          </div>
          
          {/* Price and Stats */}
          <div className="text-right">
            <div className="font-bold text-lg">{token.price || '$0.00'}</div>
            <div className={`text-sm flex items-center justify-end ${
              (token.priceChange24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(token.priceChange24h || 0) >= 0 ? (
                <TrendingUpIcon className="w-3 h-3 mr-1" />
              ) : (
                <TrendingDownIcon className="w-3 h-3 mr-1" />
              )}
              {Math.abs(token.priceChange24h || 0).toFixed(2)}%
            </div>
            {token.apy && (
              <div className="text-xs text-green-600 font-medium">
                APY: {token.apy}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsFavorite(!isFavorite);
              }}
              className={isFavorite ? 'text-yellow-500' : 'text-gray-400'}
            >
              <StarIcon className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              {/* Detailed Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Volume 24h</div>
                  <div className="font-semibold text-sm">{token.volume24h || '$0'}</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">TVL</div>
                  <div className="font-semibold text-sm">{token.tvl || '$0'}</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Leverage</div>
                  <div className="font-semibold text-sm text-btb-primary">{token.leverage || 'N/A'}</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">APY</div>
                  <div className="font-semibold text-sm text-green-600">{token.apy || 'N/A'}</div>
                </div>
              </div>

              {/* Contract Addresses */}
              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Leverage Contract</div>
                  <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <code className="text-xs font-mono">{formatAddress(token.leverageContract)}</code>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.leverageContract)}
                        className="h-6 w-6 p-0"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEtherscan(token.leverageContract)}
                        className="h-6 w-6 p-0"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-1">Backing Token</div>
                  <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded">
                    <code className="text-xs font-mono">{formatAddress(token.backingToken)}</code>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(token.backingToken)}
                        className="h-6 w-6 p-0"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEtherscan(token.backingToken)}
                        className="h-6 w-6 p-0"
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deploy Info */}
              <div className="text-xs text-gray-500 mb-4">
                Deployed: {new Date(token.deployedAt * 1000).toLocaleDateString()}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button 
                  className="flex-1 btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrade?.(token);
                  }}
                  disabled={!token.active}
                >
                  Trade {token.symbol}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Add to watchlist or portfolio tracking
                  }}
                >
                  <InfoIcon className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Copy notification */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 right-4 bg-green-600 text-white px-3 py-2 rounded-md shadow-lg z-50"
          >
            Address copied to clipboard!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}