import { useNavigate } from 'react-router-dom';
import { useTeacherStudents } from '@/features/teacher/hooks/useTeacherStudents';
import { useStudentsListState } from '@/features/teacher/hooks/useStudentsListState';
import { useStudentsExport } from '@/features/teacher/hooks/useStudentsExport';
import {
  StudentsPageHeader,
  EngagementSummaryCards,
  StudentsTableToolbar,
  StudentsTable,
  StudentsPagination,
  StudentsTableSkeleton,
  StudentsTableEmpty,
  StudentsErrorState,
} from '@/features/teacher/components/students';
import type { TeacherStudentsSummary } from '@/features/teacher/types/students';

/** Neutral summary shown while loading, so the cards keep their layout. */
const placeholderSummary: TeacherStudentsSummary = {
  totalStudents: 0,
  activeCount: 0,
  inactiveCount: 0,
  averageEngagement: 0,
};

export function StudentEngagementPage() {
  const navigate = useNavigate();
  const state = useStudentsListState();

  const { data, isLoading, isError, refetch } = useTeacherStudents({
    page: state.page,
    limit: state.pageSize,
    search: state.search || undefined,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });

  const { exportCsv, isExporting } = useStudentsExport({
    search: state.search,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  });

  // Initial load failed — show the error state (design's "error" frame).
  if (isError && !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <StudentsPageHeader totalStudents={undefined} />
        <div className="rounded-card border border-gray-300 bg-white shadow-card">
          <StudentsErrorState onRetry={refetch} />
        </div>
      </div>
    );
  }

  const students = data?.students ?? [];
  const isEmpty = !isLoading && students.length === 0;
  const isEmptySearch = isEmpty && Boolean(state.search);
  const isEmptyNoData = isEmpty && !state.search;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <StudentsPageHeader totalStudents={data?.summary.totalStudents} />
      <EngagementSummaryCards
        summary={data?.summary ?? placeholderSummary}
        isLoading={isLoading}
      />

      <div className="rounded-card border border-gray-300 bg-white shadow-card">
        <StudentsTableToolbar
          search={state.searchInput}
          onSearchChange={state.setSearchInput}
          onExport={exportCsv}
          isExporting={isExporting}
        />

        {isLoading && <StudentsTableSkeleton />}
        {isEmptyNoData && <StudentsTableEmpty variant="noStudents" />}
        {isEmptySearch && (
          <StudentsTableEmpty
            variant="noResults"
            query={state.search}
            onClearSearch={() => state.setSearchInput('')}
          />
        )}
        {!isLoading && students.length > 0 && (
          <StudentsTable
            students={students}
            sortBy={state.sortBy}
            sortOrder={state.sortOrder}
            onSortChange={state.setSort}
            onRowClick={(id) => navigate(`/teacher/students/${id}`)}
          />
        )}

        {data && data.pagination.total > 0 && !isEmpty && (
          <StudentsPagination
            page={data.pagination.page}
            pageSize={data.pagination.pageSize}
            total={data.pagination.total}
            totalPages={data.pagination.totalPages}
            onPageChange={state.setPage}
          />
        )}
      </div>
    </div>
  );
}
