import {
  concatHex, encodeAbiParameters, keccak256, stringToHex, toFunctionSelector,
  type Address, type Hex,
} from 'viem';

/**
 * BTB Smart Account V2 studio helpers: deployed addresses on Robinhood Chain,
 * minimal ABIs, and client side reimplementations of BTBHashes leaves and the
 * OpenZeppelin compatible Merkle tree the account verifies proofs against.
 * Every hash here must match src/libraries/BTBHashes.sol byte for byte.
 */

export const BTB_CHAIN_ID = 4663;

export const BTB_V2 = {
  registry:        '0x8dBC7bF6db62aeA395190B70038A749Db7dD70D6' as Address,
  implementation:  '0x8825dFb3a2E529d07ae9c39b48Bf87F6Af08F30A' as Address,
  accountFactory:  '0x2c608e3a0FFda0e01106E0e2FDf6b344D43A45C6' as Address,
  erc4626Adapter:  '0xA67c43Cc3fda09285a6E340432901B5804Ac5cF7' as Address,
  uniV3Adapter:    '0xe7dA4a93191d4efdF3eeF5bF11F9F5bC597B8379' as Address,
  keeperIncentives:'0x58ca2C3Db055D7c608D4FA26BdbEa7fd3BF30d1C' as Address,
  uniV3Factory:    '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA' as Address,
  positionManager: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3' as Address,
  registryOwner:   '0x09Be3c244a52772f9108Cf1a1A47774E176C066d' as Address,
} as const;

export const CAPABILITY_EPOCH = 1n;

// ── Actions (keccak256 of the adapter's action strings) ──────────────────────

export const ACTION = {
  MINT:     keccak256(stringToHex('MINT_POSITION')),
  INCREASE: keccak256(stringToHex('INCREASE_LIQUIDITY')),
  DECREASE: keccak256(stringToHex('DECREASE_LIQUIDITY')),
  COLLECT:  keccak256(stringToHex('COLLECT')),
  BURN:     keccak256(stringToHex('BURN_EMPTY_POSITION')),
} as const;
export type ActionName = keyof typeof ACTION;
export const ACTION_ORDER: ActionName[] = ['MINT', 'INCREASE', 'DECREASE', 'COLLECT', 'BURN'];

// NonfungiblePositionManager selectors, one per adapter action.
export const NPM_SELECTOR: Record<ActionName, Hex> = {
  MINT:     toFunctionSelector('function mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))'),
  INCREASE: toFunctionSelector('function increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256))'),
  DECREASE: toFunctionSelector('function decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))'),
  COLLECT:  toFunctionSelector('function collect((uint256,address,uint128,uint128))'),
  BURN:     toFunctionSelector('function burn(uint256)'),
};

// ── BTBHashes leaves ─────────────────────────────────────────────────────────

const CALL_TYPEHASH = keccak256(stringToHex(
  'BTBCall(uint256 chainId,address adapter,bytes32 action,address target,bytes4 selector,uint256 maximumValue,bytes32 targetCodeHash)',
));
const ERC20_APPROVAL_TYPEHASH = keccak256(stringToHex(
  'BTBERC20Approval(uint256 chainId,address adapter,bytes32 action,address token,address spender,uint256 maximumPerExecution,uint256 maximumPerWindow)',
));

/** keccak256(bytes.concat(inner)) — OZ standard Merkle leaf domain separation. */
const leaf = (inner: Hex): Hex => keccak256(inner);

export function callLeaf(adapter: Address, action: Hex, target: Address, selector: Hex, maximumValue: bigint, targetCodeHash: Hex): Hex {
  return leaf(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }, { type: 'bytes4' }, { type: 'uint256' }, { type: 'bytes32' }],
    [CALL_TYPEHASH, BigInt(BTB_CHAIN_ID), adapter, action, target, selector, maximumValue, targetCodeHash],
  )));
}

export function erc20ApprovalLeaf(adapter: Address, action: Hex, token: Address, spender: Address, maximumPerExecution: bigint, maximumPerWindow: bigint): Hex {
  return leaf(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }],
    [ERC20_APPROVAL_TYPEHASH, BigInt(BTB_CHAIN_ID), adapter, action, token, spender, maximumPerExecution, maximumPerWindow],
  )));
}

// ── Commutative Merkle tree (matches OpenZeppelin MerkleProof) ───────────────

function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() < b.toLowerCase() ? keccak256(concatHex([a, b])) : keccak256(concatHex([b, a]));
}

export function merkleRoot(leaves: Hex[]): Hex {
  if (leaves.length === 0) throw new Error('empty tree');
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

export function merkleProof(leaves: Hex[], index: number): Hex[] {
  const proof: Hex[] = [];
  let level = leaves.slice();
  let i = index;
  while (level.length > 1) {
    const sibling = i % 2 === 0 ? i + 1 : i - 1;
    if (sibling < level.length) proof.push(level[sibling]);
    const next: Hex[] = [];
    for (let j = 0; j < level.length; j += 2) {
      next.push(j + 1 < level.length ? hashPair(level[j], level[j + 1]) : level[j]);
    }
    i = Math.floor(i / 2);
    level = next;
  }
  return proof;
}

// ── Strategy derivation ──────────────────────────────────────────────────────

export interface StrategyInputs {
  pool: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  /** Per execution ERC20 approval caps, committed into the asset root. */
  cap0: bigint;
  cap1: bigint;
  /** Per rolling day approval caps. */
  window0: bigint;
  window1: bigint;
}

export interface DerivedStrategy {
  configBytes: Hex;
  configHash: Hex;
  permissionId: Hex;
  capabilityRoot: Hex;
  assetRoot: Hex;
  callProof: Record<ActionName, Hex[]>;
  approvalProof: { MINT: [Hex[], Hex[]]; INCREASE: [Hex[], Hex[]] };
  spendLimits: { token: Address; maximumAmount: bigint }[];
  spendLimitsHash: Hex;
  outputTokens: Address[];
  outputTokensHash: Hex;
  rewardTokensHash: Hex;
}

/** Mirrors the contracts exactly: config encoding, roots, hashes, and proofs. */
export function deriveStrategy(s: StrategyInputs, npmCodeHash: Hex): DerivedStrategy {
  const configBytes = encodeAbiParameters(
    [{ type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'int24' }],
    [s.pool, s.token0, s.token1, s.fee, s.tickLower, s.tickUpper],
  );
  const configHash = keccak256(configBytes);
  const permissionId = keccak256(encodeAbiParameters(
    [{ type: 'string' }, { type: 'address' }, { type: 'int24' }, { type: 'int24' }],
    ['BTB_UNIV3_STUDIO', s.pool, s.tickLower, s.tickUpper],
  ));

  // Capability tree: one call leaf per action, fixed for the deployment.
  const callLeaves = ACTION_ORDER.map(a =>
    callLeaf(BTB_V2.uniV3Adapter, ACTION[a], BTB_V2.positionManager, NPM_SELECTOR[a], 0n, npmCodeHash));
  const capabilityRoot = merkleRoot(callLeaves);
  const callProof = Object.fromEntries(
    ACTION_ORDER.map((a, i) => [a, merkleProof(callLeaves, i)]),
  ) as Record<ActionName, Hex[]>;

  // Asset tree: ERC20 approval leaves for the two funding actions.
  const assetLeaves = [
    erc20ApprovalLeaf(BTB_V2.uniV3Adapter, ACTION.MINT, s.token0, BTB_V2.positionManager, s.cap0, s.window0),
    erc20ApprovalLeaf(BTB_V2.uniV3Adapter, ACTION.MINT, s.token1, BTB_V2.positionManager, s.cap1, s.window1),
    erc20ApprovalLeaf(BTB_V2.uniV3Adapter, ACTION.INCREASE, s.token0, BTB_V2.positionManager, s.cap0, s.window0),
    erc20ApprovalLeaf(BTB_V2.uniV3Adapter, ACTION.INCREASE, s.token1, BTB_V2.positionManager, s.cap1, s.window1),
  ];
  const assetRoot = merkleRoot(assetLeaves);
  const approvalProof = {
    MINT:     [merkleProof(assetLeaves, 0), merkleProof(assetLeaves, 1)] as [Hex[], Hex[]],
    INCREASE: [merkleProof(assetLeaves, 2), merkleProof(assetLeaves, 3)] as [Hex[], Hex[]],
  };

  const spendLimits = [
    { token: s.token0, maximumAmount: s.cap0 },
    { token: s.token1, maximumAmount: s.cap1 },
  ];
  const spendLimitsHash = keccak256(encodeAbiParameters(
    [{ type: 'tuple[]', components: [{ type: 'address' }, { type: 'uint256' }] }],
    [spendLimits.map(l => [l.token, l.maximumAmount] as const)],
  ));
  const outputTokens = [s.token0, s.token1];
  const outputTokensHash = keccak256(encodeAbiParameters([{ type: 'address[]' }], [outputTokens]));
  const rewardTokensHash = keccak256(encodeAbiParameters([{ type: 'address[]' }], [[]]));

  return {
    configBytes, configHash, permissionId, capabilityRoot, assetRoot,
    callProof, approvalProof, spendLimits, spendLimitsHash, outputTokens, outputTokensHash, rewardTokensHash,
  };
}

/** ActionPolicy tuple in contract field order, owner run only, no fees. */
export function defaultPolicy(d: DerivedStrategy) {
  return {
    enabled: true,
    agentAllowed: false,
    cooldown: 0n,
    expiresAt: 0n,
    budgetWindow: 0n,
    maxExecutionsPerWindow: 0,
    maxNativeValue: 0n,
    spendLimitsHash: d.spendLimitsHash,
    outputTokensHash: d.outputTokensHash,
    rewardTokensHash: d.rewardTokensHash,
    performanceFeeBps: 0,
    rewardMode: 0,
    bountyToken: '0x0000000000000000000000000000000000000000' as Address,
    bountyAmount: 0n,
  } as const;
}

export function encodeMintData(d: DerivedStrategy, s: StrategyInputs, amount0: bigint, amount1: bigint, deadline: bigint): Hex {
  return encodeAbiParameters(
    [{
      type: 'tuple', components: [
        { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' },
        { type: 'uint128' }, { type: 'uint256' },
        { type: 'tuple', components: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
        { type: 'bytes32[]' }, { type: 'bytes32[]' }, { type: 'bytes32[]' },
      ],
    }],
    [[
      amount0, amount1, 0n, 0n, 1n, deadline,
      [s.cap0, s.window0, s.cap1, s.window1],
      d.approvalProof.MINT[0], d.approvalProof.MINT[1], d.callProof.MINT,
    ]],
  );
}

export function encodeDecreaseData(d: DerivedStrategy, tokenId: bigint, liquidity: bigint, deadline: bigint): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ type: 'uint256' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes32[]' }] }],
    [[tokenId, liquidity, 0n, 0n, deadline, d.callProof.DECREASE]],
  );
}

export function encodeCollectData(d: DerivedStrategy, tokenId: bigint): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ type: 'uint256' }, { type: 'uint128' }, { type: 'uint128' }, { type: 'bytes32[]' }] }],
    [[tokenId, MAX_UINT128, MAX_UINT128, d.callProof.COLLECT]],
  );
}

export function encodeBurnData(d: DerivedStrategy, tokenId: bigint): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [{ type: 'uint256' }, { type: 'bytes32[]' }] }],
    [[tokenId, d.callProof.BURN]],
  );
}

// ── Minimal ABIs ─────────────────────────────────────────────────────────────

export const FACTORY_ABI = [
  { type: 'function', name: 'accountOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'predictAccount', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'createAccount', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const PERMISSION_TUPLE = [
  { name: 'adapter', type: 'address' }, { name: 'adapterCodeHash', type: 'bytes32' },
  { name: 'strategyId', type: 'bytes32' }, { name: 'configHash', type: 'bytes32' },
  { name: 'capabilityRoot', type: 'bytes32' }, { name: 'assetRoot', type: 'bytes32' },
  { name: 'positionCommitment', type: 'bytes32' }, { name: 'capabilityEpoch', type: 'uint64' },
  { name: 'enabled', type: 'bool' },
] as const;

const POLICY_TUPLE = [
  { name: 'enabled', type: 'bool' }, { name: 'agentAllowed', type: 'bool' },
  { name: 'cooldown', type: 'uint64' }, { name: 'expiresAt', type: 'uint64' },
  { name: 'budgetWindow', type: 'uint64' }, { name: 'maxExecutionsPerWindow', type: 'uint32' },
  { name: 'maxNativeValue', type: 'uint256' }, { name: 'spendLimitsHash', type: 'bytes32' },
  { name: 'outputTokensHash', type: 'bytes32' }, { name: 'rewardTokensHash', type: 'bytes32' },
  { name: 'performanceFeeBps', type: 'uint16' }, { name: 'rewardMode', type: 'uint8' },
  { name: 'bountyToken', type: 'address' }, { name: 'bountyAmount', type: 'uint256' },
] as const;

export const ACCOUNT_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'automationPaused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'setAutomationPaused', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  { type: 'function', name: 'permissions', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: PERMISSION_TUPLE },
  { type: 'function', name: 'setPermission', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'tuple', components: PERMISSION_TUPLE }, { type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'setActionPolicy', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'tuple', components: POLICY_TUPLE }], outputs: [] },
  { type: 'function', name: 'actionPolicies', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }], outputs: POLICY_TUPLE },
  { type: 'function', name: 'fundAndReserve', stateMutability: 'payable', inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'reserved', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'actionStates', stateMutability: 'view', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }], outputs: [{ type: 'uint64' }, { type: 'uint64' }, { type: 'uint32' }, { type: 'uint64' }] },
  { type: 'function', name: 'executePermission', stateMutability: 'nonpayable', inputs: [
    { type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'uint64' },
    { type: 'tuple[]', components: [{ name: 'token', type: 'address' }, { name: 'maximumAmount', type: 'uint256' }] },
    { type: 'address[]' }, { type: 'address[]' },
  ], outputs: [{ type: 'bytes' }] },
  { type: 'function', name: 'releaseReservation', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }, { type: 'bool' }], outputs: [] },
  { type: 'function', name: 'moveReservation', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'disablePermission', stateMutability: 'nonpayable', inputs: [{ type: 'bytes32' }], outputs: [] },
  { type: 'event', name: 'PositionAssigned', inputs: [
    { name: 'permissionId', type: 'bytes32', indexed: true },
    { name: 'collection', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ] },
] as const;

export const REGISTRY_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'releaseKey', stateMutability: 'pure', inputs: [{ type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'releases', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'bool' }, { type: 'bool' }, { type: 'bytes32' }] },
  { type: 'function', name: 'pendingReleases', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint64' }, { type: 'bytes32' }] },
  { type: 'function', name: 'scheduleRelease', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }, { type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'activateRelease', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }], outputs: [] },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const UNI_FACTORY_ABI = [
  { type: 'function', name: 'getPool', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }], outputs: [{ type: 'address' }] },
] as const;

export const POOL_ABI = [
  { type: 'function', name: 'tickSpacing', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { type: 'function', name: 'slot0', stateMutability: 'view', inputs: [], outputs: [
    { type: 'uint160' }, { type: 'int24' }, { type: 'uint16' }, { type: 'uint16' }, { type: 'uint16' },
    { type: 'uint8' }, { type: 'bool' },
  ] },
] as const;

/** Tick bounds for a symmetric range of plus minus `pct` percent around `tick`. */
export function rangeTicks(tick: number, pct: number, spacing: number): { tickLower: number; tickUpper: number } {
  if (pct <= 0) {
    return { tickLower: Math.ceil(-887272 / spacing) * spacing, tickUpper: Math.floor(887272 / spacing) * spacing };
  }
  const delta = Math.round(Math.log(1 + pct / 100) / Math.log(1.0001));
  let tickLower = Math.floor((tick - delta) / spacing) * spacing;
  let tickUpper = Math.ceil((tick + delta) / spacing) * spacing;
  tickLower = Math.max(tickLower, Math.ceil(-887272 / spacing) * spacing);
  tickUpper = Math.min(tickUpper, Math.floor(887272 / spacing) * spacing);
  if (tickLower >= tickUpper) tickUpper = tickLower + spacing;
  return { tickLower, tickUpper };
}

export const NPM_ABI = [
  { type: 'function', name: 'positions', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [
    { type: 'uint96' }, { type: 'address' }, { type: 'address' }, { type: 'address' }, { type: 'uint24' },
    { type: 'int24' }, { type: 'int24' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' },
    { type: 'uint128' }, { type: 'uint128' },
  ] },
  { type: 'function', name: 'collect', stateMutability: 'nonpayable', inputs: [
    { type: 'tuple', components: [
      { name: 'tokenId', type: 'uint256' }, { name: 'recipient', type: 'address' },
      { name: 'amount0Max', type: 'uint128' }, { name: 'amount1Max', type: 'uint128' },
    ] },
  ], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const;

export const MAX_UINT128 = (1n << 128n) - 1n;

// ── Position display math (floating point, for UI only) ──────────────────────

/** Price of token0 in token1 units at a tick, adjusted for decimals. */
export function tickToPrice(tick: number, dec0: number, dec1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1);
}

export function sqrtPriceToPrice(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const s = Number(sqrtPriceX96) / 2 ** 96;
  return s * s * Math.pow(10, dec0 - dec1);
}

/** Current token amounts inside a position, in raw base units. */
export function positionAmounts(liquidity: bigint, sqrtPriceX96: bigint, tickLower: number, tickUpper: number): [number, number] {
  const l = Number(liquidity);
  const sp = Number(sqrtPriceX96) / 2 ** 96;
  const sl = Math.pow(1.0001, tickLower / 2);
  const su = Math.pow(1.0001, tickUpper / 2);
  if (sp <= sl) return [l * (1 / sl - 1 / su), 0];
  if (sp >= su) return [0, l * (su - sl)];
  return [l * (1 / sp - 1 / su), l * (sp - sl)];
}

// ── Local strategy persistence (hashes must match across sessions) ───────────

export interface StoredStrategy {
  pool: Address; token0: Address; token1: Address; fee: number;
  tickLower: number; tickUpper: number;
  /** Symmetric range width in percent; 0 means full range. */
  rangePct: number;
  cap0: string; cap1: string; window0: string; window1: string;
  tokenIds: string[];
}

export function loadStrategy(account: Address): StoredStrategy | null {
  try {
    const raw = localStorage.getItem(`btb-studio-${BTB_CHAIN_ID}-${account.toLowerCase()}`);
    return raw ? JSON.parse(raw) as StoredStrategy : null;
  } catch { return null; }
}

export function saveStrategy(account: Address, s: StoredStrategy): void {
  localStorage.setItem(`btb-studio-${BTB_CHAIN_ID}-${account.toLowerCase()}`, JSON.stringify(s));
}

export function clearStrategy(account: Address): void {
  localStorage.removeItem(`btb-studio-${BTB_CHAIN_ID}-${account.toLowerCase()}`);
}

// ── Portfolio view: read-only snapshot of the studio strategy's LP positions ─

export interface StudioLpPosition {
  id: bigint;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  fees0: bigint;
  fees1: bigint;
}

export interface StudioLpSnapshot {
  account: Address;
  strategy: StoredStrategy;
  sym0: string;
  sym1: string;
  dec0: number;
  dec1: number;
  currentTick: number;
  sqrtPriceX96: bigint;
  positions: StudioLpPosition[];
}

/** Minimal client surface shared by wagmi's viem public clients. */
interface ReadClient {
  readContract(args: unknown): Promise<unknown>;
  simulateContract(args: unknown): Promise<{ result: unknown }>;
}

/** Loads the connected owner's studio LP positions for the portfolio view. */
export async function fetchStudioLp(client: ReadClient, owner: Address): Promise<StudioLpSnapshot | null> {
  const read = (args: unknown) => client.readContract(args);
  const account = await read({
    address: BTB_V2.accountFactory, abi: FACTORY_ABI, functionName: 'predictAccount', args: [owner],
  }) as Address;
  const strategy = loadStrategy(account);
  if (!strategy || strategy.tokenIds.length === 0) return null;

  const [slot0, sym0, sym1, dec0, dec1] = await Promise.all([
    read({ address: strategy.pool, abi: POOL_ABI, functionName: 'slot0' }) as Promise<readonly [bigint, number, ...unknown[]]>,
    read({ address: strategy.token0, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
    read({ address: strategy.token1, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
    read({ address: strategy.token0, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
    read({ address: strategy.token1, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
  ]);

  const positions = (await Promise.all(strategy.tokenIds.map(async id => {
    const p = await read({
      address: BTB_V2.positionManager, abi: NPM_ABI, functionName: 'positions', args: [BigInt(id)],
    }).catch(() => null) as readonly unknown[] | null;
    if (!p) return null;
    let fees0 = p[10] as bigint; let fees1 = p[11] as bigint;
    try {
      const sim = await client.simulateContract({
        address: BTB_V2.positionManager, abi: NPM_ABI, functionName: 'collect',
        args: [{ tokenId: BigInt(id), recipient: account, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
        account,
      });
      [fees0, fees1] = sim.result as readonly [bigint, bigint];
    } catch { /* tokensOwed fallback */ }
    return {
      id: BigInt(id), liquidity: p[7] as bigint,
      tickLower: p[5] as number, tickUpper: p[6] as number, fees0, fees1,
    };
  }))).filter((p): p is StudioLpPosition => p !== null);

  if (positions.length === 0) return null;
  return { account, strategy, sym0, sym1, dec0, dec1, currentTick: slot0[1], sqrtPriceX96: slot0[0], positions };
}
