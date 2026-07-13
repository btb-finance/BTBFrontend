/**
 * Uniswap Trading API client (via the /api/uniswap proxy — the API key stays
 * server side). UNI.md Phases 1+2: CLASSIC (AMM) swaps as a second quote
 * source next to KyberSwap, plus UniswapX Dutch-auction orders (gasless for
 * the user, MEV protected, fillers pay gas).
 *
 * Rules followed here, from .agents/skills/swap-integration:
 * - chain ids are STRINGS in requests
 * - native ETH is the zero address (not Kyber's 0xeeee…)
 * - CLASSIC /swap body = quote spread in, permitData stripped when null
 * - UniswapX /swap body = quote spread in + signature, permitData EXCLUDED
 * - UniswapX output = orderInfo.outputs[0].startAmount (no quote.output)
 * - swap.data must be non-empty before broadcasting (empty = expired quote)
 * - quotes go stale in ~30s, so execution re-quotes with the real swapper
 */
import type { TypedDataDomain } from 'viem';
import type { Call } from './txRunner';

const NATIVE_UNI = '0x0000000000000000000000000000000000000000';
const X_ROUTINGS = new Set(['DUTCH_V2', 'DUTCH_V3', 'PRIORITY']);

/** Map this app's token addresses ('ETH' / 0xeeee… for native) to Trading API form. */
export function toUniAddress(address: string): string {
  const a = address.toLowerCase();
  return a === 'eth' || a === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? NATIVE_UNI : address;
}

// A 503 from the proxy means the key isn't configured. Back off instead of
// hammering, but re-check once a minute — the server may get its env var
// (e.g. a dev-server restart) without the page reloading.
let notConfiguredUntil = 0;

async function call<T>(endpoint: string, payload: unknown): Promise<T | null> {
  if (Date.now() < notConfiguredUntil) return null;
  try {
    const res = await fetch('/api/uniswap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, payload }),
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 503) { notConfiguredUntil = Date.now() + 60_000; return null; }
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

interface QuoteResponse {
  routing: string;
  quote: {
    // CLASSIC
    input?: { token: string; amount: string };
    output?: { token: string; amount: string };
    gasFeeUSD?: string;
    // UniswapX
    orderInfo?: { outputs?: { startAmount: string; endAmount: string }[] };
    encodedOrder?: string;
    orderHash?: string;
  };
  permitData?: { domain: TypedDataDomain; types: Record<string, { name: string; type: string }[]>; values: Record<string, unknown> } | null;
  permitTransaction?: unknown;
}

export interface UniQuote {
  routing: string;
  /** UniswapX best-case fill (startAmount) or CLASSIC output amount. */
  amountOut: bigint;
  gasFeeUSD: number | null;
  /** UniswapX order: user signs, fillers pay gas, MEV protected. */
  gasless: boolean;
}

export interface UniQuoteParams {
  tokenIn: string;   // app-form address ('ETH' allowed)
  tokenOut: string;
  amountIn: string;  // raw units
  swapper: string;
  slippagePct: number; // e.g. 0.5
}

function parseQuote(res: QuoteResponse | null): { parsed: UniQuote; raw: QuoteResponse } | null {
  if (!res?.routing || !res.quote) return null;
  if (res.routing === 'CLASSIC' && res.quote.output?.amount) {
    const gas = parseFloat(res.quote.gasFeeUSD ?? '');
    return {
      raw: res,
      parsed: { routing: res.routing, amountOut: BigInt(res.quote.output.amount), gasFeeUSD: isFinite(gas) ? gas : null, gasless: false },
    };
  }
  if (X_ROUTINGS.has(res.routing)) {
    const start = res.quote.orderInfo?.outputs?.[0]?.startAmount;
    if (!start || !res.quote.orderHash || !res.permitData) return null;
    return {
      raw: res,
      parsed: { routing: res.routing, amountOut: BigInt(start), gasFeeUSD: 0, gasless: true },
    };
  }
  return null; // WRAP/UNWRAP/BRIDGE etc. — not handled, Kyber covers those
}

async function fetchQuote(p: UniQuoteParams): Promise<{ parsed: UniQuote; raw: QuoteResponse } | null> {
  // UniswapX orders move the input via Permit2, which needs an ERC-20 —
  // native-ETH input stays on CLASSIC (AMM) routing.
  const nativeIn = toUniAddress(p.tokenIn) === NATIVE_UNI;
  const res = await call<QuoteResponse>('quote', {
    swapper: p.swapper,
    tokenIn: toUniAddress(p.tokenIn),
    tokenOut: toUniAddress(p.tokenOut),
    tokenInChainId: '1',
    tokenOutChainId: '1',
    amount: p.amountIn,
    type: 'EXACT_INPUT',
    slippageTolerance: p.slippagePct,
    routingPreference: 'BEST_PRICE',
    ...(nativeIn ? { protocols: ['V2', 'V3', 'V4'] } : {}),
  });
  return parseQuote(res);
}

/** Best Uniswap quote (CLASSIC or UniswapX), or null when unavailable/unconfigured. */
export async function getUniswapQuote(p: UniQuoteParams): Promise<UniQuote | null> {
  return (await fetchQuote(p))?.parsed ?? null;
}

/** The Permit2 approval tx for the input token, when one is still needed. */
async function approvalCalls(p: UniQuoteParams): Promise<Call[]> {
  if (toUniAddress(p.tokenIn) === NATIVE_UNI) return [];
  const appr = await call<{ approval?: { to: string; data: string; value?: string } | null }>('check_approval', {
    walletAddress: p.swapper,
    token: toUniAddress(p.tokenIn),
    amount: p.amountIn,
    chainId: 1,
  });
  if (!appr?.approval?.to || !appr.approval.data) return [];
  return [{
    to: appr.approval.to as `0x${string}`,
    data: appr.approval.data as `0x${string}`,
    value: BigInt(appr.approval.value ?? '0'),
  }];
}

export interface UniPermit {
  domain: TypedDataDomain;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export type UniExecutionPlan =
  | {
      kind: 'classic';
      approval: Call[];   // token → Permit2 approval, batched ahead of the swap tx
      /** Permit2 authorization to sign, when the quote carries one — the
       * signature AND permitData both go back to /swap (skill rule). */
      permit: UniPermit | null;
      raw: QuoteResponse;
    }
  | {
      kind: 'uniswapx';
      approval: Call[];   // run + confirm BEFORE signing (Permit2 allowance)
      permit: UniPermit;
      raw: QuoteResponse; // spread into /swap with the signature (permitData EXCLUDED)
      orderHash: `0x${string}`;
    };

function toPermit(permitData: NonNullable<QuoteResponse['permitData']>): UniPermit {
  const typeNames = Object.keys(permitData.types).filter(t => t !== 'EIP712Domain');
  const primaryType =
    typeNames.find(t => t === 'PermitWitnessTransferFrom' || t === 'PermitSingle') ?? typeNames[0];
  return { domain: permitData.domain, types: permitData.types, primaryType, message: permitData.values };
}

/**
 * Build everything needed to execute the swap. Re-quotes fresh with the real
 * swapper — a displayed quote is often >30s old by the time the user confirms.
 */
export async function prepareUniswapExecution(p: UniQuoteParams): Promise<UniExecutionPlan> {
  const q = await fetchQuote(p);
  if (!q) throw new Error('Uniswap quote unavailable');

  if (q.parsed.gasless) {
    return {
      kind: 'uniswapx',
      approval: await approvalCalls(p),
      permit: toPermit(q.raw.permitData!),
      raw: q.raw,
      orderHash: q.raw.quote.orderHash as `0x${string}`,
    };
  }

  return {
    kind: 'classic',
    approval: await approvalCalls(p),
    permit: q.raw.permitData ? toPermit(q.raw.permitData) : null,
    raw: q.raw,
  };
}

/**
 * Build the CLASSIC swap transaction via /swap. When the quote carried
 * permitData, the caller signs it first and passes the signature here — both
 * go in the body (both present or both absent, never permitData alone/null).
 */
export async function buildClassicSwapTx(raw: QuoteResponse, signature?: `0x${string}`): Promise<Call> {
  const { permitData, permitTransaction, ...cleanQuote } = raw;
  void permitTransaction;
  const body = signature && permitData ? { ...cleanQuote, signature, permitData } : cleanQuote;
  const swapRes = await call<{ swap?: { to: string; from: string; data: string; value?: string; gasLimit?: string } }>('swap', body);
  const swap = swapRes?.swap;
  if (!swap?.data || swap.data === '0x' || !/^0x[0-9a-fA-F]{40}$/.test(swap.to)) {
    throw new Error('Uniswap swap build failed — quote may have expired, try again');
  }
  return {
    to: swap.to as `0x${string}`,
    data: swap.data as `0x${string}`,
    value: BigInt(swap.value ?? '0'),
    gas: swap.gasLimit ? BigInt(swap.gasLimit) : undefined,
  };
}

/**
 * Submit a signed UniswapX order. Uniswap's skill and their docs disagree on
 * the endpoint (skill: /swap with the quote spread in and signature only;
 * docs: /order with a wrapped body), so try the skill's shape first and fall
 * back to the documented one.
 */
export async function submitUniswapXOrder(raw: QuoteResponse, signature: `0x${string}`): Promise<void> {
  const { permitData, permitTransaction, ...cleanQuote } = raw;
  void permitTransaction;
  const viaSwap = await call<Record<string, unknown>>('swap', { ...cleanQuote, signature });
  if (viaSwap) return;
  const viaOrder = await call<Record<string, unknown>>('order', {
    routing: raw.routing,
    quote: raw.quote,
    signature,
    permitData,
  });
  if (!viaOrder) throw new Error('Order submission failed — try again');
}

/**
 * Poll until the order leaves "open". UniswapX orders cost nothing on
 * failure — an expired order means no fill and no fees paid.
 */
export async function waitForOrderFill(
  orderHash: `0x${string}`,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ status: string; txHash?: `0x${string}` }> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const intervalMs = opts.intervalMs ?? 2_500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`/api/uniswap?orderId=${orderHash}`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json() as { orders?: { orderStatus?: string; txHash?: string; settledAmounts?: unknown }[] };
        const order = data.orders?.[0];
        const status = order?.orderStatus;
        if (status && status !== 'open') {
          return { status, txHash: order?.txHash as `0x${string}` | undefined };
        }
      }
    } catch { /* transient — keep polling until the deadline */ }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { status: 'timeout' };
}
