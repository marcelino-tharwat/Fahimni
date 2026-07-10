export const stagePublicFields = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
  teacherId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface StageResponseDTO {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  teacherId: string | null;
  isActive: boolean;
  chapterCount: number;
  lessonCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type StagePublicFields = typeof stagePublicFields;
