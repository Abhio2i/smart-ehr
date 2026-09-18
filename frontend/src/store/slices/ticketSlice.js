import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || []);

export const fetchTickets = createAsyncThunk('tickets/fetchTickets', async (_, { rejectWithValue }) => {
  try {
    return (await client.get('/api/tickets', { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const createTicket = createAsyncThunk('tickets/createTicket', async (formData, { rejectWithValue }) => {
  try {
    return (await client.post('/api/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const updateTicketStatus = createAsyncThunk('tickets/updateStatus', async ({ id, status }, { rejectWithValue }) => {
  try {
    return (await client.put(`/api/tickets/${id}/status?status=${status}`)).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

const ticketSlice = createSlice({
  name: 'tickets',
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearTicketError: (state) => { state.error = null; }
  },
  extraReducers: (builder) => {
    const pending = (state) => { state.loading = true; state.error = null; };
    const rejected = (state, action) => { state.loading = false; state.error = action.payload; };

    builder
      .addCase(fetchTickets.pending, pending)
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.loading = false;
        state.list = asList(action.payload);
      })
      .addCase(fetchTickets.rejected, rejected)

      .addCase(createTicket.pending, pending)
      .addCase(createTicket.fulfilled, (state, action) => {
        state.loading = false;
        state.list.unshift(action.payload);
      })
      .addCase(createTicket.rejected, rejected)

      .addCase(updateTicketStatus.fulfilled, (state, action) => {
        const idx = state.list.findIndex(t => t.id === action.payload.id);
        if (idx !== -1) {
          state.list[idx] = action.payload;
        }
      });
  }
});

export const { clearTicketError } = ticketSlice.actions;

export const selectTickets = (state) => state.tickets.list;
export const selectTicketsLoading = (state) => state.tickets.loading;
export const selectTicketsError = (state) => state.tickets.error;

export default ticketSlice.reducer;
