// Static stand-in for the app shell, rendered into the HTML so a visitor sees
// the app's frame on first paint instead of a blank page while the wallet stack
// and the shell download. No hooks and no wallet imports: it must render on the
// server. Desktop shows the top nav outline, phones the bottom nav outline
// (the switch lives in globals.css, same 768px breakpoint as SidebarContext).
// The first block is a small ad that cycles through these lines in CSS alone, so
// server and client render the same markup.
const AD_LINES: [string, string][] = [
  ['Getting paid daily', 'Your liquidity earns fees around the clock.'],
  ['BTB is your friend', 'Pools, swaps and rewards in one place.'],
  ['Out of range? Not for long', 'Auto rebalance keeps your position earning.'],
  ['Friday is payday', 'Weekly BTB rewards for everyone who shows up.'],
];

// What the page is doing while this shows, one after another at these offsets
// (seconds); the last stays until the app replaces the skeleton.
const STEPS: [string, number][] = [
  ['Loading BTB', 0],
  ['Setting up your wallet connection', 0.9],
  ['Connecting to networks', 2],
  ['Almost ready', 3.4],
];

export function AppSkeleton() {
  return (
    <div className="btb-skeleton" aria-busy="true" aria-label="Loading BTB Finance">
      <div className="btb-skeleton-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/btblogo.jpg" alt="" width={30} height={30}/>
        <div className="btb-skeleton-pill" style={{ width: 'min(520px, 50vw)' }}/>
        <div className="btb-skeleton-pill" style={{ width: 132 }}/>
      </div>
      <div className="btb-skeleton-body">
        <div className="btb-skeleton-status" role="status">
          <span className="btb-skeleton-status-dot"/>
          <span className="btb-skeleton-status-text">
            {STEPS.map(([label, at], i) => {
              const last = i === STEPS.length - 1;
              return (
                <span key={label} className={last ? 'btb-skeleton-step btb-skeleton-step-last' : 'btb-skeleton-step'}
                  style={{ animationDelay: `${at}s`, animationDuration: last ? '0.3s' : `${STEPS[i + 1][1] - at}s` }}>
                  {label}
                </span>
              );
            })}
          </span>
        </div>
        <div className="btb-skeleton-ad">
          {AD_LINES.map(([title, line], i) => (
            <div key={title} className="btb-skeleton-ad-line" style={{ animationDelay: `${i * 3.5}s` }}>
              <div className="btb-skeleton-ad-title">{title}</div>
              <div className="btb-skeleton-ad-sub">{line}</div>
            </div>
          ))}
          <div className="btb-skeleton-ad-bar"/>
        </div>
        <div className="btb-skeleton-block" style={{ height: 260 }}/>
      </div>
      <div className="btb-skeleton-bottom">
        <div className="btb-skeleton-pill" style={{ width: '100%' }}/>
      </div>
    </div>
  );
}
