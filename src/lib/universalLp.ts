import { encodeAbiParameters, encodeFunctionData, isAddress, keccak256, zeroAddress, type Hex, type PublicClient } from 'viem';
import type { Call } from './txRunner';
import { UNIVERSAL_WALLET_ABI, type UniversalWalletDeployment } from './universalWallet';

export const UINT128_MAX = (1n << 128n) - 1n;

const POOL_POLICY_COMPONENTS = [
  { name: 'positionManager', type: 'address' },
  { name: 'pool', type: 'address' },
  { name: 'router', type: 'address' },
  { name: 'routerCodeHash', type: 'bytes32' },
  { name: 'routerSelector0', type: 'bytes4' },
  { name: 'routerSelector1', type: 'bytes4' },
  { name: 'token0', type: 'address' },
  { name: 'token1', type: 'address' },
  { name: 'maximumToken0PerRebalance', type: 'uint128' },
  { name: 'maximumToken1PerRebalance', type: 'uint128' },
  { name: 'minimumExitToken0', type: 'uint128' },
  { name: 'minimumExitToken1', type: 'uint128' },
  { name: 'fee', type: 'uint24' },
  { name: 'targetTickWidth', type: 'uint24' },
  { name: 'maximumSlippageBps', type: 'uint16' },
  { name: 'minimumTick', type: 'int24' },
  { name: 'maximumTick', type: 'int24' },
  { name: 'expiresAt', type: 'uint64' },
  { name: 'enabled', type: 'bool' },
] as const;

export const UNIVERSAL_LP_GUARD_ABI = [
  { name: 'poolKey', type: 'function', stateMutability: 'pure', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'bytes32' }] },
  { name: 'poolPolicies', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'bytes32' }], outputs: POOL_POLICY_COMPONENTS },
  { name: 'setPoolPolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'account', type: 'address' }, { name: 'policy', type: 'tuple', components: POOL_POLICY_COMPONENTS }], outputs: [] },
] as const;

const CALL_POLICY_COMPONENTS = [
  { name: 'targetCodeHash', type: 'bytes32' },
  { name: 'maximumNativeValue', type: 'uint96' },
  { name: 'recipientOffset', type: 'uint16' },
  { name: 'recipientMode', type: 'uint8' },
  { name: 'enabled', type: 'bool' },
] as const;

const APPROVAL_POLICY_COMPONENTS = [
  { name: 'maximumPerExecution', type: 'uint128' },
  { name: 'maximumPerWindow', type: 'uint128' },
  { name: 'window', type: 'uint64' },
  { name: 'windowStart', type: 'uint64' },
  { name: 'spentInWindow', type: 'uint128' },
  { name: 'enabled', type: 'bool' },
] as const;

const GUARDED_SETUP_COMPONENTS = [
  { name: 'agent', type: 'address' },
  { name: 'payoutReceiver', type: 'address' },
  { name: 'expiresAt', type: 'uint64' },
  { name: 'guard', type: 'address' },
  { name: 'guardCodeHash', type: 'bytes32' },
  { name: 'guardConfigHash', type: 'bytes32' },
  { name: 'callPoliciesHash', type: 'bytes32' },
  { name: 'approvalPoliciesHash', type: 'bytes32' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint64' },
] as const;

export const UNIVERSAL_LP_WALLET_ABI = [
  ...UNIVERSAL_WALLET_ABI,
  { name: 'guardPolicies', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ name: 'codeHash', type: 'bytes32' }, { name: 'expiresAt', type: 'uint64' }, { name: 'enabled', type: 'bool' }] },
  { name: 'setGuardPolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'guard', type: 'address' }, { name: 'policy', type: 'tuple', components: [{ name: 'codeHash', type: 'bytes32' }, { name: 'expiresAt', type: 'uint64' }, { name: 'enabled', type: 'bool' }] }], outputs: [] },
  { name: 'setCallPolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'target', type: 'address' }, { name: 'selector', type: 'bytes4' }, { name: 'policy', type: 'tuple', components: CALL_POLICY_COMPONENTS }], outputs: [] },
  { name: 'setApprovalPolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'policy', type: 'tuple', components: APPROVAL_POLICY_COMPONENTS }], outputs: [] },
  { name: 'withdrawERC721', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'collection', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [] },
  { name: 'guardedSetupNonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'configureGuardedWorkflowBySig', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'setup', type: 'tuple', components: GUARDED_SETUP_COMPONENTS },
    { name: 'callPolicyUpdates', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'selector', type: 'bytes4' }, { name: 'policy', type: 'tuple', components: CALL_POLICY_COMPONENTS }] },
    { name: 'approvalPolicyUpdates', type: 'tuple[]', components: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'policy', type: 'tuple', components: APPROVAL_POLICY_COMPONENTS }] },
    { name: 'guardConfiguration', type: 'bytes' },
    { name: 'ownerSignature', type: 'bytes' },
  ], outputs: [] },
] as const;

export const GUARDED_SETUP_TYPES = {
  GuardedSetup: GUARDED_SETUP_COMPONENTS,
} as const;

const CALL_POLICY_UPDATE_PARAMETER = {
  type: 'tuple[]',
  components: [
    { name: 'target', type: 'address' },
    { name: 'selector', type: 'bytes4' },
    { name: 'policy', type: 'tuple', components: CALL_POLICY_COMPONENTS },
  ],
} as const;

const APPROVAL_POLICY_UPDATE_PARAMETER = {
  type: 'tuple[]',
  components: [
    { name: 'token', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'policy', type: 'tuple', components: APPROVAL_POLICY_COMPONENTS },
  ],
} as const;

const POOL_POLICY_PARAMETER = { type: 'tuple', components: POOL_POLICY_COMPONENTS } as const;

export type UniversalLpPolicy = {
  positionManager: `0x${string}`;
  pool: `0x${string}`;
  router: `0x${string}`;
  routerCodeHash: Hex;
  routerSelector0: Hex;
  routerSelector1: Hex;
  token0: `0x${string}`;
  token1: `0x${string}`;
  maximumToken0PerRebalance: bigint;
  maximumToken1PerRebalance: bigint;
  minimumExitToken0: bigint;
  minimumExitToken1: bigint;
  fee: number;
  targetTickWidth: number;
  maximumSlippageBps: number;
  minimumTick: number;
  maximumTick: number;
  expiresAt: bigint;
  enabled: boolean;
};

export type GuardedLpSetup = {
  setup: {
    agent: `0x${string}`;
    payoutReceiver: `0x${string}`;
    expiresAt: bigint;
    guard: `0x${string}`;
    guardCodeHash: Hex;
    guardConfigHash: Hex;
    callPoliciesHash: Hex;
    approvalPoliciesHash: Hex;
    nonce: bigint;
    deadline: bigint;
  };
  callPolicyUpdates: readonly {
    target: `0x${string}`;
    selector: Hex;
    policy: { targetCodeHash: Hex; maximumNativeValue: bigint; recipientOffset: number; recipientMode: number; enabled: boolean };
  }[];
  approvalPolicyUpdates: readonly {
    token: `0x${string}`;
    spender: `0x${string}`;
    policy: { maximumPerExecution: bigint; maximumPerWindow: bigint; window: bigint; windowStart: bigint; spentInWindow: bigint; enabled: boolean };
  }[];
  guardConfiguration: Hex;
};

const guardAddress = (process.env.NEXT_PUBLIC_BTB_UNISWAP_V3_GUARD_4663 ?? '0x969fb1A289621FDCD9cBf2D73733827A351B9bC2') as `0x${string}`;

export function getUniversalLpGuard(): `0x${string}` | null {
  return isAddress(guardAddress) && guardAddress.toLowerCase() !== zeroAddress ? guardAddress : null;
}

async function contractCodeHash(client: PublicClient, target: `0x${string}`): Promise<Hex> {
  const code = await client.getBytecode({ address: target });
  if (!code || code === '0x') throw new Error(`No contract is deployed at ${target}`);
  return keccak256(code);
}

export async function readUniversalLpPolicy(
  client: PublicClient,
  account: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number,
): Promise<UniversalLpPolicy | null> {
  const guard = getUniversalLpGuard();
  if (!guard) return null;
  const key = await client.readContract({ address: guard, abi: UNIVERSAL_LP_GUARD_ABI, functionName: 'poolKey', args: [token0, token1, fee] });
  const raw = await client.readContract({ address: guard, abi: UNIVERSAL_LP_GUARD_ABI, functionName: 'poolPolicies', args: [account, key] });
  if (!raw[18]) return null;
  return {
    positionManager: raw[0], pool: raw[1], router: raw[2], routerCodeHash: raw[3], routerSelector0: raw[4], routerSelector1: raw[5],
    token0: raw[6], token1: raw[7], maximumToken0PerRebalance: raw[8], maximumToken1PerRebalance: raw[9],
    minimumExitToken0: raw[10], minimumExitToken1: raw[11],
    fee: Number(raw[12]), targetTickWidth: Number(raw[13]), maximumSlippageBps: Number(raw[14]), minimumTick: Number(raw[15]), maximumTick: Number(raw[16]),
    expiresAt: raw[17], enabled: raw[18],
  };
}

export async function configureUniversalLpCalls(args: {
  client: PublicClient;
  account: `0x${string}`;
  deployment: UniversalWalletDeployment;
  positionManager: `0x${string}`;
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  targetTickWidth: number;
  maximumSlippageBps: number;
  maximumToken0PerRebalance: bigint;
  maximumToken1PerRebalance: bigint;
  minimumExitToken0: bigint;
  minimumExitToken1: bigint;
  minimumTick: number;
  maximumTick: number;
  expiresAt: bigint;
}): Promise<Call[]> {
  const guard = getUniversalLpGuard();
  if (!guard) throw new Error('The universal Uniswap V3 guard is not configured.');
  const [guardCodeHash, managerCodeHash] = await Promise.all([
    contractCodeHash(args.client, guard), contractCodeHash(args.client, args.positionManager),
  ]);
  const poolPolicy: UniversalLpPolicy = {
    positionManager: args.positionManager,
    pool: args.pool,
    router: args.deployment.router,
    routerCodeHash: args.deployment.routerCodeHash,
    routerSelector0: '0xe21fd0e9',
    routerSelector1: '0x8af033fb',
    token0: args.token0,
    token1: args.token1,
    maximumToken0PerRebalance: args.maximumToken0PerRebalance,
    maximumToken1PerRebalance: args.maximumToken1PerRebalance,
    minimumExitToken0: args.minimumExitToken0,
    minimumExitToken1: args.minimumExitToken1,
    fee: args.fee,
    targetTickWidth: args.targetTickWidth,
    maximumSlippageBps: args.maximumSlippageBps,
    minimumTick: args.minimumTick,
    maximumTick: args.maximumTick,
    expiresAt: args.expiresAt,
    enabled: true,
  };
  const callPolicy = (targetCodeHash: Hex) => ({ targetCodeHash, maximumNativeValue: 0n, recipientOffset: 0, recipientMode: 0, enabled: true });
  const approvalPolicy = { maximumPerExecution: UINT128_MAX, maximumPerWindow: 0n, window: 0n, windowStart: 0n, spentInWindow: 0n, enabled: true };
  const calls: Call[] = [
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setAgent', args: [args.deployment.agent, args.deployment.agent, args.expiresAt, true] }), label: 'Authorize the BTB rebalance agent' },
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setGuardPolicy', args: [guard, { codeHash: guardCodeHash, expiresAt: args.expiresAt, enabled: true }] }), label: 'Install the Uniswap V3 safety guard' },
    { to: guard, data: encodeFunctionData({ abi: UNIVERSAL_LP_GUARD_ABI, functionName: 'setPoolPolicy', args: [args.account, poolPolicy] }), label: 'Save your LP range limits' },
  ];
  for (const selector of ['0x0c49ccbe', '0xfc6f7865', '0x42966c68', '0x88316456'] as const) {
    calls.push({ to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setCallPolicy', args: [args.positionManager, selector, callPolicy(managerCodeHash)] }), label: 'Allow guarded Uniswap position actions' });
  }
  for (const selector of ['0xe21fd0e9', '0x8af033fb'] as const) {
    calls.push({ to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setCallPolicy', args: [args.deployment.router, selector, callPolicy(args.deployment.routerCodeHash)] }), label: 'Allow guarded KyberSwap routing' });
  }
  for (const token of [args.token0, args.token1].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
    calls.push(
      { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setApprovalPolicy', args: [token, args.positionManager, approvalPolicy] }), label: 'Allow exact LP deposits' },
      { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'setApprovalPolicy', args: [token, args.deployment.router, approvalPolicy] }), label: 'Allow exact rebalance swaps' },
    );
  }
  return calls;
}

/** Build the same complete LP permission set as one owner-signed payload. */
export async function prepareUniversalLpSetup(args: Parameters<typeof configureUniversalLpCalls>[0] & {
  nonce: bigint;
  deadline: bigint;
}): Promise<GuardedLpSetup> {
  const guard = getUniversalLpGuard();
  if (!guard) throw new Error('The universal Uniswap V3 guard is not configured.');
  const [guardCodeHash, managerCodeHash] = await Promise.all([
    contractCodeHash(args.client, guard), contractCodeHash(args.client, args.positionManager),
  ]);
  const poolPolicy: UniversalLpPolicy = {
    positionManager: args.positionManager,
    pool: args.pool,
    router: args.deployment.router,
    routerCodeHash: args.deployment.routerCodeHash,
    routerSelector0: '0xe21fd0e9',
    routerSelector1: '0x8af033fb',
    token0: args.token0,
    token1: args.token1,
    maximumToken0PerRebalance: args.maximumToken0PerRebalance,
    maximumToken1PerRebalance: args.maximumToken1PerRebalance,
    minimumExitToken0: args.minimumExitToken0,
    minimumExitToken1: args.minimumExitToken1,
    fee: args.fee,
    targetTickWidth: args.targetTickWidth,
    maximumSlippageBps: args.maximumSlippageBps,
    minimumTick: args.minimumTick,
    maximumTick: args.maximumTick,
    expiresAt: args.expiresAt,
    enabled: true,
  };
  const callPolicy = (targetCodeHash: Hex) => ({ targetCodeHash, maximumNativeValue: 0n, recipientOffset: 0, recipientMode: 0, enabled: true });
  const approvalPolicy = { maximumPerExecution: UINT128_MAX, maximumPerWindow: 0n, window: 0n, windowStart: 0n, spentInWindow: 0n, enabled: true };
  const callPolicyUpdates = [
    ...(['0x0c49ccbe', '0xfc6f7865', '0x42966c68', '0x88316456'] as const).map(selector => ({ target: args.positionManager, selector, policy: callPolicy(managerCodeHash) })),
    ...(['0xe21fd0e9', '0x8af033fb'] as const).map(selector => ({ target: args.deployment.router, selector, policy: callPolicy(args.deployment.routerCodeHash) })),
  ];
  const approvalPolicyUpdates = [args.token0, args.token1]
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .flatMap(token => [
      { token, spender: args.positionManager, policy: approvalPolicy },
      { token, spender: args.deployment.router, policy: approvalPolicy },
    ]);
  const guardConfiguration = encodeAbiParameters([POOL_POLICY_PARAMETER], [poolPolicy]);
  const callPoliciesHash = keccak256(encodeAbiParameters([CALL_POLICY_UPDATE_PARAMETER], [callPolicyUpdates]));
  const approvalPoliciesHash = keccak256(encodeAbiParameters([APPROVAL_POLICY_UPDATE_PARAMETER], [approvalPolicyUpdates]));
  return {
    setup: {
      agent: args.deployment.agent,
      payoutReceiver: args.deployment.agent,
      expiresAt: args.expiresAt,
      guard,
      guardCodeHash,
      guardConfigHash: keccak256(guardConfiguration),
      callPoliciesHash,
      approvalPoliciesHash,
      nonce: args.nonce,
      deadline: args.deadline,
    },
    callPolicyUpdates,
    approvalPolicyUpdates,
    guardConfiguration,
  };
}

export function withdrawUniversalLpCall(account: `0x${string}`, manager: `0x${string}`, tokenId: bigint): Call {
  return {
    to: account,
    data: encodeFunctionData({ abi: UNIVERSAL_LP_WALLET_ABI, functionName: 'withdrawERC721', args: [manager, tokenId] }),
    label: 'Return LP NFT to your wallet',
  };
}
