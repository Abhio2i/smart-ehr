import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsOfflineSession, setOfflineSession } from '../../store/slices/authSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { syncOfflineAudits } from '../../utils/offlineAudit';

/**
 * OfflineBanner
 * ─────────────────────────────────────────────────────────
 * Fixed top banner that:
 *  - Appears instantly when the browser goes offline
 *  - Shows a different message when the user has an offline session
 *    (logged in using cached credentials)
 *  - Flashes a green "Back online" confirmation for 4 seconds on reconnect
 *  - Displays a blue "Syncing records" progress banner when uploading offline drafts
 *  - Animates in/out with Framer Motion spring physics
 *  - Lives in App.jsx so it's visible on every page
 * ─────────────────────────────────────────────────────────
 */
const OfflineBanner = () => {
  const dispatch = useDispatch();
  const { t, lang } = useLanguage();
  const isOfflineSession    = useSelector(selectIsOfflineSession);
  const [isOnline, setIsOnline]             = useState(navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const [syncStatus, setSyncStatus]           = useState(null);
  
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Sync runner function that updates the UI state
  const runRecordSync = async () => {
    try {
      const { getOfflineSyncQueue, syncOfflineRecords } = await import('../../utils/offlineEpcr');
      const queue = getOfflineSyncQueue();
      if (queue.length > 0) {
        setSyncStatus(`Syncing ${queue.length} offline records...`);
        const success = await syncOfflineRecords((completed, total) => {
          setSyncStatus(`Syncing records: ${completed} of ${total} complete...`);
        });
        if (success) {
          setSyncStatus('All records synchronized!');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('epcr-synced'));
          }
          setTimeout(() => setSyncStatus(null), 3000);
        } else {
          setSyncStatus('Sync paused. Retry later.');
          setTimeout(() => setSyncStatus(null), 5000);
        }
      }
    } catch {
      setSyncStatus(null);
    }
  };

  useEffect(() => {
    // Sync on mount if already online
    if (navigator.onLine) {
      dispatch(setOfflineSession(false));
      runRecordSync();
    }

    const checkStatus = () => {
      const currentOnline = navigator.onLine;
      const prev = isOnlineRef.current;
      
      if (prev !== currentOnline) {
        setIsOnline(currentOnline);
        if (currentOnline) {
          // Reconnected!
          setJustReconnected(true);
          dispatch(setOfflineSession(false));
          syncOfflineAudits(true);
          runRecordSync();
          setTimeout(() => setJustReconnected(false), 4000);
        } else {
          // Disconnected!
          setJustReconnected(false);
        }
      }
    };

    // Listeners for immediate updates
    window.addEventListener('online',  checkStatus);
    window.addEventListener('offline', checkStatus);
    
    // Polling fallback to capture DevTools toggles under iframe/preview environments
    const interval = setInterval(checkStatus, 1000);

    return () => {
      window.removeEventListener('online',  checkStatus);
      window.removeEventListener('offline', checkStatus);
      clearInterval(interval);
    };
  }, [dispatch]);

  // Show offline banner when: no network OR user has an offline session
  const showOffline      = !isOnline || isOfflineSession;
  const showReconnected  = justReconnected && isOnline && !isOfflineSession && !syncStatus;



  return (
    <>
      <AnimatePresence initial={false}>
        {/* ── OFFLINE / OFFLINE-SESSION banner ── */}
        {showOffline && !showReconnected && (
          <motion.div
            key="offline-banner"
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{ y: -56,    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '9px 16px',
              background: 'linear-gradient(90deg, #78350f 0%, #b45309 100%)',
              boxShadow: '0 3px 18px rgba(180, 83, 9, 0.40)',
            }}
          >
            <WifiOff size={14} style={{ color: '#fde68a', flexShrink: 0 }} />
            <p style={{
              color: '#fef3c7', fontSize: '12px', fontWeight: 600,
              letterSpacing: '0.02em', margin: 0,
            }}>
              {isOfflineSession
                ? '📴 Offline Mode — Signed in with cached credentials. Data will sync when you reconnect.'
                : '⚡ No internet connection — the app is running in offline mode.'}
            </p>
          </motion.div>
        )}

        {/* ── BACK ONLINE confirmation flash ── */}
        {showReconnected && (
          <motion.div
            key="online-banner"
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{ y: -56,    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '9px 16px',
              background: 'linear-gradient(90deg, #065f46 0%, #059669 100%)',
              boxShadow: '0 3px 18px rgba(5, 150, 105, 0.40)',
            }}
          >
            <Wifi size={14} style={{ color: '#a7f3d0', flexShrink: 0 }} />
            <p style={{
              color: '#d1fae5', fontSize: '12px', fontWeight: 600,
              letterSpacing: '0.02em', margin: 0,
            }}>
              ✅ Back online! Connection restored successfully.
            </p>
          </motion.div>
        )}

        {/* ── ACTIVE RECORD SYNC banner ── */}
        {syncStatus && (
          <motion.div
            key="sync-banner"
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0,   opacity: 1 }}
            exit={{ y: -56,    opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '10px', padding: '9px 16px',
              background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)',
              boxShadow: '0 3px 18px rgba(59, 130, 246, 0.40)',
            }}
          >
            <RefreshCw size={14} className="animate-spin" style={{ color: '#93c5fd', flexShrink: 0 }} />
            <p style={{
              color: '#dbeafe', fontSize: '12px', fontWeight: 600,
              letterSpacing: '0.02em', margin: 0,
            }}>
              {syncStatus}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Spacer so page content doesn't hide under the banner */}
      {(showOffline || showReconnected || !!syncStatus) && (
        <div style={{ height: '38px', flexShrink: 0 }} />
      )}
    </>
  );
};

export default OfflineBanner;
