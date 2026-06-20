export interface AttachmentDTO {
  id: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  url: string;
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
