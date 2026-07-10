import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../config/queryClient';
import { store } from '@/shared/store';
import { initAuth } from '@/features/auth/store/authSlice';
import { SocketProvider } from './SocketProvider';
import '@/shared/lib/i18n';
// Side effect: clears React Query cache on logout to prevent cross-account leaks.
import '../config/authCacheSync';

function AuthInit() {
  useEffect(() => {
    store.dispatch(initAuth());
  }, []);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AuthInit />
        <SocketProvider>
          {children}
        </SocketProvider>
      </QueryClientProvider>
    </Provider>
  );
}
