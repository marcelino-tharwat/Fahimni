// src/store/authSlice.ts
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';
import { apiClient, type ApiError } from '@/shared/lib/api/client';
import { authApi } from '@/features/auth/api/auth';
import {
  saveUser,
  getUser,
  clearUser,
  saveRefreshToken,
  removeRefreshToken,
} from '@/features/auth/lib/token';
import type { User, UserRole } from '@/shared/types/user';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

// Re-exported so existing consumers can keep importing from the slice, but the
// definitions live only in `@/shared/types/user` (the single source of truth).
export type { User, UserRole } from '@/shared/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

export const normalizeRole = (role: string): UserRole => {
  const r = role.toUpperCase();
  // Legacy/display alias — map any stray "TEACHER" back to the backend role.
  if (r === 'TEACHER') return 'OPERATION';
  if (r === 'STUDENT' || r === 'OPERATION' || r === 'ADMIN') return r;
  return 'STUDENT';
};

export const dashboardPathByRole: Record<UserRole, string> = {
  STUDENT: '/student/dashboard',
  OPERATION: '/teacher/dashboard',
  ADMIN: '/admin/dashboard',
};

/* ------------------------------------------------------------------ */
/*  Thunks                                                              */
/* ------------------------------------------------------------------ */

export const login = createAsyncThunk<
  { user: User },
  { email: string; password: string; remember?: boolean },
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User; refreshToken: string };
    }>('/v1/auth/login', credentials);
    saveUser(data.data.user);
    saveRefreshToken(data.data.refreshToken);
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'حصل خطأ أثناء تسجيل الدخول.');
  }
});

export const validateAuth = createAsyncThunk<
  { user: User },
  void,
  { rejectValue: string }
>('auth/validateAuth', async (_, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.get<{
      message: string;
      data: { user: User };
    }>('/v1/auth/me');
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Session expired');
  }
});

export const initAuth = createAsyncThunk<
  { user: User },
  void,
  { rejectValue: string }
>('auth/initAuth', async (_, { rejectWithValue }) => {
  const storedUser = getUser<User>();

  if (!storedUser) {
    return rejectWithValue('No stored user');
  }

  try {
    const { data } = await apiClient.get<{
      message: string;
      data: { user: User };
    }>('/v1/auth/me');
    return { user: data.data.user };
  } catch {
    clearUser();
    removeRefreshToken();
    return rejectWithValue('Session invalid');
  }
});

export const register = createAsyncThunk<
  { user: User },
  { fullName: string; email: string; mobile: string; password: string },
  { rejectValue: string }
>('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User; refreshToken: string };
    }>('/v1/auth/register', payload);
    saveUser(data.data.user);
    saveRefreshToken(data.data.refreshToken);
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'حصل خطأ أثناء إنشاء الحساب.');
  }
});

export const logoutUser = createAsyncThunk<
  void,
  void,
  { rejectValue: string }
>("auth/logout", async (_, { dispatch }) => {
  try {
    await authApi.logout();
  } catch {
    // Even if the server call fails, clear local state
  } finally {
    dispatch(logout());
  }
});

/* ------------------------------------------------------------------ */
/*  Slice                                                               */
/* ------------------------------------------------------------------ */

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ user: User }>,
    ) {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.status = 'succeeded';
      state.error = null;
    },
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.status = 'idle';
      state.error = null;
      clearUser();
      removeRefreshToken();
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ---- login ----
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'حصل خطأ غير متوقع.';
      });

    // ---- validateAuth ----
    builder
      .addCase(validateAuth.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(validateAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.status = 'succeeded';
      })
      .addCase(validateAuth.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.status = 'failed';
      });

    // ---- initAuth ----
    builder
      .addCase(initAuth.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(initAuth.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.status = 'succeeded';
      })
      .addCase(initAuth.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.status = 'failed';
      });

    // ---- register ----
    builder
      .addCase(register.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'حصل خطأ غير متوقع.';
      });
  },
});

export const { setCredentials, logout, clearError } =
  authSlice.actions;
export default authSlice.reducer;
