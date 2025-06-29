import { lazy } from 'react';

// Trading interfaces
export const LeverageInterface = lazy(() => import('../../larryecosystem/components/LeverageInterface'));

// Game components
export const GameDashboard = lazy(() => import('../../game/components/GameDashboard'));
export const GameOverview = lazy(() => import('../../game/components/GameOverview'));
export const HuntMimo = lazy(() => import('../../game/components/HuntMimo'));

// NFT components  
export const NFTDisplay = lazy(() => import('../../nftswap/components/NFTDisplay'));
export const SwapBTBForNFT = lazy(() => import('../../nftswap/components/SwapBTBForNFT'));
export const SwapNFTForBTB = lazy(() => import('../../nftswap/components/SwapNFTForBTB'));

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