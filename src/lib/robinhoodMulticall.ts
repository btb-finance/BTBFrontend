import { decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';
import { robinhoodRpcFetch } from './robinhoodRpc';

/**
 * Server-side batched reads for Robinhood Chain.
 *
 * Plain single `eth_call`s against a rate-limited endpoint fail whole, so a
 * feed of 40 rows silently came back with every price and balance zeroed.
 * Multicall3 is deployed at the canonical address on this chain, so the same
 * 200 reads go out as a handful of single calls against the pooled RPCs.
 */

export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

const AGGREGATE3_ABI = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) view returns (Result[] returnData)',
]);

export type Call3 = { target: string; callData: string };
export type Call3Result = { success: boolean; data: string };

/** Gas ceiling per multicall — a quoter simulation is orders of magnitude
 *  heavier than a balance read, and the default estimate is not enough. */
const CALL_GAS = '0x5f5e100'; // 100M

async function callOnce(calls: Call3[]): Promise<Call3Result[]> {
  const data = encodeFunctionData({
    abi: AGGREGATE3_ABI,
    functionName: 'aggregate3',
    args: [calls.map(item => ({ target: item.target as `0x${string}`, allowFailure: true, callData: item.callData as `0x${string}` }))],
  });
  const response = await robinhoodRpcFetch(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: MULTICALL3, data, gas: CALL_GAS }, 'latest'] }),
    15_000,
  );
  if (!response.ok) throw new Error(`rpc ${response.status}`);
  const body = await response.json() as { result?: string; error?: { message?: string } };
  if (!body.result) throw new Error(body.error?.message ?? 'multicall failed');
  const decoded = decodeFunctionResult({ abi: AGGREGATE3_ABI, functionName: 'aggregate3', data: body.result as `0x${string}` });
  return (decoded as readonly { success: boolean; returnData: string }[]).map(item => ({ success: item.success, data: item.returnData }));
}

/**
 * Runs every call, chunked so no single simulation blows the gas ceiling.
 * A chunk that fails outright yields unsuccessful results for its calls rather
 * than throwing — callers treat a missing read as "not known yet".
 */
export async function aggregate3(calls: Call3[], chunkSize = 50): Promise<Call3Result[]> {
  const results: Call3Result[] = [];
  for (let index = 0; index < calls.length; index += chunkSize) {
    const chunk = calls.slice(index, index + chunkSize);
    try {
      results.push(...await callOnce(chunk));
    } catch {
      results.push(...chunk.map(() => ({ success: false, data: '0x' })));
    }
  }
  return results;
}
