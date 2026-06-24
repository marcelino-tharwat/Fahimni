import { apiClient } from '@/shared/lib/api/client';
import { store } from '@/shared/store';
import type {
  StudentProfile,
  UpdateStudentProfileInput,
  ChangePasswordInput,
  EnrollmentRecord,
  StudentApiResponse,
} from '@/features/student/types/student';

function getUserId(): string {
  const userId = store.getState().auth.user?.id;
  if (!userId) throw new Error('User not authenticated');
  return userId;
}

export const studentProfileApi = {
  getProfile: async (): Promise<StudentProfile> => {
    const userId = getUserId();
    const { data } = await apiClient.get<StudentApiResponse<StudentProfile>>(
      `/students/${userId}`,
    );
    return data.data;
  },

  updateProfile: async (
    input: UpdateStudentProfileInput,
  ): Promise<StudentProfile> => {
    const userId = getUserId();
    const { data } = await apiClient.patch<
      StudentApiResponse<{
        id: string;
        fullName: string;
        email: string;
        mobile: string;
        role: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        studentProfile: { id: string; userId: string; createdAt: string; updatedAt: string };
      }>
    >(`/students/${userId}`, input);
    const u = data.data;
    return {
      id: u.studentProfile.id,
      userId: u.id,
      createdAt: u.studentProfile.createdAt,
      updatedAt: u.studentProfile.updatedAt,
      user: {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    };
  },

  changePassword: async (
    input: ChangePasswordInput,
  ): Promise<{ message: string }> => {
    const { data } = await apiClient.patch<{ success: boolean; message: string }>(
      '/v1/auth/change-password',
      {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
    );
    return { message: data.message };
  },

  getEnrollments: async (): Promise<EnrollmentRecord[]> => {
    const { data } = await apiClient.get<StudentApiResponse<EnrollmentRecord[]>>(
      '/enrollments/me',
    );
    return data.data;
  },
};
