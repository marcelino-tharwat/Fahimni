import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { post: mockPost, get: mockGet },
}));

import { tutorApi } from './aiTutor';

describe('tutorApi', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();
  });

  it('ask() calls POST /tutor/ask with question body', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: { answer: 'إجابة', citations: [] },
      },
    });

    const res = await tutorApi.ask('سؤال كيمياء صالح للاختبار');
    expect(mockPost).toHaveBeenCalledWith('/tutor/ask', {
      question: 'سؤال كيمياء صالح للاختبار',
    });
    expect(res.answer).toBe('إجابة');
  });

  it('getUsageToday() calls GET /tutor/usage-today', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        data: { used: 1, limit: 20, remaining: 19, resetsAt: '2026-07-02T00:00:00.000Z' },
      },
    });

    const usage = await tutorApi.getUsageToday();
    expect(mockGet).toHaveBeenCalledWith('/tutor/usage-today');
    expect(usage.remaining).toBe(19);
  });

  it('sendMessage() calls persistent conversation endpoint', async () => {
    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          conversation: { id: 'c1' },
          studentMessage: { id: 'm1', role: 'STUDENT', content: 'سؤال', status: 'COMPLETED', citations: [], createdAt: '' },
          assistantMessage: null,
          usage: { used: 1, limit: 20, remaining: 19, resetsAt: '' },
        },
      },
    });

    await tutorApi.sendMessage('c1', {
      content: 'سؤال كيمياء صالح للاختبار',
      clientMessageId: '11111111-1111-4111-8111-111111111111',
    });

    expect(mockPost).toHaveBeenCalledWith('/tutor/conversations/c1/messages', {
      content: 'سؤال كيمياء صالح للاختبار',
      clientMessageId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
