import { describe, it, expect } from 'vitest';
import reducer, { logout, initAuth, login } from './authSlice';
import type { User } from '@/shared/types/user';

const initial = reducer(undefined, { type: '@@INIT' });
const user = {
  id: 'u1',
  fullName: 'Test',
  email: 't@e.test',
  mobile: '01000000000',
  role: 'STUDENT',
  status: 'ACTIVE',
} as unknown as User;

describe('authSlice bootstrap states', () => {
  it('starts idle + unauthenticated (so the guard must wait, not redirect)', () => {
    expect(initial.status).toBe('idle');
    expect(initial.isAuthenticated).toBe(false);
    expect(initial.user).toBeNull();
  });

  it('initAuth.pending → loading', () => {
    const s = reducer(initial, initAuth.pending('r', undefined));
    expect(s.status).toBe('loading');
  });

  it('initAuth.fulfilled → authenticated/succeeded', () => {
    const s = reducer(initial, initAuth.fulfilled({ user }, 'r', undefined));
    expect(s.status).toBe('succeeded');
    expect(s.isAuthenticated).toBe(true);
    expect(s.user?.id).toBe('u1');
  });

  it('initAuth.rejected → failed/unauthenticated (only now may the guard redirect)', () => {
    const s = reducer(
      initial,
      initAuth.rejected(new Error('x'), 'r', undefined, 'Session invalid'),
    );
    expect(s.status).toBe('failed');
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
  });

  it('login.pending does not flip bootstrap status to loading', () => {
    const failed = reducer(
      initial,
      initAuth.rejected(new Error('x'), 'r', undefined, 'Session invalid'),
    );
    const s = reducer(failed, login.pending('r', { email: 'a@b.c', password: 'x' }));
    expect(s.status).toBe('failed');
  });

  it('login.fulfilled authenticates', () => {
    const s = reducer(initial, login.fulfilled({ user }, 'r', { email: '', password: '' }));
    expect(s.isAuthenticated).toBe(true);
    expect(s.status).toBe('succeeded');
  });

  it('logout clears the session into a settled (non-idle) state so the guard redirects', () => {
    const authed = reducer(initial, login.fulfilled({ user }, 'r', { email: '', password: '' }));
    const s = reducer(authed, logout());
    expect(s.user).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    // Must NOT be 'idle'/'loading' — those keep AuthGuard on the spinner.
    expect(s.status).not.toBe('idle');
    expect(s.status).not.toBe('loading');
  });
});
