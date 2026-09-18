import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── QA Auto-Flag Rules ──────────────────────────────────────────────
export const fetchQARules = createAsyncThunk('qaRules/fetch', async (orgId, { rejectWithValue }) => {
  try { 
    return (await client.get(`/api/qa/rules?organizationId=${orgId}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createQARule = createAsyncThunk('qaRules/create', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/qa/rules', data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const updateQARule = createAsyncThunk('qaRules/update', async ({ id, data }, { rejectWithValue }) => {
  try { 
    // Assuming PUT endpoint exists, or POST with ID for update
    return (await client.post(`/api/qa/rules/${id}`, data)).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const deleteQARule = createAsyncThunk('qaRules/delete', async (ruleId, { rejectWithValue }) => {
  try {
    // Assuming DELETE endpoint exists
    await client.delete(`/api/qa/rules/${ruleId}`);
    return ruleId;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── Slice ────────────────────────────────────────────────────────────
const qaRulesSlice = createSlice({
  name: 'qaRules',
  initialState: {
    rules: [],
    selectedRule: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearRules: (state) => { state.rules = []; },
  },
  extraReducers: (builder) => {
    // Fetch Rules
    builder.addCase(fetchQARules.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchQARules.fulfilled, (state, action) => {
      state.loading = false;
      state.rules = asList(action.payload);
    });
    builder.addCase(fetchQARules.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create Rule
    builder.addCase(createQARule.fulfilled, (state, action) => {
      state.rules.push(action.payload);
    });
    builder.addCase(createQARule.rejected, (state, action) => {
      state.error = action.payload;
    });

    // Update Rule
    builder.addCase(updateQARule.fulfilled, (state, action) => {
      const idx = state.rules.findIndex(r => r.id === action.payload.id);
      if (idx >= 0) state.rules[idx] = action.payload;
    });
    builder.addCase(updateQARule.rejected, (state, action) => {
      state.error = action.payload;
    });

    // Delete Rule
    builder.addCase(deleteQARule.fulfilled, (state, action) => {
      state.rules = state.rules.filter(r => r.id !== action.payload);
    });
    builder.addCase(deleteQARule.rejected, (state, action) => {
      state.error = action.payload;
    });
  }
});

export const { clearError, clearRules } = qaRulesSlice.actions;
export default qaRulesSlice.reducer;
