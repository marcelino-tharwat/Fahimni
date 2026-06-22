import type { User } from "@/shared/types/user";

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

// Refresh token helpers — will be migrated to httpOnly cookie in SEC-004
export const saveRefreshToken = (token: string) => guard(() => localStorage.setItem("refreshToken", token));
export const getRefreshToken = () => guard(() => localStorage.getItem("refreshToken"));
export const removeRefreshToken = () => guard(() => localStorage.removeItem("refreshToken"));
