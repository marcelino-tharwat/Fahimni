/**
 * Shared types for the content-tree components. Kept in their own module so
 * TreeNode and TreeNodeMenu can reference each other's types without a
 * component import cycle.
 */
export type NodeType = 'stage' | 'chapter' | 'lesson';

/** A reference to an existing node (used for selection in edit mode). */
export interface NodeRef {
  type: NodeType;
  id: string;
}

/**
 * What the editor panel is showing: an existing node (edit), or a pending
 * create scoped to a parent. `null` shows the empty state.
 */
export type SelectedItem =
  | NodeRef
  | { type: 'new-chapter'; parentStageId: string }
  | { type: 'new-lesson'; parentChapterId: string };

export type MenuAction = 'edit' | 'addChapter' | 'addLesson' | 'delete';

/** A pending delete request — carries the metadata the confirm modal needs. */
export interface DeleteTarget {
  type: NodeType;
  id: string;
  name: string;
  /** Chapters for a stage, lessons for a chapter, 0 for a lesson. */
  childrenCount: number;
}
