import { encodeFunctionData, erc20Abi, isAddress, zeroAddress, type PublicClient } from 'viem';
import type { Call } from './txRunner';

export type SmartAccountChainId = 1 | 4663;

export interface SmartAccountDeployment {
  factory: `0x${string}`;
  priceGuard: `0x${string}`;
  swapAdapter: `0x${string}`;
  agent: `0x${string}`;
  earningsPreferences?: `0x${string}`;
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
  { name: 'twapSeconds', type: 'uint32' },
  { name: 'minRebalanceInterval', type: 'uint32' },
  { name: 'expiresAt', type: 'uint64' },
  { name: 'minimumAllowedTick', type: 'int24' },
  { name: 'maximumAllowedTick', type: 'int24' },
  { name: 'maximumToken0PerExecution', type: 'uint128' },
  { name: 'maximumToken1PerExecution', type: 'uint128' },
] as const;

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
  { name: 'nextNonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'pauseAutomation', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'unpauseAutomation', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'revokeAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'withdrawPosition', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
  { name: 'claimPositionFees', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'positionManager', type: 'address' }, { name: 'positionId', type: 'uint256' }], outputs: [] },
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
  {
    name: 'fundAndCreatePositions', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'creation', type: 'tuple', components: [
          { name: 'pool', type: 'address' },
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'deadline', type: 'uint256' },
          { name: 'mode', type: 'uint8' },
          {
            name: 'specs', type: 'tuple[]', components: [
              { name: 'tickLower', type: 'int24' },
              { name: 'tickUpper', type: 'int24' },
              { name: 'amount0Desired', type: 'uint256' },
              { name: 'amount1Desired', type: 'uint256' },
              { name: 'amount0Min', type: 'uint256' },
              { name: 'amount1Min', type: 'uint256' },
            ],
          },
        ],
      },
      { name: 'policyTemplate', type: 'tuple', components: POLICY_COMPONENTS },
    ],
    outputs: [{ name: 'positionIds', type: 'uint256[]' }],
  },
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

function deployment(values: Record<'factory' | 'priceGuard' | 'swapAdapter' | 'agent', string | undefined> & { earningsPreferences?: string }): SmartAccountDeployment | null {
  const factory = address(values.factory);
  const priceGuard = address(values.priceGuard);
  const swapAdapter = address(values.swapAdapter);
  const agent = address(values.agent);
  const earningsPreferences = address(values.earningsPreferences);
  return factory && priceGuard && swapAdapter && agent ? { factory, priceGuard, swapAdapter, agent, ...(earningsPreferences ? { earningsPreferences } : {}) } : null;
}

const DEPLOYMENTS: Record<SmartAccountChainId, SmartAccountDeployment | null> = {
  1: deployment({
    factory: process.env.NEXT_PUBLIC_BTB_ACCOUNT_FACTORY_1,
    priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_1,
    swapAdapter: process.env.NEXT_PUBLIC_BTB_SWAP_ADAPTER_1,
    agent: process.env.NEXT_PUBLIC_BTB_AGENT_1,
    earningsPreferences: process.env.NEXT_PUBLIC_BTB_EARNINGS_PREFERENCES_1,
  }),
  4663: deployment({
    factory: process.env.NEXT_PUBLIC_BTB_ACCOUNT_FACTORY_4663,
    priceGuard: process.env.NEXT_PUBLIC_BTB_PRICE_GUARD_4663,
    swapAdapter: process.env.NEXT_PUBLIC_BTB_SWAP_ADAPTER_4663,
    agent: process.env.NEXT_PUBLIC_BTB_AGENT_4663,
    earningsPreferences: process.env.NEXT_PUBLIC_BTB_EARNINGS_PREFERENCES_4663,
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

export function approvalCall(token: `0x${string}`, spender: `0x${string}`, amount: bigint): Call | null {
  if (amount === 0n) return null;
  return { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }) };
}

export function wrapEthCall(weth: `0x${string}`, amount: bigint): Call | null {
  if (amount === 0n) return null;
  return { to: weth, value: amount, data: encodeFunctionData({ abi: WETH_DEPOSIT_ABI, functionName: 'deposit' }) };
}

export function fundAndCreateCall(account: `0x${string}`, creation: ManagedPositionCreation, policy: RebalancePolicy): Call {
  return {
    to: account,
    data: encodeFunctionData({ abi: BTB_LP_ACCOUNT_ABI, functionName: 'fundAndCreatePositions', args: [creation, policy] }),
  };
}

export function minWithSlippage(amount: bigint, slippageBps: number): bigint {
  return amount * BigInt(10_000 - Math.max(0, Math.min(2_000, slippageBps))) / 10_000n;
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
