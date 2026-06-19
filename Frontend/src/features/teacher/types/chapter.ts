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
}

export interface UpdateChapterPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
  price?: number | null;
  // at least one field required by the backend
}
