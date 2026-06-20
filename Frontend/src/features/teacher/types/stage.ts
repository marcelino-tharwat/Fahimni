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

export interface UpdateStagePayload {
  name?: string;
  description?: string | null;
  // sortOrder is managed by reorder, not by the edit form
  // at least one field required by the backend
}

export interface CreateStagePayload {
  name: string; // required, 1-200 chars
  description?: string; // optional, max 2000
  // sortOrder is auto-assigned by the backend for stages
}
