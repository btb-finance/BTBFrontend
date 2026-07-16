import {
  encodeAbiParameters, encodeFunctionData, erc20Abi, isAddress, keccak256,
  toFunctionSelector, zeroAddress, type Hex, type PublicClient,
} from 'viem';
import type { Call } from './txRunner';

export type SmartAccountChainId = 1 | 4663;

export interface SmartAccountDeployment {
  factory: `0x${string}`;
  priceGuard: `0x${string}`;
  swapAdapter: `0x${string}`;
  agent: `0x${string}`;
  earningsPreferences?: `0x${string}`;
  zap?: `0x${string}`;
  agentRegistry?: `0x${string}`;
  routeGuard?: `0x${string}`;
  aggregatorSwapAdapter?: `0x${string}`;
  quoter?: `0x${string}`;
}

export interface RebalancePolicy {
  enabled: boolean;
  agent: `0x${string}`;
  positionManager: `0x${string}`;
  uniswapFactory: `0x${string}`;
  pool: `0x${string}`;
  swapAdapter: `0x${string}`;
  priceGuard: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  positionId: bigint;
  fee: number;
  targetTickWidth: number;
  performanceFeeBps: number;
  maxSlippageBps: number;
  maxSwapBpsOfPosition: number;
  maxSpotTwapDeviationBps: number;
  maxIdleBps: number;
  twapSeconds: number;
  minRebalanceInterval: number;
  expiresAt: bigint;
  minimumAllowedTick: number;
  maximumAllowedTick: number;
  maximumToken0PerExecution: bigint;
  maximumToken1PerExecution: bigint;
}

export interface MintSpec {
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
}

export interface ManagedPositionCreation {
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  deadline: bigint;
  mode: number;
  specs: MintSpec[];
}

const POLICY_COMPONENTS = [
  { name: 'enabled', type: 'bool' },
  { name: 'agent', type: 'address' },
  { name: 'positionManager', type: 'address' },
  { name: 'uniswapFactory', type: 'address' },
  { name: 'pool', type: 'address' },
  { name: 'swapAdapter', type: 'address' },
  { name: 'priceGuard', type: 'address' },
  { name: 'token0', type: 'address' },
  { name: 'token1', type: 'address' },
  { name: 'positionId', type: 'uint256' },
  { name: 'fee', type: 'uint24' },
  { name: 'targetTickWidth', type: 'uint24' },
  { name: 'performanceFeeBps', type: 'uint16' },
  { name: 'maxSlippageBps', type: 'uint16' },
  { name: 'maxSwapBpsOfPosition', type: 'uint16' },
  { name: 'maxSpotTwapDeviationBps', type: 'uint16' },
  { name: 'maxIdleBps', type: 'uint16' },
  { name: 'twapSeconds', type: 'uint32' },
  { name: 'minRebalanceInterval', type: 'uint32' },
  { name: 'expiresAt', type: 'uint64' },
  { name: 'minimumAllowedTick', type: 'int24' },
  { name: 'maximumAllowedTick', type: 'int24' },
  { name: 'maximumToken0PerExecution', type: 'uint128' },
  { name: 'maximumToken1PerExecution', type: 'uint128' },
] as const;

const LEGACY_POLICY_COMPONENTS = POLICY_COMPONENTS.filter(component => component.name !== 'maxIdleBps');

const ZAP_LEG_COMPONENTS = [
  { name: 'tokenOut', type: 'address' },
  { name: 'amountIn', type: 'uint256' },
  { name: 'quotedMinimumOut', type: 'uint256' },
  { name: 'path', type: 'bytes' },
] as const;

const DUAL_CREATE_COMPONENTS = [
  { name: 'account', type: 'address' },
  { name: 'token0', type: 'address' },
  { name: 'token1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickLower', type: 'int24' },
  { name: 'tickUpper', type: 'int24' },
  { name: 'amount0', type: 'uint256' },
  { name: 'amount1', type: 'uint256' },
  { name: 'amount0Min', type: 'uint256' },
  { name: 'amount1Min', type: 'uint256' },
  { name: 'policy', type: 'tuple', components: POLICY_COMPONENTS },
] as const;

const DUAL_INCREASE_COMPONENTS = [
  { name: 'account', type: 'address' },
  { name: 'positionId', type: 'uint256' },
  { name: 'amount0', type: 'uint256' },
  { name: 'amount1', type: 'uint256' },
  { name: 'amount0Min', type: 'uint256' },
  { name: 'amount1Min', type: 'uint256' },
] as const;

const CREATE_REQUEST_COMPONENTS = [
  { name: 'account', type: 'address' },
  { name: 'fundingToken', type: 'address' },
  { name: 'fundingAmount', type: 'uint256' },
  { name: 'token0', type: 'address' },
  { name: 'token1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickLower', type: 'int24' },
  { name: 'tickUpper', type: 'int24' },
  { name: 'leg0', type: 'tuple', components: ZAP_LEG_COMPONENTS },
  { name: 'leg1', type: 'tuple', components: ZAP_LEG_COMPONENTS },
  { name: 'amount0Min', type: 'uint256' },
  { name: 'amount1Min', type: 'uint256' },
  { name: 'twapSeconds', type: 'uint32' },
  { name: 'maxSlippageBps', type: 'uint16' },
  { name: 'maxSpotTwapDeviationBps', type: 'uint16' },
  { name: 'policy', type: 'tuple', components: POLICY_COMPONENTS },
] as const;

const INCREASE_REQUEST_COMPONENTS = [
  { name: 'account', type: 'address' },
  { name: 'positionId', type: 'uint256' },
  { name: 'fundingToken', type: 'address' },
  { name: 'fundingAmount', type: 'uint256' },
  { name: 'leg0', type: 'tuple', components: ZAP_LEG_COMPONENTS },
  { name: 'leg1', type: 'tuple', components: ZAP_LEG_COMPONENTS },
  { name: 'amount0Min', type: 'uint256' },
  { name: 'amount1Min', type: 'uint256' },
  { name: 'twapSeconds', type: 'uint32' },
  { name: 'maxSlippageBps', type: 'uint16' },
  { name: 'maxSpotTwapDeviationBps', type: 'uint16' },
] as const;

export const TRADE_POLICY_COMPONENTS = [
  { name: 'enabled', type: 'bool' },
  { name: 'agent', type: 'address' },
  { name: 'requestKeyHash', type: 'bytes32' },
  { name: 'maximumBalanceBpsPerTrade', type: 'uint16' },
  { name: 'maximumSlippageBps', type: 'uint16' },
  { name: 'maximumSpotTwapDeviationBps', type: 'uint16' },
  { name: 'minimumTwapSeconds', type: 'uint32' },
  { name: 'expiresAt', type: 'uint64' },
] as const;

export interface TradePolicy {
  enabled: boolean;
  agent: `0x${string}`;
  requestKeyHash: Hex;
  maximumBalanceBpsPerTrade: number;
  maximumSlippageBps: number;
  maximumSpotTwapDeviationBps: number;
  minimumTwapSeconds: number;
  expiresAt: bigint;
}

const REBALANCE_REQUEST_COMPONENTS = [
  { name: 'newTickLower', type: 'int24' },
  { name: 'newTickUpper', type: 'int24' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'amountIn', type: 'uint256' },
  { name: 'quotedMinimumOut', type: 'uint256' },
  { name: 'removeAmount0Min', type: 'uint256' },
  { name: 'removeAmount1Min', type: 'uint256' },
  { name: 'mintAmount0Min', type: 'uint256' },
  { name: 'mintAmount1Min', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
] as const;

export const BTB_ACCOUNT_FACTORY_ABI = [
  { name: 'accountOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'account', type: 'address' }] },
  { name: 'predictAccount', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'account', type: 'address' }] },
  { name: 'createAccount', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'account', type: 'address' }] },
] as const;

export const BTB_EARNINGS_PREFERENCES_ABI = [
  {
    name: 'preferenceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'mode', type: 'uint8' }, { name: 'payoutToken', type: 'address' }],
  },
  {
    name: 'setPreference', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'mode', type: 'uint8' }, { name: 'payoutToken', type: 'address' }], outputs: [],
  },
] as const;

export const BTB_LP_ACCOUNT_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'zapExecutor', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'agentRegistry', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'routeGuard', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'nextNonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'pauseAutomation', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpauseAutomation', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'revokeAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'withdrawPosition', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'claimPositionFees', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'feeBaseline', type: 'function', stateMutability: 'view', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [{ name: 'token0', type: 'uint128' }, { name: 'token1', type: 'uint128' }] },
  { name: 'depositToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawToken', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawTokens', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokens', type: 'address[]' }], outputs: [] },
  { name: 'withdrawNative', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawAllNative', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    name: 'configureEarnings', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' },
      { name: 'mode', type: 'uint8' }, { name: 'payoutToken', type: 'address' },
      { name: 'payoutPath0', type: 'bytes' }, { name: 'payoutPath1', type: 'bytes' },
    ], outputs: [],
  },
  {
    name: 'earningsConfig', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }],
    outputs: [{
      name: 'result', type: 'tuple', components: [
        { name: 'mode', type: 'uint8' },
        { name: 'payoutToken', type: 'address' },
        { name: 'payoutPath0', type: 'bytes' },
        { name: 'payoutPath1', type: 'bytes' },
      ],
    }],
  },
  {
    name: 'claimAndPayout', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' },
      { name: 'request', type: 'tuple', components: [
        { name: 'quotedMinimumOut0', type: 'uint256' }, { name: 'quotedMinimumOut1', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
      ] },
      { name: 'swapData0', type: 'bytes' }, { name: 'swapData1', type: 'bytes' },
    ],
    outputs: [{ name: 'payoutAmount', type: 'uint256' }],
  },
  { name: 'configurePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newPolicy', type: 'tuple', components: POLICY_COMPONENTS }], outputs: [] },
  {
    name: 'rebalance', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionManager', type: 'address' },
      { name: 'positionId', type: 'uint256' },
      { name: 'request', type: 'tuple', components: REBALANCE_REQUEST_COMPONENTS },
      { name: 'swapData', type: 'bytes' },
    ],
    outputs: [{ name: 'newPositionId', type: 'uint256' }],
  },
  {
    name: 'policy', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }],
    outputs: [{ name: 'result', type: 'tuple', components: POLICY_COMPONENTS }],
  },
] as const;

export const BTB_LEGACY_LP_ACCOUNT_ABI = [
  ...BTB_LP_ACCOUNT_ABI.filter(item => item.name !== 'policy' && item.name !== 'configurePolicy'),
  { name: 'configurePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newPolicy', type: 'tuple', components: LEGACY_POLICY_COMPONENTS }], outputs: [] },
  { name: 'policy', type: 'function', stateMutability: 'view', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [{ name: 'result', type: 'tuple', components: LEGACY_POLICY_COMPONENTS }] },
] as const;

const BTB_LEGACY_CREATE_ABI = [{
  name: 'fundAndCreatePositions', type: 'function', stateMutability: 'nonpayable',
  inputs: [
    { name: 'creation', type: 'tuple', components: [
      { name: 'pool', type: 'address' }, { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'deadline', type: 'uint256' }, { name: 'mode', type: 'uint8' },
      { name: 'specs', type: 'tuple[]', components: [
        { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' },
        { name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' },
        { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' },
      ] },
    ] },
    { name: 'policyTemplate', type: 'tuple', components: LEGACY_POLICY_COMPONENTS },
  ], outputs: [{ name: 'positionIds', type: 'uint256[]' }],
}] as const;

export const BTB_AGENT_REGISTRY_ABI = [
  { name: 'ROLE_ADD_LP', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'ROLE_INCREASE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'ROLE_TRADE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'agents', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'address[]' }] },
  { name: 'agentRoles', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'agent', type: 'address' }], outputs: [{ type: 'uint8' }] },
  { name: 'nextInstructionId', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'reservedBalance', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'token', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'instructions', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'instructionId', type: 'uint256' }], outputs: [
    { name: 'enabled', type: 'bool' }, { name: 'agent', type: 'address' },
    { name: 'fundingToken', type: 'address' }, { name: 'maximumFundingAmount', type: 'uint256' },
    { name: 'secondFundingToken', type: 'address' }, { name: 'secondMaximumFundingAmount', type: 'uint256' },
    { name: 'executeAfter', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' },
    { name: 'requiredRole', type: 'uint8' }, { name: 'zapSelector', type: 'bytes4' }, { name: 'callHash', type: 'bytes32' },
  ] },
  { name: 'configureAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'agent', type: 'address' }, { name: 'roles', type: 'uint8' }], outputs: [] },
  { name: 'removeAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'agent', type: 'address' }], outputs: [] },
  { name: 'tradePolicies', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: TRADE_POLICY_COMPONENTS },
  { name: 'configureTradePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'policy', type: 'tuple', components: TRADE_POLICY_COMPONENTS }], outputs: [] },
  { name: 'revokeTradePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }], outputs: [] },
  {
    name: 'scheduleInstruction', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'account', type: 'address' }, { name: 'agent', type: 'address' },
      { name: 'fundingToken', type: 'address' }, { name: 'maximumFundingAmount', type: 'uint256' },
      { name: 'executeAfter', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' },
      { name: 'requiredRole', type: 'uint8' }, { name: 'zapSelector', type: 'bytes4' },
      { name: 'callHash', type: 'bytes32' },
    ], outputs: [{ name: 'instructionId', type: 'uint256' }],
  },
  {
    name: 'scheduleDualFundingInstruction', type: 'function', stateMutability: 'nonpayable', inputs: [
      { name: 'account', type: 'address' }, { name: 'agent', type: 'address' },
      { name: 'fundingToken', type: 'address' }, { name: 'maximumFundingAmount', type: 'uint256' },
      { name: 'secondFundingToken', type: 'address' }, { name: 'secondMaximumFundingAmount', type: 'uint256' },
      { name: 'executeAfter', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' },
      { name: 'requiredRole', type: 'uint8' }, { name: 'zapSelector', type: 'bytes4' },
      { name: 'callHash', type: 'bytes32' },
    ], outputs: [{ name: 'instructionId', type: 'uint256' }],
  },
  { name: 'cancelInstruction', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'instructionId', type: 'uint256' }], outputs: [] },
  { name: 'executeInstruction', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'instructionId', type: 'uint256' }, { name: 'pinnedArgs', type: 'bytes' }, { name: 'freshArgs', type: 'bytes' }], outputs: [{ type: 'bytes' }] },
] as const;

export const BTB_LP_ZAP_ABI = [
  { name: 'createFromAccount', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pinnedArgs', type: 'bytes' }, { name: 'freshArgs', type: 'bytes' }], outputs: [{ type: 'uint256' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'increaseFromAccount', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pinnedArgs', type: 'bytes' }, { name: 'freshArgs', type: 'bytes' }], outputs: [{ type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'createTwoTokens', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pinnedArgs', type: 'bytes' }, { name: 'freshArgs', type: 'bytes' }], outputs: [{ type: 'uint256' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' }] },
  { name: 'increaseTwoTokens', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pinnedArgs', type: 'bytes' }, { name: 'freshArgs', type: 'bytes' }], outputs: [{ type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' }] },
] as const;

export const BTB_LP_QUOTER_ABI = [
  { name: 'previewMint', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }, { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }, { name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' }], outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }, { name: 'liquidity', type: 'uint128' }] },
  { name: 'rangeValueSplitBps', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }, { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }], outputs: [{ name: 'value0Bps', type: 'uint256' }, { name: 'value1Bps', type: 'uint256' }] },
  { name: 'previewSwapToRange', type: 'function', stateMutability: 'view', inputs: [{ name: 'pool', type: 'address' }, { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' }, { name: 'have0', type: 'uint256' }, { name: 'have1', type: 'uint256' }], outputs: [{ name: 'plan', type: 'tuple', components: [{ name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'targetAmount0', type: 'uint256' }, { name: 'targetAmount1', type: 'uint256' }] }] },
] as const;

export const ERC721_OWNER_ABI = [
  { name: 'ownerOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'owner', type: 'address' }] },
  { name: 'safeTransferFrom', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
] as const;

export const WETH_DEPOSIT_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
] as const;

function address(value?: string): `0x${string}` | null {
  return value && isAddress(value) && value.toLowerCase() !== zeroAddress ? value as `0x${string}` : null;
}

function deployment(values: Record<'factory' | 'priceGuard' | 'swapAdapter' | 'agent', string | undefined> & {
  earningsPreferences?: string; zap?: string; agentRegistry?: string; routeGuard?: string;
  aggregatorSwapAdapter?: string; quoter?: string;
}): SmartAccountDeployment | null {
  const factory = address(values.factory);
  const priceGuard = address(values.priceGuard);
  const swapAdapter = address(values.swapAdapter);
  const agent = address(values.agent);
  const earningsPreferences = address(values.earningsPreferences);
  const zap = address(values.zap);
  const agentRegistry = address(values.agentRegistry);
  const routeGuard = address(values.routeGuard);
  const aggregatorSwapAdapter = address(values.aggregatorSwapAdapter);
  const quoter = address(values.quoter);
  return factory && priceGuard && swapAdapter && agent ? {
    factory, priceGuard, swapAdapter, agent,
    ...(earningsPreferences ? { earningsPreferences } : {}),
    ...(zap ? { zap } : {}), ...(agentRegistry ? { agentRegistry } : {}),
    ...(routeGuard ? { routeGuard } : {}), ...(aggregatorSwapAdapter ? { aggregatorSwapAdapter } : {}),
    ...(quoter ? { quoter } : {}),
  } : null;
}

const DEPLOYMENTS: Record<SmartAccountChainId, SmartAccountDeployment | null> = {
  1: deployment({
    factory: process.env.NEXT_PUBLIC_BTB_ACCOUNT_FACTORY_1,
    priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_1,
    swapAdapter: process.env.NEXT_PUBLIC_BTB_SWAP_ADAPTER_1,
    agent: process.env.NEXT_PUBLIC_BTB_AGENT_1,
    earningsPreferences: process.env.NEXT_PUBLIC_BTB_EARNINGS_PREFERENCES_1,
    zap: process.env.NEXT_PUBLIC_BTB_LP_ZAP_1,
    agentRegistry: process.env.NEXT_PUBLIC_BTB_AGENT_REGISTRY_1,
    routeGuard: process.env.NEXT_PUBLIC_BTB_ROUTE_GUARD_1,
    aggregatorSwapAdapter: process.env.NEXT_PUBLIC_BTB_AGGREGATOR_ADAPTER_1,
    quoter: process.env.NEXT_PUBLIC_BTB_LP_QUOTER_1,
  }),
  4663: deployment({
    factory: process.env.NEXT_PUBLIC_BTB_ACCOUNT_FACTORY_4663,
    priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_4663,
    swapAdapter: process.env.NEXT_PUBLIC_BTB_SWAP_ADAPTER_4663,
    agent: process.env.NEXT_PUBLIC_BTB_AGENT_4663,
    earningsPreferences: process.env.NEXT_PUBLIC_BTB_EARNINGS_PREFERENCES_4663,
    zap: process.env.NEXT_PUBLIC_BTB_LP_ZAP_4663,
    agentRegistry: process.env.NEXT_PUBLIC_BTB_AGENT_REGISTRY_4663,
    routeGuard: process.env.NEXT_PUBLIC_BTB_ROUTE_GUARD_4663,
    aggregatorSwapAdapter: process.env.NEXT_PUBLIC_BTB_AGGREGATOR_ADAPTER_4663,
    quoter: process.env.NEXT_PUBLIC_BTB_LP_QUOTER_4663,
  }),
};

const LEGACY_DEPLOYMENTS: Partial<Record<SmartAccountChainId, SmartAccountDeployment[]>> = {
  4663: [
    deployment({
      factory: process.env.NEXT_PUBLIC_BTB_LEGACY_ACCOUNT_FACTORY_4663,
      priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_4663,
      swapAdapter: process.env.NEXT_PUBLIC_BTB_LEGACY_SWAP_ADAPTER_4663,
      agent: process.env.NEXT_PUBLIC_BTB_LEGACY_AGENT_4663 ?? process.env.NEXT_PUBLIC_BTB_AGENT_4663,
    }),
    deployment({
      factory: process.env.NEXT_PUBLIC_BTB_LEGACY_ACCOUNT_FACTORY_4663_2,
      priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_4663,
      swapAdapter: process.env.NEXT_PUBLIC_BTB_LEGACY_SWAP_ADAPTER_4663_2,
      agent: process.env.NEXT_PUBLIC_BTB_LEGACY_AGENT_4663_2 ?? process.env.NEXT_PUBLIC_BTB_AGENT_4663,
    }),
  ].filter((item): item is SmartAccountDeployment => item !== null),
};

export const UINT128_MAX = (1n << 128n) - 1n;

export function isModularDeployment(d: SmartAccountDeployment): d is SmartAccountDeployment & Required<Pick<SmartAccountDeployment, 'zap' | 'agentRegistry' | 'routeGuard' | 'aggregatorSwapAdapter'>> {
  return !!(d.zap && d.agentRegistry && d.routeGuard && d.aggregatorSwapAdapter);
}

export function getSmartAccountDeployment(chainId: number): SmartAccountDeployment | null {
  return chainId === 1 || chainId === 4663 ? DEPLOYMENTS[chainId] : null;
}

export function getLegacySmartAccountDeployments(chainId: number): SmartAccountDeployment[] {
  return chainId === 1 || chainId === 4663 ? LEGACY_DEPLOYMENTS[chainId] ?? [] : [];
}

export async function readSmartAccount(client: PublicClient, owner: `0x${string}`, d: SmartAccountDeployment) {
  const existing = await client.readContract({ address: d.factory, abi: BTB_ACCOUNT_FACTORY_ABI, functionName: 'accountOf', args: [owner] });
  const account = existing === zeroAddress
    ? await client.readContract({ address: d.factory, abi: BTB_ACCOUNT_FACTORY_ABI, functionName: 'predictAccount', args: [owner] })
    : existing;
  const deployed = existing !== zeroAddress;
  const paused = deployed
    ? await client.readContract({ address: account, abi: BTB_LP_ACCOUNT_ABI, functionName: 'paused' }).catch(() => false)
    : false;
  return { account, deployed, paused };
}

export function createAccountCall(d: SmartAccountDeployment, owner: `0x${string}`): Call {
  return { to: d.factory, data: encodeFunctionData({ abi: BTB_ACCOUNT_FACTORY_ABI, functionName: 'createAccount', args: [owner] }) };
}

export function configurePolicyCall(d: SmartAccountDeployment, account: `0x${string}`, policy: RebalancePolicy): Call {
  if (isModularDeployment(d)) {
    return { to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'configurePolicy', args: [policy] }) };
  }
  const { maxIdleBps: _maxIdleBps, ...legacyPolicy } = policy;
  return { to: account, data: encodeFunctionData({ abi: BTB_LEGACY_LP_ACCOUNT_ABI, functionName: 'configurePolicy', args: [legacyPolicy] }) };
}

export function approvalCall(token: `0x${string}`, spender: `0x${string}`, amount: bigint): Call | null {
  if (amount === 0n) return null;
  return { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }) };
}

export function wrapEthCall(weth: `0x${string}`, amount: bigint): Call | null {
  if (amount === 0n) return null;
  return { to: weth, value: amount, data: encodeFunctionData({ abi: WETH_DEPOSIT_ABI, functionName: 'deposit' }) };
}

export function depositTokenCall(account: `0x${string}`, token: `0x${string}`, amount: bigint): Call | null {
  if (amount === 0n) return null;
  return { to: account, data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'depositToken', args: [token, amount] }) };
}

/** Compatibility builder for already deployed pre-zap accounts. */
export function fundAndCreateCall(account: `0x${string}`, creation: ManagedPositionCreation, policy: RebalancePolicy): Call {
  const { maxIdleBps: _maxIdleBps, ...legacyPolicy } = policy;
  return { to: account, data: encodeFunctionData({ abi: BTB_LEGACY_CREATE_ABI, functionName: 'fundAndCreatePositions', args: [creation, legacyPolicy] }) };
}

export interface ZapLeg {
  tokenOut: `0x${string}`;
  amountIn: bigint;
  quotedMinimumOut: bigint;
  path: Hex;
}

export interface DualCreateRequest {
  account: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  policy: RebalancePolicy;
}

export interface DualIncreaseRequest {
  account: `0x${string}`;
  positionId: bigint;
  amount0: bigint;
  amount1: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
}

export interface CreateZapRequest {
  account: `0x${string}`;
  fundingToken: `0x${string}`;
  fundingAmount: bigint;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  leg0: ZapLeg;
  leg1: ZapLeg;
  amount0Min: bigint;
  amount1Min: bigint;
  twapSeconds: number;
  maxSlippageBps: number;
  maxSpotTwapDeviationBps: number;
  policy: RebalancePolicy;
}

export interface IncreaseZapRequest {
  account: `0x${string}`;
  positionId: bigint;
  fundingToken: `0x${string}`;
  fundingAmount: bigint;
  leg0: ZapLeg;
  leg1: ZapLeg;
  amount0Min: bigint;
  amount1Min: bigint;
  twapSeconds: number;
  maxSlippageBps: number;
  maxSpotTwapDeviationBps: number;
}

export const EMPTY_ZAP_LEG: ZapLeg = { tokenOut: zeroAddress, amountIn: 0n, quotedMinimumOut: 0n, path: '0x' };
export const EMPTY_FRESH_SWAP_ARGS = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], ['0x', '0x']);
export const CREATE_FROM_ACCOUNT_SELECTOR = toFunctionSelector('createFromAccount(bytes,bytes)');
export const INCREASE_FROM_ACCOUNT_SELECTOR = toFunctionSelector('increaseFromAccount(bytes,bytes)');
export const CREATE_TWO_TOKENS_SELECTOR = toFunctionSelector('createTwoTokens(bytes,bytes)');
export const INCREASE_TWO_TOKENS_SELECTOR = toFunctionSelector('increaseTwoTokens(bytes,bytes)');

export function encodeCreateZapRequest(request: CreateZapRequest): Hex {
  return encodeAbiParameters([{ name: 'request', type: 'tuple', components: CREATE_REQUEST_COMPONENTS }], [request]);
}

export function encodeIncreaseZapRequest(request: IncreaseZapRequest): Hex {
  return encodeAbiParameters([{ name: 'request', type: 'tuple', components: INCREASE_REQUEST_COMPONENTS }], [request]);
}

export function encodeDualCreateRequest(request: DualCreateRequest): Hex {
  return encodeAbiParameters([{ name: 'request', type: 'tuple', components: DUAL_CREATE_COMPONENTS }], [request]);
}

export function encodeDualIncreaseRequest(request: DualIncreaseRequest): Hex {
  return encodeAbiParameters([{ name: 'request', type: 'tuple', components: DUAL_INCREASE_COMPONENTS }], [request]);
}

export function configureSelfAgentCall(d: SmartAccountDeployment, account: `0x${string}`, owner: `0x${string}`, roles: number): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'configureAgent', args: [account, owner, roles] }) };
}

export function configureAgentCall(d: SmartAccountDeployment, account: `0x${string}`, agent: `0x${string}`, roles: number): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'configureAgent', args: [account, agent, roles] }) };
}

export function configureTradePolicyCall(d: SmartAccountDeployment, account: `0x${string}`, policy: TradePolicy): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'configureTradePolicy', args: [account, policy] }) };
}

export function revokeTradePolicyCall(d: SmartAccountDeployment, account: `0x${string}`): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'revokeTradePolicy', args: [account] }) };
}

export function removeAgentCall(d: SmartAccountDeployment, account: `0x${string}`, agent: `0x${string}`): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'removeAgent', args: [account, agent] }) };
}

export function scheduleSingleInstructionCall(
  d: SmartAccountDeployment, account: `0x${string}`, owner: `0x${string}`, fundingToken: `0x${string}`,
  amount: bigint, executeAfter: bigint, expiresAt: bigint, role: number, selector: Hex, pinnedArgs: Hex,
): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'scheduleInstruction', args: [account, owner, fundingToken, amount, executeAfter, expiresAt, role, selector.slice(0, 10) as Hex, keccak256(pinnedArgs)] }) };
}

export function scheduleDualInstructionCall(
  d: SmartAccountDeployment, account: `0x${string}`, owner: `0x${string}`,
  token0: `0x${string}`, amount0: bigint, token1: `0x${string}`, amount1: bigint,
  executeAfter: bigint, expiresAt: bigint, role: number, selector: Hex, pinnedArgs: Hex,
): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'scheduleDualFundingInstruction', args: [account, owner, token0, amount0, token1, amount1, executeAfter, expiresAt, role, selector.slice(0, 10) as Hex, keccak256(pinnedArgs)] }) };
}

export function executeInstructionCall(
  d: SmartAccountDeployment, account: `0x${string}`, instructionId: bigint, pinnedArgs: Hex, freshArgs: Hex = '0x',
): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'executeInstruction', args: [account, instructionId, pinnedArgs, freshArgs] }) };
}

export function cancelInstructionCall(d: SmartAccountDeployment, account: `0x${string}`, instructionId: bigint): Call {
  if (!d.agentRegistry) throw new Error('Agent registry is not configured');
  return { to: d.agentRegistry, data: encodeFunctionData({ abi: BTB_AGENT_REGISTRY_ABI, functionName: 'cancelInstruction', args: [account, instructionId] }) };
}

export function minWithSlippage(amount: bigint, slippageBps: number): bigint {
  return amount * BigInt(10_000 - Math.max(0, Math.min(2_000, slippageBps))) / 10_000n;
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
