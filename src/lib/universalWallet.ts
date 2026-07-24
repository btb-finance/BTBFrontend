import { encodeFunctionData, isAddress, zeroAddress, type Hex, type PublicClient } from 'viem';
import type { Call } from './txRunner';

export type UniversalWalletDeployment = {
  factory: `0x${string}`;
  implementationV2: `0x${string}`;
  agent: `0x${string}`;
};

export type SpotTradePolicy = {
  agent: `0x${string}`;
  sessionSigner: `0x${string}`;
  maximumBalanceSpendBps: number;
  expiresAt: bigint;
  enabled: boolean;
};

export const UNIVERSAL_FACTORY_ABI = [
  { name: 'walletOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'wallet', type: 'address' }] },
  { name: 'predictWallet', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'wallet', type: 'address' }] },
  { name: 'createWallet', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'wallet', type: 'address' }] },
] as const;

const SPOT_POLICY_COMPONENTS = [
  { name: 'agent', type: 'address' },
  { name: 'sessionSigner', type: 'address' },
  { name: 'maximumBalanceSpendBps', type: 'uint16' },
  { name: 'expiresAt', type: 'uint64' },
  { name: 'enabled', type: 'bool' },
] as const;

export const UNIVERSAL_WALLET_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'spotTradePolicy', type: 'function', stateMutability: 'view', inputs: [], outputs: SPOT_POLICY_COMPONENTS },
  { name: 'usedSpotTradeNonces', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'initializeV2', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'setPaused', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'paused', type: 'bool' }], outputs: [] },
  { name: 'setAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agent', type: 'address' }, { name: 'payoutReceiver', type: 'address' }, { name: 'expiresAt', type: 'uint64' }, { name: 'enabled', type: 'bool' }], outputs: [] },
  { name: 'setSpotTradePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'policy', type: 'tuple', components: SPOT_POLICY_COMPONENTS }], outputs: [] },
  { name: 'upgradeToAndCall', type: 'function', stateMutability: 'payable', inputs: [{ name: 'newImplementation', type: 'address' }, { name: 'data', type: 'bytes' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

function address(value?: string): `0x${string}` | null {
  return value && isAddress(value) && value.toLowerCase() !== zeroAddress ? value as `0x${string}` : null;
}

export function getUniversalWalletDeployment(): UniversalWalletDeployment | null {
  const factory = address(process.env.NEXT_PUBLIC_BTB_UNIVERSAL_FACTORY_4663)
    ?? '0xAb581367DFd31b2063c581Fbb55208Aa1750BD89';
  const implementationV2 = address(process.env.NEXT_PUBLIC_BTB_UNIVERSAL_V2_IMPLEMENTATION_4663)
    ?? '0x428D4e45Aba21D0261Fd8d91CAe73b1ff21abF44';
  const agent = address(process.env.NEXT_PUBLIC_BTB_AGENT_4663);
  return factory && implementationV2 && agent ? { factory, implementationV2, agent } : null;
}

export async function readUniversalWallet(client: PublicClient, owner: `0x${string}`, deployment: UniversalWalletDeployment) {
  const existing = await client.readContract({ address: deployment.factory, abi: UNIVERSAL_FACTORY_ABI, functionName: 'walletOf', args: [owner] });
  const account = existing === zeroAddress
    ? await client.readContract({ address: deployment.factory, abi: UNIVERSAL_FACTORY_ABI, functionName: 'predictWallet', args: [owner] })
    : existing;
  const deployed = existing !== zeroAddress;
  let policy: SpotTradePolicy | null = null;
  if (deployed) {
    const raw = await client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'spotTradePolicy' }).catch(() => null);
    if (raw) policy = { agent: raw[0], sessionSigner: raw[1], maximumBalanceSpendBps: Number(raw[2]), expiresAt: raw[3], enabled: raw[4] };
  }
  return { account, deployed, upgraded: policy !== null, policy };
}

export function createUniversalWalletCall(deployment: UniversalWalletDeployment, owner: `0x${string}`): Call {
  return { to: deployment.factory, data: encodeFunctionData({ abi: UNIVERSAL_FACTORY_ABI, functionName: 'createWallet', args: [owner] }) };
}

export function upgradeUniversalWalletCall(account: `0x${string}`, implementation: `0x${string}`): Call {
  return {
    to: account,
    data: encodeFunctionData({
      abi: UNIVERSAL_WALLET_ABI,
      functionName: 'upgradeToAndCall',
      args: [implementation, encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'initializeV2' })],
    }),
  };
}

export function configureUniversalTradeCalls(args: {
  account: `0x${string}`;
  deployment: UniversalWalletDeployment;
  sessionSigner: `0x${string}`;
  expiresAt: bigint;
  needsUpgrade: boolean;
}): Call[] {
  const policy: SpotTradePolicy = {
    agent: args.deployment.agent,
    sessionSigner: args.sessionSigner,
    maximumBalanceSpendBps: 10_000,
    expiresAt: args.expiresAt,
    enabled: true,
  };
  return [
    ...(args.needsUpgrade ? [
      { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [true] }) },
      upgradeUniversalWalletCall(args.account, args.deployment.implementationV2),
    ] : []),
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setAgent', args: [args.deployment.agent, args.deployment.agent, args.expiresAt, true] }) },
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setSpotTradePolicy', args: [policy] }) },
    ...(args.needsUpgrade ? [{ to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [false] }) }] : []),
  ];
}

export const SPOT_TRADE_TYPES = {
  SpotTrade: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minimumGrossOutput', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export const spotTradeDomain = (account: `0x${string}`) => ({
  name: 'BTB Universal Managed Wallet',
  version: '2',
  chainId: 4663,
  verifyingContract: account,
} as const);

export type PreparedSpotTrade = {
  minimumGrossOutput: string;
  nonce: string;
  deadline: number;
  amountInUsd: number;
};

export type SessionKey = Hex;
