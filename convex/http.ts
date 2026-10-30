/**
 * HTTP endpoints. /checkin is the daily check-in: an HTTP action because only a request reaching Convex directly carries
 * the visitor's IP (cf-connecting-ip), which the multi-wallet rules need (convex/sybil.ts). The IP is never stored, only
 * a salted hash of it and of its network.
 */
import { httpRouter } from "convex/server";
import { isAddress } from "viem";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { humanCheck, runCheckIn } from "./checkInActions";

const ORIGINS = new Set(["https://btb.finance", "https://www.btb.finance", "http://localhost:3000"]);
const cors = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://btb.finance",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

/** Salted SHA-256, hex, so equal IPs can be matched without keeping the IP. */
async function hash(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${process.env.IP_SALT ?? "btb"}:${value}`);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
/** The network an IP sits in: an IPv4 /24 or an IPv6 /48. */
const networkOf = (ip: string) => (ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 3).join("."));
const clean = (s: unknown) => (typeof s === "string" && /^[A-Za-z0-9-]{8,64}$/.test(s) ? s : undefined);

const http = httpRouter();

http.route({ path: "/checkin", method: "OPTIONS", handler: httpAction(async (_ctx, req) => new Response(null, { status: 204, headers: cors(req) })) });

http.route({
  path: "/checkin",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json().catch(() => ({}))) as { walletAddress?: string; turnstileToken?: string; deviceId?: string; fpHash?: string };
    const wallet = body.walletAddress ?? "";
    if (!isAddress(wallet)) return json(req, { error: "Invalid wallet address" }, 400);
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    if (!(await humanCheck(body.turnstileToken, ip || undefined))) {
      return json(req, { error: "Could not confirm this browser. Refresh the page and check in again." }, 403);
    }
    try {
      const result = await runCheckIn(ctx, wallet);
      await ctx.runMutation(internal.sybil.recordSignal, {
        walletAddress: wallet,
        ipHash: ip ? await hash(ip) : undefined,
        netHash: ip ? await hash(networkOf(ip)) : undefined,
        deviceId: clean(body.deviceId),
        fpHash: clean(body.fpHash),
      });
      return json(req, result);
    } catch (e) {
      return json(req, { error: (e as Error).message }, 500);
    }
  }),
});

export default http;
