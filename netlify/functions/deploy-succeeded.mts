/**
 * Runs after every successful Netlify deploy (an event-triggered function: the file name is the event).
 *
 * Cloudflare keeps copies of btb.finance's pages near visitors. Each deploy deletes the previous build's JavaScript
 * files on Netlify, so a page copy from before the deploy could point at files that no longer exist. Clearing
 * Cloudflare's cache right after the deploy makes every visitor get the new page and its files.
 *
 * Needs CLOUDFLARE_PURGE_TOKEN (a Cloudflare API token with Zone > Cache Purge on btb.finance, plus Zone > Zone > Read
 * when CLOUDFLARE_ZONE_ID is not set). Without the token it does nothing.
 */
const ZONE_NAME = 'btb.finance';

export default async (req: Request): Promise<Response> => {
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  if (!token) return new Response('no token, skipped');
  const context = await req.json().then((b: { payload?: { context?: string } }) => b?.payload?.context).catch(() => undefined);
  if (context && context !== 'production') return new Response(`skipped ${context} deploy`);

  const cf = (path: string, init?: RequestInit) =>
    fetch(`https://api.cloudflare.com/client/v4${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    }).then((r) => r.json() as Promise<{ success: boolean; result?: unknown; errors?: unknown[] }>);

  let zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!zone) {
    const z = await cf(`/zones?name=${ZONE_NAME}`);
    zone = (z.result as { id: string }[] | undefined)?.[0]?.id;
    if (!zone) {
      console.error('[purge] zone not found', JSON.stringify(z.errors ?? null));
      return new Response('zone not found', { status: 500 });
    }
  }
  // Everything: pages and the files they load stay from the same deploy.
  const r = await cf(`/zones/${zone}/purge_cache`, { method: 'POST', body: JSON.stringify({ purge_everything: true }) });
  if (!r.success) {
    console.error('[purge] failed', JSON.stringify(r.errors ?? null));
    return new Response('purge failed', { status: 500 });
  }
  console.log('[purge] Cloudflare cache cleared after deploy');
  return new Response('purged');
};
