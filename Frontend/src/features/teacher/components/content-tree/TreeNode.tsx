import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { TreeNodeMenu } from './TreeNodeMenu';
import type { SortableRenderProps } from '@/features/teacher/components/reorder/SortableItem';
import type { MenuAction, NodeType } from './types';

const ICON_BY_TYPE: Record<NodeType, LucideIcon> = {
  stage: Layers,
  chapter: BookOpen,
  lesson: FileText,
};

const ICON_COLOR_BY_TYPE: Record<NodeType, string> = {
  stage: 'text-cyan-600',
  chapter: 'text-purple-500',
  lesson: 'text-gray-500',
};

const TEXT_BY_TYPE: Record<NodeType, string> = {
  stage: 'font-bold text-navy-900',
  chapter: 'font-medium text-navy-800',
  lesson: 'font-normal text-navy-700',
};

// Reuse the exact render-prop shape SortableItem produces so the dnd-kit
// attribute/listener types line up (no lossy Record<string, unknown>).
type DragHandleRenderProps = Pick<
  SortableRenderProps,
  'attributes' | 'listeners' | 'setNodeRef' | 'style' | 'isDragging'
>;

interface TreeNodeProps {
  type: NodeType;
  label: string;
  sortOrder: number;
  /** 0-based depth; controls indentation (flips in RTL). */
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onMenuAction: (action: MenuAction) => void;
  /** Optional drag handle render props from SortableItem. */
  dragHandle?: DragHandleRenderProps | null;
}

export function TreeNode({
  type,
  label,
  sortOrder,
  level,
  hasChildren,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onMenuAction,
  dragHandle,
}: TreeNodeProps) {
  const Icon = ICON_BY_TYPE[type];
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      ref={dragHandle?.setNodeRef}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      // Logical padding so indentation flips correctly in RTL.
      style={{ ...dragHandle?.style, paddingInlineStart: 8 + level * 24 }}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-lg py-2 pe-2 transition-colors',
        isSelected ? 'bg-cyan-50 ring-1 ring-inset ring-cyan-200' : 'hover:bg-gray-100',
        dragHandle?.isDragging && 'opacity-50',
      )}
    >
      {/* Drag handle — only rendered when provided by SortableItem */}
      {dragHandle ? (
        <button
          type="button"
          className="shrink-0 cursor-grab rounded p-0.5 text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-navy-600 group-hover:opacity-100 active:cursor-grabbing"
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </button>
      ) : null}

      {/* Expand / collapse arrow, or a spacer for leaf nodes */}
      {hasChildren ? (
        <button
          type="button"
          aria-label="toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-navy-600"
        >
          <ChevronIcon size={16} />
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" aria-hidden="true" />
      )}

      {/* Type icon */}
      <Icon size={16} className={cn('shrink-0', ICON_COLOR_BY_TYPE[type])} />

      {/* Sort order */}
      <span className="shrink-0 font-cairo text-xs text-gray-400">{sortOrder}</span>

      {/* Name / title */}
      <span className={cn('flex-1 truncate font-cairo text-sm', TEXT_BY_TYPE[type])}>
        {label}
      </span>

      {/* Context menu (revealed on row hover/focus) */}
      <TreeNodeMenu nodeType={type} onAction={onMenuAction} revealOnHover />
    </div>
  );
}
