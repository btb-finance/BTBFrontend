'use client';

import { Dialog } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { useStaking } from '@/hooks/useWeb3';
import { useAccessibleDialog } from '@/hooks/useKeyboardNavigation';
import { useEffect, useState } from 'react';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StakeModal({ isOpen, onClose }: StakeModalProps) {
  const { amount, setAmount, handleStake, isLoading } = useStaking();
  const [mounted, setMounted] = useState(false);
  useAccessibleDialog(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog.Root
          as={motion.div}
          static
          open={isOpen}
          onClose={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <Dialog.Overlay
            as={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black"
            aria-hidden="true"
          />

          {/* Modal */}
          <Dialog.Portal>
            <Dialog.Content
              as={motion.div}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md"
            >
              <div className="gradient-border p-6 bg-[var(--background-light)]">
                <Dialog.Title className="text-2xl font-bold mb-6">
                  Stake BTB Tokens
                </Dialog.Title>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="amount"
                      className="block text-sm font-medium mb-2"
                    >
                      Amount to Stake
                    </label>
                    <div className="relative">
                      <input
                        id="amount"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--background-dark)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-white"
                        placeholder="0.0"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() => setAmount('0')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)] hover:text-white"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-[var(--text-secondary)]">
                    <p>• Tokens will be locked for 30 days</p>
                    <p>You&apos;ll receive stBTB tokens that represent your stake.</p>
                    <p>• Earn rewards from protocol fees</p>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <Button
                      onClick={handleStake}
                      disabled={!amount || isLoading}
                      loading={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? 'Staking...' : 'Stake BTB'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={onClose}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
