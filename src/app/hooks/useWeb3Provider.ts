import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';

export function useWeb3Provider() {
  const { address, isConnected } = useWallet();
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    const initProvider = async () => {
      if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && isConnected) {
        try {
          // Create Web3Provider instance
          const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
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

    initProvider();
  }, [isConnected, address]);

  return { provider, signer };
}

export default useWeb3Provider;
