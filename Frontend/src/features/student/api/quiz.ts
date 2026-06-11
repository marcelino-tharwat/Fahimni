import { apiClient } from '@/shared/lib/api/client';

export const quizApi = {
  generateQuiz: (params: unknown) => apiClient.post('/quizzes/generate', params),
  getQuiz: (quizId: string) => apiClient.get(`/quizzes/${quizId}`),
  updateQuiz: (quizId: string, data: unknown) => apiClient.put(`/quizzes/${quizId}`, data),
  publishQuiz: (quizId: string) => apiClient.post(`/quizzes/${quizId}/publish`),
  submitAttempt: (quizId: string, answers: unknown) =>
    apiClient.post(`/quizzes/${quizId}/attempts`, { answers }),
  getResults: (quizId: string) => apiClient.get(`/quizzes/${quizId}/results`),
};
