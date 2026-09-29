// Static stand-in for the app shell, rendered into the HTML so a visitor sees
// the app's frame on first paint instead of a blank page while the wallet stack
// and the shell download. No hooks and no wallet imports: it must render on the
// server. Desktop shows the top nav outline, phones the bottom nav outline
// (the switch lives in globals.css, same 768px breakpoint as SidebarContext).
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
        <div className="btb-skeleton-block" style={{ height: 34, width: '40%' }}/>
        <div className="btb-skeleton-block" style={{ height: 180 }}/>
        <div className="btb-skeleton-block" style={{ height: 260 }}/>
      </div>
      <div className="btb-skeleton-bottom">
        <div className="btb-skeleton-pill" style={{ width: '100%' }}/>
      </div>
    </div>
  );
}
