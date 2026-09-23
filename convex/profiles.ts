import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Multi-wallet profiles. Linking needs two signatures (see profilesActions.ts):
 * one from the wallet already in the profile and one from the wallet being
 * added, so nobody can attach an address they do not control and nobody can
 * attach their address to a stranger's profile.
 */

/** The row that makes `address` a member of a profile: signed links only, never a watched import. */
async function ownedLink(ctx: { db: any }, address: string) {
  const rows = await ctx.db.query("profileLinks").withIndex("by_address", (q: any) => q.eq("address", address)).collect();
  return rows.find((r: any) => !r.watched) ?? null;
}

export const forAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const me = address.toLowerCase();
    const link = await ownedLink(ctx, me);
    if (!link) return { profileId: me, wallets: [{ address: me, label: undefined as string | undefined, linkedAt: 0, watched: false }] };
    const rows = await ctx.db.query("profileLinks").withIndex("by_profile", q => q.eq("profileId", link.profileId)).collect();
    rows.sort((a, b) => a.linkedAt - b.linkedAt);
    return { profileId: link.profileId, wallets: rows.map(r => ({ address: r.address, label: r.label, linkedAt: r.linkedAt, watched: !!r.watched })) };
  },
});

/** Called by the verified link action only. Merges profiles when both wallets already have one. */
export const insertLink = internalMutation({
  args: { anchor: v.string(), address: v.string() },
  handler: async (ctx, { anchor, address }) => {
    const a = anchor.toLowerCase();
    const b = address.toLowerCase();
    if (a === b) return;
    const now = Date.now();
    const anchorLink = await ownedLink(ctx, a);
    const profileId = anchorLink?.profileId ?? a;
    if (!anchorLink) await ctx.db.insert("profileLinks", { address: a, profileId, linkedAt: now });
    // A watched import of the same address in this profile is upgraded in place.
    const watchedHere = (await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", b)).collect()).find(r => r.watched && r.profileId === profileId);
    if (watchedHere) await ctx.db.delete(watchedHere._id);
    const existing = await ownedLink(ctx, b);
    if (!existing) {
      await ctx.db.insert("profileLinks", { address: b, profileId, linkedAt: now, ...(watchedHere?.label ? { label: watchedHere.label } : {}) });
      return;
    }
    if (existing.profileId === profileId) return;
    // The new wallet already belongs to another profile: fold that whole profile in.
    const others = await ctx.db.query("profileLinks").withIndex("by_profile", q => q.eq("profileId", existing.profileId)).collect();
    for (const row of others) await ctx.db.patch(row._id, { profileId });
  },
});

export const removeLink = internalMutation({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const row = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", address.toLowerCase())).unique();
    if (row) await ctx.db.delete(row._id);
  },
});

export const setLabel = mutation({
  args: { address: v.string(), label: v.string() },
  handler: async (ctx, { address, label }) => {
    const row = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", address.toLowerCase())).unique();
    if (row) await ctx.db.patch(row._id, { label: label.trim().slice(0, 32) || undefined });
  },
});

export const forAddressInternal = internalQuery({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const me = address.toLowerCase();
    const link = await ownedLink(ctx, me);
    if (!link) return { profileId: me, wallets: [{ address: me }] };
    const rows = await ctx.db.query("profileLinks").withIndex("by_profile", q => q.eq("profileId", link.profileId)).collect();
    return { profileId: link.profileId, wallets: rows.map(r => ({ address: r.address })) };
  },
});

/** Called by the verified import action only: adds a view-only wallet to the signer's profile. */
export const insertWatched = internalMutation({
  args: { anchor: v.string(), address: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, { anchor, address, label }) => {
    const a = anchor.toLowerCase();
    const b = address.toLowerCase();
    if (a === b) return;
    const now = Date.now();
    const anchorLink = await ownedLink(ctx, a);
    const profileId = anchorLink?.profileId ?? a;
    if (!anchorLink) await ctx.db.insert("profileLinks", { address: a, profileId, linkedAt: now });
    const rows = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", b)).collect();
    if (rows.some(r => r.profileId === profileId)) return;
    await ctx.db.insert("profileLinks", { address: b, profileId, linkedAt: now, watched: true, label: label?.trim().slice(0, 32) || undefined });
  },
});

export const removeFromProfile = internalMutation({
  args: { profileId: v.string(), address: v.string() },
  handler: async (ctx, { profileId, address }) => {
    const rows = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", address.toLowerCase())).collect();
    for (const r of rows) if (r.profileId === profileId) await ctx.db.delete(r._id);
  },
});

/**
 * Profiles that imported `address` as view-only, which it can join. A view-only
 * import never makes the wallet a member on its own (anyone can import any
 * address); the wallet itself signing to join is what does.
 */
export const invitesFor = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const me = address.toLowerCase();
    const rows = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", me)).collect();
    const member = rows.find(r => !r.watched)?.profileId;
    return rows.filter(r => r.watched && r.profileId !== member).map(r => ({ profileId: r.profileId, label: r.label }));
  },
});

export const isWatchedIn = internalQuery({
  args: { address: v.string(), profileId: v.string() },
  handler: async (ctx, { address, profileId }) => {
    const rows = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", address.toLowerCase())).collect();
    return rows.some(r => r.watched && r.profileId === profileId.toLowerCase());
  },
});
