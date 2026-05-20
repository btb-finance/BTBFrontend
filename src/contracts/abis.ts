// Auto-generated from compiled Foundry artifacts

export const BEAR_NFT_ABI = [
  { name: 'totalMinted',         type: 'function', stateMutability: 'view',    inputs: [],                                                                                              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalSupply',         type: 'function', stateMutability: 'view',    inputs: [],                                                                                              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'remainingSupply',     type: 'function', stateMutability: 'view',    inputs: [],                                                                                              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pricePerNFT',         type: 'function', stateMutability: 'view',    inputs: [],                                                                                              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'MAX_SUPPLY',          type: 'function', stateMutability: 'view',    inputs: [],                                                                                              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf',           type: 'function', stateMutability: 'view',    inputs: [{ name: 'owner',    type: 'address' }],                                                         outputs: [{ name: '', type: 'uint256' }] },
  { name: 'isApprovedForAll',    type: 'function', stateMutability: 'view',    inputs: [{ name: 'owner',    type: 'address' }, { name: 'operator', type: 'address' }],                  outputs: [{ name: '', type: 'bool'    }] },
  { name: 'tokenOfOwnerByIndex', type: 'function', stateMutability: 'view',    inputs: [{ name: 'owner',    type: 'address' }, { name: 'index',    type: 'uint256' }],                  outputs: [{ name: '', type: 'uint256' }] },
  { name: 'tokenURI',            type: 'function', stateMutability: 'view',    inputs: [{ name: 'tokenId', type: 'uint256' }],                                                         outputs: [{ name: '', type: 'string'  }] },
  { name: 'buyNFT',              type: 'function', stateMutability: 'payable', inputs: [{ name: 'amount',  type: 'uint256' }],                                                         outputs: [{ name: '', type: 'uint256[]' }] },
  { name: 'setApprovalForAll',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }],                 outputs: [] },
] as const;

export const BEAR_STAKING_ABI = [
  { name: 'totalStaked',             type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalRewardsDistributed', type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '', type: 'uint256' }] },
  { name: 'estimatedAPR',            type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '', type: 'uint256' }] },
  { name: 'poolSize',                type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '', type: 'uint256' }] },
  { name: 'rewardsLast24h',          type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '', type: 'uint256' }] },
  { name: 'stakedCountOf',           type: 'function', stateMutability: 'view',       inputs: [{ name: '_user', type: 'address' }],              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pendingRewards',          type: 'function', stateMutability: 'view',       inputs: [{ name: '_user', type: 'address' }],              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pendingRewardsNet',       type: 'function', stateMutability: 'view',       inputs: [{ name: '_user', type: 'address' }],              outputs: [{ name: '', type: 'uint256' }] },
  { name: 'pendingRewardsDetailed',  type: 'function', stateMutability: 'view',       inputs: [{ name: '_user', type: 'address' }],              outputs: [{ name: 'gross', type: 'uint256' }, { name: 'net', type: 'uint256' }, { name: 'taxAmount', type: 'uint256' }] },
  { name: 'getUserInfo',             type: 'function', stateMutability: 'view',       inputs: [{ name: '_user', type: 'address' }],              outputs: [{ name: 'staked', type: 'uint256' }, { name: 'pending', type: 'uint256' }, { name: 'debt', type: 'uint256' }] },
  { name: 'getStats',                type: 'function', stateMutability: 'view',       inputs: [],                                                outputs: [{ name: '_totalStaked', type: 'uint256' }, { name: '_totalRewardsDistributed', type: 'uint256' }, { name: '_pendingToCollect', type: 'uint256' }, { name: '_rewardsLast24h', type: 'uint256' }, { name: '_estimatedAPR', type: 'uint256' }] },
  { name: 'userInfo',                type: 'function', stateMutability: 'view',       inputs: [{ name: '', type: 'address' }],                   outputs: [{ name: 'stakedCount', type: 'uint128' }, { name: 'pendingRewards', type: 'uint128' }, { name: 'rewardDebt', type: 'uint256' }] },
  { name: 'stake',                   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenIds', type: 'uint256[]' }],         outputs: [] },
  { name: 'unstake',                 type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'count',    type: 'uint256'   }],         outputs: [] },
  { name: 'claim',                   type: 'function', stateMutability: 'nonpayable', inputs: [],                                                outputs: [] },
  { name: 'collectFees',             type: 'function', stateMutability: 'nonpayable', inputs: [],                                                outputs: [] },
] as const;
