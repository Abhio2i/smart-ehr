import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser, selectIsAuthenticated } from '../../store/slices/authSlice';
import { addToast } from '../../store/slices/uiSlice';
import { ShieldAlert, Clock, LogOut, RefreshCw } from 'lucide-react';

// Inactivity configuration (15 minutes total: 14 mins idle + 60s warning)
const IDLE_TIME_MS = 14 * 60 * 1000; // 14 minutes until warning
const WARNING_COUNTDOWN_SECONDS = 60; // 60 seconds countdown modal

export default function SessionIdleTimer() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_COUNTDOWN_SECONDS);

  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Reset user activity timestamp (throttled)
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarningModal) {
      // If modal was open and user performed an intentional action, close modal
      setShowWarningModal(false);
      setCountdown(WARNING_COUNTDOWN_SECONDS);
    }
  }, [showWarningModal]);

  // Handle explicit "Stay Logged In" button click
  const handleStayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    setShowWarningModal(false);
    setCountdown(WARNING_COUNTDOWN_SECONDS);
    dispatch(addToast({ type: 'success', message: 'Session extended successfully.' }));
  };

  // Handle explicit "Log Out Now" button click
  const handleForceLogout = useCallback(() => {
    setShowWarningModal(false);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    
    dispatch(logoutUser());
    dispatch(addToast({
      type: 'info',
      message: 'You have been logged out due to 15 minutes of inactivity for compliance and security.'
    }));
  }, [dispatch]);

  // Attach event listeners for user activity
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastThrottle = 0;
    const handleUserInteraction = () => {
      const now = Date.now();
      // Throttle event handling to once every 3 seconds to avoid CPU overhead
      if (now - lastThrottle > 3000) {
        lastThrottle = now;
        if (!showWarningModal) {
          lastActivityRef.current = now;
        }
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, handleUserInteraction, { passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUserInteraction));
    };
  }, [isAuthenticated, showWarningModal]);

  // Main inactivity checker interval (runs every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarningModal(false);
      return;
    }

    const checkInactivity = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIME_MS && !showWarningModal) {
        setShowWarningModal(true);
        setCountdown(WARNING_COUNTDOWN_SECONDS);
      }
    }, 5000);

    return () => clearInterval(checkInactivity);
  }, [isAuthenticated, showWarningModal]);

  // Countdown timer interval when warning modal is active
  useEffect(() => {
    if (!showWarningModal) return;

    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          handleForceLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showWarningModal, handleForceLogout]);

  if (!isAuthenticated || !showWarningModal) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-red-100 space-y-6 text-center animate-in zoom-in-95 duration-200">
        
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600 shadow-sm animate-pulse">
          <ShieldAlert size={36} />
        </div>

        {/* Heading & Information */}
        <div className="space-y-2">
          <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-red-200">
            Security Compliance Notice
          </span>
          <h2 className="text-xl font-black text-[#0F1A3A] tracking-tight">
            Session Inactivity Warning
          </h2>
          <p className="text-xs font-semibold text-[#4B5A7A] leading-relaxed">
            You have been inactive for 14 minutes. For patient privacy and healthcare security compliance (HIPAA / GNWT), your session will automatically lock.
          </p>
        </div>

        {/* Countdown Display */}
        <div className="bg-gradient-to-br from-slate-900 to-[#0F1A3A] text-white rounded-2xl p-4 flex items-center justify-center gap-3 border border-slate-800 shadow-inner">
          <Clock size={24} className="text-amber-400 animate-spin" />
          <div className="text-left">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Logging out in</p>
            <p className="text-2xl font-black font-mono text-amber-400 tracking-wider">
              {countdown} <span className="text-xs font-bold text-white uppercase">seconds</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleStayLoggedIn}
            className="flex-1 py-3 px-4 bg-brand-blue text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/30"
          >
            <RefreshCw size={16} /> Stay Logged In
          </button>
          <button
            type="button"
            onClick={handleForceLogout}
            className="py-3 px-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
