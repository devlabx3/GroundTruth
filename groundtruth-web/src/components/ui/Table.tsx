import type { ReactNode } from 'react';
import EmptyState from './EmptyState';

/**
 * Tabla base. El caller pasa los headers YA traducidos (la tabla no conoce
 * namespaces de i18n). Genérica en la fila: `render` recibe la fila con su tipo,
 * así una columna no puede leer un campo que la fila no tiene.
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  mono?: boolean;
  align?: 'left' | 'right';
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined | null;
  rowKey?: string;
  onRowClick?: (row: T) => void;
  emptyTitle?: ReactNode;
  emptyAction?: ReactNode;
}

export default function Table<T extends object>({
  columns,
  rows,
  rowKey = 'id',
  onRowClick,
  emptyTitle,
  emptyAction,
}: TableProps<T>) {
  if (!rows?.length) return <EmptyState title={emptyTitle} action={emptyAction} />;
  // Acceso por clave dinámica: el camino con tipos es `render`, que sí conoce T.
  const cell = (row: T, key: string) => (row as Record<string, unknown>)[key] as ReactNode;
  return (
    <div className="overflow-x-auto rounded-card border border-porcelain-border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-porcelain-border text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-2.5 text-xs font-medium text-graphite ${
                  c.align === 'right' ? 'text-right' : ''
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={String(cell(row, rowKey))}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-porcelain-border/60 last:border-0 ${
                onRowClick ? 'cursor-pointer hover:bg-porcelain' : ''
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-4 py-3 text-ink ${c.mono ? 'font-mono text-xs' : ''} ${
                    c.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {c.render ? c.render(row) : cell(row, c.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
