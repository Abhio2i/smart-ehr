import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client, { extractErrorMessage } from '../../api/client';

const asList = (data) => Array.isArray(data) ? data : (data?.content || data?.data || []);

// ── User Operations ─────────────────────────────────────────────────
export const fetchUsers = createAsyncThunk('user/fetchUsers', async (
  { page = 0, size = 20, sortBy = 'createdAt', direction = 'DESC' } = {}, 
  { rejectWithValue }
) => {
  try { 
    return (await client.get(`/api/users?page=${page}&size=${size}&sortBy=${sortBy}&direction=${direction}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchUsersByOrganization = createAsyncThunk('user/fetchByOrg', async (
  { orgId, page = 0, size = 20 }, 
  { rejectWithValue }
) => {
  try { 
    return (await client.get(`/api/users/organization/${orgId}?page=${page}&size=${size}`, { hideToast: true })).data;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const searchSpecialists = createAsyncThunk('user/searchSpecialists', async (query = '', { rejectWithValue }) => {
  try {
    return (await client.get(`/api/users/specialists?query=${encodeURIComponent(query)}`, { hideToast: true })).data;
  } catch (e) {
    return rejectWithValue(extractErrorMessage(e));
  }
});

export const fetchUserById = createAsyncThunk('user/fetchById', async (userId, { rejectWithValue }) => {
  try { return (await client.get(`/api/users/${userId}`, { hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const fetchUserByEmail = createAsyncThunk('user/fetchByEmail', async (email, { rejectWithValue }) => {
  try { return (await client.get(`/api/users/email/${email}`, { hideToast: true })).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const createUser = createAsyncThunk('user/create', async (data, { rejectWithValue }) => {
  try { return (await client.post('/api/users', data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const updateUser = createAsyncThunk('user/update', async ({ id, data }, { rejectWithValue }) => {
  try { return (await client.put(`/api/users/${id}`, data)).data; }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

export const deleteUser = createAsyncThunk('user/delete', async (userId, { rejectWithValue }) => {
  try { 
    await client.delete(`/api/users/${userId}`);
    return userId;
  }
  catch (e) { return rejectWithValue(extractErrorMessage(e)); }
});

// ── Slice ────────────────────────────────────────────────────────────
const userSlice = createSlice({
  name: 'user',
  initialState: {
    users: [],
    selectedUser: null,
    total: 0,
    loading: false,
    error: null,
    currentPage: 0,
    pageSize: 20,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    clearUsers: (state) => { state.users = []; state.total = 0; },
  },
  extraReducers: (builder) => {
    // Fetch Users
    builder.addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.loading = false;
      const data = action.payload;
      state.users = Array.isArray(data) ? data : asList(data);
      state.total = data?.totalElements || data?.length || 0;
      state.currentPage = data?.number || 0;
      state.pageSize = data?.size || 20;
    });
    builder.addCase(fetchUsers.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch By Org
    builder.addCase(fetchUsersByOrganization.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchUsersByOrganization.fulfilled, (state, action) => {
      state.loading = false;
      const data = action.payload;
      state.users = Array.isArray(data) ? data : asList(data);
      state.total = data?.totalElements || data?.length || 0;
    });
    builder.addCase(fetchUsersByOrganization.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch By ID
    builder.addCase(fetchUserById.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchUserById.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedUser = action.payload;
    });
    builder.addCase(fetchUserById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Fetch By Email
    builder.addCase(fetchUserByEmail.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchUserByEmail.fulfilled, (state, action) => {
      state.loading = false;
      state.selectedUser = action.payload;
    });
    builder.addCase(fetchUserByEmail.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });

    // Create User
    builder.addCase(createUser.fulfilled, (state, action) => {
      state.users.push(action.payload);
      state.total += 1;
    });

    // Update User
    builder.addCase(updateUser.fulfilled, (state, action) => {
      const idx = state.users.findIndex(u => u.id === action.payload.id);
      if (idx >= 0) state.users[idx] = action.payload;
      if (state.selectedUser?.id === action.payload.id) state.selectedUser = action.payload;
    });

    // Delete User
    builder.addCase(deleteUser.fulfilled, (state, action) => {
      state.users = state.users.filter(u => u.id !== action.payload);
      state.total -= 1;
    });
  }
});

export const { clearError, clearUsers } = userSlice.actions;

export const selectUsers        = (state) => state.users.users;
export const selectSelectedUser = (state) => state.users.selectedUser;
export const selectUserLoading  = (state) => state.users.loading;
export const selectUserError    = (state) => state.users.error;
export const selectUserTotal    = (state) => state.users.total;

export default userSlice.reducer;
