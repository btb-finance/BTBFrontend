import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';

export function useWeb3Provider() {
  const { address, isConnected } = useWallet();
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [networkVersion, setNetworkVersion] = useState<string | null>(null);

  useEffect(() => {
    const initProvider = async () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && isConnected) {
        try {
          // Get current network to track changes
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setNetworkVersion(chainId);
          
          // Create Web3Provider instance with explicit network
          // Need to cast window.ethereum to any to avoid type errors with ethers v5
          const web3Provider = new ethers.BrowserProvider(
            window.ethereum as any,
            {
              name: 'unknown',
              chainId: parseInt(chainId, 16)
            }
          );
          
          setProvider(web3Provider);
          
          // Get signer
          const web3Signer = web3Provider.getSigner();
          setSigner(web3Signer);
        } catch (error) {
          console.error('Error initializing web3 provider:', error);
          setProvider(null);
          setSigner(null);
        }
      } else {
        setProvider(null);
        setSigner(null);
      }
    };

    // Listen for network changes
    const handleChainChanged = async (chainId: string) => {
      console.log('Chain changed in useWeb3Provider:', chainId);
      // Reset provider on network change
      setProvider(null);
      setSigner(null);
      setNetworkVersion(chainId);
      
      // Re-initialize provider with new network
      if (isConnected && window.ethereum) {
        try {
          const web3Provider = new ethers.BrowserProvider(
            window.ethereum as any,
            {
              name: 'unknown',
              chainId: parseInt(chainId, 16)
            }
          );
          setProvider(web3Provider);
          const web3Signer = web3Provider.getSigner();
          setSigner(web3Signer);
        } catch (error) {
          console.error('Error reinitializing provider after chain change:', error);
        }
      }
    };

    initProvider();

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, address]);

  return { provider, signer, networkVersion };
}

export default useWeb3Provider;
