import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';
import type { MyCourse, StudentContentTreeItem } from '@/features/student/types/studentContent';

/**
 * Student content endpoints. Both require a Student JWT (the shared apiClient
 * attaches the bearer token automatically).
 */
export const studentContentApi = {
  /**
   * GET /content/student/tree
   * Returns the tree array directly (no { success, message, data } envelope).
   */
  getTree: async (filters?: { subject?: string; term?: string }): Promise<StudentContentTreeItem[]> => {
    const hasFilters = Boolean(filters?.subject || filters?.term);
    const { data } = hasFilters
      ? await apiClient.get<unknown>('/content/student/tree', { params: filters })
      : await apiClient.get<unknown>('/content/student/tree');
    return Array.isArray(data) ? (data as StudentContentTreeItem[]) : [];
  },

  /**
   * GET /content/student/my-courses
   * Returns the standard { success, message, data } envelope.
   */
  getMyCourses: async (): Promise<MyCourse[]> => {
    const { data } = await apiClient.get<ApiResponse<MyCourse[]>>(
      '/content/student/my-courses',
    );
    return data?.data ?? [];
  },
};
