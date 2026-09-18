import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Organization Operations ─────────────────────────────────────────
export const fetchOrganizations = createAsyncThunk('org/fetch', async (params = {}, { rejectWithValue }) => {
  try {
    const { page, size, sortBy, direction, paginate = false } = params;
    let url = '/api/organizations';
    if (paginate) {
      const query = new URLSearchParams({
        page: page ?? 0,
        size: size ?? 20,
        sortBy: sortBy ?? 'createdAt',
        direction: direction ?? 'DESC'
      }).toString();
      url += `?${query}`;
    }
    return (await client.get(url, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchActiveOrganizations = createAsyncThunk('org/fetchActive', async (params = {}, { rejectWithValue }) => {
  try {
    const { page, size, paginate = false } = params;
    let url = '/api/organizations/active';
    if (paginate) {
      url += `?page=${page ?? 0}&size=${size ?? 20}`;
    }
    return (await client.get(url, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchOrganizationById = createAsyncThunk('org/fetchById', async (orgId, { rejectWithValue }) => {
  try { return (await client.get(`/api/organizations/${orgId}`, { hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchOrganizationByCode = createAsyncThunk('org/fetchByCode', async (code, { rejectWithValue }) => {
  try { return (await client.get(`/api/organizations/code/${code}`, { hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createOrganization = createAsyncThunk('org/create', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/organizations', data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const updateOrganization = createAsyncThunk('org/update', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/organizations/${id}`, data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const deleteOrganization = createAsyncThunk('org/delete', async (orgId, { rejectWithValue }) => {
  try {
    await client.delete(`/api/organizations/${orgId}`);
    return orgId;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── Slice ────────────────────────────────────────────────────────────
const orgSlice = createSlice({
  name: 'org',
  initialState: {
    organizations: [],
    selectedOrg: null,
    total: 0,
    loading: false,
    error: null,
    currentPage: 0,
    pageSize: 20,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearOrganizations: (state) => { state.organizations = []; state.total = 0; },
  },
  extraReducers: (builder) => {
    // Fetch Organizations
    builder.addCase(fetchOrganizations.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchOrganizations.fulfilled, (state, action) => {
      state.loading = false;
      const data = action.payload;
      state.organizations = Array.isArray(data) ? data : asList(data);
      state.total = data?.totalElements || data?.length || 0;
      state.currentPage = data?.number || 0;
      state.pageSize = data?.size || 20;
    });
    builder.addCase(fetchOrganizations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch Active Organizations
    builder.addCase(fetchActiveOrganizations.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchActiveOrganizations.fulfilled, (state, action) => {
      state.loading = false;
      const data = action.payload;
      state.organizations = Array.isArray(data) ? data : asList(data);
      state.total = data?.totalElements || data?.length || 0;
    });
    builder.addCase(fetchActiveOrganizations.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch By ID
    builder.addCase(fetchOrganizationById.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchOrganizationById.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedOrg = action.payload;
    });
    builder.addCase(fetchOrganizationById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch By Code
    builder.addCase(fetchOrganizationByCode.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchOrganizationByCode.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedOrg = action.payload;
    });
    builder.addCase(fetchOrganizationByCode.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create Organization
    builder.addCase(createOrganization.fulfilled, (state, action) => {
      state.organizations.push(action.payload);
      state.total += 1;
    });

    // Update Organization
    builder.addCase(updateOrganization.fulfilled, (state, action) => {
      const idx = state.organizations.findIndex(o => o.id === action.payload.id);
      if (idx >= 0) state.organizations[idx] = action.payload;
      if (state.selectedOrg?.id === action.payload.id) state.selectedOrg = action.payload;
    });

    // Delete Organization
    builder.addCase(deleteOrganization.fulfilled, (state, action) => {
      state.organizations = state.organizations.filter(o => o.id !== action.payload);
      state.total -= 1;
    });
  }
});

export const { clearError, clearOrganizations } = orgSlice.actions;
export default orgSlice.reducer;
