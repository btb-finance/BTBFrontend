export const CONTRACTS = {
  BTB: '0x88888888c90CD71B35830daBFD24743DbC135B51' as const,
  BTBB: '0x88888880d5Ca13018D2dC11e2e4744BD91a5656f' as const,
  BEAR_NFT: '0x88888888aBa934ceA0b4f0000FeA62F1397D02A0' as const,
  BEAR_STAKING: '0x8888888Faf81E6a98deb2B90A05B46b6E903e927' as const,
  OPOS: '0x88888805e7e3d5c7fb002ad98f08250e79c298dc' as const,
  FLIP: '0x8888889c878a0ae26033799517461af33a8e50a0' as const,
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
} as const

export const CHAIN_ID = 1 // Ethereum Mainnet only

// ERC20 ABI (shared for BTB and BTBB)
export const ERC20_ABI = [
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const

// BTBBear specific ABI
export const BTBB_ABI = [
  ...ERC20_ABI,
  { inputs: [{ name: 'btbAmount', type: 'uint256' }], name: 'mint', outputs: [{ name: 'btbbAmount', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'btbbAmount', type: 'uint256' }], name: 'redeem', outputs: [{ name: 'btbAmount', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'previewTransfer', outputs: [{ name: 'netAmount', type: 'uint256' }, { name: 'taxAmount', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [], name: 'pendingFees', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getStats', outputs: [{ name: 'btbBalance', type: 'uint256' }, { name: 'btbbSupply', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const

// BearNFT ABI
export const BEAR_NFT_ABI = [
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'buyNFT', outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'payable', type: 'function' },
  { inputs: [], name: 'totalMinted', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'remainingSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pricePerNFT', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'getPrice', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }], name: 'tokenOfOwnerByIndex', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], name: 'setApprovalForAll', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], name: 'isApprovedForAll', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
] as const

// OPOS ABI
export const OPOS_ABI = [
  ...ERC20_ABI,
  { inputs: [{ name: 'btbAmount', type: 'uint256' }], name: 'mint', outputs: [{ name: 'oposAmount', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'oposAmount', type: 'uint256' }], name: 'burn', outputs: [{ name: 'btbAmount', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
] as const

// FLIP ABI
export const FLIP_ABI = [
  ...ERC20_ABI,
  { inputs: [{ name: 'usdcAmount', type: 'uint256' }], name: 'flipUp', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'flipAmount', type: 'uint256' }], name: 'flipDown', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'usdcAmount', type: 'uint256' }], name: 'calculateFlipUp', outputs: [{ name: 'flipAmount', type: 'uint256' }, { name: 'taxAmount', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [{ name: 'flipAmount', type: 'uint256' }], name: 'calculateFlipDown', outputs: [{ name: 'usdcAmount', type: 'uint256' }, { name: 'taxAmount', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [], name: 'getUSDCBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'isFullyBacked', outputs: [{ name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
] as const

// BearStaking ABI
export const BEAR_STAKING_ABI = [
  { inputs: [{ name: 'tokenIds', type: 'uint256[]' }], name: 'stake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'count', type: 'uint256' }], name: 'unstake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'claim', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'collectFees', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_user', type: 'address' }], name: 'pendingRewards', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_user', type: 'address' }], name: 'pendingRewardsNet', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_user', type: 'address' }], name: 'pendingRewardsDetailed', outputs: [{ name: 'gross', type: 'uint256' }, { name: 'net', type: 'uint256' }, { name: 'taxAmount', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_user', type: 'address' }], name: 'stakedCountOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalStaked', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getStats', outputs: [
    { name: '_totalStaked', type: 'uint256' },
    { name: '_totalRewardsDistributed', type: 'uint256' },
    { name: '_pendingToCollect', type: 'uint256' },
    { name: '_rewardsLast24h', type: 'uint256' },
    { name: '_estimatedAPR', type: 'uint256' },
  ], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '_user', type: 'address' }], name: 'getUserInfo', outputs: [
    { name: 'staked', type: 'uint256' },
    { name: 'pending', type: 'uint256' },
    { name: 'debt', type: 'uint256' },
  ], stateMutability: 'view', type: 'function' },
] as const
