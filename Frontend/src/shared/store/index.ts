import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import uiReducer from './slices/uiSlice';
import toastReducer from './slices/toastSlice';
import teacherReducer from '@/features/teacher/store/teacherSlice';
import studentReducer from '@/features/student/store/studentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    toast: toastReducer,
    teacher: teacherReducer,
    student: studentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;