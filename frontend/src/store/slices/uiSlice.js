import { createSlice } from '@reduxjs/toolkit';

let _id = 0;

const uiSlice = createSlice({
  name: 'ui',
  initialState: { 
    toasts: [], 
    globalLoading: false, 
    theme: localStorage.getItem('theme') || 'dark' 
  },
  reducers: {
    addToast(state, { payload }) {
      state.toasts.push({ id: ++_id, duration: 4000, type: 'info', ...payload });
    },
    removeToast(state, { payload: id }) {
      state.toasts = state.toasts.filter(t => t.id !== id);
    },
    setGlobalLoading(state, { payload }) {
      state.globalLoading = payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
    },
    setTheme(state, { payload }) {
      state.theme = payload;
      localStorage.setItem('theme', payload);
    }
  },
});

export const { addToast, removeToast, setGlobalLoading, toggleTheme, setTheme } = uiSlice.actions;

// Convenience helpers
export const toastSuccess = (message) => addToast({ type: 'success', message });
export const toastError   = (message) => addToast({ type: 'error',   message });
export const toastInfo    = (message) => addToast({ type: 'info',    message });

export const selectToasts = (s) => s.ui.toasts;
export default uiSlice.reducer;
