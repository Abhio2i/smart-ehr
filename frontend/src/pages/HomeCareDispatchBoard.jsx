import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  MapPin, User, Clock, Plus, RefreshCw, CheckCircle2,
  AlertTriangle, XCircle, Activity, ChevronRight,
  Stethoscope, Navigation, Calendar, Users, ClipboardList, Briefcase, FileText, Trash2
} from 'lucide-react';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ── Badge Style mapping ──────────────────────────────────────────────────────

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
  WOUND_CARE:             '🩹 Wound Care',
  IV_THERAPY:             '💉 IV Therapy',
  PERSONAL_CARE:          '🤝 Personal Care',
  PALLIATIVE:             '🌿 Palliative',
  POST_SURGICAL:          '🏥 Post-Surgical',
  MEDICATION_MANAGEMENT:  '💊 Medication Management',
  PHYSIOTHERAPY:          '🦾 Physiotherapy',
  MENTAL_HEALTH:          '🧠 Mental Health',
};

const COMMUNITIES = [
  "Fort Liard", "Yellowknife", "Behchokǫ̀", "Hay River", "Fort Smith", 
  "Inuvik", "Norman Wells", "Nahanni Butte", "Tuktoyaktuk"
];

// ── Sub-Components ───────────────────────────────────────────────────────────

const VisitCard = ({ visit, onAssign, onViewDetails, role }) => {
  const cfg = STATUS_BADGES[visit.status] || STATUS_BADGES.UNASSIGNED;
  const StatusIcon = cfg.icon;

  return (
    <div
      onClick={() => onViewDetails(visit)}
      className="bg-white border border-[#F0F4FC] rounded-2xl p-4 mb-3 cursor-pointer shadow-sm hover:shadow-md hover:translate-x-0.5 transition-all duration-200"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {visit.priority === 'HIGH' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-red-100 text-red-700 tracking-wider">
                ⚡ HIGH PRIORITY
              </span>
            )}
          </div>

          <p className="text-sm font-bold text-[#0F1A3A] mb-1 truncate">
            {SERVICE_LABELS[visit.serviceType] || visit.serviceType || 'Home Care Visit'}
          </p>

          <p className="text-xs text-[#8A97B0] mb-2 font-semibold">Patient: {visit.patientName || visit.patientId}</p>

          <div className="flex flex-col gap-1.5 text-xs text-[#5A6A8A]">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-[#A0AECB]" />
              <span className="font-semibold">{visit.community || '—'}</span>
            </div>
            {visit.timeWindow && (
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-[#A0AECB]" />
                <span>Window: {visit.timeWindow}</span>
              </div>
            )}
            {visit.assignedNurseName && (
              <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-[#F0F4FC]">
                <User size={13} className="text-brand-blue" />
                <span className="font-bold text-brand-blue">{visit.assignedNurseName}</span>
              </div>
            )}
          </div>
        </div>

        {visit.status === 'UNASSIGNED' && (role === 'ADMIN' || role === 'MANAGER') && (
          <button
            onClick={e => { e.stopPropagation(); onAssign(visit); }}
            className="btn-primary text-[11px] px-3.5 py-1.5 rounded-xl shadow-md whitespace-nowrap self-center"
          >
            Assign
          </button>
        )}
      </div>
    </div>
  );
};

// ── Assign Modal ─────────────────────────────────────────────────────────────

const AssignModal = ({ visit, onClose, onAssigned, role }) => {
  const dispatch = useDispatch();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [timeWindow, setTimeWindow] = useState('08:00-12:00');

  useEffect(() => {
    if (!visit) return;
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/api/homecare/visits/${visit.id}/suggest-nurses`)
      .then(r => setSuggestions(r.data || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [visit, role]);

  const handleAssign = async (nurseId) => {
    setAssigning(nurseId);
    try {
      await api.post(`/api/homecare/visits/${visit.id}/assign`, { nurseId, timeWindow });
      dispatch(addToast({ type: 'success', message: 'Nurse assigned successfully!' }));
      onAssigned();
      onClose();
    } catch (err) {
      dispatch(addToast({
        type: 'error',
        message: err.response?.data?.error || 'Assignment failed. Visit may already be assigned.'
      }));
      setAssigning(null);
    }
  };

  if (!visit) return null;

  const isDispatchAllowed = role === 'ADMIN' || role === 'MANAGER';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
          <h3 className="text-base font-bold text-[#0F1A3A]">
            {isDispatchAllowed ? 'Assign Visiting Nurse' : 'Visit Details'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] text-[#8A97B0] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Rich Clinical Visit Card */}
          <div className="bg-[#F8FAFC] border border-[#EEF2FF] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="text-[10px] font-extrabold text-[#8A97B0] uppercase tracking-wider mb-0.5">SERVICE PLAN</p>
                <h4 className="text-base font-black text-[#0F1A3A] tracking-tight">
                  {SERVICE_LABELS[visit.serviceType] || visit.serviceType}
                </h4>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wide shrink-0 ${
                visit.priority === 'HIGH' 
                  ? 'bg-red-50 text-red-600 border-red-100'
                  : visit.priority === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  visit.priority === 'HIGH' ? 'bg-red-500 animate-pulse' : visit.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                {visit.priority || 'MEDIUM'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#F0F4FC]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase block">👤 Patient</span>
                <span className="text-xs font-bold text-[#0F1A3A] block truncate">
                  {visit.patientName || visit.patientId || 'Demo Patient'}
                </span>
                <span className="text-[10px] text-[#A0AECB] font-semibold block">ID: {visit.patientId}</span>
              </div>
              
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase block">📅 Date & Time</span>
                <span className="text-xs font-bold text-[#0F1A3A] block">
                  {visit.visitDate}
                </span>
                {visit.timeWindow && (
                  <span className="text-[10px] text-[#8A97B0] font-semibold block">⏰ {visit.timeWindow}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#F0F4FC]">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase block">📍 Zone / Community</span>
                <span className="text-xs font-bold text-brand-blue block">
                  {visit.community}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase block">Status</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                  visit.status === 'COMPLETED' 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : visit.status === 'UNASSIGNED'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                  {visit.status || 'UNASSIGNED'}
                </span>
              </div>
            </div>

            {visit.assignedNurseName && (
              <div className="pt-3 border-t border-[#F0F4FC] flex items-center gap-2.5 text-brand-blue font-bold text-xs bg-blue-50/40 p-3 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-blue animate-pulse" />
                <span>Assigned: {visit.assignedNurseName}</span>
              </div>
            )}
          </div>

          {/* Clinical Instructions Card */}
          {visit.careInstructions && (
            <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs space-y-1">
              <span className="text-[10px] font-bold text-[#8A97B0] uppercase block">📝 Care Instructions</span>
              <p className="text-[#5A6A8A] leading-relaxed font-semibold italic">{visit.careInstructions}</p>
            </div>
          )}

          {isDispatchAllowed && (
            <>
              {/* Select Time Window Input */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1.5 shadow-sm">
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider block">⏰ Select Time Window</label>
                <select
                  value={timeWindow}
                  onChange={e => setTimeWindow(e.target.value)}
                  className="w-full text-xs font-semibold text-[#0F1A3A] bg-white border border-[#DDE3F0] p-2.5 rounded-xl outline-none"
                >
                  <option value="08:00-12:00">08:00 - 12:00 (Morning)</option>
                  <option value="12:00-16:00">12:00 - 16:00 (Afternoon)</option>
                  <option value="16:00-20:00">16:00 - 20:00 (Evening)</option>
                </select>
              </div>

              <p className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">
                Available Nurses (Geographic suggestions first)
              </p>

              {loading ? (
                <div className="text-center py-8 text-[#A0AECB] flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-brand-blue" />
                  <span className="text-xs font-bold uppercase tracking-wider">Loading Caseloads...</span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#8A97B0] space-y-2">
                  <p>No nurses have caseload allocations for <strong>{visit.community}</strong> today.</p>
                  <p className="text-[#A0AECB] text-[11px]">Set up caseload territories in Admin Caseload panel.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map(s => {
                    const pct = Math.min(100, Math.round(s.score * 100));
                    const barColor = pct < 50 ? 'bg-emerald-500' : pct < 80 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <div
                        key={s.nurseId}
                        className="flex items-center gap-4 p-3 bg-[#F8FAFC] border border-[#EEF2FF] rounded-xl hover:border-brand-blue/30 transition-all duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#0F1A3A] truncate">{s.nurseName}</p>
                          <div className="flex justify-between text-[11px] text-[#8A97B0] mt-0.5">
                            <span>Caseload: {s.currentLoad} / {s.maxLoad} daily</span>
                            <span className="font-bold">{pct}% Full</span>
                          </div>
                          <div className="h-1.5 bg-gray-200/60 rounded-full mt-2 overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssign(s.nurseId)}
                          disabled={assigning !== null}
                          className="btn-primary text-xs px-3 py-2 rounded-lg"
                        >
                          {assigning === s.nurseId ? '...' : 'Assign'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HomeCareDispatchBoard() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const role = useSelector(state => state.auth.user?.role);
  const today = new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'referrals' | 'caseloads'
  const [date, setDate] = useState(today);
  const [community, setCommunity] = useState('');
  
  // Data lists
  const [visits, setVisits] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [caseloads, setCaseloads] = useState([]);
  const [paramedicUsers, setParamedicUsers] = useState([]);
  const [patients, setPatients] = useState([]);

  // Patient Search states
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchingPatients, setSearchingPatients] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [assigningVisit, setAssigningVisit] = useState(null);

  // Form Modals
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isCaseloadOpen, setIsCaseloadOpen] = useState(false);
  const [caseloadProviderType, setCaseloadProviderType] = useState('PARAMEDIC'); // 'PARAMEDIC' | 'PHYSICIAN'

  // Form states
  const [newReferral, setNewReferral] = useState({
    patientId: '',
    patientName: '',
    serviceType: 'WOUND_CARE',
    frequency: 'daily',
    startDate: today,
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    homeCommunity: 'Fort Liard',
    careInstructions: '',
    priority: 'MEDIUM',
    specialRequirements: ''
  });

  const [newCaseload, setNewCaseload] = useState({
    nurseId: '',
    assignedCommunities: ['Fort Liard'],
    date: today,
    maxDailyVisits: 8,
    available: true
  });

  // Fetch visits
  const fetchVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date });
      if (community) params.append('community', community);
      const res = await api.get(`/api/homecare/dispatch-board?${params}`);
      setVisits(res.data || []);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: 'Failed to load dispatch board.' }));
    } finally {
      setLoading(false);
    }
  }, [date, community, dispatch]);

  // Fetch referrals
  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/homecare/referrals');
      setReferrals(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load referrals.' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Real-time Patient Search
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
    setSelectedPatient(p);
    setNewReferral(prev => ({ 
      ...prev, 
      patientId: p.patientId,
      patientName: p.patientName || p.displayName || 'Demo Patient'
    }));
    setPatientSearchQuery(`${p.patientName || p.displayName || 'Patient'} (${p.patientId})`);
    setPatientSearchResults([]);
  };

  const handleClearPatientSelection = () => {
    setSelectedPatient(null);
    setNewReferral(prev => ({ ...prev, patientId: '', patientName: '' }));
    setPatientSearchQuery('');
    setPatientSearchResults([]);
  };

  // Fetch paramedic/physician users for caseload setup
  const fetchParamedics = useCallback(async () => {
    try {
      const res = await api.get('/api/users');
      const userList = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      const filtered = userList.filter(u => (u.role === 'PARAMEDIC' || u.role === 'PHYSICIAN') && u.active);
      setParamedicUsers(filtered);
      
      const typeFiltered = filtered.filter(u => u.role === caseloadProviderType);
      if (typeFiltered.length > 0) {
        setNewCaseload(prev => ({ ...prev, nurseId: typeFiltered[0].id }));
      }
    } catch {
      // Fallback
    }
  }, [caseloadProviderType]);

  // Fetch caseloads
  const fetchCaseloads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/homecare/caseloads?date=${date}`);
      setCaseloads(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load caseload allocations.' }));
    } finally {
      setLoading(false);
    }
  }, [date, dispatch]);

  useEffect(() => {
    fetchVisits();
    fetchReferrals();
    if (role === 'ADMIN' || role === 'MANAGER') {
      fetchCaseloads();
      fetchParamedics();
    }
  }, [role, fetchVisits, fetchReferrals, fetchCaseloads, fetchParamedics]);

  // Form Submissions
  const handleCreateReferral = async (e) => {
    e.preventDefault();
    try {
      // 1. Create Referral
      const res = await api.post('/api/homecare/referrals', newReferral);
      const createdId = res.data.id;
      
      // 2. Auto-Activate referral to trigger visits
      await api.put(`/api/homecare/referrals/${createdId}/status`, { status: 'ACTIVE' });
      
      dispatch(addToast({ type: 'success', message: 'Referral created and activated!' }));
      setIsReferralOpen(false);
      fetchReferrals();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.response?.data?.error || 'Failed to create referral.' }));
    }
  };

  const handleCreateCaseload = async (e) => {
    e.preventDefault();
    const selectedNurse = paramedicUsers.find(u => u.id === newCaseload.nurseId);
    const payload = {
      ...newCaseload,
      nurseName: selectedNurse ? `${selectedNurse.firstName} ${selectedNurse.lastName} (${selectedNurse.role === 'PHYSICIAN' ? 'Doctor' : 'Nurse'})` : 'Care Provider'
    };

    try {
      await api.post('/api/homecare/caseloads', payload);
      dispatch(addToast({ type: 'success', message: 'Caseload setup successfully!' }));
      setIsCaseloadOpen(false);
      fetchCaseloads();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: 'Failed to save caseload allocation.' }));
    }
  };



  const handleDeleteReferral = async (referralId) => {
    if (!window.confirm('Are you sure you want to delete this patient referral? This will also remove any unstarted visiting schedules.')) return;
    try {
      await api.delete(`/api/homecare/referrals/${referralId}`);
      dispatch(addToast({ type: 'success', message: 'Referral and associated visits deleted successfully.' }));
      fetchReferrals();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to delete referral.' }));
    }
  };

  const handleDeleteCaseload = async (caseloadId) => {
    if (!window.confirm('Are you sure you want to delete this nurse caseload allocation?')) return;
    try {
      await api.delete(`/api/homecare/caseloads/${caseloadId}`);
      dispatch(addToast({ type: 'success', message: 'Caseload allocation deleted successfully.' }));
      fetchCaseloads();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to delete caseload.' }));
    }
  };

  // Status breakdown calculations
  const summary = visits.reduce((acc, v) => {
    acc[v.status] = (acc[v.status] || 0) + 1;
    return acc;
  }, {});

  // Group visits by community zones
  const grouped = visits.reduce((acc, v) => {
    const key = v.community || 'Unmapped Zone';
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-10 px-6 pt-6 animate-fade-in bg-[#F0F4FC] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Community Care Operations</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Home Care <span className="text-brand-blue">Control Dashboard</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            Set up care programs, allocate nurse territories, and dispatch visits.
          </p>
        </div>
        
        {/* Top-Right Action Buttons based on Tab */}
        <div className="flex gap-2.5">
          {activeTab === 'referrals' && (
            <button
              onClick={() => setIsReferralOpen(true)}
              className="btn-primary text-sm px-4 py-2.5 rounded-xl shadow-lg"
            >
              <Plus size={16} /> New Referral
            </button>
          )}
          <button
            onClick={() => {
              if (activeTab === 'board') fetchVisits();
              if (activeTab === 'referrals') fetchReferrals();
              if (activeTab === 'caseloads') fetchCaseloads();
            }}
            disabled={loading}
            className="btn-ghost border border-[#DDE3F0] bg-white px-3 py-2.5 rounded-xl flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-[#DDE3F0] gap-4">
        {[
          { id: 'board', label: '📋 Dispatch Board', icon: Stethoscope },
          { id: 'referrals', label: '📝 Patient Referrals', icon: ClipboardList },
          { id: 'caseloads', label: '💼 Caseload Allocation', icon: Briefcase, restricted: true }
        ].filter(t => !t.restricted || role === 'ADMIN' || role === 'MANAGER').map(t => (
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

      {/* Tab 1: Dispatch Board */}
      {activeTab === 'board' && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Unassigned Visits', value: summary.UNASSIGNED || 0, icon: AlertTriangle, red: true },
              { label: 'Assigned / In Route', value: (summary.ASSIGNED || 0) + (summary.EN_ROUTE || 0), icon: Navigation, blue: true },
              { label: 'Active Care', value: summary.IN_PROGRESS || 0, icon: Activity, purple: true },
              { label: 'Completed Visits', value: summary.COMPLETED || 0, icon: CheckCircle2, green: true },
            ].map(({ label, value, icon: Icon, red, blue, purple, green }) => {
              const colorClass = red ? 'bg-red-50 text-red-500' :
                                 blue ? 'bg-blue-50 text-brand-blue' :
                                 purple ? 'bg-purple-50 text-purple-500' : 'bg-emerald-50 text-emerald-500';
              const textClass = red ? 'text-red-600' :
                                blue ? 'text-brand-blue' :
                                purple ? 'text-purple-600' : 'text-emerald-600';
              return (
                <div key={label} className="stat-card bg-white p-5 rounded-2xl border border-[#EEF2FF] shadow-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
                    <Icon size={18} />
                  </div>
                  <p className={`text-3xl font-black ${textClass}`}>{value}</p>
                  <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mt-1">{label}</p>
                </div>
              );
            })}
          </div>

          {/* Filtering Row */}
          <div className="bg-white border border-[#EEF2FF] p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2.5 px-3 py-2 border border-[#DDE3F0] rounded-xl bg-white w-full md:w-auto">
              <Calendar size={15} className="text-[#A0AECB]" />
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="text-sm font-semibold text-[#0F1A3A] bg-transparent outline-none cursor-pointer"
              />
            </div>
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2 border border-[#DDE3F0] rounded-xl bg-white w-full">
              <MapPin size={15} className="text-[#A0AECB]" />
              <input
                placeholder="Filter by community zone (e.g. Fort Liard)..."
                value={community}
                onChange={e => setCommunity(e.target.value)}
                className="text-sm text-[#0F1A3A] bg-transparent outline-none w-full placeholder-[#A0AECB]"
              />
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-20 text-[#A0AECB] flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-brand-blue" />
              <span className="text-xs font-black uppercase tracking-widest mt-2">Loading dispatch grid...</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && visits.length === 0 && (
            <div className="text-center py-16 bg-white border border-[#EEF2FF] rounded-2xl shadow-sm space-y-4">
              <div className="w-14 h-14 bg-gray-50 text-[#A0AECB] rounded-full flex items-center justify-center mx-auto">
                <Users size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-[#0F1A3A]">No visits scheduled</p>
                <p className="text-xs text-[#8A97B0] max-w-sm mx-auto mt-1">
                  There are no visits generated for the selected date. Add patient referrals first.
                </p>
              </div>
            </div>
          )}

          {/* Grouped Zones Column Layout */}
          {!loading && visits.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {Object.entries(grouped).map(([comm, commVisits]) => (
                <div
                  key={comm}
                  className="bg-white border border-[#EEF2FF] rounded-2xl p-5 shadow-sm flex flex-col max-h-[70vh]"
                >
                  <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3.5 mb-4">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-brand-blue" />
                      <span className="text-sm font-bold text-[#0F1A3A]">{comm}</span>
                    </div>
                    <span className="text-xs font-bold text-[#8A97B0] bg-[#F0F4FC] px-2.5 py-0.5 rounded-full">
                      {commVisits.length}
                    </span>
                  </div>

                  <div className="overflow-y-auto flex-1 pr-1 space-y-1">
                    {commVisits.map(visit => (
                      <VisitCard
                        key={visit.id}
                        visit={visit}
                        role={role}
                        onAssign={v => setAssigningVisit(v)}
                        onViewDetails={v => setAssigningVisit(v)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Referrals Panel */}
      {activeTab === 'referrals' && (
        <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
          {loading && referrals.length === 0 ? (
            <div className="text-center py-20 text-[#A0AECB]">
              <RefreshCw size={24} className="animate-spin text-brand-blue mx-auto mb-2" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading Referrals...</span>
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-14 h-14 bg-gray-50 text-[#A0AECB] rounded-full flex items-center justify-center mx-auto">
                <ClipboardList size={24} />
              </div>
              <div>
                <p className="text-base font-bold text-[#0F1A3A]">No Patient Care Programs</p>
                <p className="text-xs text-[#8A97B0] max-w-sm mx-auto mt-1">
                  Create a new referral program to auto-generate weekly nurse check-in assignments.
                </p>
                <button
                  onClick={() => setIsReferralOpen(true)}
                  className="btn-primary text-xs px-4 py-2 mt-4 rounded-xl"
                >
                  Create First Referral
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#F0F4FC] bg-[#F8FAFC]">
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Patient</th>
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Service Type</th>
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Frequency</th>
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Zone / Community</th>
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Duration</th>
                    <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Status</th>
                    {(role === 'ADMIN' || role === 'MANAGER' || role === 'PHYSICIAN') && (
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(ref => (
                    <tr key={ref.id} className="border-b border-[#F0F4FC] hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4 text-sm font-bold text-[#0F1A3A]">
                        <div>{ref.patientName || ref.patientId}</div>
                        {ref.patientName && (
                          <div className="text-[10px] text-[#8A97B0] font-semibold">ID: {ref.patientId}</div>
                        )}
                      </td>
                      <td className="p-4 text-sm font-semibold text-[#5A6A8A]">
                        {SERVICE_LABELS[ref.serviceType] || ref.serviceType}
                      </td>
                      <td className="p-4 text-sm text-[#5A6A8A] font-semibold">{ref.frequency}</td>
                      <td className="p-4 text-sm text-[#0F1A3A] font-bold">📍 {ref.homeCommunity}</td>
                      <td className="p-4 text-xs text-[#8A97B0]">
                        {ref.startDate} to {ref.endDate}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          ref.status === 'ACTIVE' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {ref.status}
                        </span>
                      </td>
                      {(role === 'ADMIN' || role === 'MANAGER' || role === 'PHYSICIAN') && (
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteReferral(ref.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                            title="Delete Referral"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Caseload Allocation */}
      {activeTab === 'caseloads' && (
        <div className="space-y-8">
          {/* Section A: Nurse Allocations */}
          <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#F0F4FC] flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#0F1A3A] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                  💼 Nurse Caseload Allocations ({date})
                </h4>
                <p className="text-xs text-[#8A97B0] mt-0.5">Nurses assigned to community zones for daily visits</p>
              </div>
              <button
                onClick={() => {
                  setCaseloadProviderType('PARAMEDIC');
                  setNewCaseload(prev => ({ ...prev, date: date }));
                  setIsCaseloadOpen(true);
                }}
                className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> Configure Nurse Caseload
              </button>
            </div>

            {loading && caseloads.length === 0 ? (
              <div className="text-center py-20 text-[#A0AECB]">
                <RefreshCw size={24} className="animate-spin text-brand-blue mx-auto mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading Caseloads...</span>
              </div>
            ) : caseloads.filter(c => c.nurseName?.includes('(Nurse)') || (!c.nurseName?.includes('(Doctor)') && !c.nurseName?.includes('(Nurse)'))).length === 0 ? (
              <div className="text-center py-16 text-[#A0AECB] text-xs">
                No active Nurse caseloads configured for today. Click configure to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#F0F4FC] bg-[#F8FAFC]">
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Visiting Nurse</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Assigned Territories</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Max Capacity</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Availability</th>
                      {(role === 'ADMIN' || role === 'MANAGER') && (
                        <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {caseloads
                      .filter(c => c.nurseName?.includes('(Nurse)') || (!c.nurseName?.includes('(Doctor)') && !c.nurseName?.includes('(Nurse)')))
                      .map(c => (
                        <tr key={c.id} className="border-b border-[#F0F4FC] hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-4 text-sm font-bold text-[#0F1A3A]">
                            {c.nurseName?.replace(' (Nurse)', '')}
                          </td>
                          <td className="p-4 text-sm font-bold text-brand-blue">
                            {c.assignedCommunities?.join(', ') || 'None'}
                          </td>
                          <td className="p-4 text-sm text-[#5A6A8A] font-semibold">{c.maxDailyVisits} visits/day</td>
                          <td className="p-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              c.available 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {c.available ? 'AVAILABLE' : 'LEAVE'}
                            </span>
                          </td>
                          {(role === 'ADMIN' || role === 'MANAGER') && (
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteCaseload(c.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                title="Delete Caseload allocation"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section B: Doctor Allocations */}
          <div className="bg-white border border-[#EEF2FF] rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#F0F4FC] flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#0F1A3A] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  🩺 Doctor (Physician) Territory Allocations ({date})
                </h4>
                <p className="text-xs text-[#8A97B0] mt-0.5">Doctors assigned to zones to supervise home care patients</p>
              </div>
              <button
                onClick={() => {
                  setCaseloadProviderType('PHYSICIAN');
                  setNewCaseload(prev => ({ ...prev, date: date }));
                  setIsCaseloadOpen(true);
                }}
                className="btn-primary text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={14} /> Configure Doctor Territory
              </button>
            </div>

            {loading && caseloads.length === 0 ? (
              <div className="text-center py-20 text-[#A0AECB]">
                <RefreshCw size={24} className="animate-spin text-brand-blue mx-auto mb-2" />
                <span className="text-xs font-bold uppercase tracking-wider">Loading...</span>
              </div>
            ) : caseloads.filter(c => c.nurseName?.includes('(Doctor)')).length === 0 ? (
              <div className="text-center py-16 text-[#A0AECB] text-xs">
                No Doctor territory configurations mapped for today. Click configure to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#F0F4FC] bg-[#F8FAFC]">
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Doctor (Physician)</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Assigned Territories</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Max Capacity</th>
                      <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider">Availability</th>
                      {(role === 'ADMIN' || role === 'MANAGER') && (
                        <th className="p-4 text-xs font-extrabold text-[#4B5A7A] uppercase tracking-wider text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {caseloads
                      .filter(c => c.nurseName?.includes('(Doctor)'))
                      .map(c => (
                        <tr key={c.id} className="border-b border-[#F0F4FC] hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-4 text-sm font-bold text-[#0F1A3A]">
                            {c.nurseName?.replace(' (Doctor)', '')}
                          </td>
                          <td className="p-4 text-sm font-bold text-brand-blue">
                            {c.assignedCommunities?.join(', ') || 'None'}
                          </td>
                          <td className="p-4 text-sm text-[#5A6A8A] font-semibold">{c.maxDailyVisits} visits/day</td>
                          <td className="p-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              c.available 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                              {c.available ? 'AVAILABLE' : 'LEAVE'}
                            </span>
                          </td>
                          {(role === 'ADMIN' || role === 'MANAGER') && (
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteCaseload(c.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                                title="Delete Caseload allocation"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE REFERRAL MODAL ── */}
      {isReferralOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
              <h3 className="text-base font-bold text-[#0F1A3A]">Initiate Care Program Referral</h3>
              <button
                onClick={() => setIsReferralOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] text-[#8A97B0] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReferral} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 relative">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Search Patient *</label>
                  <div className="relative">
                    <input
                      required
                      placeholder="Type name, email, phone or Patient ID..."
                      value={patientSearchQuery}
                      onChange={e => handlePatientSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none"
                    />
                    {selectedPatient && (
                      <button
                        type="button"
                        onClick={handleClearPatientSelection}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500 hover:text-red-700 bg-white px-1"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {searchingPatients && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl p-3 text-xs text-[#8A97B0]">
                      Searching...
                    </div>
                  )}

                  {patientSearchResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-lg max-h-60 overflow-y-auto z-[9999] border-collapse divide-y divide-[#F0F4FC]">
                      {patientSearchResults.map(p => (
                        <div
                          key={p.patientId}
                          onClick={() => handleSelectPatient(p)}
                          className="p-3 hover:bg-[#F8FAFC] cursor-pointer flex flex-col transition-colors"
                        >
                          <span className="font-bold text-sm text-[#0F1A3A]">
                            {p.patientName || p.displayName || 'Demo Patient'}
                          </span>
                          <span className="text-[11px] text-[#8A97B0] mt-0.5">
                            ID: {p.patientId} · Phone: {p.patientPhone || p.phone || '—'} · Email: {p.email || '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Service Type *</label>
                  <select
                    value={newReferral.serviceType}
                    onChange={e => setNewReferral(prev => ({ ...prev, serviceType: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Frequency *</label>
                  <select
                    value={newReferral.frequency}
                    onChange={e => setNewReferral(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="3x/week">3x per Week (Mon/Wed/Fri)</option>
                    <option value="twice weekly">Twice Weekly (Tue/Fri)</option>
                    <option value="weekly">Once Weekly</option>
                    <option value="every 48 hours">Every 48 Hours</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Home Community Zone *</label>
                  <select
                    value={newReferral.homeCommunity}
                    onChange={e => setNewReferral(prev => ({ ...prev, homeCommunity: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    {COMMUNITIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newReferral.startDate}
                    onChange={e => setNewReferral(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">End Date *</label>
                  <input
                    type="date"
                    required
                    value={newReferral.endDate}
                    onChange={e => setNewReferral(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Priority *</label>
                  <select
                    value={newReferral.priority}
                    onChange={e => setNewReferral(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Special Equipment</label>
                  <input
                    placeholder="e.g. Oxygen tank, IV pole"
                    value={newReferral.specialRequirements}
                    onChange={e => setNewReferral(prev => ({ ...prev, specialRequirements: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Care Instructions *</label>
                <textarea
                  required
                  placeholder="Describe treatment procedures and instructions for the visiting nurse..."
                  value={newReferral.careInstructions}
                  onChange={e => setNewReferral(prev => ({ ...prev, careInstructions: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full btn-primary py-3 rounded-xl font-bold text-sm shadow-lg mt-4"
              >
                Submit & Activate Referral
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE CASELOAD MODAL ── */}
      {isCaseloadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(10, 20, 60, 0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
              <h3 className="text-base font-bold text-[#0F1A3A]">
                {caseloadProviderType === 'PHYSICIAN' ? 'Configure Doctor Territory' : 'Configure Nurse Caseload'}
              </h3>
              <button
                onClick={() => setIsCaseloadOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F0F4FC] text-[#8A97B0] transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCaseload} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B5A7A] uppercase">
                  {caseloadProviderType === 'PHYSICIAN' ? 'Select Doctor *' : 'Select Nurse *'}
                </label>
                {paramedicUsers.filter(u => u.role === caseloadProviderType).length === 0 ? (
                  <p className="text-xs text-red-500 font-semibold">
                    No active {caseloadProviderType === 'PHYSICIAN' ? 'Doctors' : 'Nurses'} found in database.
                  </p>
                ) : (
                  <select
                    value={newCaseload.nurseId}
                    onChange={e => setNewCaseload(prev => ({ ...prev, nurseId: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    {paramedicUsers.filter(u => u.role === caseloadProviderType).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} — {u.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Max Visits Limit *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newCaseload.maxDailyVisits}
                    onChange={e => setNewCaseload(prev => ({ ...prev, maxDailyVisits: parseInt(e.target.value, 10) }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl focus:border-brand-blue outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Availability *</label>
                  <select
                    value={newCaseload.available ? 'true' : 'false'}
                    onChange={e => setNewCaseload(prev => ({ ...prev, available: e.target.value === 'true' }))}
                    className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                  >
                    <option value="true">Available (Active Duty)</option>
                    <option value="false">On Leave (Unavailable)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B5A7A] uppercase">Allocated Community *</label>
                <select
                  value={newCaseload.assignedCommunities[0]}
                  onChange={e => setNewCaseload(prev => ({ ...prev, assignedCommunities: [e.target.value] }))}
                  className="w-full px-3 py-2 text-sm border border-[#DDE3F0] rounded-xl bg-white focus:border-brand-blue cursor-pointer"
                >
                  {COMMUNITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={paramedicUsers.length === 0}
                className="w-full btn-primary py-3 rounded-xl font-bold text-sm shadow-lg mt-4 disabled:opacity-50"
              >
                Save Caseload configuration
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningVisit && (
        <AssignModal
          visit={assigningVisit}
          role={role}
          onClose={() => setAssigningVisit(null)}
          onAssigned={() => { setAssigningVisit(null); fetchVisits(); }}
        />
      )}
    </div>
  );
}
