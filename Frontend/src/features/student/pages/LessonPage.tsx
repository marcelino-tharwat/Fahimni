import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Layers,
  Eye,
  FileText,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils/cn';
import { useLesson, useStudentTree } from '@/features/student/hooks/useStudentContent';
import { contentApi } from '@/features/student/api/content';
import type { StudentContentTreeItem } from '@/features/student/types/studentContent';
import type { ApiError } from '@/shared/lib/api/client';

function extractYouTubeId(url: string): string | null {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

interface LessonParentInfo {
  stageName: string;
  chapterName: string;
}

function findLessonInTree(
  tree: StudentContentTreeItem[],
  lessonId: string,
): LessonParentInfo | null {
  for (const item of tree) {
    for (const ch of item.chapters) {
      const found = ch.lessons.find((l) => l.id === lessonId);
      if (found) {
        return { stageName: item.stage.name, chapterName: ch.chapter.name };
      }
    }
  }
  return null;
}

interface FlatLesson {
  id: string;
  title: string;
}

function flattenLessons(tree: StudentContentTreeItem[]): FlatLesson[] {
  const result: FlatLesson[] = [];
  for (const item of tree) {
    for (const ch of item.chapters) {
      for (const lesson of ch.lessons) {
        result.push({ id: lesson.id, title: lesson.title });
      }
    }
  }
  return result;
}

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: lesson, isLoading, isError, error } = useLesson(lessonId ?? '');
  const apiError = error as ApiError | null;
  const { data: tree } = useStudentTree();

  useEffect(() => {
    if (lessonId) {
      contentApi.incrementViewCount(lessonId).catch(() => {});
    }
  }, [lessonId]);

  const parentInfo = useMemo(() => {
    if (!tree) return null;
    return findLessonInTree(tree, lessonId ?? '');
  }, [tree, lessonId]);

  const allLessons = useMemo(() => {
    if (!tree) return [];
    return flattenLessons(tree);
  }, [tree]);

  const currentIndex = useMemo(() => {
    return allLessons.findIndex((l) => l.id === lessonId);
  }, [allLessons, lessonId]);

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allLessons.length - 1
      ? allLessons[currentIndex + 1]
      : null;

  if (isLoading) return <LessonSkeleton />;

  if (isError || !lesson) {
    // 403 / NOT_ENROLLED → distinct enrollment required state
    if (apiError?.statusCode === 403 || apiError?.code === 'NOT_ENROLLED') {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 py-20 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <Lock size={40} className="text-amber-500" />
          </span>
          <h2 className="font-cairo text-xl font-bold text-navy-900">
            {t('student:lesson.enrollmentRequired.title')}
          </h2>
          <p className="font-cairo text-sm text-gray-500">
            {t('student:lesson.enrollmentRequired.description')}
          </p>
          <Link
            to="/student/content"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900"
          >
            {t('student:lesson.enrollmentRequired.cta')}
          </Link>
        </div>
      );
    }

    // 404 or any other error → not found / generic error
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 py-20 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-danger-50">
          <AlertCircle size={40} className="text-danger-500" />
        </span>
        <h2 className="font-cairo text-xl font-bold text-navy-900">
          {t('student:lesson.notFound.title')}
        </h2>
        <p className="font-cairo text-sm text-gray-500">
          {t('student:lesson.notFound.description')}
        </p>
        <Link
          to="/student/content"
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900"
        >
          {t('student:lesson.notFound.back')}
        </Link>
      </div>
    );
  }

  const youtubeId = lesson.youtubeUrl ? extractYouTubeId(lesson.youtubeUrl) : null;
  const showVideo = youtubeId !== null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 font-cairo text-sm text-gray-500">
        <Link to="/student/content" className="hover:text-accent transition-colors">
          {t('student:content.tabs.allContent')}
        </Link>
        {parentInfo && (
          <>
            <span>/</span>
            <span>{parentInfo.stageName}</span>
            <span>/</span>
            <span>{parentInfo.chapterName}</span>
          </>
        )}
        <span>/</span>
        <span className="font-semibold text-navy-900">{lesson.title}</span>
      </nav>

      {/* YouTube embed / video error state */}
      {showVideo ? (
        <div className="relative w-full overflow-hidden rounded-card pb-[56.25%] bg-gray-200">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={lesson.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex w-full items-center justify-center rounded-card bg-gray-100 py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle size={40} className="text-gray-400" />
            <p className="font-cairo text-sm font-medium text-gray-500">
              {t('student:lesson.videoUnavailable')}
            </p>
          </div>
        </div>
      )}

      {/* Lesson info */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Badge variant="default" className="w-fit">
              {t('student:lesson.lessonLabel', { order: lesson.order })}
            </Badge>
            <h1 className="font-cairo text-2xl font-bold text-navy-900">{lesson.title}</h1>
          </div>
        </div>
        {lesson.description && (
          <p className="font-cairo text-gray-500">{lesson.description}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 font-cairo text-sm text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock size={16} />
            {lesson.duration} {t('student:lesson.minutes')}
          </span>
          {parentInfo && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen size={16} />
                {parentInfo.chapterName}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers size={16} />
                {parentInfo.stageName}
              </span>
            </>
          )}
          {lesson.progress && (
            <span className="inline-flex items-center gap-1.5">
              <Eye size={16} />
              {lesson.progress.percentWatched}%
            </span>
          )}
        </div>
      </div>

      {/* PDF Materials */}
      {(lesson.pdfUrls?.length ?? 0) > 0 && (
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <FileText size={20} className="text-accent" />
            <h2 className="font-cairo text-base font-semibold text-navy-900">
              {t('student:lesson.pdfMaterials')}
            </h2>
          </div>
          {(lesson.pdfUrls ?? []).map((url, index) => {
            const fileName = url.split('/').pop() ?? url;
            return (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-input border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={20} className="shrink-0 text-accent" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-cairo text-sm font-medium text-navy-900">
                      {fileName}
                    </span>
                  </div>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-button border border-border px-3 font-cairo text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
                >
                  {t('student:lesson.download')}
                </a>
              </div>
            );
          })}
          <div className="border-t border-border pt-3 font-cairo text-xs text-gray-500">
            {t('student:lesson.totalFiles', { count: lesson.pdfUrls?.length ?? 0 })}
          </div>
        </Card>
      )}

      {/* Previous / Next navigation */}
      <div className="grid grid-cols-2 gap-4">
        {prevLesson ? (
          <Button
            variant="outline"
            onClick={() => navigate(`/student/lessons/${prevLesson.id}`)}
            className="flex-col items-start gap-1"
          >
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <ChevronLeft size={14} />
              {t('student:lesson.previousLesson')}
            </span>
            <span className="line-clamp-1 text-start font-cairo text-sm font-medium">
              {prevLesson.title}
            </span>
          </Button>
        ) : (
          <div />
        )}

        {nextLesson ? (
          <Button
            variant="primary"
            onClick={() => navigate(`/student/lessons/${nextLesson.id}`)}
            className="col-start-2 flex-col items-end gap-1"
          >
            <span className="inline-flex items-center gap-1 text-xs text-white/70">
              {t('student:lesson.nextLesson')}
              <ChevronRight size={14} />
            </span>
            <span className="line-clamp-1 text-end font-cairo text-sm font-medium">
              {nextLesson.title}
            </span>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton state                                                     */
/* ------------------------------------------------------------------ */

function LessonSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="w-full pb-[56.25%] rounded-card" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Card padding="md" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-9 w-20 rounded-button" />
          </div>
        ))}
      </Card>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-16 rounded-button" />
        <Skeleton className="h-16 rounded-button" />
      </div>
    </div>
  );
}
