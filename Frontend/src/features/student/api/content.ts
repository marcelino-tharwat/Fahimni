import { apiClient } from '@/shared/lib/api/client';

export const contentApi = {
  getStages: () => apiClient.get('/stages'),
  getChapters: (stageId: string) => apiClient.get(`/stages/${stageId}/chapters`),
  getLessons: (chapterId: string) => apiClient.get(`/chapters/${chapterId}/lessons`),
  getLesson: (lessonId: string) => apiClient.get(`/content/student/lessons/${lessonId}`),
  createLesson: (data: unknown) => apiClient.post('/lessons', data),
  updateLesson: (id: string, data: unknown) => apiClient.put(`/lessons/${id}`, data),
  deleteLesson: (id: string) => apiClient.delete(`/lessons/${id}`),
  incrementViewCount: (lessonId: string) =>
    apiClient.post(`/content/student/lessons/${lessonId}/view`),
  completeLesson: (lessonId: string) =>
    apiClient.post(`/content/student/lessons/${lessonId}/complete`),
};
