import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Page not found | BTB Finance', robots: { index: false } };

/**
 * App-wide 404. It renders outside the app shell, so the chain theme
 * variables are not set here: the page carries its own palette, dark by
 * default and light when the device prefers it.
 */
export default function NotFound() {
  return (
    <main className="nf">
      <style>{`
        .nf{--ink:255,255,255;--paper:#0A0A0F;--green:#52E3A4;--green-rgb:82,227,164;--amber-rgb:255,179,107;
          min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 20px;background:
          radial-gradient(600px 300px at 50% 20%,rgba(var(--green-rgb),.10),transparent 70%),var(--paper);color:rgb(var(--ink))}
        @media (prefers-color-scheme: light){.nf{--ink:14,16,24;--paper:#E8EAF0;--green:#0E9A66;--green-rgb:14,154,102;--amber-rgb:184,96,10}}
        .nf-card{width:100%;max-width:460px;text-align:center}
        .nf-strip{position:relative;height:44px;margin:0 auto 28px;max-width:300px;border-radius:12px;background:rgba(var(--ink),.05);overflow:hidden}
        .nf-band{position:absolute;top:0;bottom:0;left:22%;width:40%;background:rgba(var(--green-rgb),.16);border-left:1px solid rgba(var(--green-rgb),.45);border-right:1px solid rgba(var(--green-rgb),.45)}
        .nf-dot{position:absolute;top:50%;left:84%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:999px;background:rgb(var(--amber-rgb));box-shadow:0 0 0 4px rgba(var(--amber-rgb),.22);animation:nf-drift 3.2s ease-in-out infinite}
        @keyframes nf-drift{0%,100%{transform:translateX(0)}50%{transform:translateX(10px)}}
        @media (prefers-reduced-motion: reduce){.nf-dot{animation:none}}
        .nf-code{font-size:12px;font-weight:800;letter-spacing:.14em;color:rgba(var(--ink),.45)}
        .nf-title{margin:8px 0 0;font-size:28px;font-weight:800;letter-spacing:-.6px;line-height:1.15}
        .nf-text{margin:10px auto 0;max-width:360px;font-size:14.5px;line-height:1.55;color:rgba(var(--ink),.62)}
        .nf-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:26px}
        .nf-btn{height:40px;padding:0 18px;border-radius:999px;display:inline-flex;align-items:center;font-size:13.5px;font-weight:800;text-decoration:none;
          color:rgb(var(--ink));border:1px solid rgba(var(--ink),.12);background:rgba(var(--ink),.04);transition:background .15s,border-color .15s}
        .nf-btn:hover{background:rgba(var(--ink),.08)}
        .nf-btn.primary{color:var(--green);border-color:rgba(var(--green-rgb),.45);background:rgba(var(--green-rgb),.14)}
        .nf-btn.primary:hover{background:rgba(var(--green-rgb),.22)}
        .nf-btn:focus-visible{outline:2px solid rgba(var(--green-rgb),.6);outline-offset:2px}
      `}</style>
      <div className="nf-card">
        {/* A range strip with the price drifted out of it: this page is out of range. */}
        <div className="nf-strip" aria-hidden="true"><div className="nf-band"/><div className="nf-dot"/></div>
        <div className="nf-code">404</div>
        <h1 className="nf-title">This page is out of range</h1>
        <p className="nf-text">The link may be old or mistyped. Nothing is wrong with your wallet or your positions.</p>
        <nav className="nf-actions" aria-label="Where to go">
          <a className="nf-btn primary" href="/discover">Discover pools</a>
          <a className="nf-btn" href="/portfolio">Portfolio</a>
          <a className="nf-btn" href="/">Home</a>
        </nav>
      </div>
    </main>
  );
}
