import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Form Templates ──────────────────────────────────────────────────
export const fetchFormTemplates = createAsyncThunk('formTemplate/fetch', async (
  { orgId, templateType },
  { rejectWithValue }
) => {
  try {
    return (await client.get(`/api/formengine/templates?organizationId=${orgId}&templateType=${templateType}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to load templates'); }
});

export const fetchLatestTemplate = createAsyncThunk('formTemplate/fetchLatest', async (
  { orgId, templateType },
  { rejectWithValue }
) => {
  try {
    return (await client.get(`/api/formengine/templates/latest?organizationId=${orgId}&templateType=${templateType}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to load latest template'); }
});

export const createFormTemplate = createAsyncThunk('formTemplate/create', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/formengine/templates', data)).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to create template'); }
});

export const updateFormTemplate = createAsyncThunk('formTemplate/update', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/formengine/templates/${id}`, data)).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to update template'); }
});

export const submitFormSubmission = createAsyncThunk('formTemplate/submit', async (
  { templateId, submission },
  { rejectWithValue }
) => {
  try {
    return (await client.post(`/api/formengine/templates/${templateId}/submissions`, submission)).data;
  }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to submit form'); }
});

export const fetchFormSubmissions = createAsyncThunk('formTemplate/fetchSubmissions', async (
  orgId,
  { rejectWithValue }
) => {
  try {
    return (await client.get(`/api/formengine/submissions?organizationId=${orgId}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed to load submissions'); }
});

// ── Slice ────────────────────────────────────────────────────────────
const formTemplateSlice = createSlice({
  name: 'formTemplate',
  initialState: {
    templates: [],
    latestTemplate: null,
    submissions: [],
    selectedTemplate: null,
    loading: false,
    submitting: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearTemplates: (state) => { state.templates = []; },
  },
  extraReducers: (builder) => {
    // Fetch Templates
    builder.addCase(fetchFormTemplates.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchFormTemplates.fulfilled, (state, action) => {
      state.loading = false;
      state.templates = asList(action.payload);
    });
    builder.addCase(fetchFormTemplates.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch Latest Template
    builder.addCase(fetchLatestTemplate.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchLatestTemplate.fulfilled, (state, action) => {
      state.loading = false;
      state.latestTemplate = action.payload;
      state.selectedTemplate = action.payload;
    });
    builder.addCase(fetchLatestTemplate.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create Template
    builder.addCase(createFormTemplate.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(createFormTemplate.fulfilled, (state, action) => {
      state.loading = false;
      state.templates.push(action.payload);
      state.latestTemplate = action.payload;
    });
    builder.addCase(createFormTemplate.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Update Template
    builder.addCase(updateFormTemplate.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(updateFormTemplate.fulfilled, (state, action) => {
      state.loading = false;
      const idx = state.templates.findIndex(t => t.id === action.payload.id);
      if (idx !== -1) state.templates[idx] = action.payload;
      if (state.latestTemplate?.id === action.payload.id) state.latestTemplate = action.payload;
    });
    builder.addCase(updateFormTemplate.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Submit Form
    builder.addCase(submitFormSubmission.pending, (state) => { state.submitting = true; state.error = null; });
    builder.addCase(submitFormSubmission.fulfilled, (state, action) => {
      state.submitting = false;
      state.submissions.push(action.payload);
    });
    builder.addCase(submitFormSubmission.rejected, (state, action) => {
      state.submitting = false;
      state.error = action.payload;
    });

    // Fetch Submissions
    builder.addCase(fetchFormSubmissions.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchFormSubmissions.fulfilled, (state, action) => {
      state.loading = false;
      state.submissions = asList(action.payload);
    });
    builder.addCase(fetchFormSubmissions.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
  }
});

export const { clearError, clearTemplates } = formTemplateSlice.actions;
export default formTemplateSlice.reducer;
