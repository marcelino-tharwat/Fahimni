import { type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function Table<T>({ columns, data, emptyMessage = 'لا توجد بيانات' }: TableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-start">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-start font-cairo text-sm font-medium text-text-secondary"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-4 py-3 text-start font-cairo text-sm text-text-primary"
                >
                  {column.render
                    ? column.render(row)
                    : (row as unknown as Record<string, ReactNode>)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
