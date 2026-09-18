import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { MessageSquare, Plus, RefreshCw, X, Send, Trash2, ChevronDown } from 'lucide-react';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchRecords, selectRecords } from '../store/slices/epcrSlice';
import { fetchQaReviews, selectReviews } from '../store/slices/qaSlice';
import {
  fetchFeedbackThreads, createFeedbackThread, addFeedbackMessage,
  updateFeedbackStatus, deleteFeedbackThread,
  selectFeedbackThreads, selectFeedbackLoading
} from '../store/slices/feedbackSlice';

const STATUS_BADGE = {
  OPEN: 'badge badge-blue',
  CLOSED: 'badge badge-gray',
  RESOLVED: 'badge badge-green',
  PENDING: 'badge badge-orange',
};

const asList = d => Array.isArray(d) ? d : (d?.content || []);

const formatRole = (role) => {
  if (!role) return '';
  switch (role.toUpperCase()) {
    case 'ADMIN': return 'Admin';
    case 'MANAGER': return 'Manager';
    case 'PARAMEDIC': return 'Paramedic';
    case 'PHYSICIAN': return 'Physician';
    case 'QA_REVIEWER': return 'QA Reviewer';
    case 'VIEWER': return 'Viewer';
    case 'PATIENT': return 'Patient';
    default: return role;
  }
};

const formatSender = (msg, currentUser, thread, records, qaReviews, threads) => {
  const isMe = msg.senderId === (currentUser?.userId || currentUser?.id);
  
  let role = '';
  let name = msg.senderName || '';
  
  if (name.includes(':')) {
    const parts = name.split(':');
    role = parts[0].trim();
    name = parts.slice(1).join(':').trim();
  }
  
  if (!role) {
    if (isMe) {
      role = formatRole(currentUser?.role);
    } else if (thread && records) {
      const linkedRecord = records.find(r => r.id === thread.patientCareRecordId);
      if (linkedRecord && (msg.senderId === linkedRecord.submittedBy || msg.senderId === linkedRecord.paramedicsId)) {
        role = 'Paramedic';
      } else {
        role = 'QA Reviewer';
      }
    }
  }

  const isPlaceholder = (n) => {
    if (!n) return true;
    const lower = n.toLowerCase();
    return lower === 'user' || lower === 'reviewer' || lower === 'qa reviewer' || lower === 'paramedic' || lower === 'participant';
  };
  
  if (isPlaceholder(name)) {
    if (isMe) {
      name = currentUser?.fullName || (currentUser?.firstName && currentUser?.lastName ? `${currentUser.firstName} ${currentUser.lastName}` : (currentUser?.name || currentUser?.username || 'You'));
    } else {
      // 1. Look through all messages in all threads to see if we resolved a real name for this senderId before
      let foundName = '';
      const allThreads = Array.isArray(threads) ? threads : (threads?.content || []);
      for (const t of allThreads) {
        if (t.messages) {
          for (const m of t.messages) {
            if (m.senderId === msg.senderId && m.senderName) {
              let mName = m.senderName;
              if (mName.includes(':')) {
                mName = mName.split(':').slice(1).join(':').trim();
              }
              if (!isPlaceholder(mName)) {
                foundName = mName;
                break;
              }
            }
          }
        }
        if (foundName) break;
      }
      
      if (foundName) {
        name = foundName;
      } else if (thread) {
        const linkedRecord = records?.find(r => r.id === thread.patientCareRecordId);
        const linkedReview = qaReviews?.find(r => r.recordId === thread.patientCareRecordId || r.patientCareRecordId === thread.patientCareRecordId);
        
        if (role === 'Paramedic') {
          const recordBySender = records?.find(r => r.paramedicsId === msg.senderId || r.submittedBy === msg.senderId);
          name = recordBySender?.paramedicsName || recordBySender?.submittedByName || linkedRecord?.paramedicsName || linkedRecord?.submittedByName || 'Paramedic';
        } else if (role === 'QA Reviewer') {
          const reviewBySender = qaReviews?.find(r => r.reviewerId === msg.senderId);
          name = reviewBySender?.reviewerName || linkedReview?.reviewerName || linkedRecord?.qaApprovedByName || 'Reviewer';
        } else if (linkedRecord && (msg.senderId === linkedRecord.submittedBy || msg.senderId === linkedRecord.paramedicsId)) {
          name = linkedRecord.paramedicsName || linkedRecord.submittedByName || 'Paramedic';
        } else if (linkedReview && msg.senderId === linkedReview.reviewerId) {
          name = linkedReview.reviewerName || 'Reviewer';
        } else {
          // General lookup in reviews
          const reviewBySender = qaReviews?.find(r => r.reviewerId === msg.senderId);
          if (reviewBySender?.reviewerName) {
            name = reviewBySender.reviewerName;
            role = 'QA Reviewer';
          }
        }
      }
    }
  }

  // Fallback to avoid showing placeholder under any circumstances
  if (isPlaceholder(name)) {
    name = role || 'Participant';
  }
  
  const displayName = isMe ? `${name} (You)` : name;
  if (role && name === role) {
    return isMe ? `${role} (You)` : role;
  }
  return role ? `${role}: ${displayName}` : displayName;
};


const FeedbackThreads = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const user = useSelector(selectUser);
  const threads = useSelector(selectFeedbackThreads);
  const loading = useSelector(selectFeedbackLoading);
  const records = useSelector(selectRecords);
  const qaReviews = useSelector(selectReviews);

  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(location.state?.expandThreadId || null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msgInputs, setMsgInputs] = useState({});
  const [createForm, setCreateForm] = useState({ patientCareRecordId: '', subject: '' });

  useEffect(() => {
    dispatch(fetchFeedbackThreads());
    dispatch(fetchRecords({ page: 0, size: 20 }));
    dispatch(fetchQaReviews({ page: 0, size: 200 }));
  }, [dispatch]);

  useEffect(() => {
    if (location.state?.expandThreadId) {
      const timer = setTimeout(() => {
        setExpandedId(location.state.expandThreadId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleCreate = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(createFeedbackThread({ patientCareRecordId: createForm.patientCareRecordId || undefined, userId: user?.userId || user?.id, subject: createForm.subject, messages: [], status: 'OPEN' })).unwrap();
      dispatch(addToast({ type: 'success', message: 'Thread created' }));
      setIsCreateOpen(false); setCreateForm({ patientCareRecordId: '', subject: '' });
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create thread.' })); }
    finally { setIsSubmitting(false); }
  };

  const sendMessage = async threadId => {
    const msg = msgInputs[threadId]?.trim();
    if (!msg) return;
    try {
      await dispatch(addFeedbackMessage({ threadId, message: msg })).unwrap();
      setMsgInputs(p => ({ ...p, [threadId]: '' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to send message.' })); }
  };

  const updateStatus = async (threadId, status) => {
    try { await dispatch(updateFeedbackStatus({ threadId, status })).unwrap(); }
    catch { dispatch(addToast({ type: 'error', message: 'Failed to update status.' })); }
  };

  const deleteThread = async id => {
    if (!window.confirm('Delete this thread?')) return;
    try { await dispatch(deleteFeedbackThread(id)).unwrap(); if (expandedId === id) setExpandedId(null); }
    catch { dispatch(addToast({ type: 'error', message: 'Failed to delete.' })); }
  };

  const list = asList(threads).filter(t => {
    if (filter === 'open') return t.status === 'OPEN';
    if (filter === 'mine') return t.userId === (user?.userId || user?.id);
    return true;
  });

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Communication</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Feedback <span className="text-brand-blue">Threads</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Peer-to-peer clinical communication channels</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => dispatch(fetchFeedbackThreads())} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> New Thread
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-[#F0F4FC] rounded-xl w-fit">
        {[{ id: 'all', label: 'All Threads' }, { id: 'open', label: 'Open' }, { id: 'mine', label: 'My Threads' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f.id ? 'bg-white text-brand-blue shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Threads */}
      {loading && list.length === 0 ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-[#F0F4FC] rounded-2xl animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="card p-16 text-center">
          <MessageSquare size={40} className="text-[#DDE3F0] mx-auto mb-4" />
          <h3 className="font-black text-[#0F1A3A] text-lg mb-1">No Threads</h3>
          <p className="text-sm text-[#A0AECB]">No feedback threads found. Start a new discussion.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(thread => {
            const isExpanded = expandedId === thread.id;
            return (
              <div key={thread.id} className={`card overflow-hidden border-l-4 transition-all ${isExpanded ? 'border-l-brand-blue' : 'border-l-[#DDE3F0]'}`}>
                {/* Thread Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : thread.id)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isExpanded ? 'bg-brand-blue text-white' : 'bg-[#EEF2FF] text-brand-blue'}`}>
                      <MessageSquare size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className={`font-bold text-sm ${isExpanded ? 'text-brand-blue' : 'text-[#0F1A3A]'}`}>{thread.subject || 'Untitled Thread'}</h3>
                        <span className={STATUS_BADGE[thread.status?.toUpperCase()] || 'badge badge-gray'}>{thread.status || 'OPEN'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#A0AECB]">
                        <span>{thread.messages?.length || 0} messages</span>
                        <span>·</span>
                        <span>{thread.createdAt ? new Date(thread.createdAt).toLocaleDateString() : '—'}</span>
                        {thread.patientCareRecordId && <span className="badge badge-blue">Record linked</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 p-1 bg-[#F0F4FC] rounded-lg">
                      {['OPEN', 'RESOLVED', 'CLOSED'].map(s => (
                        <button key={s} onClick={() => updateStatus(thread.id, s)}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${thread.status === s ? 'bg-white text-brand-blue shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => deleteThread(thread.id)}
                      className="p-2 rounded-lg text-[#A0AECB] hover:bg-red-50 hover:text-brand-red transition-all">
                      <Trash2 size={15} />
                    </button>
                    <ChevronDown size={16} className={`text-[#A0AECB] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Messages */}
                {isExpanded && (
                  <div className="border-t border-[#F0F4FC]">
                    <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto bg-[#F8FAFF]">
                      {(!thread.messages || thread.messages.length === 0) ? (
                        <p className="text-center text-sm text-[#A0AECB] py-8">No messages yet. Start the conversation.</p>
                      ) : thread.messages.map((msg, i) => {
                        const isMe = msg.senderId === (user?.userId || user?.id);
                        return (
                          <div key={msg.messageId || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMe ? 'bg-brand-blue text-white' : 'bg-white border border-[#DDE3F0] text-[#0F1A3A]'}`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold ${isMe ? 'text-blue-100' : 'text-brand-blue'}`}>
                                  {formatSender(msg, user, thread, records, qaReviews, threads)}
                                </span>
                                <span className={`text-xs ${isMe ? 'text-blue-100/60' : 'text-[#A0AECB]'}`}>
                                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>
                              <p className="text-sm">{msg.message}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {(thread.status === 'RESOLVED' || thread.status === 'CLOSED') ? (
                      <div className="p-4 border-t border-[#F0F4FC] text-center bg-[#F8FAFF]">
                        <p className="text-sm font-semibold text-[#8A97B0]">
                          This thread is {thread.status.toLowerCase()}. New messages cannot be sent.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 border-t border-[#F0F4FC] flex gap-3">
                        <input
                          value={msgInputs[thread.id] || ''}
                          onChange={e => setMsgInputs(p => ({ ...p, [thread.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(thread.id)}
                          placeholder="Type a message… (Enter to send)"
                          className="input py-2.5 text-sm flex-1"
                        />
                        <button onClick={() => sendMessage(thread.id)}
                          className="w-10 h-10 bg-brand-blue text-white rounded-xl flex items-center justify-center hover:bg-brand-blue-dark transition-all shrink-0">
                          <Send size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0]">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <MessageSquare size={20} />
                </div>
                <h2 className="font-black text-[#0F1A3A] text-lg">New Thread</h2>
              </div>
              <button onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Subject *</label>
                <input required value={createForm.subject} onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
                  placeholder="e.g. Protocol clarification for case #XYZ" className="input py-2.5 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Link to Record (optional)</label>
                <select value={createForm.patientCareRecordId} onChange={e => setCreateForm({ ...createForm, patientCareRecordId: e.target.value })} className="input py-2.5 text-sm">
                  <option value="">No record linked</option>
                  {records.map(r => <option key={r.id} value={r.id}>{r.patientName || 'Anonymous'} — #{r.id?.substring(0, 8).toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                  {isSubmitting ? 'Creating…' : 'Create Thread'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackThreads;
