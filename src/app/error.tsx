'use client';

/**
 * Shown when a page throws, most often because the backend (Convex) did not answer. A plain message and a retry,
 * instead of the browser's "This page couldn't load".
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const backend = /convex|server error|disabled|failed to fetch|network/i.test(error?.message ?? '');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#0A0A0F', color: '#F2F2F5', fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>{backend ? 'BTB is having a short break' : 'Something went wrong'}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'rgba(242,242,245,0.75)', margin: '0 0 20px' }}>
          {backend
            ? 'Our servers are not answering right now. Your funds are safe: they stay in your own wallet and your own auto wallet. Please try again in a few minutes.'
            : 'This page hit an error. Your funds are not affected. Try again, or go back to the home page.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={() => reset()} style={{ height: 42, padding: '0 18px', borderRadius: 12, border: 0, background: 'linear-gradient(135deg,#52E3A4,#1aad77)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Try again</button>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', height: 42, padding: '0 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', color: '#F2F2F5', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Home</a>
        </div>
      </div>
    </div>
  );
}
