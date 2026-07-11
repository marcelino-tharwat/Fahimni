/**
 * Chapter types — mirror the backend Chapter DTO
 * (backend/src/modules/chapter/chapter.types.ts).
 *
 * Note: the list/detail count field is `lessonsCount` (with an 's'),
 * matching the backend Chapter DTO. The content tree uses `lessonCount`
 * (no 's') — see types/contentTree.ts.
 */
export interface Chapter {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null; // null = free chapter
  imageUrl?: string | null;
  term: 'FIRST_TERM' | 'SECOND_TERM';
  isVisible: boolean;
  stageId: string;
  lessonsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChapterPayload {
  name: string; // required, 1-200 chars
  sortOrder: number; // required, >= 1
  description?: string; // optional, max 2000
  price?: number; // optional, >= 0 (omit/null = free)
  subject?: string;
  term: 'FIRST_TERM' | 'SECOND_TERM';
  isVisible?: boolean;
  image?: File | null;
}

export interface UpdateChapterPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
  price?: number | null;
  term?: 'FIRST_TERM' | 'SECOND_TERM';
  isVisible?: boolean;
  image?: File | null;
  removeImage?: boolean;
  // at least one field required by the backend
}
