'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { motion } from 'framer-motion';
import { SheepEcosystemService } from '@/app/services/sheepEcosystemService';
import { 
  ArrowPathIcon,
  BoltIcon,
  ClockIcon,
  ExclamationCircleIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';
import { ethers } from 'ethers';

interface WolfAttribute {
  trait_type: string;
  value: string | number;
}

interface WolfMetadata {
  image: string;
  attributes: WolfAttribute[];
}

interface Wolf {
  id: number;
  hunger: number;
  hungerRaw: string;
  nextHunger: string;
  lastFeeding: number;
  starved: boolean;
  canEat: boolean;
  level: number;
  eatAmount: string;
  metadata: WolfMetadata;
}

interface Target {
  address: string;
  name: string;
  sheepBalance: string;
  canBeEaten: boolean;
}

export default function WolfDetails() {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [wolves, setWolves] = useState<Wolf[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedWolf, setSelectedWolf] = useState<Wolf | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [feedingCost, setFeedingCost] = useState<string>('0');
  const [error, setError] = useState('');
  const [isFeedingWolf, setIsFeedingWolf] = useState(false);
  const [feedingAmount, setFeedingAmount] = useState<string>('0');
  const [isEatingTarget, setIsEatingTarget] = useState(false);
  const [isAutoHunting, setIsAutoHunting] = useState(false);
  const [autoHuntProgress, setAutoHuntProgress] = useState(0);
  const [autoHuntTargets, setAutoHuntTargets] = useState<Target[]>([]);
  const [loadingStates, setLoadingStates] = useState({
    wolves: true,
    targets: false,
    metadata: true
  });
  const [targetsLoaded, setTargetsLoaded] = useState(false);
  
  const sheepService = new SheepEcosystemService();
  
  const loadWolves = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await sheepService.connect();
      setIsConnected(true);
      
      // Get wolf count first
      const wolfCount = await sheepService.getWolfCount();
      
      // Initialize empty array for wolves
      const wolfDetails: Wolf[] = [];
      setWolves(wolfDetails); // Show empty array immediately
      
      // Load wolves progressively
      for (let i = 0; i < wolfCount; i++) {
        try {
          const address = await sheepService.signer?.getAddress();
          if (!address) throw new Error('Wallet not connected');
          
          const wolfId = await sheepService.wolfContract!.tokenOfOwnerByIndex(address, i);
          
          // Get basic wolf data in parallel
          const [hungerBN, starvedTimestamp, lastFeeding] = await Promise.all([
            sheepService.wolfContract!.hunger(wolfId),
            sheepService.wolfContract!.starved(wolfId),
            sheepService.wolfContract!.hungry(wolfId)
          ]);
          
          const formattedHunger = ethers.utils.formatEther(hungerBN);
          const hungerAsPercentage = Math.min(100, (parseFloat(formattedHunger) / 10.0) * 100);
          const isStarved = !starvedTimestamp.isZero() && starvedTimestamp.toNumber() < Date.now() / 1000;
          const lastFeedingTime = lastFeeding.toNumber();
          const canEat = !isStarved && Date.now() / 1000 > lastFeedingTime;
          
          // Create basic wolf object
          const wolf: Wolf = {
            id: wolfId.toNumber(),
            hunger: Math.round(hungerAsPercentage),
            hungerRaw: formattedHunger,
            nextHunger: ethers.utils.formatEther(hungerBN.add(await sheepService.wolfContract!.ONE())),
            lastFeeding: lastFeedingTime,
            starved: isStarved,
            canEat,
            level: 1,
            eatAmount: formattedHunger,
            metadata: {
              image: `https://api.dicebear.com/6.x/identicon/svg?seed=${wolfId}`,
              attributes: [
                { trait_type: "Wolf ID", value: wolfId.toString() },
                { trait_type: "Hunger", value: `${Math.round(hungerAsPercentage)}%` }
              ]
            }
          };
          
          // Add wolf to array and update state
          wolfDetails.push(wolf);
          setWolves([...wolfDetails]);
          
          // Load metadata in background
          loadWolfMetadata(wolfId, wolfDetails.length - 1);
          
        } catch (err) {
          console.error(`Error loading wolf ${i}:`, err);
          // Continue with next wolf even if one fails
        }
      }
      
      // Set selected wolf to first wolf if available
      if (wolfDetails.length > 0) {
        setSelectedWolf(wolfDetails[0]);
        setFeedingCost(wolfDetails[0].eatAmount);
      }
      
      // Don't load targets in parallel anymore
      // loadTargets();
      
    } catch (err) {
      console.error('Error loading wolves:', err);
      setError('Failed to load Wolf NFTs. Please check your wallet connection.');
      setIsConnected(false);
    } finally {
      setLoadingStates(prev => ({ ...prev, wolves: false }));
      setIsLoading(false);
    }
  };
  
  const loadWolfMetadata = async (wolfId: number, index: number) => {
    try {
      const tokenURI = await sheepService.wolfContract!.tokenURI(wolfId);
      let metadata = { image: "", attributes: [] };
      
      if (tokenURI.startsWith('http')) {
        const response = await fetch(tokenURI);
        metadata = await response.json();
      } else if (tokenURI.startsWith('data:application/json;base64,')) {
        const base64Data = tokenURI.replace('data:application/json;base64,', '');
        const jsonString = atob(base64Data);
        metadata = JSON.parse(jsonString);
      }
      
      // Update wolf metadata in state
      setWolves(prev => {
        const newWolves = [...prev];
        if (newWolves[index]) {
          newWolves[index] = {
            ...newWolves[index],
            metadata
          };
        }
        return newWolves;
      });
    } catch (err) {
      console.error(`Error loading metadata for wolf ${wolfId}:`, err);
    } finally {
      if (index === wolves.length - 1) {
        setLoadingStates(prev => ({ ...prev, metadata: false }));
      }
    }
  };
  
  const loadTargets = async () => {
    if (targetsLoaded) return targets; // Return cached targets if already loaded
    
    setLoadingStates(prev => ({ ...prev, targets: true }));
    
    try {
      const targetsList = await sheepService.getPotentialTargets();
      setTargets(targetsList); // Show targets immediately
      
      // Check if targets can be eaten in parallel
      const updatedTargets = await Promise.all(
        targetsList.map(async (target) => {
          try {
            const cannotBeEaten = await sheepService.wolfContract!.canNotBeEaten(target.address);
            return {
              ...target,
              canBeEaten: !cannotBeEaten
            };
          } catch (err) {
            console.error(`Error checking target ${target.address}:`, err);
            return target;
          }
        })
      );
      
      setTargets(updatedTargets);
      setTargetsLoaded(true);
      return updatedTargets;
    } catch (err) {
      console.error('Error loading targets:', err);
      return [];
    } finally {
      setLoadingStates(prev => ({ ...prev, targets: false }));
    }
  };
  
  useEffect(() => {
    loadWolves();
  }, []);
  
  // Update the feeding cost when a different wolf is selected
  useEffect(() => {
    if (selectedWolf !== null && wolves.length > 0) {
      const selectedWolfData = wolves.find(w => w.id === selectedWolf.id);
      if (selectedWolfData && selectedWolfData.eatAmount) {
        setFeedingCost(selectedWolfData.eatAmount);
      }
    }
  }, [selectedWolf, wolves]);
  
  const handleFeedWolf = async (wolfId: number) => {
    setIsFeedingWolf(true);
    try {
      // Ensure wolf contract is available
      if (!sheepService.wolfContract) {
        throw new Error('Wolf contract not initialized');
      }
      
      // Get the wolf's current hunger level (amount of SHEEP it will eat)
      const wolfHungerBN = await sheepService.wolfContract.hunger(wolfId);
      const formattedHunger = ethers.utils.formatEther(wolfHungerBN);
      
      // Clean the formatted hunger value to avoid issues with trailing zeros
      const cleanHunger = formattedHunger.includes('.')
        ? formattedHunger.replace(/0+$/, '').replace(/\.$/, '')
        : formattedHunger;
      
      // First approve SHEEP tokens to be used by the Wolf contract
      const approveTx = await sheepService.approveSheep(cleanHunger, sheepService.WOLF_CONTRACT_ADDRESS);
      await approveTx.wait();
      
      // Call eatSheep with a dummy target address (to feed wolf)
      const feedTx = await sheepService.wolfContract.eatSheep(
        "0x000000000000000000000000000000000000dEaD", // Burn address as dummy target
        wolfId
      );
      await feedTx.wait();
      
      // Reload wolf data
      await loadWolves();
    } catch (err) {
      console.error('Error feeding wolf:', err);
      setError(`Failed to feed Wolf #${wolfId}. Please check your SHEEP balance and try again.`);
    } finally {
      setIsFeedingWolf(false);
    }
  };
  
  const handleEatTarget = async (wolfId: number, targetAddress: string) => {
    if (!targetAddress) {
      setError('Please select a target first');
      return;
    }
    
    setIsEatingTarget(true);
    setError('');
    
    try {
      // If targets not loaded, load them now
      if (!targetsLoaded) {
        await loadTargets();
      }
      
      const success = await sheepService.eatTarget(wolfId, targetAddress);
      
      if (success) {
        // Refresh wolves
        await loadWolves();
        
        // Clear selected target
        setSelectedTarget(null);
        
        // Show success message
        console.log(`Wolf #${wolfId} successfully ate target ${targetAddress}`);
      } else {
        setError('Failed to eat the target.');
      }
    } catch (err: any) {
      console.error('Error eating target:', err);
      setError(err.reason || err.message || String(err));
    } finally {
      setIsEatingTarget(false);
    }
  };
  
  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 0) {
      // If the timestamp is in the future, show when it will be ready
      const futureTime = Math.abs(diff);
      if (futureTime < 60) return `Ready in ${futureTime} seconds`;
      if (futureTime < 3600) return `Ready in ${Math.floor(futureTime / 60)} minutes`;
      if (futureTime < 86400) return `Ready in ${Math.floor(futureTime / 3600)} hours`;
      return `Ready in ${Math.floor(futureTime / 86400)} days`;
    }
    
    if (diff < 60) return `${diff} seconds ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };
  
  const calculateHealth = (lastFeeding: number, starvedTimestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilStarve = starvedTimestamp - now;
    
    // If wolf is starved, health is 0
    if (timeUntilStarve <= 0) return 0;
    
    // Calculate health percentage based on time until starve
    // Wolf has 1 week (604800 seconds) before starving
    const health = Math.max(0, Math.min(100, (timeUntilStarve / 604800) * 100));
    return Math.round(health);
  };

  const formatTimeRemaining = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = timestamp - now;
    
    if (timeRemaining <= 0) return 'Starved';
    
    const days = Math.floor(timeRemaining / 86400);
    const hours = Math.floor((timeRemaining % 86400) / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getHealthStatus = (health: number) => {
    if (health === 0) return 'Starved';
    if (health > 75) return 'Healthy';
    if (health > 50) return 'Warning';
    if (health > 25) return 'Danger';
    return 'Critical';
  };
  
  const getHealthColor = (health: number) => {
    if (health > 75) return 'text-green-500';
    if (health > 50) return 'text-yellow-500';
    if (health > 25) return 'text-amber-500';
    return 'text-red-500';
  };
  
  const getHealthBackground = (health: number) => {
    if (health > 75) return 'bg-green-100 dark:bg-green-900/20';
    if (health > 50) return 'bg-yellow-100 dark:bg-yellow-900/20';
    if (health > 25) return 'bg-amber-100 dark:bg-amber-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };
  
  const getHungerColor = (hunger: number) => {
    if (hunger > 75) return 'text-red-500';
    if (hunger > 50) return 'text-amber-500';
    if (hunger > 25) return 'text-yellow-500';
    return 'text-green-500';
  };
  
  const getHungerBackground = (hunger: number) => {
    if (hunger > 75) return 'bg-red-100 dark:bg-red-900/20';
    if (hunger > 50) return 'bg-amber-100 dark:bg-amber-900/20';
    if (hunger > 25) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-green-100 dark:bg-green-900/20';
  };
  
  const startAutoHunt = async () => {
    if (!selectedWolf || !sheepService.wolfContract) return;
    
    setIsAutoHunting(true);
    setError('');
    
    try {
      // Get all potential targets - reuse already loaded targets if available
      const allTargets = targetsLoaded ? targets : await loadTargets();
      
      // Get all wolves that can eat
      const hungryWolves = wolves.filter(wolf => wolf.canEat && !wolf.starved);
      
      if (hungryWolves.length === 0) {
        throw new Error('No hungry wolves available to hunt');
      }
      
      // Filter targets that can be eaten and have enough SHEEP
      const eatableTargets = allTargets.filter(target => {
        if (!target.canBeEaten) return false;
        
        // Check if target has enough SHEEP for any wolf
        const hasEnoughSheep = hungryWolves.some(wolf => 
          parseFloat(target.sheepBalance) >= parseFloat(wolf.hungerRaw)
        );
        
        return hasEnoughSheep;
      });
      
      // Randomly select targets (one for each hungry wolf)
      const selectedTargets = eatableTargets
        .sort(() => Math.random() - 0.5) // Shuffle array
        .slice(0, hungryWolves.length);
      
      if (selectedTargets.length === 0) {
        throw new Error('No suitable targets found with enough SHEEP');
      }
      
      setAutoHuntTargets(selectedTargets);
      setAutoHuntProgress(0);
      
      // Calculate total approval needed for all wolves
      let totalApproval = ethers.BigNumber.from(0);
      for (const wolf of hungryWolves) {
        // Use try-catch to handle any potential errors in parsing
        try {
          // Remove trailing zeros after decimal point to avoid the "2.0" format error
          const hungerValue = wolf.hungerRaw.includes('.') 
            ? wolf.hungerRaw.replace(/0+$/, '').replace(/\.$/, '') 
            : wolf.hungerRaw;
            
          const parsedAmount = ethers.utils.parseEther(hungerValue);
          totalApproval = totalApproval.add(parsedAmount);
        } catch (err) {
          console.error(`Invalid hunger value: ${wolf.hungerRaw}`, err);
          throw new Error(`Invalid hunger format: ${wolf.hungerRaw}. Please refresh and try again.`);
        }
      }
      
      // Format the total approval back to a string for the approval call
      const totalApprovalStr = ethers.utils.formatEther(totalApproval);
      
      // Approve SHEEP tokens for all hunts at once
      const approveTx = await sheepService.approveSheep(totalApprovalStr, sheepService.WOLF_CONTRACT_ADDRESS);
      await approveTx.wait();
      
      // Hunt with each wolf
      for (let i = 0; i < hungryWolves.length; i++) {
        const wolf = hungryWolves[i];
        const target = selectedTargets[i];
        await handleEatTarget(wolf.id, target.address);
        setAutoHuntProgress(i + 1);
      }
      
      setError(`Auto-hunt completed successfully! Hunted with ${hungryWolves.length} wolves.`);
      await loadWolves(); // Reload wolf data
    } catch (err) {
      console.error('Error in auto-hunt:', err);
      setError(`Auto-hunt failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsAutoHunting(false);
      setAutoHuntProgress(0);
    }
  };
  
  return (
    <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Your Wolf NFTs</h3>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center"
          onClick={loadWolves}
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
      
      {!isConnected && !isLoading && !error && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Connect your wallet to view your Wolf NFTs.
          </p>
        </div>
      )}
      
      {isConnected && wolves.length === 0 && !isLoading && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            You don't own any Wolf NFTs yet. Get a Wolf to start hunting!
          </p>
        </div>
      )}
      
      {/* Wolf selection tabs */}
      {wolves.length > 0 && (
        <div className="mb-4">
          <div className="flex overflow-x-auto space-x-2 pb-2">
            {wolves.map((wolf) => (
              <button
                key={wolf.id}
                onClick={() => setSelectedWolf(wolf)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                  selectedWolf?.id === wolf.id
                    ? 'bg-btb-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full mr-2 ${wolf.starved ? 'bg-gray-400' : wolf.canEat ? 'bg-green-500' : 'bg-red-500'}`}></span>
                Wolf #{wolf.id}
                <span className={`ml-2 ${getHungerColor(wolf.hunger)}`}>{wolf.hunger}%</span>
              </button>
            ))}
            {loadingStates.wolves && (
              <div className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-500">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Auto-hunt section */}
      {selectedWolf && (
        <div className="mb-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            <BoltIcon className="w-5 h-5 mr-2 text-purple-500" />
            Auto Hunt
          </h4>
          
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <p>Automatically hunt with all your hungry wolves.</p>
            <p>Each wolf will hunt a different random target.</p>
            <p>You only need to approve one transaction for all hunts.</p>
          </div>
          
          {autoHuntTargets.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-medium mb-2">Selected Targets:</div>
              <div className="space-y-2">
                {autoHuntTargets.map((target, index) => (
                  <div key={target.address} className="flex items-center justify-between bg-white dark:bg-gray-700 rounded-md p-2">
                    <div className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${target.canBeEaten ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <div>
                        <div className="font-medium truncate" style={{ maxWidth: '150px' }}>
                          {target.name || target.address.substring(0, 6) + '...' + target.address.substring(38)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {parseFloat(target.sheepBalance).toLocaleString()} SHEEP
                        </div>
                      </div>
                    </div>
                    {index < autoHuntProgress && (
                      <span className="text-green-500">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Button
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            size="lg"
            onClick={targetsLoaded ? startAutoHunt : loadTargets}
            disabled={isAutoHunting || loadingStates.targets || !wolves.some(w => w.canEat && !w.starved)}
          >
            {isAutoHunting ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                Auto Hunting... ({autoHuntProgress}/{wolves.filter(w => w.canEat && !w.starved).length})
              </>
            ) : loadingStates.targets ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                Loading Targets...
              </>
            ) : !targetsLoaded ? (
              <>
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Load Targets for Auto Hunt
              </>
            ) : !wolves.some(w => w.canEat && !w.starved) ? (
              <>
                <ClockIcon className="w-5 h-5 mr-2" />
                No Hungry Wolves
              </>
            ) : (
              <>
                <BoltIcon className="w-5 h-5 mr-2" />
                Start Auto Hunt
              </>
            )}
          </Button>
          
          {!targetsLoaded && !loadingStates.targets && wolves.some(w => w.canEat && !w.starved) && (
            <p className="text-xs text-center mt-2 text-gray-500">
              Targets must be loaded before auto hunt can begin
            </p>
          )}
        </div>
      )}
      
      {/* Selected wolf details */}
      {selectedWolf && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Wolf image and attributes */}
          <div className="flex flex-col space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 aspect-square">
              {selectedWolf.metadata?.image ? (
                <img 
                  src={selectedWolf.metadata?.image} 
                  alt={`Wolf #${selectedWolf.id}`} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <GlobeAltIcon className="w-16 h-16 text-gray-400" />
                </div>
              )}
              {selectedWolf.starved && (
                <div className="absolute inset-0 bg-gray-800/60 flex items-center justify-center">
                  <div className="bg-red-600 text-white px-4 py-2 rounded-md transform -rotate-12 font-bold text-lg">
                    STARVED
                  </div>
                </div>
              )}
            </div>
            
            {/* Wolf Attributes */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Attributes</h4>
              <div className="grid grid-cols-2 gap-2">
                {selectedWolf.metadata?.attributes?.map((attr, index) => (
                  <div key={index} className="bg-white dark:bg-gray-700 rounded-md p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{attr.trait_type}</div>
                    <div className="font-medium text-gray-900 dark:text-white">{attr.value}</div>
                  </div>
                ))}
                {/* Add level if not in attributes */}
                {!selectedWolf.metadata?.attributes?.some(
                  attr => attr.trait_type.toLowerCase() === 'level' || attr.trait_type.toLowerCase() === 'lvl'
                ) && (
                  <div className="bg-white dark:bg-gray-700 rounded-md p-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Level</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {selectedWolf.level || 1}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Wolf stats and actions */}
          <div className="flex flex-col space-y-4">
            <div className={`rounded-lg p-4 ${getHungerBackground(selectedWolf.hunger)}`}>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Wolf Status</h4>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Health Status</span>
                    <span className={`font-medium ${getHealthColor(calculateHealth(selectedWolf.lastFeeding, selectedWolf.starved ? Date.now() / 1000 : 0))}`}>
                      {getHealthStatus(calculateHealth(selectedWolf.lastFeeding, selectedWolf.starved ? Date.now() / 1000 : 0))}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        (() => {
                          const health = calculateHealth(selectedWolf.lastFeeding, selectedWolf.starved ? Date.now() / 1000 : 0);
                          if (health > 75) return 'bg-green-500';
                          if (health > 50) return 'bg-yellow-500';
                          if (health > 25) return 'bg-amber-500';
                          return 'bg-red-500';
                        })()
                      }`}
                      style={{ width: `${calculateHealth(selectedWolf.lastFeeding, selectedWolf.starved ? Date.now() / 1000 : 0)}%` }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Time until starve: {formatTimeRemaining(selectedWolf.starved ? Date.now() / 1000 : 0)}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Hunger</span>
                    <span className={`font-medium ${getHungerColor(selectedWolf.hunger)}`}>
                      {selectedWolf.hunger}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        (() => {
                          const hunger = selectedWolf.hunger;
                          if (hunger > 75) return 'bg-red-500';
                          if (hunger > 50) return 'bg-amber-500'; 
                          if (hunger > 25) return 'bg-yellow-500';
                          return 'bg-green-500';
                        })()
                      }`}
                      style={{ width: `${selectedWolf.hunger}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last Fed</span>
                  <span className="font-medium text-gray-700 dark:text-gray-200 flex items-center">
                    <ClockIcon className="w-4 h-4 mr-1" />
                    {formatTimeAgo(selectedWolf.lastFeeding)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Can Eat</span>
                  <span className={`font-medium ${selectedWolf.canEat ? 'text-green-500' : 'text-red-500'}`}>
                    {selectedWolf.canEat ? 'Yes' : 'No'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className={`font-medium ${selectedWolf.starved ? 'text-gray-500' : 'text-green-500'}`}>
                    {selectedWolf.starved ? 'Starved' : 'Active'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Wolf feeding section - always visible */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                <BoltIcon className="w-5 h-5 mr-2 text-purple-500" />
                Feed Your Wolf
              </h4>
              
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p>Current hunger: <span className="font-medium text-gray-900 dark:text-white">{selectedWolf.hungerRaw || "0"} SHEEP</span></p>
                <p>Next hunger after feeding: <span className="font-medium text-gray-900 dark:text-white">{selectedWolf.nextHunger || "0"} SHEEP</span></p>
                <p className="mt-1">Each time a wolf eats, its hunger increases by 1 SHEEP. The wolf can eat the amount of SHEEP equal to its current hunger level.</p>
                <p className="mt-1">Wolves must be fed within 1 week or they will starve. After eating, they must wait 1 day before eating again.</p>
              </div>
              
              <div className="space-y-2">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  size="lg"
                  onClick={() => handleFeedWolf(selectedWolf.id)}
                  disabled={isFeedingWolf || !selectedWolf.canEat}
                >
                  {isFeedingWolf ? (
                    <>
                      <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                      Feeding...
                    </>
                  ) : (
                    <>
                      <BoltIcon className="w-5 h-5 mr-2" />
                      Feed Wolf #{selectedWolf.id}
                    </>
                  )}
                </Button>

                {/* Status message */}
                <div className="text-sm text-center">
                  {selectedWolf.starved ? (
                    <span className="text-red-500">This wolf has starved and cannot eat</span>
                  ) : !selectedWolf.canEat ? (
                    <span className="text-amber-500">
                      Can feed again in: {formatTimeAgo(selectedWolf.lastFeeding)}
                    </span>
                  ) : (
                    <span className="text-green-500">Ready to feed!</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Potential targets section - only show for wolves that can eat */}
            {selectedWolf.canEat && !selectedWolf.starved && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Hunt Targets</h4>
                
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <p>Your wolf can hunt and eat SHEEP from other wallets.</p>
                </div>
                
                {loadingStates.targets ? (
                  <div className="flex justify-center items-center p-4">
                    <ArrowPathIcon className="w-5 h-5 text-gray-500 animate-spin mr-2" />
                    <span>Loading potential targets...</span>
                  </div>
                ) : !targetsLoaded ? (
                  <div className="text-center p-4 mb-4 bg-white dark:bg-gray-700 rounded-md">
                    <Button 
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={loadTargets}
                      disabled={loadingStates.targets}
                    >
                      {loadingStates.targets ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>Load Potential Targets</>
                      )}
                    </Button>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Click to find wallets with SHEEP tokens for your wolf to hunt
                    </p>
                  </div>
                ) : targets.length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                    {targets.map((target) => (
                      <button
                        key={target.address}
                        onClick={() => setSelectedTarget(target.address)}
                        className={`flex justify-between items-center w-full px-3 py-2 rounded-md text-sm ${
                          selectedTarget === target.address
                            ? 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-100 dark:hover:bg-red-900/30'
                        } ${!target.canBeEaten ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!target.canBeEaten}
                      >
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${target.canBeEaten ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <div className="text-left">
                            <div className="font-medium truncate" style={{ maxWidth: '150px' }}>{target.name || target.address.substring(0, 6) + '...' + target.address.substring(38)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{parseFloat(target.sheepBalance).toLocaleString()} SHEEP</div>
                          </div>
                        </div>
                        {selectedTarget === target.address && (
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-500"></span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-white dark:bg-gray-700 rounded-md mb-4">
                    <p className="text-gray-500 dark:text-gray-400">No targets available to hunt</p>
                  </div>
                )}
                
                {targetsLoaded && selectedTarget && (
                  <Button
                    className="w-full"
                    variant="destructive"
                    size="lg"
                    disabled={isEatingTarget || !selectedWolf.canEat}
                    onClick={() => handleEatTarget(selectedWolf.id, selectedTarget)}
                  >
                    {isEatingTarget ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                        Hunting...
                      </>
                    ) : (
                      <>
                        <BoltIcon className="w-5 h-5 mr-2" />
                        Hunt with Wolf #{selectedWolf.id}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {isConnected && (
        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </Card>
  );
} 