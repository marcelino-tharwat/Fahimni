const USER_KEY = "auth_user";

const guard = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

export const saveUser = (user: unknown): void => {
  guard(() => localStorage.setItem(USER_KEY, JSON.stringify(user)));
};

export const getUser = <T = unknown>(): T | null => {
  const raw = guard(() => localStorage.getItem(USER_KEY));
  return raw ? guard(() => JSON.parse(raw) as T) : null;
};

export const clearUser = (): void => {
  guard(() => localStorage.removeItem(USER_KEY));
};

// Refresh tokens now live ONLY in an HttpOnly cookie set by the backend — never
// in browser storage. This remains solely to purge any legacy value written by
// older builds (called on logout); there is intentionally no setter/getter.
export const removeRefreshToken = () => guard(() => localStorage.removeItem("refreshToken"));
