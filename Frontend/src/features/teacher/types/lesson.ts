import type { AttachmentDTO } from '@/shared/types';

/**
 * Lesson types — mirror the backend Lesson DTO
 * (backend/src/modules/lessons/lessons.types.ts).
 *
 * Note: the lesson name field is `title` (not `name`). PDFs are returned as
 * `attachments` (LessonMaterial records with a signed `url` and the storage
 * `filePath`), not as raw `pdfUrls` keys.
 */
export interface Lesson {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  youtubeUrl: string | null;
  sortOrder: number;
  attachments: AttachmentDTO[];
  chapterId: string;
  requiredQuizId?: string | null;
  linkedQuizzes?: Array<{ id: string; title: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonPayload {
  title: string; // required, 1-200 chars
  durationMinutes: number; // required, 1-300
  sortOrder: number; // required, >= 1
  description?: string; // optional, max 2000
  youtubeUrl?: string; // optional, must be a valid YouTube URL
}

export interface UpdateLessonPayload {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  youtubeUrl?: string | null;
  sortOrder?: number;
  requiredQuizId?: string | null;
}
