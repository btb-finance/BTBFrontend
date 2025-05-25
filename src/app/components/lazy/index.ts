import { lazy } from 'react';

// Dashboard components
export const PortfolioOverview = lazy(() => import('../dashboard/PortfolioOverview'));
export const MarketOverview = lazy(() => import('../dashboard/MarketOverview'));
export const TokensList = lazy(() => import('../dashboard/TokensList'));
export const PositionsList = lazy(() => import('../dashboard/PositionsList'));
export const LoansList = lazy(() => import('../dashboard/LoansList'));
export const AlertsPanel = lazy(() => import('../dashboard/AlertsPanel'));
export const TokenSwap = lazy(() => import('../dashboard/TokenSwap'));

// Charts and visualizations
export const ILCalculator = lazy(() => import('../../calculator/components/ILCalculator'));
export const PriceChart = lazy(() => import('../../calculator/components/PriceChart'));
export const UniswapV3Calculator = lazy(() => import('../../calculator/uniswapv3/components/UniswapV3Calculator'));
export const ImpermanentLossVisualizer = lazy(() => import('../../calculator/uniswapv3/components/ImpermanentLossVisualizer'));

// Trading interfaces
export const TradingInterface = lazy(() => import('../../btb-exchange/components/TradingInterface'));
export const KyberSwapExchange = lazy(() => import('../../btb-exchange/components/KyberSwapExchange'));
export const LeverageInterface = lazy(() => import('../../larryecosystem/components/LeverageInterface'));

// Game components
export const GameDashboard = lazy(() => import('../../game/components/GameDashboard'));
export const GameOverview = lazy(() => import('../../game/components/GameOverview'));
export const HuntMimo = lazy(() => import('../../game/components/HuntMimo'));

// Staking and yield
export const StakingForm = lazy(() => import('../../staking/components/StakingForm'));
export const StakingStats = lazy(() => import('../../staking/components/StakingStats'));

// NFT components  
export const NFTDisplay = lazy(() => import('../../nftswap/components/NFTDisplay'));
export const SwapBTBForNFT = lazy(() => import('../../nftswap/components/SwapBTBForNFT'));
export const SwapNFTForBTB = lazy(() => import('../../nftswap/components/SwapNFTForBTB'));

// Uniswap V4
export const AddLiquidity = lazy(() => import('../../uniswap/components/AddLiquidity').then(module => ({ default: module.AddLiquidity })));
export const PoolsList = lazy(() => import('../../uniswap/components/PoolsList').then(module => ({ default: module.PoolsList })));
export const PoolMetrics = lazy(() => import('../../uniswap/components/PoolMetrics').then(module => ({ default: module.PoolMetrics })));

// Bulk sender
export const BulkSenderForm = lazy(() => import('../../bulksender/components/BulkSenderForm'));
export const TransactionHistory = lazy(() => import('../../bulksender/components/TransactionHistory'));

// Megapot/Lottery
export const MegapotStats = lazy(() => import('../../megapot/components/MegapotStats'));
export const BuyTickets = lazy(() => import('../../megapot/components/BuyTickets'));
export const UserTickets = lazy(() => import('../../megapot/components/UserTickets'));

// Chicks components
export const ChicksStats = lazy(() => import('../../chicks/components/ChicksStats'));
export const DistributionChart = lazy(() => import('../../chicks/components/DistributionChart'));