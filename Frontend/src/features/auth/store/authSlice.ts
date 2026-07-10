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
  clearUser,
  removeRefreshToken,
} from '@/features/auth/lib/token';
import { clearPendingPayment } from '@/shared/lib/pendingPayment';
import type { User, UserRole } from '@/shared/types/user';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

// Re-exported so existing consumers can keep importing from the slice, but the
// definitions live only in `@/shared/types/user` (the single source of truth).
export type { User, UserRole } from '@/shared/types/user';

type LoginAccessState =
  | 'ACTIVE_TEACHER'
  | 'FREE_TEACHER'
  | 'TEACHER_PENDING_REVIEW'
  | 'TEACHER_REJECTED';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  accessState: LoginAccessState | null;
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
  { user: User; accessState?: LoginAccessState },
  { email: string; password: string; remember?: boolean },
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User; accessState?: LoginAccessState };
    }>('/v1/auth/login', credentials);
    // Tokens live only in HttpOnly cookies; we cache the user object for UX.
    saveUser(data.data.user);
    return { user: data.data.user, accessState: data.data.accessState };
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
  // The backend session cookies are the source of truth — not localStorage.
  // /auth/me confirms the session; the interceptor transparently performs one
  // cookie-based refresh if the access token has expired.
  try {
    const { data } = await apiClient.get<{
      message: string;
      data: { user: User };
    }>('/v1/auth/me');
    saveUser(data.data.user);
    return { user: data.data.user };
  } catch {
    clearUser();
    removeRefreshToken();
    return rejectWithValue('Session invalid');
  }
});

export interface RegisterReject {
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export const googleLogin = createAsyncThunk<
  { user: User },
  { credential: string },
  { rejectValue: string }
>('auth/googleLogin', async ({ credential }, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User };
    }>('/v1/auth/google', { credential });
    saveUser(data.data.user);
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue(apiErr.message ?? 'Google sign-in failed.');
  }
});

export const register = createAsyncThunk<
  { user: User },
  { fullName: string; email: string; mobile: string; password: string; stageId?: string; role?: string },
  { rejectValue: RegisterReject }
>('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const { data } = await apiClient.post<{
      message: string;
      data: { user: User };
    }>('/v1/auth/register', { ...payload, role: payload.role ?? 'STUDENT' });
    saveUser(data.data.user);
    return { user: data.data.user };
  } catch (err) {
    const apiErr = err as ApiError;
    return rejectWithValue({
      message: apiErr.message ?? 'حصل خطأ أثناء إنشاء الحساب.',
      fieldErrors: apiErr.errors,
    });
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
  accessState: null,
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
      // Settled-unauthenticated (NOT 'idle'): 'idle'/'loading' mean "bootstrap
      // still unknown" and make the guard show a spinner. After logout the guard
      // must redirect to /auth, so use the same settled state as a failed
      // bootstrap.
      state.status = 'failed';
      state.error = null;
      state.accessState = null;
      clearUser();
      removeRefreshToken();
      // Prevent stale payment state from persisting across auth sessions.
      // Delegated to a guarded shared helper so the slice never touches browser
      // web storage directly (auth-storage contract).
      clearPendingPayment();
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ---- login ----
    builder
      .addCase(login.pending, (state) => {
        // Do not set bootstrap `status` to 'loading' here — that status is only
        // for initAuth and route guards. Flipping it on every login attempt made
        // guards spin forever on the second failed try.
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
        state.accessState = action.payload.accessState ?? null;
      })
      .addCase(login.rejected, (state, action) => {
        state.error = action.payload ?? 'حصل خطأ غير متوقع.';
        if (!state.isAuthenticated) {
          state.status = 'failed';
        }
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

    // ---- googleLogin ----
    builder
      .addCase(googleLogin.pending, (state) => {
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.error = action.payload ?? 'Google sign-in failed.';
        state.status = 'failed';
      });

    // ---- register ----
    builder
      .addCase(register.pending, (state) => {
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
        // `register` rejects with a `RegisterReject` object; store its message
        // (field errors are read from the rejected payload via `unwrap()`).
        state.error = action.payload?.message ?? 'حصل خطأ غير متوقع.';
      });
  },
});

export const { setCredentials, logout, clearError } =
  authSlice.actions;
export default authSlice.reducer;
