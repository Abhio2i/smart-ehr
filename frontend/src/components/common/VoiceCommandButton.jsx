import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, X, CheckCircle, RefreshCw, AlertCircle, FileText, RotateCcw, Search, User } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/uiSlice';
import client from '../../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip ONLY leading command verbs/phrases, not arbitrary words.
 * Preserves names like "Ann", "Andre", "Anand", etc.
 */
const COMMAND_PATTERNS = [
  /^(open|show|find|search|get|load|pull|access|view|display|look\s+up|search\s+for|look\s+for)\s+/i,
  /^(patient|record|epcr|chart|file|records)\s+(for|named?|called|of)?\s*/i,
  /^(the|a)\s+patient\s+(named?|called)?\s*/i,
  /^(please\s+)?(open|show|find|get|display)\s+/i,
  /^(doctor|dr\.?|doc)\s+/i,
];

const extractName = (raw) => {
  let text = raw.trim();
  // Strip leading command phrase (only from the start, not mid-string)
  for (const pat of COMMAND_PATTERNS) {
    text = text.replace(pat, '');
  }
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
};

const isSupported = () =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

// ─────────────────────────────────────────────────────────────────────────────
// Phase constants & style maps
// ─────────────────────────────────────────────────────────────────────────────
const P = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error' };

const BTN_BG = {
  [P.IDLE]:       'linear-gradient(135deg,#1A3C8F 0%,#2451b3 100%)',
  [P.LISTENING]:  'linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)',
  [P.PROCESSING]: 'linear-gradient(135deg,#1A3C8F 0%,#2451b3 100%)',
  [P.SUCCESS]:    'linear-gradient(135deg,#047857 0%,#10b981 100%)',
  [P.ERROR]:      'linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)',
};

const BTN_SHADOW = {
  [P.IDLE]:       '0 4px 24px rgba(26,60,143,0.45)',
  [P.LISTENING]:  '0 8px 28px rgba(185,28,28,0.55)',
  [P.PROCESSING]: '0 4px 24px rgba(26,60,143,0.45)',
  [P.SUCCESS]:    '0 8px 28px rgba(4,120,87,0.5)',
  [P.ERROR]:      '0 8px 28px rgba(185,28,28,0.45)',
};

// ─────────────────────────────────────────────────────────────────────────────
// All CSS keyframes injected once
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes vc-pulse   { 0%{transform:scale(1);opacity:.55} 100%{transform:scale(2.7);opacity:0} }
  @keyframes vc-bar     { 0%,100%{height:5px} 50%{height:20px} }
  @keyframes vc-floatin { from{opacity:0;transform:translateY(8px) scale(.95)} to{opacity:1;transform:none} }
  @keyframes vc-shake   { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-10deg)} 40%{transform:rotate(10deg)} 60%{transform:rotate(-6deg)} 80%{transform:rotate(6deg)} }
  @keyframes vc-pop     { from{opacity:0;transform:scale(.82)} to{opacity:1;transform:scale(1)} }
  @keyframes vc-spin    { to{transform:rotate(360deg)} }
  @keyframes vc-blink   { 0%,100%{opacity:1} 50%{opacity:.25} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function VoiceCommandButton({ visible = true }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [phase,        setPhase]        = useState(P.IDLE);
  const [interim,      setInterim]      = useState('');   // live caption while speaking
  const [heard,        setHeard]        = useState('');   // final transcript
  const [matches,      setMatches]      = useState([]);
  const [showPicker,   setShowPicker]   = useState(false);
  const [showTip,      setShowTip]      = useState(false);
  const [showManual,   setShowManual]   = useState(false); // manual search fallback
  const [manualInput,  setManualInput]  = useState('');
  const [searching,    setSearching]    = useState(false);

  const recRef       = useRef(null);
  const timerRef     = useRef(null);
  const manualRef    = useRef(null);
  const supported    = isSupported();

  // ── schedule reset to idle ─────────────────────────────────────────────────
  const scheduleReset = useCallback((delay = 3000) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setPhase(P.IDLE);
      setHeard('');
      setInterim('');
    }, delay);
  }, []);

  // ── open a found record ────────────────────────────────────────────────────
  const openRecord = useCallback((patient) => {
    setShowPicker(false);
    setMatches([]);
    setShowManual(false);
    setManualInput('');
    setPhase(P.SUCCESS);
    const id = patient.patientId || patient.id || patient.userId;
    if (id) {
      navigate(`/patient-history/${id}`);
    }
    scheduleReset(1800);
  }, [navigate, scheduleReset]);

  // ── search backend for a name ──────────────────────────────────────────────
  const searchByName = useCallback(async (name) => {
    const res = await client.get('/api/admin/patients/search', {
      params: { phone: name, limit: 10 },
      hideToast: true,
    });
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.content)) return data.content;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }, []);

  // ── process: try all alternatives + word fallback ─────────────────────────
  const processAlternatives = useCallback(async (alternatives) => {
    setPhase(P.PROCESSING);
    setInterim('');

    // Build a de-duplicated list of queries to try (full phrase + individual words)
    const queries = new Map(); // query → altText (for setHeard)
    for (const alt of alternatives) {
      const name = extractName(alt);
      if (!name || name.length < 2) continue;
      queries.set(name, alt); // full-phrase query
    }
    // Word-level fallback queries from the best alternative
    const bestName = extractName(alternatives[0] || '');
    const words = bestName.split(/\s+/).filter(w => w.length >= 3);
    for (const word of words) {
      if (!queries.has(word)) queries.set(word, word);
    }

    if (queries.size === 0) {
      setHeard(alternatives[0] || '');
      setPhase(P.ERROR);
      scheduleReset(6000);
      return;
    }

    // Fire ALL queries simultaneously — first meaningful result wins
    const entries = [...queries.entries()]; // [[query, altText], ...]
    setHeard(entries[0]?.[1] || alternatives[0] || '');

    const results = await Promise.allSettled(
      entries.map(([q]) => searchByName(q))
    );

    // Prefer an exact single-match; fall back to first multi-match
    let singleHit = null;
    let multiHit  = null;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== 'fulfilled') continue;
      const list = r.value;
      if (list.length === 1 && !singleHit) singleHit = list[0];
      if (list.length > 1  && !multiHit)  multiHit  = list;
    }

    if (singleHit) { openRecord(singleHit); return; }
    if (multiHit)  { setMatches(multiHit.slice(0, 8)); setShowPicker(true); setPhase(P.IDLE); return; }

    // Nothing found — show error + offer manual fallback
    setHeard(alternatives[0] || '');
    setPhase(P.ERROR);
    scheduleReset(6000); // give user time to use manual search
  }, [searchByName, openRecord, scheduleReset]);


  // ── manual search submit ───────────────────────────────────────────────────
  const handleManualSearch = useCallback(async (e) => {
    e?.preventDefault();
    const name = manualInput.trim();
    if (!name || name.length < 2) return;
    setSearching(true);
    try {
      const list = await searchByName(name);
      if (list.length === 0) {
        dispatch(addToast({ type: 'error', message: `No patient found for "${name}"` }));
      } else if (list.length === 1) {
        setShowManual(false);
        openRecord(list[0]);
      } else {
        setHeard(name);
        setMatches(list.slice(0, 8));
        setShowPicker(true);
        setShowManual(false);
        setPhase(P.IDLE);
      }
    } catch {
      dispatch(addToast({ type: 'error', message: 'Search failed. Check your connection.' }));
    } finally {
      setSearching(false);
    }
  }, [manualInput, searchByName, openRecord, dispatch]);

  // ── start speech recognition ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!supported || phase !== P.IDLE) return;
    setShowManual(false);
    setShowPicker(false);
    setHeard('');
    setInterim('');

    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang            = navigator.language || 'en-US';
    rec.interimResults  = true;   // ✅ FIX: live caption
    rec.maxAlternatives = 5;      // ✅ FIX: try 5 alternatives
    rec.continuous      = false;

    rec.onstart = () => setPhase(P.LISTENING);

    rec.onresult = (e) => {
      const result = e.results[e.results.length - 1];
      if (!result.isFinal) {
        // Show live interim caption
        setInterim(result[0].transcript);
        return;
      }
      // Collect all final alternatives
      const alts = [];
      for (let i = 0; i < result.length; i++) {
        alts.push(result[i].transcript);
      }
      rec.stop();
      processAlternatives(alts);
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      const msg =
        e.error === 'no-speech'    ? 'Nothing heard — tap the mic and speak clearly.' :
        e.error === 'not-allowed'  ? 'Mic access denied. Allow mic in browser settings.' :
        e.error === 'network'      ? 'Network error during voice recognition.' :
                                     `Voice error: ${e.error}`;
      dispatch(addToast({ type: 'warning', message: msg }));
      setPhase(P.ERROR);
      scheduleReset(4000);
    };

    rec.onend = () => {
      // If still LISTENING when rec ends without result, go back to idle
      setPhase(prev => prev === P.LISTENING ? P.IDLE : prev);
      setInterim('');
    };

    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  }, [supported, phase, processAlternatives, dispatch, scheduleReset]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setPhase(P.IDLE);
    setInterim('');
  }, []);

  // ── Alt+V shortcut ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        if (phase === P.IDLE) startListening();
        else if (phase === P.LISTENING) stopListening();
      }
      if (e.key === 'Escape') {
        stopListening();
        setShowPicker(false);
        setShowManual(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, startListening, stopListening]);

  // ── focus manual input when it appears ───────────────────────────────────
  useEffect(() => {
    if (showManual) setTimeout(() => manualRef.current?.focus(), 80);
  }, [showManual]);

  // ── cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    recRef.current?.abort();
  }, []);

  if (!supported) return null;

  const isListening  = phase === P.LISTENING;
  const isProcessing = phase === P.PROCESSING;
  const isError      = phase === P.ERROR;
  const isSuccess    = phase === P.SUCCESS;

  // Derived display transcript
  const displayTranscript = interim || heard;

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      {/* ── Multi-match Picker ──────────────────────────────────────────── */}
      {showPicker && (
        <div
          style={{
            position:  'fixed',
            right:     '24px',
            bottom:    '110px',
            zIndex:    300,
            width:     '288px',
            background:'white',
            borderRadius: '20px',
            border:    '1px solid #DDE3F0',
            overflow:  'hidden',
            boxShadow: '0 24px 64px rgba(15,26,58,0.2), 0 4px 16px rgba(15,26,58,0.08)',
            animation: 'vc-floatin 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {/* header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'linear-gradient(135deg,#F8FAFF,#EEF2FF)', borderBottom:'1px solid #F0F4FC' }}>
            <div>
              <p style={{ fontSize:'11px', fontWeight:900, color:'#0F1A3A', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
                Select Patient
              </p>
              <p style={{ fontSize:'10px', color:'#A0AECB', fontFamily:'monospace', margin:'2px 0 0', maxWidth:'190px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                Heard: &ldquo;{heard}&rdquo;
              </p>
            </div>
            <button
              onClick={() => { setShowPicker(false); setMatches([]); }}
              style={{ background:'none', border:'none', cursor:'pointer', padding:'6px', borderRadius:'8px', color:'#A0AECB', display:'flex' }}
              onMouseEnter={e => { e.currentTarget.style.background='#FFF0F3'; e.currentTarget.style.color='#C8102E'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#A0AECB'; }}
            >
              <X size={13} />
            </button>
          </div>

          {/* list */}
          <div style={{ maxHeight:'280px', overflowY:'auto' }}>
            {matches.map((r, i) => (
              <button
                key={r.patientId || r.id || i}
                onClick={() => openRecord(r)}
                style={{
                  display:'flex', alignItems:'center', gap:'12px',
                  width:'100%', padding:'12px 16px', border:'none',
                  borderBottom:'1px solid #F8FAFF', background:'transparent',
                  cursor:'pointer', textAlign:'left',
                  animation:`vc-floatin 0.18s ease-out ${i*0.04}s both`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background='#EEF2FF'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}
              >
                <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:'#EEF2FF', color:'#1A3C8F', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:900, flexShrink:0 }}>
                  {(r.patientName || r.name || 'P').charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <p style={{ fontSize:'13px', fontWeight:600, color:'#0F1A3A', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {r.patientName || r.name || [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Anonymous'}
                  </p>
                  <p style={{ fontSize:'10px', color:'#A0AECB', fontFamily:'monospace', margin:'1px 0 0' }}>
                    #{String(r.patientId || r.id || '').substring(0,8).toUpperCase()} · {r.phone || r.email || 'Patient'}
                  </p>
                </div>
                <User size={13} style={{ color:'#C0CADF', flexShrink:0 }} />
              </button>
            ))}
          </div>

          <div style={{ padding:'8px 16px', background:'#F8FAFF', borderTop:'1px solid #F0F4FC', textAlign:'center' }}>
            <p style={{ fontSize:'9px', color:'#C0CADF', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.12em', margin:0 }}>
              Press Esc to cancel
            </p>
          </div>
        </div>
      )}

      {/* ── Manual search fallback ───────────────────────────────────────── */}
      {showManual && (
        <form
          onSubmit={handleManualSearch}
          style={{
            position:'fixed', right:'24px', bottom:'110px', zIndex:300,
            width:'272px', background:'white', borderRadius:'16px',
            border:'1px solid #DDE3F0', overflow:'hidden',
            boxShadow:'0 20px 60px rgba(15,26,58,0.18)',
            animation:'vc-floatin 0.22s ease-out',
          }}
        >
          <div style={{ padding:'12px 16px', background:'linear-gradient(135deg,#F8FAFF,#EEF2FF)', borderBottom:'1px solid #F0F4FC' }}>
            <p style={{ fontSize:'11px', fontWeight:900, color:'#0F1A3A', textTransform:'uppercase', letterSpacing:'0.1em', margin:0 }}>
              Type Patient Name
            </p>
            <p style={{ fontSize:'10px', color:'#A0AECB', margin:'2px 0 0' }}>
              Voice didn&apos;t match — search manually
            </p>
          </div>
          <div style={{ padding:'12px 16px', display:'flex', gap:'8px' }}>
            <input
              ref={manualRef}
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="e.g. John Doe"
              style={{
                flex:1, padding:'8px 12px', border:'1.5px solid #DDE3F0',
                borderRadius:'10px', fontSize:'13px', color:'#0F1A3A',
                outline:'none', fontFamily:'inherit',
              }}
              onFocus={e => { e.target.style.borderColor='#1A3C8F'; }}
              onBlur={e  => { e.target.style.borderColor='#DDE3F0'; }}
            />
            <button
              type="submit"
              disabled={searching || manualInput.trim().length < 2}
              style={{
                padding:'8px 12px', borderRadius:'10px', border:'none',
                background:'#1A3C8F', color:'white', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity: (searching || manualInput.trim().length < 2) ? 0.5 : 1,
              }}
            >
              {searching
                ? <RefreshCw size={14} style={{ animation:'vc-spin 0.8s linear infinite' }} />
                : <Search size={14} />
              }
            </button>
          </div>
          <div style={{ padding:'0 16px 12px', display:'flex', justifyContent:'flex-end' }}>
            <button type="button" onClick={() => { setShowManual(false); setManualInput(''); }}
              style={{ fontSize:'11px', color:'#A0AECB', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Floating Button Area ─────────────────────────────────────────── */}
      <div style={{ position:'fixed', right:'2px', width:'100px', bottom:'24px', zIndex:250, display: visible ? 'flex' : 'none', flexDirection:'column', alignItems:'center', gap:'8px' }}>

        {/* Live caption pill (while listening) */}
        {isListening && (
          <div style={{
            background:'rgba(15,26,58,0.92)', backdropFilter:'blur(8px)',
            color:'white', fontSize:'11px', fontWeight:700,
            padding:'7px 14px', borderRadius:'20px', whiteSpace:'nowrap',
            animation:'vc-floatin 0.2s ease-out',
            display:'flex', alignItems:'center', gap:'8px', maxWidth:'240px',
          }}>
            {/* Blinking dot */}
            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#ef4444', flexShrink:0, animation:'vc-blink 1s ease-in-out infinite' }} />
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {interim ? `"${interim}"` : 'Listening…'}
            </span>
          </div>
        )}

        {/* Processing pill */}
        {isProcessing && (
          <div style={{
            background:'rgba(15,26,58,0.92)', backdropFilter:'blur(8px)',
            color:'white', fontSize:'11px', fontWeight:600,
            padding:'7px 14px', borderRadius:'20px',
            animation:'vc-floatin 0.15s ease-out',
            display:'flex', alignItems:'center', gap:'8px', maxWidth:'240px',
          }}>
            <RefreshCw size={12} style={{ animation:'vc-spin 0.8s linear infinite', flexShrink:0 }} />
            <span style={{ fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              Searching &ldquo;{extractName(heard)}&rdquo;…
            </span>
          </div>
        )}

        {/* Error pill with retry + manual */}
        {isError && heard && (
          <div style={{
            background:'rgba(185,28,28,0.95)', backdropFilter:'blur(8px)',
            color:'white', fontSize:'11px', fontWeight:600,
            padding:'8px 14px', borderRadius:'20px',
            animation:'vc-floatin 0.2s ease-out',
            display:'flex', flexDirection:'column', gap:'6px',
            maxWidth:'240px',
          }}>
            <span style={{ fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              No match for &ldquo;{extractName(heard)}&rdquo;
            </span>
            <div style={{ display:'flex', gap:'6px' }}>
              <button
                onClick={() => { setPhase(P.IDLE); setHeard(''); startListening(); }}
                style={{ flex:1, padding:'4px 8px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'white', cursor:'pointer', fontSize:'10px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}
              >
                <RotateCcw size={10} /> Retry Voice
              </button>
              <button
                onClick={() => { clearTimeout(timerRef.current); setShowManual(true); setPhase(P.IDLE); }}
                style={{ flex:1, padding:'4px 8px', borderRadius:'8px', border:'1px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'white', cursor:'pointer', fontSize:'10px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}
              >
                <Search size={10} /> Type Name
              </button>
            </div>
          </div>
        )}

        {/* Tooltip */}
        {showTip && phase === P.IDLE && !showPicker && !showManual && (
          <div style={{
            background:'rgba(15,26,58,0.92)', backdropFilter:'blur(8px)',
            color:'white', fontSize:'10px', fontWeight:600,
            padding:'7px 12px', borderRadius:'10px', whiteSpace:'nowrap',
            animation:'vc-floatin 0.15s ease-out', pointerEvents:'none',
          }}>
            Voice Search &nbsp;·&nbsp;
            <span style={{ background:'rgba(255,255,255,0.18)', padding:'1px 6px', borderRadius:'4px', fontFamily:'monospace' }}>Alt+V</span>
          </div>
        )}

        {/* Button + pulse rings */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {/* Rings (listening only) */}
          {isListening && (
            <>
              <div style={{ position:'absolute', width:'56px', height:'56px', borderRadius:'50%', background:'rgba(185,28,28,0.3)', animation:'vc-pulse 1.6s ease-out infinite' }} />
              <div style={{ position:'absolute', width:'56px', height:'56px', borderRadius:'50%', background:'rgba(185,28,28,0.18)', animation:'vc-pulse 1.6s ease-out 0.55s infinite' }} />
            </>
          )}

          <button
            onClick={isListening ? stopListening : startListening}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onMouseDown={e => { e.currentTarget.style.transform='scale(0.9)'; }}
            onMouseUp={e   => { e.currentTarget.style.transform='scale(1)'; }}
            aria-label="Voice Search — say a patient name to open their EPCR record"
            style={{
              position:'relative', zIndex:10,
              width:'56px', height:'56px', borderRadius:'50%',
              border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              background: BTN_BG[phase],
              boxShadow:  BTN_SHADOW[phase],
              transition: 'background 0.3s, box-shadow 0.3s, transform 0.12s',
              animation:  isSuccess ? 'vc-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
            }}
          >
            {/* ── Icon by phase ── */}
            {isProcessing && (
              <RefreshCw size={20} color="white" style={{ animation:'vc-spin 0.8s linear infinite' }} />
            )}
            {isSuccess && <CheckCircle size={22} color="white" />}
            {isError    && <AlertCircle size={20} color="white" style={{ animation:'vc-shake 0.45s ease' }} />}
            {isListening && (
              /* Waveform bars */
              <div style={{ display:'flex', alignItems:'center', gap:'3px', height:'22px' }}>
                {[0, 0.1, 0.2, 0.1, 0].map((delay, i) => (
                  <div key={i} style={{
                    width:'3px', height:'5px', background:'white',
                    borderRadius:'2px', transformOrigin:'center bottom',
                    animation:`vc-bar 0.72s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            )}
            {phase === P.IDLE && <Mic size={21} color="white" />}
          </button>
        </div>

        {/* Label */}
        <span style={{
          fontSize:'9px', fontWeight:700, letterSpacing:'0.12em',
          textTransform:'uppercase',
          color: isListening ? '#ef4444' : isError ? '#ef4444' : '#A0AECB',
          transition:'color 0.3s',
        }}>
          {isListening ? 'Tap to stop' : isError ? 'Voice failed' : 'Voice · Alt+V'}
        </span>
      </div>
    </>
  );
}
