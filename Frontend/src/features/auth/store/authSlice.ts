// src/store/authSlice.ts
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient, type ApiError } from "@/shared/lib/api/client";
import { getToken, saveToken, removeToken, saveUser, getUser, removeUser } from "@/features/auth/lib/token";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type Role = "STUDENT" | "TEACHER" | "ADMIN" | "OPERATION";
export type Status = "ACTIVE" | "INACTIVE";

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: Role;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const normalizeRole = (role: string): Role => {
  const r = role.toUpperCase() as Role;
  if (["STUDENT", "TEACHER", "ADMIN", "OPERATION"].includes(r)) return r;
  return "STUDENT";
};

export const dashboardPathByRole: Record<Role, string> = {
  STUDENT: "/student/dashboard",
  TEACHER: "/teacher/dashboard",
  ADMIN: "/admin/dashboard",
  OPERATION: "/teacher/dashboard",
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
      data: { user: User; accessToken: string };
    }>("/v1/auth/login", credentials);
    const remember = credentials.remember ?? true;
    saveToken(data.data.accessToken, remember);
    saveUser(data.data.user, remember);
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

const storedUser = getUser<User>();
const storedToken = getToken();

const initialState: AuthState = {
  user: storedUser,
  token: storedToken,
  isAuthenticated: !!storedToken && !!storedUser,
  isInitialized: !storedToken,
  status: storedToken ? "succeeded" : "idle",
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
      saveToken(action.payload.token, action.payload.remember);
      saveUser(action.payload.user, action.payload.remember);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.status = "idle";
      state.error = null;
      removeToken();
      removeUser();
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
