import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import {
  StatCards,
  FilterTabs,
  PromoCodeTable,
  Pagination,
  GenerateConfirmModal,
  GenerateSuccessModal,
  type FilterValue,
} from '../components/promo-codes';
import { usePromoCodes, useGeneratePromoCode } from '../hooks/usePromoCodes';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import type { PromoCode } from '@/shared/types';

const ITEMS_PER_PAGE = 10;

export function PromoCodesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<PromoCode | null>(null);

  // Map the active filter tab to the API's `isUsed` param ('all' omits it).
  const isUsedParam = filter === 'all' ? undefined : filter === 'used' ? true : false;

  // Main paginated list for the table.
  const { data, isLoading, isError, refetch } = usePromoCodes({
    page,
    limit: ITEMS_PER_PAGE,
    isUsed: isUsedParam,
  });

  // Stat-card counts: three lightweight (limit=1) queries so each total is
  // accurate regardless of the active filter (the list endpoint only returns a
  // total for the requested filter).
  const allQuery = usePromoCodes({ page: 1, limit: 1 });
  const usedQuery = usePromoCodes({ page: 1, limit: 1, isUsed: true });
  const unusedQuery = usePromoCodes({ page: 1, limit: 1, isUsed: false });

  const allCount = allQuery.data?.total ?? 0;
  const usedCount = usedQuery.data?.total ?? 0;
  const unusedCount = unusedQuery.data?.total ?? 0;
  const statsLoading = allQuery.isLoading || usedQuery.isLoading || unusedQuery.isLoading;

  const generateMutation = useGeneratePromoCode();

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / ITEMS_PER_PAGE) : 1;
  const isEmpty = !isLoading && items.length === 0;

  const handleFilterChange = (next: FilterValue) => {
    setFilter(next);
    setPage(1);
  };

  const openConfirmModal = () => setShowConfirmModal(true);

  const handleConfirmGenerate = (chapterId: string) => {
    generateMutation.mutate(chapterId, {
      onSuccess: (code) => {
        setShowConfirmModal(false);
        setGeneratedCode(code);
        dispatch(addToast({ type: 'success', message: t('promoCodes.successToast') }));
      },
      onError: (error: ApiError) => {
        const message =
          error.code === 'CHAPTER_NOT_FOUND'
            ? t('promoCodes.errorChapterNotFound')
            : error.code === 'PROMO_TARGET_MUST_BE_PAID'
              ? t('promoCodes.errorFreeChapter')
              : t('promoCodes.errorGenerating');
        dispatch(addToast({ type: 'error', message }));
      },
    });
  };

  const isGenerating = generateMutation.isPending;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-navy-800">{t('promoCodes.title')}</h2>
          <p className="mt-0.5 text-sm text-gray-600">{t('promoCodes.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openConfirmModal}
          disabled={isGenerating}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-gradient px-5 text-sm font-semibold text-white shadow-glow transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t('promoCodes.creating')}
            </>
          ) : (
            <>
              <Plus size={16} />
              {t('promoCodes.createNew')}
            </>
          )}
        </button>
      </div>

      {isError ? (
        // Error state — failed to load the list.
        <div className="flex flex-col items-center gap-4 rounded-card border border-gray-300 bg-white px-6 py-16 text-center shadow-card">
          <AlertCircle size={52} className="text-danger-500" />
          <div>
            <p className="text-lg font-medium text-navy-800">{t('promoCodes.errorLoading')}</p>
            <p className="mt-1 text-sm text-gray-600">{t('status.error')}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-gradient px-5 text-sm font-semibold text-white shadow-glow transition-all duration-150 active:scale-[0.97]"
          >
            {t('promoCodes.retry')}
          </button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <StatCards
            total={allCount}
            used={usedCount}
            available={unusedCount}
            isLoading={statsLoading}
          />

          {/* Table card: filter tabs + table + pagination */}
          <div className="overflow-hidden rounded-card border border-gray-300 bg-white shadow-card">
            <FilterTabs
              activeFilter={filter}
              onFilterChange={handleFilterChange}
              counts={{ all: allCount, used: usedCount, unused: unusedCount }}
            />

            <PromoCodeTable
              data={items}
              isLoading={isLoading}
              isEmpty={isEmpty}
              onCreateFirst={openConfirmModal}
            />

            {!isEmpty && !isLoading && totalPages > 1 && (
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </>
      )}

      {/* Generate confirm modal */}
      <GenerateConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmGenerate}
        onClose={() => setShowConfirmModal(false)}
        isLoading={isGenerating}
      />

      {/* Generate success modal */}
      {generatedCode && (
        <GenerateSuccessModal
          isOpen={generatedCode !== null}
          code={generatedCode.code}
          expiresAt={generatedCode.expiresAt ?? ''}
          onClose={() => setGeneratedCode(null)}
        />
      )}
    </div>
  );
}
