'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  CurrencyDollarIcon,
  TrophyIcon,
  BanknotesIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import gameService from '../services/gameService';

interface StakingPanelProps {
  onSuccess?: () => void;
}

export default function StakingPanel({ onSuccess }: StakingPanelProps) {
  
  const [stakingInfo, setStakingInfo] = useState({
    totalStaked: '0',
    apr: '0',
    rewardRate: '0',
    periodFinish: '0'
  });
  
  const [userInfo, setUserInfo] = useState({
    lpBalance: '0',
    stakedAmount: '0',
    earnedRewards: '0',
    pendingRewards: '0'
  });
  
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    fetchStakingData();
  }, []);

  const fetchStakingData = async () => {
    try {
      const [stakingData, userData, lpBalance] = await Promise.all([
        gameService.getStakingInfo(),
        gameService.getUserStakingInfo(),
        gameService.getLPTokenBalance()
      ]);
      
      setStakingInfo(stakingData);
      setUserInfo({
        ...userData,
        lpBalance
      });
    } catch (error) {
      console.error('Error fetching staking data:', error);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;
    
    try {
      setIsLoading(true);
      setLoadingAction('staking');
      
      const tx = await gameService.stake(stakeAmount);
      await tx.wait();
      
      setStakeAmount('');
      await fetchStakingData();
      onSuccess?.();
    } catch (error) {
      console.error('Error staking:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) return;
    
    try {
      setIsLoading(true);
      setLoadingAction('unstaking');
      
      const tx = await gameService.unstake(unstakeAmount);
      await tx.wait();
      
      setUnstakeAmount('');
      await fetchStakingData();
      onSuccess?.();
    } catch (error) {
      console.error('Error unstaking:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleClaimRewards = async () => {
    try {
      setIsLoading(true);
      setLoadingAction('claiming');
      
      const tx = await gameService.claimRewards();
      await tx.wait();
      
      await fetchStakingData();
      onSuccess?.();
    } catch (error) {
      console.error('Error claiming rewards:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleEmergencyUnstake = async () => {
    if (!confirm('Emergency unstake will forfeit all pending rewards. Continue?')) return;
    
    try {
      setIsLoading(true);
      setLoadingAction('emergency');
      
      const tx = await gameService.emergencyUnstake();
      await tx.wait();
      
      await fetchStakingData();
      onSuccess?.();
    } catch (error) {
      console.error('Error emergency unstaking:', error);
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleMaxStake = () => {
    setStakeAmount(userInfo.lpBalance);
  };

  const handleMaxUnstake = () => {
    setUnstakeAmount(userInfo.stakedAmount);
  };

  const formatNumber = (value: string, decimals: number = 2) => {
    return parseFloat(value).toFixed(decimals);
  };

  const formatAPR = (apr: string) => {
    return (parseFloat(apr) * 100).toFixed(2);
  };


  return (
    <div className="space-y-6">
      {/* Staking Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BanknotesIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Staked</p>
                <p className="font-bold text-sm">{formatNumber(stakingInfo.totalStaked)} LP</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <ChartBarIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">APR</p>
                <p className="font-bold text-sm">{formatAPR(stakingInfo.apr)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <CurrencyDollarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Your Staked</p>
                <p className="font-bold text-sm">{formatNumber(userInfo.stakedAmount)} LP</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <TrophyIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Earned Rewards</p>
                <p className="font-bold text-sm">{formatNumber(userInfo.earnedRewards)} MiMo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stake Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5" />
              Stake LP Tokens
            </CardTitle>
            <CardDescription>
              First provide liquidity at <a href="https://app.uniswap.org/explore/pools/base/0xA93b1f2A2D66FA476ca84Ead39A6fCD72bA957EC" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Uniswap</a>, then stake your LP tokens here to earn MiMo rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stakeAmount">Amount to Stake</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="stakeAmount"
                  type="number"
                  placeholder="0.0"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  variant="outline"
                  onClick={handleMaxStake}
                  disabled={isLoading}
                  className="flex-shrink-0"
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Available: {formatNumber(userInfo.lpBalance)} LP
              </p>
            </div>

            <Button
              onClick={handleStake}
              disabled={isLoading || !stakeAmount || parseFloat(stakeAmount) <= 0 || parseFloat(stakeAmount) > parseFloat(userInfo.lpBalance)}
              className="w-full"
            >
              {isLoading && loadingAction === 'staking' ? 'Staking...' : 'Stake LP Tokens'}
            </Button>
          </CardContent>
        </Card>

        {/* Unstake Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CurrencyDollarIcon className="h-5 w-5" />
              Unstake & Rewards
            </CardTitle>
            <CardDescription>
              Unstake your LP tokens and claim rewards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="unstakeAmount">Amount to Unstake</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="unstakeAmount"
                  type="number"
                  placeholder="0.0"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  variant="outline"
                  onClick={handleMaxUnstake}
                  disabled={isLoading}
                  className="flex-shrink-0"
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Staked: {formatNumber(userInfo.stakedAmount)} LP
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleUnstake}
                disabled={isLoading || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > parseFloat(userInfo.stakedAmount)}
                variant="outline"
              >
                {isLoading && loadingAction === 'unstaking' ? 'Unstaking...' : 'Unstake'}
              </Button>
              
              <Button
                onClick={handleClaimRewards}
                disabled={isLoading || parseFloat(userInfo.earnedRewards) <= 0}
              >
                {isLoading && loadingAction === 'claiming' ? 'Claiming...' : 'Claim Rewards'}
              </Button>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Pending Rewards:</p>
              <p className="font-bold text-green-600 dark:text-green-400">
                {formatNumber(userInfo.earnedRewards)} MiMo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Unstake */}
      {parseFloat(userInfo.stakedAmount) > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 dark:text-orange-100 mb-1">
                  Emergency Unstake
                </h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                  Emergency unstake will immediately withdraw all your staked tokens but you will forfeit all pending rewards.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEmergencyUnstake}
                  disabled={isLoading}
                >
                  {isLoading && loadingAction === 'emergency' ? 'Processing...' : 'Emergency Unstake'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}