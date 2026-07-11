import { useQuery } from '@tanstack/react-query';
import { teacherContentApi } from '@/features/teacher/api/content';

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
