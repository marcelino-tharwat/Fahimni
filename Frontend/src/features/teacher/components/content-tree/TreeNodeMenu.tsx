import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, MoreVertical } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';
import type { MenuAction, NodeType } from './types';

const DEFAULT_ACTIONS: Record<NodeType, MenuAction[]> = {
  stage: ['edit', 'addChapter', 'delete'],
  chapter: ['edit', 'addLesson', 'delete'],
  lesson: ['edit', 'delete'],
};

/** Fixed-position coords for the portalled dropdown (aligned to the trigger's inline-end). */
interface MenuCoords {
  top: number;
  left?: number;
  right?: number;
}

interface TreeNodeMenuProps {
  nodeType: NodeType;
  onAction: (action: MenuAction) => void;
  /** Override the default per-type action list (e.g. header stage menu). */
  actions?: MenuAction[];
  /** Fade the trigger in only on hover/focus of the parent `group` row. */
  revealOnHover?: boolean;
  /** Use vertical dots (⋮) instead of horizontal (⋯) — e.g. the editor header. */
  vertical?: boolean;
  className?: string;
}

export function TreeNodeMenu({
  nodeType,
  onAction,
  actions,
  revealOnHover = false,
  vertical = false,
  className,
}: TreeNodeMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = actions ?? DEFAULT_ACTIONS[nodeType];

  // Anchor the dropdown to the trigger's inline-end. Opens downward with a 6px
  // gap; flips above the trigger if it would overflow the viewport bottom.
  // `right` in LTR / `left` in RTL avoids needing to measure the menu width.
  const computeCoords = (): MenuCoords | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';

    const GAP = 6;
    // Estimated height (~40px per item + py-1 container) for the flip decision.
    const dropdownHeight = items.length * 40 + 8;
    const openUpward = rect.bottom + GAP + dropdownHeight > window.innerHeight;
    const top = openUpward ? rect.top - dropdownHeight - GAP : rect.bottom + GAP;

    return isRtl
      ? { top, left: rect.left }
      : { top, right: window.innerWidth - rect.right };
  };

  useEffect(() => {
    if (!open) return;

    // The menu lives in a portal (outside this subtree), so the outside-click
    // check must consider both the trigger and the portalled menu node.
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function reposition() {
      setCoords(computeCoords());
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    // capture: true so we also catch scrolling of the inner (overflow-auto) tree
    // container, keeping the menu glued to the trigger.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const DotsIcon = vertical ? MoreVertical : MoreHorizontal;

  const labelFor = (action: MenuAction): string => {
    switch (action) {
      case 'edit':
        return t('actions.edit');
      case 'delete':
        return t('actions.delete');
      case 'addChapter':
        return t('teacher:contentTree.addChapter');
      case 'addLesson':
        return t('teacher:contentTree.addLesson');
    }
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setCoords(computeCoords());
      setOpen(true);
    }
  };

  return (
    <div className={cn('shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        className={cn(
          'rounded-btn p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-600',
          revealOnHover &&
            'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100',
        )}
      >
        <DotsIcon size={16} />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, right: coords.right }}
            className="z-[100] min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {items.map((action) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onAction(action);
                }}
                className={cn(
                  'flex w-full items-center px-4 py-2 text-start font-cairo text-sm transition-colors',
                  action === 'delete'
                    ? 'text-danger-600 hover:bg-danger-50'
                    : 'text-navy-800 hover:bg-gray-50',
                )}
              >
                {labelFor(action)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
