import { apiClient } from '@/shared/lib/api/client';
import type { TeacherProfileResponse, UpdateTeacherProfileInput } from '@/features/teacher/types/teacher';

/**
 * Teacher profile endpoints.
 *
 * Backend routes (mounted at `/api/teachers`, see backend/src/app.ts):
 *   GET    /teachers/profile
 *   PUT    /teachers/profile          (JSON body)
 *   PUT    /teachers/profile/photo    (multipart, field "photo")
 *   PUT    /teachers/profile/logo     (multipart, field "logo")
 *
 * Each returns the standard envelope: { success, message, data }.
 */
export const teacherApi = {
  getProfile: async (): Promise<TeacherProfileResponse> => {
    const { data } = await apiClient.get<TeacherProfileResponse>('/teachers/profile');
    return data;
  },

  updateProfile: async (
    input: UpdateTeacherProfileInput,
  ): Promise<TeacherProfileResponse> => {
    const { data } = await apiClient.put<TeacherProfileResponse>('/teachers/profile', input);
    return data;
  },

  uploadPhoto: async (file: File): Promise<TeacherProfileResponse> => {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await apiClient.put<TeacherProfileResponse>(
      '/teachers/profile/photo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  uploadLogo: async (file: File): Promise<TeacherProfileResponse> => {
    const formData = new FormData();
    formData.append('logo', file);
    const { data } = await apiClient.put<TeacherProfileResponse>(
      '/teachers/profile/logo',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },
};
