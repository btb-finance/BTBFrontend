"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { verifyMessage, isAddress } from "viem";

/** Ten minutes: long enough to switch accounts in a wallet, short enough that a leaked signature is useless. */
const MAX_AGE_MS = 10 * 60 * 1000;

/** The exact text each wallet signs. Shared with the frontend (src/lib/profile.ts). */
export function linkMessage(wallet: string, other: string, issuedAt: number): string {
  return `BTB Finance\n\nLink this wallet to my profile.\n\nWallet: ${wallet}\nWith: ${other}\nIssued: ${new Date(issuedAt).toISOString()}`;
}

async function checkSignature(wallet: string, other: string, issuedAt: number, signature: `0x${string}`) {
  if (!isAddress(wallet) || !isAddress(other)) throw new Error("Invalid address");
  if (Math.abs(Date.now() - issuedAt) > MAX_AGE_MS) throw new Error("Signature expired, start again");
  const ok = await verifyMessage({ address: wallet as `0x${string}`, message: linkMessage(wallet, other, issuedAt), signature });
  if (!ok) throw new Error(`Signature from ${wallet.slice(0, 6)}… did not verify`);
}

export const link = action({
  args: {
    anchor: v.string(), anchorSignature: v.string(), anchorIssuedAt: v.float64(),
    address: v.string(), addressSignature: v.string(), addressIssuedAt: v.float64(),
  },
  handler: async (ctx, a) => {
    if (a.anchor.toLowerCase() === a.address.toLowerCase()) throw new Error("That is the same wallet");
    await checkSignature(a.anchor, a.address, a.anchorIssuedAt, a.anchorSignature as `0x${string}`);
    await checkSignature(a.address, a.anchor, a.addressIssuedAt, a.addressSignature as `0x${string}`);
    await ctx.runMutation(internal.profiles.insertLink, { anchor: a.anchor, address: a.address });
    return { ok: true };
  },
});

/** Import a wallet by address, view only. One signature from the connected wallet. */
export const importWallet = action({
  args: { signer: v.string(), signature: v.string(), issuedAt: v.float64(), address: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (a.signer.toLowerCase() === a.address.toLowerCase()) throw new Error("That is the connected wallet");
    await checkSignature(a.signer, a.address, a.issuedAt, a.signature as `0x${string}`);
    await ctx.runMutation(internal.profiles.insertWatched, { anchor: a.signer, address: a.address, label: a.label });
    return { ok: true };
  },
});

/** Remove a wallet from the signer's profile. One signature from the connected wallet. */
export const unlink = action({
  args: { signer: v.string(), signature: v.string(), issuedAt: v.float64(), address: v.string() },
  handler: async (ctx, a) => {
    await checkSignature(a.signer, a.address, a.issuedAt, a.signature as `0x${string}`);
    const profile = await ctx.runQuery(internal.profiles.forAddressInternal, { address: a.signer });
    if (!profile.wallets.some(w => w.address === a.address.toLowerCase())) throw new Error("Wallet is not in your profile");
    await ctx.runMutation(internal.profiles.removeFromProfile, { profileId: profile.profileId, address: a.address });
    return { ok: true };
  },
});

/**
 * A wallet that was imported view-only joins that profile as a full member.
 * The profile owner already signed to import it; this is the wallet's own
 * signature, so both sides have agreed, as with link.
 */
export const joinProfile = action({
  args: { address: v.string(), profileId: v.string(), signature: v.string(), issuedAt: v.float64() },
  handler: async (ctx, a) => {
    await checkSignature(a.address, a.profileId, a.issuedAt, a.signature as `0x${string}`);
    if (!(await ctx.runQuery(internal.profiles.isWatchedIn, { address: a.address, profileId: a.profileId }))) throw new Error("This wallet was not added to that profile");
    await ctx.runMutation(internal.profiles.insertLink, { anchor: a.profileId, address: a.address });
    return { ok: true };
  },
});
