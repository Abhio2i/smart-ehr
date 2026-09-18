import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Clock, Plus, RefreshCw, X, ChevronUp, AlertTriangle,
  CheckCircle2, Users, Activity, Loader2, Search,
  ClipboardList, ArrowRight, Filter, Bell, Timer,
  TrendingUp, Zap, UserCheck, XCircle, ChevronDown,
  Stethoscope, Building2, Info, Trash2, ChevronRight,
  ListOrdered, BarChart3, Eye
} from 'lucide-react';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtDateTime = (str) => {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('en-CA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
};

const fmtRelative = (str) => {
  if (!str) return '—';
  try {
    const diff = Date.now() - new Date(str).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return '—'; }
};

const fmtCountdown = (expiresAt) => {
  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
};

// ── Config ───────────────────────────────────────────────────────────────────

const PRIORITY_META = {
  URGENT:  { label: 'URGENT',  score: 300, cls: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500',     glow: 'shadow-red-100',    ring: 'ring-red-200' },
  HIGH:    { label: 'HIGH',    score: 200, cls: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-500',   glow: 'shadow-amber-100',  ring: 'ring-amber-200' },
  ROUTINE: { label: 'ROUTINE', score: 100, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', glow: 'shadow-emerald-100', ring: 'ring-emerald-200' },
};

const STATUS_META = {
  WAITING:   { label: 'Waiting',   cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500'      },
  OFFERED:   { label: 'Offered',   cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500'    },
  SCHEDULED: { label: 'Scheduled', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  DECLINED:  { label: 'Declined',  cls: 'bg-rose-50 text-rose-700 border-rose-200',       dot: 'bg-rose-500'      },
  EXPIRED:   { label: 'Expired',   cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500'    },
  REMOVED:   { label: 'Removed',   cls: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400'      },
};

const SERVICE_EMOJI = {
  CARDIOLOGY: '❤️', DENTAL: '🦷', SURGICAL_CARE: '🏥', GENERAL: '🩺',
  ONCOLOGY: '🔬', RADIOLOGY: '💡', ORTHOPEDICS: '🦴', NEUROLOGY: '🧠',
  OBSTETRICS: '🍼', PEDIATRICS: '👶', PSYCHIATRY: '💭', PHYSIOTHERAPY: '🦾',
};

// ── Sub-Components ────────────────────────────────────────────────────────────

/** Modal wrapper — same pattern as Scheduling.jsx */
const Modal = memo(({ open, onClose, title, children, size = 'md', subtitle }) => {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,20,60,0.55)', backdropFilter: 'blur(6px)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col`}
        style={{ boxShadow: '0 32px 80px rgba(26,60,143,0.22)' }}>
        <div className="flex items-start justify-between p-6 border-b border-[#F0F4FC]">
          <div>
            <h2 className="text-base font-bold text-[#0F1A3A]">{title}</h2>
            {subtitle && <p className="text-xs text-[#8A97B0] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} id="modal-close-btn"
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] transition-colors text-[#5A6A8A]">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
});

const Field = ({ label, required, children, hint, error }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-[#5A6A8A] flex items-center gap-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error  && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle size={10}/>{error}</p>}
    {!error && hint && <p className="text-[11px] text-[#A0AECB]">{hint}</p>}
  </div>
);

/** Priority pill badge */
const PriorityBadge = ({ priority, size = 'sm' }) => {
  const m = PRIORITY_META[priority] || PRIORITY_META.ROUTINE;
  const sz = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 ${sz} rounded-full font-bold border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

/** Status pill badge */
const StatusBadge = ({ status, size = 'sm' }) => {
  const m = STATUS_META[status] || STATUS_META.WAITING;
  const sz = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 ${sz} rounded-full font-bold border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
};

/** Stat card for the top row */
const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={18} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-black text-[#0F1A3A] leading-none">{value ?? <span className="text-[#A0AECB]">—</span>}</p>
      <p className="text-xs font-semibold text-[#8A97B0] mt-0.5 truncate">{label}</p>
      {sub && <p className="text-[10px] text-[#A0AECB] mt-0.5">{sub}</p>}
    </div>
  </div>
);

/** Single queue row card */
const QueueCard = memo(({ entry, rank, onSelect, canStaffAction, isPatient }) => {
  const pm = PRIORITY_META[entry.priority] || PRIORITY_META.ROUTINE;
  const isUrgent = entry.priority === 'URGENT';
  const isOffered = entry.status === 'OFFERED';
  const countdown = fmtCountdown(entry.offerExpiresAt);
  const isExpiringSoon = entry.offerExpiresAt &&
    (new Date(entry.offerExpiresAt).getTime() - Date.now()) < 3600000; // < 1h

  return (
    <div
      id={`queue-card-${entry.id}`}
      onClick={() => onSelect(entry)}
      className={`bg-white border rounded-2xl p-4 mb-3 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${
        isUrgent ? 'border-red-200 shadow-red-50' : 'border-[#F0F4FC]'
      } ${isOffered ? 'ring-2 ring-violet-200' : ''}`}
      style={{ boxShadow: isUrgent ? '0 4px 24px rgba(200,16,46,0.08)' : undefined }}
    >
      <div className="flex items-start gap-3">
        {/* Position badge */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm
          ${rank === 1 ? 'bg-brand-blue text-white' : 'bg-[#F0F4FC] text-[#5A6A8A]'}`}>
          {rank}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <PriorityBadge priority={entry.priority} />
            <StatusBadge status={entry.status} />
            {isOffered && countdown && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
                ${isExpiringSoon ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>
                <Timer size={10} />
                {countdown}
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-[#0F1A3A] truncate">{entry.patientName}</p>
          <p className="text-xs text-[#8A97B0] font-medium truncate mt-0.5">
            {SERVICE_EMOJI[entry.serviceType] || '🩺'} {entry.serviceType?.replace(/_/g, ' ')} · {entry.reasonForVisit}
          </p>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-[#A0AECB]">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {fmtRelative(entry.createdAt)}
            </span>
            {entry.estimatedWaitMinutes > 0 && (
              <span className="flex items-center gap-1 text-[#5A6A8A] font-semibold">
                <Timer size={10} />
                ~{entry.estimatedWaitMinutes}m wait
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight size={14} className="text-[#C8D5F0] mt-1 group-hover:text-brand-blue transition-colors shrink-0" />
      </div>
    </div>
  );
});

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WaitlistManagement() {
  const dispatch = useDispatch();
  const role = useSelector(st => st.auth.user?.role);
  const user = useSelector(st => st.auth.user);
  const isPatient  = role === 'PATIENT';
  const canStaff   = ['ADMIN', 'PHYSICIAN', 'PARAMEDIC'].includes(role);
  const canView    = ['ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER', 'QA_REVIEWER'].includes(role);

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab]             = useState('queue');   // 'queue' | 'all' | 'stats'
  const [queue, setQueue]         = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [search, setSearch]       = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterService, setFilterService]   = useState('CARDIOLOGY');
  const [filterFacility, setFilterFacility] = useState('FAC-001');
  const [selectedEntry, setSelectedEntry]   = useState(null);

  // Dynamic dropdown lists
  const [serviceTypes, setServiceTypes] = useState([
    'CARDIOLOGY', 'DENTAL', 'SURGICAL_CARE', 'GENERAL',
    'ONCOLOGY', 'RADIOLOGY', 'ORTHOPEDICS', 'NEUROLOGY',
    'OBSTETRICS', 'PEDIATRICS', 'PSYCHIATRY', 'PHYSIOTHERAPY',
  ]);
  const [facilities, setFacilities] = useState([
    'FAC-001', 'FAC-002', 'FAC-003', 'FAC-004', 'FAC-005',
  ]);

  // Modals
  const [addOpen,    setAddOpen]    = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Form
  const [form, setForm]     = useState({ facilityId: 'FAC-001', serviceType: 'CARDIOLOGY', patientId: '', patientName: '', priority: 'ROUTINE', reasonForVisit: '', notes: '' });
  const [formErr, setFormErr] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Patient Search states
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  const handlePatientSearch = async (val) => {
    setPatientSearchQuery(val);
    if (!val || val.trim().length < 2) {
      setPatientSearchResults([]);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await api.get('/api/admin/patients/search', {
        params: { query: val.trim(), limit: 10 }
      });
      setPatientSearchResults(res.data || []);
    } catch {
      setPatientSearchResults([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = (p) => {
    let resolvedService = '';
    if (p.latestIncidentType) {
      resolvedService = p.latestIncidentType.toUpperCase();
    } else if (p.overviewType) {
      resolvedService = p.overviewType.toUpperCase();
      if (resolvedService === 'OBSTETRIC') resolvedService = 'OBSTETRICS';
    }

    setForm(prev => {
      const updated = {
        ...prev,
        patientId: p.patientId || p.id,
        patientName: p.patientName || p.displayName || 'Demo Patient'
      };
      if (resolvedService && serviceTypes.includes(resolvedService)) {
        updated.serviceType = resolvedService;
      }
      return updated;
    });
    setPatientSearchQuery(`${p.patientName || p.displayName} (${p.patientId || p.id})`);
    setPatientSearchResults([]);
  };

  const handleClearPatientSelection = () => {
    setForm(prev => ({ ...prev, patientId: '', patientName: '' }));
    setPatientSearchQuery('');
    setPatientSearchResults([]);
  };

  const idempotencyKey = useRef(crypto.randomUUID());

  // ── Data Fetch ─────────────────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    if (!canView && !isPatient) return;
    setLoading(true);
    try {
      const res = await api.get('/api/waitlist/queue', {
        params: { facilityId: filterFacility, serviceType: filterService }
      });
      setQueue(res.data?.entries || []);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to load waitlist queue.' }));
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [filterFacility, filterService, canView, isPatient, dispatch]);

  const fetchStats = useCallback(async () => {
    if (isPatient) return;
    setStatsLoading(true);
    try {
      const res = await api.get('/api/waitlist/stats');
      setStats(res.data);
    } catch (e) {
      // non-critical
    } finally {
      setStatsLoading(false);
    }
  }, [isPatient]);

  useEffect(() => {
    fetchQueue();
    fetchStats();
  }, [fetchQueue, fetchStats]);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        // 1. Fetch incident types dynamically from IncidentTypeController
        const typesRes = await api.get('/api/epcr/incident-types');
        if (Array.isArray(typesRes.data) && typesRes.data.length > 0) {
          const mappedTypes = typesRes.data.map(t => t.toUpperCase());
          setServiceTypes(mappedTypes);
          setFilterService(mappedTypes[0]);
          setForm(f => ({ ...f, serviceType: mappedTypes[0] }));
        }
      } catch (e) {
        console.warn('Failed to load incident types dynamically, using fallback list');
      }

      try {
        // 2. Fetch facilities dynamically from SchedulingController
        const facilitiesRes = await api.get('/api/scheduling/facilities');
        if (Array.isArray(facilitiesRes.data) && facilitiesRes.data.length > 0) {
          setFacilities(facilitiesRes.data);
          setFilterFacility(facilitiesRes.data[0]);
          setForm(f => ({ ...f, facilityId: facilitiesRes.data[0] }));
        }
      } catch (e) {
        console.warn('Failed to load active facilities dynamically, using fallback list');
      }
    };

    fetchDropdowns();
  }, []);

  // ── Filtered Queue ─────────────────────────────────────────────────────────

  const filteredQueue = queue.filter(e => {
    const matchSearch = !search || e.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      e.reasonForVisit?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = !filterPriority || e.priority === filterPriority;
    return matchSearch && matchPriority;
  });

  // ── Add to Waitlist ────────────────────────────────────────────────────────

  const validateForm = () => {
    const errs = {};
    if (!form.patientId.trim()) errs.patientId = 'Patient ID is required';
    if (!form.patientName.trim()) errs.patientName = 'Patient name is required';
    if (!form.reasonForVisit.trim()) errs.reasonForVisit = 'Reason for visit is required';
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await api.post('/api/waitlist/entries', form, {
        headers: { 'Idempotency-Key': idempotencyKey.current }
      });
      dispatch(addToast({ type: 'success', message: 'Patient added to waitlist.' }));
      setAddOpen(false);
      setForm(prev => ({
        ...prev,
        patientId: '',
        patientName: '',
        priority: 'ROUTINE',
        reasonForVisit: '',
        notes: ''
      }));
      setPatientSearchQuery('');
      setPatientSearchResults([]);
      idempotencyKey.current = crypto.randomUUID();
      fetchQueue();
      fetchStats();
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to add patient to waitlist.';
      dispatch(addToast({ type: 'error', message: msg }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Accept / Decline Offer ─────────────────────────────────────────────────

  const handleAcceptOffer = async (entryId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/waitlist/entries/${entryId}/accept-offer`);
      dispatch(addToast({ type: 'success', message: 'Offer accepted! Appointment scheduled.' }));
      setDetailOpen(false);
      fetchQueue();
      fetchStats();
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to accept offer.';
      dispatch(addToast({ type: 'error', message: msg }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineOffer = async (entryId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/waitlist/entries/${entryId}/decline-offer`);
      dispatch(addToast({ type: 'success', message: 'Offer declined. You remain in the queue.' }));
      setDetailOpen(false);
      fetchQueue();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to decline offer.' }));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Remove Entry ───────────────────────────────────────────────────────────

  const handleRemove = async (entryId) => {
    if (!window.confirm('Remove this patient from the waitlist?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/waitlist/entries/${entryId}`);
      dispatch(addToast({ type: 'success', message: 'Entry removed from waitlist.' }));
      setDetailOpen(false);
      fetchQueue();
      fetchStats();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to remove entry.' }));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Update Priority ────────────────────────────────────────────────────────

  const handleUpdatePriorityDirect = async (entryId, p) => {
    setActionLoading(true);
    try {
      await api.put(`/api/waitlist/entries/${entryId}/priority`, { priority: p });
      dispatch(addToast({ type: 'success', message: `Priority updated to ${p}.` }));
      setSelectedEntry(prev => ({
        ...prev,
        priority: p,
        priorityScore: PRIORITY_META[p].score
      }));
      fetchQueue();
      fetchStats();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to update priority.' }));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-main)]">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center shadow-lg">
                <ListOrdered size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#0F1A3A] leading-none">Waitlist Management</h1>
                <p className="text-xs text-[#8A97B0] font-medium mt-0.5">Manage Patient Access · Priority Queue</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-waitlist-btn"
              onClick={() => { fetchQueue(); fetchStats(); }}
              disabled={loading}
              className="btn-ghost px-3 py-2 text-xs rounded-xl border border-[#DDE3F0]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {canStaff && (
              <button
                id="add-to-waitlist-btn"
                onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    facilityId: filterFacility,
                    serviceType: filterService,
                    patientId: '',
                    patientName: '',
                    reasonForVisit: '',
                    notes: ''
                  }));
                  setPatientSearchQuery('');
                  setAddOpen(true);
                }}
                className="btn-primary text-xs px-4 py-2 rounded-xl"
              >
                <Plus size={14} />
                Add to Waitlist
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        {!isPatient && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <StatCard
              label="Currently Waiting"
              value={statsLoading ? '…' : stats?.totalWaiting}
              icon={Clock}
              color="bg-gradient-to-br from-blue-500 to-blue-700"
              sub="Active in queue"
            />
            <StatCard
              label="Offers Sent"
              value={statsLoading ? '…' : stats?.totalOffered}
              icon={Bell}
              color="bg-gradient-to-br from-violet-500 to-violet-700"
              sub="Awaiting response"
            />
            <StatCard
              label="Scheduled"
              value={statsLoading ? '…' : stats?.totalScheduled}
              icon={CheckCircle2}
              color="bg-gradient-to-br from-emerald-500 to-emerald-700"
              sub="Converted to appointments"
            />
            <StatCard
              label="Declined / Removed"
              value={statsLoading ? '…' : (stats ? (stats.totalDeclined + stats.totalRemovedOrExpired) : undefined)}
              icon={XCircle}
              color="bg-gradient-to-br from-rose-500 to-rose-700"
              sub="Closed entries"
            />
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      {!isPatient && (
        <div className="shrink-0 px-6 mb-2">
          <div className="flex gap-1 p-1 bg-white rounded-xl border border-[#DDE3F0] w-fit shadow-sm">
            {[
              { key: 'queue', label: 'Queue View', icon: ListOrdered },
              { key: 'stats', label: 'Statistics', icon: BarChart3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                id={`tab-${key}`}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  tab === key
                    ? 'bg-brand-blue text-white shadow-md'
                    : 'text-[#5A6A8A] hover:text-[#0F1A3A] hover:bg-[#F0F4FC]'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Queue Filters ─────────────────────────────────────────────────────── */}
      {(tab === 'queue' || isPatient) && (
        <div className="shrink-0 px-6 mb-3">
          <div className="card-flat p-3 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                id="waitlist-search"
                className="input pl-9 text-xs py-2"
                placeholder="Search by patient name or reason..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Facility */}
            {!isPatient && (
              <select
                id="filter-facility"
                className="select-input text-xs py-2 w-36"
                value={filterFacility}
                onChange={e => { setFilterFacility(e.target.value); }}
              >
                {facilities.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}

            {/* Service Type */}
            <select
              id="filter-service-type"
              className="select-input text-xs py-2 w-44"
              value={filterService}
              onChange={e => { setFilterService(e.target.value); }}
            >
              {serviceTypes.map(s => (
                <option key={s} value={s}>{SERVICE_EMOJI[s] || '🩺'} {s.replace(/_/g, ' ')}</option>
              ))}
            </select>

            {/* Priority filter */}
            <select
              id="filter-priority"
              className="select-input text-xs py-2 w-36"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="URGENT">🔴 URGENT</option>
              <option value="HIGH">🟡 HIGH</option>
              <option value="ROUTINE">🟢 ROUTINE</option>
            </select>

            <button
              id="apply-filters-btn"
              onClick={fetchQueue}
              className="btn-primary text-xs px-4 py-2 rounded-xl"
            >
              <Filter size={12} />
              Apply
            </button>
          </div>
        </div>
      )}

      {/* ── Queue Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">

        {/* QUEUE TAB */}
        {(tab === 'queue' || isPatient) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Queue List */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[#0F1A3A] flex items-center gap-2">
                  <Users size={14} className="text-brand-blue" />
                  Waiting Queue
                  <span className="bg-brand-blue text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {filteredQueue.length}
                  </span>
                </h2>
                <p className="text-[11px] text-[#A0AECB] font-semibold">
                  {SERVICE_EMOJI[filterService]} {filterService.replace(/_/g, ' ')} · {filterFacility}
                </p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={28} className="animate-spin text-brand-blue" />
                  <p className="text-sm text-[#8A97B0] font-medium">Loading queue…</p>
                </div>
              ) : filteredQueue.length === 0 ? (
                <div className="card p-10 text-center">
                  <div className="w-16 h-16 bg-[#F0F4FC] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ClipboardList size={28} className="text-[#C8D5F0]" />
                  </div>
                  <p className="text-sm font-bold text-[#5A6A8A]">No patients in queue</p>
                  <p className="text-xs text-[#A0AECB] mt-1">
                    {search || filterPriority ? 'Try adjusting your filters.' : 'Queue is clear for this service type.'}
                  </p>
                  {canStaff && !search && !filterPriority && (
                    <button
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          facilityId: filterFacility,
                          serviceType: filterService,
                          patientId: '',
                          patientName: '',
                          reasonForVisit: '',
                          notes: ''
                        }));
                        setPatientSearchQuery('');
                        setAddOpen(true);
                      }}
                      className="btn-outline mt-4 text-xs px-4 py-2 mx-auto"
                    >
                      <Plus size={12} />
                      Add First Patient
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {filteredQueue.map((entry, idx) => (
                    <QueueCard
                      key={entry.id}
                      entry={entry}
                      rank={entry.queuePosition || idx + 1}
                      onSelect={(e) => { setSelectedEntry(e); setDetailOpen(true); }}
                      canStaffAction={canStaff}
                      isPatient={isPatient}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right panel — legend + info */}
            <div className="flex flex-col gap-4">
              {/* Priority Legend */}
              <div className="card p-4">
                <p className="text-xs font-bold text-[#0F1A3A] mb-3 flex items-center gap-2">
                  <Zap size={13} className="text-brand-blue" />
                  Priority Legend
                </p>
                <div className="space-y-2">
                  {Object.entries(PRIORITY_META).map(([k, m]) => (
                    <div key={k} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                        <span className="text-xs font-semibold text-[#0F1A3A]">{m.label}</span>
                      </div>
                      <span className="text-[10px] text-[#A0AECB] font-mono">Score {m.score}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#F0F4FC]">
                  <p className="text-[10px] text-[#A0AECB] leading-relaxed">
                    Position is computed live using the ESR index — no stored positions.
                    Ties are broken by earliest registration time (FIFO).
                  </p>
                </div>
              </div>

              {/* Status Legend */}
              <div className="card p-4">
                <p className="text-xs font-bold text-[#0F1A3A] mb-3 flex items-center gap-2">
                  <Activity size={13} className="text-brand-blue" />
                  Status Guide
                </p>
                <div className="space-y-1.5">
                  {Object.entries(STATUS_META).map(([k, m]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${m.dot} shrink-0`} />
                      <span className="text-xs font-semibold text-[#0F1A3A]">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="card-flat p-4">
                <p className="text-xs font-bold text-[#5A6A8A] mb-2 flex items-center gap-2">
                  <Info size={12} />
                  How It Works
                </p>
                <ol className="space-y-2">
                  {[
                    'Patient is added to the queue with a priority.',
                    'When a slot opens, highest-priority patient is offered it atomically.',
                    'Patient has 24 hours to accept or decline.',
                    'On accept, appointment is created automatically.',
                    'On decline or expiry, next patient is offered.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-[#5A6A8A]">
                      <span className="w-4 h-4 rounded-full bg-brand-blue text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && !isPatient && (
          <div className="max-w-4xl">
            <h2 className="text-sm font-bold text-[#0F1A3A] mb-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-brand-blue" />
              Waitlist Statistics
            </h2>

            {statsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-brand-blue" />
              </div>
            ) : !stats ? (
              <div className="card p-10 text-center">
                <p className="text-sm text-[#5A6A8A]">No statistics available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Conversion funnel */}
                <div className="card p-5 md:col-span-2">
                  <p className="text-sm font-bold text-[#0F1A3A] mb-4">Conversion Funnel</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {[
                      { label: 'Added', val: (stats.totalWaiting + stats.totalOffered + stats.totalScheduled + stats.totalDeclined + stats.totalRemovedOrExpired), color: 'bg-blue-500' },
                      { label: 'Offered', val: stats.totalOffered + stats.totalScheduled + stats.totalDeclined, color: 'bg-violet-500' },
                      { label: 'Scheduled', val: stats.totalScheduled, color: 'bg-emerald-500' },
                    ].map((item, i, arr) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="text-center">
                          <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center shadow-md`}>
                            <span className="text-white font-black text-lg">{item.val}</span>
                          </div>
                          <p className="text-[11px] text-[#8A97B0] font-semibold mt-1">{item.label}</p>
                        </div>
                        {i < arr.length - 1 && <ArrowRight size={16} className="text-[#C8D5F0]" />}
                      </div>
                    ))}
                    <div className="ml-auto">
                      <p className="text-3xl font-black text-emerald-600">
                        {stats.totalWaiting + stats.totalOffered + stats.totalScheduled > 0
                          ? Math.round((stats.totalScheduled / (stats.totalWaiting + stats.totalOffered + stats.totalScheduled)) * 100)
                          : 0}%
                      </p>
                      <p className="text-xs text-[#8A97B0]">Conversion rate</p>
                    </div>
                  </div>
                </div>

                {/* By status breakdown */}
                {[
                  { label: 'Currently Waiting',  val: stats.totalWaiting,   color: 'bg-blue-500',    icon: Clock },
                  { label: 'Offers Pending',      val: stats.totalOffered,   color: 'bg-violet-500',  icon: Bell },
                  { label: 'Successfully Scheduled', val: stats.totalScheduled, color: 'bg-emerald-500', icon: CheckCircle2 },
                  { label: 'Declined by Patient', val: stats.totalDeclined,  color: 'bg-rose-500',    icon: XCircle },
                  { label: 'Expired / Removed',   val: stats.totalRemovedOrExpired, color: 'bg-orange-500', icon: Timer },
                ].map(({ label, val, color, icon: Icon }) => (
                  <div key={label} className="card p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-[#0F1A3A]">{val}</p>
                      <p className="text-xs text-[#8A97B0] font-semibold">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Add to Waitlist                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Patient to Waitlist"
        subtitle="Patient will be placed in the queue and notified when a slot becomes available."
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Facility" required>
              <select
                id="add-facility"
                className="select-input text-sm"
                value={form.facilityId}
                onChange={e => setForm(f => ({ ...f, facilityId: e.target.value }))}
              >
                {facilities.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Service Type" required>
              <select
                id="add-service-type"
                className="select-input text-sm"
                value={form.serviceType}
                onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
              >
                {serviceTypes.map(s => <option key={s} value={s}>{SERVICE_EMOJI[s] || '🩺'} {s.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
          </div>

          <div className="space-y-1.5 relative">
            <Field label="Search Patient (Name, Email, or Phone)" required error={formErr.patientId || formErr.patientName}>
              <div className="relative">
                <input
                  id="patient-search-input"
                  placeholder="Type name, email, phone or Patient ID to select..."
                  value={patientSearchQuery}
                  onChange={e => handlePatientSearch(e.target.value)}
                  className="input text-sm pr-16"
                />
                {form.patientId && (
                  <button
                    type="button"
                    onClick={handleClearPatientSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500 hover:text-red-700 bg-white px-1.5 py-0.5 rounded-lg border border-red-200 shadow-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
            </Field>

            {searchingPatients && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl p-3 text-xs text-[#8A97B0] shadow-md">
                <Loader2 size={12} className="animate-spin inline mr-1.5 text-brand-blue" /> Searching...
              </div>
            )}

            {patientSearchResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-[#F0F4FC]">
                {patientSearchResults.map(p => (
                  <div
                    key={p.patientId || p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="p-3 hover:bg-[#F8FAFC] cursor-pointer flex flex-col transition-colors"
                  >
                    <span className="font-bold text-xs text-[#0F1A3A]">
                      {p.patientName || p.displayName || 'Demo Patient'}
                    </span>
                    <span className="text-[10px] text-[#8A97B0] mt-0.5">
                      ID: {p.patientId || p.id} · Phone: {p.patientPhone || p.phone || '—'} · Email: {p.email || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Priority" required
            hint="URGENT = immediate risk. HIGH = significant clinical need. ROUTINE = standard referral.">
            <div className="grid grid-cols-3 gap-2">
              {['URGENT', 'HIGH', 'ROUTINE'].map(p => {
                const m = PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    id={`priority-${p}`}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all font-bold text-xs ${
                      form.priority === p ? `${m.cls} border-current shadow-md` : 'border-[#DDE3F0] text-[#5A6A8A] hover:border-[#A0AECB]'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${m.dot}`} />
                    {p}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Reason for Visit" required error={formErr.reasonForVisit}>
            <textarea
              id="add-reason"
              className={`input text-sm resize-none ${formErr.reasonForVisit ? 'border-red-400' : ''}`}
              rows={3}
              placeholder="Clinical reason or referral details..."
              value={form.reasonForVisit}
              onChange={e => setForm(f => ({ ...f, reasonForVisit: e.target.value }))}
            />
          </Field>

          <Field label="Notes" hint="Optional clinical notes or additional context.">
            <textarea
              id="add-notes"
              className="input text-sm resize-none"
              rows={2}
              placeholder="Optional..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddOpen(false)} className="btn-ghost px-5 py-2">
              Cancel
            </button>
            <button
              id="submit-add-waitlist"
              onClick={handleAdd}
              disabled={submitting}
              className="btn-primary px-6 py-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {submitting ? 'Adding…' : 'Add to Queue'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: Entry Detail                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {selectedEntry && (
        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title="Waitlist Entry Detail"
          subtitle={`ID: ${selectedEntry.id}`}
          size="md"
        >
          <div className="space-y-5">
            {/* Header info */}
            <div className="bg-[#F8FAFF] rounded-xl p-4 flex items-start gap-4 border border-[#DDE3F0]">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center text-white font-black text-lg shadow-md shrink-0">
                {selectedEntry.patientName?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-[#0F1A3A]">{selectedEntry.patientName}</p>
                <p className="text-xs text-[#8A97B0] font-medium">ID: {selectedEntry.patientId}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <PriorityBadge priority={selectedEntry.priority} />
                  <StatusBadge status={selectedEntry.status} />
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-3xl font-black text-brand-blue">#{selectedEntry.queuePosition || '—'}</p>
                <p className="text-[10px] text-[#A0AECB] font-semibold">in queue</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Service Type',     val: `${SERVICE_EMOJI[selectedEntry.serviceType] || '🩺'} ${selectedEntry.serviceType?.replace(/_/g, ' ')}` },
                { label: 'Facility',         val: selectedEntry.facilityId },
                { label: 'Reason for Visit', val: selectedEntry.reasonForVisit, wide: true },
                { label: 'Added',            val: fmtDateTime(selectedEntry.createdAt) },
                { label: 'Est. Wait',        val: selectedEntry.estimatedWaitMinutes > 0 ? `~${selectedEntry.estimatedWaitMinutes} min` : '—' },
                { label: 'Priority Score',   val: selectedEntry.priorityScore },
                { label: 'Notes',            val: selectedEntry.notes || '—', wide: true },
              ].map(({ label, val, wide }) => (
                <div key={label} className={`${wide ? 'col-span-2' : ''} bg-[#F8FAFF] rounded-lg p-3 border border-[#F0F4FC]`}>
                  <p className="text-[10px] text-[#A0AECB] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-[#0F1A3A]">{val || '—'}</p>
                </div>
              ))}
            </div>

            {/* Offer info */}
            {selectedEntry.status === 'OFFERED' && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell size={14} className="text-violet-600" />
                  <p className="text-sm font-bold text-violet-700">Slot Offer Active</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Offered At</p>
                    <p className="text-violet-800 font-bold">{fmtDateTime(selectedEntry.offeredAt)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Expires At</p>
                    <p className={`font-bold ${
                      selectedEntry.offerExpiresAt && new Date(selectedEntry.offerExpiresAt).getTime() - Date.now() < 3600000
                        ? 'text-red-600 animate-pulse'
                        : 'text-violet-800'
                    }`}>{fmtDateTime(selectedEntry.offerExpiresAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled info */}
            {selectedEntry.status === 'SCHEDULED' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-700">Appointment Scheduled</p>
                  <p className="text-xs text-emerald-500">Appointment ID: {selectedEntry.scheduledAppointmentId || '—'}</p>
                </div>
              </div>
            )}

            {/* Staff-only Priority Quick Updater */}
            {canStaff && selectedEntry.status === 'WAITING' && (
              <div className="bg-[#F8FAFF] rounded-xl p-4 border border-[#DDE3F0] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#0F1A3A] flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-brand-blue" />
                    Change Priority
                  </p>
                  {actionLoading && <Loader2 size={12} className="animate-spin text-brand-blue" />}
                </div>
                <div className="flex gap-2">
                  {['ROUTINE', 'HIGH', 'URGENT'].map(p => {
                    const m = PRIORITY_META[p];
                    const isActive = selectedEntry.priority === p;
                    return (
                      <button
                        key={p}
                        id={`quick-priority-${p}`}
                        disabled={actionLoading}
                        onClick={() => handleUpdatePriorityDirect(selectedEntry.id, p)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border-2 text-xs font-bold transition-all duration-200 ${
                          isActive
                            ? `${m.cls} border-current shadow-sm`
                            : 'bg-white border-[#DDE3F0] text-[#5A6A8A] hover:bg-[#F0F4FC] hover:border-[#A0AECB]'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {/* Accept / Decline offer (patient or staff) */}
              {selectedEntry.status === 'OFFERED' && (
                <>
                  <button
                    id="accept-offer-btn"
                    onClick={() => handleAcceptOffer(selectedEntry.id)}
                    disabled={actionLoading}
                    className="btn-primary flex-1"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Accept Offer
                  </button>
                  <button
                    id="decline-offer-btn"
                    onClick={() => handleDeclineOffer(selectedEntry.id)}
                    disabled={actionLoading}
                    className="btn-danger flex-1"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Decline Offer
                  </button>
                </>
              )}

              {canStaff && !['SCHEDULED'].includes(selectedEntry.status) && (
                <button
                  id="remove-entry-btn"
                  onClick={() => handleRemove(selectedEntry.id)}
                  disabled={actionLoading}
                  className="btn-ghost text-red-500 hover:bg-red-50 text-xs px-4 py-2 border border-red-200"
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
