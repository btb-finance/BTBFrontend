export function Card({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 ${glow ? 'glow-primary' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full bg-gradient-to-b from-primary to-primary-dark" />
      <h2 className="text-xs font-bold text-text-secondary uppercase tracking-widest">{children}</h2>
    </div>
  )
}

export function StatRow({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-border last:border-0">
      <span className="text-text-secondary text-[13px]">{label}</span>
      <div className="text-right flex items-baseline gap-1.5">
        <span className={`font-semibold text-[13px] ${highlight ? 'text-gradient' : ''}`}>{value}</span>
        {sub && <span className="text-text-muted text-[11px]">{sub}</span>}
      </div>
    </div>
  )
}

export function StatGrid({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-bg/50 rounded-xl p-3 border border-border">
          <div className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1">{item.label}</div>
          <div className="font-bold text-sm">{item.value}</div>
          {item.sub && <div className="text-text-muted text-[10px] mt-0.5">{item.sub}</div>}
        </div>
      ))}
    </div>
  )
}
