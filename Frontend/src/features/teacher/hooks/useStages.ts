import { useQuery } from '@tanstack/react-query';
import { teacherContentApi } from '@/features/teacher/api/content';

const STAGES_KEY = ['teacher', 'stages'];

export function useStages() {
  return useQuery({
    queryKey: STAGES_KEY,
    queryFn: () => teacherContentApi.getStages(),
  });
}
