import { Spinner } from '@/shared/components/ui';
import { useStage } from '@/features/teacher/hooks/useStages';
import { useChapter } from '@/features/teacher/hooks/useChapters';
import { useLesson } from '@/features/teacher/hooks/useLessons';
import type { ContentTreeChapter } from '@/features/teacher/types/contentTree';
import { EditorEmptyState } from './EditorEmptyState';
import { StageEditorForm } from './StageEditorForm';
import { ChapterEditorForm } from './ChapterEditorForm';
import { LessonEditorForm } from './LessonEditorForm';
import { CreateChapterForm } from './CreateChapterForm';
import { CreateLessonForm } from './CreateLessonForm';
import { ContentTreeErrorState } from './ContentTreeErrorState';
import type { DeleteTarget, NodeRef, SelectedItem } from './types';

interface EditorPanelProps {
  selectedItem: SelectedItem | null;
  /** Current stage's chapters — used to auto-calculate the next sortOrder. */
  chapters: ContentTreeChapter[];
  /** Called after a create succeeds → auto-selects the new item (edit mode). */
  onCreated: (item: NodeRef) => void;
  /** Expand a node (used to reveal a freshly created lesson under its chapter). */
  onExpandNode: (id: string) => void;
  /** Open the delete-confirm modal for an entity (from the editor header menu). */
  onRequestDelete: (target: DeleteTarget) => void;
}

export function EditorPanel({
  selectedItem,
  chapters,
  onCreated,
  onExpandNode,
  onRequestDelete,
}: EditorPanelProps) {
  const type = selectedItem?.type;
  // `id` only exists on the edit (NodeRef) variant.
  const editId = selectedItem && 'id' in selectedItem ? selectedItem.id : undefined;

  // All three detail hooks are always called (hooks rule); each is `enabled`
  // only when its type is the active edit selection.
  const stageQuery = useStage(type === 'stage' ? editId : undefined);
  const chapterQuery = useChapter(type === 'chapter' ? editId : undefined);
  const lessonQuery = useLesson(type === 'lesson' ? editId : undefined);

  const activeQuery =
    type === 'stage'
      ? stageQuery
      : type === 'chapter'
        ? chapterQuery
        : type === 'lesson'
          ? lessonQuery
          : null;

  let content;
  if (!selectedItem) {
    content = <EditorEmptyState />;
  } else if (selectedItem.type === 'new-chapter') {
    content = (
      <CreateChapterForm
        parentStageId={selectedItem.parentStageId}
        nextSortOrder={chapters.length + 1}
        onCreated={onCreated}
      />
    );
  } else if (selectedItem.type === 'new-lesson') {
    const parentChapterId = selectedItem.parentChapterId;
    const parentChapter = chapters.find((c) => c.id === parentChapterId);
    content = (
      <CreateLessonForm
        parentChapterId={parentChapterId}
        nextSortOrder={(parentChapter?.lessons.length ?? 0) + 1}
        onCreated={onCreated}
        onExpandParent={() => onExpandNode(parentChapterId)}
      />
    );
  } else if (activeQuery?.isLoading) {
    content = (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  } else if (activeQuery?.isError) {
    content = <ContentTreeErrorState onRetry={() => void activeQuery.refetch()} />;
  } else if (type === 'stage' && stageQuery.data) {
    // key remounts the form on selection change → unsaved edits auto-discard.
    content = (
      <StageEditorForm
        key={stageQuery.data.id}
        stage={stageQuery.data}
        onRequestDelete={onRequestDelete}
      />
    );
  } else if (type === 'chapter' && chapterQuery.data) {
    content = (
      <ChapterEditorForm
        key={chapterQuery.data.id}
        chapter={chapterQuery.data}
        onRequestDelete={onRequestDelete}
      />
    );
  } else if (type === 'lesson' && lessonQuery.data) {
    content = (
      <LessonEditorForm
        key={lessonQuery.data.id}
        lesson={lessonQuery.data}
        onRequestDelete={onRequestDelete}
      />
    );
  } else {
    content = <EditorEmptyState />;
  }

  return (
    <div className="rounded-card border border-gray-100 bg-surface p-6 shadow-sm">{content}</div>
  );
}
