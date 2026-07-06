import { useState, useCallback, useRef } from 'react';
import { filesApi } from '@/features/teacher/api/files';

export interface UploadingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  storageKey?: string;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

let fileIdCounter = 0;

interface UsePdfUploadOptions {
  teacherId: string;
  lessonId?: string;
  existingKeys?: string[];
  /** When false, files are held as `pending` until `startUpload()` is called */
  uploadImmediately?: boolean;
  /** Upload to staging (no lessonId needed). Files attached to lesson later. */
  staging?: boolean;
}

export function usePdfUpload({
  teacherId,
  lessonId: initialLessonId,
  existingKeys,
  uploadImmediately = true,
  staging = false,
}: UsePdfUploadOptions) {
  const [files, setFiles] = useState<UploadingFile[]>(() =>
    (existingKeys ?? []).map((key) => ({
      id: `existing-${key}`,
      file: new File([], key),
      name: key.split('/').pop() ?? key,
      size: 0,
      progress: 100,
      status: 'completed' as const,
      storageKey: key,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const uploadingRef = useRef(false);
  const lessonIdRef = useRef(initialLessonId ?? '');

  const completedKeys = files
    .filter((f) => f.status === 'completed' && f.storageKey)
    .map((f) => f.storageKey!);

  const isUploading = files.some((f) => f.status === 'uploading');
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const clearError = useCallback(() => setError(null), []);

  const addFiles = useCallback(
    async (newFiles: File[]) => {
      setError(null);

      const totalAfterAdd = files.length + newFiles.length;
      if (totalAfterAdd > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      for (const f of newFiles) {
        if (f.type !== 'application/pdf') {
          setError('Only PDF files are allowed');
          return;
        }
        if (f.size > MAX_FILE_SIZE) {
          setError(`File "${f.name}" exceeds 50MB limit`);
          return;
        }
      }

      const currentTotal = files.reduce((sum, f) => sum + f.size, 0);
      const addedTotal = newFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentTotal + addedTotal > MAX_TOTAL_SIZE) {
        setError('Total size exceeds 500MB limit');
        return;
      }

      const newUploading: UploadingFile[] = newFiles.map((f) => ({
        id: `upload-${++fileIdCounter}`,
        file: f,
        name: f.name,
        size: f.size,
        progress: 0,
        status: 'pending' as const,
      }));

      setFiles((prev) => [...prev, ...newUploading]);

      if (!uploadImmediately) return;
      if (!lessonIdRef.current && !staging) return;

      uploadingRef.current = true;

      const useStaging = staging && !lessonIdRef.current;

      const results = await Promise.allSettled(
        newUploading.map(
          (uf) =>
            new Promise<void>((resolve, reject) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uf.id ? { ...f, status: 'uploading' as const, progress: 0 } : f,
                ),
              );

              const uploadPromise = useStaging
                ? filesApi.uploadPdfStaging(uf.file, teacherId, (percent) => {
                    setFiles((prev) =>
                      prev.map((f) => (f.id === uf.id ? { ...f, progress: percent } : f)),
                    );
                  })
                : filesApi.uploadPdf(uf.file, teacherId, lessonIdRef.current, (percent) => {
                    setFiles((prev) =>
                      prev.map((f) => (f.id === uf.id ? { ...f, progress: percent } : f)),
                    );
                  });

              uploadPromise
                .then((storageKey) => {
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === uf.id
                        ? { ...f, status: 'completed' as const, progress: 100, storageKey }
                        : f,
                    ),
                  );
                  resolve();
                })
                .catch((err) => {
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === uf.id
                        ? {
                            ...f,
                            status: 'error' as const,
                            error: err?.message ?? 'Upload failed',
                          }
                        : f,
                    ),
                  );
                  reject(err);
                });
            }),
        ),
      );

      uploadingRef.current = false;

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        setError(`${failures.length} file(s) failed to upload`);
      }
    },
    [files, teacherId, uploadImmediately, staging],
  );

  const startUpload = useCallback(
    async (newLessonId: string): Promise<string[]> => {
      lessonIdRef.current = newLessonId;

      if (staging) {
        const stagedFiles = files.filter(
          (f) => f.status === 'completed' && f.storageKey,
        );
        if (stagedFiles.length === 0) return [];

        uploadingRef.current = true;

        try {
          for (const f of stagedFiles) {
            setFiles((prev) =>
              prev.map((pf) =>
                pf.id === f.id ? { ...pf, status: 'uploading' as const, progress: 0 } : pf,
              ),
            );
          }

          const stagingEntries = stagedFiles.map((f) => ({
            stagingPath: f.storageKey!,
            originalName: f.name,
            fileSize: f.size,
            mimeType: 'application/pdf',
          }));

          const records = await filesApi.attachFilesToLesson(newLessonId, stagingEntries);

          const pathMap = new Map<string, string>();
          stagedFiles.forEach((sf, i) => {
            pathMap.set(sf.storageKey!, records[i]?.filePath ?? sf.storageKey!);
          });

          setFiles((prev) =>
            prev.map((pf) =>
              pf.storageKey && pathMap.has(pf.storageKey)
                ? { ...pf, status: 'completed' as const, progress: 100, storageKey: pathMap.get(pf.storageKey)! }
                : pf,
            ),
          );

          return Array.from(pathMap.values());
        } catch (err) {
          setFiles((prev) =>
            prev.map((pf) =>
              pf.status === 'uploading'
                ? { ...pf, status: 'error' as const, error: 'Failed to attach files' }
                : pf,
            ),
          );
          setError('Failed to attach files to lesson');
          return [];
        } finally {
          uploadingRef.current = false;
        }
      }

      const pendingFiles = files.filter((f) => f.status === 'pending');
      if (pendingFiles.length === 0) return [];

      const keys: string[] = [];
      uploadingRef.current = true;

      const results = await Promise.allSettled(
        pendingFiles.map(
          (uf) =>
            new Promise<void>((resolve, reject) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === uf.id ? { ...f, status: 'uploading' as const, progress: 0 } : f,
                ),
              );

              filesApi
                .uploadPdf(uf.file, teacherId, newLessonId, (percent) => {
                  setFiles((prev) =>
                    prev.map((f) => (f.id === uf.id ? { ...f, progress: percent } : f)),
                  );
                })
                .then((storageKey) => {
                  keys.push(storageKey);
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === uf.id
                        ? { ...f, status: 'completed' as const, progress: 100, storageKey }
                        : f,
                    ),
                  );
                  resolve();
                })
                .catch((err) => {
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.id === uf.id
                        ? {
                            ...f,
                            status: 'error' as const,
                            error: err?.message ?? 'Upload failed',
                          }
                        : f,
                    ),
                  );
                  reject(err);
                });
            }),
        ),
      );

      uploadingRef.current = false;

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        setError(`${failures.length} file(s) failed to upload`);
      }

      return keys;
    },
    [files, teacherId, staging],
  );

  const removeFile = useCallback(
    async (id: string) => {
      const target = files.find((f) => f.id === id);
      if (!target) return;

      if (target.storageKey) {
        try {
          await filesApi.deletePdf(target.storageKey);
        } catch {
          // Silently ignore delete errors — orphaning is acceptable
        }
      }

      setFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [files],
  );

  return {
    files,
    addFiles,
    removeFile,
    completedKeys,
    isUploading,
    totalSize,
    error,
    clearError,
    startUpload,
  };
}
