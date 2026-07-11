import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, AlertTriangle } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { translateApiError } from '@/shared/lib/api/translateError';
import { useQueryClient } from '@tanstack/react-query';
import { useContentTree } from '@/features/teacher/hooks/useContentTree';
import { useDeleteChapter } from '@/features/teacher/hooks/useChapters';
import { useDeleteLesson } from '@/features/teacher/hooks/useLessons';
import { useReorderChapters } from '@/features/teacher/hooks/useChapters';
import { useReorderLessons } from '@/features/teacher/hooks/useLessons';
import { CONTENT_TREE_KEY } from '@/features/teacher/hooks/useContentTree';
import { assertValidOrder } from '@/features/teacher/components/reorder/helpers';
import { cn } from '@/shared/lib/utils/cn';
import type { ContentTreeChapter, ContentTreeLesson, ContentTreeStage } from '@/features/teacher/types/contentTree';
import { ContentTreePanel } from './ContentTreePanel';
import { EditorPanel } from './EditorPanel';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { DeleteTarget, MenuAction, NodeRef, SelectedItem } from './types';

export function ContentTreePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { stageId } = useParams<{ stageId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const canReorder = user?.role === 'OPERATION';

  const { data: tree, isLoading, isError, refetch } = useContentTree();
  const deleteChapter = useDeleteChapter();
  const deleteLesson = useDeleteLesson();
  const reorderChapters = useReorderChapters();
  const reorderLessons = useReorderLessons();

  const stage = useMemo(
    () => (tree ?? []).find((s) => s.id === stageId),
    [tree, stageId],
  );

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // ── Drag & Drop state ──────────────────────────────────────────────
  const [chapterItems, setChapterItems] = useState<ContentTreeChapter[] | null>(null);
  const [lessonItemsMap, setLessonItemsMap] = useState<
    Record<string, ContentTreeLesson[] | null>
  >({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);
  const lock = {
    save: useRef(false),
    delete: useRef(false),
    reorder: useRef(false),
  };

  async function withLock<T>(
    lockRef: React.MutableRefObject<boolean>,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      return await fn();
    } finally {
      lockRef.current = false;
    }
  }

  // ── DnD handlers ───────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (_event: DragStartEvent) => {
      if (!isDraggingRef.current && chapterItems === null && stage?.chapters?.length) {
        setChapterItems([...stage.chapters]);
      }
      isDraggingRef.current = true;
      setActiveId(_event.active.id as string);
    },
    [chapterItems, stage?.chapters],
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

      if (activeContainer === 'chapters') {
        const items = chapterItems ?? stage?.chapters ?? [];
        const oldIdx = items.findIndex((c) => c.id === active.id);
        const newIdx = items.findIndex((c) => c.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return;
        setChapterItems(arrayMove(items, oldIdx, newIdx));
        setIsDirty(true);
      } else if (activeContainer.startsWith('lesson:')) {
        const chapterId = activeContainer.replace('lesson:', '');
        const parentChapter = stage?.chapters.find((c) => c.id === chapterId);
        if (!parentChapter) return;
        const items = lessonItemsMap[chapterId] ?? parentChapter.lessons;
        const oldIdx = items.findIndex((l) => l.id === active.id);
        const newIdx = items.findIndex((l) => l.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return;
        const reordered = arrayMove(items, oldIdx, newIdx);
        setLessonItemsMap((prev) => ({ ...prev, [chapterId]: reordered }));
        setIsDirty(true);
      }

      isDraggingRef.current = false;
      setActiveId(null);
    },
    [chapterItems, stage?.chapters, lessonItemsMap],
  );

  const handleDragCancel = useCallback(() => {
    isDraggingRef.current = false;
    setActiveId(null);
  }, []);

  // ── Chapter reorder callbacks (passed to ContentTreePanel) ─────────
  const handleChapterReorder = useCallback((ids: string[]) => {
    const items = stage?.chapters ?? [];
    const reordered = ids.map((id) => items.find((c) => c.id === id)).filter(Boolean) as ContentTreeChapter[];
    setChapterItems(reordered);
    setIsDirty(true);
  }, [stage?.chapters]);

  const handleLessonReorder = useCallback((chapterId: string, ids: string[]) => {
    setLessonItemsMap((prev) => {
      const parentChapter = stage?.chapters.find((c) => c.id === chapterId);
      if (!parentChapter) return prev;
      const reordered = ids
        .map((id) => parentChapter.lessons.find((l) => l.id === id))
        .filter(Boolean) as ContentTreeLesson[];
      return { ...prev, [chapterId]: reordered };
    });
    setIsDirty(true);
  }, [stage?.chapters]);

  // ── Save handler ───────────────────────────────────────────────────
  const handleSaveOrder = () =>
    withLock(lock.save, async () => {
      setIsSaving(true);
      try {
        const mutations: Promise<unknown>[] = [];
        const currentStage = queryClient.getQueryData<ContentTreeStage[]>(CONTENT_TREE_KEY)
          ?.find((s) => s.id === stageId);

        if (!currentStage) {
          dispatch(addToast({ type: 'error', message: t('teacher:contentTree.editor.toast.saveError') }));
          return;
        }

        if (chapterItems) {
          const serverIds = currentStage.chapters.map((c) => c.id);
          if (!assertValidOrder(chapterItems.map((c) => c.id), serverIds)) {
            await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
            setChapterItems(null);
            setLessonItemsMap({});
            setIsDirty(false);
            dispatch(addToast({ type: 'error', message: t('teacher:contentTree.editor.toast.saveError') }));
            return;
          }
          mutations.push(
            reorderChapters.mutateAsync({
              stageId: stageId!,
              ids: chapterItems.map((c) => c.id),
            }),
          );
        }

        for (const [chId, lessons] of Object.entries(lessonItemsMap)) {
          if (!lessons) continue;
          const serverIds = currentStage.chapters.find((c) => c.id === chId)?.lessons.map((l) => l.id) ?? [];
          if (!assertValidOrder(lessons.map((l) => l.id), serverIds)) {
            await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
            setChapterItems(null);
            setLessonItemsMap({});
            setIsDirty(false);
            dispatch(addToast({ type: 'error', message: t('teacher:contentTree.editor.toast.saveError') }));
            return;
          }
          mutations.push(
            reorderLessons.mutateAsync({
              chapterId: chId,
              ids: lessons.map((l) => l.id),
            }),
          );
        }

        if (mutations.length === 0) return;

        await Promise.all(mutations);
        await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
        queryClient.getQueryData(CONTENT_TREE_KEY);

        setChapterItems(null);
        setLessonItemsMap({});
        setIsDirty(false);
        dispatch(addToast({ type: 'success', message: t('teacher:contentTree.editor.toast.saved', 'Order saved') }));
      } catch {
        await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
        setChapterItems(null);
        setLessonItemsMap({});
        setIsDirty(false);
        dispatch(addToast({ type: 'error', message: t('teacher:contentTree.editor.toast.saveError') }));
      } finally {
        setIsSaving(false);
      }
    });

  // ── Menu actions ───────────────────────────────────────────────────
  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandNode = (id: string) =>
    setExpandedNodes((prev) => new Set(prev).add(id));

  const handleMenuAction = (item: NodeRef, action: MenuAction) => {
    if (action === 'edit') {
      setSelectedItem(item);
      return;
    }
    if (action === 'addChapter') {
      setSelectedItem({ type: 'new-chapter', parentStageId: item.id });
      return;
    }
    if (action === 'addLesson') {
      setSelectedItem({ type: 'new-lesson', parentChapterId: item.id });
      return;
    }
  };

  // ── Delete handler with reindex ─────────────────────────────────────
  const isDeleting =
    deleteChapter.isPending || deleteLesson.isPending;
  const isMutating = isSaving || isDeleting;

  const handleConfirmDelete = () =>
    withLock(lock.delete, async () => {
      if (!deleteTarget) return;
      const { type, id, childrenCount } = deleteTarget;
      const force = childrenCount > 0;

      const toastKey =
        type === 'stage'
          ? 'teacher:contentTree.editor.toast.stageDeleted'
          : type === 'chapter'
            ? 'teacher:contentTree.editor.toast.chapterDeleted'
            : 'teacher:contentTree.editor.toast.lessonDeleted';

      try {
        if (type === 'chapter') {
          await deleteChapter.mutateAsync({ id, force });
        } else {
          await deleteLesson.mutateAsync(id);
        }

        await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
        const freshTree = queryClient.getQueryData<ContentTreeStage[]>(CONTENT_TREE_KEY);
        const freshStage = freshTree?.find((s) => s.id === stageId);

        if (freshStage) {
          if (type === 'chapter') {
            const remainingIds = freshStage.chapters
              .filter((c) => c.id !== id)
              .map((c) => c.id);
            if (remainingIds.length > 1) {
              await withLock(lock.reorder, () =>
                reorderChapters.mutateAsync({ stageId: stageId!, ids: remainingIds }),
              );
            }
          } else {
            const parentChapter = freshStage.chapters.find((c) =>
              c.lessons.some((l) => l.id === id),
            );
            if (parentChapter) {
              const remainingIds = parentChapter.lessons
                .filter((l) => l.id !== id)
                .map((l) => l.id);
              if (remainingIds.length > 1) {
                await withLock(lock.reorder, () =>
                  reorderLessons.mutateAsync({ chapterId: parentChapter.id, ids: remainingIds }),
                );
              }
            }
          }
        }

        await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
        setChapterItems(null);
        setLessonItemsMap({});
        setIsDirty(false);
        setSelectedItem(null);
        setDeleteTarget(null);
        dispatch(addToast({ type: 'success', message: t(toastKey) }));
      } catch (error) {
        await queryClient.refetchQueries({ queryKey: CONTENT_TREE_KEY });
        setChapterItems(null);
        setLessonItemsMap({});
        setIsDirty(false);
        dispatch(
          addToast({
            type: 'error',
            message: translateApiError(t, error),
          }),
        );
      }
    });

  const stageName = stage?.name ?? '';

  const activeItem = activeId
    ? (chapterItems ?? stage?.chapters ?? []).find((c) => c.id === activeId) ??
      (stage?.chapters ?? [])
        .flatMap((c) => c.lessons)
        .find((l) => l.id === activeId)
    : null;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/teacher/content')}
        className="mb-4 flex items-center gap-1.5 font-cairo text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
      >
        <ArrowLeft size={18} />
        {t('actions.back')}
      </button>

      {/* Page title + Save button row */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{stageName}</h1>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <AlertTriangle size={12} />
              {t('teacher:contentTree.unsavedChanges', 'Unsaved changes')}
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
            {t('teacher:contentTree.saveOrder', 'Save Order')}
          </button>
        </div>
      </div>

      {/* Two-panel layout with DnD context */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]"
          style={isMutating ? { pointerEvents: 'none', opacity: 0.7 } : undefined}
        >
          <ContentTreePanel
            stageId={stageId ?? ''}
            stageName={stageName}
            chapters={stage?.chapters ?? []}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
            selectedItem={selectedItem}
            onSelect={setSelectedItem}
            onAddChapter={() =>
              setSelectedItem({ type: 'new-chapter', parentStageId: stageId ?? '' })
            }
            onMenuAction={handleMenuAction}
            onRequestDelete={setDeleteTarget}
            chapterItems={chapterItems}
            lessonItemsMap={lessonItemsMap}
            onChapterReorder={handleChapterReorder}
            onLessonReorder={handleLessonReorder}
            canReorder={canReorder}
            isDirty={isDirty}
            isMutating={isMutating}
          />

          <EditorPanel
            selectedItem={selectedItem}
            chapters={stage?.chapters ?? []}
            onCreated={setSelectedItem}
            onExpandNode={expandNode}
            onRequestDelete={setDeleteTarget}
          />
        </div>

        <DragOverlay>
          {activeId && activeItem ? (
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-elevated ring-1 ring-gray-200">
              <span className="font-cairo text-sm font-medium text-navy-900">
                {'name' in activeItem ? activeItem.name : 'title' in activeItem ? activeItem.title : ''}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        itemName={deleteTarget?.name ?? ''}
        itemType={deleteTarget?.type ?? 'lesson'}
        hasChildren={(deleteTarget?.childrenCount ?? 0) > 0}
        childrenCount={deleteTarget?.childrenCount ?? 0}
        loading={isDeleting}
      />
    </div>
  );
}
