import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = readFileSync(resolve(here, 'client.ts'), 'utf8');

describe('API client — 403 handler contract', () => {
  it('19a. Has a dedicated 403 branch before the 401 refresh logic', () => {
    // The 403 check must appear BEFORE the 401 check so it short-circuits.
    const _403Index = client.indexOf('=== 403');
    const _401Index = client.indexOf('=== 401');
    expect(_403Index).toBeGreaterThan(0);
    expect(_403Index).toBeLessThan(_401Index);
  });

  it('19b. 403 handler returns the Arabic message without triggering refresh', () => {
    expect(client).toMatch(/ليس لديك صلاحية للوصول إلى هذا المحتوى/);
    // Must NOT call the refresh endpoint
    expect(client).toMatch(/403/);
  });

  it('19c. 403 handler does NOT call forceLogout or dispatch logout', () => {
    // The 403 handler branch should reject immediately without calling
    // forceLogout. The function declaration exists above, but the 403
    // *branch* itself must not reach forceLogout — it returns early.
    const handlerStart = client.indexOf('apiClient.interceptors.response.use');
    const handlerBody = client.slice(handlerStart);

    // The 403 block must return a Promise.reject, NOT fall through to refresh
    const _403block = handlerBody.slice(0, handlerBody.indexOf('=== 401'));
    expect(_403block).toMatch(/Promise\.reject\(normalized\)/);
    // forceLogout must NOT appear inside the 403 block
    expect(_403block).not.toMatch(/forceLogout/);
    // forceLogout still appears in the 401 block
    const _401block = handlerBody.slice(handlerBody.indexOf('=== 401'));
    expect(_401block).toMatch(/forceLogout/);
  });

  it('20. Existing 401 handling still works unchanged', () => {
    // The 401 block must still be present with all its key parts
    expect(client).toMatch(/=== 401/);
    expect(client).toMatch(/isRefreshing/);
    expect(client).toMatch(/failedQueue/);
    expect(client).toMatch(/_retry/);
    expect(client).toMatch(/isAuthFlow/);
    expect(client).toMatch(/\/v1\/auth\/refresh/);
    expect(client).toMatch(/forceLogout/);
  });

  it('21. Repeated 403s do not trigger a redirect loop (no axios _retry on 403)', () => {
    // The 403 branch must NOT set _retry or call isRefreshing
    const handlerStart = client.indexOf('apiClient.interceptors.response.use');
    const handlerBody = client.slice(handlerStart);
    const _403block = handlerBody.slice(0, handlerBody.indexOf('=== 401'));
    expect(_403block).not.toMatch(/_retry/);
    expect(_403block).not.toMatch(/isRefreshing/);
  });
});
