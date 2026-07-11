import { apiClient } from '@/shared/lib/api/client';
import type { ApiResponse } from '@/shared/types';

export interface AdminStage {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  displayName?: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  displayDescription?: string | null;
  sortOrder: number;
  teacherId: string | null;
  isActive: boolean;
  chapterCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const adminStagesApi = {
  list: async (): Promise<Paginated<AdminStage>> => {
    const { data } = await apiClient.get<ApiResponse<Paginated<AdminStage>>>('/admin/stages', {
      params: { limit: 100, sortBy: 'sortOrder', sort: 'asc' },
    });
    return data.data;
  },

  create: async (payload: {
    nameAr: string;
    nameEn: string;
    descriptionAr?: string | null;
    descriptionEn?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) => {
    const { data } = await apiClient.post<ApiResponse<AdminStage>>('/admin/stages', payload);
    return data.data;
  },

  update: async (
    id: string,
    payload: {
      nameAr?: string;
      nameEn?: string;
      descriptionAr?: string | null;
      descriptionEn?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) => {
    const { data } = await apiClient.patch<ApiResponse<AdminStage>>(`/admin/stages/${id}`, payload);
    return data.data;
  },

  setStatus: async (id: string, isActive: boolean) => {
    const { data } = await apiClient.patch<ApiResponse<AdminStage>>(`/admin/stages/${id}/status`, { isActive });
    return data.data;
  },
};
