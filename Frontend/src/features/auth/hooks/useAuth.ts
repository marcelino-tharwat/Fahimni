// src/hooks/useAuth.ts
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { setCredentials, logout, type User } from "@/features/auth/store/authSlice";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);

  return {
    user,
    isAuthenticated,
    role: user?.role ?? null,
    login: (u: User) => dispatch(setCredentials({ user: u })),
    logout: () => dispatch(logout()),
  };
}