"use node";

// The one job that needs Node: web-push signs and encrypts notifications with
// Node crypto. Everything else about alerts runs in the default Convex runtime
// (64 MiB instead of 512); this action only starts when a position actually
// changes range, so the Node cost is per real event, not per checker tick.

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import webpush from "web-push";

/** Push one message to every device the wallet registered. Dead subscriptions are dropped. */
export const sendPush = internalAction({
  args: { address: v.string(), title: v.string(), body: v.string(), url: v.string() },
  handler: async (ctx, { address, title, body, url }) => {
    const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@btb.finance", pub, priv);
    const subs = await ctx.runQuery(internal.alerts.subscriptionsFor, { address });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url }), { TTL: 3600 });
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await ctx.runMutation(internal.alerts.dropSubscription, { endpoint: s.endpoint });
      }
    }
  },
});
