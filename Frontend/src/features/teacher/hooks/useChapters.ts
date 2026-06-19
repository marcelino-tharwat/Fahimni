import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chaptersApi } from '@/features/teacher/api/chapters';
import { CONTENT_TREE_KEY } from '@/features/teacher/hooks/useContentTree';
import { TEACHER_DASHBOARD_STATS_KEY } from '@/features/teacher/hooks/useTeacherDashboardStats';
import type {
  CreateChapterPayload,
  UpdateChapterPayload,
} from '@/features/teacher/types/chapter';

const STAGES_KEY = ['teacher', 'stages'];
const CHAPTERS_KEY = ['teacher', 'chapters'];
const CHAPTER_KEY = ['teacher', 'chapter'];

export function useChaptersByStage(stageId: string | undefined) {
  return useQuery({
    queryKey: [...CHAPTERS_KEY, stageId],
    queryFn: () => chaptersApi.getChaptersByStage(stageId!),
    enabled: !!stageId,
  });
}

export function useChapter(id: string | undefined) {
  return useQuery({
    queryKey: [...CHAPTER_KEY, id],
    queryFn: () => chaptersApi.getChapter(id!),
    enabled: !!id,
  });
}

export function useCreateChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stageId,
      payload,
    }: {
      stageId: string;
      payload: CreateChapterPayload;
    }) => chaptersApi.createChapter(stageId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAPTERS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useUpdateChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateChapterPayload;
    }) => chaptersApi.updateChapter(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [...CHAPTER_KEY, id] });
      queryClient.invalidateQueries({ queryKey: CHAPTERS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useDeleteChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      chaptersApi.deleteChapter(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAPTERS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}

export function useReorderChapters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, ids }: { stageId: string; ids: string[] }) =>
      chaptersApi.reorderChapters(stageId, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAPTERS_KEY });
      queryClient.invalidateQueries({ queryKey: CONTENT_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: STAGES_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_KEY });
    },
  });
}
