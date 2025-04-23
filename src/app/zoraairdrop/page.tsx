'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import { Button } from '../components/ui/button';
import { WalletIcon } from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { motion } from 'framer-motion';
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import zoraChkerABI from './zorachkerabi.json';
import { toast } from 'react-hot-toast';

// Contract addresses
const CHKER_CONTRACT_ADDRESS = '0x0000000002ba96C69b95E32CAAB8fc38bAB8B3F8';
const ZORA_CONTRACT_ADDRESS = '0x1111111111166b7FE7bd91427724B487980aFc69';

export default function ZoraAirdrop() {
  const { address, isConnected, connectWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [addressToCheck, setAddressToCheck] = useState('');
  const [allocation, setAllocation] = useState<any>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [activeTab, setActiveTab] = useState('check');
  const [claimIsOpen, setClaimIsOpen] = useState(false);
  const [claimStart, setClaimStart] = useState<string>('');
  const [totalAllocated, setTotalAllocated] = useState<string>('');
  const [zoraBalance, setZoraBalance] = useState<string>('0');
  const [contractInfo, setContractInfo] = useState({
    token: '',
    admin: '',
    allocationSetter: ''
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      setAddressToCheck(address);
      checkClaimStatus();
    }
  }, [isConnected, address]);

  const checkClaimStatus = async () => {
    if (!isConnected || !address) return;
    
    try {
      setIsLoading(true);
      // Check if window.ethereum exists
      if (!window.ethereum) {
        toast.error('No Ethereum provider found. Please install MetaMask or use a Web3 browser.');
        setIsLoading(false);
        return;
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const contract = new ethers.Contract(CHKER_CONTRACT_ADDRESS, zoraChkerABI, provider);
      
      // Get all relevant contract information
      const [claimOpen, claimed, claimStartTime, totalAlloc, tokenAddress, adminAddress, allocSetterAddress] = await Promise.all([
        contract.claimIsOpen(),
        contract.hasClaimed(address),
        contract.claimStart(),
        contract.totalAllocated(),
        contract.token(),
        contract.admin(),
        contract.allocationSetter()
      ]);
      
      // Get allocation for the connected address
      const accountClaim = await contract.accountClaim(address);
      const allocationAmount = ethers.utils.formatUnits(accountClaim.allocation, 18);
      
      // Set all the retrieved data
      setClaimIsOpen(claimOpen);
      setHasClaimed(claimed);
      setClaimStart(new Date(claimStartTime.toNumber() * 1000).toLocaleString());
      setTotalAllocated(ethers.utils.formatUnits(totalAlloc, 18));
      setContractInfo({
        token: tokenAddress,
        admin: adminAddress,
        allocationSetter: allocSetterAddress
      });
      
      // Set allocation data
      setAllocation({
        address: address,
        amount: allocationAmount,
        claimed: claimed
      });
      
      // Get ZORA token balance if the user has an allocation
      if (parseFloat(allocationAmount) > 0) {
        try {
          const zoraContract = new ethers.Contract(ZORA_CONTRACT_ADDRESS, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
          ], provider);
          
          const [balance, decimals] = await Promise.all([
            zoraContract.balanceOf(address),
            zoraContract.decimals()
          ]);
          
          setZoraBalance(ethers.utils.formatUnits(balance, decimals));
        } catch (tokenError) {
          console.error('Error fetching ZORA token balance:', tokenError);
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking claim status:', error);
      setIsLoading(false);
    }
  };

  const checkAllocation = async () => {
    if (!ethers.utils.isAddress(addressToCheck)) {
      toast.error('Please enter a valid Ethereum address');
      return;
    }

    try {
      setIsChecking(true);
      // Check if window.ethereum exists
      if (!window.ethereum) {
        toast.error('No Ethereum provider found. Please install MetaMask or use a Web3 browser.');
        setIsChecking(false);
        return;
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const contract = new ethers.Contract(CHKER_CONTRACT_ADDRESS, zoraChkerABI, provider);
      
      // Get allocation for the address
      const accountClaim = await contract.accountClaim(addressToCheck);
      const allocationAmount = ethers.utils.formatUnits(accountClaim.allocation, 18);
      
      // Check if the address has already claimed
      const claimed = await contract.hasClaimed(addressToCheck);
      
      setAllocation({
        address: addressToCheck,
        amount: allocationAmount,
        claimed: claimed
      });
      
      setIsChecking(false);
    } catch (error) {
      console.error('Error checking allocation:', error);
      toast.error('Error checking allocation. Please try again.');
      setIsChecking(false);
    }
  };

  const claimAirdrop = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsClaiming(true);
      // Check if window.ethereum exists
      if (!window.ethereum) {
        toast.error('No Ethereum provider found. Please install MetaMask or use a Web3 browser.');
        setIsClaiming(false);
        return;
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CHKER_CONTRACT_ADDRESS, zoraChkerABI, signer);
      
      // Call the claim function (claims to the connected address)
      const tx = await contract.claim(address);
      
      // Wait for the transaction to be mined
      toast.loading('Claiming your ZORA tokens...');
      await tx.wait();
      
      toast.dismiss();
      toast.success('Successfully claimed your ZORA tokens!');
      
      // Update claim status
      setHasClaimed(true);
      setIsClaiming(false);
    } catch (error: any) {
      console.error('Error claiming airdrop:', error);
      toast.dismiss();
      
      // Handle specific errors
      if (error.message.includes('AlreadyClaimed')) {
        toast.error('You have already claimed your ZORA tokens');
      } else if (error.message.includes('ClaimNotOpen')) {
        toast.error('Claiming is not open yet');
      } else if (error.message.includes('NoAllocation')) {
        toast.error('You do not have any ZORA tokens allocated');
      } else {
        toast.error('Error claiming airdrop. Please try again.');
      }
      
      setIsClaiming(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <motion.div 
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 font-heading bg-btb-gradient bg-clip-text text-transparent">Zora Airdrop Checker</h1>
          <Card className="p-6 sm:p-8 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center py-8 sm:py-12">
              <WalletIcon className="h-12 sm:h-16 w-12 sm:w-16 text-btb-primary mb-4" />
              <h2 className="text-xl sm:text-2xl font-semibold mb-2 font-heading">Connect Your Wallet</h2>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Connect your wallet to check your Zora token allocation and claim your airdrop.
              </p>
              <Button size="lg" onClick={connectWallet} className="bg-btb-primary hover:bg-btb-primary-dark w-full sm:w-auto">
                Connect Wallet
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <motion.div 
        className="max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 font-heading">Zora Airdrop Checker</h1>
          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 max-w-3xl mx-auto">
            Check your eligibility for the Zora token airdrop and claim your tokens.
          </p>
        </div>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8">
            <TabsTrigger value="check" className="text-sm sm:text-lg py-2 sm:py-3">Check Eligibility</TabsTrigger>
            <TabsTrigger value="claim" className="text-sm sm:text-lg py-2 sm:py-3">Claim Tokens</TabsTrigger>
          </TabsList>
          
          <TabsContent value="check">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">Check Your Allocation</CardTitle>
                  <CardDescription>
                    Enter an Ethereum address to check if it's eligible for the Zora airdrop
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="address">Ethereum Address</Label>
                      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <Input
                          id="address"
                          placeholder="0x..."
                          value={addressToCheck}
                          onChange={(e) => setAddressToCheck(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={checkAllocation} 
                          disabled={isChecking}
                          className="bg-btb-primary hover:bg-btb-primary-dark w-full sm:w-auto"
                        >
                          {isChecking ? (
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            'Check'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {allocation && (
                <motion.div
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Card className="border-2 border-btb-primary-light/30 dark:border-btb-primary-dark/50">
                    <CardHeader>
                      <CardTitle className="text-2xl font-heading">Allocation Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium mb-1 sm:mb-0">Address</span>
                          <span className="font-mono text-xs sm:text-sm break-all">{allocation.address}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Allocation</span>
                          <span className="font-mono">
                            {parseFloat(allocation.amount) > 0 
                              ? `${parseFloat(allocation.amount).toLocaleString()} ZORA` 
                              : 'No allocation found'}
                          </span>
                        </div>
                        
                        {parseFloat(zoraBalance) > 0 && (
                          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                            <span className="font-medium">Current ZORA Balance</span>
                            <span className="font-mono">{parseFloat(zoraBalance).toLocaleString()} ZORA</span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Claim Start Date</span>
                          <span className="font-mono text-sm">{claimStart || 'Not set'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <span className="font-medium">Status</span>
                          <div className="flex items-center">
                            {allocation.claimed ? (
                              <>
                                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                                <span className="text-green-500">Claimed</span>
                              </>
                            ) : parseFloat(allocation.amount) > 0 ? (
                              <>
                                <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                                <span className="text-yellow-500">Not Claimed</span>
                              </>
                            ) : (
                              <>
                                <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                                <span className="text-red-500">Not Eligible</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    {parseFloat(allocation.amount) > 0 && !allocation.claimed && (
                      <CardFooter className="flex justify-center sm:justify-end">
                        <Button 
                          onClick={() => setActiveTab('claim')}
                          className="bg-btb-primary hover:bg-btb-primary-dark w-full sm:w-auto"
                        >
                          Go to Claim
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </motion.div>
              )}
            </motion.div>
          </TabsContent>
          
          <TabsContent value="claim">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">Claim Your Zora Tokens</CardTitle>
                  <CardDescription>
                    {claimIsOpen 
                      ? 'Claim your Zora tokens if you are eligible for the airdrop'
                      : 'Claiming is not open yet. Please check back later.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium mb-1 sm:mb-0">Connected Address</span>
                        <span className="font-mono text-xs sm:text-sm break-all">{address}</span>
                      </div>

                      {allocation && (
                        <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Your Allocation</span>
                          <span className="font-mono">
                            {parseFloat(allocation.amount) > 0 
                              ? `${parseFloat(allocation.amount).toLocaleString()} ZORA` 
                              : 'No allocation found'}
                          </span>
                        </div>
                      )}
                      
                      {parseFloat(zoraBalance) > 0 && (
                        <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="font-medium">Current ZORA Balance</span>
                          <span className="font-mono">{parseFloat(zoraBalance).toLocaleString()} ZORA</span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium">Claim Status</span>
                        <div className="flex items-center">
                          {hasClaimed ? (
                            <>
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-green-500">Already Claimed</span>
                            </>
                          ) : (
                            <>
                              <ExclamationCircleIcon className="h-5 w-5 text-yellow-500 mr-2" />
                              <span className="text-yellow-500">Not Claimed</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium">Claiming Status</span>
                        <div className="flex items-center">
                          {claimIsOpen ? (
                            <>
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                              <span className="text-green-500">Open</span>
                            </>
                          ) : (
                            <>
                              <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                              <span className="text-red-500">Not Open Yet</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-2">
                        <span className="font-medium">Claim Start Date</span>
                        <span className="font-mono text-sm">{claimStart || 'Not set'}</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <Button 
                        onClick={claimAirdrop} 
                        disabled={isClaiming || hasClaimed || !claimIsOpen}
                        className="bg-btb-primary hover:bg-btb-primary-dark w-full py-4 sm:py-6 text-base sm:text-lg"
                      >
                        {isClaiming ? (
                          <>
                            <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                            <span>Processing...</span>
                          </>
                        ) : hasClaimed ? (
                          'Already Claimed'
                        ) : !claimIsOpen ? (
                          'Claiming Not Open Yet'
                        ) : (
                          'Claim Zora Tokens'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">Contract Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium mb-1 sm:mb-0">CHKER Contract</span>
                        <span className="font-mono text-xs break-all">{CHKER_CONTRACT_ADDRESS}</span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium mb-1 sm:mb-0">ZORA Token</span>
                        <span className="font-mono text-xs break-all">{contractInfo.token || ZORA_CONTRACT_ADDRESS}</span>
                      </div>
                      
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium">Total Allocated</span>
                        <span className="font-mono">{parseFloat(totalAllocated).toLocaleString()} ZORA</span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="font-medium mb-1 sm:mb-0">Admin</span>
                        <span className="font-mono text-xs break-all">{contractInfo.admin}</span>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2">
                        <span className="font-medium mb-1 sm:mb-0">Allocation Setter</span>
                        <span className="font-mono text-xs break-all">{contractInfo.allocationSetter}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-heading">About Zora Airdrop</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p>
                      Zora is a permissionless protocol for creators to mint, share, and sell NFTs. 
                      The Zora token airdrop rewards early users and contributors to the Zora ecosystem.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <h3 className="font-semibold mb-2">Eligibility Criteria</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Early Zora NFT creators</li>
                          <li>Active marketplace participants</li>
                          <li>Protocol contributors</li>
                          <li>Community members</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                        <h3 className="font-semibold mb-2">Token Utility</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Governance voting</li>
                          <li>Fee discounts</li>
                          <li>Creator incentives</li>
                          <li>Protocol development</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
