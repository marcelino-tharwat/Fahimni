import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, MoreVertical, Eye, EyeOff, Pencil, Trash2,
  ClipboardList, ChevronLeft, ChevronRight, Loader2, BarChart3,
} from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { Badge } from '@/shared/components/ui/Badge';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/shared/lib/utils/cn';
import { useQuizList, useDeleteQuiz, useUnpublishQuiz } from '@/features/teacher/hooks/useQuizList';
import { useStagesList, useChaptersByStage } from '@/features/teacher/hooks/useQuizGeneration';

type TabKey = 'all' | 'published' | 'draft';

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<string, 'success' | 'warning'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
};

export function QuizListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: quizzes = [], isLoading } = useQuizList();
  const deleteQuiz = useDeleteQuiz();
  const unpublishQuiz = useUnpublishQuiz();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [unpublishTargetId, setUnpublishTargetId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: stages = [] } = useStagesList();
  const { data: chapters = [] } = useChaptersByStage(stages[0]?.id);

  const chapterMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chapters) {
      map.set(c.id, c.name);
    }
    return map;
  }, [chapters]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-menu]')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return quizzes;
    const status = activeTab === 'published' ? 'PUBLISHED' : 'DRAFT';
    return quizzes.filter((q) => q.status === status);
  }, [quizzes, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  useEffect(() => {
    if (safePage !== currentPage) setCurrentPage(safePage);
  }, [safePage, currentPage]);

  const counts = useMemo(() => {
    const published = quizzes.filter((q) => q.status === 'PUBLISHED').length;
    const draft = quizzes.filter((q) => q.status === 'DRAFT').length;
    return { all: quizzes.length, published, draft };
  }, [quizzes]);

  const handleDelete = useCallback(() => {
    if (!deleteTargetId) return;
    deleteQuiz.mutate(deleteTargetId, {
      onSettled: () => setDeleteTargetId(null),
    });
  }, [deleteTargetId, deleteQuiz]);

  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const empty = filtered.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-4 py-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-extrabold text-navy-900">
            {t('teacher:quizList.pageTitle')}
          </h1>
          <p className="text-sm text-gray-600">
            {t('teacher:quizList.pageSubtitle')}
          </p>
        </div>
        <Button
          onClick={() => navigate('/teacher/quizzes/generator')}
          className="h-12 rounded-btn bg-cyan-gradient font-bold text-white px-5"
        >
          <Plus size={18} />
          {t('teacher:quizList.newQuiz')}
        </Button>
      </div>

      {/* Card */}
      <div className="overflow-hidden rounded-[14px] bg-white shadow-card">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-300 px-4 pt-4">
          {(['all', 'published', 'draft'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-cyan-500 text-cyan-500 font-semibold'
                  : 'text-gray-600 hover:text-navy-900',
              )}
            >
              {t(`teacher:quizList.tabs.${tab}`, { count: counts[tab] })}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 size={28} className="animate-spin text-cyan-500" />
            <p className="text-sm text-gray-600">{t('teacher:quizGenerator.loading')}</p>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <ClipboardList size={64} className="text-gray-400" />
            <h3 className="text-lg font-medium text-navy-900">
              {t('teacher:quizList.empty.title')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('teacher:quizList.empty.subtitle')}
            </p>
            <Button
              onClick={() => navigate('/teacher/quizzes/generator')}
              className="mt-2 rounded-btn bg-cyan-gradient font-bold text-white px-6"
            >
              {t('teacher:quizList.empty.action')}
            </Button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-200 text-xs font-medium text-gray-600">
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.title')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.chapter')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.questions')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.points')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.status')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.publishedAt')}</th>
                    <th className="px-4 py-3 text-start">{t('teacher:quizList.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((quiz) => (
                    <tr
                      key={quiz.id}
                      className="border-b border-gray-300 transition-colors hover:bg-gray-100 last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-navy-900">{quiz.title}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {chapterMap.get(quiz.chapterId ?? '') ?? quiz.chapterId?.slice(0, 8) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{quiz.questionCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{quiz.totalPoints}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[quiz.status] ?? 'default'}>
                          {t(`teacher:quizList.statusBadge.${quiz.status === 'PUBLISHED' ? 'published' : 'draft'}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDate(quiz.publishedAt)}
                      </td>
                      <td className="relative px-4 py-3">
                        <button
                          type="button"
                          data-dropdown-menu
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === quiz.id ? null : quiz.id);
                          }}
                          className="rounded-md p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMenuId === quiz.id && (
                          <div
                            data-dropdown-menu
                            className="absolute end-0 z-50 min-w-[140px] rounded-[12px] border border-gray-300 bg-white py-1 shadow-elevated"
                          >
                            <DropdownItem
                              icon={<Eye size={16} />}
                              label={t('teacher:quizList.dropdown.view')}
                              onClick={() => {
                                setOpenMenuId(null);
                                navigate(`/teacher/quizzes/generator/publish/${quiz.id}`);
                              }}
                            />
                            {quiz.status === 'PUBLISHED' && (
                              <DropdownItem
                                icon={<BarChart3 size={16} />}
                                label={t('teacher:quizList.dropdown.results')}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/teacher/quizzes/${quiz.id}/results`);
                                }}
                              />
                            )}
                            {quiz.status === 'PUBLISHED' && (
                              <DropdownItem
                                icon={<EyeOff size={16} />}
                                label={t('teacher:quizList.dropdown.unpublish')}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setUnpublishTargetId(quiz.id);
                                }}
                              />
                            )}
                            {quiz.status === 'DRAFT' && (
                              <DropdownItem
                                icon={<Pencil size={16} />}
                                label={t('teacher:quizList.dropdown.edit')}
                                onClick={() => {
                                  setOpenMenuId(null);
                                  navigate(`/teacher/quizzes/generator/review/${quiz.id}`);
                                }}
                              />
                            )}
                            {quiz.status === 'DRAFT' && (
                              <>
                                <hr className="my-1 border-gray-200" />
                                <DropdownItem
                                  icon={<Trash2 size={16} />}
                                  label={t('teacher:quizList.dropdown.delete')}
                                  className="text-danger-500 hover:bg-danger-50"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setDeleteTargetId(quiz.id);
                                  }}
                                />
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-600">
                {t('teacher:quizList.pagination.page', { current: safePage, total: totalPages })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex items-center gap-1 rounded-btn px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                  {t('teacher:quizList.pagination.previous')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex items-center gap-1 rounded-btn px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('teacher:quizList.pagination.next')}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Delete modal ── */}
      <Modal
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-50">
            <Trash2 size={32} className="text-danger-500" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-navy-900">
              {t('teacher:quizList.deleteConfirm.title')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('teacher:quizList.deleteConfirm.message', {
                title: quizzes.find((q) => q.id === deleteTargetId)?.title ?? '',
              })}
            </p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => setDeleteTargetId(null)} className="flex-1">
            {t('teacher:quizList.deleteConfirm.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete} className="flex-1" loading={deleteQuiz.isPending}>
            {t('teacher:quizList.deleteConfirm.confirm')}
          </Button>
        </div>
      </Modal>

      {/* ── Unpublish modal ── */}
      <Modal
        isOpen={unpublishTargetId !== null}
        onClose={() => setUnpublishTargetId(null)}
        size="sm"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-warning-50">
            <EyeOff size={32} className="text-warning-500" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-navy-900">
              {t('teacher:quizList.unpublishConfirm.title')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('teacher:quizList.unpublishConfirm.message', {
                title: quizzes.find((q) => q.id === unpublishTargetId)?.title ?? '',
              })}
            </p>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={() => setUnpublishTargetId(null)} className="flex-1">
            {t('teacher:quizList.unpublishConfirm.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (!unpublishTargetId) return;
              unpublishQuiz.mutate(unpublishTargetId, {
                onSettled: () => setUnpublishTargetId(null),
              });
            }}
            className="flex-1 bg-warning-500 text-white hover:bg-warning-600"
            loading={unpublishQuiz.isPending}
          >
            {t('teacher:quizList.unpublishConfirm.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-gray-100',
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
