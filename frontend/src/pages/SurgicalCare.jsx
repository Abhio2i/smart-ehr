import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useSelector, useDispatch } from 'react-redux';
import {
  Scissors, Calendar, Clock, User, AlertTriangle, CheckCircle2,
  XCircle, Activity, Plus, RefreshCw, ChevronRight,
  ClipboardList, Heart, Thermometer, Wind, Pill,
  Stethoscope, Shield, Search, X
} from 'lucide-react';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ─── Badge / Status Configs ───────────────────────────────────────────────────

const STATUS_BADGES = {
  SCHEDULED:       { label: 'Scheduled',       cls: 'bg-blue-50 text-blue-600 border-blue-100',       dot: 'bg-blue-500',     icon: Calendar },
  CHECKED_IN:      { label: 'Checked In',      cls: 'bg-sky-50 text-sky-600 border-sky-100',          dot: 'bg-sky-500',      icon: User },
  PRE_OP_VERIFIED: { label: 'Pre-Op Verified', cls: 'bg-purple-50 text-purple-600 border-purple-100', dot: 'bg-purple-500',   icon: Shield },
  IN_PROGRESS:     { label: 'In Progress',     cls: 'bg-amber-50 text-amber-600 border-amber-100',    dot: 'bg-amber-500',    icon: Activity },
  RECOVERY:        { label: 'Recovery',         cls: 'bg-teal-50 text-teal-600 border-teal-100',       dot: 'bg-teal-500',     icon: Heart },
  COMPLETED:       { label: 'Completed',        cls: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', icon: CheckCircle2 },
  CANCELLED:       { label: 'Cancelled',        cls: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400',     icon: XCircle },
};

const URGENCY_BADGES = {
  EMERGENT: { cls: 'bg-red-100 text-red-700', label: '🔴 EMERGENT' },
  URGENT:   { cls: 'bg-amber-100 text-amber-700', label: '🟡 URGENT' },
  ELECTIVE: { cls: 'bg-blue-50 text-blue-600', label: 'ELECTIVE' },
};

const STATUS_ORDER = [
  'SCHEDULED', 'CHECKED_IN', 'PRE_OP_VERIFIED', 'IN_PROGRESS', 'RECOVERY', 'COMPLETED'
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── CaseCard — mirrors VisitCard in HomeCareDispatchBoard ────────────────────

const CaseCard = ({ sc, onSelect }) => {
  const cfg     = STATUS_BADGES[sc.status] || STATUS_BADGES.SCHEDULED;
  const urg     = URGENCY_BADGES[sc.urgency] || URGENCY_BADGES.ELECTIVE;
  const Icon    = cfg.icon;

  return (
    <div
      onClick={() => onSelect(sc)}
      className="bg-white border border-[#F0F4FC] rounded-2xl p-4 mb-3 cursor-pointer shadow-sm hover:shadow-md hover:translate-x-0.5 transition-all duration-200"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {sc.urgency && sc.urgency !== 'ELECTIVE' && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider ${urg.cls}`}>
                {urg.label}
              </span>
            )}
          </div>

          {/* Case number */}
          <p className="text-[10px] text-[#A0AECB] font-mono mb-0.5">{sc.caseNumber}</p>

          {/* Procedure name */}
          <p className="text-sm font-bold text-[#0F1A3A] mb-1 truncate">
            {sc.procedureName || '(Unnamed Procedure)'}
          </p>

          {/* Patient + Time */}
          <p className="text-xs text-[#8A97B0] font-semibold mb-2">
            Patient: {sc.patientName || sc.patientId}
          </p>
          <div className="flex flex-col gap-1 text-xs text-[#5A6A8A]">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#A0AECB]" />
              <span>{fmtTime(sc.scheduledStart)} – {fmtTime(sc.scheduledEnd)}</span>
            </div>
            {sc.surgeonName && (
              <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-[#F0F4FC]">
                <Stethoscope size={13} className="text-brand-blue" />
                <span className="font-bold text-brand-blue">Dr. {sc.surgeonName}</span>
              </div>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="text-[#A0AECB] shrink-0 mt-1" />
      </div>
    </div>
  );
};

// ─── Case Detail Slide-over (mirrors Assign Modal from HomeCare) ──────────────

const CaseDetailPanel = ({ sc, onClose, onStatusChange }) => {
  const dispatch = useDispatch();
  if (!sc) return null;
  const cfg = STATUS_BADGES[sc.status] || STATUS_BADGES.SCHEDULED;
  const urg = URGENCY_BADGES[sc.urgency] || URGENCY_BADGES.ELECTIVE;
  const curIdx = STATUS_ORDER.indexOf(sc.status);
  const nextStatus = curIdx >= 0 && curIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[curIdx + 1] : null;

  const doTransition = async (newStatus) => {
    try {
      await api.put(`/api/surgical/cases/${sc.id}/status`, { status: newStatus });
      dispatch(addToast({ type: 'success', message: `Status → ${STATUS_BADGES[newStatus]?.label || newStatus}` }));
      onStatusChange();
      onClose();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Transition failed.' }));
    }
  };

  const handleCancelCase = () => {
    doTransition('CANCELLED');
  };

  const handleDeleteCase = async () => {
    if (!window.confirm("Are you sure you want to delete this surgical case record completely from the database? This action cannot be undone.")) return;
    try {
      await api.delete(`/api/surgical/cases/${sc.id}`);
      dispatch(addToast({ type: 'success', message: 'Surgical case record deleted successfully.' }));
      onStatusChange();
      onClose();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed to delete case.' }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-slide-up-drawer"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#F0F4FC]">
          <div>
            <p className="text-[10px] text-[#A0AECB] font-mono mb-0.5">{sc.caseNumber}</p>
            <h3 className="text-base font-black text-[#0F1A3A]">{sc.procedureName || 'Surgical Case'}</h3>
          </div>
          <button onClick={onClose} className="text-[#A0AECB] hover:text-[#5A6A8A] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Status + Urgency */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider ${urg.cls}`}>
              {urg.label}
            </span>
          </div>

          {/* Info grid */}
          <div className="bg-[#F8FAFF] rounded-xl border border-[#EEF2FF] divide-y divide-[#F0F4FC] text-sm">
            {[
              { label: 'Patient',         val: sc.patientName || sc.patientId },
              { label: 'Surgeon',         val: sc.surgeonName ? `Dr. ${sc.surgeonName}` : sc.surgeonId },
              { label: 'Anesthesiologist',val: sc.anesthesiologistName || sc.anesthesiologistId || '—' },
              { label: 'Scheduled',       val: `${fmtTime(sc.scheduledStart)} – ${fmtTime(sc.scheduledEnd)}` },
              { label: 'OR',              val: sc.orName || sc.orId },
              { label: 'CPT Code',        val: sc.cptCode || '—' },
            ].map(({ label, val }) => (
              <div key={label} className="flex justify-between items-center px-4 py-2.5">
                <span className="text-[#8A97B0] font-semibold text-xs">{label}</span>
                <span className="text-[#0F1A3A] font-bold text-xs text-right max-w-[55%] truncate">{val}</span>
              </div>
            ))}
          </div>

          {/* Timing stamps */}
          {(sc.actualStart || sc.actualEnd) && (
            <div className="bg-[#F8FAFF] rounded-xl border border-[#EEF2FF] divide-y divide-[#F0F4FC] text-sm">
              {sc.actualStart && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[#8A97B0] font-semibold text-xs">Actual Start</span>
                  <span className="text-amber-600 font-bold text-xs">{fmtTime(sc.actualStart)}</span>
                </div>
              )}
              {sc.actualEnd && (
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[#8A97B0] font-semibold text-xs">Actual End</span>
                  <span className="text-emerald-600 font-bold text-xs">{fmtTime(sc.actualEnd)}</span>
                </div>
              )}
            </div>
          )}

          {/* Status Transition */}
          {!['COMPLETED', 'CANCELLED'].includes(sc.status) && (
            <div>
              <p className="section-label mb-2.5">Advance Status & Actions</p>
              <div className="flex flex-wrap gap-2">
                {nextStatus && (
                  <button
                    onClick={() => doTransition(nextStatus)}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    → {STATUS_BADGES[nextStatus]?.label || nextStatus}
                  </button>
                )}
                <button
                  onClick={handleCancelCase}
                  className="btn-ghost border border-red-200 text-red-500 hover:bg-red-50 text-xs px-4 py-2"
                >
                  Cancel Case
                </button>
                <button
                  onClick={handleDeleteCase}
                  className="btn-danger text-xs px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Delete Case
                </button>
              </div>
              {nextStatus === 'IN_PROGRESS' && (
                <p className="text-[11px] text-amber-600 font-semibold mt-2">
                  ⚠ WHO Sign-In & Time-Out must be complete to start surgery.
                </p>
              )}
            </div>
          )}

          {['COMPLETED', 'CANCELLED'].includes(sc.status) && (
            <div className="pt-2 border-t border-[#F0F4FC]">
              <p className="section-label mb-2.5 text-red-600">Danger Zone</p>
              <button
                onClick={handleDeleteCase}
                className="btn-danger text-xs px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold w-full justify-center"
              >
                Delete Case Record completely
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── PreOp Phase Card ─────────────────────────────────────────────────────────

const PhaseCard = ({ title, phase, fields, phaseName, onComplete, loading, disabled, disabledReason }) => {
  const [form, setForm] = useState({});
  const done = phase?.completed;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      done ? 'bg-emerald-50 border-emerald-200' : 
      disabled ? 'bg-gray-50 border-gray-200/60 opacity-60' : 'bg-white border-[#EEF2FF]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle2 size={15} className="text-emerald-500" />
            : disabled
            ? <Lock size={15} className="text-gray-400" />
            : <AlertTriangle size={15} className="text-amber-400" />}
          <span className={`text-sm font-bold ${disabled ? 'text-gray-500' : 'text-[#0F1A3A]'}`}>{title}</span>
        </div>
        {done && (
          <span className="text-[10px] text-emerald-600 font-bold">
            ✓ {phase.completedBy || 'Completed'}
          </span>
        )}
      </div>

      {disabled && (
        <p className="text-[10px] text-amber-600 font-semibold italic bg-amber-50/50 border border-amber-100/50 rounded-lg p-2 mt-1">
          🔒 {disabledReason || 'This phase is locked.'}
        </p>
      )}

      {!disabled && done && (
        <div className="grid grid-cols-2 gap-1.5">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-1.5 text-[11px] text-emerald-700">
              <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
              {f.label}
            </div>
          ))}
        </div>
      )}

      {!disabled && !done && (
        <div className="space-y-2">
          {fields.map(f => (
            <label key={f.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))}
                className="w-3.5 h-3.5 rounded accent-[#1A3C8F]"
              />
              <span className="text-xs text-[#4B5A7A] font-semibold">{f.label}</span>
            </label>
          ))}
          <button
            disabled={loading}
            onClick={() => onComplete(phaseName, form)}
            className="mt-2 btn-primary text-xs px-3.5 py-2 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : `Complete ${title}`}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SurgicalCare() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const user = useSelector(s => s.auth.user);
  const userRole = user?.role?.toUpperCase() || '';
  const canManage = ['ADMIN', 'MANAGER'].includes(userRole);

  const [activeTab, setActiveTab] = useState('board');
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );

  // OR Board
  const [cases, setCases] = useState([]);
  const [ors, setOrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  // Add OR modal
  const [showAddOrModal, setShowAddOrModal] = useState(false);
  const [showManageOrsModal, setShowManageOrsModal] = useState(false);
  const [addOrForm, setAddOrForm] = useState({
    roomNumber: '',
    roomName: '',
    equipmentTags: '',
    facilityId: 'FAC-001'
  });

  // Clinical Team
  const [teamMembers, setTeamMembers] = useState([]);

  // Patient Lookup
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Book Case
  const [bookForm, setBookForm] = useState({
    patientId: '', patientName: '', orId: '',
    surgeonId: '', anesthesiologistId: '',
    scheduledStart: '', scheduledEnd: '',
    procedureName: '', cptCode: '', snomedCode: '', urgency: 'ELECTIVE',
  });
  const [bookLoading, setBookLoading] = useState(false);

  // PreOp & Anesthesia
  const [caseSearch, setCaseSearch] = useState('');
  const [preopFilterQuery, setPreopFilterQuery] = useState('');
  const [activeCase, setActiveCase] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [anesthesia, setAnesthesia] = useState(null);
  const [preopLoading, setPreopLoading] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ hr: '', bp: '', spo2: '', etco2: '', temp: '', time: '' });
  const [medForm, setMedForm] = useState({ drug: '', dose: '', route: 'IV', time: '' });
  const [initAnesthesiaForm, setInitAnesthesiaForm] = useState({
    anesthesiologistId: '',
    anesthesiaType: 'GENERAL',
    asaClass: 1
  });

  // ── Load board & team ───────────────────────────────────────────────────────

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const [casesRes, orsRes, usersRes] = await Promise.all([
        api.get('/api/surgical/dispatch-board', { params: { date: selectedDate } }),
        api.get('/api/surgical/operating-rooms'),
        api.get('/api/users').catch(() => ({ data: [] }))
      ]);
      setCases(casesRes.data || []);
      setOrs(orsRes.data || []);
      
      const userList = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.content || []);
      setTeamMembers(userList.filter(u => u.active && (u.role === 'PHYSICIAN' || u.role === 'PARAMEDIC' || u.role === 'ADMIN' || u.role === 'MANAGER')));
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load OR board.' }));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, dispatch]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  // ── Summary stats ───────────────────────────────────────────────────────────

  const summary = cases.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  // ── Group cases by OR ───────────────────────────────────────────────────────

  const grouped = cases.reduce((acc, c) => {
    const key = c.orId || 'UNASSIGNED';
    if (!acc[key]) acc[key] = { or: ors.find(o => o.id === c.orId), cases: [] };
    acc[key].cases.push(c);
    return acc;
  }, {});

  // Real-time Patient Search for Booking
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
    setBookForm(prev => ({
      ...prev,
      patientId: p.patientId,
      patientName: p.patientName || p.displayName || 'Demo Patient'
    }));
    setPatientSearchQuery(`${p.patientName || p.displayName || 'Patient'} (${p.patientId})`);
    setPatientSearchResults([]);
  };

  const handleClearPatientSelection = () => {
    setBookForm(prev => ({ ...prev, patientId: '', patientName: '' }));
    setPatientSearchQuery('');
    setPatientSearchResults([]);
  };

  const handleAutoInitORs = async () => {
    try {
      const facilityId = "FAC-001";
      await api.post('/api/surgical/operating-rooms', {
        roomNumber: 'OR-1',
        roomName: 'Operating Room 1 (Main Suite)',
        equipmentTags: ['LAPAROSCOPY', 'C-ARM', 'ROBOT_ASSIST'],
        facilityId: facilityId
      });
      await api.post('/api/surgical/operating-rooms', {
        roomNumber: 'OR-2',
        roomName: 'Operating Room 2 (Cardiac)',
        equipmentTags: ['CARDIAC_BYPASS', 'C-ARM'],
        facilityId: facilityId
      });
      dispatch(addToast({ type: 'success', message: 'Operating Rooms registered successfully!' }));
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed to register Operating Rooms.' }));
    }
  };

  const handleAddOR = async (e) => {
    e.preventDefault();
    try {
      const tags = addOrForm.equipmentTags
        ? addOrForm.equipmentTags.split(',').map(t => t.trim().toUpperCase()).filter(t => t)
        : [];
      await api.post('/api/surgical/operating-rooms', {
        roomNumber: addOrForm.roomNumber.trim().toUpperCase(),
        roomName: addOrForm.roomName.trim(),
        equipmentTags: tags,
        facilityId: addOrForm.facilityId.trim(),
        active: true
      });
      dispatch(addToast({ type: 'success', message: 'Operating Room added!' }));
      setShowAddOrModal(false);
      setAddOrForm({ roomNumber: '', roomName: '', equipmentTags: '', facilityId: 'FAC-001' });
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed to add OR.' }));
    }
  };

  const handleDeleteOR = async (orId) => {
    if (!window.confirm("Are you sure you want to delete/deactivate this Operating Room? This might affect active schedules.")) return;
    try {
      await api.delete(`/api/surgical/operating-rooms/${orId}`);
      dispatch(addToast({ type: 'success', message: 'Operating Room deleted.' }));
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed to delete OR.' }));
    }
  };

  // ── Book Case ───────────────────────────────────────────────────────────────

  const handleBook = async (e) => {
    e.preventDefault();
    setBookLoading(true);
    try {
      await api.post('/api/surgical/cases', {
        ...bookForm,
        scheduledStart: new Date(bookForm.scheduledStart).toISOString(),
        scheduledEnd:   new Date(bookForm.scheduledEnd).toISOString(),
      });
      dispatch(addToast({ type: 'success', message: 'Surgical case booked!' }));
      setBookForm({
        patientId: '', patientName: '', orId: '', surgeonId: '',
        anesthesiologistId: '', scheduledStart: '', scheduledEnd: '',
        procedureName: '', cptCode: '', snomedCode: '', urgency: 'ELECTIVE',
      });
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Booking failed.' }));
    } finally {
      setBookLoading(false);
    }
  };

  // ── PreOp / Anesthesia Case Load ────────────────────────────────────────────

  const loadActiveCase = async (id) => {
    if (!id.trim()) return;
    setPreopLoading(true);
    try {
      const res = await api.get(`/api/surgical/cases/${id.trim()}`);
      const surgicalCase = res.data;
      setActiveCase(surgicalCase);

      // Fetch checklist only if it exists
      if (surgicalCase.preOpChecklistId) {
        try {
          const clRes = await api.get(`/api/surgical/cases/${id.trim()}/preop-checklist`);
          setChecklist(clRes.data);
        } catch {
          setChecklist(null);
        }
      } else {
        setChecklist(null);
      }

      // Fetch anesthesia only if it exists
      if (surgicalCase.anesthesiaRecordId) {
        try {
          const anRes = await api.get(`/api/surgical/cases/${id.trim()}/anesthesia`);
          setAnesthesia(anRes.data);
        } catch {
          setAnesthesia(null);
        }
      } else {
        setAnesthesia(null);
      }
    } catch {
      dispatch(addToast({ type: 'error', message: 'Case not found.' }));
      setActiveCase(null);
    } finally {
      setPreopLoading(false);
    }
  };

  const handleInitChecklist = async () => {
    if (!activeCase) return;
    try {
      const res = await api.post(`/api/surgical/cases/${activeCase.id}/preop-checklist`);
      setChecklist(res.data);
      dispatch(addToast({ type: 'success', message: 'WHO Checklist initialized.' }));
      // Refresh active case state
      const caseRes = await api.get(`/api/surgical/cases/${activeCase.id}`);
      setActiveCase(caseRes.data);
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed.' }));
    }
  };

  const handleInitAnesthesia = async () => {
    if (!activeCase) return;
    try {
      const res = await api.post(`/api/surgical/cases/${activeCase.id}/anesthesia`, initAnesthesiaForm);
      setAnesthesia(res.data);
      dispatch(addToast({ type: 'success', message: 'Anesthesia log initialized.' }));
      // Refresh active case state
      const caseRes = await api.get(`/api/surgical/cases/${activeCase.id}`);
      setActiveCase(caseRes.data);
      loadBoard();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed.' }));
    }
  };

  const handleCompletePhase = async (phase, formData) => {
    if (!activeCase || !checklist) return;
    setPreopLoading(true);
    try {
      const res = await api.put(`/api/surgical/cases/${activeCase.id}/preop-checklist/${phase}`, formData);
      setChecklist(res.data);
      dispatch(addToast({ type: 'success', message: `${phase} completed!` }));
      // Refresh case status
      const sc = await api.get(`/api/surgical/cases/${activeCase.id}`);
      setActiveCase(sc.data);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed.' }));
    } finally {
      setPreopLoading(false);
    }
  };

  const handleAppendVitals = async () => {
    if (!activeCase) return;
    try {
      let customTime = null;
      if (vitalsForm.time) {
        const todayStr = new Date().toISOString().split('T')[0];
        customTime = new Date(`${todayStr}T${vitalsForm.time}:00`).toISOString();
      }
      const entry = {
        hr:    vitalsForm.hr    ? parseInt(vitalsForm.hr)     : null,
        bp:    vitalsForm.bp    || null,
        spo2:  vitalsForm.spo2  ? parseInt(vitalsForm.spo2)   : null,
        etco2: vitalsForm.etco2 ? parseInt(vitalsForm.etco2)  : null,
        temp:  vitalsForm.temp  ? parseFloat(vitalsForm.temp) : null,
        time:  customTime
      };
      const res = await api.put(`/api/surgical/cases/${activeCase.id}/anesthesia/vitals`, entry);
      setAnesthesia(res.data);
      setVitalsForm({ hr: '', bp: '', spo2: '', etco2: '', temp: '', time: '' });
      dispatch(addToast({ type: 'success', message: 'Vitals appended.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed.' }));
    }
  };

  const handleAppendMed = async () => {
    if (!activeCase) return;
    try {
      let customTime = null;
      if (medForm.time) {
        const todayStr = new Date().toISOString().split('T')[0];
        customTime = new Date(`${todayStr}T${medForm.time}:00`).toISOString();
      }
      const payload = {
        ...medForm,
        time: customTime
      };
      await api.put(`/api/surgical/cases/${activeCase.id}/anesthesia/medications`, payload);
      const res = await api.get(`/api/surgical/cases/${activeCase.id}/anesthesia`);
      setAnesthesia(res.data);
      setMedForm({ drug: '', dose: '', route: 'IV', time: '' });
      dispatch(addToast({ type: 'success', message: 'Medication logged.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Failed.' }));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10 px-6 pt-6 animate-fade-in bg-[#F0F4FC] min-h-screen">

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Clinical Services</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            <Scissors size={22} className="text-brand-blue" />
            Surgical Care <span className="text-brand-blue">Operations</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            OR scheduling, WHO safety checklists, and intra-operative anesthesia records.
          </p>
        </div>
        <div className="flex gap-2.5">
          {activeTab === 'board' && (
            <>
              {canManage && (
                <>
                  <button
                    onClick={() => setShowAddOrModal(true)}
                    className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Add OR Room
                  </button>
                  <button
                    onClick={() => setShowManageOrsModal(true)}
                    className="btn-ghost border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/5 text-xs px-3.5 py-2 flex items-center gap-1.5 font-bold rounded-xl"
                  >
                    🏥 Manage ORs ({ors.length})
                  </button>
                </>
              )}
              <div className="flex items-center gap-2 bg-white border border-[#DDE3F0] rounded-xl px-3 py-2">
                <Calendar size={14} className="text-[#A0AECB]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-sm font-semibold text-[#0F1A3A] bg-transparent outline-none cursor-pointer"
                />
              </div>
            </>
          )}
          {activeTab === 'book' && (
            <button
              form="book-case-form"
              type="submit"
              disabled={bookLoading}
              className="btn-primary text-sm px-4 py-2.5 rounded-xl shadow-lg"
            >
              <Plus size={15} /> {bookLoading ? 'Booking…' : 'Book Case'}
            </button>
          )}
          <button
            onClick={loadBoard}
            disabled={loading}
            className="btn-ghost border border-[#DDE3F0] bg-white px-3 py-2.5 rounded-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#DDE3F0] gap-4">
        {[
          { id: 'board',   label: '🏥 OR Board' },
          { id: 'book',    label: '📋 Book Case' },
          { id: 'preop',   label: '🛡 PreOp & Anesthesia' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 px-1 text-sm font-bold transition-all relative ${
              activeTab === t.id ? 'text-brand-blue' : 'text-[#8A97B0] hover:text-[#5A6A8A]'
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Operating Rooms Seed Warning ──────────────────────────────── */}
      {!loading && ors.length === 0 && canManage && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">No Operating Rooms Configured</p>
              <p className="text-xs text-amber-600 font-medium">
                You cannot schedule cases or view the board because there are no ORs registered in this facility.
              </p>
            </div>
          </div>
          <button
            onClick={handleAutoInitORs}
            className="btn-primary text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold border-none shadow-sm rounded-xl py-1.5 px-4"
          >
            Initialize OR-1 & OR-2
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: OR Board                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'board' && (
        <div className="space-y-6">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Scheduled',     value: summary.SCHEDULED || 0,                                   icon: Calendar,     colorCls: 'bg-blue-50 text-blue-600',    textCls: 'text-blue-600' },
              { label: 'In Theatre',    value: (summary.IN_PROGRESS || 0),                               icon: Activity,     colorCls: 'bg-amber-50 text-amber-500',  textCls: 'text-amber-600' },
              { label: 'PreOp Active',  value: (summary.CHECKED_IN || 0) + (summary.PRE_OP_VERIFIED || 0), icon: Shield,    colorCls: 'bg-purple-50 text-purple-500',textCls: 'text-purple-600' },
              { label: 'Completed',     value: (summary.COMPLETED || 0) + (summary.RECOVERY || 0),       icon: CheckCircle2, colorCls: 'bg-emerald-50 text-emerald-500', textCls: 'text-emerald-600' },
            ].map(({ label, value, icon: Icon, colorCls, textCls }) => (
              <div key={label} className="stat-card bg-white p-5 rounded-2xl border border-[#EEF2FF] shadow-sm">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorCls}`}>
                  <Icon size={18} />
                </div>
                <p className={`text-3xl font-black ${textCls}`}>{value}</p>
                <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-20 text-[#A0AECB] flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-brand-blue" />
              <span className="text-xs font-black uppercase tracking-widest mt-2">Loading OR board…</span>
            </div>
          )}

          {/* Empty */}
          {!loading && cases.length === 0 && (
            <div className="text-center py-16 bg-white border border-[#EEF2FF] rounded-2xl shadow-sm space-y-4">
              <div className="w-14 h-14 bg-gray-50 text-[#A0AECB] rounded-full flex items-center justify-center mx-auto">
                <Scissors size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-[#0F1A3A]">No surgical cases for {fmtDate(selectedDate)}</p>
                <p className="text-xs text-[#8A97B0] max-w-sm mx-auto mt-1">
                  Use "Book Case" tab to schedule a procedure in an operating room.
                </p>
                <button
                  onClick={() => setActiveTab('book')}
                  className="btn-primary text-xs px-4 py-2 mt-4 rounded-xl"
                >
                  Book a Case
                </button>
              </div>
            </div>
          )}

          {/* OR Group Columns */}
          {!loading && cases.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {Object.entries(grouped).map(([orId, { or, cases: orCases }]) => (
                <div
                  key={orId}
                  className="bg-white border border-[#EEF2FF] rounded-2xl p-5 shadow-sm flex flex-col max-h-[70vh]"
                >
                  {/* OR header */}
                  <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3.5 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-brand-blue/10 rounded-lg flex items-center justify-center">
                        <Scissors size={13} className="text-brand-blue" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0F1A3A]">
                          {or?.roomName || or?.roomNumber || orId}
                        </p>
                        {or?.equipmentTags?.length > 0 && (
                          <p className="text-[10px] text-[#A0AECB]">{or.equipmentTags.join(' · ')}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#8A97B0] bg-[#F0F4FC] px-2.5 py-0.5 rounded-full">
                      {orCases.length}
                    </span>
                  </div>

                  {/* Case cards */}
                  <div className="overflow-y-auto flex-1 pr-1 space-y-1">
                    {orCases.map(sc => (
                      <CaseCard key={sc.id} sc={sc} onSelect={setSelectedCase} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: Book Case                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'book' && (
        <div className="max-w-2xl">
          <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0F4FC]">
              <h2 className="text-base font-black text-[#0F1A3A]">Book Surgical Case</h2>
              <p className="text-xs text-[#8A97B0] mt-0.5">
                Fill out the fields below to schedule a new surgical procedure. The system will automatically check for room conflicts.
              </p>
            </div>

            <form id="book-case-form" onSubmit={handleBook} className="p-6 space-y-5">
              {/* Patient */}
              <div>
                <p className="section-label mb-3">Patient Selection</p>
                <div className="relative">
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Search Patient (Name or ID) *</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={patientSearchQuery}
                        onChange={e => handlePatientSearch(e.target.value)}
                        placeholder="Enter patient name, phone number, or ID..."
                        className="input"
                        required={!bookForm.patientId}
                      />
                      {searchingPatients && (
                        <div className="absolute right-3 top-2.5">
                          <RefreshCw size={14} className="animate-spin text-brand-blue" />
                        </div>
                      )}
                    </div>
                    {bookForm.patientId && (
                      <button
                        type="button"
                        onClick={handleClearPatientSelection}
                        className="btn-ghost border border-red-200 text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-bold"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Search Results Dropdown Overlay */}
                  {patientSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-[#F0F4FC]">
                      {patientSearchResults.map(p => (
                        <div
                          key={p.patientId || p.id}
                          onClick={() => handleSelectPatient(p)}
                          className="px-4 py-2.5 hover:bg-[#F8FAFF] cursor-pointer text-xs flex justify-between items-center transition-colors"
                        >
                          <div>
                            <p className="font-bold text-[#0F1A3A]">{p.patientName || p.displayName}</p>
                            <p className="text-[#8A97B0] font-mono text-[10px] mt-0.5">ID: {p.patientId}</p>
                          </div>
                          {p.phone && <span className="text-[#8A97B0] text-[10px]">{p.phone}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Patient Banner */}
                  {bookForm.patientId && (
                    <div className="mt-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-emerald-800">{bookForm.patientName}</p>
                        <p className="text-[10px] text-emerald-600 font-mono mt-0.5">ID: {bookForm.patientId}</p>
                      </div>
                      <span className="badge badge-green">Selected</span>
                    </div>
                  )}
                </div>
              </div>

              {/* OR + Urgency */}
              <div>
                <p className="section-label mb-3">Operating Room & Urgency</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Operating Room *</label>
                    <select
                      required
                      value={bookForm.orId}
                      onChange={e => setBookForm(p => ({ ...p, orId: e.target.value }))}
                      className="select-input"
                    >
                      <option value="">Select OR…</option>
                      {ors.filter(o => o.active).map(o => (
                        <option key={o.id} value={o.id}>{o.roomName || o.roomNumber}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Urgency *</label>
                    <select
                      value={bookForm.urgency}
                      onChange={e => setBookForm(p => ({ ...p, urgency: e.target.value }))}
                      className="select-input"
                    >
                      <option value="ELECTIVE">Elective</option>
                      <option value="URGENT">Urgent</option>
                      <option value="EMERGENT">Emergent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Staff */}
              <div>
                <p className="section-label mb-3">Surgical Team</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Surgeon *</label>
                    <select
                      required
                      value={bookForm.surgeonId}
                      onChange={e => setBookForm(p => ({ ...p, surgeonId: e.target.value }))}
                      className="select-input"
                    >
                      <option value="">Select Surgeon…</option>
                      {teamMembers.filter(t => t.role === 'PHYSICIAN').map(t => (
                        <option key={t.id} value={t.id}>Dr. {t.lastName || t.firstName} ({t.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Anesthesiologist</label>
                    <select
                      value={bookForm.anesthesiologistId}
                      onChange={e => setBookForm(p => ({ ...p, anesthesiologistId: e.target.value }))}
                      className="select-input"
                    >
                      <option value="">Select Anesthesiologist (Optional)…</option>
                      {teamMembers.filter(t => t.role === 'PHYSICIAN').map(t => (
                        <option key={t.id} value={t.id}>Dr. {t.lastName || t.firstName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <p className="section-label mb-3">Scheduled Time</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Start *</label>
                    <input
                      required type="datetime-local"
                      value={bookForm.scheduledStart}
                      onChange={e => setBookForm(p => ({ ...p, scheduledStart: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">End *</label>
                    <input
                      required type="datetime-local"
                      value={bookForm.scheduledEnd}
                      onChange={e => setBookForm(p => ({ ...p, scheduledEnd: e.target.value }))}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Procedure */}
              <div>
                <p className="section-label mb-3">Procedure Details</p>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Procedure Name *</label>
                  <input
                    required
                    value={bookForm.procedureName}
                    onChange={e => setBookForm(p => ({ ...p, procedureName: e.target.value }))}
                    placeholder="e.g. Laparoscopic Appendectomy"
                    className="input mb-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">CPT Code</label>
                    <input
                      value={bookForm.cptCode}
                      onChange={e => setBookForm(p => ({ ...p, cptCode: e.target.value }))}
                      placeholder="e.g. 44950"
                      className="input font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">SNOMED Code</label>
                    <input
                      value={bookForm.snomedCode}
                      onChange={e => setBookForm(p => ({ ...p, snomedCode: e.target.value }))}
                      placeholder="e.g. 80146002"
                      className="input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Submit Button */}
              <div className="pt-4 border-t border-[#F0F4FC] flex justify-end">
                <button
                  type="submit"
                  disabled={bookLoading}
                  className="btn-primary text-sm px-6 py-2.5 rounded-xl shadow-lg flex items-center gap-2"
                >
                  <Plus size={16} />
                  {bookLoading ? 'Booking Surgical Case…' : 'Book Surgical Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: PreOp & Anesthesia                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'preop' && (
        <div className="space-y-6">

          {/* Selected Case Header banner */}
          {activeCase && (
            <div className="bg-gradient-to-r from-[#1A3C8F] to-[#0a143c] text-white rounded-2xl shadow-md p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
              <div>
                <span className="text-[10px] uppercase font-black bg-brand-blue/30 text-sky-200 border border-brand-blue/40 px-2 py-0.5 rounded-full">
                  Active Clinical Entry
                </span>
                <h2 className="text-base font-black mt-2 text-white">
                  {activeCase.caseNumber} · {activeCase.procedureName}
                </h2>
                <p className="text-xs text-sky-100 font-semibold mt-1">
                  Patient: <span className="font-black text-white">{activeCase.patientName || activeCase.patientId}</span> · OR: {activeCase.orName || activeCase.orId}
                </p>
              </div>
              <button
                onClick={() => { setActiveCase(null); setCaseSearch(''); }}
                className="bg-white text-[#1A3C8F] hover:bg-amber-100 hover:text-amber-900 border border-transparent text-xs px-4.5 py-2 font-black rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
              >
                ← Change Case
              </button>
            </div>
          )}

          {/* Case Selector view when no active case is selected */}
          {!activeCase && (
            <div className="space-y-4">
              {/* Header and Filter */}
              <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-black text-[#0F1A3A] flex items-center gap-2">
                    <Search size={14} className="text-brand-blue" /> Document Surgical Case
                  </h3>
                  <p className="text-xs text-[#8A97B0] mt-0.5">Select a case scheduled for today to document the WHO safety checklist and anesthesia record.</p>
                </div>
                <div className="w-full md:w-80">
                  <input
                    value={preopFilterQuery}
                    onChange={e => setPreopFilterQuery(e.target.value)}
                    placeholder="Search by patient, procedure, case ID or room..."
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              {/* Case Selection Cards Grid */}
              {cases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cases
                    .filter(c => {
                      const q = preopFilterQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (c.caseNumber && c.caseNumber.toLowerCase().includes(q)) ||
                        (c.procedureName && c.procedureName.toLowerCase().includes(q)) ||
                        (c.patientName && c.patientName.toLowerCase().includes(q)) ||
                        (c.patientId && c.patientId.toLowerCase().includes(q)) ||
                        (c.orName && c.orName.toLowerCase().includes(q)) ||
                        (c.orId && c.orId.toLowerCase().includes(q))
                      );
                    })
                    .map(c => {
                      const uBadge = URGENCY_BADGES[c.urgency] || URGENCY_BADGES.ELECTIVE;
                      const sBadge = STATUS_BADGES[c.status] || STATUS_BADGES.SCHEDULED;
                      return (
                        <div
                          key={c.id}
                          className="bg-white border border-[#EEF2FF] hover:border-brand-blue/30 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                        >
                          <div className="p-4 space-y-3.5">
                            {/* Card header */}
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-mono text-[#8A97B0] font-bold">
                                {c.caseNumber}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${uBadge.cls}`}>
                                {uBadge.label}
                              </span>
                            </div>

                            {/* Procedure */}
                            <div>
                              <h4 className="text-xs font-black text-[#0F1A3A] group-hover:text-brand-blue transition-colors line-clamp-1">
                                {c.procedureName}
                              </h4>
                              <p className="text-[11px] text-[#4B5A7A] mt-1 font-semibold">
                                Patient: <span className="text-[#0F1A3A] font-bold">{c.patientName || c.patientId}</span>
                              </p>
                            </div>

                            {/* Schedule & OR */}
                            <div className="text-[10px] text-[#8A97B0] font-semibold flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-[#F8FAFF]">
                              <span>OR: <strong className="text-[#4B5A7A]">{c.orName || c.orId}</strong></span>
                              <span>Time: <strong className="text-[#4B5A7A]">{fmtTime(c.scheduledStart)}</strong></span>
                            </div>
                          </div>

                          {/* Card actions */}
                          <div className="bg-[#F8FAFF] px-4 py-3 border-t border-[#EEF2FF] flex justify-between items-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${sBadge.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sBadge.dot}`} />
                              {sBadge.label}
                            </span>
                            <button
                              onClick={() => { setCaseSearch(c.id); loadActiveCase(c.id); }}
                              className="btn-primary text-[10px] px-3 py-1.5 rounded-lg shadow-sm hover:shadow"
                            >
                              Document Log
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm p-10 text-center">
                  <ClipboardList size={36} className="mx-auto text-[#DDE3F0] mb-2" />
                  <p className="text-sm font-bold text-[#0F1A3A] mb-1">No Cases Scheduled</p>
                  <p className="text-xs text-[#8A97B0]">There are no surgical cases scheduled for {selectedDate}. Please select another date on the OR Board tab or book a new case.</p>
                </div>
              )}
            </div>
          )}

          {/* Active case content */}
          {activeCase && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── WHO Checklist ────────────────────────────────────── */}
              <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F4FC] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-[#0F1A3A] flex items-center gap-2">
                      <Shield size={14} className="text-brand-blue" /> WHO Safety Checklist
                    </h3>
                    <p className="text-[10px] text-[#8A97B0] mt-0.5">
                      {activeCase.caseNumber} · {activeCase.procedureName}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGES[activeCase.status]?.cls || ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGES[activeCase.status]?.dot || ''}`} />
                    {STATUS_BADGES[activeCase.status]?.label || activeCase.status}
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  {!checklist ? (
                    <div className="text-center py-8">
                      <ClipboardList size={32} className="mx-auto text-[#DDE3F0] mb-2" />
                      <p className="text-sm font-bold text-[#0F1A3A] mb-1">Checklist not started</p>
                      <p className="text-xs text-[#8A97B0] mb-4">Initialize the WHO Surgical Safety Checklist for this case.</p>
                      <button onClick={handleInitChecklist} className="btn-primary text-xs px-4 py-2">
                        Initialize Checklist
                      </button>
                    </div>
                  ) : (
                    <>
                      <PhaseCard
                        title="Sign-In (Before Anesthesia)"
                        phase={checklist.signIn}
                        phaseName="sign-in"
                        onComplete={handleCompletePhase}
                        loading={preopLoading}
                        fields={[
                          { key: 'patientIdConfirmed', label: 'Patient identity confirmed' },
                          { key: 'siteMarked', label: 'Surgical site marked' },
                          { key: 'consentConfirmed', label: 'Informed consent confirmed' },
                          { key: 'allergyChecked', label: 'Allergies checked' },
                          { key: 'anesthesiaMachineChecked', label: 'Anesthesia machine checked' },
                        ]}
                      />
                      <PhaseCard
                        title="Time-Out (Before Incision)"
                        phase={checklist.timeOut}
                        phaseName="time-out"
                        onComplete={handleCompletePhase}
                        loading={preopLoading}
                        fields={[
                          { key: 'teamIntroduced', label: 'All team members introduced' },
                          { key: 'procedureConfirmed', label: 'Procedure & site confirmed by team' },
                          { key: 'antibioticGiven', label: 'Antibiotic prophylaxis given' },
                          { key: 'imagingAvailable', label: 'Imaging available & displayed' },
                          { key: 'anticipatedCriticalEventsReviewed', label: 'Critical events reviewed' },
                        ]}
                      />
                      <PhaseCard
                        title="Sign-Out (Before Leaving OR)"
                        phase={checklist.signOut}
                        phaseName="sign-out"
                        onComplete={handleCompletePhase}
                        loading={preopLoading}
                        fields={[
                          { key: 'instrumentCountCorrect', label: 'Instrument & sponge count correct' },
                          { key: 'specimenLabeled', label: 'Specimen labeled correctly' },
                          { key: 'equipmentIssues', label: 'Equipment issues noted' },
                        ]}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* ── Anesthesia Record ─────────────────────────────────── */}
              <div className="space-y-4">

                {!anesthesia ? (
                  <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden p-6 text-center">
                    <Heart size={36} className="mx-auto text-[#DDE3F0] mb-2" />
                    <p className="text-sm font-bold text-[#0F1A3A] mb-1">Anesthesia Log not started</p>
                    <p className="text-xs text-[#8A97B0] mb-4">Initialize the anesthesia log (vitals and medications timeline) for this case.</p>
                    <div className="max-w-xs mx-auto space-y-3 text-left">
                      <div>
                        <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Anesthesiologist *</label>
                        <select
                          value={initAnesthesiaForm.anesthesiologistId}
                          onChange={e => setInitAnesthesiaForm(p => ({ ...p, anesthesiologistId: e.target.value }))}
                          className="select-input py-1 text-xs"
                        >
                          <option value="">Select Anesthesiologist…</option>
                          {teamMembers.map(t => (
                            <option key={t.id} value={t.id}>Dr. {t.lastName || t.firstName} ({t.role})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Anesthesia Type *</label>
                        <select
                          value={initAnesthesiaForm.anesthesiaType}
                          onChange={e => setInitAnesthesiaForm(p => ({ ...p, anesthesiaType: e.target.value }))}
                          className="select-input py-1 text-xs"
                        >
                          <option value="GENERAL">General</option>
                          <option value="REGIONAL">Regional</option>
                          <option value="LOCAL">Local</option>
                          <option value="MAC">MAC (Sedation)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#4B5A7A] mb-1">ASA Classification *</label>
                        <select
                          value={initAnesthesiaForm.asaClass}
                          onChange={e => setInitAnesthesiaForm(p => ({ ...p, asaClass: parseInt(e.target.value) }))}
                          className="select-input py-1 text-xs"
                        >
                          <option value="1">ASA I - Normal Healthy</option>
                          <option value="2">ASA II - Mild Systemic Disease</option>
                          <option value="3">ASA III - Severe Systemic Disease</option>
                          <option value="4">ASA IV - Threat to Life</option>
                          <option value="5">ASA V - Moribund</option>
                        </select>
                      </div>
                      <button
                        onClick={handleInitAnesthesia}
                        className="btn-primary text-xs px-4 py-2 w-full justify-center"
                      >
                        Initialize Anesthesia Log
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Vitals */}
                    <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#F0F4FC] flex items-center gap-2">
                        <Heart size={14} className="text-red-500" />
                        <h3 className="text-sm font-black text-[#0F1A3A]">Intra-Op Vitals</h3>
                        {anesthesia.completed && (
                          <span className="ml-auto text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                            Record Locked
                          </span>
                        )}
                      </div>
                      <div className="p-5">
                        {/* Vitals input row */}
                        {!anesthesia.completed && (
                          <div className="mb-4">
                            <div className="grid grid-cols-6 gap-2 mb-2">
                              {[
                                { key: 'hr', ph: 'HR (bpm)' },
                                { key: 'bp', ph: 'BP (mmHg)' },
                                { key: 'spo2', ph: 'SpO2 (%)' },
                                { key: 'etco2', ph: 'EtCO2' },
                                { key: 'temp', ph: 'Temp °C' },
                              ].map(f => (
                                <input
                                  key={f.key}
                                  value={vitalsForm[f.key]}
                                  onChange={e => setVitalsForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  placeholder={f.ph}
                                  className="input text-center text-xs px-2 py-2"
                                />
                              ))}
                              <input
                                type="time"
                                value={vitalsForm.time}
                                onChange={e => setVitalsForm(p => ({ ...p, time: e.target.value }))}
                                placeholder="Time (Optional)"
                                className="input text-center text-xs px-2 py-2"
                              />
                            </div>
                            <button onClick={handleAppendVitals} className="btn-primary text-xs px-3.5 py-2 w-full justify-center">
                              + Append Vitals
                            </button>
                          </div>
                        )}

                        {/* Vitals table */}
                        {anesthesia.vitalsTimeline?.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-[#EEF2FF]">
                            <table className="data-table w-full">
                              <thead>
                                <tr>
                                  <th>Time</th>
                                  <th>HR</th>
                                  <th>BP</th>
                                  <th>SpO2</th>
                                  <th>EtCO2</th>
                                  <th>Temp</th>
                                </tr>
                              </thead>
                              <tbody>
                                {anesthesia.vitalsTimeline.map((v, i) => (
                                  <tr key={i}>
                                    <td className="font-mono text-[#8A97B0]">{fmtTime(v.time)}</td>
                                    <td className="font-bold text-red-600">{v.hr || '—'}</td>
                                    <td className="font-bold text-blue-600">{v.bp || '—'}</td>
                                    <td className="font-bold text-sky-600">{v.spo2 != null ? `${v.spo2}%` : '—'}</td>
                                    <td className="font-bold text-indigo-600">{v.etco2 || '—'}</td>
                                    <td className="font-bold text-orange-500">{v.temp != null ? `${v.temp}°C` : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-center text-[#A0AECB] text-xs py-6 font-semibold">
                            No vitals recorded yet.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Medications */}
                    <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#F0F4FC] flex items-center gap-2">
                        <Pill size={14} className="text-brand-blue" />
                        <h3 className="text-sm font-black text-[#0F1A3A]">Medications Administered</h3>
                      </div>
                      <div className="p-5">
                        {!anesthesia.completed && (
                          <div className="flex gap-2 mb-4">
                            <input
                              placeholder="Drug name"
                              value={medForm.drug}
                              onChange={e => setMedForm(p => ({ ...p, drug: e.target.value }))}
                              className="input flex-1 text-sm"
                            />
                            <input
                              placeholder="Dose"
                              value={medForm.dose}
                              onChange={e => setMedForm(p => ({ ...p, dose: e.target.value }))}
                              className="input w-24 text-sm"
                            />
                            <select
                              value={medForm.route}
                              onChange={e => setMedForm(p => ({ ...p, route: e.target.value }))}
                              className="select-input w-20 text-sm"
                            >
                              {['IV', 'IM', 'INHALED', 'ORAL'].map(r => <option key={r}>{r}</option>)}
                            </select>
                            <input
                              type="time"
                              value={medForm.time}
                              onChange={e => setMedForm(p => ({ ...p, time: e.target.value }))}
                              placeholder="Time (Optional)"
                              className="input w-28 text-xs text-center"
                            />
                            <button onClick={handleAppendMed} className="btn-primary px-3 py-2 text-sm">
                              +
                            </button>
                          </div>
                        )}

                        {anesthesia.medicationsAdministered?.length > 0 ? (
                          <div className="overflow-x-auto rounded-xl border border-[#EEF2FF]">
                            <table className="data-table w-full">
                              <thead>
                                <tr>
                                  <th>Drug</th>
                                  <th>Dose</th>
                                  <th>Route</th>
                                  <th>Time</th>
                                </tr>
                              </thead>
                              <tbody>
                                {anesthesia.medicationsAdministered.map((m, i) => (
                                  <tr key={i}>
                                    <td className="font-bold text-[#0F1A3A]">{m.drug}</td>
                                    <td className="text-[#5A6A8A]">{m.dose}</td>
                                    <td>
                                      <span className="badge badge-blue">{m.route}</span>
                                    </td>
                                    <td className="font-mono text-[#8A97B0]">{fmtTime(m.time)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-center text-[#A0AECB] text-xs py-6 font-semibold">
                            No medications logged yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Case Detail Modal ─────────────────────────────────────────── */}
      {selectedCase && (
        <CaseDetailPanel
          sc={selectedCase}
          onClose={() => setSelectedCase(null)}
          onStatusChange={() => { loadBoard(); setSelectedCase(null); }}
        />
      )}

      {/* ── Add OR Modal ─────────────────────────────────────────────── */}
      {showAddOrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowAddOrModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-slide-up-drawer"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F4FC]">
              <h3 className="text-base font-black text-[#0F1A3A] flex items-center gap-2">
                <Scissors size={16} className="text-brand-blue" />
                Register Operating Room
              </h3>
              <button onClick={() => setShowAddOrModal(false)} className="text-[#A0AECB] hover:text-[#5A6A8A] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddOR} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">OR Room Code *</label>
                <input
                  required
                  value={addOrForm.roomNumber}
                  onChange={e => setAddOrForm(p => ({ ...p, roomNumber: e.target.value }))}
                  placeholder="e.g. OR-3"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Room Description / Name *</label>
                <input
                  required
                  value={addOrForm.roomName}
                  onChange={e => setAddOrForm(p => ({ ...p, roomName: e.target.value }))}
                  placeholder="e.g. Operating Room 3 (Orthopaedic)"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Equipment tags (Comma separated)</label>
                <input
                  value={addOrForm.equipmentTags}
                  onChange={e => setAddOrForm(p => ({ ...p, equipmentTags: e.target.value }))}
                  placeholder="e.g. C-ARM, LAPAROSCOPY, ROBOTIC"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4B5A7A] mb-1.5">Facility ID *</label>
                <input
                  required
                  value={addOrForm.facilityId}
                  onChange={e => setAddOrForm(p => ({ ...p, facilityId: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddOrModal(false)}
                  className="btn-ghost border border-[#DDE3F0] text-xs font-bold rounded-xl px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs font-bold rounded-xl px-5 py-2"
                >
                  Add Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manage ORs Modal ─────────────────────────────────────────── */}
      {showManageOrsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowManageOrsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-slide-up-drawer"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F4FC]">
              <div>
                <h3 className="text-base font-black text-[#0F1A3A] flex items-center gap-2">
                  <Scissors size={16} className="text-brand-blue" />
                  Operating Room Registry
                </h3>
                <p className="text-xs text-[#8A97B0] mt-0.5">Manage and review all operating rooms configured in the facility.</p>
              </div>
              <button onClick={() => setShowManageOrsModal(false)} className="text-[#A0AECB] hover:text-[#5A6A8A] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content List */}
            <div className="p-5 overflow-y-auto flex-1">
              {ors.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-[#EEF2FF]">
                  <table className="data-table w-full text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFF]">
                        <th className="px-4 py-2.5 text-left font-bold text-[#4B5A7A]">Room Code</th>
                        <th className="px-4 py-2.5 text-left font-bold text-[#4B5A7A]">Room Name / Description</th>
                        <th className="px-4 py-2.5 text-left font-bold text-[#4B5A7A]">Equipment Tags</th>
                        <th className="px-4 py-2.5 text-center font-bold text-[#4B5A7A]">Facility ID</th>
                        <th className="px-4 py-2.5 text-center font-bold text-[#4B5A7A]">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2FF]">
                      {ors.map(or => (
                        <tr key={or.id} className="hover:bg-[#F8FAFF] transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-brand-blue">{or.roomNumber}</td>
                          <td className="px-4 py-3 font-bold text-[#0F1A3A]">{or.roomName}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {or.equipmentTags && or.equipmentTags.length > 0 ? (
                                or.equipmentTags.map(tag => (
                                  <span key={tag} className="px-1.5 py-0.5 bg-brand-blue/5 text-brand-blue border border-brand-blue/10 text-[9px] font-black uppercase rounded">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[#A0AECB] font-medium text-[10px]">None</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-[#5A6A8A] font-medium">{or.facilityId}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteOR(or.id)}
                              className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors inline-flex items-center justify-center"
                              title="Delete Room"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <Scissors size={32} className="mx-auto text-[#DDE3F0] mb-2" />
                  <p className="text-sm font-bold text-[#0F1A3A]">No Rooms Registered</p>
                  <p className="text-xs text-[#8A97B0] mt-1">Register a new room using the 'Add OR Room' form to get started.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#F0F4FC] flex justify-end">
              <button
                type="button"
                onClick={() => setShowManageOrsModal(false)}
                className="btn-primary text-xs font-bold rounded-xl px-5 py-2"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
