'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../../context/WalletContext';
import btbFinanceService from '../../services/btbFinanceService';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';

interface LoanManagerProps {
  onSuccess: () => void;
}

export default function LoanManager({ onSuccess }: LoanManagerProps) {
  const { isConnected } = useWallet();
  const [loanInfo, setLoanInfo] = useState<{collateral: string, borrowed: string, expirationDate: number}>({ collateral: '0', borrowed: '0', expirationDate: 0 });
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [extensionDays, setExtensionDays] = useState<string>('30');
  const [expandAmount, setExpandAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Load user's loan info
  useEffect(() => {
    const loadLoanInfo = async () => {
      if (isConnected) {
        try {
          const info = await btbFinanceService.getUserLoan();
          setLoanInfo(info);
        } catch (error) {
          console.error('Error loading loan info:', error);
        }
      }
    };

    loadLoanInfo();
  }, [isConnected]);

  const hasActiveLoan = parseFloat(loanInfo.borrowed) > 0;
  const isExpired = loanInfo.expirationDate > 0 && loanInfo.expirationDate < Date.now() / 1000;
  const daysUntilExpiry = loanInfo.expirationDate > 0 ? Math.max(0, Math.floor((loanInfo.expirationDate - Date.now() / 1000) / 86400)) : 0;

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.makePayment(paymentAmount);
      
      onSuccess();
      setPaymentAmount('');
      alert('Payment made successfully!');
    } catch (error: any) {
      console.error('Error making payment:', error);
      alert(`Error: ${error.message || 'Failed to make payment'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePosition = async () => {
    if (!confirm('Are you sure you want to close your position? You will need to repay the full loan amount.')) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.closePosition(loanInfo.borrowed);
      
      onSuccess();
      alert('Position closed successfully!');
    } catch (error: any) {
      console.error('Error closing position:', error);
      alert(`Error: ${error.message || 'Failed to close position'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantClose = async () => {
    if (!confirm('Are you sure you want to instantly close? Your collateral will be sold at current market price.')) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.instantClosePosition();
      
      onSuccess();
      alert('Position closed instantly!');
    } catch (error: any) {
      console.error('Error instant closing:', error);
      alert(`Error: ${error.message || 'Failed to instant close'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !extensionDays || parseInt(extensionDays) <= 0) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.extendLoanDuration(parseInt(extensionDays));
      
      onSuccess();
      setExtensionDays('30');
      alert('Loan extended successfully!');
    } catch (error: any) {
      console.error('Error extending loan:', error);
      alert(`Error: ${error.message || 'Failed to extend loan'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpandLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !expandAmount || parseFloat(expandAmount) <= 0) return;

    try {
      setIsLoading(true);
      await btbFinanceService.connect();
      
      const tx = await btbFinanceService.expandLoan(expandAmount);
      
      onSuccess();
      setExpandAmount('');
      alert('Loan expanded successfully!');
    } catch (error: any) {
      console.error('Error expanding loan:', error);
      alert(`Error: ${error.message || 'Failed to expand loan'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Connect your wallet to manage your loans</p>
      </div>
    );
  }

  if (!hasActiveLoan) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">You don't have any active loans</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your Loan Status</span>
            {isExpired && <span className="text-sm text-red-500 font-normal">EXPIRED</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Collateral:</span>
              <p className="font-medium">{parseFloat(loanInfo.collateral).toFixed(4)} BTB</p>
            </div>
            <div>
              <span className="text-gray-500">Borrowed:</span>
              <p className="font-medium">{parseFloat(loanInfo.borrowed).toFixed(6)} ETH</p>
            </div>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">Days until expiry:</span>
            <p className={`font-medium ${daysUntilExpiry < 7 ? 'text-red-500' : daysUntilExpiry < 30 ? 'text-yellow-500' : 'text-green-500'}`}>
              {daysUntilExpiry} days
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Loan Management Actions */}
      <Tabs defaultValue="payment" className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="extend">Extend</TabsTrigger>
          <TabsTrigger value="expand">Expand</TabsTrigger>
          <TabsTrigger value="close">Close</TabsTrigger>
        </TabsList>

        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>Make Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMakePayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount (ETH)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setPaymentAmount(loanInfo.borrowed)}
                    >
                      FULL
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !paymentAmount}>
                  {isLoading ? 'Processing...' : 'Make Payment'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extend">
          <Card>
            <CardHeader>
              <CardTitle>Extend Loan Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExtendLoan} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="extensionDays">Additional Days</Label>
                  <Input
                    id="extensionDays"
                    type="number"
                    min="1"
                    max="365"
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Extend Loan'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expand">
          <Card>
            <CardHeader>
              <CardTitle>Expand Loan</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExpandLoan} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="expandAmount">Additional ETH to Borrow</Label>
                  <Input
                    id="expandAmount"
                    type="number"
                    step="0.001"
                    placeholder="0.0"
                    value={expandAmount}
                    onChange={(e) => setExpandAmount(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !expandAmount}>
                  {isLoading ? 'Processing...' : 'Expand Loan'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="close">
          <Card>
            <CardHeader>
              <CardTitle>Close Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleClosePosition} 
                className="w-full" 
                disabled={isLoading}
                variant="outline"
              >
                {isLoading ? 'Processing...' : `Close Position (Repay ${parseFloat(loanInfo.borrowed).toFixed(6)} ETH)`}
              </Button>
              <Button 
                onClick={handleInstantClose} 
                className="w-full" 
                disabled={isLoading}
                variant="destructive"
              >
                {isLoading ? 'Processing...' : 'Instant Close (Sell Collateral)'}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Instant close will sell your BTB collateral at current market price to repay the loan
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}