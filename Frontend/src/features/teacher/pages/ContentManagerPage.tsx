import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, FileText, FilePen } from 'lucide-react';
import { Card, EmptyState } from '@/shared/components/ui';
import { mockStages, mockChapters, mockLessons } from '@/shared/mocks/content';

export function ContentManagerPage() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string[]>(['chapter-1']);

  const toggle = (chapterId: string) => {
    setExpanded((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cairo text-2xl font-bold text-text-primary">
        {t('teacher:contentManager.title')}
      </h1>

      <div className="flex flex-col gap-4 md:flex-row">
        {/* Content tree (~40%) */}
        <Card padding="md" className="flex flex-col gap-2 md:w-2/5">
          {mockStages.map((stage) => (
            <div key={stage.id} className="flex flex-col gap-1">
              <span className="px-2 py-1 font-cairo text-sm font-bold text-text-secondary">
                {stage.name}
              </span>

              {mockChapters
                .filter((chapter) => chapter.stageId === stage.id)
                .map((chapter) => {
                  const isOpen = expanded.includes(chapter.id);
                  const lessons = mockLessons.filter((lesson) => lesson.chapterId === chapter.id);
                  return (
                    <div key={chapter.id} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => toggle(chapter.id)}
                        className="flex items-center gap-2 rounded-button px-2 py-2 text-start font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
                      >
                        {isOpen ? (
                          <ChevronDown size={16} className="shrink-0" />
                        ) : (
                          <ChevronLeft size={16} className="shrink-0 rtl:rotate-180" />
                        )}
                        <span className="truncate">{chapter.name}</span>
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-1 ps-6">
                          {lessons.length > 0 ? (
                            lessons.map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-2 rounded-button px-2 py-1.5 font-cairo text-sm text-text-secondary"
                              >
                                <FileText size={15} className="shrink-0" />
                                <span className="truncate">{lesson.title}</span>
                              </div>
                            ))
                          ) : (
                            <span className="px-2 py-1 font-cairo text-xs text-text-secondary">
                              {t('status.empty')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </Card>

        {/* Editor placeholder (~60%) */}
        <Card padding="md" className="flex items-center justify-center md:w-3/5">
          <EmptyState icon={FilePen} title={t('teacher:contentManager.selectLesson')} />
        </Card>
      </div>
    </div>
  );
}
