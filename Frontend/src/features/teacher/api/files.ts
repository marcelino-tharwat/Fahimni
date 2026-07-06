import { apiClient } from '@/shared/lib/api/client';

interface StagingFileEntry {
  stagingPath: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
}

interface AttachResult {
  id: string;
  filePath: string;
  displayName: string;
  fileSize: number;
  mimeType: string;
  indexingStatus: string;
}

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

  uploadPdfStaging: async (
    file: File,
    teacherId: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('teacherId', teacherId);

    const { data } = await apiClient.post<{ success: boolean; filePath: string }>(
      '/v1/upload/pdf/staging',
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

  attachFilesToLesson: async (
    lessonId: string,
    files: StagingFileEntry[],
  ): Promise<AttachResult[]> => {
    const { data } = await apiClient.post<{ success: boolean; records: AttachResult[] }>(
      `/v1/lessons/${lessonId}/attach-files`,
      { files },
    );
    return data.records;
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
