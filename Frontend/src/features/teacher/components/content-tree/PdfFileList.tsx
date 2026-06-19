import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2 } from 'lucide-react';
import { Progress } from '@/shared/components/ui';
import type { UploadingFile } from '@/features/teacher/hooks/usePdfUpload';

interface PdfFileListProps {
  files: UploadingFile[];
  onRemove: (id: string) => void;
  maxFiles?: number;
  maxTotalSize?: number;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function PdfFileList({
  files,
  onRemove,
  maxFiles = 10,
  maxTotalSize = 500,
}: PdfFileListProps) {
  const { t } = useTranslation('teacher');

  if (files.length === 0) return null;

  const totalSizeMB = (files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(1);

  return (
    <div className="mt-4">
      <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {files.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <FileText size={20} className="shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-cairo text-sm font-medium text-gray-800">
                    {f.name}
                  </span>
                  <span className="shrink-0 font-cairo text-xs text-gray-400">
                    {f.size > 0 ? formatSize(f.size) : ''}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1">
                    <Progress
                      value={f.progress}
                      size="sm"
                      className={f.status === 'error' ? '[&>div>div]:bg-red-500' : ''}
                    />
                  </div>
                  <span
                    className={`shrink-0 font-cairo text-xs ${
                      f.status === 'completed'
                        ? 'text-green-600'
                        : f.status === 'error'
                          ? 'text-red-500'
                          : 'text-gray-500'
                    }`}
                  >
                    {f.status === 'completed'
                      ? '100%'
                      : f.status === 'error'
                        ? f.error ?? 'Error'
                        : `${f.progress}%`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                disabled={f.status === 'uploading'}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                title={t('contentTree.editor.pdfList.deleteConfirm')}
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="font-cairo text-xs text-gray-400">
          {t('contentTree.editor.pdfList.filesUploaded', { count: files.length })}
        </span>
        <span className="font-cairo text-xs text-gray-400">
          {t('contentTree.editor.pdfList.storageUsed', { used: totalSizeMB })}
        </span>
      </div>
    </div>
  );
}
