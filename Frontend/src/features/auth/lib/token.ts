// src/lib/auth/token.ts
const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// Guard against environments without localStorage (unit tests in node, SSR, or
// privacy modes where access throws). Reads/writes become safe no-ops there.
const hasStorage = (): boolean => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

export const saveToken = (token: string): void => {
  if (hasStorage()) localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return hasStorage() ? localStorage.getItem(TOKEN_KEY) : null;
};

export const removeToken = (): void => {
  if (hasStorage()) localStorage.removeItem(TOKEN_KEY);
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

export const removeUser = (): void => {
  if (hasStorage()) localStorage.removeItem(USER_KEY);
};
