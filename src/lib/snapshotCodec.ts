import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

/**
 * The Discover snapshot is one Convex document, and Convex caps a document at
 * 1 MiB. With 900 pools plus logos it sits right at that line, so it is
 * stored gzip-compressed and base64-encoded with a `gz:` prefix. Older plain
 * JSON rows still decode.
 *
 * Packing uses fflate (pure JavaScript) rather than Node's zlib, so the
 * Convex actions that write the snapshot run in the default Convex runtime
 * (64 MiB) instead of Node (512 MiB). The bytes are standard gzip, so rows
 * written by the old zlib code and the browser's DecompressionStream reader
 * stay compatible both ways.
 */
const PREFIX = 'gz:';

function isPacked(s: string): boolean { return s.startsWith(PREFIX); }

// btoa/atob work on "binary strings"; go through them in chunks so a
// megabyte snapshot never hits the argument limit of String.fromCharCode.
function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Convex actions (any runtime). */
export async function packSnapshot(value: unknown): Promise<string> {
  return PREFIX + toBase64(gzipSync(strToU8(JSON.stringify(value)), { level: 9 }));
}

/** Convex actions (any runtime). */
export async function unpackSnapshotNode<T>(s: string): Promise<T> {
  if (!isPacked(s)) return JSON.parse(s) as T;
  return JSON.parse(strFromU8(gunzipSync(fromBase64(s.slice(PREFIX.length))))) as T;
}

/** Browser: DecompressionStream is in every current browser; plain JSON passes through. */
export async function unpackSnapshotBrowser<T>(s: string): Promise<T> {
  if (!isPacked(s)) return JSON.parse(s) as T;
  const bytes = fromBase64(s.slice(PREFIX.length));
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as T;
}
