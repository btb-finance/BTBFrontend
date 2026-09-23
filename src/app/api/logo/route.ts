import { NextRequest } from 'next/server';

/**
 * Same-origin image proxy for token logos drawn onto the share card canvas.
 * Logo hosts rarely send CORS headers, and an image without them taints the
 * canvas so it cannot be exported. Only image responses from https hosts are
 * passed through, cached for a day.
 */
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src') ?? '';
  let url: URL;
  try { url = new URL(src); } catch { return new Response('bad src', { status: 400 }); }
  if (url.protocol !== 'https:') return new Response('https only', { status: 400 });
  // Public hostnames only. An IP literal or an internal name would let a
  // caller point this server at its own network.
  const host = url.hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[') || host === 'localhost' || /\.(local|internal|localhost|home|lan|corp)$/.test(host) || !host.includes('.')) {
    return new Response('bad host', { status: 400 });
  }
  if (url.username || url.password || (url.port && url.port !== '443')) return new Response('bad src', { status: 400 });
  try {
    // redirect: 'error' so a public host cannot bounce the fetch somewhere private.
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { accept: 'image/*' }, redirect: 'error' });
    const type = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !type.startsWith('image/')) return new Response('not an image', { status: 415 });
    if (Number(upstream.headers.get('content-length') ?? 0) > MAX_BYTES) return new Response('too large', { status: 413 });
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new Response('too large', { status: 413 });
    return new Response(buf, {
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400, s-maxage=86400',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502 });
  }
}
