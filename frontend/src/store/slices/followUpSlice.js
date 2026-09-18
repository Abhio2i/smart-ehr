import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

// ── Async Thunks ──────────────────────────────────────────────────────
export const fetchFollowUps = createAsyncThunk(
  'followUps/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const query = {};
      if (params.status)   query.status   = params.status;
      if (params.dueDate)  query.dueDate   = params.dueDate;
      if (params.page !== undefined) query.page = params.page;
      if (params.size !== undefined) query.size = params.size;
      const res = await client.get('/api/follow-ups', { params: query, hideToast: true });
      return res.data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const markFollowUpSent = createAsyncThunk(
  'followUps/markSent',
  async (taskId, { rejectWithValue }) => {
    try {
      const res = await client.patch(`/api/follow-ups/${taskId}/sent`);
      return res.data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────
const followUpSlice = createSlice({
  name: 'followUps',
  initialState: {
    tasks: [],
    loading: false,
    error: null,
    pagination: { page: 0, totalPages: 0, totalElements: 0, isLast: true },
    lastFetched: null,
  },
  reducers: {
    clearError(state)       { state.error = null; },
    clearFollowUps(state)   { state.tasks = []; state.lastFetched = null; },
  },
  extraReducers: (b) => {
    b
      .addCase(fetchFollowUps.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(fetchFollowUps.fulfilled, (s, a) => {
        s.loading = false;
        s.lastFetched = Date.now();
        const raw = a.payload;
        if (Array.isArray(raw)) {
          s.tasks = raw;
        } else if (raw?.content) {
          s.tasks = raw.content;
          s.pagination = {
            page:          raw.page           ?? 0,
            totalPages:    raw.totalPages      ?? 1,
            totalElements: raw.totalElements   ?? raw.content.length,
            isLast:        raw.last            ?? true,
          };
        } else {
          s.tasks = [];
        }
      })
      .addCase(fetchFollowUps.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

      .addCase(markFollowUpSent.fulfilled, (s, a) => {
        const idx = s.tasks.findIndex(t => t.id === a.payload.id || t.patientId === a.payload.patientId);
        if (idx !== -1) s.tasks[idx] = { ...s.tasks[idx], ...a.payload };
      });
  },
});

export const { clearError, clearFollowUps } = followUpSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────
export const selectFollowUpTasks       = (s) => s.followUps.tasks;
export const selectFollowUpLoading     = (s) => s.followUps.loading;
export const selectFollowUpError       = (s) => s.followUps.error;
export const selectFollowUpPagination  = (s) => s.followUps.pagination;
export const selectPendingFollowUps    = (s) => s.followUps.tasks.filter(t => t.status === 'PENDING');
export const selectFollowUpLastFetched = (s) => s.followUps.lastFetched;

export default followUpSlice.reducer;
