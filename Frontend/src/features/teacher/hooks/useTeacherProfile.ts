import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi } from "@/features/teacher/api/teacher";

const TEACHER_PROFILE_KEY = ["teacher", "profile"];

export function useTeacherProfile() {
  return useQuery({
    queryKey: TEACHER_PROFILE_KEY,
    queryFn: () => teacherApi.getProfile().then((res) => res.data),
  });
}

export function useUpdateTeacherProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: teacherApi.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_PROFILE_KEY });
    },
  });
}

export function useUploadTeacherPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => teacherApi.uploadPhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_PROFILE_KEY });
    },
  });
}

export function useUploadTeacherLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => teacherApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TEACHER_PROFILE_KEY });
    },
  });
}
