import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchActiveBreakGlass = createAsyncThunk('breakGlass/fetchActive', async (_, { rejectWithValue }) => {
  try {
    return (await client.get('/api/break-glass/active', { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const fetchBreakGlassHistory = createAsyncThunk('breakGlass/fetchHistory', async (organizationId, { rejectWithValue }) => {
  try {
    const url = organizationId ? `/api/break-glass/history?organizationId=${organizationId}` : '/api/break-glass/history';
    return (await client.get(url, { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const startBreakGlass = createAsyncThunk('breakGlass/start', async (payload, { rejectWithValue }) => {
  try {
    return (await client.post('/api/break-glass/start', payload)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const endBreakGlass = createAsyncThunk('breakGlass/end', async (id, { rejectWithValue }) => {
  try {
    await client.post(`/api/break-glass/${id}/end`);
    return id;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const breakGlassSlice = createSlice({
  name: 'breakGlass',
  initialState: {
    activeEvents: [],
    history: [],
    loading: false,
    error: null
  },
  reducers: {
    clearBreakGlassError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchActiveBreakGlass.pending, pending)
      .addCase(fetchActiveBreakGlass.fulfilled, (state, action) => {
        state.loading = false;
        state.activeEvents = asList(action.payload);
      })
      .addCase(fetchActiveBreakGlass.rejected, rejected)

      .addCase(fetchBreakGlassHistory.pending, pending)
      .addCase(fetchBreakGlassHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = asList(action.payload);
      })
      .addCase(fetchBreakGlassHistory.rejected, rejected)

      .addCase(startBreakGlass.fulfilled, (state, action) => {
        state.activeEvents.unshift(action.payload);
      })
      .addCase(endBreakGlass.fulfilled, (state, action) => {
        const id = action.payload;
        const event = state.activeEvents.find(e => e.id === id);
        if (event) {
          state.activeEvents = state.activeEvents.filter(e => e.id !== id);
          state.history.unshift({ ...event, status: 'ENDED', endedAt: new Date().toISOString() });
        }
      });
  }
});

export const { clearBreakGlassError } = breakGlassSlice.actions;

export const selectActiveBreakGlass = (state) => state.breakGlass.activeEvents;
export const selectBreakGlassHistory = (state) => state.breakGlass.history;
export const selectBreakGlassLoading = (state) => state.breakGlass.loading;

export default breakGlassSlice.reducer;
