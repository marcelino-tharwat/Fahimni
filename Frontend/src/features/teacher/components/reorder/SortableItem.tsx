import React, { type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SortableRenderProps {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  setNodeRef: (el: HTMLElement | null) => void;
  style: CSSProperties | undefined;
  isDragging: boolean;
  transform: ReturnType<typeof useSortable>['transform'];
  transition: string | undefined;
}

interface SortableItemProps {
  id: string;
  disabled?: boolean;
  data?: Record<string, unknown>;
  children: (props: SortableRenderProps) => ReactNode;
}

export const SortableItem = React.memo(function SortableItem({
  id,
  disabled = false,
  data,
  children,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, data });

  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  return children({
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging,
    transform,
    transition,
  }) as React.ReactElement;
});
