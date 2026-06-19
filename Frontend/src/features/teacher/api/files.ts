import { apiClient } from '@/shared/lib/api/client';

export const filesApi = {
  uploadPdf: async (
    file: File,
    teacherId: string,
    lessonId: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('teacherId', teacherId);
    formData.append('lessonId', lessonId);

    const { data } = await apiClient.post<{ success: boolean; filePath: string }>(
      '/v1/upload/pdf',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      },
    );
    return data.filePath;
  },

  deletePdf: async (path: string): Promise<void> => {
    await apiClient.delete('/v1/files', { params: { path } });
  },

  getSignedUrl: async (path: string): Promise<string> => {
    const { data } = await apiClient.get<{ signedUrl: string }>('/v1/signed-url', {
      params: { path },
    });
    return data.signedUrl;
  },
};
