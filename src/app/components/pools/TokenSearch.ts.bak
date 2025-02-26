import React, { FormEvent, useState } from 'react';
import { Token } from '@/app/types/uniswap';
import { ethers } from 'ethers';
import UniswapV4Service from '@/app/services/uniswapV4Service';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface TokenSearchProps {
  onSelectToken: (token: Token) => void;
  isLoading: boolean;
}

export const TokenSearch: React.FC<TokenSearchProps> = ({ onSelectToken, isLoading }) => {
  const [tokenAddress, setTokenAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [localLoading, setLocalLoading] = useState<boolean>(false);

  // Common tokens on Base chain
  const commonTokens: Token[] = [
    {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
      name: 'Wrapped Ether'
    },
    {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin'
    },
    {
      address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      symbol: 'USDbC',
      decimals: 6,
      name: 'USD Base Coin'
    },
    {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      symbol: 'DAI',
      decimals: 18,
      name: 'Dai Stablecoin'
    },
  ];

  // Select common token
  const selectCommonToken = (token: Token) => {
    onSelectToken(token);
  };

  // Validate token address on submitting
  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    
    setLocalLoading(true);
    setError('');
    
    try {
      // Basic validation for Ethereum address format
      if (!tokenAddress.match(/^0x[0-9a-fA-F]{40}$/)) {
        setError('Invalid token address format. Must be a valid Ethereum address.');
        setLocalLoading(false);
        return;
      }
      
      // Try to normalize the address using ethers to catch checksum errors
      let normalizedAddress: string;
      try {
        normalizedAddress = ethers.utils.getAddress(tokenAddress);
      } catch (error) {
        console.error('Address normalization error:', error);
        setError('Invalid Ethereum address checksum. Please check the address and try again.');
        setLocalLoading(false);
        return;
      }
      
      // Create a placeholder token and let the service handle validation
      const token: Token = {
        address: normalizedAddress,
        symbol: '', // Will be fetched if token is valid
        decimals: 0,
        name: ''
      };
      
      onSelectToken(token);
      setLocalLoading(false);
    } catch (error) {
      console.error('Error in token search:', error);
      setError('Error validating token. Please check the address and try again.');
      setLocalLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-xl font-bold mb-4">Find Token Pools</h2>
      
      <form onSubmit={handleSearch} className="mb-4">
        <div className="mb-4">
          <Label htmlFor="tokenAddress">Token Address</Label>
          <Input
            id="tokenAddress"
            placeholder="0x..."
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            className="w-full mt-1"
            disabled={isLoading || localLoading}
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading || localLoading || !tokenAddress}
        >
          {localLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Search
        </Button>
      </form>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">Common Tokens</h3>
        <div className="flex flex-wrap gap-2">
          {commonTokens.map((token) => (
            <Button
              key={token.address}
              variant="outline"
              size="sm"
              onClick={() => selectCommonToken(token)}
              disabled={isLoading || localLoading}
            >
              {token.symbol}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
