import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types/api';
import type { Stage, Chapter } from '@/shared/types/content';
import type { Lesson } from '@/features/teacher/types/lesson';
import type { GenerateQuizPayload, GenerateQuizResponse } from '@/features/teacher/types/quizGeneration';
import type { Chapter as TeacherChapter } from '@/features/teacher/types/chapter';

export const quizGenerationApi = {
  getStages: async (): Promise<Stage[]> => {
    const { data } = await apiClient.get<ApiResponse<Stage[]>>('/stages');
    return data.data;
  },

  getChaptersByStage: async (stageId: string): Promise<Chapter[]> => {
    const { data } = await apiClient.get<ApiResponse<Chapter[]>>(`/stages/${stageId}/chapters`);
    return data.data;
  },

  getLessonsByChapter: async (chapterId: string): Promise<Lesson[]> => {
    const { data } = await apiClient.get<ApiResponse<Lesson[]>>(`/chapters/${chapterId}/lessons`);
    return data.data;
  },

  generateQuiz: async (payload: GenerateQuizPayload): Promise<GenerateQuizResponse> => {
    const body: Record<string, unknown> = { ...payload };
    if (body.lessonIds && Array.isArray(body.lessonIds) && body.lessonIds.length > 0) {
      delete body.chapterId;
    } else {
      delete body.lessonIds;
    }
    const { data } = await apiClient.post<{ success: boolean; data: GenerateQuizResponse }>(
      '/quizzes/generate',
      body,
    );
    return data.data;
  },

  // ── STORY-55 / STORY-46: draft review & edit (real persistence) ─────────

  /** GET /quizzes/:id — full draft quiz with all questions. */
  getDraftQuiz: async (quizId: string): Promise<DraftQuizResponse> => {
    const { data } = await apiClient.get<ApiResponse<DraftQuizResponse>>(`/quizzes/${quizId}`);
    return data.data;
  },

  /** POST /quizzes/:id/questions — manually add a question to the draft. */
  createQuestion: async (quizId: string, body: QuestionWriteBody): Promise<DraftQuestion> => {
    const { data } = await apiClient.post<ApiResponse<DraftQuestion>>(
      `/quizzes/${quizId}/questions`,
      body,
    );
    return data.data;
  },

  /** PUT /quizzes/:id/questions/:questionId — update a question (keeps its id). */
  updateQuestion: async (
    quizId: string,
    questionId: string,
    body: Partial<QuestionWriteBody>,
  ): Promise<DraftQuestion> => {
    const { data } = await apiClient.put<ApiResponse<DraftQuestion>>(
      `/quizzes/${quizId}/questions/${questionId}`,
      body,
    );
    return data.data;
  },

  /** DELETE /quizzes/:id/questions/:questionId — remove a question. */
  deleteQuestion: async (quizId: string, questionId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}/questions/${questionId}`);
  },

  /** PATCH /quizzes/:id/questions/reorder — persist the final order (all ids). */
  reorderQuestions: async (quizId: string, orderedIds: string[]): Promise<void> => {
    await apiClient.patch(`/quizzes/${quizId}/questions/reorder`, orderedIds);
  },

  // ── STORY-56: publish & list ─────────────────────────────────────────────

  /** GET /quizzes — list quizzes owned by the current teacher. */
  listQuizzes: async (status?: string): Promise<QuizListItem[]> => {
    const params = status ? `?status=${status}` : '';
    const { data } = await apiClient.get<ApiResponse<QuizListItem[]>>(`/quizzes${params}`);
    return data.data;
  },

  /** PATCH /quizzes/:id/publish — publish a draft quiz. */
  publishQuiz: async (quizId: string): Promise<QuizListItem> => {
    const { data } = await apiClient.patch<ApiResponse<QuizListItem>>(`/quizzes/${quizId}/publish`);
    return data.data;
  },

  /** POST /quizzes/:id/unpublish — unpublish a quiz back to draft. */
  unpublishQuiz: async (quizId: string): Promise<QuizListItem> => {
    const { data } = await apiClient.post<ApiResponse<QuizListItem>>(`/quizzes/${quizId}/unpublish`);
    return data.data;
  },

  /** POST /quizzes/:id/assign — assign quiz to a chapter. */
  assignQuiz: async (quizId: string, chapterId: string): Promise<QuizListItem> => {
    const { data } = await apiClient.post<ApiResponse<QuizListItem>>(`/quizzes/${quizId}/assign`, { chapterId });
    return data.data;
  },

  /** PUT /quizzes/:id — update quiz metadata. */
  updateQuiz: async (quizId: string, body: UpdateQuizBody): Promise<QuizListItem> => {
    const { data } = await apiClient.put<ApiResponse<QuizListItem>>(`/quizzes/${quizId}`, body);
    return data.data;
  },

  /** DELETE /quizzes/:id — delete a draft quiz. */
  deleteQuiz: async (quizId: string): Promise<void> => {
    await apiClient.delete(`/quizzes/${quizId}`);
  },

  // ── STORY-68: quiz results ───────────────────────────────────────────────

  /** GET /quizzes/:quizId/results — all attempts with per-question breakdown. */
  getQuizResults: async (quizId: string): Promise<QuizResultsResponse> => {
    const { data } = await apiClient.get<ApiResponse<QuizResultsResponse>>(`/quizzes/${quizId}/results`);
    return data.data;
  },

  /** GET /quizzes/:quizId/results/export — CSV file download (blob). */
  getQuizResultsExport: async (quizId: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(`/quizzes/${quizId}/results/export`, {
      responseType: 'blob',
    });
    return data;
  },
};

export interface DraftQuestion {
  id: string;
  quizId: string;
  type: string;
  content: string;
  options?: unknown;
  correctAnswer?: string | number | boolean | null;
  sortOrder: number;
  points?: number;
}

export interface DraftQuizResponse {
  id: string;
  title: string;
  description?: string | null;
  chapterId: string | null;
  status: string;
  questionCount: number;
  totalPoints: number;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  questions: DraftQuestion[];
}

export interface QuizListItem {
  id: string;
  title: string;
  description: string | null;
  chapterId: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  durationMinutes: number | null;
  questionCount: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface UpdateQuizBody {
  title?: string;
  description?: string | null;
  durationMinutes?: number | null;
}

export interface QuestionWriteBody {
  type: 'MCQ' | 'TRUE_FALSE' | 'ESSAY';
  content: string;
  options: Record<string, string>;
  correctAnswer: string | null;
  sortOrder?: number;
}

// ── STORY-68: quiz results types ──────────────────────────────────────────

export interface StudentResultQuestion {
  questionId: string;
  questionText: string;
  type: string;
  result: string;
  awardedPoints: number | null;
  maxPoints: number;
  answer: string;
  correctAnswer: string | null;
  feedback?: string;
}

export interface StudentResultRow {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentMobile: string;
  status: string;
  score: number;
  totalPoints: number;
  percentage: number;
  pendingEssayCount: number;
  submittedAt: string | null;
  questions: StudentResultQuestion[];
}

export interface QuizResultsResponse {
  quizId: string;
  count: number;
  results: StudentResultRow[];
}
