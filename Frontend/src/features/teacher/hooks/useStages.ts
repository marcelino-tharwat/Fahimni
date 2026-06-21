import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherContentApi } from '@/features/teacher/api/content';
import { CONTENT_TREE_KEY } from '@/features/teacher/hooks/useContentTree';
import { TEACHER_DASHBOARD_STATS_KEY } from '@/features/teacher/hooks/useTeacherDashboardStats';
import type { CreateStagePayload, UpdateStagePayload } from '@/features/teacher/types/stage';

export const STAGES_KEY = ['teacher', 'stages'];
const STAGE_KEY = ['teacher', 'stage'];

export function useStages() {
  return useQuery({
    queryKey: STAGES_KEY,
    queryFn: () => teacherContentApi.getStages(),
  });
}

export function useStage(id: string | undefined) {
  return useQuery({
    queryKey: [...STAGE_KEY, id],
    queryFn: () => teacherContentApi.getStage(id!),
    enabled: !!id,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStagePayload) => teacherContentApi.createStage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStagePayload }) =>
      teacherContentApi.updateStage(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...STAGE_KEY, id] });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => teacherContentApi.reorderStages(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      teacherContentApi.deleteStage(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}
