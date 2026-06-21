const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

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
