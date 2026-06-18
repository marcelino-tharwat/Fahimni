export interface StageResponseDTO {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  teacherId: string;
  chapterCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}
