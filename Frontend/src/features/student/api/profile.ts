import { apiClient } from '@/shared/lib/api/client';
import { store } from '@/shared/store';
import type { UserRole, UserStatus } from '@/shared/types/user';
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
        role: UserRole;
        status: UserStatus;
        createdAt: string;
        updatedAt: string;
        studentProfile: {
          id: string;
          userId: string;
          stageId: string;
          createdAt: string;
          updatedAt: string;
          stage: { name: string };
        };
      }>
    >(`/students/${userId}`, input);
    const u = data.data;
    return {
      id: u.studentProfile.id,
      userId: u.id,
      stageId: u.studentProfile.stageId,
      stage: u.studentProfile.stage,
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
    // Backend route is `/enrollments/my` (STUDENT, own active enrollments).
    const { data } = await apiClient.get<StudentApiResponse<EnrollmentRecord[]>>(
      '/enrollments/my',
    );
    return data.data;
  },
};
