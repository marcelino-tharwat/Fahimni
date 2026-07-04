import { apiClient } from '@/shared/lib/api/client';

export interface StudentLessonMaterial {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  canPreview: boolean;
  canDownload: boolean;
  hasDownloaded: boolean;
  firstDownloadedAt: string | null;
  lastDownloadedAt: string | null;
}

export function parseFilenameFromDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const basic = header.match(/filename="([^"]+)"/i);
  return basic?.[1] ?? null;
}

export async function downloadLessonMaterial(materialId: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await apiClient.get<Blob>(`/lesson-materials/${materialId}/download`, {
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const filename =
    parseFilenameFromDisposition(disposition) ?? `material-${materialId}.pdf`;

  return { blob: response.data, filename };
}

export async function previewLessonMaterial(materialId: string): Promise<void> {
  const response = await apiClient.get<Blob>(`/lesson-materials/${materialId}/preview`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(response.data);
  const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(blobUrl);
    throw new Error('PREVIEW_BLOCKED');
  }
  win.addEventListener('beforeunload', () => URL.revokeObjectURL(blobUrl));
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
