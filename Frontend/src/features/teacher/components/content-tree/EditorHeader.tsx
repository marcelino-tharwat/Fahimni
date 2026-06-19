import { BookOpen, FileText, Layers, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import { TreeNodeMenu } from './TreeNodeMenu';
import type { NodeType } from './types';

const ICON_BY_TYPE: Record<NodeType, LucideIcon> = {
  stage: Layers,
  chapter: BookOpen,
  lesson: FileText,
};

const ICON_BG_BY_TYPE: Record<NodeType, string> = {
  stage: 'bg-cyan-500',
  chapter: 'bg-purple-500',
  lesson: 'bg-gray-500',
};

interface EditorHeaderProps {
  type: NodeType;
  title: string;
  /** Optional delete handler — renders a ⋯ menu with a Delete action. */
  onDelete?: () => void;
}

export function EditorHeader({ type, title, onDelete }: EditorHeaderProps) {
  const Icon = ICON_BY_TYPE[type];

  return (
    <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white',
          ICON_BG_BY_TYPE[type],
        )}
      >
        <Icon size={20} />
      </span>
      <h2 className="flex-1 truncate font-cairo text-lg font-bold text-navy-900">{title}</h2>
      {onDelete && (
        <TreeNodeMenu nodeType={type} actions={['delete']} vertical onAction={() => onDelete()} />
      )}
    </div>
  );
}
