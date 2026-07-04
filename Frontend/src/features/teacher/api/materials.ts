import { apiClient } from '@/shared/lib/api/client';

export interface TeacherMaterialDownloadStatus {
  material: {
    id: string;
    displayName: string;
    fileName: string;
    lessonId: string;
    lessonTitle: string;
  };
  summary: {
    enrolledStudentCount: number;
    downloadedCount: number;
    notDownloadedCount: number;
  };
  students: Array<{
    studentId: string;
    studentName: string;
    hasDownloaded: boolean;
    firstDownloadedAt: string | null;
    lastDownloadedAt: string | null;
  }>;
}

export async function fetchMaterialDownloadStatuses(
  materialId: string,
): Promise<TeacherMaterialDownloadStatus> {
  const { data } = await apiClient.get<{
    success: boolean;
    data: TeacherMaterialDownloadStatus;
  }>(`/lesson-materials/${materialId}/download-statuses`);
  return data.data;
}
