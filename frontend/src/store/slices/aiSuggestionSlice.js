import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

// ── Async Thunks ────────────────────────────────────────────────────

/** POST /api/ai/suggestions/{recordId} — generate + store a new suggestion */
export const generateAiSuggestion = createAsyncThunk(
  'aiSuggestion/generate',
  async (recordId, { rejectWithValue }) => {
    try {
      return (await client.post(`/api/ai/suggestions/${recordId}`)).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

/** GET /api/ai/suggestions/{recordId} — fetch previous suggestions (newest first) */
export const fetchAiSuggestions = createAsyncThunk(
  'aiSuggestion/fetchAll',
  async (recordId, { rejectWithValue }) => {
    try {
      return (await client.get(`/api/ai/suggestions/${recordId}`, { hideToast: true })).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

/** POST /api/ai/suggestions/{recordId}/ask — ask a doctor Q&A question */
export const askAiQuestion = createAsyncThunk(
  'aiSuggestion/askQuestion',
  async ({ recordId, question }, { rejectWithValue }) => {
    try {
      return (await client.post(`/api/ai/suggestions/${recordId}/ask`, { question }, { hideToast: true })).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

/** GET /api/ai/suggestions/{recordId}/questions — fetch Q&A history */
export const fetchAiQuestions = createAsyncThunk(
  'aiSuggestion/fetchQuestions',
  async (recordId, { rejectWithValue }) => {
    try {
      return (await client.get(`/api/ai/suggestions/${recordId}/questions`, { hideToast: true })).data;
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────

const aiSuggestionSlice = createSlice({
  name: 'aiSuggestion',
  initialState: {
    /** suggestions keyed by recordId */
    byRecord: {},
    /** Q&A answers keyed by recordId */
    questionsByRecord: {},
    /** recordId currently being generated/fetched */
    loadingGenerate: false,
    loadingFetch: false,
    loadingAsk: false,
    loadingQuestions: false,
    error: null,
    questionError: null,
  },
  reducers: {
    clearAiError(state) { state.error = null; },
    clearQuestionError(state) { state.questionError = null; },
    clearSuggestionsForRecord(state, { payload: recordId }) {
      delete state.byRecord[recordId];
    },
  },
  extraReducers: (b) => {
    // Generate
    b.addCase(generateAiSuggestion.pending, (s) => { s.loadingGenerate = true; s.error = null; })
     .addCase(generateAiSuggestion.fulfilled, (s, { payload, meta }) => {
       s.loadingGenerate = false;
       const rid = payload?.recordId || meta.arg;
       if (rid) {
         const existing = s.byRecord[rid] || [];
         const isDuplicate = payload?.id && existing.some(x => x.id === payload.id);
         s.byRecord[rid] = isDuplicate ? existing : [payload, ...existing];
       }
     })
     .addCase(generateAiSuggestion.rejected, (s, a) => { s.loadingGenerate = false; s.error = a.payload; });

    // Fetch all suggestions
    b.addCase(fetchAiSuggestions.pending, (s) => { s.loadingFetch = true; s.error = null; })
     .addCase(fetchAiSuggestions.fulfilled, (s, { payload, meta }) => {
       s.loadingFetch = false;
       const rid = meta.arg;
       s.byRecord[rid] = Array.isArray(payload) ? payload : (payload?.content || []);
     })
     .addCase(fetchAiSuggestions.rejected, (s, a) => { s.loadingFetch = false; s.error = a.payload; });

    // Ask Q&A question
    b.addCase(askAiQuestion.pending, (s) => { s.loadingAsk = true; s.questionError = null; })
     .addCase(askAiQuestion.fulfilled, (s, { payload, meta }) => {
       s.loadingAsk = false;
       const rid = payload?.recordId || meta.arg?.recordId;
       if (rid) {
         const existing = s.questionsByRecord[rid] || [];
         const isDuplicate = payload?.id && existing.some(x => x.id === payload.id);
         s.questionsByRecord[rid] = isDuplicate ? existing : [payload, ...existing];
       }
     })
     .addCase(askAiQuestion.rejected, (s, a) => { s.loadingAsk = false; s.questionError = a.payload; });

    // Fetch Q&A history
    b.addCase(fetchAiQuestions.pending, (s) => { s.loadingQuestions = true; })
     .addCase(fetchAiQuestions.fulfilled, (s, { payload, meta }) => {
       s.loadingQuestions = false;
       const rid = meta.arg;
       s.questionsByRecord[rid] = Array.isArray(payload) ? payload : [];
     })
     .addCase(fetchAiQuestions.rejected, (s, a) => { s.loadingQuestions = false; });
  },
});

export const { clearAiError, clearQuestionError, clearSuggestionsForRecord } = aiSuggestionSlice.actions;

export const selectSuggestionsForRecord  = (recordId) => (state) => state.aiSuggestion.byRecord[recordId] || [];
export const selectQuestionsForRecord    = (recordId) => (state) => state.aiSuggestion.questionsByRecord[recordId] || [];
export const selectAiGenerating          = (state) => state.aiSuggestion.loadingGenerate;
export const selectAiFetching            = (state) => state.aiSuggestion.loadingFetch;
export const selectAiAsking              = (state) => state.aiSuggestion.loadingAsk;
export const selectAiError               = (state) => state.aiSuggestion.error;
export const selectAiQuestionError       = (state) => state.aiSuggestion.questionError;

export default aiSuggestionSlice.reducer;
