import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/api/client', () => ({ apiClient: { post: mockPost } }));

import { enrollFree } from './enrollment';

describe('enrollment API', () => {
  beforeEach(() => { mockPost.mockReset(); });

  it('enrollFree() posts to /enrollments/free with chapterId', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { id: 'enr_1', status: 'ACTIVE' } } });
    await enrollFree('ch_123');
    expect(mockPost).toHaveBeenCalledWith('/enrollments/free', { chapterId: 'ch_123' });
  });

  it('enrollFree() propagates COURSE_NOT_AVAILABLE error with safe message', async () => {
    const apiError = { response: { data: { code: 'COURSE_NOT_AVAILABLE', message: 'هذا المحتوى غير متاح حاليًا' } } };
    mockPost.mockRejectedValue(apiError);

    try {
      await enrollFree('ch_banned');
      expect(true).toBe(false);
    } catch (e) {
      const err = e as Record<string, unknown>;
      expect(err.response).toBeTruthy();
      const resp = err.response as Record<string, unknown>;
      expect(resp.data).toBeTruthy();
      const d = resp.data as Record<string, unknown>;
      expect(d.code).toBe('COURSE_NOT_AVAILABLE');
      expect(d.message).toBe('هذا المحتوى غير متاح حاليًا');
      expect(String(d.message)).not.toContain('BANNED');
      expect(String(d.message)).not.toContain('banned');
      expect(String(d.message)).not.toContain('teacher');
    }
  });
});
