import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import type { ApiError } from '@/shared/lib/api/client';
import { useContentTree } from '@/features/teacher/hooks/useContentTree';
import { useDeleteStage } from '@/features/teacher/hooks/useStages';
import { useDeleteChapter } from '@/features/teacher/hooks/useChapters';
import { useDeleteLesson } from '@/features/teacher/hooks/useLessons';
import { ContentTreePanel } from './ContentTreePanel';
import { EditorPanel } from './EditorPanel';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import type { DeleteTarget, MenuAction, NodeRef, SelectedItem } from './types';

export function ContentTreePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { stageId } = useParams<{ stageId: string }>();

  const { data: tree, isLoading, isError, isFetching, refetch } = useContentTree();
  const deleteStage = useDeleteStage();
  const deleteChapter = useDeleteChapter();
  const deleteLesson = useDeleteLesson();

  // This page is scoped to a single stage (the one navigated to from the
  // stages list); we only render that stage's chapters and lessons.
  const stage = useMemo(
    () => (tree ?? []).find((s) => s.id === stageId),
    [tree, stageId],
  );

  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

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
      // addChapter originates from a stage node → item.id is the stage id.
      setSelectedItem({ type: 'new-chapter', parentStageId: item.id });
      return;
    }
    if (action === 'addLesson') {
      // addLesson originates from a chapter node → item.id is the chapter id.
      setSelectedItem({ type: 'new-lesson', parentChapterId: item.id });
      return;
    }
    // 'delete' is routed via onRequestDelete (it carries name + child count).
  };

  const isDeleting =
    deleteStage.isPending || deleteChapter.isPending || deleteLesson.isPending;

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const { type, id, childrenCount } = deleteTarget;
    // Only force-delete when the item actually has children.
    const force = childrenCount > 0;

    const toastKey =
      type === 'stage'
        ? 'teacher:contentTree.editor.toast.stageDeleted'
        : type === 'chapter'
          ? 'teacher:contentTree.editor.toast.chapterDeleted'
          : 'teacher:contentTree.editor.toast.lessonDeleted';

    const handlers = {
      onSuccess: () => {
        dispatch(addToast({ type: 'success', message: t(toastKey) }));
        setSelectedItem(null);
        setDeleteTarget(null);
        if (type === 'stage') navigate('/teacher/content');
      },
      onError: (error: unknown) =>
        dispatch(
          addToast({
            type: 'error',
            message:
              (error as ApiError)?.message ?? t('teacher:contentTree.editor.toast.deleteError'),
          }),
        ),
    };

    if (type === 'stage') deleteStage.mutate({ id, force }, handlers);
    else if (type === 'chapter') deleteChapter.mutate({ id, force }, handlers);
    else deleteLesson.mutate(id, handlers);
  };

  const stageName = stage?.name ?? '';

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

      {/* Page title */}
      <div className="mb-6">
        <h1 className="font-cairo text-2xl font-bold text-navy-900">{stageName}</h1>
      </div>

      {/* Two-panel layout: tree (left) + editor placeholder (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
        <ContentTreePanel
          stageId={stageId ?? ''}
          stageName={stageName}
          chapters={stage?.chapters ?? []}
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          onRefresh={() => void refetch()}
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
        />

        {/* Right panel — context-sensitive editor + create forms */}
        <EditorPanel
          selectedItem={selectedItem}
          chapters={stage?.chapters ?? []}
          onCreated={setSelectedItem}
          onExpandNode={expandNode}
          onRequestDelete={setDeleteTarget}
        />
      </div>

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
