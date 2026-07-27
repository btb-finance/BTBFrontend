/**
 * Turns a thrown value into a sentence a trader should read.
 *
 * Convex wraps a server throw in a developer-facing envelope — a box-drawn
 * rule, the function path, a request id, and the handler's file and line:
 *
 *   ────────────  [CONVEX A(spotTrade:prepare)] [Request ID: 1bb3ee…]
 *   Server Error  Uncaught Error: Minimum instant buy is $5
 *     at handler (../convex/spotTrade.ts:113:8)  Called by client
 *
 * The only part that belongs on screen is "Minimum instant buy is $5". Viem
 * does the same thing to revert reasons. This pulls the human sentence out of
 * either, and falls back rather than showing a stack trace or a bare id.
 */

// Failures that are real but say nothing a user can act on — a misconfigured
// agent key is our problem, not theirs.
const INTERNAL = [
  /agent (signing key|key does not match)/i,
  /AGENT_[A-Z_]+/,
  /is not configured/i,
];

function stripEnvelope(message: string): string {
  let text = message
    // Box drawing and other layout characters from the Convex banner.
    .replace(/[─-╿]+/g, ' ')
    .replace(/\[CONVEX[^\]]*\]/gi, ' ')
    .replace(/\[Request ID:[^\]]*\]/gi, ' ')
    .replace(/\bServer Error\b/gi, ' ')
    .replace(/\bCalled by client\b/gi, ' ');

  // Keep what follows the last "Error:" — nested wrappers stack them up.
  const lastError = text.lastIndexOf('Error:');
  if (lastError !== -1) text = text.slice(lastError + 'Error:'.length);

  // Everything from the first stack frame onwards is for us, not the user.
  text = text.split(/\s+at\s+\w+\s*\(/)[0];
  text = text.split(/\n\s*at\s/)[0];

  return text.replace(/\s+/g, ' ').trim();
}

export function readableError(reason: unknown, fallback: string): string {
  const raw = typeof reason === 'string'
    ? reason
    : (reason as { shortMessage?: string })?.shortMessage
      || (reason as Error)?.message
      || '';
  if (!raw) return fallback;

  const text = stripEnvelope(raw);
  if (!text) return fallback;
  // A leftover file path or an empty husk means the parse missed; do not guess.
  if (/\.(ts|tsx|js):\d+/.test(text) || text.length < 3) return fallback;
  if (INTERNAL.some(pattern => pattern.test(text))) return fallback;
  if (text.length > 180) return `${text.slice(0, 177)}…`;

  return text.endsWith('.') || text.endsWith('!') || text.endsWith('?') ? text : `${text}.`;
}
