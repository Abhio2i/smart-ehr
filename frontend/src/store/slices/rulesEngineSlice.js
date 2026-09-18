import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// Fetch If-Then logic rules for organization
export const fetchRules = createAsyncThunk('rulesEngine/fetch', async (orgId, { rejectWithValue }) => {
  try {
    const url = orgId ? `/api/logic/rules?organizationId=${orgId}` : '/api/logic/rules';
    const response = await client.get(url, { hideToast: true });
    return response.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// Create a new If-Then logic rule
export const createRule = createAsyncThunk('rulesEngine/create', async (ruleData, { rejectWithValue }) => {
  try {
    const response = await client.post('/api/logic/rules', ruleData);
    return response.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// Run rules evaluation for organization
export const runRules = createAsyncThunk('rulesEngine/run', async (payload, { rejectWithValue }) => {
  try {
    const response = await client.post('/api/logic/run', payload);
    return response.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// Run rules evaluation for a specific patient
export const runRulesForPatient = createAsyncThunk('rulesEngine/runForPatient', async ({ patientId, dryRun }, { rejectWithValue }) => {
  try {
    const response = await client.post(`/api/logic/run/patient/${patientId}`, { dryRun });
    return response.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// Fetch standard rule fields from backend
export const fetchFields = createAsyncThunk('rulesEngine/fetchFields', async (_, { rejectWithValue }) => {
  try {
    const response = await client.get('/api/logic/rules/fields', { hideToast: true });
    return response.data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

const rulesEngineSlice = createSlice({
  name: 'rulesEngine',
  initialState: {
    rules: [],
    fields: [],
    loading: false,
    saving: false,
    running: false,
    runResults: null,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearRunResults: (state) => {
      state.runResults = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Rules
    builder.addCase(fetchRules.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchRules.fulfilled, (state, action) => {
      state.loading = false;
      state.rules = asList(action.payload);
    });
    builder.addCase(fetchRules.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create Rule
    builder.addCase(createRule.pending, (state) => {
      state.saving = true;
      state.error = null;
    });
    builder.addCase(createRule.fulfilled, (state, action) => {
      state.saving = false;
      state.rules.unshift(action.payload);
    });
    builder.addCase(createRule.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload;
    });

    // Run Rules (Organization)
    builder.addCase(runRules.pending, (state) => {
      state.running = true;
      state.error = null;
    });
    builder.addCase(runRules.fulfilled, (state, action) => {
      state.running = false;
      state.runResults = action.payload;
    });
    builder.addCase(runRules.rejected, (state, action) => {
      state.running = false;
      state.error = action.payload;
    });

    // Run Rules (Patient)
    builder.addCase(runRulesForPatient.pending, (state) => {
      state.running = true;
      state.error = null;
    });
    builder.addCase(runRulesForPatient.fulfilled, (state, action) => {
      state.running = false;
      state.runResults = action.payload;
    });
    builder.addCase(runRulesForPatient.rejected, (state, action) => {
      state.running = false;
      state.error = action.payload;
    });

    // Fetch Fields
    builder.addCase(fetchFields.fulfilled, (state, action) => {
      if (Array.isArray(action.payload)) {
        state.fields = action.payload;
      } else if (action.payload && typeof action.payload === 'object') {
        // In case it's a Set serialized as object/array or other structure
        state.fields = Object.values(action.payload);
      }
    });
  },
});

export const { clearError, clearRunResults } = rulesEngineSlice.actions;
export default rulesEngineSlice.reducer;
