import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  TeacherStudentsSortBy,
  TeacherStudentsSortOrder,
} from '@/features/teacher/types/students';

/** Fixed page size for the students list (STORY-74 default). */
const PAGE_SIZE = 20;

/** Debounce window (ms) before a search keystroke is pushed to the URL. */
const SEARCH_DEBOUNCE_MS = 300;

const SORT_BY_VALUES: readonly TeacherStudentsSortBy[] = [
  'name',
  'lastActivity',
  'averageQuizScore',
];

function parseSortBy(value: string | null): TeacherStudentsSortBy | undefined {
  return SORT_BY_VALUES.includes(value as TeacherStudentsSortBy)
    ? (value as TeacherStudentsSortBy)
    : undefined;
}

function parseSortOrder(value: string | null): TeacherStudentsSortOrder {
  return value === 'asc' ? 'asc' : 'desc';
}

export interface StudentsListState {
  page: number;
  pageSize: number;
  /** Debounced value synced to the URL — pass this to the API. */
  search: string;
  /** Immediate value bound to the toolbar input. */
  searchInput: string;
  sortBy: TeacherStudentsSortBy | undefined;
  sortOrder: TeacherStudentsSortOrder;
}

export interface StudentsListActions {
  setPage: (page: number) => void;
  setSearchInput: (value: string) => void;
  setSort: (sortBy: TeacherStudentsSortBy) => void;
}

/**
 * Single source of truth for the students-list URL state (?page, ?search,
 * ?sortBy, ?sortOrder). Search is debounced: `searchInput` updates immediately
 * for the controlled toolbar, and only reaches the URL (`search`) after the
 * debounce window, at which point pagination resets to page 1.
 */
export function useStudentsListState(): StudentsListState & StudentsListActions {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get('search') ?? '';
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Debounce: push searchInput to the URL after the user pauses typing. The
  // updater reads live params (`prev`), so there is no stale-closure risk; the
  // equality guard also preserves ?page on the initial mount.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const currentSearch = prev.get('search') ?? '';
          if (currentSearch === searchInput) return prev;
          const next = new URLSearchParams(prev);
          if (searchInput) next.set('search', searchInput);
          else next.delete('search');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // Intentionally depend on searchInput only — setSearchParams is stable and
    // reading searchParams here would re-run on every URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const pageRaw = Number(searchParams.get('page'));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const sortBy = parseSortBy(searchParams.get('sortBy'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));

  const setPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(nextPage));
      return next;
    });
  };

  const setSort = (nextSortBy: TeacherStudentsSortBy) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const currentSortBy = parseSortBy(prev.get('sortBy'));
      const currentOrder = parseSortOrder(prev.get('sortOrder'));
      if (currentSortBy === nextSortBy) {
        next.set('sortOrder', currentOrder === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sortBy', nextSortBy);
        next.set('sortOrder', 'desc');
      }
      next.set('page', '1');
      return next;
    });
  };

  return {
    page,
    pageSize: PAGE_SIZE,
    search: urlSearch,
    searchInput,
    sortBy,
    sortOrder,
    setPage,
    setSearchInput,
    setSort,
  };
}
