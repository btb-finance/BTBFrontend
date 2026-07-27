import { encodeFunctionData, getAddress, isAddress, zeroAddress, type Hex, type PublicClient } from 'viem';

/** ERC-1967 implementation slot: keccak256('eip1967.proxy.implementation') - 1. */
const ERC1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
import type { Call } from './txRunner';

export type UniversalWalletDeployment = {
  factory: `0x${string}`;
  migrationFactories: readonly `0x${string}`[];
  implementation: `0x${string}`;
  agent: `0x${string}`;
  router: `0x${string}`;
  routerCodeHash: `0x${string}`;
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
  { name: 'createWalletAndConfigure', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }, { name: 'setupCall', type: 'bytes' }], outputs: [{ name: 'wallet', type: 'address' }] },
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
  { name: 'initializeV5', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'SPOT_TRADE_V5_TYPEHASH', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'TRADING_SETUP_TYPEHASH', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'GUARDED_SETUP_TYPEHASH', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { name: 'tradingSetupNonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'guardedSetupNonce', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'setPaused', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'paused', type: 'bool' }], outputs: [] },
  { name: 'setAgent', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'agent', type: 'address' }, { name: 'payoutReceiver', type: 'address' }, { name: 'expiresAt', type: 'uint64' }, { name: 'enabled', type: 'bool' }], outputs: [] },
  { name: 'setSpotTradePolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'policy', type: 'tuple', components: SPOT_POLICY_COMPONENTS }], outputs: [] },
  { name: 'setSpotRouterPolicy', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'router', type: 'address' }, { name: 'selector', type: 'bytes4' }, { name: 'policy', type: 'tuple', components: [{ name: 'codeHash', type: 'bytes32' }, { name: 'expiresAt', type: 'uint64' }, { name: 'enabled', type: 'bool' }] }], outputs: [] },
  { name: 'configureTradingBySig', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'setup', type: 'tuple', components: [{ name: 'agent', type: 'address' }, { name: 'payoutReceiver', type: 'address' }, { name: 'sessionSigner', type: 'address' }, { name: 'maximumBalanceSpendBps', type: 'uint16' }, { name: 'expiresAt', type: 'uint64' }, { name: 'router', type: 'address' }, { name: 'routerCodeHash', type: 'bytes32' }, { name: 'selector0', type: 'bytes4' }, { name: 'selector1', type: 'bytes4' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint64' }] }, { name: 'ownerSignature', type: 'bytes' }], outputs: [] },
  { name: 'upgradeToAndCall', type: 'function', stateMutability: 'payable', inputs: [{ name: 'newImplementation', type: 'address' }, { name: 'data', type: 'bytes' }], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

function address(value?: string): `0x${string}` | null {
  return value && isAddress(value) && value.toLowerCase() !== zeroAddress ? value as `0x${string}` : null;
}

export function getUniversalWalletDeployment(): UniversalWalletDeployment | null {
  const factory = address(process.env.NEXT_PUBLIC_BTB_UNIVERSAL_FACTORY_4663)
    ?? '0x16EE6A9de42ec92bE7141A6009B211D1080348E3';
  // Every factory that has ever created a wallet. A new factory address means a
  // new CREATE2 wallet address, so an existing owner is only found by looking
  // them up here — dropping one hides funded accounts from their owner.
  const migrationFactories = [
    '0x2C2360b0e662ffB535e0c501B2Fd28Cd3792815d',
    '0x4cDC938b3Ece8A82c1658827cFc30Bbc1DF65EA3',
    '0x632f02d54F6F37eA7Ae41E02402aCAF9cd1c08b3',
  ] as const;
  const implementation = address(process.env.NEXT_PUBLIC_BTB_UNIVERSAL_IMPLEMENTATION_4663)
    ?? '0x5D510E076DD9a58D574932fA8e8c6dAd1d67ef72';
  const agent = address(process.env.NEXT_PUBLIC_BTB_AGENT_4663)
    ?? '0xfE097b94eeDEb21DFc1b9A307d199A55dB6acb7d';
  const router = address(process.env.NEXT_PUBLIC_KYBER_ROUTER_4663)
    ?? '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5';
  const routerCodeHash = process.env.NEXT_PUBLIC_KYBER_ROUTER_CODEHASH_4663 as `0x${string}` | undefined
    ?? '0xdc6eb20a6d4701d8f0f04f9a3342d254eb2698bbad281d8578d6efba21865867';
  return factory && implementation && agent && /^0x[0-9a-fA-F]{64}$/.test(routerCodeHash)
    ? { factory, migrationFactories, implementation, agent, router, routerCodeHash }
    : null;
}

export async function readUniversalWallet(client: PublicClient, owner: `0x${string}`, deployment: UniversalWalletDeployment) {
  const current = await client.readContract({ address: deployment.factory, abi: UNIVERSAL_FACTORY_ABI, functionName: 'walletOf', args: [owner] });
  let migration: `0x${string}` = zeroAddress;
  if (current === zeroAddress) {
    for (const factory of deployment.migrationFactories) {
      if (factory.toLowerCase() === deployment.factory.toLowerCase()) continue;
      const candidate = await client.readContract({ address: factory, abi: UNIVERSAL_FACTORY_ABI, functionName: 'walletOf', args: [owner] }).catch(() => zeroAddress);
      if (candidate !== zeroAddress) { migration = candidate; break; }
    }
  }
  const existing = current !== zeroAddress ? current : migration;
  const account = existing === zeroAddress
    ? await client.readContract({ address: deployment.factory, abi: UNIVERSAL_FACTORY_ABI, functionName: 'predictWallet', args: [owner] })
    : existing;
  const deployed = existing !== zeroAddress;
  let policy: SpotTradePolicy | null = null;
  let paused = false;
  let upgraded = false;
  let setupNonce = 0n;
  let guardedSetupNonce = 0n;
  let guardedSetupReady = false;
  let currentImplementation: `0x${string}` | null = null;
  if (deployed) {
    const [raw, pausedValue, setupTypehash, nonce, guardedTypehash, guardedNonce] = await Promise.all([
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'spotTradePolicy' }).catch(() => null),
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'paused' }).catch(() => false),
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'TRADING_SETUP_TYPEHASH' }).catch(() => null),
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'tradingSetupNonce' }).catch(() => 0n),
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'GUARDED_SETUP_TYPEHASH' }).catch(() => null),
      client.readContract({ address: account, abi: UNIVERSAL_WALLET_ABI, functionName: 'guardedSetupNonce' }).catch(() => 0n),
    ]);
    paused = pausedValue;
    // Every V5 exposes TRADING_SETUP_TYPEHASH, so its presence only proves the
    // wallet is on *a* V5 — it cannot distinguish the implementation carrying
    // the current fixes from the one before it. Read the proxy's own ERC-1967
    // slot and compare, so a wallet left on an older implementation is still
    // offered the upgrade.
    const slot = await client.getStorageAt({ address: account, slot: ERC1967_IMPLEMENTATION_SLOT }).catch(() => undefined);
    currentImplementation = slot && slot.length >= 66 ? getAddress(`0x${slot.slice(-40)}`) : null;
    upgraded = setupTypehash !== null
      && currentImplementation !== null
      && currentImplementation.toLowerCase() === deployment.implementation.toLowerCase();
    setupNonce = nonce;
    guardedSetupReady = guardedTypehash !== null;
    guardedSetupNonce = guardedNonce;
    if (raw) policy = { agent: raw[0], sessionSigner: raw[1], maximumBalanceSpendBps: Number(raw[2]), expiresAt: raw[3], enabled: raw[4] };
  }
  return { account, deployed, upgraded, currentImplementation, guardedSetupReady, paused, policy, setupNonce, guardedSetupNonce, migrationWallet: migration !== zeroAddress };
}

export function createUniversalWalletCall(deployment: UniversalWalletDeployment, owner: `0x${string}`): Call {
  return { to: deployment.factory, data: encodeFunctionData({ abi: UNIVERSAL_FACTORY_ABI, functionName: 'createWallet', args: [owner] }), label: 'Create your BTB smart account' };
}

export function upgradeUniversalWalletCall(account: `0x${string}`, implementation: `0x${string}`): Call {
  return {
    to: account,
    data: encodeFunctionData({
      abi: UNIVERSAL_WALLET_ABI,
      functionName: 'upgradeToAndCall',
      args: [implementation, encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [false] })],
    }),
    label: 'Upgrade to the current BTB wallet',
  };
}

export function upgradeUniversalWalletCalls(account: `0x${string}`, implementation: `0x${string}`, paused: boolean): Call[] {
  return [
    ...(!paused ? [{ to: account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [true] }), label: 'Securely pause the previous wallet version' }] : []),
    upgradeUniversalWalletCall(account, implementation),
  ];
}

export function configureUniversalTradeCalls(args: {
  account: `0x${string}`;
  deployment: UniversalWalletDeployment;
  sessionSigner: `0x${string}`;
  expiresAt: bigint;
  needsUpgrade: boolean;
  paused: boolean;
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
      ...(!args.paused ? [{ to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [true] }), label: 'Pause legacy automation for upgrade' }] : []),
      upgradeUniversalWalletCall(args.account, args.deployment.implementation),
    ] : []),
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setAgent', args: [args.deployment.agent, args.deployment.agent, args.expiresAt, true] }), label: 'Authorize the BTB trading agent' },
    { to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setSpotTradePolicy', args: [policy] }), label: 'Authorize instant trading on this device' },
    ...(['0xe21fd0e9', '0x8af033fb'] as const).map(selector => ({
      to: args.account,
      data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setSpotRouterPolicy', args: [args.deployment.router, selector, { codeHash: args.deployment.routerCodeHash, expiresAt: args.expiresAt, enabled: true }] }),
      label: 'Approve the audited KyberSwap router',
    })),
    ...((args.needsUpgrade || args.paused) ? [{ to: args.account, data: encodeFunctionData({ abi: UNIVERSAL_WALLET_ABI, functionName: 'setPaused', args: [false] }), label: 'Resume smart-account automation' }] : []),
  ];
}

export const SPOT_TRADE_TYPES = {
  SpotTradeV5: [
    { name: 'router', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minimumGrossOutput', type: 'uint256' },
    { name: 'minimumProtocolFee', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export const TRADING_SETUP_TYPES = {
  TradingSetup: [
    { name: 'agent', type: 'address' },
    { name: 'payoutReceiver', type: 'address' },
    { name: 'sessionSigner', type: 'address' },
    { name: 'maximumBalanceSpendBps', type: 'uint16' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'router', type: 'address' },
    { name: 'routerCodeHash', type: 'bytes32' },
    { name: 'selector0', type: 'bytes4' },
    { name: 'selector1', type: 'bytes4' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export const spotTradeDomain = (account: `0x${string}`) => ({
  name: 'BTB Universal Managed Wallet',
  version: '5',
  chainId: 4663,
  verifyingContract: account,
} as const);

export const tradingSetupDomain = spotTradeDomain;

export type PreparedSpotTrade = {
  router: `0x${string}`;
  minimumGrossOutput: string;
  minimumProtocolFee: string;
  nonce: string;
  deadline: number;
  amountInUsd: number;
};

export type SessionKey = Hex;
