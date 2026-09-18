import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Calendar, Clock, Plus, RefreshCw, X, ChevronLeft, ChevronRight,
  User, MapPin, AlertTriangle, CheckCircle2, Loader2, Search,
  Settings2, Plane, Package, ChevronDown, Edit3, Trash2,
  BookOpen, Layers, ArrowRight, Bell, Filter, Grid3X3,
  List, CalendarDays, Stethoscope, Building2, Users, Info
} from 'lucide-react';
import client from '../api/client';
import { useDispatch, useSelector } from 'react-redux';
import { addToast } from '../store/slices/uiSlice';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtDate = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-CA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return str; }
};

const fmtTime = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' }); }
  catch { return str; }
};

const fmtDateTime = (str) => {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('en-CA', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return str; }
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const SLOT_STATUS_META = {
  OPEN:      { label: 'Open',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  BOOKED:    { label: 'Booked',    cls: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-500'   },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-400'    },
  BLOCKED:   { label: 'Blocked',   cls: 'bg-gray-100 text-gray-500 border-gray-200',          dot: 'bg-gray-400'   },
};

const APPT_TYPE_ICONS = {
  GENERAL:       Stethoscope,
  SPECIALIST:    User,
  LAB:           Layers,
  IMAGING:       Grid3X3,
  FOLLOWUP:      RefreshCw,
  EMERGENCY:     AlertTriangle,
};

const APPOINTMENT_TYPES = ['GENERAL','SPECIALIST','LAB','IMAGING','FOLLOWUP','EMERGENCY'];
const SPECIALTIES       = ['Family Medicine','Internal Medicine','Cardiology','Oncology','Radiology','Orthopedics','Neurology','Obstetrics','Pediatrics','Psychiatry'];
const COMMUNITIES       = ["Yellowknife","Behchokǫ̀","Hay River","Fort Smith","Inuvik","Norman Wells","Fort Liard","Dettah","Ndılǫ","Łutselk'e","Gamètì","Wekweètì","Whati","Nahanni Butte","Tsiigehtchic","Fort McPherson","Aklavik","Paulatuk","Sachs Harbour","Tuktoyaktuk","Ulukhaktok","Colville Lake","Fort Good Hope","Tulita","Jean Marie River","Kakisa","Enterprise","Fort Resolution","Hay River Reserve"];

// ── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = memo(({ status }) => {
  const m = SLOT_STATUS_META[status] || SLOT_STATUS_META.OPEN;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
});

// ── Modal Wrapper ──────────────────────────────────────────────────────────────
const Modal = memo(({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,20,60,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
          <h2 className="text-base font-bold text-[#0F1A3A]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
});

// ── Form Field ─────────────────────────────────────────────────────────────────
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

const inputCls   = 'w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue bg-white transition-colors';
const inputErr   = 'w-full px-3 py-2 text-sm border border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 bg-red-50/30 transition-colors';
const selectCls  = inputCls + ' cursor-pointer';
const selectErr  = inputErr + ' cursor-pointer';

// Section header inside a modal
const SectionHead = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-2 pb-2 border-b border-[#F0F4FC] mb-1">
    <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
      <Icon size={14} className="text-brand-blue" />
    </div>
    <div>
      <p className="text-xs font-bold text-[#0F1A3A]">{title}</p>
      {sub && <p className="text-[10px] text-[#A0AECB]">{sub}</p>}
    </div>
  </div>
);

// Slot duration quick-pick chips
const DURATION_OPTS = [10, 15, 20, 30, 45, 60];

// ── Calendar Helper ────────────────────────────────────────────────────────────
const buildCalendar = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = [];
  let day = 1 - firstDay;
  for (let r = 0; r < 6; r++) {
    const row = [];
    for (let c = 0; c < 7; c++, day++) {
      row.push(day >= 1 && day <= daysInMonth ? day : null);
    }
    rows.push(row);
    if (day > daysInMonth) break;
  }
  return rows;
};

// ── Holiday Block Panel ────────────────────────────────────────────────────────
const HolidayBlockPanel = memo(({ providerId, onBlocked }) => {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: 'Annual Leave' });
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('block'); // 'block' | 'unblock'
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  useEffect(() => {
    if (open && mode === 'block') {
      setLoadingAppts(true);
      client.get('/api/scheduling/appointments', { hideToast: true })
        .then(res => setAppointments(Array.isArray(res.data) ? res.data : (res.data?.content || [])))
        .catch(() => setAppointments([]))
        .finally(() => setLoadingAppts(false));
    }
  }, [open, mode]);

  const conflicts = useMemo(() => {
    if (!form.fromDate || !form.toDate || !providerId || mode !== 'block') return [];
    const fromStr = `${form.fromDate}T00:00:00`;
    const toStr = `${form.toDate}T23:59:59`;
    const fromDateObj = new Date(fromStr);
    const toDateObj = new Date(toStr);

    return appointments.filter(a => {
      if (a.providerId !== providerId) return false;
      if (a.status !== 'SCHEDULED') return false;
      const start = new Date(a.scheduledStart);
      return start >= fromDateObj && start <= toDateObj;
    });
  }, [appointments, form.fromDate, form.toDate, providerId, mode]);

  const REASONS = ['Annual Leave', 'Medical Leave', 'Training', 'Conference', 'Emergency', 'Public Holiday', 'Other'];

  const handleSubmit = async () => {
    if (!form.fromDate || !form.toDate) {
      dispatch(addToast({ message: 'Both dates are required', type: 'error' }));
      return;
    }
    if (form.toDate < form.fromDate) {
      dispatch(addToast({ message: '"To" date must be after "From" date', type: 'error' }));
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = mode === 'block'
        ? '/api/scheduling/slots/bulk-block'
        : '/api/scheduling/slots/bulk-unblock';
      const res = await client.post(endpoint, { providerId, ...form });
      const count = res.data?.blockedCount ?? res.data?.unblockedCount ?? res.data?.count ?? '?';
      dispatch(addToast({
        message: mode === 'block'
          ? `${count} slot(s) blocked — provider marked unavailable`
          : `${count} slot(s) unblocked — provider available again`,
        type: 'success'
      }));
      setOpen(false);
      setForm({ fromDate: '', toDate: '', reason: 'Annual Leave' });
      if (onBlocked) onBlocked();
    } catch (e) {
      dispatch(addToast({ message: e?.response?.data?.error || 'Operation failed', type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card p-4 border-l-4 border-amber-400">
        <h3 className="text-xs font-bold text-[#5A6A8A] mb-2 flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-500" /> Provider Availability
        </h3>
        <p className="text-[11px] text-[#8A97B0] mb-3">
          Block or unblock slots for this provider across a date range
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('block'); setOpen(true); }}
            className="flex-1 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
          >
            <X size={12} /> Block Dates
          </button>
          <button
            onClick={() => { setMode('unblock'); setOpen(true); }}
            className="flex-1 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle2 size={12} /> Unblock
          </button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'block' ? '🚫 Block Provider Availability' : '✅ Unblock Provider Availability'}
      >
        <div className="space-y-4">
          {mode === 'block' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                All <strong>OPEN</strong> slots for this provider in the selected range will be set to <strong>BLOCKED</strong>.
                Already-booked appointments will <strong>not</strong> be affected — handle those separately.
              </p>
            </div>
          )}
          {mode === 'block' && conflicts.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-black text-red-800 uppercase tracking-wide">⚠️ Conflict Alert</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    This doctor has <strong>{conflicts.length}</strong> booked appointment(s) during this range.
                    You will need to manually reschedule or cancel these appointments separately:
                  </p>
                </div>
              </div>
              <div className="divide-y divide-red-150 max-h-[150px] overflow-y-auto pr-1">
                {conflicts.map(c => (
                  <div key={c.id} className="py-2 text-[11px] text-red-700 flex justify-between items-center">
                    <div>
                      <p className="font-bold">Patient: {c.patientName || c.patientId}</p>
                      <p className="text-[10px] text-red-600/80">{new Date(c.scheduledStart).toLocaleString()}</p>
                    </div>
                    <span className="font-mono text-[9px] bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                      #{c.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === 'unblock' && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-800">
                All <strong>BLOCKED</strong> slots in this range will be restored to <strong>OPEN</strong>.
                The date range will also be removed from the provider's schedule template exceptions.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="From Date" required>
              <input type="date" className={inputCls} value={form.fromDate}
                onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
            </Field>
            <Field label="To Date" required>
              <input type="date" className={inputCls} value={form.toDate}
                onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
            </Field>
          </div>
          {mode === 'block' && (
            <Field label="Reason">
              <select className={selectCls} value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          )}
          <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`px-5 py-2 rounded-xl text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50 ${
                mode === 'block' ? 'bg-red-500' : 'bg-emerald-600'
              }`}
            >
              {submitting
                ? <Loader2 size={14} className="animate-spin" />
                : mode === 'block' ? <X size={14} /> : <CheckCircle2 size={14} />}
              {mode === 'block' ? 'Block Slots' : 'Restore Slots'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Calendar View Tab
// ═══════════════════════════════════════════════════════════════════════════════
const CalendarTab = ({ selectedOrgId, setSelectedOrgId, organizations, userRole, userOrgId }) => {
  const dispatch = useDispatch();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotFilter, setSlotFilter] = useState('ALL');
  const [searchPatient, setSearchPatient] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providers, setProviders] = useState([]);

  const calendar = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const loadProviders = useCallback(async () => {
    try {
      const res = await client.get('/api/scheduling/providers', { hideToast: true });
      setProviders(Array.isArray(res.data) ? res.data : []);
    } catch { /* silently skip */ }
  }, []);

  const loadSlots = useCallback(async (date) => {
    if (!date) return;
    setLoading(true);
    setSlots([]);
    try {
      const d = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(date).padStart(2,'0')}`;
      const params = { date: d };
      const res = await client.get('/api/scheduling/slots', { params, hideToast: true });
      setSlots(Array.isArray(res.data) ? res.data : (res.data?.content || []));
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { loadProviders(); }, [loadProviders]);
  useEffect(() => { if (selectedDate) loadSlots(selectedDate); }, [selectedDate, loadSlots]);

  const handleDayClick = (day) => {
    if (!day) return;
    setSelectedDate(day);
  };

  const filteredSlots = useMemo(() => {
    return slots.filter(s => {
      if (slotFilter !== 'ALL' && s.status !== slotFilter) return false;
      if (searchPatient && s.patientName && !s.patientName.toLowerCase().includes(searchPatient.toLowerCase())) return false;
      if (providerId && s.providerId !== providerId) return false;
      if (selectedOrgId && s.organizationId !== selectedOrgId) return false;
      return true;
    });
  }, [slots, slotFilter, searchPatient, providerId, selectedOrgId]);

  const slotCounts = useMemo(() => {
    const counts = { OPEN: 0, BOOKED: 0, BLOCKED: 0 };
    filteredSlots.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
    return counts;
  }, [filteredSlots]);

  // ── Book Slot ────────────────────────────────────────────────────────────────
  const [bookForm, setBookForm] = useState({ patientId: '', notes: '' });
  const [booking, setBooking] = useState(false);

  const handleBook = async () => {
    if (!bookForm.patientId.trim()) {
      dispatch(addToast({ message: 'Patient ID is required', type: 'error' }));
      return;
    }
    setBooking(true);
    try {
      await client.post(`/api/scheduling/slots/${selectedSlot.id}/book`, {
        patientId: bookForm.patientId,
        notes: bookForm.notes
      });
      dispatch(addToast({ message: 'Appointment booked successfully!', type: 'success' }));
      setBookingOpen(false);
      setBookForm({ patientId: '', notes: '' });
      loadSlots(selectedDate);
    } catch (e) {
      dispatch(addToast({ message: e?.response?.data?.message || 'Booking failed', type: 'error' }));
    } finally {
      setBooking(false);
    }
  };

  const handleCancelSlot = async (slotId) => {
    try {
      await client.patch(`/api/scheduling/slots/${slotId}/cancel`);
      dispatch(addToast({ message: 'Slot cancelled', type: 'success' }));
      loadSlots(selectedDate);
    } catch {
      dispatch(addToast({ message: 'Could not cancel slot', type: 'error' }));
    }
  };

  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const isToday = (y, m, d) => y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
  const isSelected = (d) => d === selectedDate;

  return (
    <div className="flex gap-5 h-full" style={{ minHeight: 560 }}>
      {/* Left — Mini Calendar */}
      <div className="w-72 shrink-0 flex flex-col gap-4">
        {/* Calendar */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F0F4FC] transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-bold text-[#0F1A3A]">{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#F0F4FC] transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-[#A0AECB] py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendar.flat().map((day, i) => (
              <button
                key={i}
                disabled={!day}
                onClick={() => handleDayClick(day)}
                className={`
                  w-full aspect-square text-xs rounded-lg font-medium transition-all
                  ${!day ? 'invisible' : ''}
                  ${isToday(viewYear, viewMonth, day) ? 'ring-2 ring-brand-blue' : ''}
                  ${isSelected(day) ? 'bg-brand-blue text-white font-bold' : 'hover:bg-[#F0F4FC] text-[#3A4A6B]'}
                `}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {/* Organization Filter */}
        {(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'PARAMEDIC') && (
          <div className="card p-4">
            <h3 className="text-xs font-bold text-[#5A6A8A] mb-3 flex items-center gap-2">
              <Building2 size={13} className="text-brand-blue" /> Filter by Organization
            </h3>
            <select
              className={selectCls}
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              disabled={userRole !== 'ADMIN'}
            >
              {userRole === 'ADMIN' && <option value="">All Organizations</option>}
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Doctor Filter */}
        <div className="card p-4">
          <h3 className="text-xs font-bold text-[#5A6A8A] mb-3 flex items-center gap-2">
            <Stethoscope size={13} className="text-purple-500" /> Filter by Doctor
          </h3>
          <select className={selectCls} value={providerId} onChange={e => setProviderId(e.target.value)}>
            <option value="">All Doctors</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>Dr. {p.fullName || p.name}</option>
            ))}
          </select>
        </div>

        {/* Day Summary */}
        {selectedDate && (
          <div className="card p-4">
            <h3 className="text-xs font-bold text-[#5A6A8A] mb-3">Day Summary</h3>
            <div className="space-y-2">
              {Object.entries(slotCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-xs text-[#5A6A8A] flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${SLOT_STATUS_META[status]?.dot}`} />
                    {SLOT_STATUS_META[status]?.label}
                  </span>
                  <span className="text-sm font-bold text-[#0F1A3A]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Holiday / Leave Blocking ── */}
        {providerId && (
          <HolidayBlockPanel
            providerId={providerId}
            onBlocked={() => selectedDate && loadSlots(selectedDate)}
          />
        )}
      </div>

      {/* Right — Slot List */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0F1A3A]">
              {selectedDate
                ? `${DAYS[new Date(viewYear, viewMonth, selectedDate).getDay()]}, ${MONTHS[viewMonth]} ${selectedDate}, ${viewYear}`
                : 'Select a date to view slots'}
            </h2>
            {selectedDate && <p className="text-xs text-[#8A97B0] mt-0.5">{slots.length} total slots found</p>}
          </div>
          {selectedDate && (
            <button onClick={() => loadSlots(selectedDate)} className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw size={13} /> Refresh
            </button>
          )}
        </div>

        {/* Filters Row */}
        {selectedDate && (
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-[#DDE3F0] bg-white">
              {['ALL','OPEN','BOOKED','BLOCKED'].map(f => (
                <button
                  key={f}
                  onClick={() => setSlotFilter(f)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${slotFilter === f ? 'bg-brand-blue text-white' : 'text-[#5A6A8A] hover:bg-[#F0F4FC]'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                className={`${inputCls} pl-8`}
                placeholder="Search patient name…"
                value={searchPatient}
                onChange={e => setSearchPatient(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Slot Cards */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-[#A0AECB]">
              <CalendarDays size={40} strokeWidth={1.2} />
              <p className="text-sm font-medium">Click a day on the calendar to view appointments</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 size={28} className="animate-spin text-brand-blue" />
              <p className="text-sm text-[#8A97B0]">Loading slots…</p>
            </div>
          ) : filteredSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-[#A0AECB]">
              <Calendar size={36} strokeWidth={1.2} />
              <p className="text-sm font-medium">No slots found for this day</p>
              <p className="text-xs">Try changing the filter or generate slots from the Templates tab</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSlots.map(slot => {
                const TypeIcon = APPT_TYPE_ICONS[slot.appointmentType] || Stethoscope;
                return (
                  <div key={slot.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-brand-blue shrink-0">
                        <TypeIcon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#0F1A3A]">
                            {fmtTime(slot.slotStart)} — {fmtTime(slot.slotEnd)}
                          </span>
                          <StatusBadge status={slot.status} />
                          {slot.appointmentType && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F4FC] text-[#5A6A8A] border border-[#E0E6F0]">
                              {slot.appointmentType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                          <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                            <Stethoscope size={11} className="text-purple-500" />
                            {(() => {
                              const doc = providers.find(p => p.id === slot.providerId);
                              return doc ? `Dr. ${doc.fullName}` : `Doctor (${slot.providerId})`;
                            })()}
                          </span>
                          {slot.patientName && (
                            <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                              <Stethoscope size={11} /> Patient: {slot.patientName}
                            </span>
                          )}
                          {slot.location && (
                            <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                              <MapPin size={11} /> {slot.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {slot.status === 'OPEN' && (
                          <button
                            onClick={() => { setSelectedSlot(slot); setBookingOpen(true); }}
                            className="px-3 py-1.5 rounded-xl bg-brand-blue text-white text-xs font-bold hover:opacity-90 transition-opacity"
                          >
                            Book
                          </button>
                        )}
                        {slot.status === 'OPEN' && (
                          <button
                            onClick={() => handleCancelSlot(slot.id)}
                            className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 text-[#A0AECB] hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {slot.notes && (
                      <p className="text-xs text-[#8A97B0] mt-2 pl-13 italic border-t border-[#F0F4FC] pt-2">{slot.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Book Modal — 2-step wizard ── */}
      <BookingModal
        open={bookingOpen}
        slot={selectedSlot}
        onClose={() => { setBookingOpen(false); setBookForm({ patientId: '', patientName: '', notes: '' }); }}
        onConfirm={handleBook}
        booking={booking}
        bookForm={bookForm}
        setBookForm={setBookForm}
        providers={providers}
      />
    </div>
  );
};

// ── PatientPicker — search patient registry or input manually ───────────────
const PatientPicker = memo(({ value, onChange, error, onNameChange, patientName }) => {
  const [search, setSearch]     = useState('');
  const [patients, setPatients] = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [manual, setManual]     = useState(false);
  const ref = useRef(null);

  // Debounced search query
  useEffect(() => {
    if (manual) return;
    if (!search.trim()) { setPatients([]); return; }
    setLoading(true);
    const delay = setTimeout(() => {
      client.get(`/api/admin/patients/search?query=${encodeURIComponent(search)}`, { hideToast: true })
        .then(r => setPatients(Array.isArray(r.data) ? r.data : []))
        .catch(() => setPatients([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(delay);
  }, [search, manual]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clear = () => {
    onChange('');
    onNameChange('');
    setSearch('');
  };

  return (
    <div ref={ref} className="space-y-2">
      {manual ? (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
              <AlertTriangle size={12}/> Manual Patient Entry Mode
            </span>
            <button type="button" onClick={() => { setManual(false); clear(); }} className="text-xs text-brand-blue font-bold hover:underline">
              Search Patient Registry
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Patient ID (Manual)" required error={error}>
              <input className={inputCls} placeholder="e.g. PAT-999-001" value={value}
                onChange={e => onChange(e.target.value)} />
            </Field>
            <Field label="Patient Name (Manual)">
              <input className={inputCls} placeholder="e.g. Mary Tłı̨chǫ" value={patientName}
                onChange={e => onNameChange(e.target.value)} />
            </Field>
          </div>
        </div>
      ) : value ? (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <User size={15} className="text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F1A3A]">{patientName || value}</p>
              <p className="text-xs text-[#8A97B0] font-medium">Record ID: {value}</p>
            </div>
          </div>
          <button onClick={clear} className="text-xs text-red-500 font-semibold hover:underline">
            Change Patient
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-[#5A6A8A]">Search patient registry</span>
            <button type="button" onClick={() => setManual(true)} className="text-xs text-brand-blue font-bold hover:underline">
              + New / Manual Entry
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB] pointer-events-none" />
            <input
              className={`${error ? inputErr : inputCls} pl-8`}
              placeholder="Search by name, DOB, phone, or record ID…"
              value={search}
              onFocus={() => setOpen(true)}
              onChange={e => { setSearch(e.target.value); setOpen(true); }}
            />
            {loading && <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-brand-blue" />}
          </div>

          {open && search.trim() && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#DDE3F0] rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {patients.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-[#A0AECB]">No patients match "{search}"</p>
                  <button type="button" onClick={() => setManual(true)} className="text-xs text-brand-blue font-bold mt-2 hover:underline">
                    Create manual record instead
                  </button>
                </div>
              ) : (
                patients.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => {
                      onChange(p.patientId || p.id);
                      onNameChange(p.displayName || p.patientName);
                      setOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#F0F4FC] transition-colors border-b border-[#F0F4FC] text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#0F1A3A]">{p.displayName || p.patientName}</p>
                      <p className="text-[11px] text-[#8A97B0]">
                        ID: {p.patientId || p.id} {p.dateOfBirth && `· DOB: ${p.dateOfBirth}`}
                      </p>
                    </div>
                    {p.phone && <span className="text-[10px] text-[#A0AECB] font-medium">{p.phone}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ── BookingModal — 2-step wizard ──────────────────────────────────────────────
const BookingModal = memo(({ open, slot, onClose, onConfirm, booking, bookForm, setBookForm, providers }) => {
  const [step, setStep] = useState(1); // 1=form, 2=confirm
  const [errors, setErrors] = useState({});

  // reset on open
  useEffect(() => { if (open) { setStep(1); setErrors({}); } }, [open]);

  const VISIT_REASONS = [
    'General Checkup', 'Follow-up Visit', 'Specialist Consultation',
    'Lab Results Review', 'Medication Review', 'Emergency Referral',
    'Pre-operative Assessment', 'Post-operative Care', 'Mental Health', 'Other'
  ];

  const validate = () => {
    const e = {};
    if (!bookForm.patientId?.trim()) e.patientId = 'Patient is required';
    if (bookForm.patientId?.trim().length < 3) e.patientId = 'Enter a valid Patient ID (min 3 chars)';
    return e;
  };

  const goNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(2);
  };

  if (!open || !slot) return null;

  const doc = providers.find(p => p.id === slot.providerId);
  const docName = doc ? `Dr. ${doc.fullName}` : `Doctor (${slot.providerId})`;

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment" size="md">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5">
        {[1,2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
              s < step ? 'bg-emerald-500 text-white' : s === step ? 'bg-brand-blue text-white' : 'bg-[#F0F4FC] text-[#A0AECB]'
            }`}>
              {s < step ? <CheckCircle2 size={12}/> : s}
            </div>
            <span className={`text-xs font-medium ${ s === step ? 'text-[#0F1A3A]' : 'text-[#A0AECB]'}`}>
              {s === 1 ? 'Patient Details' : 'Confirm Booking'}
            </span>
            {s < 2 && <div className="w-8 h-px bg-[#E0E6F0] mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* Slot summary banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center">
                <CalendarDays size={18} className="text-brand-blue" />
              </div>
              <div>
                <p className="text-xs text-[#5A6A8A] font-medium">Appointment Slot</p>
                <p className="text-sm font-bold text-[#0F1A3A]">
                  {fmtTime(slot.slotStart)} — {fmtTime(slot.slotEnd)}
                </p>
                {slot.providerId && (
                  <p className="text-[11px] text-[#8A97B0] mt-0.5">
                    Provider: {docName}
                    {slot.facilityId && ` · ${slot.facilityId}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <SectionHead icon={User} title="Patient Information" sub="Select a patient from registry" />

          <PatientPicker
            value={bookForm.patientId}
            patientName={bookForm.patientName}
            error={errors.patientId}
            onChange={id => {
              setBookForm(f => ({ ...f, patientId: id }));
              setErrors({});
            }}
            onNameChange={name => {
              setBookForm(f => ({ ...f, patientName: name }));
            }}
          />

          <SectionHead icon={Stethoscope} title="Visit Details" sub="Reason and any special notes" />

          <Field label="Reason for Visit">
            <select
              className={selectCls}
              value={bookForm.visitReason || ''}
              onChange={e => setBookForm(f => ({ ...f, notes: e.target.value === 'Other' ? '' : e.target.value, visitReason: e.target.value }))}
            >
              <option value="">Select reason…</option>
              {VISIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <Field label="Additional Notes" hint="Travel coordination, language requirements, special needs…">
            <textarea
              className={`${inputCls} resize-none h-20`}
              placeholder="Any special requirements or notes for the care team…"
              value={bookForm.notes || ''}
              onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>

          <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={goNext}
              className="px-5 py-2 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90 flex items-center gap-2">
              Review Booking <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-800">Please review the appointment details before confirming. This slot will be immediately locked for this patient.</p>
          </div>

          {/* Confirmation summary */}
          <div className="space-y-2">
            {[
              { label: 'Patient ID',   value: bookForm.patientId },
              { label: 'Patient Name', value: bookForm.patientName || '—' },
              { label: 'Slot Time',    value: `${fmtTime(slot.slotStart)} — ${fmtTime(slot.slotEnd)}` },
              { label: 'Provider',     value: docName },
              { label: 'Reason',       value: bookForm.visitReason || bookForm.notes || '—' },
            ].map(row => (
              <div key={row.label} className="flex items-start justify-between py-2 border-b border-[#F8FAFF]">
                <span className="text-xs text-[#8A97B0] w-28 shrink-0">{row.label}</span>
                <span className="text-xs font-semibold text-[#0F1A3A] text-right">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
            <button onClick={() => setStep(1)} className="btn-secondary text-sm flex items-center gap-1">
              <ChevronLeft size={13}/> Back
            </button>
            <button
              onClick={onConfirm}
              disabled={booking}
              className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            >
              {booking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirm Booking
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
});

// ── ProviderPicker — staff sees names, not IDs ────────────────────────────
const ROLE_BADGE = {
  PHYSICIAN: 'bg-purple-100 text-purple-700 border border-purple-200',
  PARAMEDIC: 'bg-blue-100 text-blue-700 border border-blue-200',
  ADMIN: 'bg-red-100 text-red-700 border border-red-200',
  MANAGER: 'bg-amber-100 text-amber-700 border border-amber-200'
};

const ProviderPicker = memo(({ value, onChange, error }) => {
  const [providers, setProviders] = useState([]);
  const [search, setSearch]       = useState('');
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setLoading(true);
    client.get('/api/scheduling/providers', { hideToast: true })
      .then(r => setProviders(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = providers.find(p => p.id === value);
  const filtered = providers.filter(p => {
    const q = search.toLowerCase();
    return p.fullName?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  const pick = (p) => { onChange(p.id, p); setSearch(''); setOpen(false); };
  const clear = () => { onChange('', null); setSearch(''); };

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
          error ? 'border-red-300 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/40'
        }`}>
          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <Stethoscope size={13} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#0F1A3A] truncate">Dr. {selected.fullName}</p>
            <p className="text-[11px] text-[#8A97B0] truncate">{selected.email}</p>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-purple-100 text-purple-700 border border-purple-200">Doctor</span>
          <button onClick={clear} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-100 text-[#A0AECB] hover:text-red-500 transition-colors shrink-0">
            <X size={11} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Stethoscope size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB] pointer-events-none" />
          <input
            className={`${error ? inputErr : inputCls} pl-8`}
            placeholder={loading ? 'Loading doctors…' : 'Search doctor by name…'}
            value={search}
            onFocus={() => setOpen(true)}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && !selected && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-[#DDE3F0] rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-[#A0AECB]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">Loading providers…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-[#A0AECB]">No matching staff found</p>
              <p className="text-[11px] text-[#C0C8D8] mt-1">Try searching by name or ask your admin to add them</p>
            </div>
          ) : (
            filtered.map(p => (
              <button key={p.id} onClick={() => pick(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 transition-colors text-left">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-purple-700">
                    {(p.firstName?.[0] || 'D').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F1A3A] truncate">Dr. {p.fullName}</p>
                  <p className="text-[11px] text-[#A0AECB] truncate">{p.email}</p>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-purple-100 text-purple-700 border border-purple-200">Doctor</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});


const TemplateForm = memo(({ form, setForm, editTarget, submitting, onCancel, onSave, toggleDay, DAY_LABELS, userRole, organizations }) => {
  const [errors, setErrors] = useState({});

  // Live slots-per-day preview
  const slotsPreview = useMemo(() => {
    const toMins = t => { const [h,m] = (t||'00:00').split(':').map(Number); return h*60+m; };
    const dur = form.slotDurationMinutes || 30;
    const m = Math.max(0, Math.floor((toMins(form.morningEnd||'12:00') - toMins(form.morningStart||'09:00')) / dur));
    const a = form.includeAfternoon
      ? Math.max(0, Math.floor((toMins(form.afternoonEnd||'17:00') - toMins(form.afternoonStart||'13:00')) / dur))
      : 0;
    return m + a;
  }, [form.morningStart, form.morningEnd, form.afternoonStart, form.afternoonEnd, form.slotDurationMinutes, form.includeAfternoon]);

  const validate = () => {
    const e = {};
    if (!form.providerId?.trim()) e.providerId = 'Provider ID is required';
    if (userRole === 'ADMIN' && !form.organizationId?.trim()) e.organizationId = 'Organization is required';
    if (!form.facilityId?.trim()) e.facilityId = 'Facility ID is required';
    if (!form.startDate) e.startDate = 'Effective From date is required';
    if (form.endDate && form.startDate && form.endDate < form.startDate)
      e.endDate = 'End date must be after start date';
    if (!form.workDays?.length) e.workDays = 'Select at least one working day';
    if (!form.slotDurationMinutes || form.slotDurationMinutes < 5)
      e.slotDurationMinutes = 'Duration must be at least 5 minutes';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave();
  };

  return (
    <div className="space-y-5">
      {/* Provider & Specialty */}
      <div>
        <SectionHead icon={Stethoscope} title="Doctor (Provider)" sub="Search by doctor name — no ID needed" />
        {userRole === 'ADMIN' && (
          <div className="mt-3">
            <Field label="Organization" required error={errors.organizationId}>
              <select
                className={selectCls}
                value={form.organizationId}
                onChange={e => {
                  setForm(f => ({ ...f, organizationId: e.target.value }));
                  setErrors(x => ({ ...x, organizationId: undefined }));
                }}
              >
                <option value="">Select organization…</option>
                {organizations.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Treating Doctor" required error={errors.providerId}>
            <ProviderPicker
              value={form.providerId}
              error={!!errors.providerId}
              onChange={(id, provider) => {
                setForm(f => ({
                  ...f,
                  providerId: id,
                  specialty: provider?.role === 'PHYSICIAN' && !f.specialty ? 'General Practice' : f.specialty
                }));
                setErrors(x => ({...x, providerId: undefined}));
              }}
            />
          </Field>
          <Field label="Specialty">
            <select className={selectCls} value={form.specialty}
              onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}>
              <option value="">Select specialty…</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Appointment Type, Facility, & Location */}
      <div>
        <SectionHead icon={Stethoscope} title="Appointment Settings" sub="Type, facility, and location of care" />
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="Appointment Type">
            <select className={selectCls} value={form.appointmentType}
              onChange={e => setForm(f => ({ ...f, appointmentType: e.target.value }))}>
              {APPOINTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Facility ID" required error={errors.facilityId}>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input className={`${errors.facilityId ? inputErr : inputCls} pl-8`}
                placeholder="e.g. FAC-001, CLINIC-EAST…"
                value={form.facilityId || ''}
                onChange={e => {
                  setForm(f => ({ ...f, facilityId: e.target.value }));
                  setErrors(x => ({ ...x, facilityId: undefined }));
                }} />
            </div>
          </Field>
          <Field label="Room / Location" hint="e.g. Room 301">
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input className={`${inputCls} pl-8`}
                placeholder="Ward / room number…"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          </Field>
        </div>
      </div>

      {/* Effective date range */}
      <div>
        <SectionHead icon={CalendarDays} title="Schedule Period" sub="When is this provider available?" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field label="Effective From" required error={errors.startDate}>
            <input type="date" className={errors.startDate ? inputErr : inputCls}
              value={form.startDate}
              onChange={e => { setForm(f => ({ ...f, startDate: e.target.value })); setErrors(x => ({...x, startDate: undefined})); }} />
          </Field>
          <Field label="Effective Until" error={errors.endDate}
            hint={!errors.endDate ? 'Leave blank for an ongoing schedule' : undefined}>
            <input type="date" className={errors.endDate ? inputErr : inputCls}
              min={form.startDate}
              value={form.endDate}
              onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setErrors(x => ({...x, endDate: undefined})); }} />
          </Field>
        </div>
      </div>

      {/* Working days */}
      <div>
        <SectionHead icon={Clock} title="Working Days & Times" sub="Availability pattern for slot generation" />
        <div className="mt-3 space-y-3">
          <Field label="Working Days" error={errors.workDays}>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(DAY_LABELS).map(([d, label]) => (
                <button key={d} type="button" onClick={() => { toggleDay(Number(d)); setErrors(x => ({...x, workDays: undefined})); }}
                  className={`w-12 h-9 rounded-xl text-xs font-bold transition-all border shadow-sm ${ form.workDays.includes(Number(d))
                    ? 'bg-brand-blue text-white border-brand-blue shadow-blue-200'
                    : 'bg-white text-[#5A6A8A] border-[#DDE3F0] hover:bg-[#F0F4FC]'}`}>
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {/* Morning session */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[11px] font-bold text-amber-700 mb-2 flex items-center gap-1.5">
              🌅 Morning Session
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input type="time" className={inputCls} value={form.morningStart}
                  onChange={e => setForm(f => ({ ...f, morningStart: e.target.value }))} />
              </Field>
              <Field label="End Time">
                <input type="time" className={inputCls} value={form.morningEnd}
                  onChange={e => setForm(f => ({ ...f, morningEnd: e.target.value }))} />
              </Field>
            </div>
          </div>

          {/* Afternoon session toggle */}
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                🌇 Afternoon Session
              </p>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, includeAfternoon: !f.includeAfternoon }))}
                className={`relative w-9 h-5 rounded-full transition-colors ${form.includeAfternoon ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.includeAfternoon ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            {form.includeAfternoon && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time">
                  <input type="time" className={inputCls} value={form.afternoonStart}
                    onChange={e => setForm(f => ({ ...f, afternoonStart: e.target.value }))} />
                </Field>
                <Field label="End Time">
                  <input type="time" className={inputCls} value={form.afternoonEnd}
                    onChange={e => setForm(f => ({ ...f, afternoonEnd: e.target.value }))} />
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slot duration chips */}
      <div>
        <SectionHead icon={Clock} title="Slot Duration" sub="How long is each appointment?" />
        <div className="flex gap-2 flex-wrap mt-3">
          {DURATION_OPTS.map(d => (
            <button key={d} type="button"
              onClick={() => { setForm(f => ({ ...f, slotDurationMinutes: d })); setErrors(x => ({...x, slotDurationMinutes: undefined})); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                form.slotDurationMinutes === d
                  ? 'bg-brand-blue text-white border-brand-blue shadow shadow-blue-200'
                  : 'bg-white text-[#5A6A8A] border-[#DDE3F0] hover:bg-[#F0F4FC]'
              }`}>
              {d} min
            </button>
          ))}
          <div className="relative">
            <input type="number" min="5" max="240" step="5"
              className={`${errors.slotDurationMinutes ? inputErr : inputCls} w-24 text-center`}
              placeholder="Custom"
              value={DURATION_OPTS.includes(form.slotDurationMinutes) ? '' : form.slotDurationMinutes}
              onChange={e => { setForm(f => ({ ...f, slotDurationMinutes: +e.target.value })); setErrors(x => ({...x, slotDurationMinutes: undefined})); }}
            />
          </div>
        </div>
        {errors.slotDurationMinutes && <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertTriangle size={10}/>{errors.slotDurationMinutes}</p>}
      </div>

      {/* Live preview banner */}
      {slotsPreview > 0 && (
        <div className="p-3 rounded-xl bg-brand-blue/5 border border-brand-blue/20 flex items-center gap-3">
          <CalendarDays size={16} className="text-brand-blue shrink-0" />
          <div>
            <p className="text-xs font-bold text-brand-blue">{slotsPreview} slots per working day</p>
            <p className="text-[11px] text-[#8A97B0]">
              {form.workDays.length} day(s)/week × {slotsPreview} = ~{form.workDays.length * slotsPreview * 4} slots/month
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={handleSave} disabled={submitting}
          className="px-5 py-2 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {editTarget ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Schedule Templates Tab
// ═══════════════════════════════════════════════════════════════════════════════
const TemplatesTab = ({ selectedOrgId, setSelectedOrgId, organizations, userRole, userOrgId }) => {
  const dispatch = useDispatch();
  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genTarget, setGenTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);  // template to confirm delete
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    providerId: '', specialty: '', startDate: '', endDate: '',
    slotDurationMinutes: 30, appointmentType: 'GENERAL',
    facilityId: '', location: '', workDays: [1,2,3,4,5],
    morningStart: '09:00', morningEnd: '12:00',
    afternoonStart: '13:00', afternoonEnd: '17:00',
    includeAfternoon: true,
    organizationId: selectedOrgId || ''
  };
  const [form, setForm] = useState(emptyForm);
  const [genForm, setGenForm] = useState({ startDate: '', endDate: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resTemplates, resProviders] = await Promise.all([
        client.get('/api/scheduling/templates', { hideToast: true }),
        client.get('/api/scheduling/providers', { hideToast: true }).catch(() => ({ data: [] }))
      ]);
      setTemplates(Array.isArray(resTemplates.data) ? resTemplates.data : (resTemplates.data?.content || []));
      setProviders(Array.isArray(resProviders.data) ? resProviders.data : []);
    } catch {
      setTemplates([]);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredTemplates = useMemo(() => {
    if (selectedOrgId) {
      return templates.filter(t => t.organizationId === selectedOrgId);
    }
    return templates;
  }, [templates, selectedOrgId]);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (t) => { setEditTarget(t); setForm({ ...emptyForm, ...t }); setModalOpen(true); };

  const handleSave = async () => {
    if (!form.providerId.trim() || !form.startDate) {
      dispatch(addToast({ message: 'Provider ID and Start Date are required', type: 'error' }));
      return;
    }
    setSubmitting(true);
    try {
      if (editTarget) {
        await client.put(`/api/scheduling/templates/${editTarget.id}`, form);
        dispatch(addToast({ message: 'Template updated', type: 'success' }));
      } else {
        await client.post('/api/scheduling/templates', form);
        dispatch(addToast({ message: 'Template created', type: 'success' }));
      }
      setModalOpen(false);
      load();
    } catch (e) {
      dispatch(addToast({ message: e?.response?.data?.message || 'Save failed', type: 'error' }));
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await client.delete(`/api/scheduling/templates/${deleteTarget.id}`);
      dispatch(addToast({ message: `Template for ${deleteTarget.specialty || deleteTarget.providerId} deleted`, type: 'success' }));
      setDeleteTarget(null);
      load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || 'Delete failed';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally { setDeleting(false); }
  };

  const handleGenerate = async () => {
    if (!genForm.startDate || !genForm.endDate) {
      dispatch(addToast({ message: 'Both dates required', type: 'error' }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await client.post(`/api/scheduling/templates/${genTarget.id}/generate`, genForm);
      dispatch(addToast({ message: `Generated ${res.data?.count ?? 'slots'} successfully!`, type: 'success' }));
      setGenOpen(false);
    } catch (e) {
      dispatch(addToast({ message: e?.response?.data?.message || 'Generation failed', type: 'error' }));
    } finally { setSubmitting(false); }
  };

  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      workDays: f.workDays.includes(d) ? f.workDays.filter(x => x !== d) : [...f.workDays, d].sort()
    }));
  };

  const DAY_LABELS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F1A3A]">Schedule Templates</h2>
          <p className="text-xs text-[#8A97B0]">Define provider availability patterns used to auto-generate appointment slots</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {userRole === 'ADMIN' && (
            <select
              className={`${selectCls} text-xs py-1.5 min-w-[200px]`}
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
            >
              <option value="">All Organizations</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {(userRole === 'MANAGER' || userRole === 'PARAMEDIC') && organizations[0] && (
            <span className="text-xs font-bold bg-[#F0F4FC] text-[#3A4A6B] border border-[#DDE3F0] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Building2 size={13} className="text-[#8A97B0]" /> {organizations[0].name}
            </span>
          )}
          <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={openCreate} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} /> New Template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 gap-3 text-[#A0AECB]">
          <Settings2 size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">No templates yet</p>
          <button onClick={openCreate} className="text-xs text-brand-blue font-bold hover:underline">
            + Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map(t => {
            const doc = providers.find(p => p.id === t.providerId);
            const docName = doc ? `Dr. ${doc.fullName}` : `Doctor (${t.providerId})`;
            return (
              <div key={t.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#0F1A3A]">{docName}</span>
                      {t.specialty && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                          {t.specialty}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-brand-blue border border-[#D0DAFF]">
                        {t.appointmentType}
                      </span>
                    </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                      <Clock size={11} /> {t.slotDurationMinutes} min slots
                    </span>
                    <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                      <CalendarDays size={11} /> {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                    </span>
                    {t.location && (
                      <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                        <MapPin size={11} /> {t.location}
                      </span>
                    )}
                  </div>
                  {t.workDays?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {[0,1,2,3,4,5,6].map(d => (
                        <span key={d} className={`w-7 h-5 rounded text-[10px] font-bold flex items-center justify-center ${t.workDays.includes(d) ? 'bg-brand-blue text-white' : 'bg-[#F0F4FC] text-[#A0AECB]'}`}>
                          {DAY_LABELS[d]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setGenTarget(t); setGenOpen(true); }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <CalendarDays size={12} /> Generate
                  </button>
                  <button onClick={() => openEdit(t)} className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] transition-colors text-[#8A97B0]">
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-red-50 text-[#A0AECB] hover:text-red-500 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create / Edit Template Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editTarget ? '✏️ Edit Schedule Template' : '🗓️ New Schedule Template'} size="lg">
        <TemplateForm
          form={form} setForm={setForm}
          editTarget={editTarget}
          submitting={submitting}
          onCancel={() => setModalOpen(false)}
          onSave={handleSave}
          toggleDay={toggleDay}
          DAY_LABELS={DAY_LABELS}
          userRole={userRole}
          organizations={organizations}
        />
      </Modal>


      {/* Generate Slots Modal */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="⚡ Generate Appointment Slots" size="md">
        {genTarget && (() => {
          // Compute expected slot count preview
          const slotsPerDay = (() => {
            if (!genTarget.slotDurationMinutes) return 0;
            const mStart = genTarget.morningStart || '09:00';
            const mEnd   = genTarget.morningEnd   || '12:00';
            const aStart = genTarget.afternoonStart || '13:00';
            const aEnd   = genTarget.afternoonEnd   || '17:00';
            const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
            const morningSlots = Math.floor((toMins(mEnd) - toMins(mStart)) / genTarget.slotDurationMinutes);
            const afternoonSlots = Math.floor((toMins(aEnd) - toMins(aStart)) / genTarget.slotDurationMinutes);
            return morningSlots + afternoonSlots;
          })();
          const rangeDays = (genForm.startDate && genForm.endDate)
            ? Math.max(0, Math.round((new Date(genForm.endDate) - new Date(genForm.startDate)) / 86400000) + 1)
            : 0;
          const workingDays = genTarget.workDays?.length || 5;
          const estimatedDays = Math.round(rangeDays * workingDays / 7);
          const estimatedSlots = estimatedDays * slotsPerDay;

          return (
            <div className="space-y-4">
              {/* Template summary */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Settings2 size={18} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Schedule Template</p>
                    <p className="text-sm font-bold text-[#0F1A3A]">{genTarget.specialty || genTarget.providerId}</p>
                    <p className="text-[11px] text-[#8A97B0]">
                      {genTarget.slotDurationMinutes}min slots · {genTarget.appointmentType}
                      {genTarget.location && ` · ${genTarget.location}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Generate From" required>
                  <input type="date" className={inputCls} value={genForm.startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setGenForm(f => ({ ...f, startDate: e.target.value }))} />
                </Field>
                <Field label="Generate Until" required>
                  <input type="date" className={inputCls} value={genForm.endDate}
                    min={genForm.startDate || new Date().toISOString().split('T')[0]}
                    onChange={e => setGenForm(f => ({ ...f, endDate: e.target.value }))} />
                </Field>
              </div>

              {/* Live slot count preview */}
              {genForm.startDate && genForm.endDate && estimatedSlots > 0 && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3">
                  <CalendarDays size={16} className="text-brand-blue shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-brand-blue">
                      ~{estimatedSlots} slots will be created
                    </p>
                    <p className="text-[11px] text-[#8A97B0]">
                      {rangeDays} calendar days · ~{estimatedDays} working days · {slotsPerDay} slots/day
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800">
                  Duplicate slots are automatically skipped. Dates in the provider’s exception list (holidays) will also be skipped.
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
                <button onClick={() => setGenOpen(false)} className="btn-secondary text-sm">Cancel</button>
                <button onClick={handleGenerate} disabled={submitting || !genForm.startDate || !genForm.endDate}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
                  Generate {estimatedSlots > 0 ? `~${estimatedSlots} Slots` : 'Slots'}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="🗑️ Delete Template" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F1A3A]">Are you sure you want to delete this template?</p>
                <p className="text-xs text-[#8A97B0] mt-1">
                  <span className="font-semibold text-[#5A6A8A]">
                    {deleteTarget.specialty || deleteTarget.appointmentType || 'Template'}
                  </span>
                  {deleteTarget.location && ` · ${deleteTarget.location}`}
                </p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800">
                This will deactivate the template. Existing booked appointments are not affected — only future slot generation will stop.
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2 border-t border-[#F0F4FC]">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Yes, Delete Template
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Travel Bundles Tab
// ═══════════════════════════════════════════════════════════════════════════════
const TravelBundlesTab = ({ selectedOrgId, setSelectedOrgId, organizations, userRole, userOrgId }) => {
  const dispatch = useDispatch();
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const emptyForm = {
    patientId: '', originCommunity: '', travelDate: '',
    returnDate: '', transportType: 'FLIGHT', appointmentIds: '',
    notes: '', requiresEscort: false, escortName: '',
    organizationId: selectedOrgId || ''
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/scheduling/travel-bundles', { hideToast: true });
      setBundles(Array.isArray(res.data) ? res.data : (res.data?.content || []));
    } catch { setBundles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredBundles = useMemo(() => {
    if (selectedOrgId) {
      return bundles.filter(b => b.organizationId === selectedOrgId);
    }
    return bundles;
  }, [bundles, selectedOrgId]);

  const handleCreate = async () => {
    if (!form.patientId.trim() || !form.travelDate || !form.originCommunity || (userRole === 'ADMIN' && !form.organizationId)) {
      dispatch(addToast({ message: 'Patient, travel date, community, and organization are required', type: 'error' }));
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/api/scheduling/travel-bundles', {
        ...form,
        appointmentIds: form.appointmentIds.split(',').map(s => s.trim()).filter(Boolean)
      });
      dispatch(addToast({ message: 'Travel bundle created!', type: 'success' }));
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      dispatch(addToast({ message: e?.response?.data?.message || 'Failed', type: 'error' }));
    } finally { setSubmitting(false); }
  };

  const TRANSPORT_COLORS = {
    FLIGHT:        'bg-blue-100 text-blue-700',
    AIR_AMBULANCE: 'bg-red-100 text-red-700',
    HELICOPTER:    'bg-orange-100 text-orange-700',
    GROUND:        'bg-gray-100 text-gray-600',
    WATER:         'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F1A3A]">Travel Bundles</h2>
          <p className="text-xs text-[#8A97B0]">Coordinate multi-appointment trips for patients traveling from remote NWT communities</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {userRole === 'ADMIN' && (
            <select
              className={`${selectCls} text-xs py-1.5 min-w-[200px]`}
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
            >
              <option value="">All Organizations</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {(userRole === 'MANAGER' || userRole === 'PARAMEDIC') && organizations[0] && (
            <span className="text-xs font-bold bg-[#F0F4FC] text-[#3A4A6B] border border-[#DDE3F0] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Building2 size={13} className="text-[#8A97B0]" /> {organizations[0].name}
            </span>
          )}
          <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} /> New Bundle
          </button>
        </div>
      </div>

      {/* NWT Context Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 flex items-start gap-3">
        <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-blue-800">NWT Medical Travel Coordination</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Patients traveling from {COMMUNITIES.length - 1} remote communities often require air ambulance, helicopter, or chartered flights.
            Bundle multiple specialist appointments within a single Yellowknife hub visit to minimize travel disruption and cost.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 gap-3 text-[#A0AECB]">
          <Plane size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">No travel bundles yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBundles.map(b => (
            <div key={b.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Plane size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#0F1A3A]">Patient: {b.patientName || b.patientId}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TRANSPORT_COLORS[b.transportType] || 'bg-gray-100 text-gray-600'}`}>
                      {b.transportType}
                    </span>
                    {b.requiresEscort && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                        Escort Required
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                      <MapPin size={11} /> From: {b.originCommunity}
                    </span>
                    <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                      <CalendarDays size={11} /> {fmtDate(b.travelDate)}
                      {b.returnDate ? ` → ${fmtDate(b.returnDate)}` : ''}
                    </span>
                    {b.appointments?.length > 0 && (
                      <span className="text-xs text-[#8A97B0] flex items-center gap-1">
                        <Stethoscope size={11} /> {b.appointments.length} appointment{b.appointments.length > 1 ? 's' : ''} bundled
                      </span>
                    )}
                  </div>
                  {b.notes && <p className="text-xs text-[#8A97B0] mt-1 italic">{b.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Bundle Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Travel Bundle" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {userRole === 'ADMIN' && (
              <Field label="Organization" required>
                <select
                  className={selectCls}
                  value={form.organizationId}
                  onChange={e => setForm(f => ({ ...f, organizationId: e.target.value }))}
                >
                  <option value="">Select organization…</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Patient ID" required>
              <input className={inputCls} placeholder="Patient ID" value={form.patientId}
                onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))} />
            </Field>
            <Field label="Origin Community" required>
              <select className={selectCls} value={form.originCommunity}
                onChange={e => setForm(f => ({ ...f, originCommunity: e.target.value }))}>
                <option value="">Select community…</option>
                {COMMUNITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Travel Date" required>
              <input type="date" className={inputCls} value={form.travelDate}
                onChange={e => setForm(f => ({ ...f, travelDate: e.target.value }))} />
            </Field>
            <Field label="Return Date">
              <input type="date" className={inputCls} value={form.returnDate}
                onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} />
            </Field>
            <Field label="Transport Type">
              <select className={selectCls} value={form.transportType}
                onChange={e => setForm(f => ({ ...f, transportType: e.target.value }))}>
                {['FLIGHT','AIR_AMBULANCE','HELICOPTER','GROUND','WATER'].map(t =>
                  <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
            </Field>
            <Field label="Requires Escort?">
              <div className="flex items-center gap-3 h-9">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requiresEscort}
                    onChange={e => setForm(f => ({ ...f, requiresEscort: e.target.checked }))}
                    className="w-4 h-4 rounded accent-brand-blue" />
                  <span className="text-sm text-[#3A4A6B]">Yes, requires escort</span>
                </label>
              </div>
            </Field>
          </div>
          {form.requiresEscort && (
            <Field label="Escort Name">
              <input className={inputCls} placeholder="Escort full name" value={form.escortName}
                onChange={e => setForm(f => ({ ...f, escortName: e.target.value }))} />
            </Field>
          )}
          <Field label="Appointment IDs to Bundle" hint="Comma-separated appointment IDs to include in this travel bundle">
            <input className={inputCls} placeholder="appt-id-1, appt-id-2, appt-id-3"
              value={form.appointmentIds}
              onChange={e => setForm(f => ({ ...f, appointmentIds: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <textarea className={`${inputCls} h-20 resize-none`}
              placeholder="Special requirements, accessibility needs, housing, etc."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
            <button onClick={() => setModalOpen(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleCreate} disabled={submitting}
              className="px-5 py-2 rounded-xl bg-brand-blue text-white text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plane size={14} />}
              Create Bundle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — My Appointments (Staff-view of booked appointments)
// ═══════════════════════════════════════════════════════════════════════════════
const AppointmentsTab = ({ selectedOrgId, setSelectedOrgId, organizations, userRole, userOrgId }) => {
  const dispatch = useDispatch();
  const [appointments, setAppointments] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: PAGE_SIZE };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const [resAppts, resProviders] = await Promise.all([
        client.get('/api/scheduling/appointments', { params, hideToast: true }),
        client.get('/api/scheduling/providers', { hideToast: true }).catch(() => ({ data: [] }))
      ]);
      const data = resAppts.data;
      if (Array.isArray(data)) {
        setAppointments(data);
        setTotal(data.length);
      } else {
        setAppointments(data?.content || []);
        setTotal(data?.totalElements || 0);
      }
      setProviders(Array.isArray(resProviders.data) ? resProviders.data : []);
    } catch {
      setAppointments([]);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const filteredAppointments = useMemo(() => {
    if (selectedOrgId) {
      return appointments.filter(a => a.organizationId === selectedOrgId);
    }
    return appointments;
  }, [appointments, selectedOrgId]);

  const handleCancel = async (id) => {
    try {
      await client.patch(`/api/scheduling/appointments/${id}/cancel`);
      dispatch(addToast({ message: 'Appointment cancelled', type: 'success' }));
      load();
    } catch {
      dispatch(addToast({ message: 'Cancel failed', type: 'error' }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#0F1A3A]">All Appointments</h2>
          <p className="text-xs text-[#8A97B0]">{total} total records</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {userRole === 'ADMIN' && (
            <select
              className={`${selectCls} text-xs py-1.5 min-w-[200px]`}
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
            >
              <option value="">All Organizations</option>
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {(userRole === 'MANAGER' || userRole === 'PARAMEDIC') && organizations[0] && (
            <span className="text-xs font-bold bg-[#F0F4FC] text-[#3A4A6B] border border-[#DDE3F0] px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Building2 size={13} className="text-[#8A97B0]" /> {organizations[0].name}
            </span>
          )}
          <div className="flex rounded-xl overflow-hidden border border-[#DDE3F0]">
            {['ALL','SCHEDULED','COMPLETED','CANCELLED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(0); }}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-brand-blue text-white' : 'bg-white text-[#5A6A8A] hover:bg-[#F0F4FC]'}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={28} className="animate-spin text-brand-blue" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 gap-3 text-[#A0AECB]">
          <BookOpen size={36} strokeWidth={1.2} />
          <p className="text-sm font-medium">No appointments found</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0F4FC] bg-[#F8FAFF]">
                  {['Patient','Provider','Type','Date & Time','Status','Actions'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-[#8A97B0] px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFF]">
                {filteredAppointments.map(a => (
                  <tr key={a.id} className="hover:bg-[#F8FAFF] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#0F1A3A]">
                          {a.patientName && a.patientName !== a.patientId ? a.patientName : 'Unknown Patient'}
                        </span>
                        <span className="text-[10px] text-[#8A97B0] font-medium">
                          {a.patientId}{a.patientPhone ? ` · ${a.patientPhone}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A8A]">
                      {(() => {
                        const doc = providers?.find(p => p.id === a.providerId);
                        return doc ? `Dr. ${doc.fullName}` : (a.providerName || a.providerId);
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-brand-blue">
                        {a.appointmentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A8A] text-xs">{fmtDateTime(a.scheduledStart)}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      {a.status === 'SCHEDULED' && (
                        <button onClick={() => handleCancel(a.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8A97B0]">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="btn-secondary text-xs disabled:opacity-40 flex items-center gap-1">
                  <ChevronLeft size={13} /> Prev
                </button>
                <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
                  className="btn-secondary text-xs disabled:opacity-40 flex items-center gap-1">
                  Next <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT PAGE — Scheduling
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'calendar',    label: 'Calendar',          icon: CalendarDays, desc: 'View & book slots by day' },
  { id: 'templates',  label: 'Schedule Templates', icon: Settings2,    desc: 'Configure provider availability' },
{ id: 'bundles',    label: 'Travel Bundles',     icon: Plane,        desc: 'Coordinate remote patient travel' },
  { id: 'appts',      label: 'All Appointments',   icon: BookOpen,     desc: 'Browse & manage booked visits' },
];

export default function Scheduling() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('calendar');
  const user = useSelector(state => state.auth.user);
  const userRole = user?.role;
  const userOrgId = user?.organizationId;

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(userOrgId || '');

  useEffect(() => {
    if (userRole === 'ADMIN') {
      client.get('/api/organizations?size=100', { hideToast: true })
        .then(res => setOrganizations(res.data?.content || []))
        .catch(() => setOrganizations([]));
    } else if (userOrgId) {
      client.get(`/api/organizations/${userOrgId}`, { hideToast: true })
        .then(res => {
          if (res.data) setOrganizations([res.data]);
        })
        .catch(() => setOrganizations([]));
      setSelectedOrgId(userOrgId);
    }
  }, [userRole, userOrgId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-blue to-indigo-600 flex items-center justify-center shadow-sm">
              <Calendar size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#0F1A3A]">Patient Scheduling</h1>
          </div>
          <p className="text-sm text-[#8A97B0]">
            NWT-aware appointment scheduling — including travel bundling for 33 remote communities
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
          <Bell size={13} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Reminders active — 24h before each appointment</span>
        </div>
      </div>

      {/* Stats Row */}
      <StatsRow />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F0F4FC] p-1 rounded-2xl">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-brand-blue shadow-sm'
                  : 'text-[#8A97B0] hover:text-[#3A4A6B]'
              }`}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'calendar'   && (
          <CalendarTab
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            organizations={organizations}
            userRole={userRole}
            userOrgId={userOrgId}
          />
        )}
        {activeTab === 'templates'  && (
          <TemplatesTab
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            organizations={organizations}
            userRole={userRole}
            userOrgId={userOrgId}
          />
        )}
        {activeTab === 'bundles'    && (
          <TravelBundlesTab
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            organizations={organizations}
            userRole={userRole}
            userOrgId={userOrgId}
          />
        )}
        {activeTab === 'appts'      && (
          <AppointmentsTab
            selectedOrgId={selectedOrgId}
            setSelectedOrgId={setSelectedOrgId}
            organizations={organizations}
            userRole={userRole}
            userOrgId={userOrgId}
          />
        )}
      </div>
    </div>
  );
}

// ── Stats Row ──────────────────────────────────────────────────────────────────
const StatsRow = () => {
  const [stats, setStats] = useState({ openSlots: 0, bookedToday: 0, travelBundles: 0, reminders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await client.get('/api/scheduling/stats', { hideToast: true });
        setStats({ ...stats, ...res.data });
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Open Slots Today', value: stats.openSlots,    icon: Calendar,     color: 'from-blue-500 to-indigo-600' },
    { label: 'Booked Today',     value: stats.bookedToday,  icon: CheckCircle2, color: 'from-emerald-500 to-green-600' },
    { label: 'Travel Bundles',   value: stats.travelBundles,icon: Plane,        color: 'from-violet-500 to-purple-600' },
    { label: 'Pending Reminders',value: stats.reminders,    icon: Bell,         color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-sm shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-[#8A97B0] font-medium">{c.label}</p>
              {loading
                ? <div className="h-5 w-10 bg-[#F0F4FC] rounded animate-pulse mt-1" />
                : <p className="text-xl font-bold text-[#0F1A3A]">{c.value}</p>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
};
