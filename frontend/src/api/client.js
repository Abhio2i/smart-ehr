import axios from 'axios';
import { loginSuccess, logout } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';

// Store reference — set via injectStore() called from main.jsx
let _store;
export const injectStore = (store) => { _store = store; };

const isDev = import.meta.env.DEV;
const client = axios.create({
  baseURL: isDev ? '' : (import.meta.env.VITE_API_BASE_URL || 'https://api.ihp.ind.in'),
  timeout: 20000,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// AI suggestion / Q&A endpoints can take 30-90 s (Gemini + attachments)
// Override timeout for those paths only.
client.interceptors.request.use((config) => {
  if (config.url && (config.url.includes('/api/ai/suggestions') || config.url.includes('/api/ai/voice'))) {
    config.timeout = 120000; // 2 minutes
  }
  return config;
});

// Request interceptor: Intercept GET, POST, and PUT to /api/epcr/records when offline
client.interceptors.request.use(async (config) => {
  const isEpcrRoute = config.url && config.url.includes('/api/epcr/records');
  if (isEpcrRoute && !navigator.onLine) {
    const { getCachedRecords, getOfflineDrafts, saveOfflineDraft, enqueueSyncAction, getOfflineSyncQueue, saveOfflineSyncQueue, getOfflineDetailsCache } = await import('../utils/offlineEpcr');
    
    config.adapter = async (cfg) => {
      const urlWithoutQuery = cfg.url.split('?')[0];
      const parts = urlWithoutQuery.split('/');
      const lastPart = parts[parts.length - 1]; // Can be 'records', 'submit', or '{id}'
      
      // GET request
      if (cfg.method?.toLowerCase() === 'get') {
        const isList = lastPart === 'records' || parts.includes('organization') || parts.includes('paramedic');
        

        
        if (isList) {
          const cached = getCachedRecords();
          const drafts = Object.values(getOfflineDrafts());
          const all = [...drafts, ...cached];
          

          
          if (lastPart === 'records') {
            const params = cfg.params || {};
            const page = parseInt(params.page || 0, 10);
            const size = parseInt(params.size || 20, 10);
            const start = page * size;
            const sliceEnd = start + size;
            const content = all.slice(start, sliceEnd);
            

            
            return {
              data: {
                content: content,
                totalPages: Math.ceil(all.length / size) || 1,
                totalElements: all.length,
                page: page,
                size: size,
                last: sliceEnd >= all.length
              },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: cfg
            };
          } else {
            return {
              data: all,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: cfg
            };
          }
        } else {
          // Single record details fetch
          const drafts = getOfflineDrafts();
          const cached = getCachedRecords();
          const detailsCache = getOfflineDetailsCache();
          
          const lookupId = lastPart.toLowerCase();
          const found = drafts[lookupId] || detailsCache[lookupId] || cached.find(r => r.id?.toLowerCase() === lookupId);
          

          
          if (found) {
            return {
              data: found,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: cfg
            };
          } else {

            return {
              data: { message: 'Record details not found offline' },
              status: 404,
              statusText: 'Not Found',
              headers: {},
              config: cfg
            };
          }
        }
      }
      
      // POST request (create)
      if (cfg.method?.toLowerCase() === 'post') {
        const payload = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
        const tempId = 'temp-' + (self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).slice(2));
        const localDraft = {
          ...payload,
          id: tempId,
          incidentNumber: `DRAFT-${tempId.substring(5, 13).toUpperCase()}`,
          status: 'DRAFT_OFFLINE',
          isOfflineDraft: true
        };
        saveOfflineDraft(tempId, localDraft);
        enqueueSyncAction({ type: 'CREATE', tempId, data: payload });
        return {
          data: localDraft,
          status: 201,
          statusText: 'Created',
          headers: {},
          config: cfg
        };
      }
      
      // PUT request (update)
      if (cfg.method?.toLowerCase() === 'put') {
        const payload = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
        
        if (lastPart.startsWith('temp-')) {
          saveOfflineDraft(lastPart, payload);
          const queue = getOfflineSyncQueue();
          const idx = queue.findIndex(item => item.tempId === lastPart);
          if (idx !== -1) {
            queue[idx].data = payload;
            saveOfflineSyncQueue(queue);
          }
        } else {
          enqueueSyncAction({ type: 'UPDATE', recordId: lastPart, data: payload });
        }
        
        return {
          data: { ...payload, id: lastPart },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg
        };
      }
    };
  }
  return config;
});

// Request interceptor for CSRF and other outgoing logic
client.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    // Add Bearer token only for internal API requests (to avoid sending it to Supabase/S3)
    const token = _store?.getState()?.auth?.user?.accessToken;
    const isInternal = config.url.startsWith('/') || config.url.startsWith(import.meta.env.VITE_API_BASE_URL);
    if (token && isInternal && token !== "undefined" && token !== "null") {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ensure X-XSRF-TOKEN is set for non-GET requests if the cookie exists
    if (config.method && ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())) {
      const names = ['XSRF-TOKEN', 'CSRF-TOKEN', '_csrf'];
      let token = null;
      for (const name of names) {
        const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
        if (match) {
          token = decodeURIComponent(match[2]);
          break;
        }
      }
      if (token) {
        config.headers['X-XSRF-TOKEN'] = token;
        config.headers['X-CSRF-TOKEN'] = token;
      }
      // Often required by Spring Security to distinguish AJAX requests
      config.headers['X-Requested-With'] = 'XMLHttpRequest';

      // Ensure Content-Type is set for state-changing requests
      if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Extract a human-readable error message from various Spring Boot error formats:
 *  - { message: "..." }
 *  - { error: "..." }
 *  - { errors: [ { defaultMessage: "..." }, ... ] }
 *  - { errors: { field: "msg", ... } }
 *  - { fieldErrors: { field: "msg" } }
 *  - plain string body
 */
export const extractErrorMessage = (err) => {
  const data = err.response?.data;

  if (!data) return err.message || 'An error occurred';

  if (typeof data === 'string') return data;

  // Prioritize specific field errors/sub-errors over a generic "Validation failed" message

  // 1. Array of errors (Spring standard)
  if (Array.isArray(data.errors)) {
    return data.errors.map(e => e.defaultMessage || e.message || e.field).join(', ');
  }

  // 2. Map of field -> error (in 'errors', 'fieldErrors', or 'data' property)
  const fieldErrors = data.errors || data.fieldErrors || (data.message === 'Validation failed' ? data.data : null);
  if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
    const messages = Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`);
    if (messages.length > 0) return messages.join(', ');
  }

  // 3. Fallback to message or error property
  if (data.message && data.message !== 'Validation failed') return data.message;
  if (data.error && typeof data.error === 'string' && data.error !== 'Bad Request') return data.error;

  // 4. Handle generic 400 with potential raw data
  if (err.response?.status === 400) {
    if (data && typeof data === 'object' && Object.keys(data).length > 0 && !data.message && !data.error) {
       const details = Object.entries(data)
         .filter(([k]) => k !== 'timestamp' && k !== 'status' && k !== 'path')
         .map(([k, v]) => `${k}: ${v}`).join(', ');
       if (details) return `Validation failed: ${details}`;
    }
    return 'Invalid request parameters or malformed data.';
  }

  return data.message || data.error || 'Validation failed. Please check your input.';
};

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = () => {
  refreshSubscribers.map((cb) => cb());
  refreshSubscribers = [];
};

// ── Response: centralised error handling ────────────────────────────
client.interceptors.response.use(
  (res) => {
    // If online and GET /api/epcr/records is successful, cache it and prepend local drafts
    if (res.config.url && res.config.url.includes('/api/epcr/records') && res.config.method?.toLowerCase() === 'get') {
      const cleanUrl = res.config.url.split('?')[0];
      const parts = cleanUrl.split('/');
      const lastPart = parts[parts.length - 1];
      
      const isList = lastPart === 'records' || parts.includes('organization') || parts.includes('paramedic');
      
      // Cache list fetches
      if (isList) {
        const records = Array.isArray(res.data) ? res.data : (res.data?.content || []);
        
        return import('../utils/offlineEpcr').then(({ saveCachedRecords, getCachedRecords, getOfflineDrafts }) => {
          const params = res.config.params || {};
          const page = parseInt(params.page || 0, 10);
          
          let merged = records;
          if (page > 0) {
            const existing = getCachedRecords();
            const recordMap = {};
            existing.forEach(r => { if (r.id) recordMap[r.id] = r; });
            records.forEach(r => {
              if (r.id) {
                if (recordMap[r.id]) {
                  const existingRec = recordMap[r.id];
                  const mergedRec = { ...existingRec };
                  Object.keys(r).forEach(key => {
                    if (r[key] !== null && r[key] !== undefined) {
                      mergedRec[key] = r[key];
                    }
                  });
                  recordMap[r.id] = mergedRec;
                } else {
                  recordMap[r.id] = r;
                }
              }
            });
            merged = Object.values(recordMap);
          }
          
          saveCachedRecords(merged.slice(0, 1000));
          
          const drafts = Object.values(getOfflineDrafts());
          if (drafts.length > 0) {
            if (Array.isArray(res.data)) {
              res.data = [...drafts, ...res.data];
            } else if (res.data && res.data.content) {
              res.data.content = [...drafts, ...res.data.content];
            }
          }
          return res;
        }).catch(() => res);
      } else if (lastPart !== 'submit') {
        // Single record details fetch online - cache full details in details cache
        return import('../utils/offlineEpcr').then(({ saveOfflineDetailRecord }) => {
          if (res.data && res.data.id) {
            saveOfflineDetailRecord(res.data.id, res.data);
          }
          return res;
        }).catch(() => res);
      }
    }
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const message = extractErrorMessage(err);
    const originalRequest = err.config;

    // skip refresh on these specific endpoints to avoid infinite loops
    const isAuthRequest = originalRequest.url.includes('/api/auth/login') ||
      originalRequest.url.includes('/api/auth/refresh') ||
      originalRequest.url.includes('/api/auth/logout') ||
      originalRequest.url.includes('/api/patient/auth/');

    // Only skip refresh for /api/auth/me if we don't have an access token yet
    const hasToken = !!_store?.getState()?.auth?.user?.accessToken;
    const isInitialSessionCheck = originalRequest.url.includes('/api/auth/me') && !hasToken;

    if (status === 401 && !originalRequest._retry && !isAuthRequest && !isInitialSessionCheck) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(() => {
            originalRequest._retry = true;
            resolve(client(originalRequest));
          });
        });
      }

      const isLoginPage = window.location.pathname === '/epcr/login' || window.location.pathname === '/login';

      if (isLoginPage) {
        return Promise.reject(err);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        client.post('/api/auth/refresh', {}, { hideToast: true })
          .then((refreshRes) => {
            const data = refreshRes.data || {};
            const accessToken = data.accessToken || data.token;
            const refreshToken = data.refreshToken;
            const currentUser = _store?.getState()?.auth?.user || {};
            if (accessToken) {
              _store?.dispatch(loginSuccess({
                user: {
                  ...currentUser,
                  ...data,
                  id: data.userId || currentUser.id || currentUser.userId,
                  userId: data.userId || currentUser.userId || currentUser.id,
                  role: data.role || currentUser.role,
                  organizationId: data.organizationId || currentUser.organizationId,
                  accessToken,
                  refreshToken: refreshToken || currentUser.refreshToken,
                },
              }));
            }
            isRefreshing = false;
            onRefreshed();
            resolve(client(originalRequest));
          })
          .catch((refreshErr) => {
            isRefreshing = false;
            refreshSubscribers = [];
            _store?.dispatch(logout());
            const isPublicPath = window.location.pathname.includes('/shared/') ||
                                 window.location.pathname === '/epcr/login' ||
                                 window.location.pathname === '/login';
            if (!isPublicPath) {
              window.location.href = '/epcr/login';
            }
            reject(refreshErr);
          });
      });
    }

    const isPublicPath = window.location.pathname.includes('/shared/') ||
                         window.location.pathname === '/epcr/login' ||
                         window.location.pathname === '/login';

    if (status === 401 && originalRequest.url.includes('/api/auth/refresh')) {
      _store?.dispatch(logout());
      if (!isPublicPath) {
        window.location.href = '/epcr/login';
      }
    }

    // ── ePCR OFFLINE FALLBACK ON WRITE FAILURE ──────────────────────────────
    const isEpcrWrite = originalRequest && originalRequest.url && originalRequest.url.includes('/api/epcr/records') && ['post', 'put'].includes(originalRequest.method?.toLowerCase());
    if (isEpcrWrite && (!err.response || err.response.status >= 400)) {
      let cleanUrl = originalRequest.url.split('?')[0];
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      const parts = cleanUrl.split('/');
      const lastPart = parts[parts.length - 1]; // Can be 'records', 'submit', or '{id}'
      
      return import('../utils/offlineEpcr').then(({ saveOfflineDraft, getOfflineDrafts, getCachedRecords, enqueueSyncAction, getOfflineSyncQueue, saveOfflineSyncQueue }) => {
        if (originalRequest.method.toLowerCase() === 'post') {
          if (lastPart === 'records') {
            // CREATE new record fallback
            const payload = typeof originalRequest.data === 'string' && originalRequest.data ? JSON.parse(originalRequest.data) : (originalRequest.data || {});
            const tempId = 'temp-' + (self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).slice(2));
            const localDraft = {
              ...payload,
              id: tempId,
              incidentNumber: `DRAFT-${tempId.substring(5, 13).toUpperCase()}`,
              status: 'DRAFT_OFFLINE',
              isOfflineDraft: true
            };
            saveOfflineDraft(tempId, localDraft);
            enqueueSyncAction({ type: 'CREATE', tempId, data: payload });
            return {
              data: localDraft,
              status: 201,
              statusText: 'Created',
              headers: {},
              config: originalRequest
            };
          } else if (lastPart === 'submit') {
            // SUBMIT record fallback
            const id = parts[parts.length - 2];
            const drafts = getOfflineDrafts();
            const cached = getCachedRecords();
            const record = drafts[id] || cached.find(r => r.id === id);
            
            if (record) {
              record.status = 'SUBMITTED';
              if (drafts[id]) {
                saveOfflineDraft(id, record);
              }
              enqueueSyncAction({ type: 'SUBMIT', recordId: id });
              return {
                data: record,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: originalRequest
              };
            }
          }
        } else {
          // PUT update fallback
          const payload = typeof originalRequest.data === 'string' && originalRequest.data ? JSON.parse(originalRequest.data) : (originalRequest.data || {});
          if (lastPart.startsWith('temp-')) {
            saveOfflineDraft(lastPart, payload);
            const queue = getOfflineSyncQueue();
            const idx = queue.findIndex(item => item.tempId === lastPart);
            if (idx !== -1) {
              queue[idx].data = payload;
              saveOfflineSyncQueue(queue);
            }
          } else {
            enqueueSyncAction({ type: 'UPDATE', recordId: lastPart, data: payload });
          }
          return {
            data: { ...payload, id: lastPart },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: originalRequest
          };
        }
        return Promise.reject(err);
      }).catch(() => Promise.reject(err));
    }
    
    // ── ePCR OFFLINE FALLBACK ON READ FAILURE ───────────────────────────────
    const isEpcrGet = originalRequest && originalRequest.url && originalRequest.url.includes('/api/epcr/records') && originalRequest.method?.toLowerCase() === 'get';
    if (isEpcrGet && !err.response) {
      let cleanUrl = originalRequest.url.split('?')[0];
      if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      const parts = cleanUrl.split('/');
      const lastPart = parts[parts.length - 1]; // Can be 'records', or '{id}'
      
      return import('../utils/offlineEpcr').then(({ getCachedRecords, getOfflineDrafts, getOfflineDetailsCache }) => {
        const isList = lastPart === 'records' || parts.includes('organization') || parts.includes('paramedic');
        const cached = getCachedRecords();
        const drafts = Object.values(getOfflineDrafts());
        const all = [...drafts, ...cached];
        
        if (isList) {
          if (lastPart === 'records') {
            const params = originalRequest.params || {};
            const page = parseInt(params.page || 0, 10);
            const size = parseInt(params.size || 20, 10);
            const start = page * size;
            const sliceEnd = start + size;
            const content = all.slice(start, sliceEnd);
            
            return {
              data: {
                content: content,
                totalPages: Math.ceil(all.length / size) || 1,
                totalElements: all.length,
                page: page,
                size: size,
                last: sliceEnd >= all.length
              },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: originalRequest
            };
          } else {
            return {
              data: all,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: originalRequest
            };
          }
        } else {
          // Single details view fallback
          const detailsCache = getOfflineDetailsCache();
          const lookupId = lastPart.toLowerCase();
          const found = drafts[lookupId] || detailsCache[lookupId] || cached.find(r => r.id?.toLowerCase() === lookupId);
          if (found) {
            return {
              data: found,
              status: 200,
              statusText: 'OK',
              headers: {},
              config: originalRequest
            };
          }
        }
        return Promise.reject(err);
      }).catch(() => Promise.reject(err));
    }
    // ────────────────────────────────────────────────────────────────────────

    if (err.config?.hideToast) {
      return Promise.reject(err);
    }

    if (status === 403) {
      _store?.dispatch(addToast({ type: 'error', message: message || 'Access Denied — you don\'t have permission.' }));
    } else if (status === 404) {
      _store?.dispatch(addToast({ type: 'error', message: message || 'Resource not found.' }));
    } else if (status === 400) {
      _store?.dispatch(addToast({ type: 'error', message: `Validation Error: ${message}` }));
    } else if (status >= 500) {
      _store?.dispatch(addToast({ type: 'error', message: `Server Error: ${message}` }));
    } else if (!err.response) {
      _store?.dispatch(addToast({ type: 'error', message: 'Network error — check your connection.' }));
    }

    return Promise.reject(err);
  }
);

export default client;
