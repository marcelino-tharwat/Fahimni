import type { Action, ThunkAction } from '@reduxjs/toolkit';
import type authReducer from '@/features/auth/store/authSlice';
import type uiReducer from './slices/uiSlice';
import type toastReducer from './slices/toastSlice';
import type teacherReducer from '@/features/teacher/store/teacherSlice';

export type RootState = {
  auth: ReturnType<typeof authReducer>;
  ui: ReturnType<typeof uiReducer>;
  toast: ReturnType<typeof toastReducer>;
  teacher: ReturnType<typeof teacherReducer>;
};

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
