import type { ReactNode } from 'react';

/**
 * The /ask layout: sidebar (new chat, recent chats, links into the classic app), top bar, centred column. No hooks,
 * so the server can render it as the first paint before wallets load; AskApp fills in the live parts.
 */

const CLASSIC: { href: string; label: string; icon: IconName }[] = [
  { href: '/discover', label: 'Pools', icon: 'pools' },
  { href: '/swap', label: 'Swap', icon: 'swap' },
  { href: '/portfolio', label: 'Portfolio', icon: 'wallet' },
  { href: '/dashboard', label: 'Rewards', icon: 'gift' },
  { href: '/agents', label: 'API and MCP', icon: 'code' },
];

export function AskFrame({ children, chatList, footer, sideOpen = false, onOpenSide, onCloseSide, onNewChat }: {
  children?: ReactNode;
  chatList?: ReactNode[];
  footer?: ReactNode;
  sideOpen?: boolean;
  onOpenSide?: () => void;
  onCloseSide?: () => void;
  onNewChat?: () => void;
}) {
  return (
    <div className="ag">
      <div className={`ag-scrim${sideOpen ? ' open' : ''}`} onClick={onCloseSide}/>
      <aside className={`ag-side${sideOpen ? ' open' : ''}`} aria-label="Navigation">
        <a className="ag-brand" href="/ask">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/btblogo.jpg" alt="" width={26} height={26}/>
          BTB <small>AGENT</small>
        </a>
        <button type="button" className="ag-new" onClick={onNewChat}><Icon name="plus" size={14}/>New chat</button>

        {chatList && chatList.length > 0 && (
          <>
            <div className="ag-label">Recent</div>
            <div className="ag-chats">{chatList}</div>
          </>
        )}

        <div className="ag-label">Classic app</div>
        {CLASSIC.map((l) => (
          <a key={l.href} className="ag-item" href={l.href}><Icon name={l.icon}/><span>{l.label}</span></a>
        ))}

        <div className="ag-spacer"/>
        <div className="ag-foot">
          {footer ?? <div className="ag-row"><button type="button" className="ag-wallet primary" disabled>Connect wallet</button></div>}
        </div>
      </aside>

      <main className="ag-main">
        <header className="ag-top">
          <button type="button" className="ag-icon-btn ag-burger" onClick={onOpenSide} aria-label="Menu"><Icon name="menu"/></button>
          <h1>Ask</h1>
          <div className="ag-grow"/>
          <a className="ag-classic" href="/">Classic app</a>
        </header>
        <div className="ag-body">
          {children ?? (
            <div className="ag-hero">
              <h2>What do you want to do?</h2>
              <p>Ask in plain English. BTB finds pools, checks tokens, reads your positions and sets up swaps. You confirm everything in your own wallet.</p>
              <div className="ag-box"><textarea rows={1} placeholder="Tell BTB what you want to do" disabled aria-label="Ask BTB"/></div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

type IconName = 'plus' | 'up' | 'arrow' | 'check' | 'menu' | 'sun' | 'moon' | 'pools' | 'swap' | 'wallet' | 'gift' | 'code';

const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14"/>,
  up: <path d="M12 19V5M6 11l6-6 6 6"/>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>,
  pools: <><path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2-1.5 4.5-1.5S19 17 21 17"/><path d="M3 12c2 0 2-1.5 4.5-1.5S10 12 12 12s2-1.5 4.5-1.5S19 12 21 12"/></>,
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M16 12.5h2"/><path d="M3 9h18"/></>,
  gift: <><rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M12 9v11M3.5 13h17M12 9c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z"/></>,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>,
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
