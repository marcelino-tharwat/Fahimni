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
  chapterCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}
