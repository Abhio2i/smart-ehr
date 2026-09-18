import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchConsents = createAsyncThunk('hipaa/fetchConsents', async (patientId, { rejectWithValue }) => {
  try {
    const params = patientId ? { patientId } : {};
    return (await client.get('/api/hipaa/consent', { params, hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const createConsent = createAsyncThunk('hipaa/createConsent', async ({ patientId, organizationId, payload }, { rejectWithValue }) => {
  try {
    return (await client.post(`/api/patients/${patientId}/consents?organizationId=${organizationId}`, payload)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const revokeConsent = createAsyncThunk('hipaa/revokeConsent', async ({ patientId, consentId }, { rejectWithValue }) => {
  try {
    await client.post(`/api/patients/${patientId}/consents/${consentId}/revoke`);
    return consentId;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const fetchDisclosures = createAsyncThunk('hipaa/fetchDisclosures', async ({ patientId, organizationId }, { rejectWithValue }) => {
  try {
    if (patientId) {
      return (await client.get(`/api/disclosures/patients/${patientId}`, { hideToast: true })).data;
    }
    const params = organizationId ? { organizationId } : {};
    return (await client.get('/api/hipaa/disclosure', { params, hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const createDisclosure = createAsyncThunk('hipaa/createDisclosure', async (payload, { rejectWithValue }) => {
  try {
    return (await client.post('/api/disclosures', payload)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const hipaaSlice = createSlice({
  name: 'hipaa',
  initialState: {
    consents: [],
    disclosures: [],
    loading: false,
    error: null
  },
  reducers: {
    clearHipaaError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchConsents.pending, pending)
      .addCase(fetchConsents.fulfilled, (state, action) => {
        state.loading = false;
        state.consents = asList(action.payload);
      })
      .addCase(fetchConsents.rejected, rejected)

      .addCase(createConsent.fulfilled, (state, action) => {
        state.consents.unshift(action.payload);
      })
      .addCase(revokeConsent.fulfilled, (state, action) => {
        const idx = state.consents.findIndex(c => c.id === action.payload);
        if (idx !== -1) state.consents[idx].status = 'REVOKED';
      })

      .addCase(fetchDisclosures.pending, pending)
      .addCase(fetchDisclosures.fulfilled, (state, action) => {
        state.loading = false;
        state.disclosures = asList(action.payload);
      })
      .addCase(fetchDisclosures.rejected, rejected)

      .addCase(createDisclosure.fulfilled, (state, action) => {
        state.disclosures.unshift(action.payload);
      });
  }
});

export const { clearHipaaError } = hipaaSlice.actions;

export const selectConsents = (state) => state.hipaa.consents;
export const selectDisclosures = (state) => state.hipaa.disclosures;
export const selectHipaaLoading = (state) => state.hipaa.loading;

export default hipaaSlice.reducer;
