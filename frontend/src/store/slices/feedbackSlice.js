import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchFeedbackThreads = createAsyncThunk('feedback/fetchThreads', async (_, { rejectWithValue }) => {
  try {
    return (await client.get('/api/feedback/threads', { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const createFeedbackThread = createAsyncThunk('feedback/createThread', async (payload, { rejectWithValue }) => {
  try {
    return (await client.post('/api/feedback/threads', payload)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const addFeedbackMessage = createAsyncThunk('feedback/addMessage', async ({ threadId, message }, { rejectWithValue }) => {
  try {
    return (await client.post(`/api/feedback/threads/${threadId}/messages`, { message })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const updateFeedbackStatus = createAsyncThunk('feedback/updateStatus', async ({ threadId, status }, { rejectWithValue }) => {
  try {
    return (await client.put(`/api/feedback/threads/${threadId}/status?status=${status}`)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const deleteFeedbackThread = createAsyncThunk('feedback/deleteThread', async (threadId, { rejectWithValue }) => {
  try {
    await client.delete(`/api/feedback/threads/${threadId}`);
    return threadId;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const feedbackSlice = createSlice({
  name: 'feedback',
  initialState: {
    threads: [],
    loading: false,
    error: null
  },
  reducers: {
    clearFeedbackError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchFeedbackThreads.pending, pending)
      .addCase(fetchFeedbackThreads.fulfilled, (state, action) => {
        state.loading = false;
        state.threads = asList(action.payload);
      })
      .addCase(fetchFeedbackThreads.rejected, rejected)

      .addCase(createFeedbackThread.fulfilled, (state, action) => {
        state.threads.unshift(action.payload);
      })

      .addCase(addFeedbackMessage.fulfilled, (state, action) => {
        const idx = state.threads.findIndex(t => t.id === action.payload.id);
        if (idx !== -1) {
          state.threads[idx] = action.payload;
        }
      })
      .addCase(updateFeedbackStatus.fulfilled, (state, action) => {
        const idx = state.threads.findIndex(t => t.id === action.payload.id);
        if (idx !== -1) state.threads[idx] = action.payload;
      })
      .addCase(deleteFeedbackThread.fulfilled, (state, action) => {
        state.threads = state.threads.filter(t => t.id !== action.payload);
      });
  }
});

export const { clearFeedbackError } = feedbackSlice.actions;

export const selectFeedbackThreads = (state) => state.feedback.threads;
export const selectFeedbackLoading = (state) => state.feedback.loading;

export default feedbackSlice.reducer;
