'use client';
import { ReactNode, useState } from 'react';
import { Icon } from './Icon';
import { btb } from './design-tokens';
import { Spinner } from './Spinner';
import { useGrowingList } from '../lib/useGrowingList';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  width?: string;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  /** Draw this many rows at first and more as the table scrolls; sorting still covers every row. */
  pageSize?: number;
  /**
   * Rows sharing a key show as one: the first in the current sort leads, and a toggle in its first cell opens the
   * rest under it. Sorting and paging then count groups, not rows.
   */
  groupBy?: (row: T) => string;
}

export function DataTable<T>({
  columns, rows, rowKey, loading, emptyMessage = 'No data', onRowClick,
  defaultSortKey, defaultSortDir = 'desc', pageSize, groupBy,
}: DataTableProps<T>) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);

  function toggleSort(col: Column<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('desc'); }
  }

  const sortCol = columns.find(c => c.key === sortKey);
  const sortedRows = sortCol?.sortValue
    ? [...rows].sort((a, b) => {
        const av = sortCol.sortValue!(a);
        const bv = sortCol.sortValue!(b);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;
  // Groups in sorted order: a group sits where its best row would, and that row leads it.
  const groups: { key: string; rows: T[] }[] = [];
  if (groupBy) {
    const at = new Map<string, number>();
    for (const row of sortedRows) {
      const k = groupBy(row);
      const i = at.get(k);
      if (i == null) { at.set(k, groups.length); groups.push({ key: k, rows: [row] }); } else groups[i].rows.push(row);
    }
  } else {
    for (const row of sortedRows) groups.push({ key: rowKey(row), rows: [row] });
  }
  const page = useGrowingList(groups.length, pageSize ?? Number.MAX_SAFE_INTEGER);
  const shownGroups = pageSize ? groups.slice(0, page.count) : groups;
  const toggle = (k: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k); return next; });

  const renderRow = (row: T, opts: { group?: { key: string; more: number; open: boolean }; child?: boolean }) => (
    <tr
      key={rowKey(row)}
      onClick={() => onRowClick?.(row)}
      style={{
        cursor: onRowClick ? 'pointer' : 'default',
        transition: 'background 0.12s',
        background: opts.child ? 'rgba(var(--fg-rgb), 0.025)' : 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--fg-rgb), 0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = opts.child ? 'rgba(var(--fg-rgb), 0.025)' : 'transparent')}
    >
      {columns.map((col, ci) => (
        <td
          key={col.key}
          style={{
            textAlign: col.align === 'right' ? 'right' : 'left',
            padding: ci === 0 && opts.child ? '10px 16px 10px 40px' : opts.child ? '10px 16px' : '12px 16px',
            fontSize: 13.5,
            color: btb.text,
            borderBottom: '1px solid rgba(var(--fg-rgb), 0.04)',
          }}
        >
          {ci === 0 && opts.group && opts.group.more > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>{col.render(row)}</div>
              <button type="button" aria-expanded={opts.group.open} onClick={(e) => { e.stopPropagation(); toggle(opts.group!.key); }}
                title={opts.group.open ? 'Hide the other pools' : `${opts.group.more} more pool${opts.group.more === 1 ? '' : 's'} for this pair`}
                style={{ flexShrink: 0, height: 24, padding: '0 8px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4,
                  border: opts.group.open ? '1px solid rgba(var(--green-rgb), 0.45)' : '1px solid rgba(var(--fg-rgb), 0.12)',
                  background: opts.group.open ? 'rgba(var(--green-rgb), 0.15)' : 'rgba(var(--fg-rgb), 0.05)', color: opts.group.open ? btb.text : btb.textMuted }}>
                +{opts.group.more}
                <Icon name={opts.group.open ? 'up' : 'down'} size={10} color={btb.textMuted}/>
              </button>
            </div>
          ) : col.render(row)}
        </td>
      ))}
    </tr>
  );

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                style={{
                  textAlign: col.align === 'right' ? 'right' : 'left',
                  padding: '10px 16px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: btb.textMuted,
                  borderBottom: btb.borderSoft,
                  whiteSpace: 'nowrap',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  width: col.width,
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4, color: btb.text }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center' }}>
                <Spinner size={22} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.18)" />
              </td>
            </tr>
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: btb.textMuted, fontSize: 13.5 }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            shownGroups.flatMap(g => {
              const isOpen = open.has(g.key);
              const lead = renderRow(g.rows[0], { group: { key: g.key, more: g.rows.length - 1, open: isOpen } });
              return isOpen ? [lead, ...g.rows.slice(1).map(r => renderRow(r, { child: true }))] : [lead];
            })
          )}
        </tbody>
      </table>
      {pageSize && page.left > 0 && (
        <div ref={page.sentinel} style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
          <button type="button" onClick={page.more} style={{ height: 34, padding: '0 16px', borderRadius: 999, border: btb.borderSoft, background: 'transparent', color: btb.textMuted, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Show more ({page.left.toLocaleString('en-US')} left)
          </button>
        </div>
      )}
    </div>
  );
}
