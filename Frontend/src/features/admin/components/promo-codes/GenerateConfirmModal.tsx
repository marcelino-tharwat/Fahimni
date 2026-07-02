import { useEffect, useMemo, useState } from 'react';
import { Ticket, Plus, Loader2, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/shared/components/ui/Modal';
import { cn } from '@/shared/lib/utils/cn';
import { useContentTree } from '@/features/teacher/hooks/useContentTree';

export interface GenerateConfirmModalProps {
  isOpen: boolean;
  onConfirm: (chapterId: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

const selectClassName =
  'h-12 w-full appearance-none rounded-input border border-gray-300 bg-gray-50 px-4 font-cairo text-sm text-navy-800 outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50';

export function GenerateConfirmModal({
  isOpen,
  onConfirm,
  onClose,
  isLoading,
}: GenerateConfirmModalProps) {
  const { t } = useTranslation('common');
  const [stageId, setStageId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const { data: tree, isLoading: treeLoading } = useContentTree();

  const stages = tree ?? [];

  const chapterOptions = useMemo(() => {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return [];
    return stage.chapters.map((chapter) => ({
      id: chapter.id,
      label: chapter.name,
    }));
  }, [stages, stageId]);

  useEffect(() => {
    if (!isOpen) {
      setStageId('');
      setChapterId('');
      return;
    }
    if (stages.length === 1) {
      setStageId(stages[0]!.id);
    }
  }, [isOpen, stages]);

  useEffect(() => {
    if (chapterOptions.length === 1) {
      setChapterId(chapterOptions[0]!.id);
      return;
    }
    setChapterId('');
  }, [chapterOptions]);

  const handleConfirm = () => {
    if (!chapterId.trim()) return;
    onConfirm(chapterId.trim());
  };

  const hasChapters = stages.some((stage) => stage.chapters.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-cyan-gradient text-white shadow-[0_0_32px_rgba(0,201,219,0.3)]">
          <Ticket size={32} />
        </div>

        <div className="text-center">
          <h3 className="font-cairo text-lg font-semibold text-navy-800">
            {t('promoCodes.confirmTitle')}
          </h3>
          <p className="mx-auto mt-2 max-w-xs font-cairo text-sm leading-relaxed text-gray-600">
            {t('promoCodes.confirmDesc')}
          </p>
          <p className="mt-1.5 font-cairo text-xs text-gray-500">
            {t('promoCodes.confirmValidity')}
          </p>
        </div>

        <div className="w-full rounded-xl border border-gray-200 bg-gray-50/80 p-4">
          {treeLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 size={22} className="animate-spin text-cyan-500" />
            </div>
          ) : !hasChapters ? (
            <p className="rounded-input border border-warning-500/30 bg-warning-50 px-3 py-3 font-cairo text-sm leading-relaxed text-warning-700">
              {t('promoCodes.noChapters')}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-cairo text-sm font-medium text-navy-900">
                  {t('promoCodes.stageLabel')}
                </label>
                <div className="relative">
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className={cn(selectClassName, 'pe-10')}
                  >
                    <option value="">{t('promoCodes.stagePlaceholder')}</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-cairo text-sm font-medium text-navy-900">
                  {t('promoCodes.chapterLabel')}
                </label>
                <div className="relative">
                  <select
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    disabled={!stageId}
                    className={cn(selectClassName, 'pe-10')}
                  >
                    <option value="">{t('promoCodes.chapterPlaceholder')}</option>
                    {chapterOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !chapterId.trim() || !hasChapters}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-gradient font-cairo text-sm font-semibold text-white shadow-glow transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {t('promoCodes.creating')}
              </>
            ) : (
              <>
                <Plus size={16} />
                {t('promoCodes.confirmButton')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-full rounded-xl font-cairo text-sm font-medium text-gray-600 transition-all hover:opacity-75"
          >
            {t('promoCodes.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
