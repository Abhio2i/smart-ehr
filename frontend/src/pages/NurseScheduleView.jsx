import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  User, MapPin, Clock, CheckCircle2, AlertTriangle,
  Activity, Navigation, XCircle, Calendar, ChevronRight,
  WifiOff, FileText, ClipboardList, RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';

const STATUS_BADGES = {
  UNASSIGNED:  { label: 'Unassigned',  cls: 'bg-red-50 text-red-600 border-red-100',      dot: 'bg-red-500',      icon: AlertTriangle },
  ASSIGNED:    { label: 'Assigned',    cls: 'bg-blue-50 text-blue-600 border-blue-100',    dot: 'bg-blue-500',     icon: User },
  EN_ROUTE:    { label: 'En Route',    cls: 'bg-amber-50 text-amber-600 border-amber-100', dot: 'bg-amber-500',    icon: Navigation },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-purple-50 text-purple-600 border-purple-100', dot: 'bg-purple-500',  icon: Activity },
  COMPLETED:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', icon: CheckCircle2 },
  MISSED:      { label: 'Missed',      cls: 'bg-orange-50 text-orange-600 border-orange-100', dot: 'bg-orange-500',   icon: XCircle },
  CANCELLED:   { label: 'Cancelled',   cls: 'bg-gray-100 text-gray-500 border-gray-200',  dot: 'bg-gray-400',     icon: XCircle },
};

const SERVICE_LABELS = {
  WOUND_CARE:            '🩹 Wound Care',
  IV_THERAPY:            '💉 IV Therapy',
  PERSONAL_CARE:         '🤝 Personal Care',
  PALLIATIVE:            '🌿 Palliative',
  POST_SURGICAL:         '🏥 Post-Surgical',
  MEDICATION_MANAGEMENT: '💊 Medication Mgmt.',
  PHYSIOTHERAPY:         '🦾 Physiotherapy',
  MENTAL_HEALTH:         '🧠 Mental Health',
};

// ── Field Action Panel (check-in / checkout) ────────────────────────────────

const FieldPanel = ({ visit, onActionComplete }) => {
  const dispatch = useDispatch();
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState('');
  const [loading, setLoading] = useState(false);
  const isOffline = !navigator.onLine;

  const handleCheckIn = async () => {
    setLoading(true);
    const payload = {
      checkInAt: new Date().toISOString(),
      offlineCreated: isOffline,
    };

    if (isOffline) {
      const { queueHomeCareAction } = await import('../utils/offlineHomecare');
      await queueHomeCareAction('checkin', visit.id, payload);
      dispatch(addToast({ type: 'success', message: 'Checked in locally (Offline — queued for sync)' }));
      onActionComplete();
      setLoading(false);
      return;
    }

    try {
      await api.put(`/api/homecare/visits/${visit.id}/checkin`, payload);
      dispatch(addToast({ type: 'success', message: 'Check-in recorded successfully!' }));
      onActionComplete();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.response?.data?.error || 'Check-in failed.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!notes.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please write clinical notes before checking out.' }));
      return;
    }
    setLoading(true);
    const payload = {
      checkOutAt: new Date().toISOString(),
      notes,
      vitalsRecorded: vitals,
      offlineCreated: isOffline,
    };

    if (isOffline) {
      const { queueHomeCareAction } = await import('../utils/offlineHomecare');
      await queueHomeCareAction('checkout', visit.id, payload);
      dispatch(addToast({ type: 'success', message: 'Checkout recorded locally (Offline — queued for sync)' }));
      onActionComplete();
      setLoading(false);
      return;
    }

    try {
      await api.put(`/api/homecare/visits/${visit.id}/checkout`, payload);
      dispatch(addToast({ type: 'success', message: 'Visit marked as completed!' }));
      onActionComplete();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.response?.data?.error || 'Checkout failed.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 bg-[#F8FAFC] border-t border-[#F0F4FC] rounded-b-2xl space-y-4">
      {isOffline && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 p-3 rounded-xl font-semibold">
          <WifiOff size={14} />
          <span>Offline mode — your actions will auto-sync when connection returns.</span>
        </div>
      )}

      {visit.status === 'ASSIGNED' && (
        <button
          onClick={handleCheckIn}
          disabled={loading}
          className="w-full btn-primary py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          📍 Mark Field Check-In (Arrived)
        </button>
      )}

      {visit.status === 'IN_PROGRESS' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Clinical Vitals</label>
            <input
              placeholder="e.g. BP: 120/80, Temp: 98.6F, HR: 72"
              value={vitals}
              onChange={e => setVitals(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#DDE3F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue bg-white transition-colors placeholder-[#A0AECB]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Clinical Notes *</label>
            <textarea
              placeholder="Record treatment administered, wound details, patient status..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm border border-[#DDE3F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue bg-white transition-colors placeholder-[#A0AECB] resize-none"
            />
          </div>

          <button
            onClick={handleCheckOut}
            disabled={loading}
            className="w-full py-3 rounded-xl shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm tracking-wide transition-all active:scale-[0.99] flex items-center justify-center gap-2"
          >
            ✅ Complete Visit & Check-Out
          </button>
        </div>
      )}

      {(visit.status === 'COMPLETED' || visit.status === 'MISSED' || visit.status === 'CANCELLED') && (
        <div className="space-y-2 text-xs text-[#5A6A8A]">
          {visit.vitalsRecorded && (
            <p><strong>Observed Vitals:</strong> {visit.vitalsRecorded}</p>
          )}
          <p className="flex items-start gap-1.5 pt-1.5 border-t border-[#EEF2FF]">
            <FileText size={14} className="text-[#A0AECB] shrink-0 mt-0.5" />
            <span><strong>Notes:</strong> {visit.visitNotes || 'No notes recorded.'}</span>
          </p>
        </div>
      )}
    </div>
  );
};

// ── Visit Row Card ───────────────────────────────────────────────────────────

const VisitRow = ({ visit, index, onActionComplete }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_BADGES[visit.status] || STATUS_BADGES.ASSIGNED;
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
      {/* Header Row */}
      <div
        className="p-4 cursor-pointer flex items-center gap-4 hover:bg-[#F8FAFC] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-brand-blue flex items-center justify-center text-xs font-bold shrink-0">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#0F1A3A] truncate">
            {SERVICE_LABELS[visit.serviceType] || 'Home Visit'}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[#8A97B0]">
            <span className="flex items-center gap-1 font-bold text-[#0F1A3A] mr-1.5">
              👤 {visit.patientName || visit.patientId}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {visit.community || '—'}
            </span>
            {visit.timeWindow && (
              <span className="flex items-center gap-1 font-semibold text-brand-blue">
                <Clock size={12} /> {visit.timeWindow}
              </span>
            )}
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${cfg.cls} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>

        <ChevronRight
          size={16}
          className="text-[#8A97B0] transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
        />
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <FieldPanel visit={visit} onActionComplete={onActionComplete} />
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NurseScheduleView() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const isOnline = navigator.onLine;

  const fetchSchedule = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/homecare/nurses/${user.id}/schedule`, { params: { date } });
      setVisits(res.data || []);
    } catch {
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, date]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);

  const summary = visits.reduce((a, v) => { a[v.status] = (a[v.status] || 0) + 1; return a; }, {});
  const completed = summary.COMPLETED || 0;
  const total = visits.length;

  return (
    <div className="space-y-6 pb-10 px-6 pt-6 animate-fade-in bg-[#F0F4FC] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">My Daily Schedule</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Visiting Nurse <span className="text-brand-blue">Route Planner</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            {user?.firstName} {user?.lastName} · Review client check-ins and document vitals.
          </p>
        </div>
        <div className="flex gap-2">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
              ⚠️ Offline Mode
            </span>
          )}
          <button
            onClick={fetchSchedule}
            disabled={loading}
            className="btn-ghost border border-[#DDE3F0] bg-white px-3 py-2.5 rounded-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Date Picker + Progress */}
      <div className="bg-white border border-[#EEF2FF] p-5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-5 items-center">
        <div className="flex items-center gap-2.5 px-3 py-2 border border-[#DDE3F0] rounded-xl bg-white w-full md:w-auto">
          <Calendar size={15} className="text-[#A0AECB]" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="text-sm font-semibold text-[#0F1A3A] bg-transparent outline-none cursor-pointer"
          />
        </div>

        {total > 0 && (
          <div className="flex-1 w-full">
            <div className="flex justify-between text-xs text-[#8A97B0] font-semibold mb-1.5">
              <span>Route Completion</span>
              <span>{completed} of {total} visits complete</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-blue to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-[#A0AECB] flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-brand-blue" />
          <span className="text-xs font-black uppercase tracking-widest mt-2">Loading schedule...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && visits.length === 0 && (
        <div className="text-center py-16 bg-white border border-[#EEF2FF] rounded-2xl shadow-sm space-y-4">
          <div className="w-14 h-14 bg-gray-50 text-[#A0AECB] rounded-full flex items-center justify-center mx-auto">
            <ClipboardList size={24} />
          </div>
          <div>
            <p className="text-base font-bold text-[#0F1A3A]">No visits scheduled</p>
            <p className="text-xs text-[#8A97B0] max-w-sm mx-auto mt-1">
              You have no assigned home care visits on this date. Enjoy your day!
            </p>
          </div>
        </div>
      )}

      {/* Visit List */}
      {!loading && visits.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-3.5">
          {visits.map((visit, i) => (
            <VisitRow
              key={visit.id}
              visit={visit}
              index={i}
              onActionComplete={fetchSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
