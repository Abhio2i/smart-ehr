import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BellOff, Check, CheckCheck, Trash2, RefreshCw, X,
  Info, AlertTriangle, CheckCircle, XCircle, ChevronDown, Bell, Clock
} from 'lucide-react';
import client from '../api/client';
import {
  fetchNotifications, markNotificationRead, markAllRead,
  selectNotifications, selectUnreadCount, selectNotifLoading, selectNotifPagination
} from '../store/slices/notificationSlice';

const TYPE_CONFIG = {
  INFO:    { icon: Info,          color: 'text-sky-600',    bg: 'bg-sky-50 border-sky-100',     badge: 'badge badge-blue' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100', badge: 'badge badge-orange' },
  SUCCESS: { icon: CheckCircle,   color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-100', badge: 'badge badge-green' },
  ERROR:   { icon: XCircle,       color: 'text-brand-red',  bg: 'bg-red-50 border-red-100',     badge: 'badge badge-red' },
};
const getConfig = (type) => TYPE_CONFIG[type?.toUpperCase()] || TYPE_CONFIG.INFO;

const formatMessageInline = (message) => {
  if (!message) return null;

  // 1. Bed Expiry pattern
  const bedRegex = /Bed\s+([A-Z0-9\-]+)\s+\(Room\s+(\d+)\)\s+has\s+been\s+([a-z\s]+)\.\s+Patient\s+(.+?)'s\s+allotment\s+has\s+(.+)/i;
  const bedMatch = message.match(bedRegex);
  if (bedMatch) {
    const [_, bedNum, roomNum, statusText, patientName, expiryText] = bedMatch;
    return (
      <span className="leading-relaxed">
        Bed <strong className="text-brand-blue font-bold">{bedNum}</strong> (Room <strong className="text-[#0f1a3a] font-bold">{roomNum}</strong>) has been <strong className="text-amber-600 font-bold">{statusText}</strong>. Patient <strong className="text-[#0f1a3a] font-bold">{patientName}</strong>'s allotment has {expiryText}
      </span>
    );
  }

  // 2. ePCR Created / Submitted pattern
  const epcrRegex = /(?:Record\s+([A-Z0-9\-]+)\s+for\s+patient\s+(.+?)\s+was\s+created\s+by\s+paramedic\s+(.+)|A\s+new\s+ePCR\s+Record\s+#([A-Z0-9\-]+)\s+for\s+patient\s+(.+?)\s+has\s+been\s+submitted\s+by\s+paramedic\s+(.+?)\s+and\s+is\s+now\s+ready\s+for\s+QA\s+review)/i;
  const epcrMatch = message.match(epcrRegex);
  if (epcrMatch) {
    const recordId = epcrMatch[1] || epcrMatch[4];
    const patientName = epcrMatch[2] || epcrMatch[5];
    const paramedicName = epcrMatch[3] || epcrMatch[6];
    const isQA = message.includes('ready for QA review');
    if (isQA) {
      return (
        <span className="leading-relaxed">
          A new ePCR Record <strong className="text-emerald-600 font-bold">#{recordId}</strong> for patient <strong className="text-[#0f1a3a] font-bold">{patientName}</strong> has been submitted by paramedic <strong className="text-[#0f1a3a] font-bold">{paramedicName}</strong> and is now <span className="px-1.5 py-0.5 text-[10px] font-black uppercase bg-violet-50 text-violet-700 rounded border border-violet-100/50">ready for QA review</span>.
        </span>
      );
    }
    return (
      <span className="leading-relaxed">
        Record <strong className="text-emerald-600 font-bold">{recordId}</strong> for patient <strong className="text-[#0f1a3a] font-bold">{patientName}</strong> was created by paramedic <strong className="text-[#0f1a3a] font-bold">{paramedicName}</strong>.
      </span>
    );
  }

  // 3. QA Review Finished pattern
  const qaRegex = /The\s+QA\s+review\s+for\s+patient\s+(.+?)\s+\(Record\s+#([A-Z0-9\-]+)\)\s+has\s+(passed|failed)\s+with\s+a\s+score\s+of\s+(.+?)\.(?:\s+Feedback:\s+(.+))?/i;
  const qaMatch = message.match(qaRegex);
  if (qaMatch) {
    const [_, patientName, recordId, outcome, score, feedback] = qaMatch;
    const passed = outcome.toLowerCase() === 'passed';
    return (
      <span className="leading-relaxed block">
        The QA review for patient <strong className="text-[#0f1a3a] font-bold">{patientName}</strong> (Record <strong className="text-slate-600 font-mono">#{recordId}</strong>) has <strong className={passed ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{outcome}</strong> with a score of <strong className="font-mono text-slate-800">{score}</strong>.
        {feedback && (
          <span className="block mt-1 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs italic text-[#475569]">
            Feedback: "{feedback}"
          </span>
        )}
      </span>
    );
  }

  // 4. Feedback Thread Started / Message Reply patterns
  const feedbackStartRegex = /Feedback\s+started\s+on\s+record\s+([A-Z0-9\-]+|unknown):\s+(.+)/i;
  const feedbackReplyRegex = /(.+?)\s+replied\s+in:\s+(.+)/i;

  const fStartMatch = message.match(feedbackStartRegex);
  const fReplyMatch = message.match(feedbackReplyRegex);

  if (fStartMatch) {
    const [_, recordId, subject] = fStartMatch;
    return (
      <span className="leading-relaxed">
        Feedback started on record <strong className="text-slate-600 font-mono">{recordId}</strong>: <strong className="text-[#0f1a3a] font-bold">{subject}</strong>
      </span>
    );
  }

  if (fReplyMatch) {
    const [_, senderName, subject] = fReplyMatch;
    return (
      <span className="leading-relaxed">
        💬 <strong className="text-brand-blue font-bold">{senderName}</strong> replied in: <span className="text-[#0f1a3a] font-bold">"{subject}"</span>
      </span>
    );
  }

  return <span className="leading-relaxed">{message}</span>;
};

const Notifications = () => {
  const dispatch    = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unreadCount   = useSelector(selectUnreadCount);
  const loading       = useSelector(selectNotifLoading);
  const pagination    = useSelector(selectNotifPagination);

  const [error, setError]   = useState('');
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);

  const loadNotifications = (page = 0) => {
    setCurrentPage(page);
    dispatch(fetchNotifications(page));
  };

  useEffect(() => { loadNotifications(0); }, [dispatch]);

  const handleMarkAsRead = (id) => dispatch(markNotificationRead(id));
  const handleMarkAllAsRead = () => dispatch(markAllRead());

  const deleteNotification = async (id) => {
    try {
      await client.delete(`/api/notifications/${id}`);
      loadNotifications(0);
    } catch { setError('Failed to delete notification.'); }
  };

  const filtered = filter === 'read'   ? notifications.filter(n => n.read)
    : filter === 'unread' ? notifications.filter(n => !n.read)
    : notifications;

  const hasNextPage = currentPage < pagination.totalPages - 1;

  return (
    <div className="space-y-6 p-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Alerts</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Notifications {unreadCount > 0 && <span className="ml-2 text-sm font-black text-white bg-brand-red px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">System alerts and activity updates</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => loadNotifications(0)} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="btn-primary text-sm px-4 py-2.5">
              <CheckCheck size={16} /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-[#F0F4FC] rounded-xl w-fit">
        {['all', 'unread', 'read'].map(f => (
          <button key={f} onClick={() => { setFilter(f); setCurrentPage(0); }}
            className={`relative px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? 'bg-white text-brand-blue shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 text-[9px] font-black bg-brand-red text-white rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-brand-red font-semibold">{error}</p>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg"><X size={16} className="text-brand-red" /></button>
        </div>
      )}

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#F0F4FC] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <BellOff size={40} className="text-[#DDE3F0] mx-auto mb-4" />
          <h3 className="font-black text-[#0F1A3A] text-lg mb-1">No Notifications</h3>
          <p className="text-sm text-[#A0AECB]">You're all caught up. No {filter !== 'all' ? filter + ' ' : ''}notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => {
            const cfg = getConfig(notif.type);
            const Icon = cfg.icon;
            return (
              <div key={notif.id}
                className={`card flex items-start gap-4 p-5 transition-all border-l-4 ${notif.read ? 'opacity-60 border-l-[#DDE3F0]' : 'border-l-brand-blue'}`}>
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                  <Icon size={18} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`font-bold text-sm ${notif.read ? 'text-[#8A97B0]' : 'text-[#0F1A3A]'}`}>
                      {notif.title || 'Notification'}
                    </h3>
                    {notif.type && <span className={cfg.badge}>{notif.type}</span>}
                    {!notif.read && <span className="w-2 h-2 rounded-full bg-brand-blue shrink-0" />}
                  </div>
                  <p className={`text-sm ${notif.read ? 'text-[#8A97B0]/70' : 'text-[#4B5A7A]'}`}>{formatMessageInline(notif.message)}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[#A0AECB]">
                    <Clock size={11} />
                    {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : '—'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!notif.read && (
                    <button onClick={() => handleMarkAsRead(notif.id)} title="Mark as read"
                      className="p-2 rounded-lg bg-[#F0FDF4] text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                      <Check size={14} />
                    </button>
                  )}
                  <button onClick={() => deleteNotification(notif.id)} title="Delete"
                    className="p-2 rounded-lg bg-[#FFF0F3] text-brand-red hover:bg-brand-red hover:text-white transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {hasNextPage && (
            <div className="text-center pt-2">
              <button onClick={() => loadNotifications(currentPage + 1)} disabled={loading}
                className="btn-outline text-sm px-6 py-2.5">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                Load More
              </button>
            </div>
          )}

          {pagination.totalElements > 0 && (
            <p className="text-center text-xs text-[#A0AECB] pt-2">
              Showing {Math.min((currentPage + 1) * pagination.pageSize, pagination.totalElements)} of {pagination.totalElements}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
