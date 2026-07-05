import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ApiError } from '@/shared/lib/api/client';
import { useStudentDetail } from '@/features/teacher/hooks/useStudentDetail';
import { useStudentDetailState } from '@/features/teacher/hooks/useStudentDetailState';
import {
  StudentDetailBreadcrumb,
  StudentProfileHeader,
  StudentDetailStatCards,
  ChapterFilterSelect,
  LessonActivityTable,
  LessonActivityTableSkeleton,
  LessonActivityEmpty,
  LessonsPagination,
  StudentQuizzesSection,
  StudentDetailErrorState,
  StudentDetailNotFoundState,
} from '@/features/teacher/components/students';

/** The axios interceptor rejects with a normalized ApiError (has `statusCode`). */
function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'statusCode' in error;
}

export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('teacher');
  const isRtl = i18n.language.startsWith('ar');
  const state = useStudentDetailState();

  const { data, isLoading, isError, error, refetch } = useStudentDetail(studentId, {
    chapterId: state.chapterId || undefined,
    page: state.page,
    pageSize: state.pageSize,
  });

  const goToList = () => navigate('/teacher/students');

  // A 404 means the student isn't accessible to this teacher — a distinct,
  // non-retryable state (different copy + icon than a generic failure).
  if (isError && !data) {
    const isNotFound = isApiError(error) && error.statusCode === 404;
    return (
      <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-5">
        <StudentDetailBreadcrumb studentName={undefined} onBackClick={goToList} />
        <div className="rounded-card border border-gray-300 bg-white shadow-card">
          {isNotFound ? (
            <StudentDetailNotFoundState onBackClick={goToList} />
          ) : (
            <StudentDetailErrorState onRetry={refetch} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1024px] flex-col gap-5">
      <StudentDetailBreadcrumb studentName={data?.student.fullName} onBackClick={goToList} />
      <StudentProfileHeader student={data?.student} isLoading={isLoading} />
      <StudentDetailStatCards summary={data?.summary} isLoading={isLoading} />

      {/* Activity section — chapter filter + lessons table + pagination. */}
      <div className="rounded-card border border-gray-300 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 p-4">
          <h3 className="text-h3 text-navy-800">{t('students.detail.activityTitle')}</h3>
          <ChapterFilterSelect
            chapters={data?.chapters ?? []}
            value={state.chapterId}
            onChange={state.setChapterId}
          />
        </div>

        {isLoading ? (
          <LessonActivityTableSkeleton />
        ) : data && data.lessons.length === 0 ? (
          <LessonActivityEmpty />
        ) : (
          <LessonActivityTable lessons={data?.lessons ?? []} />
        )}

        {data && data.pagination.total > 0 && (
          <LessonsPagination
            page={data.pagination.page}
            pageSize={data.pagination.pageSize}
            total={data.pagination.total}
            totalPages={data.pagination.totalPages}
            onPageChange={state.setPage}
          />
        )}
      </div>

      {/* Quizzes section (chapter + lesson quizzes). */}
      <StudentQuizzesSection quizzes={data?.quizzes ?? []} isLoading={isLoading} />

      {/* Back to list */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={goToList}
          className="inline-flex items-center gap-2 text-body font-medium text-gray-600 transition-colors hover:text-cyan-500"
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {t('students.detail.backButton')}
        </button>
      </div>
    </div>
  );
}
