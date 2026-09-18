/**
 * GlobalLoader
 * A premium, non-blocking loading overlay.
 * - Frosted glass backdrop
 * - Animated dual-ring + pulse dot
 * - Sliding progress bar at top
 * All elements are pointer-events-none so underlying UI remains clickable.
 *
 * Usage:
 *   <GlobalLoader visible={isAnyLoading} label="Fetching records…" />
 */

import { useEffect, useState } from 'react';

const DOTS = [0, 1, 2];

const GlobalLoader = ({ visible = false, label = 'Loading data…', sublabel = 'Please wait while we fetch your records' }) => {
  /* Soft mount/unmount animation — stay rendered for 300 ms after visible→false */
  const [rendered, setRendered] = useState(visible);
  const [fading,   setFading]   = useState(false);

  useEffect(() => {
    if (visible) {
      setFading(false);
      setRendered(true);
    } else {
      setFading(true);
      const t = setTimeout(() => { setRendered(false); setFading(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <>
      {/* ── Top shimmer progress bar ────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-[10000] h-[3px] pointer-events-none overflow-hidden"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease' }}
      >
        <div className="h-full w-full relative">
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(90deg, #1A3C8F 0%, #3B6CD4 40%, #60A5FA 60%, #1A3C8F 100%)',
              backgroundSize: '300% 100%',
              animation: 'gl-progress 1.6s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* ── Full-screen backdrop ─────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.3s ease' }}
        aria-live="polite"
        aria-label={label}
      >
        {/* Soft frosted glass layer — pointer-events-none */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'rgba(240, 244, 252, 0.55)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />

        {/* ── Loader card ─────────────────────────────────────────────── */}
        <div
          className="relative pointer-events-none flex flex-col items-center gap-4"
          style={{
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid rgba(221,227,240,0.9)',
            borderRadius: '20px',
            padding: '32px 40px',
            boxShadow: '0 8px 40px rgba(26,60,143,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            animation: fading ? 'gl-card-out 0.3s ease forwards' : 'gl-card-in 0.3s ease forwards',
          }}
        >
          {/* ── Dual-ring spinner ──────────────────────────────────────── */}
          <div className="relative w-14 h-14">
            {/* Outer ring */}
            <div
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: '#1A3C8F',
                borderRightColor: '#1A3C8F',
                animation: 'gl-spin-cw 0.9s linear infinite',
              }}
            />
            {/* Inner ring (counter-clockwise) */}
            <div
              style={{
                position: 'absolute', inset: '8px',
                borderRadius: '50%',
                border: '2.5px solid transparent',
                borderTopColor: '#C8102E',
                borderLeftColor: '#C8102E',
                animation: 'gl-spin-ccw 1.1s linear infinite',
              }}
            />
            {/* Centre dot */}
            <div
              style={{
                position: 'absolute', inset: '50%',
                transform: 'translate(-50%, -50%)',
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: '#1A3C8F',
                animation: 'gl-pulse 1.2s ease-in-out infinite',
              }}
            />
          </div>

          {/* ── Label ─────────────────────────────────────────────────── */}
          <div className="text-center">
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F1A3A', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#8A97B0', marginTop: '4px' }}>{sublabel}</p>
          </div>

          {/* ── Animated dots row ─────────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            {DOTS.map(i => (
              <div
                key={i}
                style={{
                  width: '6px', height: '6px',
                  borderRadius: '50%',
                  background: i === 0 ? '#1A3C8F' : i === 1 ? '#3B6CD4' : '#C8102E',
                  animation: `gl-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Keyframes injected once via <style> ─────────────────────── */}
      <style>{`
        @keyframes gl-progress {
          0%   { background-position: 100% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes gl-spin-cw {
          to { transform: rotate(360deg); }
        }
        @keyframes gl-spin-ccw {
          to { transform: rotate(-360deg); }
        }
        @keyframes gl-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 1;   }
          50%       { transform: translate(-50%, -50%) scale(1.6); opacity: 0.5; }
        }
        @keyframes gl-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
        @keyframes gl-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1);     }
        }
        @keyframes gl-card-out {
          from { opacity: 1; transform: translateY(0)  scale(1);     }
          to   { opacity: 0; transform: translateY(8px) scale(0.97); }
        }
      `}</style>
    </>
  );
};

export default GlobalLoader;
