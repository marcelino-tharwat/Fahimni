import { apiClient } from '@/shared/lib/api/client';

export const contentApi = {
  getStages: () => apiClient.get('/stages'),
  getChapters: (stageId: string) => apiClient.get(`/stages/${stageId}/chapters`),
  getLessons: (chapterId: string) => apiClient.get(`/chapters/${chapterId}/lessons`),
  getLesson: (lessonId: string) => apiClient.get(`/lessons/${lessonId}`),
  createLesson: (data: unknown) => apiClient.post('/lessons', data),
  updateLesson: (id: string, data: unknown) => apiClient.put(`/lessons/${id}`, data),
  deleteLesson: (id: string) => apiClient.delete(`/lessons/${id}`),
};
