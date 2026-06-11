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

export interface Lesson {
  id: string;
  tenantId: string;
  chapterId: string;
  title: string;
  description: string;
  duration: number;
  youtubeUrl: string;
  order: number;
  attachments: LessonAttachment[];
  progress?: LessonProgress;
}

export interface LessonAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  url: string;
}

export interface LessonProgress {
  lessonId: string;
  studentId: string;
  percentWatched: number;
  completed: boolean;
  lastWatchedAt: string;
}
