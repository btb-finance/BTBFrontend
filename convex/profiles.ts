import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Multi-wallet profiles. Linking needs two signatures (see profilesActions.ts):
 * one from the wallet already in the profile and one from the wallet being
 * added, so nobody can attach an address they do not control and nobody can
 * attach their address to a stranger's profile.
 */

export const forAddress = query({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    const me = address.toLowerCase();
    const link = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", me)).unique();
    if (!link) return { profileId: me, wallets: [{ address: me, label: undefined as string | undefined, linkedAt: 0 }] };
    const rows = await ctx.db.query("profileLinks").withIndex("by_profile", q => q.eq("profileId", link.profileId)).collect();
    rows.sort((a, b) => a.linkedAt - b.linkedAt);
    return { profileId: link.profileId, wallets: rows.map(r => ({ address: r.address, label: r.label, linkedAt: r.linkedAt })) };
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
    const anchorLink = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", a)).unique();
    const profileId = anchorLink?.profileId ?? a;
    if (!anchorLink) await ctx.db.insert("profileLinks", { address: a, profileId, linkedAt: now });
    const existing = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", b)).unique();
    if (!existing) {
      await ctx.db.insert("profileLinks", { address: b, profileId, linkedAt: now });
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
    const link = await ctx.db.query("profileLinks").withIndex("by_address", q => q.eq("address", me)).unique();
    if (!link) return { profileId: me, wallets: [{ address: me }] };
    const rows = await ctx.db.query("profileLinks").withIndex("by_profile", q => q.eq("profileId", link.profileId)).collect();
    return { profileId: link.profileId, wallets: rows.map(r => ({ address: r.address })) };
  },
});
