import type { PublicClient } from 'viem';

const robinhoodClients = new WeakMap<object, PublicClient>();
const ROBINHOOD_READ_CONCURRENCY = 2;
const RETRY_DELAYS_MS = [300, 900, 1_800] as const;

function isTransientRpcError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|too many requests|408|timeout|timed out|failed to fetch|network|502|503|504/i.test(message);
}

async function readWithRetry(
  client: PublicClient,
  contract: Parameters<PublicClient['readContract']>[0],
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.readContract(contract);
    } catch (error) {
      if (!isTransientRpcError(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    () => worker(),
  ));
  return results;
}

/**
 * Multicall3 IS live on Robinhood Chain at the canonical 0xcA11…CA11 address
 * (verified on-chain: real fee()/slot0() reads return through aggregate3), so
 * viem's native batching works once the chain declares it — one POST per
 * batch instead of one request per read. This wrapper keeps a safety net:
 * if a client's chain can't batch, it fans the reads out with bounded
 * concurrency and transient-error retries rather than failing the whole batch.
 */
export function withSafeMulticall(client: PublicClient): PublicClient {
  if (client.chain?.id !== 4663) return client;

  const cached = robinhoodClients.get(client);
  if (cached) return cached;

  const wrapped = new Proxy(client, {
    get(target, property, receiver) {
      if (property !== 'multicall') return Reflect.get(target, property, receiver);

      return async (parameters: Parameters<PublicClient['multicall']>[0]) => {
        const contracts = parameters.contracts as readonly Parameters<PublicClient['readContract']>[0][];
        const allowFailure = parameters.allowFailure ?? true;
        const fanOut = () => mapWithConcurrency(contracts, ROBINHOOD_READ_CONCURRENCY, async (contract) => {
          if (!allowFailure) return readWithRetry(target, contract);
          try {
            return { status: 'success' as const, result: await readWithRetry(target, contract) };
          } catch (error) {
            return { status: 'failure' as const, error };
          }
        });

        try {
          // Native Multicall3 batching through the chain contract, with
          // transient-error retries on the whole batch.
          for (let attempt = 0; ; attempt++) {
            try {
              return await target.multicall(parameters);
            } catch (error) {
              if (!isTransientRpcError(error) || attempt >= RETRY_DELAYS_MS.length) throw error;
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
            }
          }
        } catch (error) {
          if (isTransientRpcError(error)) throw error;
          // Chain/client genuinely without batching support — fall back.
          return fanOut();
        }
      };
    },
  }) as PublicClient;

  robinhoodClients.set(client, wrapped);
  return wrapped;
}
