import client from '../api/client';
import { getDecryptedItem, setEncryptedItem } from './cryptoStorage';

const DRAFTS_KEY = 'epcr.offline.records.drafts';
const QUEUE_KEY  = 'epcr.offline.records.sync_queue';
const CACHE_KEY  = 'epcr.offline.records.cache';
const DETAILS_CACHE_KEY = 'epcr.offline.records.details_cache';

// ── Read Cache (GET Fallback) ────────────────────────────────────────

export function getCachedRecords() {
  try {
    const data = getDecryptedItem(sessionStorage, CACHE_KEY);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveCachedRecords(records) {
  try {
    setEncryptedItem(sessionStorage, CACHE_KEY, records || []);
  } catch {
    // Ignore storage issues
  }
}

export function getOfflineDetailsCache() {
  try {
    const data = getDecryptedItem(sessionStorage, DETAILS_CACHE_KEY);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveOfflineDetailRecord(id, record) {
  try {
    const cache = getOfflineDetailsCache();
    cache[id] = record;
    setEncryptedItem(sessionStorage, DETAILS_CACHE_KEY, cache);
  } catch {
    // Ignore
  }
}

export function clearOfflineCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(DETAILS_CACHE_KEY);
  } catch {
    // Ignore
  }
}

// ── Offline Drafts (Local CRUD) ──────────────────────────────────────

export function getOfflineDrafts() {
  try {
    const data = getDecryptedItem(localStorage, DRAFTS_KEY);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveOfflineDraft(tempId, data) {
  try {
    const drafts = getOfflineDrafts();
    drafts[tempId] = { ...data, id: tempId, status: 'DRAFT_OFFLINE', isOfflineDraft: true };
    setEncryptedItem(localStorage, DRAFTS_KEY, drafts);
  } catch {
    // Ignore
  }
}

export function deleteOfflineDraft(tempId) {
  try {
    const drafts = getOfflineDrafts();
    delete drafts[tempId];
    setEncryptedItem(localStorage, DRAFTS_KEY, drafts);
  } catch {
    // Ignore
  }
}

// ── Sync Queue (FIFO mutations queue) ───────────────────────────────

export function getOfflineSyncQueue() {
  try {
    const data = getDecryptedItem(localStorage, QUEUE_KEY);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveOfflineSyncQueue(queue) {
  try {
    setEncryptedItem(localStorage, QUEUE_KEY, queue || []);
  } catch {
    // Ignore
  }
}

export function enqueueSyncAction(action) {
  try {
    const queue = getOfflineSyncQueue();
    queue.push(action);
    saveOfflineSyncQueue(queue);
  } catch {
    // Ignore
  }
}

// ── Throttled Sequential Flush ──────────────────────────────────────

/**
 * Replays offline ePCR requests sequentially (FIFO) with a 1-second delay between requests.
 * Updates subsequent queue actions if a tempId is mapped to a real MongoDB ID.
 *
 * @param {function} onProgress - Callback triggered after each item finishes: (syncedCount, totalCount)
 */
export async function syncOfflineRecords(onProgress) {
  let queue = getOfflineSyncQueue();
  if (queue.length === 0) return true;

  const total = queue.length;
  let completed = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    // 1-second throttle delay before each sync request (protects DB and server resources)
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      if (item.type === 'CREATE') {
        const config = {
          headers: {
            'Idempotency-Key': `epcr-create-${item.tempId}`
          }
        };

        const res = await client.post('/api/epcr/records', item.data, config);
        const realRecord = res.data;
        const realId = realRecord.id;

        // Delete the temporary local draft
        deleteOfflineDraft(item.tempId);

        // Idempotency Mapping Shift:
        // Update any remaining UPDATE actions in the queue referencing this tempId to the new realId
        for (let j = i + 1; j < queue.length; j++) {
          if (queue[j].recordId === item.tempId) {
            queue[j].recordId = realId;
          }
        }
      } 
      else if (item.type === 'UPDATE') {
        await client.put(`/api/epcr/records/${item.recordId}`, item.data);
      }
      else if (item.type === 'SUBMIT') {
        await client.post(`/api/epcr/records/${item.recordId}/submit`);
      }

      completed++;
      if (typeof onProgress === 'function') {
        onProgress(completed, total);
      }
    } catch (error) {
      // If a request fails with a 400 Bad Request or 403, we skip it so the queue isn't blocked forever,
      // but if it's a 500 or Network Error we stop sync and retry later when connection is more stable.
      const status = error.response?.status;
      if (status && status >= 400 && status < 500) {
        // Skip and remove invalid/poisoned local drafts so they do not get stuck
        if (item.tempId) {
          deleteOfflineDraft(item.tempId);
        }
        completed++;
        if (typeof onProgress === 'function') {
          onProgress(completed, total);
        }
      } else {
        // Network drop or server down: save current state and abort.
        saveOfflineSyncQueue(queue.slice(completed));
        return false;
      }
    }
  }

  // Entire queue cleared successfully
  saveOfflineSyncQueue([]);
  return true;
}
