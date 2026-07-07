import { apiClient } from '@/shared/lib/api/client';
import type { TeacherPlan, SubscriptionMeResponse, CreateRequestInput, CreateRequestResponse, CheckoutInput, CheckoutResponse } from '@/features/teacher/types/teacherPlans';

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

  // Primary paid flow: create a real payment checkout session and return the
  // provider checkout URL. The subscription is NOT activated here — only after
  // the verified provider webhook confirms payment.
  checkout: async (input: CheckoutInput): Promise<CheckoutResponse> => {
    const { data } = await apiClient.post<CheckoutResponse>(
      '/teacher/subscription/checkout',
      input,
    );
    return data;
  },

  // Fallback/manual flow: request admin review (secondary path).
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
