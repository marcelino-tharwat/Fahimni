import { QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/lib/api/client';

// The apiClient interceptor rejects every request with a normalized `ApiError`
// (see `normalizeError` in shared/lib/api/client). Tell React Query that this —
// not the built-in `Error` — is the error type flowing through every
// `useQuery`/`useMutation` `error` value and `onError` callback, so consumers
// can read `statusCode`/`code`/`message` without unsafe casts.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  },
});
