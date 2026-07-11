import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers, Plus } from 'lucide-react';
import type { ContentTreeChapter, ContentTreeLesson } from '@/features/teacher/types/contentTree';
import { SortableItem } from '@/features/teacher/components/reorder/SortableItem';
import { SortableList } from '@/features/teacher/components/reorder/SortableList';
import { getLessonContainerId } from '@/features/teacher/components/reorder/helpers';
import { TreeNode } from './TreeNode';
import { TreeNodeMenu } from './TreeNodeMenu';
import { ContentTreeEmptyState } from './ContentTreeEmptyState';
import { ContentTreeLoadingState } from './ContentTreeLoadingState';
import { ContentTreeErrorState } from './ContentTreeErrorState';
import type { DeleteTarget, MenuAction, NodeRef, SelectedItem } from './types';

interface ContentTreePanelProps {
  stageId: string;
  stageName: string;
  chapters: ContentTreeChapter[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  selectedItem: SelectedItem | null;
  onSelect: (item: NodeRef) => void;
  onAddChapter: () => void;
  onMenuAction: (item: NodeRef, action: MenuAction) => void;
  onRequestDelete: (target: DeleteTarget) => void;

  /** Override chapter order from local drag state (null = use prop). */
  chapterItems: ContentTreeChapter[] | null;
  /** Override lesson order per chapter from local drag state. */
  lessonItemsMap: Record<string, ContentTreeLesson[] | null>;
  /** Called when chapters are reordered via drag. */
  onChapterReorder: (ids: string[]) => void;
  /** Called when lessons in a chapter are reordered via drag. */
  onLessonReorder: (chapterId: string, ids: string[]) => void;
  canReorder: boolean;
  isDirty: boolean;
  isMutating: boolean;
}

export function ContentTreePanel({
  stageId,
  stageName,
  chapters,
  isLoading,
  isError,
  onRetry,
  expandedNodes,
  onToggle,
  selectedItem,
  onSelect,
  onAddChapter,
  onMenuAction,
  onRequestDelete,
  chapterItems,
  lessonItemsMap,
  canReorder,
  isDirty,
  isMutating,
}: ContentTreePanelProps) {
  const { t } = useTranslation();

  const displayChapters = chapterItems ?? chapters;

  return (
    <div className="flex flex-col rounded-card border border-gray-100 bg-surface shadow-sm">
      {/* Header — shows the stage name (this panel is scoped to one stage) */}
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        <Layers size={18} className="shrink-0 text-cyan-600" />
        <h2 className="flex-1 truncate font-cairo text-base font-bold text-navy-900">
          {stageName}
        </h2>
        <TreeNodeMenu
          nodeType="stage"
          actions={['addChapter']}
          onAction={(action) => onMenuAction({ type: 'stage', id: stageId }, action)}
        />
      </div>

      {/* Add Chapter */}
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={onAddChapter}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 font-cairo text-sm font-medium text-white transition-colors hover:bg-cyan-600"
        >
          <Plus size={16} />
          {t('teacher:contentTree.addChapter')}
        </button>
      </div>

      {/* Unsaved changes indicator */}
      {isDirty && (
        <div className="px-4 pt-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            <AlertTriangle size={12} />
            {t('teacher:contentTree.unsavedChanges', 'Unsaved changes')}
          </span>
        </div>
      )}

      {/* Tree body */}
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {isLoading ? (
          <ContentTreeLoadingState />
        ) : isError ? (
          <ContentTreeErrorState onRetry={onRetry} />
        ) : displayChapters.length === 0 ? (
          <ContentTreeEmptyState onAddChapter={onAddChapter} />
        ) : (
          <SortableList
            id="chapters"
            items={displayChapters.map((c) => c.id)}
            disabled={!canReorder || displayChapters.length <= 1 || isMutating}
          >
            <div role="tree" className="flex flex-col gap-0.5">
              {displayChapters.map((chapter, idx) => {
                const chapterExpanded = expandedNodes.has(chapter.id);
                const displayLessons =
                  lessonItemsMap[chapter.id] ?? chapter.lessons;

                return (
                  <SortableItem
                    key={chapter.id}
                    id={chapter.id}
                    disabled={!canReorder || isMutating}
                    data={{ type: 'chapter', containerId: 'chapters' }}
                  >
                    {(dragProps) => (
                      <div>
                        <TreeNode
                          type="chapter"
                          label={chapter.name}
                          sortOrder={idx + 1}
                          level={0}
                          hasChildren={chapter.lessons.length > 0}
                          isExpanded={chapterExpanded}
                          isSelected={
                            selectedItem?.type === 'chapter' &&
                            selectedItem.id === chapter.id
                          }
                          onToggle={() => onToggle(chapter.id)}
                          onSelect={() =>
                            onSelect({ type: 'chapter', id: chapter.id })
                          }
                          onMenuAction={(action) =>
                            action === 'delete'
                              ? onRequestDelete({
                                  type: 'chapter',
                                  id: chapter.id,
                                  name: chapter.name,
                                  childrenCount: chapter.lessons.length,
                                })
                              : onMenuAction(
                                  { type: 'chapter', id: chapter.id },
                                  action,
                                )
                          }
                          dragHandle={dragProps}
                        />
                        {chapterExpanded && (
                          <SortableList
                            id={getLessonContainerId(chapter.id)}
                            items={displayLessons.map((l) => l.id)}
                            disabled={
                              !canReorder ||
                              displayLessons.length <= 1 ||
                              isMutating
                            }
                          >
                            {displayLessons.map((lesson, lIdx) => (
                              <SortableItem
                                key={lesson.id}
                                id={lesson.id}
                                disabled={!canReorder || isMutating}
                                data={{
                                  type: 'lesson',
                                  containerId:
                                    getLessonContainerId(chapter.id),
                                }}
                              >
                                {(lp) => (
                                  <TreeNode
                                    key={lesson.id}
                                    type="lesson"
                                    label={lesson.title}
                                    sortOrder={lIdx + 1}
                                    level={1}
                                    hasChildren={false}
                                    isExpanded={false}
                                    isSelected={
                                      selectedItem?.type === 'lesson' &&
                                      selectedItem.id === lesson.id
                                    }
                                    onToggle={() => {}}
                                    onSelect={() =>
                                      onSelect({
                                        type: 'lesson',
                                        id: lesson.id,
                                      })
                                    }
                                    onMenuAction={(action) =>
                                      action === 'delete'
                                        ? onRequestDelete({
                                            type: 'lesson',
                                            id: lesson.id,
                                            name: lesson.title,
                                            childrenCount: 0,
                                          })
                                        : onMenuAction(
                                            { type: 'lesson', id: lesson.id },
                                            action,
                                          )
                                    }
                                    dragHandle={lp}
                                  />
                                )}
                              </SortableItem>
                            ))}
                          </SortableList>
                        )}
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </div>
          </SortableList>
        )}
      </div>
    </div>
  );
}
