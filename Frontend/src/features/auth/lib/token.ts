// src/lib/auth/token.ts
const TOKEN_KEY = "auth_token";

export const saveToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

//
// Stores only the non-sensitive user object in localStorage to survive page
// refreshes. The access token now lives exclusively in an httpOnly cookie
// set by the server — the frontend never reads or stores it.
//
const USER_KEY = "auth_user";

const hasStorage = (): boolean => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

export const saveUser = (user: unknown): void => {
  if (hasStorage()) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = <T = unknown>(): T | null => {
  try {
    const raw = hasStorage() ? localStorage.getItem(USER_KEY) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const clearUser = (): void => {
  if (hasStorage()) localStorage.removeItem(USER_KEY);
};
