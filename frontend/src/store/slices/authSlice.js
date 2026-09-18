import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import client from '../../api/client';
import { resetPortalState } from './patientPortalSlice';
import { clearHistory } from './patientHistorySlice';

export const checkAuth = createAsyncThunk('auth/checkAuth', async (_, { getState, rejectWithValue }) => {
  const currentRole = getState().auth.user?.role;
  const endpoints = currentRole === 'PATIENT'
    ? [{ url: '/api/patient/auth/me', role: 'PATIENT' }]
    : currentRole
      ? [{ url: '/api/auth/me', role: 'STAFF' }]
      : [
          { url: '/api/auth/me', role: 'STAFF' },
          { url: '/api/patient/auth/me', role: 'PATIENT' },
        ];

  for (const { url, role } of endpoints) {
    try {
      const res = await client.get(url, { hideToast: true });
      
      if (role === 'PATIENT') {
        return { ...res.data, role: 'PATIENT', isPatientLogin: true };
      }
      return res.data;
    } catch (error) {
      if (error.response?.status === 429) {
        return rejectWithValue('Too many authentication checks. Please wait a moment and try again.');
      }
      // ── Network error (no response) = device is offline ──────────────
      if (!error.response) {
        const existingUser = getState().auth.user;
        if (existingUser) {
          // Device is offline but user was already authenticated —
          // preserve their session and mark it as an offline session.
          return { ...existingUser, isOfflineSession: true };
        }
        // No cached user, nothing to preserve.
        return rejectWithValue('network_offline');
      }
      // ─────────────────────────────────────────────────────────────────
      // Silently catch 400/401 and try the next endpoint in the array
      continue;
    }
  }

  // If both endpoints fail, the user is genuinely logged out
  return rejectWithValue(null);
}, {
  condition: (_, { getState }) => !getState().auth.isChecking,
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    await Promise.allSettled([
      client.post('/api/auth/logout', {}, { hideToast: true }),
      client.post('/api/patient/auth/logout', {}, { hideToast: true }),
    ]);
  } catch (e) {
    // The backend might return 403 due to strict CSRF rules on the POST request.
    // We swallow the error here because the 'finally' block ensures the frontend 
    // clears the session and redirects to login regardless.
  } finally {
    // Clear all patient portal and history data from Redux so the next
    // user session never sees cached data from the previous session.
    dispatch(resetPortalState());
    dispatch(clearHistory());
    dispatch(logout());

    // Hard redirect to /epcr/login to flush in-memory React/Redux state completely
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/epcr/login';
    }
  }
});


// ── Persistence helpers (DISABLED for prod-ready security) ──────────────────────────
const AUTH_SESSION_KEY = 'medepcr.auth.session';

const loadUser = () => {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveUser = (user) => {
  try {
    if (user) {
      // Strip all token fields (including legacy/patient token) to prevent security leaks in browser sessionStorage
      const { accessToken, refreshToken, token, ...safeUser } = user;
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(safeUser));
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch {
    // Ignore storage failures; in-memory auth still works for the current page.
  }
};
// ────────────────────────────────────────────────────────────────────

const initialUser = loadUser();

const initialState = {
  user: initialUser,
  isAuthenticated: !!initialUser,
  isInitializing: true,
  isChecking: false,
  // true when the user is logged in via cached vault credentials (no live server)
  isOfflineSession: initialUser?.isOfflineSession || false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action) {
      const user = action.payload?.user;
      if (user) {
        state.user = {
          ...user,
          id: user.id || user.userId || user.patientId,
          userId: user.userId || user.id || user.patientId,
        };
        state.isOfflineSession = user.isOfflineSession || false;
      } else {
        state.user = null;
        state.isOfflineSession = false;
      }
      state.isAuthenticated = !!state.user;
      saveUser(state.user);
    },
    logout(state) {
      state.user             = null;
      state.isAuthenticated  = false;
      state.isChecking       = false;
      state.isOfflineSession = false;

      // Complete Cache & Storage Cleanup on Logout
      try {
        sessionStorage.clear();
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key && (
              key.startsWith('medepcr') ||
              key.startsWith('dental_chart') ||
              key.startsWith('persistent_dental') ||
              key.includes('patient') ||
              key.includes('history') ||
              key.includes('cache') ||
              key.includes('auth') ||
              key.includes('token')
            )
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {
        // Fail-safe for storage access restrictions
      }

      // Clear all PWA CacheStorage & Service Worker caches
      try {
        if (typeof window !== 'undefined' && 'caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      } catch {
        // Fail-safe for storage access restrictions
      }

      saveUser(null);

      // Clear offline IndexedDB database
      import('../../utils/offlineEpcr').then(({ clearOfflineCache }) => clearOfflineCache()).catch(() => {});
    },
    // Called when the device comes back online to clear the offline flag
    setOfflineSession(state, action) {
      state.isOfflineSession = action.payload;
      if (state.user) {
        state.user = { ...state.user, isOfflineSession: action.payload };
        saveUser(state.user);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isInitializing = true;
        state.isChecking = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        const data = action.payload;
        if (data) {
          if (data.isOfflineSession) {
            // Network was unavailable during checkAuth — preserve the existing
            // session as-is and just flag it as offline. Do NOT overwrite user
            // fields with stale vault data.
            state.isOfflineSession = true;
            if (state.user) {
              state.user = { ...state.user, isOfflineSession: true };
              saveUser(state.user);
            }
          } else {
            // Normal online checkAuth — refresh user from server response
            state.user = {
              ...state.user,  // preserve tokens from login in memory
              userId: data.userId || data.patientId,
              id: data.userId || data.patientId,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email || data.identifier,
              organizationId: data.organizationId,
              role: data.role,
              patientId: data.patientId,
              accessToken: data.accessToken || data.token || state.user?.accessToken,
              refreshToken: data.refreshToken || state.user?.refreshToken,
              isOfflineSession: false,
            };
            state.isOfflineSession = false;
            saveUser(state.user);
          }
        } else {
          state.user = null;
          state.isOfflineSession = false;
        }
        state.isAuthenticated = !!data;
        state.isInitializing = false;
        state.isChecking = false;
      })
      .addCase(checkAuth.rejected, (state, action) => {
        // Pure network error with no cached user — don't wipe state, just stop initializing
        if (action.payload === 'network_offline') {
          state.isInitializing = false;
          state.isChecking = false;
          return;
        }
        // Server explicitly rejected authentication (401) — clear stored data
        state.user             = null;
        state.isAuthenticated  = false;
        state.isInitializing   = false;
        state.isChecking       = false;
        state.isOfflineSession = false;
        saveUser(null);
      });
  },
});

export const { loginSuccess, logout, setOfflineSession } = authSlice.actions;
export const selectAuth              = (s) => s.auth;
export const selectUser              = (s) => s.auth.user;
export const selectRole              = (s) => s.auth.user?.role;
export const selectIsAuthenticated   = (s) => s.auth.isAuthenticated;
export const selectIsInitializing    = (s) => s.auth.isInitializing;
export const selectIsOfflineSession  = (s) => s.auth.isOfflineSession || false;

export default authSlice.reducer;
