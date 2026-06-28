// PromoCodeTable — admin promo-code list (SCRUM-425, Phase 3B).
//
// Design decision: CUSTOM <table>, not the shared `Table` component.
// The shared Table (src/shared/components/ui/Table.tsx) hard-codes its row/cell
// styling (border-border, font-cairo text-sm cells), has no gray header band, no
// row hover, no per-cell styling (expired-date red, whitespace-nowrap, py-3.5),
// no skeleton loading rows, and routes the empty case through the bare EmptyState
// (title only). Matching the Figma design exactly requires all of those, so we
// build the table markup directly here.
//
// Date helpers (formatDate / formatDateTime) live in this file: the shared
// formatDate util doesn't handle null inputs or the date-time variant the
// "usedAt" column needs. The locale follows the active UI language so dates
// render with Arabic-Indic numerals + Arabic month names under `ar` and Latin
// equivalents under `en`.

import { Ticket, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/shared/components/ui/Badge';
import { cn } from '@/shared/lib/utils/cn';
import type { PromoCodeListItem } from '@/shared/types';
import { CodeChip } from './CodeChip';

interface PromoCodeTableProps {
  data: PromoCodeListItem[];
  isLoading: boolean;
  isEmpty: boolean;
  onCreateFirst: () => void;
}

type BadgeVariant = 'success' | 'danger' | 'default';

// Column header i18n keys (RTL order matches the Figma design).
const COLUMN_KEYS = [
  'code',
  'createdAt',
  'expiresAt',
  'status',
  'student',
  'usedAt',
] as const;

function isExpiredCode(item: PromoCodeListItem): boolean {
  return item.expiresAt !== null && new Date(item.expiresAt) < new Date();
}

function getStatusBadge(item: PromoCodeListItem): { labelKey: string; variant: BadgeVariant } {
  if (item.isUsed) return { labelKey: 'statusUsed', variant: 'success' };
  if (isExpiredCode(item)) return { labelKey: 'statusExpired', variant: 'danger' };
  return { labelKey: 'statusUnused', variant: 'default' };
}

function formatDate(isoDate: string | null, locale: string): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(isoDate: string | null, locale: string): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[110, 90, 90, 60, 80, 100].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3 animate-pulse rounded-full bg-gray-200" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export function PromoCodeTable({
  data,
  isLoading,
  isEmpty,
  onCreateFirst,
}: PromoCodeTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  if (isEmpty && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <Ticket size={52} className="text-gray-400" />
        <div>
          <p className="text-lg font-medium text-navy-800">{t('promoCodes.emptyTitle')}</p>
          <p className="mt-1 text-sm text-gray-600">{t('promoCodes.emptySubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onCreateFirst}
          className="flex h-11 items-center gap-2 rounded-xl bg-cyan-gradient px-5 text-sm font-semibold text-white shadow-glow transition-all duration-150 active:scale-[0.97]"
        >
          <Plus size={15} />
          {t('promoCodes.createFirst')}
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            {COLUMN_KEYS.map((key) => (
              <th
                key={key}
                className="whitespace-nowrap px-4 py-3 text-start text-xs font-medium text-gray-600"
              >
                {t(`promoCodes.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : data.map((item, i) => {
                const status = getStatusBadge(item);
                const expired = isExpiredCode(item);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-gray-100 transition-colors hover:bg-gray-50',
                      i === data.length - 1 && 'border-b-0',
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <CodeChip code={item.code} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">
                      {formatDate(item.createdAt, locale)}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-4 py-3.5',
                        expired ? 'font-semibold text-danger-500' : 'text-gray-600',
                      )}
                    >
                      {formatDate(item.expiresAt, locale)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <Badge variant={status.variant}>{t(`promoCodes.${status.labelKey}`)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-gray-500">
                      {item.usedByStudent?.fullName ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-500">
                      {formatDateTime(item.usedAt, locale)}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
