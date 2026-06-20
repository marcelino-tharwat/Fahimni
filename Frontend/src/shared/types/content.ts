export interface Stage {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  order: number;
}

export interface Chapter {
  id: string;
  tenantId: string;
  stageId: string;
  name: string;
  description?: string;
  price: number;
  order: number;
  isUnlocked: boolean;
}

export interface AttachmentDTO {
  id: string;
  filePath: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  /** Signed download URL — present only on single-lesson fetches,
   *  omitted from list/reorder responses. */
  url?: string;
}

export interface Lesson {
  id: string;
  tenantId: string;
  chapterId: string;
  title: string;
  description: string;
  durationMinutes: number;
  youtubeUrl: string;
  sortOrder: number;
  attachments: AttachmentDTO[];
  progress?: LessonProgress;
}

export interface LessonProgress {
  lessonId: string;
  studentId: string;
  percentWatched: number;
  completed: boolean;
  lastWatchedAt: string;
}
