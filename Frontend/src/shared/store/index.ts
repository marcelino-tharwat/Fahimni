import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import tenantReducer from '@/features/tenant/store/tenantSlice';
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
    tenant: tenantReducer,
    student: studentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;