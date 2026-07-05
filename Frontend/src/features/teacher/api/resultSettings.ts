import { apiClient } from '@/shared/lib/api/client';

export type PendingEssayResultMode =
  | 'HIDE_ALL_RESULTS'
  | 'SHOW_OBJECTIVE_ONLY'
  | 'SHOW_OBJECTIVE_WITH_PENDING_MESSAGE';

export interface ResultSettings {
  showCorrectAnswers: boolean;
  showPerQuestionScores: boolean;
  showFinalScore: boolean;
  showStudentAnswers: boolean;
  showExplanations: boolean;
  pendingEssayResultMode: PendingEssayResultMode;
}

export interface ResultSettingsResponse extends ResultSettings {
  quizId: string;
  configured: boolean;
}

/** Teacher result-visibility settings API (OPERATION + quiz ownership). */
export const resultSettingsApi = {
  async get(quizId: string): Promise<ResultSettingsResponse> {
    const { data } = await apiClient.get<{ data: ResultSettingsResponse }>(
      `/quizzes/${quizId}/result-settings`,
    );
    return data.data;
  },
  async update(
    quizId: string,
    body: Partial<ResultSettings>,
  ): Promise<ResultSettingsResponse> {
    const { data } = await apiClient.put<{ data: ResultSettingsResponse }>(
      `/quizzes/${quizId}/result-settings`,
      body,
    );
    return data.data;
  },
};
