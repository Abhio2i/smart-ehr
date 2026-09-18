import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';
import { getCachedRecords, getOfflineDrafts } from '../../utils/offlineEpcr';

const cachedRecords = getCachedRecords();
const offlineDrafts = Object.values(getOfflineDrafts());
const initialRecords = [...offlineDrafts, ...cachedRecords];

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── Async Thunks ────────────────────────────────────────────────────
export const fetchRecords = createAsyncThunk('epcr/fetchAll', async (payload = {}, { rejectWithValue }) => {
  try {
    const { page = 0, size = 20, status, incidentType, search, startDate, endDate, paramedicId, ...rest } = payload;
    // Build params — omit empty/undefined values so the backend skips those filters
    const params = { page, size };
    if (paramedicId)  params.paramedicId  = paramedicId;
    if (status)       params.status       = status;
    if (incidentType) params.incidentType = incidentType;
    if (search)       params.search       = search;
    if (startDate)    params.startDate    = startDate;
    if (endDate)      params.endDate      = endDate;
    const res = await client.get('/api/epcr/records', { params, hideToast: true });
    return { data: res.data, isAppend: payload.isAppend };
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createRecord = createAsyncThunk('epcr/create', async (payload, { rejectWithValue }) => {
  try {
    const isObjectPayload = payload && typeof payload === 'object' && 'data' in payload && 'idempotencyKey' in payload;
    const body = isObjectPayload ? payload.data : payload;
    const config = {};
    if (isObjectPayload && payload.idempotencyKey) {
      config.headers = {
        'Idempotency-Key': `epcr-create-${payload.idempotencyKey}`
      };
    }
    return (await client.post('/api/epcr/records', body, config)).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const updateRecord = createAsyncThunk('epcr/update', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/epcr/records/${id}`, data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const submitRecord = createAsyncThunk('epcr/submit', async (id, { rejectWithValue }) => {
  try { return (await client.post(`/api/epcr/records/${id}/submit`)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const deleteRecord = createAsyncThunk('epcr/delete', async (id, { rejectWithValue }) => {
  try { await client.delete(`/api/epcr/records/${id}`); return id; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchIncidentTypes = createAsyncThunk('epcr/fetchIncidentTypes', async (_, { rejectWithValue }) => {
  try {
    const res = await client.get('/api/epcr/incident-types', { hideToast: true });
    return res.data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── Slice ───────────────────────────────────────────────────────────
const epcrSlice = createSlice({
  name: 'epcr',
  initialState: {
    records: initialRecords,
    loading: false,
    error: null,
    selected: null,
    pagination: { page: 0, totalPages: 0, totalElements: 0, isLast: true },
    incidentTypes: [],
  },
  reducers: {
    clearError(state) { state.error = null; },
    setSelected(state, { payload }) { state.selected = payload; },
  },
  extraReducers: (b) => {
    const pending   = (s) => { s.loading = true;  s.error = null; };
    const rejected  = (s, a) => { s.loading = false; s.error = a.payload; };

    b.addCase(fetchRecords.pending,   pending)
     .addCase(fetchRecords.fulfilled, (s, a) => {
       s.loading = false;
       const raw = a.payload.data;
       const newList = Array.isArray(raw) ? raw : (raw?.content || []);
       const currentOfflineDrafts = Object.values(getOfflineDrafts());
       if (a.payload.isAppend) s.records = [...s.records, ...newList];
       else s.records = [...currentOfflineDrafts, ...newList];
       // Store pagination metadata when the response is paginated
       if (raw && !Array.isArray(raw) && (raw.totalElements !== undefined || raw.page !== undefined || raw.content !== undefined)) {
         const rawTotalPages = raw.totalPages;
         const rawTotalElements = raw.totalElements;

         s.pagination = {
           page: raw.page ?? s.pagination?.page ?? 0,
           // BACKEND COMPATIBILITY: Keep previous positive totalPages/totalElements if backend returns -1 or omits them on pages > 0
           totalPages: (rawTotalPages === -1 || rawTotalPages === undefined)
             ? (s.pagination?.totalPages || 1)
             : rawTotalPages,
           totalElements: (rawTotalElements === -1 || rawTotalElements === undefined)
             ? (s.pagination?.totalElements || newList.length)
             : rawTotalElements,
           isLast: raw.last ?? true,
         };
       }
     })
     .addCase(fetchRecords.rejected,  rejected)

     .addCase(createRecord.pending,   pending)
     .addCase(createRecord.fulfilled, (s, a) => { s.loading = false; s.records.unshift(a.payload); })
     .addCase(createRecord.rejected,  rejected)

     .addCase(updateRecord.pending,   pending)
     .addCase(updateRecord.fulfilled, (s, a) => {
       s.loading = false;
       const idx = s.records.findIndex(r => r.id === a.payload.id);
       if (idx !== -1) s.records[idx] = a.payload;
     })
     .addCase(updateRecord.rejected,  rejected)

     .addCase(submitRecord.fulfilled, (s, a) => {
       const idx = s.records.findIndex(r => r.id === a.payload.id);
       if (idx !== -1) s.records[idx] = a.payload;
     })

     .addCase(deleteRecord.fulfilled, (s, a) => {
       s.records = s.records.filter(r => r.id !== a.payload);
     })
     .addCase(fetchIncidentTypes.fulfilled, (s, a) => {
       s.incidentTypes = Array.isArray(a.payload) ? a.payload : (a.payload?.content || []);
     });
  },
});

export const { clearError, setSelected } = epcrSlice.actions;
export const selectRecords        = (s) => s.epcr.records;
export const selectEpcrLoading    = (s) => s.epcr.loading;
export const selectEpcrError      = (s) => s.epcr.error;
export const selectEpcrPagination = (s) => s.epcr.pagination;
export const selectIncidentTypes   = (s) => s.epcr.incidentTypes;
export default epcrSlice.reducer;
