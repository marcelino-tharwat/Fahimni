import { apiClient } from '@/shared/lib/api/client';

export interface TrackRequestInput {
  reference: string;
  email?: string;
  mobile?: string;
}

export interface TrackRequestResult {
  reference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt: string | null;
}

export const teacherRequestTrackApi = {
  // Public status lookup — requires reference + email/mobile. Returns only safe
  // status fields (no admin notes, reviewer, documents, or storage paths).
  track: async (input: TrackRequestInput): Promise<TrackRequestResult> => {
    const { data } = await apiClient.post<{ success: boolean; data: TrackRequestResult }>(
      '/teacher-registration-requests/track',
      input,
    );
    return data.data;
  },
};
