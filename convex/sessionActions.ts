import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { verifyMessage, isAddress } from "viem";
import { alertAuthMessage, SESSION_ACTION, SESSION_TTL_MS, SIGNATURE_MAX_AGE_MS } from "./alertMessages";

/**
 * Open a session: the wallet signs once, the server hands back a random token.
 * Anything that reads a wallet's private data or spends its BTB balance takes
 * that token instead of trusting an address the caller typed.
 */
export const startSession = action({
  args: { address: v.string(), issuedAt: v.float64(), signature: v.string() },
  handler: async (ctx, a): Promise<{ ok: true; token: string; expiresAt: number } | { ok: false; reason: string }> => {
    if (!isAddress(a.address)) return { ok: false, reason: "Invalid wallet address." };
    if (Math.abs(Date.now() - a.issuedAt) > SIGNATURE_MAX_AGE_MS) return { ok: false, reason: "Signature expired, try again." };
    const ok = await verifyMessage({ address: a.address as `0x${string}`, message: alertAuthMessage(a.address, SESSION_ACTION, a.issuedAt), signature: a.signature as `0x${string}` }).catch(() => false);
    if (!ok) return { ok: false, reason: "Signature did not verify." };
    // 32 random bytes from Web Crypto, hex: available in the default runtime, no Node needed.
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await ctx.runMutation(internal.sessions.create, { token, address: a.address, expiresAt });
    return { ok: true, token, expiresAt };
  },
});
