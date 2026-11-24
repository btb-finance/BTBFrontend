'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Tool { name: string; title: string; description: string; readOnly: boolean; group: string; inputSchema: unknown }
interface Schema { properties?: Record<string, { type?: string | string[]; description?: string; enum?: unknown[]; default?: unknown }>; required?: string[] }

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const box = { width: '100%', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#F2F2F5', fontFamily: mono, fontSize: 13, padding: '12px 14px' };

/** Example arguments from the schema: required fields only, with defaults or a typed placeholder. */
function exampleArgs(schema: unknown): Record<string, unknown> {
  const s = (schema ?? {}) as Schema;
  const out: Record<string, unknown> = {};
  for (const k of s.required ?? []) {
    const p = s.properties?.[k] ?? {};
    const t = Array.isArray(p.type) ? p.type[0] : p.type;
    out[k] = p.default ?? p.enum?.[0] ?? (t === 'number' || t === 'integer' ? 0 : t === 'boolean' ? false : t === 'array' ? [] : '');
  }
  return out;
}

let nextId = 1;
async function rpc(method: string, params: unknown) {
  const res = await fetch('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const raw = await res.text();
  const line = raw.split('\n').find((l) => l.startsWith('data:'));
  return JSON.parse(line ? line.slice(5) : raw);
}

/** Tool results come back as text blocks holding JSON; show them parsed and indented when they are. */
function pretty(result: unknown): string {
  const r = result as { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: unknown };
  if (r.error) return JSON.stringify(r.error, null, 2);
  const blocks = r.result?.content ?? [];
  return blocks.map((b) => {
    if (b.type !== 'text' || !b.text) return JSON.stringify(b, null, 2);
    try { return JSON.stringify(JSON.parse(b.text), null, 2); } catch { return b.text; }
  }).join('\n\n') || JSON.stringify(result, null, 2);
}

export function Playground({ tools }: { tools: Tool[] }) {
  const params = useSearchParams();
  const initial = tools.find((t) => t.name === params.get('tool')) ?? tools.find((t) => t.name === 'top_pools') ?? tools[0];
  const initialArgs = (() => {
    const a = params.get('args');
    if (a && initial?.name === params.get('tool')) { try { return JSON.stringify(JSON.parse(a), null, 2); } catch { /* fall through */ } }
    return JSON.stringify(exampleArgs(initial?.inputSchema), null, 2);
  })();
  const [name, setName] = useState(initial?.name ?? '');
  const [args, setArgs] = useState(initialArgs);
  const [out, setOut] = useState('');
  const [state, setState] = useState<'idle' | 'running' | 'error' | 'ok'>('idle');
  const [ms, setMs] = useState(0);
  const tool = useMemo(() => tools.find((t) => t.name === name), [tools, name]);
  const schema = (tool?.inputSchema ?? {}) as Schema;

  const pick = (n: string) => {
    setName(n);
    setArgs(JSON.stringify(exampleArgs(tools.find((t) => t.name === n)?.inputSchema), null, 2));
    setOut(''); setState('idle');
    const u = new URL(window.location.href);
    u.searchParams.set('tool', n); u.searchParams.delete('args');
    window.history.replaceState(null, '', u);
  };

  const run = async () => {
    let parsed: unknown;
    try { parsed = JSON.parse(args || '{}'); } catch { setState('error'); setOut('Arguments are not valid JSON.'); return; }
    setState('running'); setOut('');
    const t0 = performance.now();
    try {
      const r = await rpc('tools/call', { name, arguments: parsed });
      setMs(Math.round(performance.now() - t0));
      setState(r.error || r.result?.isError ? 'error' : 'ok');
      setOut(pretty(r));
    } catch (e) {
      setState('error'); setOut(e instanceof Error ? e.message : String(e));
    }
  };

  const groups = [...new Set(tools.map((t) => t.group))];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
      <div>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(242,242,245,0.7)' }} htmlFor="pg-tool">Tool</label>
        <select id="pg-tool" value={name} onChange={(e) => pick(e.target.value)} style={{ ...box, fontFamily: 'inherit', margin: '6px 0 10px' }}>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {tools.filter((t) => t.group === g).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </optgroup>
          ))}
        </select>
        {tool && <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(242,242,245,0.72)', margin: '0 0 12px' }}>
          {!tool.readOnly && <strong style={{ color: '#F5C46B' }}>Builds unsigned transactions. </strong>}{tool.description}
        </p>}
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(242,242,245,0.7)' }} htmlFor="pg-args">Arguments (JSON)</label>
        <textarea id="pg-args" value={args} onChange={(e) => setArgs(e.target.value)} rows={10} spellCheck={false}
          style={{ ...box, margin: '6px 0 10px', resize: 'vertical' }}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run(); }} />
        <button type="button" onClick={() => void run()} disabled={state === 'running'}
          style={{ border: 0, borderRadius: 12, padding: '11px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', color: '#06130D', background: 'linear-gradient(135deg, #52E3A4, #1aad77)', opacity: state === 'running' ? 0.6 : 1 }}>
          {state === 'running' ? 'Running…' : 'Run tool'}
        </button>
        {schema.properties && Object.keys(schema.properties).length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'rgba(242,242,245,0.72)' }}>Arguments this tool takes</summary>
            <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.5, color: 'rgba(242,242,245,0.72)' }}>
              {Object.entries(schema.properties).map(([k, p]) => (
                <li key={k} style={{ marginBottom: 6 }}>
                  <code style={{ fontFamily: mono, color: '#F2F2F5' }}>{k}</code>
                  {(schema.required ?? []).includes(k) ? <span style={{ color: '#52E3A4' }}> required</span> : null}
                  {p.description ? ` — ${p.description}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(242,242,245,0.7)', margin: '0 0 6px' }}>
          Result{state === 'ok' || state === 'error' ? ` · ${ms} ms` : ''}{state === 'error' ? ' · error' : ''}
        </p>
        <pre aria-live="polite" style={{ ...box, margin: 0, minHeight: 260, maxHeight: '70vh', overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', borderColor: state === 'error' ? 'rgba(255,107,107,0.5)' : 'rgba(255,255,255,0.12)' }}>
          {out || (state === 'running' ? 'Calling the server…' : 'Run a tool to see the response here.')}
        </pre>
      </div>
    </div>
  );
}
