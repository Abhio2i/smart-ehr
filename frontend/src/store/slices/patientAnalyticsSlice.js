import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import patientAnalyticsService from '../../api/services/patientAnalyticsService';

export const fetchPatientAnalyticsSummary = createAsyncThunk(
  'patientAnalytics/fetchSummary',
  async (arg, { rejectWithValue }) => {
    try {
      const organizationId = typeof arg === 'object' ? arg?.organizationId : arg;
      const startDate = typeof arg === 'object' ? arg?.startDate : undefined;
      const endDate = typeof arg === 'object' ? arg?.endDate : undefined;
      const refresh = typeof arg === 'object' ? !!arg?.refresh : false;
      return await patientAnalyticsService.getSummary(organizationId, startDate, endDate, refresh);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch patient analytics summary');
    }
  }
);

export const fetchPatientAnalyticsCount = createAsyncThunk(
  'patientAnalytics/fetchFastCount',
  async (organizationId, { rejectWithValue }) => {
    try {
      return await patientAnalyticsService.getFastCount(organizationId);
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch fast count');
    }
  }
);

const patientAnalyticsSlice = createSlice({
  name: 'patientAnalytics',
  initialState: {
    summary: null,
    summaryLoading: false,
    fastCount: 0,
    countLoading: false,
    error: null,
  },
  reducers: {
    clearPatientAnalyticsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Summary
      .addCase(fetchPatientAnalyticsSummary.pending, (state) => {
        state.summaryLoading = true;
        state.error = null;
      })
      .addCase(fetchPatientAnalyticsSummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.summary = action.payload;
        if (action.payload?.totalPatients !== undefined) {
          state.fastCount = action.payload.totalPatients;
        }
      })
      .addCase(fetchPatientAnalyticsSummary.rejected, (state, action) => {
        state.summaryLoading = false;
        state.error = action.payload;
      })
      // Fast count
      .addCase(fetchPatientAnalyticsCount.pending, (state) => {
        state.countLoading = true;
      })
      .addCase(fetchPatientAnalyticsCount.fulfilled, (state, action) => {
        state.countLoading = false;
        state.fastCount = action.payload;
      })
      .addCase(fetchPatientAnalyticsCount.rejected, (state, action) => {
        state.countLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearPatientAnalyticsError } = patientAnalyticsSlice.actions;

export const selectPatientAnalyticsSummary = (state) => state.patientAnalytics.summary;
export const selectPatientAnalyticsSummaryLoading = (state) => state.patientAnalytics.summaryLoading;
export const selectPatientAnalyticsFastCount = (state) => state.patientAnalytics.fastCount;
export const selectPatientAnalyticsCountLoading = (state) => state.patientAnalytics.countLoading;

export default patientAnalyticsSlice.reducer;
