import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────

export const fetchBaas = createAsyncThunk('baa/fetchAll', async (orgId, { rejectWithValue }) => {
  try {
    const url = orgId ? `/api/baas/vendors?organizationId=${orgId}` : '/api/baas/vendors';
    return (await client.get(url, { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const createBaa = createAsyncThunk('baa/create', async (payload, { rejectWithValue }) => {
  try {
    return (await client.post('/api/baas/vendors', payload)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const suspendVendor = createAsyncThunk('baa/suspend', async (id, { rejectWithValue }) => {
  try {
    await client.post(`/api/baas/vendors/${id}/suspend`);
    return id;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const activateVendor = createAsyncThunk('baa/activate', async (id, { rejectWithValue }) => {
  try {
    await client.post(`/api/baas/vendors/${id}/activate`);
    return id;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const fetchBaaDetails = createAsyncThunk('baa/fetchDetails', async (id, { rejectWithValue }) => {
  try {
    return (await client.get(`/api/baas/vendors/${id}`)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

// ── Slice ───────────────────────────────────────────────────────────

const baaSlice = createSlice({
  name: 'baa',
  initialState: {
    items: [],
    selected: null,
    loading: false,
    error: null
  },
  reducers: {
    clearBaaError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchBaas.pending, pending)
      .addCase(fetchBaas.fulfilled, (state, action) => {
        state.loading = false;
        state.items = asList(action.payload);
      })
      .addCase(fetchBaas.rejected, rejected)

      .addCase(createBaa.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
      })

      .addCase(suspendVendor.fulfilled, (state, action) => {
        const item = state.items.find(i => i.id === action.payload);
        if (item) item.baaStatus = 'TERMINATED';
      })

      .addCase(activateVendor.fulfilled, (state, action) => {
        const item = state.items.find(i => i.id === action.payload);
        if (item) item.baaStatus = 'ACTIVE';
      })

      .addCase(fetchBaaDetails.fulfilled, (state, action) => {
        state.selected = action.payload;
      });
  }
});

export const { clearBaaError } = baaSlice.actions;

export const selectBaas = (state) => state.baa.items;
export const selectBaaLoading = (state) => state.baa.loading;
export const selectSelectedBaa = (state) => state.baa.selected;

export default baaSlice.reducer;
