import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { isAxiosError } from 'axios';
import { teacherApi } from '@/features/teacher/api/teacher';
import type { TeacherProfile, UpdateTeacherProfileInput, TeacherApiError } from '@/features/teacher/types/teacher';

/** Normalised error shape passed through `rejectWithValue`. */
interface TeacherThunkError {
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Turn an unknown thrown value into a `{ message, fieldErrors }` pair.
 * The backend error envelope is `{ success: false, message, errors? }`.
 */
function toThunkError(error: unknown): TeacherThunkError {
  if (isAxiosError(error)) {
    const body = error.response?.data as TeacherApiError | undefined;
    return {
      message: body?.message ?? error.message ?? 'حدث خطأ غير متوقع',
      fieldErrors: body?.errors,
    };
  }
  return { message: 'حدث خطأ غير متوقع' };
}

export const fetchTeacherProfile = createAsyncThunk<
  TeacherProfile,
  void,
  { rejectValue: TeacherThunkError }
>('teacher/fetchProfile', async (_arg, { rejectWithValue }) => {
  try {
    const res = await teacherApi.getProfile();
    return res.data;
  } catch (error) {
    return rejectWithValue(toThunkError(error));
  }
});

export const updateTeacherProfile = createAsyncThunk<
  TeacherProfile,
  UpdateTeacherProfileInput,
  { rejectValue: TeacherThunkError }
>('teacher/updateProfile', async (input, { rejectWithValue }) => {
  try {
    const res = await teacherApi.updateProfile(input);
    return res.data;
  } catch (error) {
    return rejectWithValue(toThunkError(error));
  }
});

export const uploadTeacherPhoto = createAsyncThunk<
  TeacherProfile,
  File,
  { rejectValue: TeacherThunkError }
>('teacher/uploadPhoto', async (file, { rejectWithValue }) => {
  try {
    const res = await teacherApi.uploadPhoto(file);
    return res.data;
  } catch (error) {
    return rejectWithValue(toThunkError(error));
  }
});

export const uploadTeacherLogo = createAsyncThunk<
  TeacherProfile,
  File,
  { rejectValue: TeacherThunkError }
>('teacher/uploadLogo', async (file, { rejectWithValue }) => {
  try {
    const res = await teacherApi.uploadLogo(file);
    return res.data;
  } catch (error) {
    return rejectWithValue(toThunkError(error));
  }
});

export interface TeacherState {
  profile: TeacherProfile | null;
  loading: boolean;
  saving: boolean;
  uploadingPhoto: boolean;
  uploadingLogo: boolean;
  error: string | null;
  /** Field-level validation errors keyed by field name (from the backend). */
  fieldErrors: Record<string, string[]> | null;
}

const initialState: TeacherState = {
  profile: null,
  loading: false,
  saving: false,
  uploadingPhoto: false,
  uploadingLogo: false,
  error: null,
  fieldErrors: null,
};

const teacherSlice = createSlice({
  name: 'teacher',
  initialState,
  reducers: {
    clearTeacherErrors: (state) => {
      state.error = null;
      state.fieldErrors = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchTeacherProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeacherProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchTeacherProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'تعذّر تحميل بيانات الحساب';
      })
      // update
      .addCase(updateTeacherProfile.pending, (state) => {
        state.saving = true;
        state.error = null;
        state.fieldErrors = null;
      })
      .addCase(updateTeacherProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.profile = action.payload;
      })
      .addCase(updateTeacherProfile.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload?.message ?? 'تعذّر حفظ التعديلات';
        state.fieldErrors = action.payload?.fieldErrors ?? null;
      })
      // photo upload
      .addCase(uploadTeacherPhoto.pending, (state) => {
        state.uploadingPhoto = true;
        state.error = null;
      })
      .addCase(uploadTeacherPhoto.fulfilled, (state, action) => {
        state.uploadingPhoto = false;
        state.profile = action.payload;
      })
      .addCase(uploadTeacherPhoto.rejected, (state, action) => {
        state.uploadingPhoto = false;
        state.error = action.payload?.message ?? 'حصل مشكلة في رفع الصورة';
      })
      // logo upload
      .addCase(uploadTeacherLogo.pending, (state) => {
        state.uploadingLogo = true;
        state.error = null;
      })
      .addCase(uploadTeacherLogo.fulfilled, (state, action) => {
        state.uploadingLogo = false;
        state.profile = action.payload;
      })
      .addCase(uploadTeacherLogo.rejected, (state, action) => {
        state.uploadingLogo = false;
        state.error = action.payload?.message ?? 'حصل مشكلة في رفع الشعار';
      });
  },
});

export const { clearTeacherErrors } = teacherSlice.actions;

export default teacherSlice.reducer;
