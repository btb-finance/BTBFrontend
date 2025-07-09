'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { 
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface MiMoProtectionWarningProps {
  mimoBalance: string;
  onDismiss?: () => void;
}

export default function MiMoProtectionWarning({ mimoBalance, onDismiss }: MiMoProtectionWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleAddLiquidity = () => {
    window.open(
      'https://aerodrome.finance/deposit?token0=eth&token1=0x7c1604981be181e856c458f3d604f15bc97c7661&type=-1&chain0=8453&chain1=8453',
      '_blank'
    );
  };

  if (isDismissed) {
    return null;
  }

  const hasSignificantBalance = parseFloat(mimoBalance) > 100;

  return (
    <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1">
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                    ⚠️ Your MiMo Tokens Can Be Hunted!
                  </h4>
                  <p className="text-sm">
                    You have <span className="font-bold">{parseFloat(mimoBalance).toFixed(2)} MiMo</span> tokens that are vulnerable to being hunted by other players. 
                    {hasSignificantBalance && ' This is a significant amount that could be lost!'}
                  </p>
                </div>
                
                <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheckIcon className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                    <span className="font-medium text-amber-900 dark:text-amber-100">Protection Solution</span>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Add your MiMo tokens to a liquidity pool on Aerodrome Finance. LP tokens are protected from being hunted, 
                    keeping your tokens safe while earning trading fees.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={handleAddLiquidity}
                    className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2"
                  >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Protect My MiMo
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleDismiss}
                    className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700"
                  >
                    Dismiss Warning
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}