import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { verifyMessage, isAddress, createPublicClient, fallback, http } from "viem";
import { CHAIN_RPC_URLS } from "../src/lib/chainRpc";
import { ROBINHOOD_RPC_UPSTREAMS } from "../src/lib/robinhoodRpc";
import { alertAuthMessage, SESSION_ACTION, SESSION_TTL_MS, SIGNATURE_MAX_AGE_MS } from "./alertMessages";

/**
 * Open a session: the wallet signs once, the server hands back a random token.
 * Anything that reads a wallet's private data or spends its BTB balance takes
 * that token instead of trusting an address the caller typed.
 */
export const startSession = action({
  // chainId: where a smart account (a Safe) lives, so its signature can be checked on chain.
  args: { address: v.string(), issuedAt: v.float64(), signature: v.string(), chainId: v.optional(v.float64()) },
  handler: async (ctx, a): Promise<{ ok: true; token: string; expiresAt: number } | { ok: false; reason: string }> => {
    if (!isAddress(a.address)) return { ok: false, reason: "Invalid wallet address." };
    const message = alertAuthMessage(a.address, SESSION_ACTION, a.issuedAt);
    // A normal wallet: plain ECDSA. A Safe (or any smart account): ERC-1271 on its own chain.
    let ok = await verifyMessage({ address: a.address as `0x${string}`, message, signature: a.signature as `0x${string}` }).catch(() => false);
    let smartAccount = false;
    if (!ok && a.chainId) {
      const urls = a.chainId === 4663 ? ROBINHOOD_RPC_UPSTREAMS : CHAIN_RPC_URLS[a.chainId];
      if (urls?.length) {
        const client = createPublicClient({ transport: fallback(urls.slice(0, 4).map((u) => http(u, { timeout: 10_000 }))) });
        ok = await client.verifyMessage({ address: a.address as `0x${string}`, message, signature: a.signature as `0x${string}` }).catch(() => false);
        smartAccount = ok;
      }
    }
    if (!ok) return { ok: false, reason: "Signature did not verify." };
    // Co-owners of a multi-owner Safe can take a while to sign, so its message may be up to a day old.
    const maxAge = smartAccount ? 24 * 3600_000 : SIGNATURE_MAX_AGE_MS;
    if (Math.abs(Date.now() - a.issuedAt) > maxAge) return { ok: false, reason: "Signature expired, try again." };
    // 32 random bytes from Web Crypto, hex: available in the default runtime, no Node needed.
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    await ctx.runMutation(internal.sessions.create, { token, address: a.address, expiresAt });
    return { ok: true, token, expiresAt };
  },
});
