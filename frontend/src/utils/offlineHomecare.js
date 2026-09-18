/**
 * offlineHomecare.js — PWA offline queue for home care field actions.
 *
 * Pattern: Follows the same localStorage-based queue pattern as offlineEpcr.js.
 * Queues check-in and checkout events locally when offline,
 * and syncs them when connectivity is restored.
 */

import client from '../api/client';
import { getDecryptedItem, setEncryptedItem } from './cryptoStorage';

const QUEUE_KEY = 'homecare.offline.action_queue';

// ── Queue Management ─────────────────────────────────────────────────────────

function getQueue() {
  try {
    const data = getDecryptedItem(localStorage, QUEUE_KEY);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    setEncryptedItem(localStorage, QUEUE_KEY, queue || []);
  } catch {
    // Storage full — silently ignore
  }
}

/**
 * Queue a home care action for later sync.
 * @param {string} actionType  - 'checkin' | 'checkout'
 * @param {string} visitId     - The visit's MongoDB ID
 * @param {object} payload     - The request body to send when syncing
 */
export async function queueHomeCareAction(actionType, visitId, payload) {
  const queue = getQueue();
  queue.push({
    id: `hc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    actionType,
    visitId,
    payload: { ...payload, offlineCreated: true },
    queuedAt: new Date().toISOString(),
    retries: 0,
  });
  saveQueue(queue);
  console.log(`[HomeCare Offline] Queued ${actionType} for visit ${visitId}`);
}

export function getPendingHomeCareActions() {
  return getQueue();
}

export function hasPendingHomeCareActions() {
  return getQueue().length > 0;
}

// ── Sync (called on reconnect) ───────────────────────────────────────────────

/**
 * Attempts to sync all pending offline home care actions.
 * Call this on navigator.onLine event or on app startup when authenticated.
 * Returns { synced, failed } counts.
 */
export async function syncOfflineHomeCareActions() {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const endpoint =
        item.actionType === 'checkin'
          ? `/api/homecare/visits/${item.visitId}/checkin`
          : `/api/homecare/visits/${item.visitId}/checkout`;

      await client.put(endpoint, item.payload);
      synced++;
      console.log(`[HomeCare Offline] Synced ${item.actionType} for visit ${item.visitId}`);
    } catch (err) {
      item.retries = (item.retries || 0) + 1;
      if (item.retries < 5) {
        remaining.push(item);
      } else {
        console.error(`[HomeCare Offline] Dropping ${item.actionType} after 5 retries. visitId=${item.visitId}`);
        failed++;
      }
    }
  }

  saveQueue(remaining);
  console.log(`[HomeCare Offline] Sync complete. synced=${synced}, failed=${failed}, pending=${remaining.length}`);
  return { synced, failed };
}
