import { isAddress } from 'viem';
import { KYBER_CHAINS } from '@/lib/kyberswap';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AMOUNT = /^\d+$/;
// Cross-chain routes can contain a source-chain swap and a destination fill.
// A 0.5% floor was too tight between quote construction and wallet simulation,
// especially for small routes into newer Robinhood Chain markets.
const BRIDGE_SLIPPAGE = '0.03';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }

  const fromChain = Number(body.fromChain);
  const toChain = Number(body.toChain);
  const fromToken = String(body.fromToken ?? '').toLowerCase();
  const toToken = String(body.toToken ?? '').toLowerCase();
  const fromAmount = String(body.fromAmount ?? '');
  const wallet = String(body.wallet ?? '');
  if (!KYBER_CHAINS[fromChain] || !KYBER_CHAINS[toChain] || fromChain === toChain) {
    return Response.json({ error: 'Choose two different supported networks' }, { status: 400 });
  }
  if ((!isAddress(fromToken) && fromToken !== ZERO_ADDRESS) || (!isAddress(toToken) && toToken !== ZERO_ADDRESS) || !isAddress(wallet) || !AMOUNT.test(fromAmount) || BigInt(fromAmount) <= 0n) {
    return Response.json({ error: 'Invalid token, wallet, or amount' }, { status: 400 });
  }

  const integrator = process.env.LIFI_INTEGRATOR?.trim() || 'btb-finance';
  const configuredFee = Number(process.env.LIFI_FEE ?? 0);
  const btbFee = Number.isFinite(configuredFee) && configuredFee > 0 && configuredFee < 1 ? configuredFee : 0;
  const params = new URLSearchParams({
    fromChain: String(fromChain), toChain: String(toChain), fromToken, toToken,
    fromAmount, fromAddress: wallet, toAddress: wallet,
    slippage: BRIDGE_SLIPPAGE, order: 'FASTEST', integrator,
  });
  if (btbFee > 0) params.set('fee', String(btbFee));

  try {
    const response = await fetch(`https://li.quest/v1/quote?${params}`, {
      cache: 'no-store', signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = `No bridge route (${response.status})`;
      try { const parsed = JSON.parse(text) as { message?: string }; if (parsed.message) message = parsed.message; } catch { /* use fallback */ }
      return Response.json({ error: message }, { status: response.status });
    }
    const quote = JSON.parse(text) as Record<string, unknown>;
    return Response.json({ quote, btbFeePercent: btbFee * 100 }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Bridge routing is temporarily unavailable' }, { status: 502 });
  }
}
