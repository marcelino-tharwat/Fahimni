import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/shared/store/hooks';
import { addToast } from '@/shared/store/slices/toastSlice';
import { teacherStudentsApi } from '@/features/teacher/api/students';
import { buildCsv, downloadCsv, todayIsoDate } from '@/features/teacher/lib/studentsExport';
import type {
  TeacherStudentRow,
  TeacherStudentsSortBy,
  TeacherStudentsSortOrder,
} from '@/features/teacher/types/students';

/** Per-request page size for the export loop. */
const EXPORT_PAGE_LIMIT = 100;
/** Hard cap on loop iterations (100 × 100 = 10,000 rows) to avoid a runaway. */
const MAX_PAGES = 100;

/**
 * Prefix a value with a tab character so Excel treats the cell as text and does
 * not auto-convert it (phones with "+", fractions like "1/2", ID-like strings).
 * The tab is invisible in Excel; some CSV readers show it, but Excel handles it
 * cleanly.
 */
function asExcelText(value: string): string {
  return `\t${value}`;
}

/**
 * Format an ISO-8601 timestamp for Excel: strip milliseconds + trailing 'Z' and
 * replace the 'T' separator with a space, so Excel auto-parses it as a datetime.
 * Null input → ''.
 *
 * Example: "2026-07-04T18:07:00.473Z" → "2026-07-04 18:07:00"
 */
function formatIsoForExcel(iso: string | null): string {
  if (!iso) return '';
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : iso;
}

export interface UseStudentsExportOptions {
  search?: string;
  sortBy?: TeacherStudentsSortBy;
  sortOrder?: TeacherStudentsSortOrder;
}

export interface UseStudentsExportResult {
  exportCsv: () => Promise<void>;
  isExporting: boolean;
}

/**
 * Client-side CSV export of the students list. Fetches every page (respecting
 * the current search/sort), builds a UTF-8 CSV (Latin digits, localized status
 * text), and triggers a download. Toasts on empty result, success, and failure.
 */
export function useStudentsExport(options: UseStudentsExportOptions): UseStudentsExportResult {
  const { t } = useTranslation('teacher');
  const dispatch = useAppDispatch();
  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // 1. Fetch all pages (respect filters; ignore the on-screen page cursor).
      const allStudents: TeacherStudentRow[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const response = await teacherStudentsApi.getStudentsList({
          page,
          limit: EXPORT_PAGE_LIMIT,
          search: options.search || undefined,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        });
        allStudents.push(...response.students);
        totalPages = response.pagination.totalPages;
        page += 1;
        if (page > MAX_PAGES) break;
      }

      if (allStudents.length === 0) {
        dispatch(addToast({ type: 'info', message: t('students.export.emptyToast') }));
        return;
      }

      // 2. Headers (localized).
      const headers = [
        t('students.table.columns.name'),
        t('students.table.columns.phone'),
        t('students.table.columns.status'),
        t('students.table.columns.chapters'),
        t('students.table.columns.lessons'),
        t('students.table.columns.avgScore'),
        t('students.table.columns.lastActivity'),
      ];

      // 3. Rows — Latin digits (Excel-safe); status text localized; ISO as-is.
      const rows: Array<Array<string | number | null>> = allStudents.map((s) => [
        s.studentName,
        s.studentPhone ? asExcelText(s.studentPhone) : '',
        s.status === 'active' ? t('students.status.active') : t('students.status.inactive'),
        s.enrolledChapterCount,
        asExcelText(`${s.lessonsWatched}/${s.totalLessons}`),
        s.averageQuizScore === null ? '' : Math.round(s.averageQuizScore),
        formatIsoForExcel(s.lastActivityAt),
      ]);

      // 4. Build + download.
      const csv = buildCsv(headers, rows);
      downloadCsv(csv, `students-engagement-${todayIsoDate()}.csv`);

      dispatch(
        addToast({
          type: 'success',
          message: t('students.export.successToast', { count: allStudents.length }),
        }),
      );
    } catch {
      dispatch(addToast({ type: 'error', message: t('students.export.errorToast') }));
    } finally {
      setIsExporting(false);
    }
  };

  return { exportCsv, isExporting };
}
