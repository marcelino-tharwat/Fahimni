import { useSearchParams } from 'react-router-dom';

/** Fixed lessons-table page size (same as the list). */
const PAGE_SIZE = 20;

export interface StudentDetailState {
  /** Active chapter filter; '' means "all chapters". */
  chapterId: string;
  /** Lessons-table page. */
  page: number;
  pageSize: number;
}

export interface StudentDetailActions {
  setChapterId: (chapterId: string) => void;
  setPage: (page: number) => void;
}

/**
 * URL-synced state for the detail page's chapter filter and lessons-table
 * pagination (?chapterId, ?page). Chapter selection commits immediately (no
 * debounce). Both actions use push navigation so browser Back works.
 *
 * `chapterId` is passed through as-is: the backend validates the UUID and 400s
 * on garbage, which the UI can surface — no client-side regex.
 */
export function useStudentDetailState(): StudentDetailState & StudentDetailActions {
  const [searchParams, setSearchParams] = useSearchParams();

  const chapterId = searchParams.get('chapterId') ?? '';

  const pageRaw = Number(searchParams.get('page'));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const setChapterId = (nextChapterId: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextChapterId === '') next.delete('chapterId');
      else next.set('chapterId', nextChapterId);
      next.set('page', '1');
      return next;
    });
  };

  const setPage = (nextPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(nextPage));
      return next;
    });
  };

  return {
    chapterId,
    page,
    pageSize: PAGE_SIZE,
    setChapterId,
    setPage,
  };
}
