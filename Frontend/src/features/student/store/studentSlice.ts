import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { StudentProfile } from '@/features/student/types/student';

interface StudentState {
  profile: StudentProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: StudentState = {
  profile: null,
  loading: false,
  saving: false,
  error: null,
};

const studentSlice = createSlice({
  name: 'student',
  initialState,
  reducers: {
    setStudentProfile(state, action: PayloadAction<StudentProfile | null>) {
      state.profile = action.payload;
      state.loading = false;
      state.error = null;
    },
    setStudentLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setStudentSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setStudentError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
      state.saving = false;
    },
    clearStudentProfile(state) {
      state.profile = null;
      state.loading = false;
      state.saving = false;
      state.error = null;
    },
  },
});

export const {
  setStudentProfile,
  setStudentLoading,
  setStudentSaving,
  setStudentError,
  clearStudentProfile,
} = studentSlice.actions;

export default studentSlice.reducer;
