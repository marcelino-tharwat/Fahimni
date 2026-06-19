import { store } from '@/shared/store';
import { queryClient } from './queryClient';

/**
 * Account-isolation safeguard.
 *
 * Clears all cached React Query data the moment the user becomes
 * unauthenticated — covering every logout path (sidebar, topbar, and the 401
 * interceptor) because they all flip `auth.isAuthenticated` to false. This
 * prevents one account's private data (dashboard, My Courses, profile, etc.)
 * from leaking into the next session after account switching.
 *
 * Imported once for its side effect from AppProviders.
 */
let previousIsAuthenticated = store.getState().auth.isAuthenticated;

store.subscribe(() => {
  const isAuthenticated = store.getState().auth.isAuthenticated;
  if (previousIsAuthenticated && !isAuthenticated) {
    queryClient.clear();
  }
  previousIsAuthenticated = isAuthenticated;
});
