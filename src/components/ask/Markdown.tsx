import type { ReactNode } from 'react';

/**
 * The few formats the agent writes: paragraphs, "- " bullets, **bold** and [label](url) links. A line that holds only
 * links becomes buttons. Links go only to btb.finance (made relative, so a preview deploy stays on itself).
 */

export type Action = { label: string; href: string };

const LINK = /\[([^\]]{1,60})\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;

function safeHref(url: string): string | null {
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    // Keep the #fragment: a sign link's sealed plan lives there (btb.finance/sign#…).
    if (u.hostname === 'btb.finance' || u.hostname === 'www.btb.finance') return u.pathname + u.search + u.hash;
  } catch { /* not a URL */ }
  return null;
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index! > last) out.push(...bold(text.slice(last, m.index), `${key}-t${i}`));
    const href = safeHref(m[2]);
    out.push(href ? <a key={`${key}-a${i}`} href={href}>{m[1]}</a> : m[1]);
    last = m.index! + m[0].length;
    i++;
  }
  if (last < text.length) out.push(...bold(text.slice(last), `${key}-t${i}`));
  return out;
}

function bold(text: string, key: string): ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) => (i % 2 ? <strong key={`${key}-${i}`}>{part}</strong> : part));
}

/** Splits a reply into rendered text and the buttons found on link-only lines. */
export function renderReply(reply: string): { body: ReactNode; actions: Action[] } {
  const actions: Action[] = [];
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) { blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), `p${blocks.length}`)}</p>); para = []; }
    if (bullets.length) {
      const k = `u${blocks.length}`;
      blocks.push(<ul key={k}>{bullets.map((b, i) => <li key={i}>{inline(b, `${k}-${i}`)}</li>)}</ul>);
      bullets = [];
    }
  };
  for (const raw of reply.split('\n')) {
    let line = raw.trim();
    // Links closing a sentence ("... is $0.0000266. [Buy BTB](...)") are buttons too; the sentence stays as text.
    const tail = line.match(/(?:\s*\[[^\]]{1,60}\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\))+\s*$/);
    const linksOnly = line.replace(LINK, '').replace(/[|·,\s-]/g, '') === '';
    if (tail && tail.index! > 0 && !linksOnly) {
      for (const m of tail[0].matchAll(LINK)) {
        const href = safeHref(m[2]);
        if (href && !actions.some((a) => a.href === href)) actions.push({ label: m[1], href });
      }
      line = line.slice(0, tail.index).trim();
    }
    const links = [...line.matchAll(LINK)];
    // Only links (and separators like "|" or "·") on the line: buttons.
    if (links.length && line.replace(LINK, '').replace(/[|·,\s-]/g, '') === '') {
      for (const m of links) {
        const href = safeHref(m[2]);
        if (href && !actions.some((a) => a.href === href)) actions.push({ label: m[1], href });
      }
      continue;
    }
    if (!line) { flush(); continue; }
    if (/^[-*]\s+/.test(line)) { if (para.length) { const p = para; para = []; blocks.push(<p key={`p${blocks.length}`}>{inline(p.join(' '), `p${blocks.length}`)}</p>); } bullets.push(line.replace(/^[-*]\s+/, '')); continue; }
    if (bullets.length) flush();
    para.push(line.replace(/^#+\s*/, ''));
  }
  flush();
  return { body: blocks, actions: actions.slice(0, 4) };
}
