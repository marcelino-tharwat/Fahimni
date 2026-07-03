export interface AttachmentDTO {
  id: string;
  filePath: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  /** Signed download URL. Only populated on single-lesson (full) fetches;
   *  omitted from list/reorder responses to avoid per-file storage round-trips. */
  url?: string;
}

export interface LessonResponseDTO {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ChapterParams {
  chapterId?: string;
}

export const lessonPublicFields = {
  id: true,
  title: true,
  description: true,
  durationMinutes: true,
  youtubeUrl: true,
  sortOrder: true,
  chapterId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type LessonPublicFields = typeof lessonPublicFields;
