import { describe, it, expect } from 'vitest';
import { store } from '@/shared/store';
import { queryClient } from './queryClient';
import { setCredentials, logout, type User } from '@/features/auth/store/authSlice';
import './authCacheSync';

const userA: User = {
  id: 'user-a',
  fullName: 'User A',
  email: 'a@example.com',
  mobile: '01000000000',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: '',
  updatedAt: '',
};

describe('authCacheSync', () => {
  it('clears the React Query cache on logout (account-switch isolation)', () => {
    // Simulate User A logged in with private cached data.
    store.dispatch(setCredentials({ user: userA, token: 'token-a' }));
    queryClient.setQueryData(['student', 'content', 'my-courses'], [{ id: 'private-A' }]);
    expect(queryClient.getQueryData(['student', 'content', 'my-courses'])).toBeTruthy();

    // Logout must drop all cached private data so the next account starts clean.
    store.dispatch(logout());
    expect(queryClient.getQueryData(['student', 'content', 'my-courses'])).toBeUndefined();
    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
