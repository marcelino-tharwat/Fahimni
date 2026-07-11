import { Spinner } from '@/shared/components/ui';
import { useChapter } from '@/features/teacher/hooks/useChapters';
import { useLesson } from '@/features/teacher/hooks/useLessons';
import type { ContentTreeChapter } from '@/features/teacher/types/contentTree';
import { EditorEmptyState } from './EditorEmptyState';
import { ChapterEditorForm } from './ChapterEditorForm';
import { LessonEditorForm } from './LessonEditorForm';
import { CreateChapterForm } from './CreateChapterForm';
import { CreateLessonForm } from './CreateLessonForm';
import { ContentTreeErrorState } from './ContentTreeErrorState';
import type { DeleteTarget, NodeRef, SelectedItem } from './types';

interface EditorPanelProps {
  selectedItem: SelectedItem | null;
  chapters: ContentTreeChapter[];
  onCreated: (item: NodeRef) => void;
  onExpandNode: (id: string) => void;
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
  const editId = selectedItem && 'id' in selectedItem ? selectedItem.id : undefined;

  const chapterQuery = useChapter(type === 'chapter' ? editId : undefined);
  const lessonQuery = useLesson(type === 'lesson' ? editId : undefined);
  const activeQuery = type === 'chapter' ? chapterQuery : type === 'lesson' ? lessonQuery : null;

  let content;
  if (!selectedItem || selectedItem.type === 'stage') {
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

  return <div className="rounded-card border border-gray-100 bg-surface p-6 shadow-sm">{content}</div>;
}
