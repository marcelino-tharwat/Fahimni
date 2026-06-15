export interface ChapterResponseDTO {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  stageId: string;
  lessonsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageParams {
  stageId?: string;
}

export const chapterPublicFields = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
  price: true,
  stageId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ChapterPublicFields = typeof chapterPublicFields;
