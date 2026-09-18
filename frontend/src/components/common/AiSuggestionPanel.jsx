import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Sparkles, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Brain, TrendingUp,
  List, Zap, FileText, AlertCircle, Paperclip, Search,
  MessageSquare, Send, FlaskConical, Lightbulb, ArrowRight,
  Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import {
  generateAiSuggestion,
  fetchAiSuggestions,
  askAiQuestion,
  fetchAiQuestions,
  selectSuggestionsForRecord,
  selectQuestionsForRecord,
  selectAiGenerating,
  selectAiFetching,
  selectAiAsking,
  selectAiError,
  selectAiQuestionError,
  clearAiError,
  clearQuestionError,
} from '../../store/slices/aiSuggestionSlice';

/* ── Markdown sanitizer ──────────────────────────────────────────── */
const clean = (text) =>
  String(text ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*•]\s*/gm, '')
    .trim();

/* ── Risk Badge ─────────────────────────────────────────────────── */
const RISK_CONFIG = {
  HIGH:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    icon: AlertTriangle, dot: 'bg-red-500'    },
  MEDIUM: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  icon: TrendingUp,    dot: 'bg-amber-400'  },
  LOW:    { bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',icon: CheckCircle,   dot: 'bg-emerald-500'},
};

const RiskBadge = ({ level }) => {
  const key  = String(level || '').toUpperCase();
  const cfg  = RISK_CONFIG[key] || RISK_CONFIG.MEDIUM;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <Icon size={11} />
      {key || 'UNKNOWN'} RISK
    </span>
  );
};

/* ── Bullet list ─────────────────────────────────────────────────── */
const BulletList = ({ raw, bulletColor = 'bg-brand-blue' }) => {
  if (!raw || (Array.isArray(raw) && raw.length === 0)) {
    return <p className="text-xs text-[#8A97B0] italic">None provided.</p>;
  }
  const items = Array.isArray(raw)
    ? raw.map(clean).filter(Boolean)
    : String(raw).split('\n').map(clean).filter(Boolean);
  if (!items.length) return <p className="text-xs text-[#4B5A7A]">{String(raw)}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-[#374563] leading-relaxed">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${bulletColor} shrink-0`} />
          {item}
        </li>
      ))}
    </ul>
  );
};

/* ── Single AI Analysis card ─────────────────────────────────────── */
const SuggestionCard = ({ suggestion, isLatest }) => {
  const [open, setOpen] = useState(isLatest);
  const ts = suggestion.createdAt
    ? new Date(suggestion.createdAt).toLocaleString()
    : suggestion.generatedAt
    ? new Date(suggestion.generatedAt).toLocaleString()
    : '';

  return (
    <div className={`rounded-2xl border transition-all overflow-hidden ${
      isLatest
        ? 'border-violet-200 shadow-md shadow-violet-50 bg-white'
        : 'border-[#DDE3F0] bg-[#FAFBFF]'
    }`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isLatest && (
            <span className="text-[9px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
              Latest
            </span>
          )}
          <RiskBadge level={suggestion.riskLevel} />
          {ts && (
            <span className="flex items-center gap-1 text-[10px] text-[#A0AECB] font-medium">
              <Clock size={10} /> {ts}
            </span>
          )}
        </div>
        <span className="text-[#A0AECB]">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-5 pt-2 space-y-5 border-t border-[#F0F4FC]">
          {suggestion.clinicalSummary && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1.5">Clinical Summary</p>
              <p className="text-xs text-[#374563] leading-relaxed">{clean(suggestion.clinicalSummary)}</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Brain size={13} /></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Clinical Findings</p>
            </div>
            <BulletList raw={suggestion.findings} bulletColor="bg-blue-400" />
          </div>

          {(suggestion.clinicalConcerns?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><AlertCircle size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Clinical Concerns</p>
              </div>
              <BulletList raw={suggestion.clinicalConcerns} bulletColor="bg-amber-400" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Zap size={13} /></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Recommendations</p>
            </div>
            <BulletList raw={suggestion.recommendations} bulletColor="bg-emerald-500" />
          </div>

          {(suggestion.recommendedPlan?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><List size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Recommended Plan</p>
              </div>
              <BulletList raw={suggestion.recommendedPlan} bulletColor="bg-indigo-400" />
            </div>
          )}

          {(suggestion.missingData?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Search size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Missing Data</p>
              </div>
              <BulletList raw={suggestion.missingData} bulletColor="bg-slate-400" />
            </div>
          )}

          {(suggestion.attachmentsAnalyzed?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Paperclip size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">
                  Attachments Analyzed ({suggestion.attachmentsAnalyzed.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.attachmentsAnalyzed.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-medium">
                    <FileText size={9} /> {clean(a)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestion.requestedBy && (
            <p className="text-[10px] text-[#C0CADF] font-medium pt-2 border-t border-[#F0F4FC]">
              Requested by: <span className="font-bold text-[#8A97B0]">{suggestion.requestedBy}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Q&A Answer Card ─────────────────────────────────────────────── */
const QuestionAnswerCard = ({ qa, isLatest }) => {
  const [open, setOpen] = useState(isLatest);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ts = qa.createdAt ? new Date(qa.createdAt).toLocaleString() : '';

  const toggleSpeech = (text) => {
    if (!text) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isLatest
        ? 'border-teal-200 shadow-md shadow-teal-50 bg-white'
        : 'border-[#DDE3F0] bg-[#FAFBFF]'
    }`}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start justify-between px-4 py-3 hover:bg-teal-50/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          {isLatest && (
            <span className="inline-block text-[9px] font-black uppercase tracking-widest bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200 mb-1.5">
              Latest
            </span>
          )}
          <p className="text-xs font-bold text-[#0F1A3A] leading-snug truncate pr-4">
            Q: {qa.question}
          </p>
          {ts && (
            <span className="flex items-center gap-1 text-[10px] text-[#A0AECB] font-medium mt-1">
              <Clock size={10} /> {ts}
            </span>
          )}
        </div>
        <span className="text-[#A0AECB] shrink-0 mt-1">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-5 pt-2 space-y-4 border-t border-[#F0F4FC]">

          {/* Direct Answer */}
          {qa.answer && (
            <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-500">Answer</p>
                <button
                  type="button"
                  onClick={() => toggleSpeech(qa.answer)}
                  className="text-teal-600 hover:text-teal-800 transition-colors p-1 rounded-md hover:bg-teal-100/50"
                  title={isSpeaking ? "Stop speaking" : "Speak answer"}
                >
                  {isSpeaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
              <p className="text-xs text-[#374563] leading-relaxed">{clean(qa.answer)}</p>
            </div>
          )}

          {/* Evidence From This Case */}
          {(qa.evidenceFromCase?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><FlaskConical size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Evidence From This Case</p>
              </div>
              <BulletList raw={qa.evidenceFromCase} bulletColor="bg-blue-400" />
            </div>
          )}

          {/* Clinical Reasoning */}
          {(qa.clinicalReasoning?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600"><Lightbulb size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Clinical Reasoning</p>
              </div>
              <BulletList raw={qa.clinicalReasoning} bulletColor="bg-violet-400" />
            </div>
          )}

          {/* Recommended Next Step */}
          {(qa.recommendedNextStep?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><ArrowRight size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Recommended Next Step</p>
              </div>
              <BulletList raw={qa.recommendedNextStep} bulletColor="bg-emerald-500" />
            </div>
          )}

          {/* Missing Data */}
          {(qa.missingData?.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500"><Search size={13} /></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">Missing Data</p>
              </div>
              <BulletList raw={qa.missingData} bulletColor="bg-slate-400" />
            </div>
          )}

          {/* Fallback: raw answer if no structured sections */}
          {!qa.evidenceFromCase?.length && !qa.clinicalReasoning?.length && !qa.answer && qa.answer !== '' && (
            <p className="text-xs text-[#374563] leading-relaxed whitespace-pre-wrap">{clean(qa.answer)}</p>
          )}

          {/* Attachments */}
          {(qa.attachmentsAnalyzed?.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {qa.attachmentsAnalyzed.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-medium">
                  <Paperclip size={9} /> {clean(a)}
                </span>
              ))}
            </div>
          )}

          {qa.requestedBy && (
            <p className="text-[10px] text-[#C0CADF] font-medium pt-2 border-t border-[#F0F4FC]">
              Asked by: <span className="font-bold text-[#8A97B0]">{qa.requestedBy}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main Panel ─────────────────────────────────────────────────── */
const AiSuggestionPanel = ({ recordId, userRole, allowedRoles = ['PHYSICIAN', 'ADMIN', 'MANAGER'] }) => {
  const dispatch   = useDispatch();
  const suggestions = useSelector(selectSuggestionsForRecord(recordId));
  const questions   = useSelector(selectQuestionsForRecord(recordId));
  const generating  = useSelector(selectAiGenerating);
  const fetching    = useSelector(selectAiFetching);
  const asking      = useSelector(selectAiAsking);
  const aiError     = useSelector(selectAiError);
  const qaError     = useSelector(selectAiQuestionError);

  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis');   // 'analysis' | 'ask'
  const [question, setQuestion]   = useState('');
  const textareaRef               = useRef(null);
  const canGenerate = allowedRoles.includes(userRole);

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef(''); // tracks latest voice transcript synchronously

  // ── silence timer ref – reset on every new word the doctor speaks ──────────
  const silenceTimerRef = useRef(null);
  // How long to wait after the last detected word before auto-submitting (ms).
  // 2 500 ms gives doctors natural mid-thought pauses without cutting them off.
  const SILENCE_MS = 2500;

  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported. Please use Chrome or Edge.');
      return;
    }

    // ── Already listening → user clicked Stop manually ─────────────────────
    if (isListening) {
      clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current._manualStop = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      recognitionRef.current = null;
      setIsListening(false);
      setMicError('');
      // Submit whatever has been said so far
      const voiceText = transcriptRef.current.trim();
      if (voiceText) {
        transcriptRef.current = '';
        setQuestion(voiceText);
        setTimeout(() => document.getElementById('ai-ask-question-btn')?.click(), 300);
      }
      return;
    }

    setMicError('');
    transcriptRef.current = '';

    const rec = new SpeechRecognition();
    rec.lang           = navigator.language || 'en-US';
    rec.continuous     = true;   // ✅ KEY FIX: keep recording through natural pauses
    rec.interimResults = true;   // show live transcript
    rec.maxAlternatives = 1;
    rec._manualStop    = false;

    recognitionRef.current = rec;

    rec.onstart = () => { setIsListening(true); setMicError(''); };

    rec.onresult = (e) => {
      // Accumulate the full rolling transcript across all result chunks
      let fullText = '';
      for (let i = 0; i < e.results.length; i++) {
        fullText += e.results[i][0].transcript;
      }

      // Update live preview
      transcriptRef.current = fullText;
      setQuestion(fullText);

      // ── Debounce: reset the silence timer on every new word ─────────────
      // The timer fires only when the doctor has truly stopped speaking for
      // SILENCE_MS milliseconds — so mid-sentence pauses never cut them off.
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current && !recognitionRef.current._manualStop) {
          // Auto-submit after silence threshold
          recognitionRef.current._manualStop = true; // prevent onend from firing again
          try { recognitionRef.current.stop(); } catch (_) {}
          recognitionRef.current = null;
          setIsListening(false);
          const voiceText = transcriptRef.current.trim();
          transcriptRef.current = '';
          if (voiceText) {
            setQuestion(voiceText);
            setTimeout(() => document.getElementById('ai-ask-question-btn')?.click(), 300);
          }
        }
      }, SILENCE_MS);
    };

    rec.onerror = (e) => {
      if (rec._manualStop) return;
      clearTimeout(silenceTimerRef.current);
      if (e.error === 'not-allowed') {
        setIsListening(false);
        setMicError('⚠ Microphone blocked — click the 🔒 lock icon in browser address bar → Allow Microphone → try again.');
      } else if (e.error === 'audio-capture') {
        setIsListening(false);
        setMicError('⚠ No microphone detected. Please connect a microphone and try again.');
      } else if (e.error === 'no-speech') {
        // With continuous=true, no-speech is rare — just log, keep going
        // no-speech is expected with continuous mode — ignore
      } else {
        setIsListening(false);
        setMicError(`⚠ Voice error (${e.error}). Please try again.`);
      }
    };

    rec.onend = () => {
      // With continuous=true, onend fires only when the browser forcibly ends
      // the session (e.g. tab loses focus, network issue, max duration).
      // If we didn't manually stop, clean up gracefully.
      clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current === rec && !rec._manualStop) {
        recognitionRef.current = null;
        setIsListening(false);
        const voiceText = transcriptRef.current.trim();
        transcriptRef.current = '';
        if (voiceText) {
          setQuestion(voiceText);
          setTimeout(() => document.getElementById('ai-ask-question-btn')?.click(), 300);
        }
      }
    };

    try {
      rec.start();
    } catch (_) {
      recognitionRef.current = null;
      setIsListening(false);
      setMicError('⚠ Could not start microphone. Please refresh the page and try again.');
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current._manualStop = true;
        try { recognitionRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  // Fetch history when panel opens
  useEffect(() => {
    if (panelOpen && recordId) {
      dispatch(fetchAiSuggestions(recordId));
      dispatch(fetchAiQuestions(recordId));
    }
  }, [panelOpen, recordId, dispatch]);

  const handleGenerate = async () => {
    if (!recordId || generating) return;
    dispatch(clearAiError());
    const result = await dispatch(generateAiSuggestion(recordId));
    if (generateAiSuggestion.fulfilled.match(result) && !result.payload?.recordId) {
      dispatch(fetchAiSuggestions(recordId));
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || asking) return;
    if (!recordId) {
      console.error('[AiSuggestionPanel] Cannot ask question: recordId is missing', { recordId, question });
      return;
    }
    dispatch(clearQuestionError());
    const q = question.trim();

    setQuestion('');
    const result = await dispatch(askAiQuestion({ recordId, question: q }));

  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion();
    }
  };

  return (
    <div className="rounded-2xl border border-violet-200 overflow-hidden shadow-sm">
      {/* Panel trigger bar */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-all ${
          panelOpen
            ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white'
            : 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${panelOpen ? 'bg-white/20' : 'bg-violet-100'}`}>
            <Sparkles size={15} className={panelOpen ? 'text-white' : 'text-violet-600'} />
          </div>
          <div className="text-left">
            <p className={`text-xs font-black uppercase tracking-widest ${panelOpen ? 'text-white' : 'text-violet-700'}`}>
              Gemini AI Clinical Suggestions
            </p>
            <p className={`text-[10px] mt-0.5 ${panelOpen ? 'text-violet-100' : 'text-violet-400'}`}>
              {suggestions.length > 0 && `${suggestions.length} analysis`}
              {suggestions.length > 0 && questions.length > 0 && ' · '}
              {questions.length > 0 && `${questions.length} Q&A`}
              {suggestions.length === 0 && questions.length === 0 && 'AI-powered clinical decision support'}
            </p>
          </div>
        </div>
        <span className={panelOpen ? 'text-white' : 'text-violet-400'}>
          {panelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Panel content */}
      {panelOpen && (
        <div className="bg-[#FAFBFF] border-t border-violet-100">

          {/* Tabs */}
          <div className="flex border-b border-[#EEF1FB] bg-white">
            <button
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors border-b-2 ${
                activeTab === 'analysis'
                  ? 'border-violet-600 text-violet-700 bg-violet-50/40'
                  : 'border-transparent text-[#A0AECB] hover:text-[#374563]'
              }`}
            >
              <Brain size={12} /> Analysis
              {suggestions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[9px]">
                  {suggestions.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('ask')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors border-b-2 ${
                activeTab === 'ask'
                  ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                  : 'border-transparent text-[#A0AECB] hover:text-[#374563]'
              }`}
            >
              <MessageSquare size={12} /> Ask Doctor Q&amp;A
              {questions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600 text-[9px]">
                  {questions.length}
                </span>
              )}
            </button>
          </div>

          {/* ── ANALYSIS TAB ── */}
          {activeTab === 'analysis' && (
            <div className="p-4 space-y-4">
              {canGenerate && (
                <div className="flex items-center justify-between bg-white rounded-xl border border-violet-100 px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-xs font-bold text-[#0F1A3A]">Generate New Analysis</p>
                    <p className="text-[10px] text-[#A0AECB] mt-0.5">
                      Gemini AI will analyse this ePCR and return risk level, findings & recommendations.
                    </p>
                  </div>
                  <button
                    id="generate-ai-suggestion-btn"
                    onClick={handleGenerate}
                    disabled={generating}
                    className={`ml-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 ${
                      generating
                        ? 'bg-violet-100 text-violet-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:opacity-90 shadow-md shadow-violet-200 active:scale-95'
                    }`}
                  >
                    {generating ? (
                      <><RefreshCw size={13} className="animate-spin" /> Analysing…</>
                    ) : (
                      <><Zap size={13} /> Analyse</>
                    )}
                  </button>
                </div>
              )}

              {aiError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-medium">{aiError}</p>
                </div>
              )}

              {(fetching || generating) && suggestions.length === 0 && (
                <div className="py-8 text-center flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <RefreshCw size={18} className="animate-spin text-violet-600" />
                  </div>
                  <p className="text-xs text-[#A0AECB] font-medium animate-pulse">
                    {generating ? 'Gemini is analysing the clinical record…' : 'Loading suggestions…'}
                  </p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">
                      Analysis History ({suggestions.length})
                    </p>
                    {fetching && (
                      <span className="flex items-center gap-1 text-[10px] text-violet-400">
                        <RefreshCw size={10} className="animate-spin" /> Syncing…
                      </span>
                    )}
                  </div>
                  {suggestions.map((s, idx) => (
                    <SuggestionCard key={s.id || idx} suggestion={s} isLatest={idx === 0} />
                  ))}
                </div>
              )}

              {!fetching && !generating && suggestions.length === 0 && !aiError && (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mx-auto">
                    <Brain size={20} className="text-violet-300" />
                  </div>
                  <p className="text-xs font-bold text-[#8A97B0]">No AI analysis yet</p>
                  {canGenerate ? (
                    <p className="text-[10px] text-[#A0AECB]">Click "Analyse" to generate Gemini clinical insights.</p>
                  ) : (
                    <p className="text-[10px] text-[#A0AECB]">A Physician or Admin must generate the first analysis.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ASK Q&A TAB ── */}
          {activeTab === 'ask' && (
            <div className="p-4 space-y-4">

              {/* Question input */}
              <div className="bg-white rounded-xl border border-teal-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-bold text-[#0F1A3A] mb-1">Ask a Clinical Question</p>
                  <p className="text-[10px] text-[#A0AECB]">
                    Gemini will answer using this patient's labs, vitals, reports, and history automatically.
                  </p>
                </div>
                <div className="px-3 pb-3">
                  <div className="flex items-end gap-2 bg-[#F7F9FF] rounded-xl border border-[#E5EAF5] px-3 py-2">
                    <textarea
                      ref={textareaRef}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. Can I implant the teeth? Is the patient fit for surgery?"
                      rows={2}
                      className="flex-1 text-xs text-[#374563] bg-transparent resize-none outline-none placeholder-[#B0BACC] leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`shrink-0 p-1.5 rounded-lg border transition-colors ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse border-red-600 shadow-sm'
                          : 'bg-white text-slate-400 border-[#E5EAF5] hover:text-slate-600 hover:bg-slate-50'
                      }`}
                      title={isListening ? "Stop listening" : "Ask using voice"}
                    >
                      {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                    <button
                      id="ai-ask-question-btn"
                      onClick={handleAskQuestion}
                      disabled={!question.trim() || asking}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        !question.trim() || asking
                          ? 'bg-teal-100 text-teal-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:opacity-90 shadow-md active:scale-95'
                      }`}
                    >
                      {asking ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      {asking ? 'Asking…' : 'Ask'}
                    </button>
                  </div>
                  {isListening && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1 px-1 flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Listening… speak freely, pauses are OK — stops after 2.5s silence
                    </p>
                  )}
                  {micError && (
                    <p className="text-[10px] text-red-500 font-medium mt-1 px-1">
                      ⚠ {micError}
                    </p>
                  )}
                  {!isListening && !micError && (
                    <p className="text-[10px] text-[#C0CADF] mt-1.5 px-1">Press Enter to send · Shift+Enter for new line · 🎤 click mic to speak</p>
                  )}
                </div>
              </div>

              {/* Q&A error */}
              {qaError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-medium">{qaError}</p>
                </div>
              )}

              {/* Loading asking state */}
              {asking && (
                <div className="py-6 text-center flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <RefreshCw size={18} className="animate-spin text-teal-600" />
                  </div>
                  <p className="text-xs text-[#A0AECB] font-medium animate-pulse">
                    Gemini is reviewing the case records…
                  </p>
                </div>
              )}

              {/* Q&A history */}
              {questions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#A0AECB]">
                    Q&amp;A History ({questions.length})
                  </p>
                  {questions.map((qa, idx) => (
                    <QuestionAnswerCard key={qa.id || idx} qa={qa} isLatest={idx === 0} />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!asking && questions.length === 0 && !qaError && (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto">
                    <MessageSquare size={20} className="text-teal-300" />
                  </div>
                  <p className="text-xs font-bold text-[#8A97B0]">No questions asked yet</p>
                  <p className="text-[10px] text-[#A0AECB]">
                    Type a clinical question above — Gemini will review all case data automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiSuggestionPanel;
