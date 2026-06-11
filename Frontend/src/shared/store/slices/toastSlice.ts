import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AppThunk } from '../types';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
}

const DEFAULT_DURATION = 4000;

const initialState: ToastState = {
  toasts: [],
};

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    addToast: (state, action: PayloadAction<Toast>) => {
      state.toasts.push(action.payload);
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { removeToast } = toastSlice.actions;

export const addToast =
  (toast: Omit<Toast, 'id'>): AppThunk =>
  (dispatch) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? DEFAULT_DURATION;

    dispatch(toastSlice.actions.addToast({ ...toast, id, duration }));

    setTimeout(() => {
      dispatch(removeToast(id));
    }, duration);
  };

export default toastSlice.reducer;
