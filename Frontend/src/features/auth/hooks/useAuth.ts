// src/hooks/useAuth.ts
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { setCredentials, logout, type User } from "@/features/auth/store/authSlice";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated } = useAppSelector((s) => s.auth);

  return {
    user,
    token,
    isAuthenticated,
    role: user?.role ?? null,
    login: (u: User, t: string) => dispatch(setCredentials({ user: u, token: t })),
    logout: () => dispatch(logout()),
  };
}