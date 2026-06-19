import type React from 'react';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../config/queryClient';
import { store } from '@/shared/store';
import '@/shared/lib/i18n';
// Side effect: clears React Query cache on logout to prevent cross-account leaks.
import '../config/authCacheSync';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );
}
