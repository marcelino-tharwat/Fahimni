import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/api/client', () => ({ apiClient: { post: mockPost } }));

import { paymentApi } from './payment';

describe('paymentApi', () => {
  beforeEach(() => { mockPost.mockReset(); });

  it('checkout() posts to /payments/checkout with chapterId', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { iframeUrl: 'https://paymob.test', orderId: 'ord_1' } } });
    await paymentApi.checkout('ch_123');
    expect(mockPost).toHaveBeenCalledWith('/payments/checkout', { chapterId: 'ch_123' });
  });

  it('checkout() propagates COURSE_NOT_AVAILABLE error code from backend', async () => {
    const apiError = { response: { data: { code: 'COURSE_NOT_AVAILABLE', message: 'هذا المحتوى غير متاح حاليًا' } } };
    mockPost.mockRejectedValue(apiError);

    try {
      await paymentApi.checkout('ch_banned');
      expect(true).toBe(false);
    } catch (e) {
      const err = e as Record<string, unknown>;
      expect(err.response).toBeTruthy();
      const resp = err.response as Record<string, unknown>;
      expect(resp.data).toBeTruthy();
      const d = resp.data as Record<string, unknown>;
      expect(d.code).toBe('COURSE_NOT_AVAILABLE');
      expect(d.message).toBe('هذا المحتوى غير متاح حاليًا');
    }
  });
});
