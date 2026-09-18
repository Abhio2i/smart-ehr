import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchAuditLogs = createAsyncThunk('audit/fetchLogs', async ({ page = 0, size = 20, filters = {} }, { rejectWithValue }) => {
  try {
    let url = `/api/audit/logs?page=${page}&size=${size}`;
    const res = await client.get(url, { hideToast: true });
    return res.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const auditSlice = createSlice({
  name: 'audit',
  initialState: {
    logs: [],
    loading: false,
    error: null,
    hasMore: false,
    page: 0
  },
  reducers: {
    clearAuditError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAuditLogs.pending, (state, action) => {
        if (!action.meta.arg.isAppend) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.loading = false;
        const data = action.payload;
        const isPaginated = data && data.content !== undefined;
        const newLogs = isPaginated ? data.content : (Array.isArray(data) ? data : []);
        
        if (action.meta.arg.isAppend) {
          state.logs = [...state.logs, ...newLogs];
        } else {
          state.logs = newLogs;
        }
        
        state.hasMore = isPaginated ? !data.last : false;
        state.page = action.meta.arg.page || 0;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearAuditError } = auditSlice.actions;

export const selectAuditLogs = (state) => state.audit.logs;
export const selectAuditLoading = (state) => state.audit.loading;
export const selectAuditHasMore = (state) => state.audit.hasMore;
export const selectAuditPage = (state) => state.audit.page;
export const selectAuditError = (state) => state.audit.error;

export default auditSlice.reducer;
