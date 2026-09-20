/**
 * The Discover snapshot is one Convex document, and Convex caps a document at
 * 1 MiB. With 900 pools plus logos it sits right at that line, so it is
 * stored gzip-compressed and base64-encoded with a `gz:` prefix. Older plain
 * JSON rows still decode.
 */
const PREFIX = 'gz:';

export function isPacked(s: string): boolean { return s.startsWith(PREFIX); }

/** Node only (Convex actions). */
export async function packSnapshot(value: unknown): Promise<string> {
  const { gzipSync } = await import('zlib');
  return PREFIX + gzipSync(Buffer.from(JSON.stringify(value), 'utf8'), { level: 9 }).toString('base64');
}

/** Node only. */
export async function unpackSnapshotNode<T>(s: string): Promise<T> {
  if (!isPacked(s)) return JSON.parse(s) as T;
  const { gunzipSync } = await import('zlib');
  return JSON.parse(gunzipSync(Buffer.from(s.slice(PREFIX.length), 'base64')).toString('utf8')) as T;
}

/** Browser: DecompressionStream is in every current browser; plain JSON passes through. */
export async function unpackSnapshotBrowser<T>(s: string): Promise<T> {
  if (!isPacked(s)) return JSON.parse(s) as T;
  const bin = atob(s.slice(PREFIX.length));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as T;
}
