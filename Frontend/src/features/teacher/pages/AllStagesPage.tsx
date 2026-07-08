import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  BookOpen,
  FileText,
  GripVertical,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Button, Card, Skeleton } from '@/shared/components/ui';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useStages, useReorderStages, useDeleteStage } from '@/features/teacher/hooks/useStages';
import type { StageResponseDTO } from '@/features/teacher/types/stage';
import { STAGES_KEY } from '@/features/teacher/hooks/useStages';
import { SortableItem } from '@/features/teacher/components/reorder/SortableItem';
import { SortableList } from '@/features/teacher/components/reorder/SortableList';
import { assertValidOrder } from '@/features/teacher/components/reorder/helpers';
import { cn } from '@/shared/lib/utils/cn';

export function AllStagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);
  const canReorder = user?.role === 'OPERATION';

  const { data: stages, isLoading, isError, error } = useStages();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();
  const [search, setSearch] = useState('');

  // ── Drag & Drop state ──────────────────────────────────────────────
  const [stageItems, setStageItems] = useState<StageResponseDTO[] | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const deleteLockRef = useRef(false);
  const saveLockRef = useRef(false);

  // ── Search filter (works with local drag state or server state) ────
  const baseItems = stageItems ?? stages ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return baseItems;
    const q = search.toLowerCase();
    return baseItems.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    );
  }, [baseItems, search]);

  // ── DnD handlers ───────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      if (!isDraggingRef.current && stageItems === null && stages?.length) {
        setStageItems([...stages]);
      }
      isDraggingRef.current = true;
      setActiveId(_event.active.id as string);
    },
    [stageItems, stages],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over) return;
      if (active.id === over.id) return;

      const activeContainer = active.data.current?.sortable?.containerId as string | undefined;
      const overContainer = over.data.current?.sortable?.containerId as string | undefined;

      if (!activeContainer || !overContainer) return;
      if (activeContainer !== overContainer) return;

      const items = stageItems ?? stages ?? [];
      const oldIdx = items.findIndex((s) => s.id === active.id);
      const newIdx = items.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      setStageItems(arrayMove(items, oldIdx, newIdx));
      setIsDirty(true);

      isDraggingRef.current = false;
      setActiveId(null);
    },
    [stageItems, stages],
  );

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    setActiveId(null);
  }, []);

  // ── Save handler ───────────────────────────────────────────────────
  const handleSaveOrder = async () => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setIsSaving(true);
    try {
      if (!stageItems) return;

      const currentStages = queryClient.getQueryData<StageResponseDTO[]>(STAGES_KEY) ?? [];
      const serverIds = currentStages.map((s) => s.id);
      const clientIds = stageItems.map((s) => s.id);

      if (!assertValidOrder(clientIds, serverIds)) {
        await queryClient.refetchQueries({ queryKey: STAGES_KEY });
        setStageItems(null);
        setIsDirty(false);
        dispatch(addToast({ type: 'error', message: t('teacher:stages.reorderError', 'Failed to save order') }));
        return;
      }

      await reorderStages.mutateAsync(clientIds);
      await queryClient.refetchQueries({ queryKey: STAGES_KEY });

      setStageItems(null);
      setIsDirty(false);
      dispatch(addToast({ type: 'success', message: t('teacher:stages.reorderSuccess', 'Order saved') }));
    } catch (err) {
      await queryClient.refetchQueries({ queryKey: STAGES_KEY });
      setStageItems(null);
      setIsDirty(false);
      dispatch(
        addToast({
          type: 'error',
          message: (err as ApiError)?.message ?? t('teacher:stages.reorderError', 'Failed to save order'),
        }),
      );
    } finally {
      setIsSaving(false);
      saveLockRef.current = false;
    }
  };

  // ── Delete handler with reindex ─────────────────────────────────────
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteLockRef.current) return;
    deleteLockRef.current = true;

    try {
      await deleteStage.mutateAsync({ id, force: false });
      await queryClient.refetchQueries({ queryKey: STAGES_KEY });

      const currentStages = queryClient.getQueryData<StageResponseDTO[]>(STAGES_KEY) ?? [];
      const remainingIds = currentStages
        .filter((s) => s.id !== id)
        .map((s) => s.id);

      if (remainingIds.length > 1) {
        await reorderStages.mutateAsync(remainingIds);
      }

      await queryClient.refetchQueries({ queryKey: STAGES_KEY });
      setStageItems(null);
      setIsDirty(false);
      dispatch(addToast({ type: 'success', message: t('teacher:stages.deleted', 'Stage deleted') }));
    } catch (err) {
      await queryClient.refetchQueries({ queryKey: STAGES_KEY });
      setStageItems(null);
      setIsDirty(false);
      dispatch(
        addToast({
          type: 'error',
          message: (err as ApiError)?.message ?? t('teacher:stages.deleteError', 'Failed to delete stage'),
        }),
      );
    } finally {
      deleteLockRef.current = false;
    }
  };

  const isMutating = isSaving || deleteStage.isPending;
  const displayItems = stageItems ?? stages ?? [];

  const activeStage = activeId
    ? displayItems.find((s) => s.id === activeId)
    : null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/teacher/dashboard')}
        className="mb-4 flex items-center gap-1.5 font-cairo text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
      >
        <ArrowLeft size={18} />
        {t('actions.back')}
      </button>

      {/* Page header + Save button row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-bold text-navy-900">{t('teacher:stages.title')}</h1>
          <p className="mt-1 font-cairo text-sm text-gray-500">{t('teacher:stages.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle size={12} />
              {t('teacher:stages.unsavedChanges', 'Unsaved changes')}
            </span>
          )}
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={!isDirty || isMutating}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 font-cairo text-sm font-medium text-white transition-all',
              isDirty
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'cursor-not-allowed bg-gray-300',
            )}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {t('teacher:stages.saveOrder', 'Save Order')}
          </button>
        </div>
      </div>

      {/* Search + New Stage */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search
            size={18}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t('teacher:stages.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pe-4 ps-10 font-cairo text-base text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <Button
          onClick={() => navigate('/teacher/content/new')}
          className="rounded-lg bg-cyan-500 hover:bg-cyan-600 whitespace-nowrap"
        >
          <Plus size={18} />
          {t('teacher:stages.newStage')}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <Card padding="md" className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <Card padding="lg" className="text-center">
          <p className="font-cairo text-sm text-danger-500">
            {error instanceof Error ? error.message : t('status.error')}
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="flex flex-col items-center gap-2 py-8">
            <BookOpen size={40} className="text-gray-300" />
            <p className="font-cairo text-sm text-gray-500">
              {search ? t('status.empty') : t('teacher:stages.empty')}
            </p>
          </div>
        </Card>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div style={isMutating ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
            {/* Column headers (hidden on mobile) */}
            <div className="mb-2 hidden items-center gap-3 px-5 md:flex">
              <ColLabel className="flex-1 text-start">
                {t('teacher:stages.columns.stageName')}
              </ColLabel>
              <ColLabel className="w-24 text-center">
                {t('teacher:stages.columns.chapters')}
              </ColLabel>
              <ColLabel className="w-24 text-center">
                {t('teacher:stages.columns.lessons')}
              </ColLabel>
              <ColLabel className="w-32 text-center">
                {t('teacher:stages.columns.actions')}
              </ColLabel>
            </div>

            <SortableList
              id="stages"
              items={displayItems.map((s) => s.id)}
              disabled={!canReorder || displayItems.length <= 1 || isMutating}
            >
              <div className="flex flex-col gap-2.5">
                {filtered.map((stage, idx) => (
                  <SortableItem
                    key={stage.id}
                    id={stage.id}
                    disabled={!canReorder || isMutating}
                    data={{ type: 'stage', containerId: 'stages' }}
                  >
                    {(dragProps) => (
                      <div
                        ref={dragProps.setNodeRef}
                        style={dragProps.style}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/teacher/content/${stage.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/teacher/content/${stage.id}`);
                          }
                        }}
                        className={cn(
                          'flex flex-col gap-2 rounded-card border border-gray-100 bg-white px-4 py-3 shadow-card transition-transform duration-200 ease-in-out hover:scale-[1.01] hover:shadow-md md:flex-row md:items-center md:gap-3 md:px-5 md:py-4',
                          dragProps.isDragging && 'opacity-50 shadow-elevated',
                        )}
                      >
                        {/* Top row: drag handle + stage name (always visible) */}
                        <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                          {/* Drag handle */}
                          {canReorder && displayItems.length > 1 ? (
                            <button
                              type="button"
                              className="shrink-0 cursor-grab rounded p-1 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-navy-600 group-hover:opacity-100 active:cursor-grabbing"
                              {...dragProps.attributes}
                              {...dragProps.listeners}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical size={16} />
                            </button>
                          ) : null}
                          <StageMarker index={idx} />
                          <div className="min-w-0">
                            <p className="font-cairo text-sm font-semibold text-navy-900">
                              {stage.name}
                            </p>
                            {stage.description && (
                              <p className="mt-0.5 font-cairo text-xs text-gray-400 line-clamp-1">
                                {stage.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bottom row: meta info + actions (mobile: below name, desktop: inline) */}
                        <div className="flex items-center justify-between gap-2 md:gap-0">
                          <div className="flex items-center gap-3">
                            {/* Chapters */}
                            <div className="flex items-center gap-1 md:w-24 md:justify-center">
                              <BookOpen size={14} className="text-cyan-500 md:hidden" />
                              <span className="font-cairo text-xs text-gray-500 md:hidden">
                                {t('teacher:stages.columns.chapters')}:
                              </span>
                              <BookOpen size={14} className="hidden text-cyan-500 md:block" />
                              <span className="font-cairo text-sm font-medium text-navy-800">
                                {stage.chapterCount}
                              </span>
                            </div>

                            {/* Lessons */}
                            <div className="flex items-center gap-1 md:w-24 md:justify-center">
                              <FileText size={14} className="text-purple-500 md:hidden" />
                              <span className="font-cairo text-xs text-gray-500 md:hidden">
                                {t('teacher:stages.columns.lessons')}:
                              </span>
                              <FileText size={14} className="hidden text-purple-500 md:block" />
                              <span className="font-cairo text-sm font-medium text-navy-800">
                                {stage.lessonCount}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 md:w-32 md:justify-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/teacher/content/${stage.id}`);
                              }}
                              className="rounded-lg bg-cyan-600 px-3 py-1 font-cairo text-xs font-medium text-white transition-colors hover:bg-cyan-700 md:px-4 md:py-1.5 md:text-sm"
                            >
                              {t('teacher:stages.actions.details')}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(stage.id, e)}
                              className="rounded-lg bg-danger-500 px-2 py-1 font-cairo text-xs font-medium text-white transition-colors hover:bg-danger-600 md:px-3 md:py-1.5 md:text-sm"
                            >
                              {t('actions.delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableList>
          </div>

          <DragOverlay>
            {activeId && activeStage ? (
              <div className="flex items-center gap-3 rounded-card border border-gray-200 bg-white px-5 py-4 shadow-elevated">
                <GripVertical size={16} className="text-gray-400" />
                <div className="min-w-0">
                  <p className="font-cairo text-sm font-semibold text-navy-900">
                    {activeStage.name}
                  </p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function ColLabel({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={`font-cairo text-xs font-semibold uppercase tracking-wider text-gray-500 ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

const MARKER_COLORS = [
  'bg-cyan-100 text-cyan-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-indigo-100 text-indigo-700',
];

function StageMarker({ index }: { index: number }) {
  const color = MARKER_COLORS[index % MARKER_COLORS.length];
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${color}`}
    >
      {index + 1}
    </span>
  );
}
