import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import {
  Send, Bot, User, RefreshCw, Sparkles, MessageSquare,
  Heart, Pill, Activity, FileText, HelpCircle, ChevronDown,
  X, Mic, MicOff, Volume2, VolumeX, Zap, Clock, CheckCheck,
  AlertCircle, Info, Stethoscope
} from 'lucide-react';
import client from '../../api/client';
import { logoutUser } from '../../store/slices/authSlice';

/* ─── Typing indicator dots ─── */
const TypingDots = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-2 h-2 rounded-full bg-[#1A3C8F]/40"
        style={{ animation: `chatBotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
      />
    ))}
  </div>
);

/* ─── Suggested prompt chip ─── */
const SuggestionChip = ({ text, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(text)}
    className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#DDE3F0] text-xs font-bold text-[#4B5A7A] hover:border-brand-blue hover:text-brand-blue hover:bg-blue-50/50 transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
  >
    <Icon size={14} className="text-[#A0AECB] group-hover:text-brand-blue transition-colors shrink-0" />
    <span className="text-left leading-tight">{text}</span>
  </button>
);

/* ─── Message bubble ─── */
const MessageBubble = ({ msg, isLast }) => {
  const isBot = msg.role === 'assistant' || msg.role === 'bot';
  const isUser = msg.role === 'user';
  const isError = msg.role === 'error';

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  if (isBot) {
    return (
      <div className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] flex items-center justify-center shrink-0 shadow-lg shadow-brand-blue/20 mt-0.5">
          <Bot size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="inline-block max-w-[85%]">
            <div className="bg-white border border-[#DDE3F0] rounded-2xl rounded-tl-md px-5 py-3.5 shadow-sm">
              <p className="text-sm font-semibold text-[#0F1A3A] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-[#A0AECB] ml-1">{time} • Health Assistant</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 animate-in fade-in duration-300">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle size={18} className="text-red-600" />
        </div>
        <div className="max-w-[85%]">
          <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-md px-5 py-3.5">
            <p className="text-sm font-semibold text-red-700 leading-relaxed">{msg.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // User message
  return (
    <div className="flex items-start gap-3 flex-row-reverse animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-[#4B6FCC] flex items-center justify-center shrink-0 shadow-lg shadow-brand-blue/20 mt-0.5">
        <User size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 space-y-1 flex flex-col items-end">
        <div className="inline-block max-w-[85%]">
          <div className="bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] rounded-2xl rounded-tr-md px-5 py-3.5 shadow-lg shadow-brand-blue/15">
            <p className="text-sm font-semibold text-white leading-relaxed">{msg.content}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mr-1">
          <p className="text-[10px] font-bold text-[#A0AECB]">{time}</p>
          {isLast && <CheckCheck size={12} className="text-brand-blue" />}
        </div>
      </div>
    </div>
  );
};

/* ─── Initial welcome screen ─── */
const WelcomeScreen = ({ userName, onSuggestion }) => {
  const suggestions = [
    { text: 'Explain my latest vital signs', icon: Activity },
    { text: 'What do my lab results mean?', icon: FileText },
    { text: 'Tell me about my current medications', icon: Pill },
    { text: 'What should I monitor with my condition?', icon: Heart },
    { text: 'How can I prepare for my next visit?', icon: Stethoscope },
    { text: 'What are the side effects of my meds?', icon: HelpCircle },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-8">
      {/* Bot avatar */}
      <div className="relative">
        <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] flex items-center justify-center shadow-2xl shadow-brand-blue/30">
          <Bot size={48} className="text-white" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
          <Sparkles size={16} className="text-white" />
        </div>
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-[28px] border-2 border-brand-blue/20 animate-ping" style={{ animationDuration: '3s' }} />
      </div>

      {/* Greeting */}
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black text-[#0F1A3A]">Hi{userName ? `, ${userName}` : ''}! 👋</h3>
        <p className="text-sm font-semibold text-[#4B5A7A] max-w-sm leading-relaxed">
          I'm your personal health assistant. Ask me anything about your health records, medications, or symptoms.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">AI-Powered Health Support</span>
        </div>
      </div>

      {/* Suggestions grid */}
      <div className="w-full max-w-lg space-y-3">
        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-[0.2em] text-center">
          Quick Questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {suggestions.map((s, i) => (
            <SuggestionChip key={i} text={s.text} icon={s.icon} onClick={onSuggestion} />
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 max-w-sm w-full">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-amber-700 leading-relaxed">
          This AI assistant provides general health information only. Always consult your healthcare provider for medical advice.
        </p>
      </div>
    </div>
  );
};

/* ─── Main Chatbot Component ─── */
export default function PatientChatbot({ patientId, records = [], conditions = [], medications = [] }) {
  const dispatch = useDispatch();
  const { t, lang } = useLanguage();
  const user = useSelector(state => state.auth.user);
  const firstName = user?.firstName || user?.name?.split(' ')[0] || '';
  const isPatientSession = user?.role === 'PATIENT' && Boolean(user?.accessToken || user?.patientId);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    setMessages(prev => prev.filter(msg => !(msg.role === 'error' && /forbidden|session has expired/i.test(msg.content))));
    setError(null);
  }, [user?.role, user?.patientId, user?.accessToken]);

  // Build patient context for the AI
  const buildPatientContext = useCallback(() => {
    const ctx = [];
    if (records.length > 0) {
      const latest = records[0];
      ctx.push(`Latest clinical record: ${latest.diagnosis || 'No diagnosis'} on ${new Date(latest.incidentDateTime || latest.createdAt).toLocaleDateString()}`);
    }
    if (conditions.length > 0) {
      ctx.push(`Known conditions: ${conditions.slice(0, 3).map(c => c.conditionName || c.name).join(', ')}`);
    }
    if (medications.length > 0) {
      ctx.push(`Current medications: ${medications.slice(0, 3).map(m => m.medicationName || m.name).join(', ')}`);
    }
    return ctx.join('. ');
  }, [records, conditions, medications]);

  const sendMessage = useCallback(async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    setInput('');
    setError(null);
    setShowSuggestions(false);

    if (!isPatientSession) {
      const errText = 'Please log in through the Patient tab to use the health assistant.';
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'error',
        content: errText,
        timestamp: new Date().toISOString(),
      }]);
      setError(errText);
      return;
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const payload = {
        message: text,
        conversationId,
      };

      const res = await client.post('/api/chat/message', payload, { hideToast: true });
      const data = res.data;

      // Extract response content from various possible response shapes
      const responseText =
        data?.reply ||
        data?.response ||
        data?.message ||
        data?.content ||
        data?.answer ||
        (typeof data === 'string' ? data : null) ||
        'I received your message. How else can I help you?';

      // Update conversationId from response if not set
      if (!conversationId && data?.conversationId) {
        setConversationId(data.conversationId);
      }

      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (err) {
      const status = err.response?.status;
      let errText = 'I\'m having trouble connecting right now. Please try again in a moment.';

      if (status === 401) {
        // Session expired — log the patient out immediately
        dispatch(logoutUser());
        errText = 'Your session has expired. Please log in again to continue.';
      } else if (status === 404) {
        errText = 'The chat service is not available at the moment. Please contact support if this persists.';
      } else if (status === 403) {
        errText = err.response?.data?.message || 'This chat is only available from the patient portal.';
      } else if (!err.response) {
        errText = 'Network connection issue. Please check your internet connection.';
      } else if (err.response?.data?.message) {
        errText = err.response.data.message;
      }

      const errMsg = {
        id: `err-${Date.now()}`,
        role: 'error',
        content: errText,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
      setError(errText);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, conversationId, isPatientSession]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setInput('');
  };

  const inlineSuggestions = [
    { text: 'Explain my vitals', icon: Activity },
    { text: 'My medications', icon: Pill },
    { text: 'Upcoming care tips', icon: Heart },
  ];

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Inject animation keyframes */}
      <style>{`
        @keyframes chatBotBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      <div className="flex flex-col h-full bg-gradient-to-b from-[#F8FAFF] to-white rounded-[28px] border border-[#DDE3F0] shadow-xl overflow-hidden" style={{ minHeight: '600px', maxHeight: '80vh' }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#0F1A3A] to-[#1A3C8F] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">Health Assistant</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">AI-Powered • Always Available</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <button
                onClick={clearConversation}
                title="New Conversation"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15">
              <Sparkles size={12} className="text-yellow-300" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">AI</span>
            </div>
          </div>
        </div>

        {/* ── Messages area ── */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#DDE3F0 transparent' }}
        >
          {!hasMessages ? (
            <WelcomeScreen userName={firstName} onSuggestion={sendMessage} />
          ) : (
            <>
              {messages.map((msg, idx) => (
                <MessageBubble key={msg.id || idx} msg={msg} isLast={idx === messages.length - 1 && msg.role === 'user'} />
              ))}
              {isLoading && (
                <div className="flex items-start gap-3 animate-in fade-in duration-200">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] flex items-center justify-center shrink-0 shadow-lg shadow-brand-blue/20 mt-0.5">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="bg-white border border-[#DDE3F0] rounded-2xl rounded-tl-md shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ── Quick suggestions row (shown when conversation started) ── */}
        {hasMessages && !isLoading && (
          <div className="px-6 py-2 border-t border-[#F0F4FC] shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider shrink-0">Quick:</span>
              {inlineSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFF] border border-[#EEF2FF] text-[10px] font-black text-[#4B5A7A] hover:border-brand-blue hover:text-brand-blue hover:bg-blue-50 transition-all shrink-0 uppercase tracking-wider"
                >
                  <s.icon size={11} />
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="px-4 py-4 border-t border-[#DDE3F0] bg-white/80 backdrop-blur-sm shrink-0">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your health question here…"
                rows={1}
                disabled={isLoading}
                className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-3.5 text-sm font-semibold text-[#0F1A3A] placeholder:text-[#A0AECB] focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue/40 transition-all resize-none disabled:opacity-50"
                style={{ minHeight: '52px', maxHeight: '120px' }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
              {input && (
                <button
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-[#A0AECB] hover:text-[#4B5A7A] transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] flex items-center justify-center text-white shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none shrink-0"
            >
              {isLoading ? (
                <RefreshCw size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          <p className="text-center text-[9px] font-bold text-[#C0CADF] uppercase tracking-wider mt-2.5">
            Press Enter to send • Shift+Enter for new line • Not medical advice
          </p>
        </div>
      </div>
    </>
  );
}
