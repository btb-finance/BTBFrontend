'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { SheepEcosystemService } from '@/app/services/sheepEcosystemService';
import { 
  ArrowPathIcon, 
  ShieldCheckIcon, 
  ExclamationCircleIcon,
  ClockIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { ethers } from 'ethers';

interface SleepStatusType {
  isSleeping: boolean;
  canClaimTime: Date | null;
}

export default function SheepDogInteract() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [sheepBalance, setSheepBalance] = useState('0');
  const [sheepDogShares, setSheepDogShares] = useState('0');
  const [protectionStatus, setProtectionStatus] = useState(0);
  const [protectAmount, setProtectAmount] = useState('');
  const [sleepStatus, setSleepStatus] = useState<SleepStatusType>({ isSleeping: false, canClaimTime: null });
  const [currentRent, setCurrentRent] = useState('0');
  const [error, setError] = useState('');
  const [transactionPending, setTransactionPending] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState('');
  
  const sheepService = new SheepEcosystemService();
  
  const loadData = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await sheepService.connect();
      setIsConnected(true);
      
      // Get data in parallel
      const [
        sheepBal,
        dogShares,
        protection,
        sleepStat,
        rent
      ] = await Promise.all([
        sheepService.getFormattedSheepBalance(),
        sheepService.getFormattedSheepDogShares(),
        sheepService.getProtectionStatus(),
        sheepService.getSleepStatus(),
        sheepService.getCurrentRentRewards()
      ]);
      
      setSheepBalance(sheepBal);
      setSheepDogShares(dogShares);
      setProtectionStatus(protection);
      setSleepStatus(sleepStat);
      setCurrentRent(rent);
      
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please check your wallet connection.');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  // Handle protecting sheep
  const handleProtect = async () => {
    if (!protectAmount || parseFloat(protectAmount) <= 0) {
      setError('Please enter a valid amount to protect');
      return;
    }
    
    setTransactionPending(true);
    setError('');
    setTransactionSuccess(false);
    setTransactionMessage('');
    
    try {
      // First approve SHEEP tokens
      const approveTx = await sheepService.approveSheep(
        ethers.utils.parseEther(protectAmount).toString(),
        sheepService.SHEEPDOG_CONTRACT_ADDRESS
      );
      await approveTx.wait();
      
      // Then protect SHEEP
      const protectTx = await sheepService.activateProtection(protectAmount);
      await protectTx.wait();
      
      setTransactionSuccess(true);
      setTransactionMessage(`Successfully protected ${protectAmount} SHEEP`);
      setProtectAmount('');
      
      // Refresh data
      loadData();
    } catch (err: any) {
      console.error('Error protecting SHEEP:', err);
      setError('Failed to protect SHEEP. ' + (err.reason || err.message || String(err)));
    } finally {
      setTransactionPending(false);
    }
  };
  
  // Handle putting dog to sleep
  const handleDogSleep = async () => {
    setTransactionPending(true);
    setError('');
    setTransactionSuccess(false);
    setTransactionMessage('');
    
    try {
      const tx = await sheepService.removeProtection();
      await tx.wait();
      
      setTransactionSuccess(true);
      setTransactionMessage('SheepDog is now sleeping. You can claim your SHEEP in 48 hours.');
      
      // Refresh data
      loadData();
    } catch (err: any) {
      console.error('Error putting SheepDog to sleep:', err);
      setError('Failed to put SheepDog to sleep. ' + (err.reason || err.message || String(err)));
    } finally {
      setTransactionPending(false);
    }
  };
  
  // Handle getting sheep back
  const handleGetSheep = async () => {
    setTransactionPending(true);
    setError('');
    setTransactionSuccess(false);
    setTransactionMessage('');
    
    try {
      // First approve wGasToken for rent
      const approveTx = await sheepService.approveSheep(
        ethers.utils.parseEther(currentRent).toString(),
        sheepService.SHEEPDOG_CONTRACT_ADDRESS
      );
      await approveTx.wait();
      
      // Then get sheep back
      const tx = await sheepService.claimRewards();
      await tx.wait();
      
      setTransactionSuccess(true);
      setTransactionMessage('Successfully claimed your SHEEP!');
      
      // Refresh data
      loadData();
    } catch (err: any) {
      console.error('Error getting SHEEP back:', err);
      setError('Failed to get SHEEP back. ' + (err.reason || err.message || String(err)));
    } finally {
      setTransactionPending(false);
    }
  };
  
  // Helper to format time remaining until can claim
  const formatTimeRemaining = (canClaimTime: Date | null) => {
    if (!canClaimTime) return 'Unknown';
    
    const now = new Date();
    const diff = canClaimTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };
  
  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">SheepDog Protection</h3>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center"
          onClick={loadData}
          disabled={isLoading}
        >
          <ArrowPathIcon className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md flex items-start">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {transactionSuccess && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
          <p className="text-sm text-green-700 dark:text-green-300">{transactionMessage}</p>
        </div>
      )}
      
      {!isConnected && !isLoading && !error && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Connect your wallet to interact with SheepDog.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* SHEEP balance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg p-4"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your SHEEP</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ) : (
              parseFloat(sheepBalance).toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            )}
          </div>
        </motion.div>
        
        {/* SHEEPDOG shares */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 rounded-lg p-4"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your SheepDog Shares</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ) : (
              parseFloat(sheepDogShares).toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            )}
          </div>
        </motion.div>
        
        {/* Protection status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-lg p-4"
        >
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Protection Status</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {isLoading ? (
              <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ) : (
              <div className={`${protectionStatus >= 100 
                ? 'text-green-500' 
                : protectionStatus >= 50 
                  ? 'text-amber-500' 
                  : 'text-red-500'}`}
              >
                {`${Math.round(protectionStatus)}% Protected`}
              </div>
            )}
          </div>
        </motion.div>
      </div>
      
      <Tabs defaultValue="protect" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="protect">Protect SHEEP</TabsTrigger>
          <TabsTrigger value="sleep">Put Dog to Sleep</TabsTrigger>
          <TabsTrigger value="claim">Claim SHEEP</TabsTrigger>
        </TabsList>
        
        <TabsContent value="protect" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldCheckIcon className="h-5 w-5 text-amber-500" />
              <h4 className="font-medium">Protect your SHEEP from wolves</h4>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Protect your SHEEP tokens by staking them with the SheepDog. Protection requires a small rent in gas token. 
              The more SHEEP you protect, the safer you are from wolf attacks.
            </p>
            
            <div className="flex space-x-2 items-center">
              <Input
                type="number"
                placeholder="Amount of SHEEP to protect"
                value={protectAmount}
                onChange={(e) => setProtectAmount(e.target.value)}
                disabled={transactionPending || !isConnected}
                step="0.01"
                min="0"
              />
              
              <Button 
                variant="default" 
                onClick={handleProtect}
                disabled={transactionPending || !isConnected || parseFloat(protectAmount || '0') <= 0}
                className={`${transactionPending ? 'opacity-70' : ''}`}
              >
                {transactionPending ? (
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="w-4 h-4 mr-2" />
                )}
                Protect
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="sleep" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ClockIcon className="h-5 w-5 text-amber-500" />
              <h4 className="font-medium">Prepare to Retrieve your SHEEP</h4>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Putting your SheepDog to sleep begins the 48-hour waiting period before you can retrieve 
              your protected SHEEP. During this time, you'll lose protection from wolf attacks.
            </p>
            
            {sleepStatus.isSleeping ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Your SheepDog is already sleeping. You can claim your SHEEP in {formatTimeRemaining(sleepStatus.canClaimTime)}.
                </p>
              </div>
            ) : (
              <Button 
                variant="destructive" 
                onClick={handleDogSleep}
                disabled={transactionPending || !isConnected || parseFloat(sheepDogShares) <= 0}
                className={`${transactionPending ? 'opacity-70' : ''}`}
              >
                {transactionPending ? (
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ClockIcon className="w-4 h-4 mr-2" />
                )}
                Put Dog to Sleep
              </Button>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="claim" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ArrowLeftIcon className="h-5 w-5 text-amber-500" />
              <h4 className="font-medium">Claim your SHEEP Tokens</h4>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300">
              After the 48-hour waiting period, you can claim your protected SHEEP. You'll need to pay rent in gas tokens
              for the period your SHEEP were protected (10 wGasTokens per day).
            </p>
            
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {sleepStatus.isSleeping 
                  ? (sleepStatus.canClaimTime && new Date() >= sleepStatus.canClaimTime) 
                    ? `Current rent to pay: ${parseFloat(currentRent).toFixed(4)} wGasTokens` 
                    : `You need to wait until ${sleepStatus.canClaimTime?.toLocaleString() || 'unknown time'} to claim` 
                  : 'Your SheepDog is not sleeping. Put it to sleep first to begin the claiming process.'}
              </p>
            </div>
            
            <Button 
              variant="default" 
              onClick={handleGetSheep}
              disabled={
                transactionPending || 
                !isConnected || 
                !sleepStatus.isSleeping || 
                Boolean(sleepStatus.canClaimTime && new Date() < sleepStatus.canClaimTime)
              }
              className={`${transactionPending ? 'opacity-70' : ''}`}
            >
              {transactionPending ? (
                <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
              )}
              Claim SHEEP
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
} 