import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, AlertCircle, ClipboardList, ChevronLeft } from 'lucide-react';
import { Spinner, Badge, EmptyState } from '@/shared/components/ui';
import { Pagination } from '../components/promo-codes';
import { useAdminTeacherRequests } from '@/features/admin/hooks/useAdminTeacherRequests';
import type { TeacherRequestStatus } from '@/features/admin/types/teacherRequests';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: (TeacherRequestStatus | 'ALL')[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

export const statusVariant: Record<TeacherRequestStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export function AdminTeacherRequestsPage() {
  const { t, i18n } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TeacherRequestStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useMemo(
    () => ({ page, limit: PAGE_SIZE, ...(q ? { q } : {}), ...(status !== 'ALL' ? { status } : {}) }),
    [page, q, status],
  );
  const { data, isLoading, isError, refetch, isFetching } = useAdminTeacherRequests(query);

  const rows = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 0;
  const isEmpty = !isLoading && rows.length === 0;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      <div>
        <h1 className="font-cairo text-2xl font-bold text-text-primary">{t('adminTeacherRequests.title', 'طلبات المدرسين')}</h1>
        <p className="mt-1 font-cairo text-sm text-text-secondary">{t('adminTeacherRequests.subtitle', 'مراجعة طلبات تسجيل المدرسين')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute inset-y-0 my-auto text-text-muted ltr:left-3 rtl:right-3" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adminTeacherRequests.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال أو المرجع')}
            aria-label={t('adminTeacherRequests.searchPlaceholder', 'ابحث بالاسم أو البريد أو الجوال أو المرجع')}
            className="h-10 w-full rounded-btn border border-border bg-surface font-cairo text-sm text-text-primary outline-none transition-colors focus:border-accent ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('adminTeacherRequests.statusFilter', 'تصفية الحالة')}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { setStatus(opt); setPage(1); }}
              className={`rounded-btn border px-3 py-1.5 font-cairo text-sm font-medium transition-colors ${
                status === opt ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-secondary hover:bg-gray-100'
              }`}
            >
              {t(`adminTeacherRequests.status.${opt}`, opt)}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-16 text-center shadow-card">
          <AlertCircle size={48} className="text-danger" />
          <p className="font-cairo text-text-secondary">{t('adminTeacherRequests.errorLoading', 'تعذّر تحميل الطلبات')}</p>
          <button type="button" onClick={() => refetch()} className="rounded-btn border border-border bg-surface px-5 py-2 font-cairo text-sm font-medium text-text-primary hover:bg-gray-100">
            {t('adminTeacherRequests.retry', 'إعادة المحاولة')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-20" role="status" aria-label={t('common:status.loading', 'جاري التحميل...')}>
              <Spinner />
            </div>
          ) : isEmpty ? (
            <div className="py-12">
              <EmptyState icon={ClipboardList} title={t('adminTeacherRequests.emptyTitle', 'لا توجد طلبات')} description={t('adminTeacherRequests.emptyDescription', 'لا توجد طلبات مطابقة')} />
            </div>
          ) : (
            <div className="overflow-x-auto" aria-busy={isFetching}>
              <table className="w-full min-w-[820px] text-start text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50 text-text-secondary">
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherRequests.col.applicant', 'المتقدّم')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherRequests.col.specialization', 'التخصص')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherRequests.col.reference', 'المرجع')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherRequests.col.status', 'الحالة')}</th>
                    <th className="px-4 py-3 text-start font-medium">{t('adminTeacherRequests.col.createdAt', 'تاريخ التقديم')}</th>
                    <th className="px-4 py-3 text-end font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-cairo font-semibold text-text-primary">{r.fullName}</span>
                          <span className="font-cairo text-xs text-text-secondary">{r.email} · {r.mobile}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-cairo text-text-secondary">{r.specialization ?? '—'}</td>
                      <td className="px-4 py-3 font-cairo text-text-secondary">{r.publicReference}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant[r.status]}>{t(`adminTeacherRequests.status.${r.status}`, r.status)}</Badge></td>
                      <td className="px-4 py-3 font-cairo text-text-secondary">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3 text-end">
                        <Link to={`/admin/teacher-requests/${r.id}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent hover:underline">
                          {t('adminTeacherRequests.review', 'مراجعة')}
                          <ChevronLeft size={14} className="rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isEmpty && !isLoading && totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} isLoading={isFetching} />
          )}
        </div>
      )}

      {!isLoading && !isError && total > 0 && (
        <p className="font-cairo text-xs text-text-muted">{t('adminTeacherRequests.totalCount', '{{count}} طلب', { count: total })}</p>
      )}
    </div>
  );
}
