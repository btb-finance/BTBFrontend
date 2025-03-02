// Types for Aave service and components

export interface ReserveData {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: string;
  liquidityRate: string;
  variableBorrowRate: string;
  stableBorrowRate: string;
  availableLiquidity: string;
  totalStableDebt: string;
  totalVariableDebt: string;
  priceInEth: string;
  ltv: string;
  liquidationThreshold: string;
  liquidationBonus: string;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
}

export interface UserReserveData {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: string;
  currentATokenBalance: string;
  currentStableDebt: string;
  currentVariableDebt: string;
  principalStableDebt: string;
  scaledVariableDebt: string;
  stableBorrowRate: string;
  liquidityRate: string;
  stableRateLastUpdated: string;
  usageAsCollateralEnabled: boolean;
}

export interface AaveUserPosition {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
  currentLiquidationThreshold: string;
  ltv: string;
  healthFactor: string;
  reserves: UserReserveData[];
}

export interface AaveMarketData {
  reserves: ReserveData[];
}

export interface AaveTransactionParams {
  asset: string;
  amount: string;
  interestRateMode?: number; // 1 for stable, 2 for variable
  onBehalfOf?: string;
  referralCode?: number;
}

export interface AaveSupplyParams extends AaveTransactionParams {}

export interface AaveBorrowParams extends AaveTransactionParams {
  interestRateMode: number; // 1 for stable, 2 for variable
}

export interface AaveRepayParams extends AaveTransactionParams {
  interestRateMode: number; // 1 for stable, 2 for variable
}

export interface AaveWithdrawParams extends AaveTransactionParams {}

export interface AaveTransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
}

export interface Chain {
  name: string;
  chainId: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}
