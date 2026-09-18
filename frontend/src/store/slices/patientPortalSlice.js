import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── OTP Auth Thunks (email-only) ─────────────────────────────────────────────

/**
 * Step 1 — Request OTP: POST /api/patient/auth/request-otp
 * Body: { email: string }
 */
export const requestPatientOtp = createAsyncThunk(
  'patientPortal/requestOtp',
  async ({ email }, { rejectWithValue }) => {
    try {
      // Backend expects { identifier } not { email }
      const res = await client.post('/api/patient/auth/request-otp', { identifier: email });
      return res.data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

/**
 * Step 2 — Verify OTP & login: POST /api/patient/auth/login
 * Body: { email: string, otp: string }
 */
export const verifyPatientOtp = createAsyncThunk(
  'patientPortal/verifyOtp',
  async ({ email, otp }, { rejectWithValue }) => {
    try {
      // Backend expects { identifier, otp }
      const res = await client.post('/api/patient/auth/login', { identifier: email, otp });
      return res.data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

// ── Portal Data Thunks ───────────────────────────────────────────────────────

/**
 * Fetches all patient portal data in one parallel batch:
 * records, amendments, restrictions, disclosures, appointments, travel bundles.
 */
export const fetchPortalData = createAsyncThunk(
  'patientPortal/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const [r, a, rs, d, appts, tb] = await Promise.all([
        client.get('/api/patient-portal/records',               { hideToast: true }),
        client.get('/api/patient-portal/amendment-requests',    { hideToast: true }),
        client.get('/api/patient-portal/disclosure-restrictions', { hideToast: true }),
        client.get('/api/patient-portal/disclosures',           { hideToast: true }),
        client.get('/api/patient-portal/appointments',          { hideToast: true }).catch(() => ({ data: [] })),
        client.get('/api/patient-portal/travel-bundles',        { hideToast: true }).catch(() => ({ data: [] })),
      ]);
      return {
        records:       asList(r.data),
        amendments:    asList(a.data),
        restrictions:  asList(rs.data),
        disclosures:   asList(d.data),
        appointments:  asList(appts.data),
        travelBundles: asList(tb.data),
      };
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const createAmendment = createAsyncThunk(
  'patientPortal/createAmendment',
  async (payload, { rejectWithValue }) => {
    try {
      return (await client.post('/api/patient-portal/amendment-requests', payload)).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const createRestriction = createAsyncThunk(
  'patientPortal/createRestriction',
  async (payload, { rejectWithValue }) => {
    try {
      return (await client.post('/api/patient-portal/disclosure-restrictions', payload)).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

/**
 * Cancel a patient's own appointment from the portal.
 * PATCH /api/patient-portal/appointments/{id}/cancel
 */
export const cancelPortalAppointment = createAsyncThunk(
  'patientPortal/cancelAppointment',
  async (appointmentId, { rejectWithValue }) => {
    try {
      const res = await client.patch(`/api/patient-portal/appointments/${appointmentId}/cancel`);
      return res.data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const patientPortalSlice = createSlice({
  name: 'patientPortal',
  initialState: {
    records:       [],
    amendments:    [],
    restrictions:  [],
    disclosures:   [],
    appointments:  [],   // ← patient's scheduled appointments
    travelBundles: [],   // ← patient's travel bundles (NWT)
    loading:       false,
    error:         null,
  },
  reducers: {
    clearPortalError: (state) => { state.error = null; },
    resetPortalState: () => ({
      records:       [],
      amendments:    [],
      restrictions:  [],
      disclosures:   [],
      appointments:  [],
      travelBundles: [],
      loading:       false,
      error:         null,
    }),
  },
  extraReducers: (builder) => {
    builder
      // ── fetchPortalData ──────────────────────────────────────────────────
      .addCase(fetchPortalData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPortalData.fulfilled, (state, action) => {
        state.loading       = false;
        state.records       = action.payload.records;
        state.amendments    = action.payload.amendments;
        state.restrictions  = action.payload.restrictions;
        state.disclosures   = action.payload.disclosures;
        state.appointments  = action.payload.appointments;
        state.travelBundles = action.payload.travelBundles;
      })
      .addCase(fetchPortalData.rejected, (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })

      // ── createAmendment ──────────────────────────────────────────────────
      .addCase(createAmendment.fulfilled, (state, action) => {
        state.amendments.unshift(action.payload);
      })

      // ── createRestriction ────────────────────────────────────────────────
      .addCase(createRestriction.fulfilled, (state, action) => {
        state.restrictions.unshift(action.payload);
      })

      // ── cancelPortalAppointment ──────────────────────────────────────────
      .addCase(cancelPortalAppointment.fulfilled, (state, action) => {
        // Update the cancelled appointment in-place (status → CANCELLED)
        const idx = state.appointments.findIndex(a => a.id === action.payload?.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
      });
  },
});

export const { clearPortalError, resetPortalState } = patientPortalSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────
export const selectPortalRecords       = (state) => state.patientPortal.records;
export const selectPortalAmendments    = (state) => state.patientPortal.amendments;
export const selectPortalRestrictions  = (state) => state.patientPortal.restrictions;
export const selectPortalDisclosures   = (state) => state.patientPortal.disclosures;
export const selectPortalAppointments  = (state) => state.patientPortal.appointments;   // ← was missing
export const selectPortalTravelBundles = (state) => state.patientPortal.travelBundles;  // ← was missing
export const selectPortalLoading       = (state) => state.patientPortal.loading;

export default patientPortalSlice.reducer;
