/**
 * offlineAudit.js
 * ─────────────────────────────────────────────────────────
 * Client-side buffer for HIPAA-compliant Audit Logging.
 *
 * Tracks user access, reads, edits, and authorization events while offline.
 * Persists in localStorage so they survive browser/tab closure, ensuring
 * no logs are lost if the device is closed or power-cycled before reconnecting.
 * ─────────────────────────────────────────────────────────
 */

import client from '../api/client';

const AUDIT_QUEUE_KEY = 'epcr.offline.audit.queue';

/**
 * Read the current audit log queue from localStorage
 * @returns {Array}
 */
export function getOfflineAuditQueue() {
  try {
    const raw = localStorage.getItem(AUDIT_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Write/Save the audit queue back to localStorage
 * @param {Array} queue 
 */
function saveOfflineAuditQueue(queue) {
  try {
    localStorage.setItem(AUDIT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota blockages silently
  }
}

/**
 * Add a new log entry to the offline audit queue.
 *
 * @param {object} params
 * @param {string} params.action - e.g. "OFFLINE_LOGIN", "VIEW_RECORD", "UPDATE_RECORD"
 * @param {string} params.userId - Actor ID
 * @param {string} params.userDisplayName - e.g. "John Smith"
 * @param {string} params.entityType - e.g. "PATIENT_CARE_RECORD"
 * @param {string} params.entityId - ID of affected entity
 * @param {string} params.details - Description of the action
 * @param {string} params.status - "SUCCESS" or "FAILURE"
 */
export function logOfflineAction({
  action,
  userId,
  userDisplayName,
  entityType = null,
  entityId = null,
  details = '',
  status = 'SUCCESS'
}) {
  const queue = getOfflineAuditQueue();

  const newLog = {
    userId,
    userDisplayName,
    action,
    entityType,
    entityId,
    details,
    status,
    timestamp: new Date().toISOString().replace('Z', ''), // Strips the 'Z' timezone marker for Java LocalDateTime compatibility
  };

  queue.push(newLog);
  saveOfflineAuditQueue(queue);
}

/**
 * Upload all queued offline audit logs to the backend database.
 * If successful, clears the local audit queue.
 *
 * @returns {Promise<boolean>} - true if sync succeeded or queue was empty
 */
export async function syncOfflineAudits(isBackgroundSync = false) {
  const queue = getOfflineAuditQueue();
  if (queue.length === 0) {
    return true;
  }

  // If this is a background reconnection sync, introduce a random jitter delay (0 to 3s)
  // to prevent a thundering herd on the web server network socket pool.
  if (isBackgroundSync) {
    const jitter = Math.random() * 3000;
    await new Promise(resolve => setTimeout(resolve, jitter));
  }

  // Clean up any timestamps (e.g. remove 'Z' character) for Java LocalDateTime deserializer compatibility
  const cleanedQueue = queue.map(log => ({
    ...log,
    timestamp: log.timestamp ? log.timestamp.replace('Z', '') : new Date().toISOString().replace('Z', '')
  }));

  try {
    await client.post('/api/audit/logs/bulk', cleanedQueue, { hideToast: true });
    // Wipes the queue upon successful server confirmation
    localStorage.removeItem(AUDIT_QUEUE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}
