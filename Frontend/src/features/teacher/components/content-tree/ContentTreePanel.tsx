import { useTranslation } from 'react-i18next';
import { Layers, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import type { ContentTreeChapter } from '@/features/teacher/types/contentTree';
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
  isFetching: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  selectedItem: SelectedItem | null;
  onSelect: (item: NodeRef) => void;
  onAddChapter: () => void;
  onMenuAction: (item: NodeRef, action: MenuAction) => void;
  onRequestDelete: (target: DeleteTarget) => void;
}

export function ContentTreePanel({
  stageId,
  stageName,
  chapters,
  isLoading,
  isError,
  isFetching,
  onRefresh,
  onRetry,
  expandedNodes,
  onToggle,
  selectedItem,
  onSelect,
  onAddChapter,
  onMenuAction,
  onRequestDelete,
}: ContentTreePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col rounded-card border border-gray-100 bg-surface shadow-sm">
      {/* Header — shows the stage name (this panel is scoped to one stage) */}
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        <Layers size={18} className="shrink-0 text-cyan-600" />
        <h2 className="flex-1 truncate font-cairo text-base font-bold text-navy-900">
          {stageName}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t('actions.refresh', 'Refresh')}
          className="rounded-btn p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-600"
        >
          <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
        </button>
        <TreeNodeMenu
          nodeType="stage"
          actions={['edit', 'delete']}
          onAction={(action) =>
            action === 'delete'
              ? onRequestDelete({
                  type: 'stage',
                  id: stageId,
                  name: stageName,
                  childrenCount: chapters.length,
                })
              : onMenuAction({ type: 'stage', id: stageId }, action)
          }
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

      {/* Tree body */}
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {isLoading ? (
          <ContentTreeLoadingState />
        ) : isError ? (
          <ContentTreeErrorState onRetry={onRetry} />
        ) : chapters.length === 0 ? (
          <ContentTreeEmptyState onAddChapter={onAddChapter} />
        ) : (
          <div role="tree" className="flex flex-col gap-0.5">
            {chapters.map((chapter) => {
              const chapterExpanded = expandedNodes.has(chapter.id);
              return (
                <div key={chapter.id}>
                  <TreeNode
                    type="chapter"
                    label={chapter.name}
                    sortOrder={chapter.sortOrder}
                    level={0}
                    hasChildren={chapter.lessons.length > 0}
                    isExpanded={chapterExpanded}
                    isSelected={
                      selectedItem?.type === 'chapter' && selectedItem.id === chapter.id
                    }
                    onToggle={() => onToggle(chapter.id)}
                    onSelect={() => onSelect({ type: 'chapter', id: chapter.id })}
                    onMenuAction={(action) =>
                      action === 'delete'
                        ? onRequestDelete({
                            type: 'chapter',
                            id: chapter.id,
                            name: chapter.name,
                            childrenCount: chapter.lessons.length,
                          })
                        : onMenuAction({ type: 'chapter', id: chapter.id }, action)
                    }
                  />
                  {chapterExpanded &&
                    chapter.lessons.map((lesson) => (
                      <TreeNode
                        key={lesson.id}
                        type="lesson"
                        label={lesson.title}
                        sortOrder={lesson.sortOrder}
                        level={1}
                        hasChildren={false}
                        isExpanded={false}
                        isSelected={
                          selectedItem?.type === 'lesson' && selectedItem.id === lesson.id
                        }
                        onToggle={() => {}}
                        onSelect={() => onSelect({ type: 'lesson', id: lesson.id })}
                        onMenuAction={(action) =>
                          action === 'delete'
                            ? onRequestDelete({
                                type: 'lesson',
                                id: lesson.id,
                                name: lesson.title,
                                childrenCount: 0,
                              })
                            : onMenuAction({ type: 'lesson', id: lesson.id }, action)
                        }
                      />
                    ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
