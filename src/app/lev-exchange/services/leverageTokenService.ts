import { ethers } from 'ethers';

/**
 * Custom error interface for leverage service errors
 */
export interface CustomError {
  code: string;
  message: string;
}

/**
 * Custom error class for leverage token service
 */
export class LeverageServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'LeverageServiceError';
  }
}



// Contract addresses on Base Sepolia
export const LEVERAGE_TOKEN_FACTORY = '0x4b95dB6aE06Fd6Eb248bC8587a1466c8345e0873';
export const LEVERAGE_MIMO_TOKEN = '0x37BA881a5358aEA5c71B8A69BCc831E2ACAABdbD';
export const MIMO_TOKEN = '0x2e481Be4F28aF8F0597c62fbca3f2E180B8E8AC1';

// Factory ABI (truncated for key functions)
const FACTORY_ABI = [{"inputs":[{"internalType":"address","name":"_feeCollector","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"AddressEmptyCode","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"AddressInsufficientBalance","type":"error"},{"inputs":[],"name":"FailedInnerCall","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"AllLeverageContractsFeeAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"startIndex","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"endIndex","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"updatedCount","type":"uint256"},{"indexed":false,"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"BatchLeverageContractsFeeAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"newCollector","type":"address"}],"name":"FeeCollectorUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"backingToken","type":"address"},{"indexed":false,"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"LeverageContractFeeAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"lister","type":"address"}],"name":"ListerAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"lister","type":"address"}],"name":"ListerRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"newShare","type":"uint256"}],"name":"PlatformFeeShareUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"backingToken","type":"address"}],"name":"TokenDeactivated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"backingToken","type":"address"}],"name":"TokenDeleted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"backingToken","type":"address"}],"name":"TokenReactivated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"backingToken","type":"address"},{"indexed":true,"internalType":"address","name":"leverageContract","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"string","name":"symbol","type":"string"}],"name":"TokenWhitelisted","type":"event"},{"inputs":[{"internalType":"address","name":"lister","type":"address"}],"name":"addLister","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"authorizedListers","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"}],"name":"deactivateToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"feeCollector","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getActiveTokens","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAllListers","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAllTokens","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"}],"name":"getLeverageContract","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getListerCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPlatformStats","outputs":[{"internalType":"uint256","name":"totalTokens","type":"uint256"},{"internalType":"uint256","name":"activeTokens","type":"uint256"},{"internalType":"uint256","name":"totalVolume","type":"uint256"},{"internalType":"uint256","name":"totalFeesCollected","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"}],"name":"getTokenInfo","outputs":[{"components":[{"internalType":"address","name":"backingToken","type":"address"},{"internalType":"address","name":"leverageContract","type":"address"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"uint256","name":"deployedAt","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"internalType":"struct LeverageTokenFactory.TokenInfo","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"startIndex","type":"uint256"},{"internalType":"uint256","name":"endIndex","type":"uint256"}],"name":"getTokenRange","outputs":[{"internalType":"address[]","name":"tokens","type":"address[]"},{"internalType":"bool[]","name":"activeStatus","type":"bool[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"lister","type":"address"}],"name":"isAuthorizedLister","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"}],"name":"isTokenActive","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"listedTokens","outputs":[{"internalType":"address","name":"backingToken","type":"address"},{"internalType":"address","name":"leverageContract","type":"address"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"uint256","name":"deployedAt","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"listerList","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"platformFeeShare","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"}],"name":"reactivateToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"lister","type":"address"}],"name":"removeLister","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"setAllLeverageContractsFeeAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"startIndex","type":"uint256"},{"internalType":"uint256","name":"endIndex","type":"uint256"},{"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"setBatchLeverageContractsFeeAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newCollector","type":"address"}],"name":"setFeeCollector","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"},{"internalType":"address","name":"newFeeAddress","type":"address"}],"name":"setLeverageContractFeeAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"newShare","type":"uint256"}],"name":"setPlatformFeeShare","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokenList","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"backingToken","type":"address"},{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"}],"name":"whitelistToken","outputs":[],"stateMutability":"nonpayable","type":"function"}];

// Leverage Token ABI (key trading functions)
const LEVERAGE_TOKEN_ABI = [{"inputs":[{"internalType":"address","name":"_backingToken","type":"address"},{"internalType":"string","name":"_name","type":"string"},{"internalType":"string","name":"_symbol","type":"string"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"target","type":"address"}],"name":"AddressEmptyCode","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"AddressInsufficientBalance","type":"error"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"allowance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientAllowance","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"needed","type":"uint256"}],"name":"ERC20InsufficientBalance","type":"error"},{"inputs":[{"internalType":"address","name":"approver","type":"address"}],"name":"ERC20InvalidApprover","type":"error"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"}],"name":"ERC20InvalidReceiver","type":"error"},{"inputs":[{"internalType":"address","name":"sender","type":"address"}],"name":"ERC20InvalidSender","type":"error"},{"inputs":[{"internalType":"address","name":"spender","type":"address"}],"name":"ERC20InvalidSpender","type":"error"},{"inputs":[],"name":"FailedInnerCall","type":"error"},{"inputs":[],"name":"MathOverflowedMulDiv","type":"error"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"buyFee","type":"uint256"}],"name":"BuyFeeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"_address","type":"address"}],"name":"FeeAddressUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"leverageFee","type":"uint256"}],"name":"LeverageFeeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Liquidate","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"collateralByDate","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"borrowedByDate","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalBorrowed","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"totalCollateral","type":"uint256"}],"name":"LoanDataUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"max","type":"uint256"}],"name":"MaxUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"volumeInBacking","type":"uint256"}],"name":"Price","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"sellFee","type":"uint256"}],"name":"SellFeeUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"started","type":"bool"}],"name":"Started","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"user","type":"address"},{"components":[{"internalType":"uint256","name":"collateral","type":"uint256"},{"internalType":"uint256","name":"borrowed","type":"uint256"},{"internalType":"uint256","name":"endDate","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"indexed":false,"internalType":"struct LeverageToken.Loan","name":"loan","type":"tuple"}],"name":"UserLoanDataUpdate","type":"event"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"BackingToTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"BackingToTokensCeil","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"BorrowedByDate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"CollateralByDate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"FEE_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"Loans","outputs":[{"internalType":"uint256","name":"collateral","type":"uint256"},{"internalType":"uint256","name":"borrowed","type":"uint256"},{"internalType":"uint256","name":"endDate","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"TokensToBacking","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"backingToken","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"backingAmount","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"name":"borrow","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"backingAmount","type":"uint256"}],"name":"borrowMore","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burn","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"burnFrom","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"buy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"buy_fee_leverage","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"closePosition","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"name":"extendLoan","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"flashClosePosition","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getBacking","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getBuyFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getBuyTokens","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"name":"getInterestFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"getLoanByAddress","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"date","type":"uint256"}],"name":"getLoansExpiringByDate","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"date","type":"uint256"}],"name":"getMidnightTimestamp","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getTotalBorrowed","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalCollateral","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isLoanExpired","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastLiquidationDate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"backingAmount","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"name":"leverage","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"backingAmount","type":"uint256"},{"internalType":"uint256","name":"numberOfDays","type":"uint256"}],"name":"leverageFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"liquidate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"removeCollateral","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"repay","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokens","type":"uint256"}],"name":"sell","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"sell_fee","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint16","name":"amount","type":"uint16"}],"name":"setBuyFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"amount","type":"uint16"}],"name":"setBuyFeeLeverage","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"setFeeAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint16","name":"amount","type":"uint16"}],"name":"setSellFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"burnAmount","type":"uint256"}],"name":"setStart","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"start","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];

export interface TokenInfo {
  backingToken: string;
  leverageContract: string;
  name: string;
  symbol: string;
  deployedAt: number;
  active: boolean;
  price?: string;
  priceChange24h?: number;
  volume24h?: string;
  tvl?: string;
  leverage?: string;
  apy?: string;
}

export interface PlatformStats {
  totalTokens: number;
  activeTokens: number;
  totalVolume: string;
  totalFeesCollected: string;
}

export interface UserBalance {
  token: string;
  balance: string;
  backingBalance: string;
}

export interface LoanInfo {
  collateral: string;
  borrowed: string;
  endDate: number;
  isExpired: boolean;
}

class LeverageTokenService {
  /**
   * Ethers provider for blockchain interaction
   */
  private provider: ethers.providers.Web3Provider | null = null;
  
  /**
   * Factory contract instance for token management
   */
  private factoryContract: ethers.Contract | null = null;

  /**
   * Initialize the Web3 provider using window.ethereum (MetaMask)
   * This should be called when wallet is connected
   */
  async initializeProvider() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new LeverageServiceError('PROVIDER_ERROR', 'No wallet provider found. Please install MetaMask.');
    }
    
    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    
    // Create factory contract instance
    this.factoryContract = new ethers.Contract(
      LEVERAGE_TOKEN_FACTORY,
      FACTORY_ABI,
      this.provider
    );
    
    console.log('Provider initialized, factory contract ready at:', LEVERAGE_TOKEN_FACTORY);
  }

  /**
   * Connect user's wallet and request account access
   * @returns Array of connected account addresses
   */
  async connectWallet(): Promise<string[]> {
    await this.initializeProvider();
    if (!this.provider) throw new LeverageServiceError('PROVIDER_ERROR', 'No wallet provider found');
    
    try {
      const accounts = await this.provider.send('eth_requestAccounts', []);
      console.log('Wallet connected, accounts:', accounts);
      return accounts;
    } catch (error: any) {
      if (error.code === 4001) {
        throw new LeverageServiceError('USER_REJECTED', 'Wallet connection rejected by user');
      }
      throw new LeverageServiceError('WALLET_ERROR', 'Failed to connect wallet: ' + error.message);
    }
  }

  /**
   * Fetch platform-wide statistics from the factory contract
   * @returns Platform statistics including total tokens, active tokens, volume, and fees
   */
  async getPlatformStats(): Promise<PlatformStats> {
    if (!this.factoryContract) await this.initializeProvider();
    if (!this.factoryContract) throw new LeverageServiceError('CONTRACT_ERROR', 'Factory contract not initialized');

    try {
      console.log('Fetching platform stats...');
      const stats = await this.factoryContract.getPlatformStats();
      console.log('Raw platform stats:', stats);
      
      return {
        totalTokens: stats.totalTokens.toNumber(),
        activeTokens: stats.activeTokens.toNumber(),
        totalVolume: ethers.utils.formatEther(stats.totalVolume),
        totalFeesCollected: ethers.utils.formatEther(stats.totalFeesCollected)
      };
    } catch (error: any) {
      console.error('Error fetching platform stats:', error);
      throw new LeverageServiceError('CONTRACT_ERROR', 'Failed to fetch platform stats: ' + error.message);
    }
  }

  async getAllTokens(): Promise<TokenInfo[]> {
    if (!this.factoryContract) await this.initializeProvider();
    if (!this.factoryContract) throw new Error('Factory contract not initialized');

    const tokenAddresses = await this.factoryContract.getAllTokens();
    console.log('Found', tokenAddresses.length, 'token addresses');
    
    if (tokenAddresses.length === 0) {
      console.log('No tokens whitelisted - using test data');
      // Temporary test data for UI verification - remove after tokens are whitelisted
      return [
        {
          backingToken: MIMO_TOKEN,
          leverageContract: LEVERAGE_MIMO_TOKEN,
          name: 'Leverage MiMo GaMe',
          symbol: 'levMIMO',
          deployedAt: Math.floor(Date.now() / 1000),
          active: true,
          price: '$0.95',
          priceChange24h: -2.34,
          volume24h: '$45,230',
          tvl: '$892,456',
          leverage: '2x',
          apy: '15.6%'
        }
      ];
    }
    
    const basicInfos = await Promise.all(
      tokenAddresses.map(async (backingToken: string) => {
        const info = await this.factoryContract!.getTokenInfo(backingToken);
        return {
          backingToken: info.backingToken,
          leverageContract: info.leverageContract,
          name: info.name,
          symbol: info.symbol,
          deployedAt: info.deployedAt.toNumber(),
          active: info.active
        };
      })
    );

    // Enhance with real contract data
    const enhancedTokens = await Promise.all(
      basicInfos.map(async (token) => {
        if (!token.active) {
          return { ...token, price: '0', priceChange24h: 0, volume24h: '$0', tvl: '$0', leverage: 'N/A', apy: 'N/A' };
        }
        const contract = await this.getTokenContract(token.leverageContract);
        if (!contract) return token;

        const [lastPriceWei, backingWei, totalSupplyWei, buyFee] = await Promise.all([
          contract.lastPrice(),
          contract.getBacking(),
          contract.totalSupply(),
          contract.buy_fee()
        ]);

        const price = ethers.utils.formatEther(lastPriceWei);
        const tvl = ethers.utils.formatEther(backingWei);
        const leverage = '2x'; // Fixed or calculate based on protocol
        const apy = 'Variable'; // Could calculate from interest rates
        const volume24h = '$0'; // Would need event logs for real volume
        const priceChange24h = 0; // Would need historical prices

        return {
          ...token,
          price: `$${price}`,
          priceChange24h,
          volume24h,
          tvl: `$${tvl}`,
          leverage,
          apy
        };
      })
    );

    return enhancedTokens;
  }

  async getActiveTokens(): Promise<TokenInfo[]> {
    const allTokens = await this.getAllTokens();
    return allTokens.filter(token => token.active);
  }

  async getTokenContract(address: string): Promise<ethers.Contract | null> {
    if (!this.provider) await this.initializeProvider();
    if (!this.provider) return null;

    return new ethers.Contract(address, LEVERAGE_TOKEN_ABI, this.provider);
  }

  async getUserBalance(tokenAddress: string, userAddress: string): Promise<UserBalance> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not found');

    try {
      const tokenBalance = await contract.balanceOf(userAddress);
      const backingTokenAddress = await contract.backingToken();
      if (!this.provider) throw new Error('Provider not initialized');
      const backingContract = new ethers.Contract(backingTokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);
      const backingBalance = await backingContract.balanceOf(userAddress);

      return {
        token: ethers.utils.formatEther(tokenBalance),
        balance: ethers.utils.formatEther(tokenBalance),
        backingBalance: ethers.utils.formatEther(backingBalance)
      };
    } catch (error: any) {
      console.error('Error fetching user balance:', error);
      throw new LeverageServiceError('CONTRACT_ERROR', 'Failed to fetch user balance');
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<string> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) return '0';

    try {
      const price = await contract.lastPrice();
      return ethers.utils.formatEther(price);
    } catch (error) {
      console.error('Error fetching token price:', error);
      return '0';
    }
  }

  async getBuyQuote(tokenAddress: string, amount: string): Promise<{
    tokensOut: string;
    priceImpact: string;
    fee: string;
  }> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not found');

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const [tokensOut, buyFee] = await Promise.all([
        contract.getBuyTokens(amountWei),
        contract.buy_fee()
      ]);

      const feePercentage = (1000 - Number(buyFee)) / 10; // Convert basis points to %
      const feeWei = amountWei.mul(1000 - buyFee).div(1000);

      return {
        tokensOut: ethers.utils.formatEther(tokensOut),
        priceImpact: '0.1', // Placeholder, calculate from pool size if needed
        fee: ethers.utils.formatEther(feeWei)
      };
    } catch (error: any) {
      console.error('Error getting buy quote:', error);
      throw new LeverageServiceError('CONTRACT_ERROR', 'Failed to get buy quote');
    }
  }

  async executeBuy(tokenAddress: string, amount: string, userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    const signer = this.provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, LEVERAGE_TOKEN_ABI, signer);
    
    const amountWei = ethers.utils.parseEther(amount);
    const tx = await contract.buy(userAddress, amountWei);
    
    return tx.hash;
  }

  async executeSell(tokenAddress: string, tokenAmount: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    const signer = this.provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, LEVERAGE_TOKEN_ABI, signer);
    
    const tokenAmountWei = ethers.utils.parseEther(tokenAmount);
    const tx = await contract.sell(tokenAmountWei);
    
    return tx.hash;
  }

  async executeLeverage(tokenAddress: string, backingAmount: string, numberOfDays: string, userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    const signer = this.provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, LEVERAGE_TOKEN_ABI, signer);
    
    const amountWei = ethers.utils.parseEther(backingAmount);
    const days = parseInt(numberOfDays);
    const tx = await contract.leverage(amountWei, days);
    
    return tx.hash;
  }

  async getLeverageFee(tokenAddress: string, backingAmount: string, numberOfDays: string): Promise<string> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not found');

    try {
      const amountWei = ethers.utils.parseEther(backingAmount);
      const days = parseInt(numberOfDays);
      const feeWei = await contract.leverageFee(amountWei, days);
      return ethers.utils.formatEther(feeWei);
    } catch (error) {
      console.error('Error getting leverage fee:', error);
      return '0';
    }
  }

  async getUserLoan(tokenAddress: string, userAddress: string): Promise<LoanInfo | null> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) return null;

    try {
      const [collateral, borrowed, endDate] = await contract.getLoanByAddress(userAddress);
      const isExpired = await contract.isLoanExpired(userAddress);

      return {
        collateral: ethers.utils.formatEther(collateral),
        borrowed: ethers.utils.formatEther(borrowed),
        endDate: endDate.toNumber(),
        isExpired
      };
    } catch (error) {
      console.error('Error fetching loan info:', error);
      return null;
    }
  }

}

// Helper function to get token symbol from address
export const getTokenSymbolFromAddress = (address: string): string => {
  switch (address.toLowerCase()) {
    case MIMO_TOKEN.toLowerCase():
      return 'MIMO';
    case '0x4200000000000000000000000000000000000006': // WETH on Base
      return 'WETH';
    default:
      return 'Unknown';
  }
};

export default new LeverageTokenService();