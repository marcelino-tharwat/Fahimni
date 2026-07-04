export interface StudentMaterialDTO {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  canPreview: boolean;
  canDownload: boolean;
  /** True only after backend records a successful download — requires DB tracking model. */
  hasDownloaded: boolean;
  firstDownloadedAt: string | null;
  lastDownloadedAt: string | null;
}

export interface MaterialDownloadStatusStudentRow {
  studentId: string;
  studentName: string;
  hasDownloaded: boolean;
  firstDownloadedAt: string | null;
  lastDownloadedAt: string | null;
}

export interface TeacherMaterialDownloadStatusResponse {
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
  students: MaterialDownloadStatusStudentRow[];
}
