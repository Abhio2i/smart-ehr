import { encryptPayload, decryptPayload } from './cryptoStorage';

const DB_NAME = 'healthcare_scheduling_offline';
const STORE_NAME = 'offline_appointments';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      }
    };
    
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const queueOfflineBooking = async (appointmentData) => {
  const db = await openDB();
  const idempotencyKey = appointmentData.idempotencyKey || `offline-${Date.now()}-${Math.random()}`;
  
  // Encrypt sensitive PHI fields (patientName, reasonForVisit)
  const encryptedPayload = await encryptPayload({
    slotId: appointmentData.slotId,
    patientId: appointmentData.patientId,
    patientName: appointmentData.patientName,
    reasonForVisit: appointmentData.reasonForVisit
  });

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const record = {
      idempotencyKey,
      encryptedData: encryptedPayload,
      timestamp: Date.now()
    };
    
    const request = store.put(record);
    request.onsuccess = () => {
      console.log('[Scheduling Offline] Encrypted and queued appointment:', idempotencyKey);
      resolve({ ...appointmentData, idempotencyKey });
    };
    request.onerror = (e) => reject(e.target.error);
  });
};

export const getQueuedBookings = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = async () => {
      const rawRecords = request.result || [];
      const decrypted = [];
      for (const item of rawRecords) {
        if (item.encryptedData) {
          const payload = await decryptPayload(item.encryptedData);
          if (payload) {
            decrypted.push({ ...payload, idempotencyKey: item.idempotencyKey });
          }
        } else {
          // Transparent legacy support
          decrypted.push(item);
        }
      }
      resolve(decrypted);
    };
    request.onerror = (e) => reject(e.target.error);
  });
};

export const removeQueuedBooking = async (idempotencyKey) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(idempotencyKey);
    
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

// Process queue and sync with backend
export const syncOfflineBookings = async (clientAxios) => {
  const queued = await getQueuedBookings();
  if (queued.length === 0) return;
  
  console.log(`Found ${queued.length} offline appointment(s) to synchronize.`);
  
  for (const appt of queued) {
    try {
      await clientAxios.post('/api/scheduling/appointments', {
        slotId: appt.slotId,
        patientId: appt.patientId,
        patientName: appt.patientName,
        reasonForVisit: appt.reasonForVisit
      }, {
        headers: {
          'Idempotency-Key': appt.idempotencyKey
        }
      });
      // Delete upon successful synchronization (or idempotency duplicate confirm)
      await removeQueuedBooking(appt.idempotencyKey);
      console.log('Synchronized offline appointment:', appt.idempotencyKey);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409 || status === 400) {
        // Safe to remove if already booked or conflict exists
        await removeQueuedBooking(appt.idempotencyKey);
      }
      console.error('Failed to sync offline appointment:', appt.idempotencyKey, err);
    }
  }
};
