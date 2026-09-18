import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

// ── QA Forms ────────────────────────────────────────────────────────
export const fetchQaForms = createAsyncThunk('qa/fetchForms', async (orgId, { rejectWithValue }) => {
  try {
    if (orgId) {
      return (await client.get(`/api/qa/forms/organization/${orgId}`, { hideToast: true })).data;
    }

    const orgs = (await client.get('/api/organizations', { hideToast: true })).data || [];
    const forms = await Promise.all(
      orgs.map(org => client.get(`/api/qa/forms/organization/${org.id}`, { hideToast: true }).then(res => res.data || []).catch(() => []))
    );
    return forms.flat();
  } catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createQaForm = createAsyncThunk('qa/createForm', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/qa/forms', data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── QA Reviews ──────────────────────────────────────────────────────
export const fetchQaReviews = createAsyncThunk('qa/fetchReviews', async (payload = {}, { rejectWithValue }) => {
  try {
    const { page = 0, size = 20, filterStatus = 'all', reviewerId } = payload;
    const url = '/api/qa/reviews';
    const params = { page, size, filter: filterStatus };

    if (filterStatus === 'mine' && reviewerId) {
      params.reviewerId = reviewerId;
    }

    return (await client.get(url, { params, hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchPendingReviews = createAsyncThunk('qa/fetchPending', async (_, { rejectWithValue }) => {
  try { return (await client.get('/api/qa/reviews', { params: { filter: 'pending' }, hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchQaReviewStats = createAsyncThunk('qa/fetchStats', async (_, { rejectWithValue }) => {
  try { return (await client.get('/api/qa/reviews/stats', { hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createQaReview = createAsyncThunk('qa/createReview', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/qa/reviews', data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const completeQaReview = createAsyncThunk('qa/complete', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/qa/reviews/${id}/complete`, data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── Slice ───────────────────────────────────────────────────────────
const qaSlice = createSlice({
  name: 'qa',
  initialState: {
    forms: [], reviews: [], pendingReviews: [],
    formsLoading: false, reviewsLoading: false, error: null,
    pagination: { page: 0, totalPages: 0, totalElements: 0, isLast: true },
    stats: { total: 0, pending: 0, completed: 0 },
    statsLoading: false
  },
  reducers: { clearQaError(state) { state.error = null; } },
  extraReducers: (b) => {
    b.addCase(fetchQaForms.pending,    (s) => { s.formsLoading = true; })
     .addCase(fetchQaForms.fulfilled,  (s, a) => { s.formsLoading = false; s.forms = a.payload; })
     .addCase(fetchQaForms.rejected,   (s, a) => { s.formsLoading = false; s.error = a.payload; })

     .addCase(createQaForm.fulfilled,  (s, a) => { s.forms.unshift(a.payload); })

     .addCase(fetchQaReviews.pending,  (s) => { s.reviewsLoading = true; })
     .addCase(fetchQaReviews.fulfilled,(s, a) => {
       s.reviewsLoading = false;
       const raw = a.payload;
       s.reviews = asList(raw);
       if (raw && !Array.isArray(raw) && (raw.totalElements !== undefined || raw.page !== undefined || raw.content !== undefined)) {
         s.pagination = {
           page: raw.page ?? 0,
           totalPages: raw.totalPages ?? 1,
           totalElements: raw.totalElements ?? s.reviews.length,
           isLast: raw.last ?? true,
         };
       } else {
         s.pagination = {
           page: 0,
           totalPages: 1,
           totalElements: s.reviews.length,
           isLast: true,
         };
       }
     })
     .addCase(fetchQaReviews.rejected, (s, a) => { s.reviewsLoading = false; s.error = a.payload; })

     .addCase(fetchPendingReviews.fulfilled, (s, a) => { s.pendingReviews = asList(a.payload); })

     .addCase(fetchQaReviewStats.pending, (s) => { s.statsLoading = true; })
     .addCase(fetchQaReviewStats.fulfilled, (s, a) => {
       s.statsLoading = false;
       s.stats = a.payload || { total: 0, pending: 0, completed: 0 };
     })
     .addCase(fetchQaReviewStats.rejected, (s, a) => { s.statsLoading = false; })

     .addCase(createQaReview.fulfilled,(s, a) => { s.reviews.unshift(a.payload); })
     .addCase(completeQaReview.fulfilled, (s, a) => {
        const idx = s.reviews.findIndex(r => r.id === a.payload.id);
        if (idx !== -1) s.reviews[idx] = a.payload;
     });
  },
});

export const { clearQaError } = qaSlice.actions;
export const selectForms          = (s) => s.qa.forms;
export const selectReviews        = (s) => s.qa.reviews;
export const selectPendingReviews = (s) => Array.isArray(s.qa.pendingReviews) ? s.qa.pendingReviews : [];
export const selectFormsLoading   = (s) => s.qa.formsLoading;
export const selectReviewsLoading = (s) => s.qa.reviewsLoading;
export const selectQaPagination   = (s) => s.qa.pagination;
export const selectQaStats        = (s) => s.qa.stats;
export default qaSlice.reducer;
