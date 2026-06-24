import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppDispatch } from '@/shared/store/hooks';
import { setStudentProfile, setStudentLoading, setStudentSaving } from '@/features/student/store/studentSlice';
import { setCredentials } from '@/features/auth/store/authSlice';
import { studentProfileApi } from '@/features/student/api/profile';
import type { UpdateStudentProfileInput, ChangePasswordInput } from '@/features/student/types/student';

const STUDENT_PROFILE_KEY = ['student', 'profile'];
const STUDENT_ENROLLMENTS_KEY = ['student', 'enrollments'];

export function useStudentProfile() {
  const dispatch = useAppDispatch();

  return useQuery({
    queryKey: STUDENT_PROFILE_KEY,
    queryFn: async () => {
      dispatch(setStudentLoading(true));
      try {
        const profile = await studentProfileApi.getProfile();
        dispatch(setStudentProfile(profile));
        return profile;
      } catch {
        dispatch(setStudentProfile(null));
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateStudentProfile() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (input: UpdateStudentProfileInput) =>
      studentProfileApi.updateProfile(input),
    onSuccess: (data) => {
      dispatch(setStudentProfile(data));
      dispatch(setCredentials({ user: data.user }));
      queryClient.setQueryData(STUDENT_PROFILE_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STUDENT_PROFILE_KEY });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      studentProfileApi.changePassword(input),
  });
}

export function useStudentEnrollments() {
  return useQuery({
    queryKey: STUDENT_ENROLLMENTS_KEY,
    queryFn: async () => {
      try {
        return await studentProfileApi.getEnrollments();
      } catch {
        return [];
      }
    },
  });
}
