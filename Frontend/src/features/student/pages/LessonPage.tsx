import { useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  BookOpen,
  Layers,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@/shared/components/ui';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { useLesson, useStudentTree, useCompleteLesson } from '@/features/student/hooks/useStudentContent';
import { resolveLessonLockMessage } from '@/features/student/lib/lessonAccessErrors';
import type { StudentLessonNode } from '@/features/student/types/studentContent';
import { contentApi } from '@/features/student/api/content';
import type { StudentContentTreeItem } from '@/features/student/types/studentContent';
import type { ApiError } from '@/shared/lib/api/client';
import { ProtectedContent } from '@/shared/components/content-protection';
import { LessonQuizSections } from '@/features/student/components/LessonQuizSections';
import { LessonMaterialsSection } from '@/features/student/components/LessonMaterialsSection';

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

function findTreeLessonNode(
  tree: StudentContentTreeItem[],
  lessonId: string,
): StudentLessonNode | null {
  for (const item of tree) {
    for (const ch of item.chapters) {
      const found = ch.lessons.find((l) => l.id === lessonId);
      if (found) return found;
    }
  }
  return null;
}

function findLessonTitle(
  tree: StudentContentTreeItem[],
  lessonId: string,
): string | null {
  const node = findTreeLessonNode(tree, lessonId);
  return node?.title ?? null;
}

/** Previous unlocked lesson in the same chapter (backend lock state). */
function findPreviousUnlockedLesson(
  tree: StudentContentTreeItem[],
  lessonId: string,
): StudentLessonNode | null {
  for (const item of tree) {
    for (const ch of item.chapters) {
      const index = ch.lessons.findIndex((l) => l.id === lessonId);
      if (index <= 0) continue;
      for (let i = index - 1; i >= 0; i--) {
        const candidate = ch.lessons[i];
        if (candidate?.isUnlocked) return candidate;
      }
    }
  }
  return null;
}

interface FlatLesson {
  id: string;
  title: string;
}

function siblingLessons(
  tree: StudentContentTreeItem[],
  lessonId: string,
): FlatLesson[] {
  for (const item of tree) {
    for (const ch of item.chapters) {
      if (ch.lessons.some((l) => l.id === lessonId)) {
        return ch.lessons
          .filter((l) => l.id !== lessonId && l.isUnlocked)
          .map((l) => ({ id: l.id, title: l.title }));
      }
    }
  }
  return [];
}

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: lesson, isLoading, isError, error } = useLesson(lessonId ?? '');
  const completeLesson = useCompleteLesson();
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

  const treeLesson = useMemo(() => {
    if (!tree || !lessonId) return null;
    return findTreeLessonNode(tree, lessonId);
  }, [tree, lessonId]);

  const prevLesson = useMemo(() => {
    if (!tree || !lessonId) return null;
    return findPreviousUnlockedLesson(tree, lessonId);
  }, [tree, lessonId]);

  const relatedLessons = useMemo(() => {
    if (!tree) return [];
    return siblingLessons(tree, lessonId ?? '');
  }, [tree, lessonId]);

  const nextLessonId = lesson?.nextLessonId ?? treeLesson?.nextLessonId ?? null;
  const nextLessonTitle = nextLessonId && tree ? findLessonTitle(tree, nextLessonId) : null;

  const isLessonCompleted =
    lesson?.progressStatus === 'COMPLETED' || treeLesson?.progressStatus === 'COMPLETED';

  const lessonQuizzes = lesson?.quizzes ?? { available: [], required: null };
  const gateQuizFailed = lessonQuizzes.required?.displayStatus === 'failed';

  const handleMaterialDownloaded = useCallback(
    (_materialId: string) => {
      if (!lessonId) return;
      void queryClient.invalidateQueries({ queryKey: ['student', 'lesson', lessonId] });
    },
    [lessonId, queryClient],
  );

  if (isLoading) return <LessonSkeleton />;

  if (isError || !lesson) {
    if (apiError?.statusCode === 403 || apiError?.code === 'NOT_ENROLLED') {
      const lockCode = apiError?.code;
      const isEnrollment =
        lockCode === 'NOT_ENROLLED' || lockCode === 'ENROLLMENT_REQUIRED';

      if (!isEnrollment && lockCode) {
        return (
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 py-20 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Lock size={40} className="text-gray-500" />
            </span>
            <h2 className="font-cairo text-xl font-bold text-navy-900">
              {t('student:lesson.lock.title')}
            </h2>
            <p className="font-cairo text-sm text-gray-500">
              {resolveLessonLockMessage(
                lockCode as Parameters<typeof resolveLessonLockMessage>[0],
                t,
              )}
            </p>
            <Link
              to="/student/dashboard"
              className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900"
            >
              {t('student:lesson.notFound.back')}
            </Link>
          </div>
        );
      }

      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 py-20 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-warning-50">
            <Lock size={40} className="text-warning-500" />
          </span>
          <h2 className="font-cairo text-xl font-bold text-navy-900">
            {t('student:lesson.enrollmentRequired.title')}
          </h2>
          <p className="font-cairo text-sm text-gray-500">
            {t('student:lesson.enrollmentRequired.description')}
          </p>
          <Link
            to="/student/dashboard"
            className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-button bg-navy-800 px-6 font-cairo text-sm font-semibold text-white transition-colors hover:bg-navy-900"
          >
            {t('student:lesson.enrollmentRequired.cta')}
          </Link>
        </div>
      );
    }

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
          to="/student/dashboard"
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
      <nav className="flex flex-wrap items-center gap-1 font-cairo text-sm text-gray-500">
        <Link to="/student/dashboard" className="hover:text-accent transition-colors">
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

      {showVideo ? (
        <div
          className="relative w-full overflow-hidden rounded-card pb-[56.25%] bg-gray-200"
          onContextMenu={(e) => e.preventDefault()}
        >
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={lesson.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {/* Right-click inside the cross-origin iframe itself cannot be blocked. */}
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

      <ProtectedContent
        policy={{
          disableCopy: true,
          disableContextMenu: true,
          disablePrint: true,
          disableSelection: true,
        }}
        className="print-protected"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Badge variant="default" className="w-fit">
                {t('student:lesson.lessonLabel', { order: toLocalNum(lesson.sortOrder) })}
              </Badge>
              <h1 className="font-cairo text-2xl font-bold text-navy-900">{lesson.title}</h1>
            </div>
          </div>
          {lesson.description && (
            <p className="font-cairo whitespace-pre-line text-gray-500">{lesson.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 font-cairo text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={16} />
              {toLocalNum(lesson.durationMinutes)} {t('student:lesson.minutes')}
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
          </div>
          {!isLessonCompleted && (
            <Button
              variant="primary"
              loading={completeLesson.isPending}
              onClick={() => lessonId && completeLesson.mutate(lessonId)}
              className="w-fit"
            >
              {completeLesson.isPending
                ? t('student:lesson.completing')
                : t('student:lesson.completeLesson')}
            </Button>
          )}
        </div>
      </ProtectedContent>

      <LessonMaterialsSection
        lessonId={lesson.id}
        materials={lesson.attachments ?? []}
        onMaterialDownloaded={handleMaterialDownloaded}
      />

      <LessonQuizSections
        available={lessonQuizzes.available}
        required={lessonQuizzes.required}
      />

      {relatedLessons.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-cairo text-base font-semibold text-navy-900">
            {t('student:lesson.related.title')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {relatedLessons.map((related) => (
              <Link
                key={related.id}
                to={`/student/lessons/${related.id}`}
                className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 transition-colors hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-cyan-50 text-accent">
                  <BookOpen size={18} />
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 font-cairo text-sm font-medium text-navy-900">
                  {related.title}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        {prevLesson ? (
          <Button
            variant="outline"
            onClick={() => navigate(`/student/lessons/${prevLesson.id}`)}
            className="flex-col items-start gap-1 px-4 py-3"
          >
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <ChevronLeft size={14} className="rtl:rotate-180" />
              {t('student:lesson.previousLesson')}
            </span>
            <span className="line-clamp-1 text-start font-cairo text-sm font-medium">
              {prevLesson.title}
            </span>
          </Button>
        ) : (
          <div />
        )}

        {nextLessonId && nextLessonTitle ? (
          <Button
            variant="primary"
            onClick={() => navigate(`/student/lessons/${nextLessonId}`)}
            className="col-start-2 flex-col items-end gap-1 px-4 py-3"
          >
            <span className="inline-flex items-center gap-1 text-xs text-white/70">
              {t('student:lesson.nextLesson')}
              <ChevronRight size={14} className="rtl:rotate-180" />
            </span>
            <span className="line-clamp-1 text-end font-cairo text-sm font-medium">
              {nextLessonTitle}
            </span>
          </Button>
        ) : !nextLessonId && isLessonCompleted && lesson.requiredQuizId ? (
          <p className="col-start-2 text-end font-cairo text-xs text-gray-500">
            {gateQuizFailed
              ? t('student:lesson.nextLessonLockedQuizFailed')
              : t('student:lesson.nextLessonLockedQuiz')}
          </p>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

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
