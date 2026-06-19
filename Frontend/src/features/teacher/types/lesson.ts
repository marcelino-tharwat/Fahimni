/**
 * Lesson types — mirror the backend Lesson DTO
 * (backend/src/modules/lessons/lessons.types.ts).
 *
 * Note: the lesson name field is `title` (not `name`). `pdfUrls` holds
 * Supabase storage object keys (max 10), not presigned URLs.
 */
export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  youtubeUrl: string | null;
  sortOrder: number;
  pdfUrls: string[] | null;
  chapterId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonPayload {
  title: string; // required, 1-200 chars
  durationMinutes: number; // required, 1-300
  sortOrder: number; // required, >= 1
  description?: string; // optional, max 2000
  youtubeUrl?: string; // optional, must be a valid YouTube URL
  pdfUrls?: string[]; // optional, max 10 storage keys
}

export interface UpdateLessonPayload {
  title?: string;
  description?: string;
  durationMinutes?: number;
  youtubeUrl?: string | null;
  sortOrder?: number;
  pdfUrls?: string[] | null;
  // at least one field required by the backend
}
