'use client';
import { ReactNode, useState } from 'react';
import { btb } from './design-tokens';
import { Spinner } from './Spinner';

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
}

export function DataTable<T>({
  columns, rows, rowKey, loading, emptyMessage = 'No data', onRowClick,
  defaultSortKey, defaultSortDir = 'desc',
}: DataTableProps<T>) {
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
                <Spinner size={22} color="#fff" track="rgba(255,255,255,0.18)" />
              </td>
            </tr>
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px 16px', textAlign: 'center', color: btb.textMuted, fontSize: 13.5 }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map(row => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align === 'right' ? 'right' : 'left',
                      padding: '12px 16px',
                      fontSize: 13.5,
                      color: btb.text,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
