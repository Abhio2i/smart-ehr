import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchDeIdRecord = createAsyncThunk('deid/fetchRecord', async (recordId, { rejectWithValue }) => {
  try {
    return (await client.get(`/api/hipaa/deid/record/${recordId}`, { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const maskRecord = createAsyncThunk('deid/mask', async ({ recordId, maskingStrategy }, { rejectWithValue }) => {
  try {
    return (await client.post('/api/hipaa/deid/mask', { recordId, maskingStrategy })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const anonymizeRecord = createAsyncThunk('deid/anonymize', async ({ recordId, anonymizationMethod }, { rejectWithValue }) => {
  try {
    return (await client.post('/api/hipaa/deid/anonymize', { recordId, anonymizationMethod })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const deIdSlice = createSlice({
  name: 'deid',
  initialState: {
    deidResult: null,
    maskResult: null,
    anonResult: null,
    loading: {
      deid: false,
      mask: false,
      anonymize: false
    },
    error: null
  },
  reducers: {
    clearResults: (state) => {
      state.deidResult = null;
      state.maskResult = null;
      state.anonResult = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeIdRecord.pending, (state) => { state.loading.deid = true; state.error = null; })
      .addCase(fetchDeIdRecord.fulfilled, (state, action) => {
        state.loading.deid = false;
        state.deidResult = action.payload;
      })
      .addCase(fetchDeIdRecord.rejected, (state, action) => {
        state.loading.deid = false;
        state.error = action.payload;
      })

      .addCase(maskRecord.pending, (state) => { state.loading.mask = true; state.error = null; })
      .addCase(maskRecord.fulfilled, (state, action) => {
        state.loading.mask = false;
        state.maskResult = action.payload;
      })
      .addCase(maskRecord.rejected, (state, action) => {
        state.loading.mask = false;
        state.error = action.payload;
      })

      .addCase(anonymizeRecord.pending, (state) => { state.loading.anonymize = true; state.error = null; })
      .addCase(anonymizeRecord.fulfilled, (state, action) => {
        state.loading.anonymize = false;
        state.anonResult = action.payload;
      })
      .addCase(anonymizeRecord.rejected, (state, action) => {
        state.loading.anonymize = false;
        state.error = action.payload;
      });
  }
});

export const { clearResults } = deIdSlice.actions;

export const selectDeIdResult = (state) => state.deid.deidResult;
export const selectMaskResult = (state) => state.deid.maskResult;
export const selectAnonResult = (state) => state.deid.anonResult;
export const selectDeIdLoading = (state) => state.deid.loading;
export const selectDeIdError = (state) => state.deid.error;

export default deIdSlice.reducer;
