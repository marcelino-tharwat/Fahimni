import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static contract guards (node-env, matching the repo's Vitest convention) for
 * the auth session/refresh repair: cookie-based transport, single-flight
 * refresh, bootstrap-safe guard, and no refresh token in browser storage.
 */
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

const client = read('../../shared/lib/api/client.ts');
const token = read('./lib/token.ts');
const slice = read('./store/authSlice.ts');
const guard = read('../../shared/components/guards/AuthGuard.tsx');

describe('auth session/refresh repair — contract', () => {
  it('API client sends cookies and is the single instance', () => {
    expect(client).toMatch(/withCredentials:\s*true/);
    expect(client.match(/axios\.create\(/g) ?? []).toHaveLength(1);
  });

  it('refresh is cookie-based: no token body, no localStorage token usage', () => {
    // Refresh call carries no body (the HttpOnly cookie is the token).
    expect(client).toMatch(/post\("\/v1\/auth\/refresh"\)/);
    expect(client).not.toMatch(/getRefreshToken|saveRefreshToken/);
  });

  it('interceptor is single-flight, retries once, and excludes auth flows', () => {
    expect(client).toMatch(/_retry/);
    expect(client).toMatch(/isRefreshing/);
    expect(client).toMatch(/isAuthFlow/);
  });

  it('no refresh token is written to localStorage/sessionStorage anywhere', () => {
    for (const src of [client, token, slice]) {
      expect(src).not.toMatch(/setItem\(\s*["'`]refreshToken/);
      expect(src).not.toMatch(/sessionStorage/);
    }
  });

  it('login/register do not persist a refresh token client-side', () => {
    expect(slice).not.toMatch(/saveRefreshToken/);
  });

  it('initAuth uses /auth/me as the source of truth (not a localStorage gate)', () => {
    expect(slice).toMatch(/\/v1\/auth\/me/);
  });

  it('AuthGuard treats the idle bootstrap window as pending (does not redirect)', () => {
    expect(guard).toMatch(/status === 'idle'/);
  });
});
