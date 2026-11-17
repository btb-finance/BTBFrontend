export const maxDuration = 15;
export const dynamic = 'force-dynamic';

// Same fallback as Providers.tsx — keep in sync.
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'https://grateful-oyster-780.convex.cloud';
const STORAGE_PREFIX = `${CONVEX_URL}/api/storage/`;

/**
 * One chain's Discover pool file (gzip), passed through from Convex storage and kept on Netlify's CDN. Each file URL is
 * unique to one version (a refresh writes a new file), so the edge can keep it for a day. Only our own deployment's
 * storage URLs are fetched, so this is not an open proxy.
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  if (!u.startsWith(STORAGE_PREFIX)) return new Response('Bad file', { status: 400, headers: { 'cache-control': 'no-store' } });
  try {
    const upstream = await fetch(u);
    if (!upstream.ok || !upstream.body) return new Response('File unavailable', { status: 502, headers: { 'cache-control': 'no-store' } });
    return new Response(upstream.body, {
      headers: {
        'content-type': 'application/octet-stream',
        'cache-control': 'public, max-age=3600, immutable',
        'netlify-cdn-cache-control': 'public, s-maxage=86400, durable',
      },
    });
  } catch {
    return new Response('File unavailable', { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
