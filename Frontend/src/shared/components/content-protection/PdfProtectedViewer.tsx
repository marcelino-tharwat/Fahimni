import { useEffect, useRef, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { apiClient } from '@/shared/lib/api/client';
import { ProtectedContent } from './ProtectedContent';
import type { ProtectionPolicy } from './protectionTypes';
import { cn } from '@/shared/lib/utils/cn';

GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfProtectedViewerProps {
  materialId: string;
  className?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

export function PdfProtectedViewer({ materialId, className }: PdfProtectedViewerProps) {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const policy: ProtectionPolicy = {
    disableCopy: true,
    disableContextMenu: true,
    disablePrint: true,
    disableDragStart: true,
  };

  const renderPage = useCallback(async (pageNum: number) => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderTask = page.render({
        canvasContext: ctx,
        canvas: canvas,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
    } catch (err) {
      if ((err as Error)?.name === 'RenderingCancelledException') return;
      setStatus('error');
      setErrorMessage((err as Error)?.message ?? 'Failed to render page');
    }
  }, []);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        const response = await apiClient.get<ArrayBuffer>(
          `/lesson-materials/${materialId}/preview`,
          { responseType: 'arraybuffer' },
        );

        const loadingTask = getDocument({ data: response.data });
        loadingTaskRef.current = loadingTask;
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setStatus('ready');
        void renderPage(1);
      } catch (err) {
        setStatus('error');
        setErrorMessage((err as Error)?.message ?? 'Failed to load PDF');
      }
    };

    void loadPdf();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      pdfDocRef.current = null;
    };
  }, [materialId, renderPage]);

  const goToPrev = useCallback(() => {
    const next = Math.max(1, currentPage - 1);
    setCurrentPage(next);
    void renderPage(next);
  }, [currentPage, renderPage]);

  const goToNext = useCallback(() => {
    const next = Math.min(pageCount, currentPage + 1);
    setCurrentPage(next);
    void renderPage(next);
  }, [currentPage, pageCount, renderPage]);

  if (status === 'loading') {
    return (
      <div className={cn('flex items-center justify-center py-20', className)}>
        <p className="font-cairo text-sm text-gray-500">جاري تحميل الملف...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={cn('flex items-center justify-center py-20', className)}>
        <p className="font-cairo text-sm text-red-500">
          {errorMessage ?? 'حدث خطأ أثناء تحميل الملف'}
        </p>
      </div>
    );
  }

  return (
    <ProtectedContent policy={policy} className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative w-full max-w-4xl overflow-auto rounded-card border border-border bg-white shadow-card">
        <canvas ref={canvasRef} className="mx-auto block w-full" />
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-4" dir="rtl">
          <button
            type="button"
            onClick={goToPrev}
            disabled={currentPage <= 1}
            className={cn(
              'min-h-[44px] rounded-btn px-4 text-sm font-semibold transition-colors',
              currentPage <= 1
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-navy-800 text-white hover:bg-navy-900',
            )}
          >
            السابق
          </button>

          <span className="font-cairo text-sm text-gray-600">
            {currentPage} / {pageCount}
          </span>

          <button
            type="button"
            onClick={goToNext}
            disabled={currentPage >= pageCount}
            className={cn(
              'min-h-[44px] rounded-btn px-4 text-sm font-semibold transition-colors',
              currentPage >= pageCount
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-navy-800 text-white hover:bg-navy-900',
            )}
          >
            التالي
          </button>
        </div>
      )}
    </ProtectedContent>
  );
}
