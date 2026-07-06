import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

vi.mock('@/shared/lib/api/client', () => ({
  apiClient: { post: mockPost, delete: mockDelete, get: mockGet },
}));

import { filesApi } from './files';

describe('filesApi - teacherId removal', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockDelete.mockReset();
    mockGet.mockReset();
  });

  it('18a. uploadPdf does NOT send teacherId in FormData', async () => {
    mockPost.mockResolvedValue({
      data: { success: true, filePath: 'test/path.pdf' },
    });

    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    const result = await filesApi.uploadPdf(file, 'lesson-123');

    expect(result).toBe('test/path.pdf');

    const [url, formData, config] = mockPost.mock.calls[0]!;
    expect(url).toBe('/v1/upload/pdf');
    expect(formData).toBeInstanceOf(FormData);

    // teacherId must NOT appear in the FormData
    expect(formData.has('teacherId')).toBe(false);

    // lessonId and file must still be present
    expect(formData.has('lessonId')).toBe(true);
    expect(formData.get('lessonId')).toBe('lesson-123');
    expect(formData.has('file')).toBe(true);

    // Content-Type header must be multipart
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('18b. uploadPdf works without onProgress callback', async () => {
    mockPost.mockResolvedValue({
      data: { success: true, filePath: 'path.pdf' },
    });

    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const result = await filesApi.uploadPdf(file, 'lesson-456');

    expect(result).toBe('path.pdf');
    const formData = mockPost.mock.calls[0]![1] as FormData;
    expect(formData.has('teacherId')).toBe(false);
  });

  it('18c. deletePdf and getSignedUrl still work unchanged', async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });
    mockGet.mockResolvedValue({ data: { signedUrl: 'https://example.com/file' } });

    await filesApi.deletePdf('some/path.pdf');
    expect(mockDelete).toHaveBeenCalledWith('/v1/files', {
      params: { path: 'some/path.pdf' },
    });

    const url = await filesApi.getSignedUrl('some/path.pdf');
    expect(url).toBe('https://example.com/file');
    expect(mockGet).toHaveBeenCalledWith('/v1/signed-url', {
      params: { path: 'some/path.pdf' },
    });
  });
});
