export interface ChapterResponseDTO {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  price: number | null;
  imageUrl: string | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  isVisible: boolean;
  teacherId: string;
  stageId: string;
  lessonsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lighter response DTO for the STUDENT-facing GET /chapters/:id endpoint.
 * Omits internal fields (sortOrder, createdAt, updatedAt) and includes the
 * stage name so the frontend can render breadcrumbs without an extra join.
 */
export interface StudentChapterResponseDTO {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  term: "FIRST_TERM" | "SECOND_TERM";
  stageId: string;
  stageName: string;
  lessonsCount: number;
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
  imageUrl: true,
  term: true,
  isVisible: true,
  teacherId: true,
  stageId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ChapterPublicFields = typeof chapterPublicFields;
