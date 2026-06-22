import type { User } from "@/features/auth/store/authSlice";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// In-memory session-only storage (cleared on tab close)
let sessionToken: string | null = null;
let sessionUser: User | null = null;

export const saveSessionToken = (token: string) => { sessionToken = token; };
export const saveSessionUser = (user: User) => { sessionUser = user; };
export const getSessionToken = () => sessionToken;
export const getSessionUser = () => sessionUser;
export const clearSessionAuth = () => { sessionToken = null; sessionUser = null; };

export const saveRefreshToken = (token: string) => guard(() => localStorage.setItem("refreshToken", token));
export const getRefreshToken = () => guard(() => localStorage.getItem("refreshToken"));
export const removeRefreshToken = () => guard(() => localStorage.removeItem("refreshToken"));

const guard = <T>(fn: () => T): T | null => {
  try { return fn(); } catch { return null; }
};

const getStore = (remember: boolean): Storage | null =>
  guard(() => remember ? localStorage : sessionStorage);

export const saveToken = (token: string, remember = true): void => {
  const store = getStore(remember);
  store?.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return guard(() => localStorage.getItem(TOKEN_KEY))
    ?? guard(() => sessionStorage.getItem(TOKEN_KEY));
};

export const removeToken = (): void => {
  guard(() => localStorage.removeItem(TOKEN_KEY));
  guard(() => sessionStorage.removeItem(TOKEN_KEY));
};

export const saveUser = (user: unknown, remember = true): void => {
  const store = getStore(remember);
  store?.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = <T = unknown>(): T | null => {
  const raw = guard(() => localStorage.getItem(USER_KEY))
    ?? guard(() => sessionStorage.getItem(USER_KEY));
  return raw ? guard(() => JSON.parse(raw) as T) : null;
};

export const removeUser = (): void => {
  guard(() => localStorage.removeItem(USER_KEY));
  guard(() => sessionStorage.removeItem(USER_KEY));
};
