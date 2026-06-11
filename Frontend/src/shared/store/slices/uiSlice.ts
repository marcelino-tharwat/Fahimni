// src/store/uiSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import i18n from "@/shared/lib/i18n";

type Language = "ar" | "en";
type Direction = "rtl" | "ltr";

interface UIState {
  sidebarOpen: boolean;
  language: Language;
  direction: Direction;
}

const initialState: UIState = {
  sidebarOpen: true,
  language: "ar",
  direction: "rtl",
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload;
      state.direction = action.payload === "ar" ? "rtl" : "ltr";
    },
  },
});

export const { toggleSidebar, setSidebarOpen, setLanguage } = uiSlice.actions;
export default uiSlice.reducer;

// Thunk typed with generic Dispatch to avoid circular import with store/index.ts
export const changeLanguage =
  (lang: Language) =>
  (dispatch: (action: ReturnType<typeof setLanguage>) => void) => {
    dispatch(setLanguage(lang));
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    i18n.changeLanguage(lang);
  };