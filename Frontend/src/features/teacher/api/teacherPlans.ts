import { apiClient } from '@/shared/lib/api/client';
import type { TeacherPlan, SubscriptionMeResponse, CreateRequestInput, CreateRequestResponse } from '@/features/teacher/types/teacherPlans';

export const teacherPlansApi = {
  getPlans: async (): Promise<TeacherPlan[]> => {
    const { data } = await apiClient.get<{ plans: TeacherPlan[] }>(
      '/teacher/plans',
    );
    return data.plans;
  },

  getMySubscription: async (): Promise<SubscriptionMeResponse> => {
    const { data } = await apiClient.get<SubscriptionMeResponse>(
      '/teacher/subscription/me',
    );
    return data;
  },

  createRequest: async (input: CreateRequestInput): Promise<CreateRequestResponse> => {
    const { data } = await apiClient.post<CreateRequestResponse>(
      '/teacher/subscription/requests',
      input,
    );
    return data;
  },

  getMyRequests: async () => {
    const { data } = await apiClient.get<{ requests: unknown[] }>(
      '/teacher/subscription/requests',
    );
    return data.requests;
  },
};
