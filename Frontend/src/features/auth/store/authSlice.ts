// src/store/authSlice.ts
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient, type ApiError } from "@/shared/lib/api/client";
import { getToken, saveToken, removeToken, saveUser, getUser, removeUser, saveSessionToken, saveSessionUser, clearSessionAuth, saveRefreshToken, removeRefreshToken } from "@/features/auth/lib/token";
import { getToken, saveToken, removeToken, saveUser, getUser, removeUser } from "@/features/auth/lib/token";
import type { User, UserRole } from "@/shared/types/user";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

// Re-exported so existing consumers can keep importing from the slice, but the
// definitions live only in `@/shared/types/user` (the single source of truth).
export type { User, UserRole } from "@/shared/types/user";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  status: "idle" | "loading" | "succeeded" | "failed" | "initializing" | "ready";
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const normalizeRole = (role: string): UserRole => {
  const r = role.toUpperCase();
  // Legacy/display alias — map any stray "TEACHER" back to the backend role.
  if (r === "TEACHER") return "OPERATION";
  if (r === "STUDENT" || r === "OPERATION" || r === "ADMIN") return r;
  return "STUDENT";
};

export const dashboardPathByRole: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  OPERATION: "/teacher/dashboard",
  ADMIN: "/admin/dashboard",
};

/* ------------------------------------------------------------------ */
/*  Thunks                                                              */
/* ------------------------------------------------------------------ */

export const login = createAsyncThunk<
  { user: User; token: string },
  { email: string; password: string; remember?: boolean },
  { rejectValue: string }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User; accessToken: string; refreshToken: string };
    }>("/v1/auth/login", credentials);
    const remember = credentials.remember ?? true;
    if (remember) {
      saveToken(data.data.accessToken);
      saveUser(data.data.user);
      saveRefreshToken(data.data.refreshToken);
    } else {
      saveSessionToken(data.data.accessToken);
      saveSessionUser(data.data.user);
    }
    return { user: data.data.user, token: data.data.accessToken };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? "حصل خطأ أثناء تسجيل الدخول.");
  }
});

export const validateAuth = createAsyncThunk<
  { user: User },
  void,
  { rejectValue: string }
>("auth/validateAuth", async (_, { rejectWithValue }) => {
  const token = getToken();
  if (!token) {
    return rejectWithValue("No token found");
  }
  try {
    const { data } = await apiClient.get<{
      message: string;
      data: { user: User };
    }>("/v1/auth/me");
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? "Session expired");
  }
});

export const initAuth = createAsyncThunk<
  { token: string; user: User } | null,
  void,
  { rejectValue: string }
>("auth/init", async (_, { dispatch }) => {
  const token = getToken();
  const user = getUser<User>();

  if (!token || !user) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    if (isExpired) {
      dispatch(logout());
      return null;
    }
  } catch {
    dispatch(logout());
    return null;
  }

  try {
    const { data } = await apiClient.get<{
      message: string;
      data: { user: User };
    }>("/v1/auth/me");
    return { token, user: data.data.user };
  } catch {
    dispatch(logout());
    return null;
  }
});

export const register = createAsyncThunk<
  { user: User; token: string },
  { fullName: string; email: string; mobile: string; password: string },
  { rejectValue: string }
>("auth/register", async (payload, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User; accessToken: string };
    }>("/v1/auth/register", payload);
    saveToken(data.data.accessToken);
    saveUser(data.data.user);
    return { user: data.data.user, token: data.data.accessToken };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? "حصل خطأ أثناء إنشاء الحساب.");
  }
});

/* ------------------------------------------------------------------ */
/*  Slice                                                               */
/* ------------------------------------------------------------------ */

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isInitialized: false,
  status: "idle",
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: User; token: string; remember?: boolean }>,
    ) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.status = "succeeded";
      state.error = null;
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.status = "idle";
      state.error = null;
      removeToken();
      removeUser();
      clearSessionAuth();
      removeRefreshToken();
    },
    initialized(state) {
      state.isInitialized = true;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ---- login ----
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "حصل خطأ غير متوقع.";
      });

    // ---- validateAuth ----
    builder
      .addCase(validateAuth.pending, (state) => {
        state.status = "loading";
      })
      .addCase(validateAuth.fulfilled, (state, action) => {
        state.isInitialized = true;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.status = "succeeded";
      })
      .addCase(validateAuth.rejected, (state) => {
        state.isInitialized = true;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.status = "idle";
        removeToken();
        removeUser();
      });

    // ---- initAuth ----
    builder
      .addCase(initAuth.pending, (state) => {
        state.status = "initializing";
        state.error = null;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.status = "ready";
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
        }
      })
      .addCase(initAuth.rejected, (state) => {
        state.status = "ready";
      });

    // ---- register ----
    builder
      .addCase(register.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "حصل خطأ غير متوقع.";
      });
  },
});

export const { setCredentials, logout, clearError, initialized } = authSlice.actions;
export default authSlice.reducer;
