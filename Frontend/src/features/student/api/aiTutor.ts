import { apiClient } from '@/shared/lib/api/client';

export const aiTutorApi = {
  sendMessage: (message: string) => apiClient.post('/ai-tutor/messages', { message }),
  getHistory: () => apiClient.get('/ai-tutor/history'),
  getRemainingQuestions: () => apiClient.get('/ai-tutor/remaining-questions'),
};
