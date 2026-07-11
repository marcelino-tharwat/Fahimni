export const stagePublicFields = {
  id: true,
  name: true,
  nameAr: true,
  nameEn: true,
  description: true,
  descriptionAr: true,
  descriptionEn: true,
  sortOrder: true,
  teacherId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface StageResponseDTO {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  displayName?: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  displayDescription?: string | null;
  sortOrder: number;
  teacherId: string | null;
  isActive: boolean;
  chapterCount: number;
  lessonCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type StagePublicFields = typeof stagePublicFields;
