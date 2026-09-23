// Shared by the Convex actions and the browser, so the signed text is
// byte-identical on both sides. No Convex functions live here.

/** Price of one fast position read, in BTB. */
export const FAST_CHECK_BTB = 1;
/** Free alerts are read this often; fast ones every checker tick. */
export const FREE_CHECK_MS = 60 * 60_000;
/** A pasted deposit transaction older than this is refused. */
export const DEPOSIT_MAX_AGE_MS = 24 * 60 * 60_000;
/** A signature older than this is refused. */
export const SIGNATURE_MAX_AGE_MS = 10 * 60_000;

/** Text signed to turn fast checks on or to move a weekly reward into the alert balance. */
export function alertAuthMessage(wallet: string, action: string, issuedAt: number): string {
  return `BTB Finance\n\n${action}\n\nWallet: ${wallet.toLowerCase()}\nIssued: ${new Date(issuedAt).toISOString()}`;
}

export const FAST_ON_ACTION = `Turn on fast range checks, ${FAST_CHECK_BTB} BTB per check.`;
export const rewardsToAlertsAction = (payoutId: string) => `Move weekly reward ${payoutId} into my alert balance.`;
