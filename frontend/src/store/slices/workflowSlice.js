import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client from '../../api/client';

export const fetchWorkflows = createAsyncThunk('workflows/fetchAll', async (orgId, { rejectWithValue }) => {
  try {
    const url = orgId ? `/api/workflows/organization/${orgId}` : '/api/workflows';
    return (await client.get(url, { hideToast: true })).data;
  } catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const createWorkflow = createAsyncThunk('workflows/create', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/workflows', data)).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const updateWorkflow = createAsyncThunk('workflows/update', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/workflows/${id}`, data)).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const deleteWorkflow = createAsyncThunk('workflows/delete', async (id, { rejectWithValue }) => {
  try { await client.delete(`/api/workflows/${id}`); return id; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const fetchDeployments = createAsyncThunk('workflows/fetchDeployments', async (_, { rejectWithValue }) => {
  try { return (await client.get('/api/workflows/deployments', { hideToast: true })).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

export const createDeployment = createAsyncThunk('workflows/deploy', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/workflows/deployments', data)).data; }
  catch (e) { return rejectWithValue(e.response?.data?.message || 'Failed'); }
});

const workflowSlice = createSlice({
  name: 'workflows',
  initialState: { items: [], deployments: [], loading: false, error: null },
  reducers: { clearWorkflowError(s) { s.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchWorkflows.pending,   (s) => { s.loading = true; s.error = null; })
     .addCase(fetchWorkflows.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
     .addCase(fetchWorkflows.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })
     .addCase(createWorkflow.fulfilled, (s, a) => { s.items.unshift(a.payload); })
     .addCase(updateWorkflow.fulfilled, (s, a) => {
       const i = s.items.findIndex(w => w.id === a.payload.id);
       if (i !== -1) s.items[i] = a.payload;
     })
     .addCase(deleteWorkflow.fulfilled, (s, a) => { s.items = s.items.filter(w => w.id !== a.payload); })
     .addCase(fetchDeployments.fulfilled, (s, a) => { s.deployments = a.payload; })
     .addCase(createDeployment.fulfilled, (s, a) => { s.deployments.unshift(a.payload); });
  },
});

export const { clearWorkflowError } = workflowSlice.actions;
export const selectWorkflows    = (s) => s.workflows.items;
export const selectDeployments  = (s) => s.workflows.deployments;
export const selectWorkflowLoading = (s) => s.workflows.loading;
export default workflowSlice.reducer;
