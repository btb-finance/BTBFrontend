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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "23 Sep 2026, 08:36 UTC". Built from UTC fields, not toLocaleString, so the
 * browser and the server always produce the same text for the signature. */
function signedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/**
 * Text a wallet signs to approve a BTB balance action. Shown in the wallet,
 * so it reads as a plain note: what the user is agreeing to, and that
 * signing is not a transaction. Signed by the client and rebuilt byte for
 * byte by the server to verify.
 */
export function alertAuthMessage(wallet: string, action: string, issuedAt: number): string {
  return [
    'BTB Finance',
    '',
    action,
    '',
    'This is a signature, not a transaction. It costs no gas and cannot move your funds.',
    '',
    `Wallet: ${wallet.toLowerCase()}`,
    `Signed: ${signedAt(issuedAt)}`,
  ].join('\n');
}

export const FAST_ON_ACTION = [
  'Turn on fast range alerts',
  '',
  `Your positions will be checked every 5 minutes instead of every hour. Each check uses ${FAST_CHECK_BTB} BTB from your BTB balance in the app, then your unclaimed weekly rewards. You can turn it off any time.`,
].join('\n');
/** Price of one agent message past the free daily ones, in BTB. */
export const AGENT_MESSAGE_BTB = 1;
/** Agent messages a wallet gets free each UTC day. */
export const AGENT_FREE_PER_DAY = 5;
/** Text signed once to open an agent session. */
export const SESSION_ACTION = [
  'Sign in to BTB Finance',
  '',
  'The BTB Agent gives you 5 free messages every day; after that each message uses 1 BTB. Auto-rebalance uses 1 BTB per check and a set price per rebalance. All of it comes from your BTB balance in the app.',
  '',
  'This keeps your chat and settings private to your wallet and lasts 30 days on this device.',
].join('\n');
/** How long an agent session lasts. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
