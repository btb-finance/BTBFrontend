'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@/hooks/useWeb3';
import { Button } from '@/components/ui/Button';
import { AnimatedScale } from '@/components/ui/AnimatedSection';
import { useEffect, useState } from 'react';

interface UserStatsProps {
  onStakeClick: () => void;
}

export function UserStats({ onStakeClick }: UserStatsProps) {
  const { isConnected, connect, btbBalance, votingPower } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="gradient-border p-6 bg-[var(--background-dark)]">
        <div className="h-[300px] animate-pulse bg-[var(--background-light)] rounded-lg" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="gradient-border p-6 bg-[var(--background-dark)]">
        <h3 className="text-xl font-semibold mb-6">Connect Wallet</h3>
        <p className="text-[var(--text-secondary)] mb-6">
          Connect your wallet to view your governance stats and participate in voting
        </p>
        <Button onClick={connect}>Connect Wallet</Button>
      </div>
    );
  }

  return (
    <div className="gradient-border p-6 bg-[var(--background-dark)]">
      <h3 className="text-xl font-semibold mb-6">Your Governance Stats</h3>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-secondary)]">BTB Balance</span>
          <motion.span
            key={btbBalance}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-medium"
          >
            {btbBalance || '0'} BTB
          </motion.span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-secondary)]">Voting Power</span>
          <motion.span
            key={votingPower}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-medium"
          >
            {votingPower} stBTB
          </motion.span>
        </div>
        <div className="pt-4">
          <Button onClick={onStakeClick} className="w-full">
            Stake More BTB
          </Button>
        </div>
      </div>

      {/* Rewards Preview */}
      <div className="mt-8 p-4 bg-[var(--background-light)] rounded-lg">
        <h4 className="text-sm font-medium mb-3">Estimated Rewards</h4>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[var(--text-secondary)]">Next Distribution</span>
          <AnimatedScale>
            <span className="px-2 py-1 bg-[var(--primary)] bg-opacity-20 text-[var(--primary)] rounded">
              +0.5 BTB
            </span>
          </AnimatedScale>
        </div>
      </div>
    </div>
  );
}
