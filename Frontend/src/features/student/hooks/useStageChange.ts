import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentProfileOverviewApi } from '@/features/student/api/studentProfile';

export const STAGE_CHANGE_POLICY_KEY = ['student', 'stageChangePolicy'] as const;

export function useStageChangePolicy() {
  return useQuery({
    queryKey: STAGE_CHANGE_POLICY_KEY,
    queryFn: () => studentProfileOverviewApi.getStageChangePolicy(),
    staleTime: 60 * 1000,
  });
}

export function useChangeStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => studentProfileOverviewApi.changeStage(stageId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: STAGE_CHANGE_POLICY_KEY });
    },
  });
}
