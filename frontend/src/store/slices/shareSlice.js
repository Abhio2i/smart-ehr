import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import shareService from '../../api/services/shareService';
import { extractErrorMessage } from '../../api/client';

export const createShare = createAsyncThunk(
  'shares/createShare',
  async ({ recordId, shareData }, { rejectWithValue }) => {
    try {
      return await shareService.createShare(recordId, shareData);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const fetchSharesForRecord = createAsyncThunk(
  'shares/fetchSharesForRecord',
  async (recordId, { rejectWithValue }) => {
    try {
      return await shareService.getSharesForRecord(recordId);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const fetchSharesInbox = createAsyncThunk(
  'shares/fetchSharesInbox',
  async ({ page = 0, size = 20 } = {}, { rejectWithValue }) => {
    try {
      return await shareService.getSharesInbox(page, size);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const fetchShareById = createAsyncThunk(
  'shares/fetchShareById',
  async (shareId, { rejectWithValue }) => {
    try {
      return await shareService.getShareById(shareId);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const revokeShare = createAsyncThunk(
  'shares/revokeShare',
  async (shareId, { rejectWithValue }) => {
    try {
      return await shareService.revokeShare(shareId);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const respondToShare = createAsyncThunk(
  'shares/respondToShare',
  async ({ shareId, responseNotes }, { rejectWithValue }) => {
    try {
      return await shareService.addResponse(shareId, responseNotes);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const verifyExternalToken = createAsyncThunk(
  'shares/verifyExternalToken',
  async ({ shareId, token }, { rejectWithValue }) => {
    try {
      return await shareService.verifyExternalToken(shareId, token);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const fetchExternalShareBundle = createAsyncThunk(
  'shares/fetchExternalShareBundle',
  async ({ shareId, accessToken }, { rejectWithValue }) => {
    try {
      return await shareService.getExternalShareBundle(shareId, accessToken);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

export const submitExternalResponse = createAsyncThunk(
  'shares/submitExternalResponse',
  async ({ shareId, responseNotes, accessToken }, { rejectWithValue }) => {
    try {
      return await shareService.addExternalResponse(shareId, responseNotes, accessToken);
    } catch (e) {
      return rejectWithValue(extractErrorMessage(e));
    }
  }
);

const initialState = {
  sharesByRecord: [],
  inbox: {
    content: [],
    totalPages: 0,
    totalElements: 0,
    page: 0,
    size: 20
  },
  activeShare: null,
  externalAuthToken: null,
  externalShareData: null,
  loading: false,
  error: null,
  successMessage: null,
  latestCreatedShare: null
};

const shareSlice = createSlice({
  name: 'shares',
  initialState,
  reducers: {
    clearShareError: (state) => { state.error = null; },
    clearSuccessMessage: (state) => { state.successMessage = null; },
    clearActiveShare: (state) => { state.activeShare = null; },
    clearLatestCreatedShare: (state) => { state.latestCreatedShare = null; },
    clearExternalShare: (state) => {
      state.externalAuthToken = null;
      state.externalShareData = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // createShare
      .addCase(createShare.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(createShare.fulfilled, (state, action) => {
        state.loading = false;
        state.latestCreatedShare = action.payload;
        state.sharesByRecord.unshift(action.payload);
        state.successMessage = 'Record shared successfully!';
      })
      .addCase(createShare.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchSharesForRecord
      .addCase(fetchSharesForRecord.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSharesForRecord.fulfilled, (state, action) => {
        state.loading = false;
        state.sharesByRecord = action.payload || [];
      })
      .addCase(fetchSharesForRecord.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchSharesInbox
      .addCase(fetchSharesInbox.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchSharesInbox.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.content) {
          state.inbox = action.payload;
        } else if (Array.isArray(action.payload)) {
          state.inbox.content = action.payload;
        }
      })
      .addCase(fetchSharesInbox.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchShareById
      .addCase(fetchShareById.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchShareById.fulfilled, (state, action) => {
        state.loading = false;
        state.activeShare = action.payload;
      })
      .addCase(fetchShareById.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // revokeShare
      .addCase(revokeShare.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.sharesByRecord.findIndex(s => s.id === updated.id);
        if (idx >= 0) state.sharesByRecord[idx] = updated;
        const inboxIdx = state.inbox.content.findIndex(s => s.id === updated.id);
        if (inboxIdx >= 0) state.inbox.content[inboxIdx] = updated;
        if (state.activeShare?.id === updated.id) state.activeShare = updated;
        state.successMessage = 'Share revoked successfully.';
      })

      // respondToShare
      .addCase(respondToShare.fulfilled, (state, action) => {
        const updated = action.payload;
        const idx = state.sharesByRecord.findIndex(s => s.id === updated.id);
        if (idx >= 0) state.sharesByRecord[idx] = updated;
        const inboxIdx = state.inbox.content.findIndex(s => s.id === updated.id);
        if (inboxIdx >= 0) state.inbox.content[inboxIdx] = updated;
        if (state.activeShare?.id === updated.id) state.activeShare = updated;
        state.successMessage = 'Response submitted successfully.';
      })

      // verifyExternalToken
      .addCase(verifyExternalToken.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(verifyExternalToken.fulfilled, (state, action) => {
        state.loading = false;
        state.externalAuthToken = action.payload?.accessToken;
      })
      .addCase(verifyExternalToken.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // fetchExternalShareBundle
      .addCase(fetchExternalShareBundle.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchExternalShareBundle.fulfilled, (state, action) => {
        state.loading = false;
        state.externalShareData = action.payload;
      })
      .addCase(fetchExternalShareBundle.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      // submitExternalResponse
      .addCase(submitExternalResponse.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(submitExternalResponse.fulfilled, (state, action) => {
        state.loading = false;
        state.externalShareData = action.payload;
        state.successMessage = 'Specialist consultation response submitted successfully!';
      })
      .addCase(submitExternalResponse.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  }
});

export const { clearShareError, clearSuccessMessage, clearActiveShare, clearLatestCreatedShare, clearExternalShare } = shareSlice.actions;

export const selectSharesByRecord = (state) => state.shares.sharesByRecord;
export const selectSharesInbox = (state) => state.shares.inbox;
export const selectActiveShare = (state) => state.shares.activeShare;
export const selectExternalAuthToken = (state) => state.shares.externalAuthToken;
export const selectExternalShareData = (state) => state.shares.externalShareData;
export const selectShareLoading = (state) => state.shares.loading;
export const selectShareError = (state) => state.shares.error;
export const selectShareSuccessMessage = (state) => state.shares.successMessage;
export const selectLatestCreatedShare = (state) => state.shares.latestCreatedShare;

export default shareSlice.reducer;
