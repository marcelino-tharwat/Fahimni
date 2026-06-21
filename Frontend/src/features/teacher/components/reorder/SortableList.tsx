import { type ReactNode } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface SortableListProps {
  id: string;
  items: string[];
  disabled?: boolean;
  children: ReactNode;
}

export function SortableList({
  id,
  items,
  disabled = false,
  children,
}: SortableListProps) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}
