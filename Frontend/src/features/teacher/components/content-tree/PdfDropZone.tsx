import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/shared/lib/utils/cn';

interface PdfDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function PdfDropZone({ onFilesSelected, disabled, className }: PdfDropZoneProps) {
  const { t } = useTranslation('teacher');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const pdfs: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.type === 'application/pdf') {
          pdfs.push(f);
        }
      }
      if (pdfs.length > 0) {
        onFilesSelected(pdfs);
      }
    },
    [onFilesSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all duration-200',
        dragging
          ? 'border-cyan-500 bg-cyan-50/50'
          : 'border-gray-300 bg-gray-50/50 hover:border-gray-400 hover:bg-gray-50',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <motion.div
        animate={dragging ? { y: -4, scale: 1.1 } : { y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-2"
      >
        <UploadCloud
          size={36}
          className={dragging ? 'text-cyan-500' : 'text-gray-400'}
        />
        <p className="font-cairo text-sm text-gray-600">
          {t('contentTree.editor.pdfDropzone.dragDrop')}
        </p>
        <span className="font-cairo text-xs text-gray-400">{t('contentTree.editor.pdfDropzone.or')}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          className="mt-1 rounded-lg border border-cyan-500 px-4 py-1.5 font-cairo text-sm font-medium text-cyan-600 transition-colors hover:bg-cyan-50 disabled:opacity-50"
        >
          {t('contentTree.editor.pdfDropzone.chooseFiles')}
        </button>
        <p className="mt-1 font-cairo text-xs text-gray-400">
          {t('contentTree.editor.pdfDropzone.hint')}
        </p>
      </motion.div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
