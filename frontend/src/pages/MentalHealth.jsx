import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Brain,
  Plus,
  Search,
  Activity,
  AlertTriangle,
  HeartPulse,
  Users,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
  FileText,
  Sparkles,
  Flame,
  UserCheck,
  PhoneCall,
  LogOut,
  X
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';

const ADMISSION_TYPES = [
  { value: 'VOLUNTARY', label: 'Voluntary Community Intake' },
  { value: 'FORM_1_INVOLUNTARY_STH', label: 'Form 1 Involuntary - Stanton Territorial Hospital (STH)' },
  { value: 'FORM_1_INVOLUNTARY_HRRHC', label: 'Form 1 Involuntary - Hay River Regional (HRRHC)' },
  { value: 'FORM_1_INVOLUNTARY_IRH', label: 'Form 1 Involuntary - Inuvik Regional (IRH)' },
  { value: 'COMMUNITY_CARE', label: 'Community Outpatient Care' }
];

const CASE_STATUSES = ['ALL', 'OPEN_INTAKE', 'ACTIVE_TREATMENT', 'CRISIS_STABILIZATION', 'RECOVERY_MAINTENANCE', 'DISCHARGED'];

const RISK_LEVELS = [
  { value: 'LOW', label: 'Low Risk', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'MODERATE', label: 'Moderate Risk', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'HIGH', label: 'High Risk', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'CRITICAL', label: 'Critical / Imminent Risk', bg: 'bg-red-100 text-red-800 border-red-200' }
];

const SUBSTANCE_CATEGORIES = ['NONE', 'ALCOHOL', 'OPIOIDS', 'CANNABIS', 'STIMULANTS', 'POLYSUBSTANCE'];

const SESSION_TYPES = [
  'INDIVIDUAL_COUNSELING',
  'GROUP_THERAPY',
  'CRISIS_INTERVENTION',
  'HARM_REDUCTION',
  'TRADITIONAL_HEALING',
  'OPIOID_THERAPY_CHECKIN'
];

const getPatientDisplayName = (p) => {
  if (!p) return 'Patient Record';
  if (p.displayName) return p.displayName;
  if (p.patientName) return p.patientName;
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim();
  if (p.name) return p.name;
  if (p.email) return p.email;
  return p.patientId || p.id || 'Patient Record';
};

export default function MentalHealth() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const { t } = useLanguage();

  // ── Tab & Loading State ───────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'sessions' | 'facilities'
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data States ───────────────────────────────────────────────────────────
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);

  // ── Modal States ──────────────────────────────────────────────────────────
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Patient Autocomplete State inside Intake Modal
  const [patientQuery, setPatientQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);

  // Form States
  const [intakeForm, setIntakeForm] = useState({
    patientId: '',
    assignedFacilityId: 'STH',
    assignedProviderId: '',
    admissionType: 'VOLUNTARY',
    riskLevel: 'LOW',
    riskNotes: '',
    primarySubstance: 'NONE',
    onOpioidAgonistTherapy: false,
    fasdStatus: 'NOT_ASSESSED',
    goals: 'Improve coping strategies, Attend weekly counseling',
    copingMechanisms: 'Breathing exercises, Traditional land activity',
    crisisSafetyPlan: 'Contact 24/7 NWT Helpline (1-800-661-0844) or STH Emergency Dept',
    traditionalHealingIncluded: true,
    emergencyContact: 'Family Elder / Next of Kin (867-555-0199)'
  });

  const [sessionForm, setSessionForm] = useState({
    sessionType: 'INDIVIDUAL_COUNSELING',
    notes: '',
    durationMinutes: 45,
    facilitatedBy: ''
  });

  const [planForm, setPlanForm] = useState({
    goals: '',
    copingMechanisms: '',
    crisisSafetyPlan: '',
    traditionalHealingIncluded: true,
    emergencyContact: ''
  });

  // ── API Fetchers ──────────────────────────────────────────────────────────
  const fetchBackendPatients = useCallback(async (queryStr = '') => {
    try {
      const res = await client.get('/api/admin/patients/search', {
        params: { query: queryStr, limit: 20 },
        hideToast: true
      });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBackendPatients(patientQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery, fetchBackendPatients]);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'ALL' ? { status: statusFilter } : {};
      const res = await client.get('/api/mental-health/cases', { params, hideToast: true });
      let list = [];
      if (res.data?.content) list = res.data.content;
      else if (Array.isArray(res.data)) list = res.data;
      setCases(list);
      if (list.length > 0 && !selectedCase) {
        setSelectedCase(list[0]);
      }
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCase]);

  const fetchSessions = useCallback(async (caseId) => {
    if (!caseId) return;
    try {
      const res = await client.get(`/api/mental-health/cases/${caseId}/sessions`, { hideToast: true });
      if (res.data?.content) setSessionLogs(res.data.content);
      else if (Array.isArray(res.data)) setSessionLogs(res.data);
    } catch {
      setSessionLogs([]);
    }
  }, []);

  // ── Facilities State ──────────────────────────────────────────────────────
  const [facilities, setFacilities] = useState([]);
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilityForm, setFacilityForm] = useState({
    name: '',
    community: '',
    region: 'Yellowknife',
    isPrivate: false,
    bedCapacity: 12
  });

  const fetchFacilities = useCallback(async () => {
    try {
      const res = await client.get('/api/ltc/facilities', { hideToast: true });
      const list = res.data || [];
      if (list.length > 0) {
        setFacilities(list);
      } else {
        setFacilities([
          { id: 'STH', name: 'Stanton Territorial Hospital (STH)', community: 'Yellowknife', region: 'Yellowknife / North Slave', bedCapacity: 12, active: true },
          { id: 'HRRHC', name: 'Hay River Regional Health Centre (HRRHC)', community: 'Hay River', region: 'South Slave', bedCapacity: 6, active: true },
          { id: 'IRH', name: 'Inuvik Regional Hospital (IRH)', community: 'Inuvik', region: 'Beaufort-Delta', bedCapacity: 8, active: true }
        ]);
      }
    } catch {
      setFacilities([
        { id: 'STH', name: 'Stanton Territorial Hospital (STH)', community: 'Yellowknife', region: 'Yellowknife / North Slave', bedCapacity: 12, active: true },
        { id: 'HRRHC', name: 'Hay River Regional Health Centre (HRRHC)', community: 'Hay River', region: 'South Slave', bedCapacity: 6, active: true },
        { id: 'IRH', name: 'Inuvik Regional Hospital (IRH)', community: 'Inuvik', region: 'Beaufort-Delta', bedCapacity: 8, active: true }
      ]);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchFacilities();
  }, [fetchCases, fetchFacilities]);

  useEffect(() => {
    if (selectedCase) {
      fetchSessions(selectedCase.id);
    }
  }, [selectedCase, fetchSessions]);

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleSelectPatient = (p) => {
    setSelectedPatientObj(p);
    setIntakeForm((prev) => ({ ...prev, patientId: p.patientId || p.id }));
    setPatientQuery('');
    setShowSearchDropdown(false);
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!intakeForm.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please select a patient for intake.' }));
      return;
    }

    const payload = {
      ...intakeForm,
      goals: intakeForm.goals.split(',').map((s) => s.trim()).filter(Boolean),
      copingMechanisms: intakeForm.copingMechanisms.split(',').map((s) => s.trim()).filter(Boolean)
    };

    try {
      const res = await client.post('/api/mental-health/cases', payload);
      setSelectedCase(res.data);
      fetchCases();
      dispatch(addToast({ type: 'success', message: `Mental Health Intake Case ${res.data.caseNumber} created!` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Intake creation failed.' }));
    } finally {
      setShowIntakeModal(false);
    }
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const res = await client.post(`/api/mental-health/cases/${selectedCase.id}/sessions`, sessionForm);
      setSessionLogs([res.data, ...sessionLogs]);
      dispatch(addToast({ type: 'success', message: 'Counseling session logged successfully!' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to log session.' }));
    } finally {
      setShowSessionModal(false);
      setSessionForm({ sessionType: 'INDIVIDUAL_COUNSELING', notes: '', durationMinutes: 45, facilitatedBy: '' });
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase) return;
    const payload = {
      goals: planForm.goals.split(',').map((s) => s.trim()).filter(Boolean),
      copingMechanisms: planForm.copingMechanisms.split(',').map((s) => s.trim()).filter(Boolean),
      crisisSafetyPlan: planForm.crisisSafetyPlan,
      traditionalHealingIncluded: planForm.traditionalHealingIncluded,
      emergencyContact: planForm.emergencyContact
    };
    try {
      const res = await client.put(`/api/mental-health/cases/${selectedCase.id}/recovery-plan`, payload);
      setSelectedCase(res.data);
      fetchCases();
      dispatch(addToast({ type: 'success', message: 'Recovery Plan updated successfully!' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Plan update failed.' }));
    } finally {
      setShowPlanModal(false);
    }
  };

  const handleDischargeCase = async (caseId) => {
    try {
      const res = await client.put(`/api/mental-health/cases/${caseId}/status`, null, {
        params: { status: 'DISCHARGED' }
      });
      setSelectedCase(res.data);
      fetchCases();
      dispatch(addToast({ type: 'success', message: 'Case closed and discharged.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Status update failed.' }));
    }
  };

  const handleFacilitySubmit = async (e) => {
    e.preventDefault();
    if (!facilityForm.name) {
      dispatch(addToast({ type: 'error', message: 'Facility name is required.' }));
      return;
    }
    try {
      const payload = {
        name: facilityForm.name,
        community: facilityForm.community,
        region: facilityForm.region,
        bedCapacity: Number(facilityForm.bedCapacity),
        isPrivate: facilityForm.isPrivate
      };
      const res = await client.post('/api/ltc/facilities', payload);
      setFacilities((prev) => [...prev, res.data]);
      dispatch(addToast({ type: 'success', message: `Facility "${res.data.name}" registered successfully!` }));
      setShowFacilityModal(false);
      setFacilityForm({ name: '', community: '', region: 'Yellowknife', isPrivate: false, bedCapacity: 12 });
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to register facility.' }));
    }
  };

  // Filtered Roster
  const filteredCases = cases.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || c.caseNumber?.toLowerCase().includes(q) || c.patientId?.toLowerCase().includes(q) || c.primarySubstance?.toLowerCase().includes(q);
    return matchQ;
  });

  // KPI Calculations
  const activeCount = cases.filter((c) => c.status !== 'DISCHARGED').length;
  const criticalCount = cases.filter((c) => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length;
  const involuntaryCount = cases.filter((c) => c.admissionType?.startsWith('FORM_1')).length;
  const oatCount = cases.filter((c) => c.onOpioidAgonistTherapy).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Banner (Long-Term Care Style) ─────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F2D6B] to-[#0A1128] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-red-500/80 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Brain size={13} /> {t('mh_domain_badge')}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('mh_title')}</h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            {t('mh_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowIntakeModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
          >
            <Plus size={16} /> {t('mh_open_case')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards Bar ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('mh_active_cases')}</span>
            <span className="text-xl font-black text-slate-800">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-xl">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('mh_crisis_alerts')}</span>
            <span className="text-xl font-black text-red-600">{criticalCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-brand-blue rounded-xl">
            <Building2 size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('mh_sessions_today')}</span>
            <span className="text-xl font-black text-slate-900">{involuntaryCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Flame size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('mh_recovery_plans')}</span>
            <span className="text-xl font-black text-emerald-800">{oatCount}</span>
          </div>
        </div>
      </div>

      {/* ── Main Tab Headers ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('cases')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'cases' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Brain size={18} /> {t('mh_tab_cases')}
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'sessions' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={18} /> {t('mh_tab_sessions')}
        </button>
        <button
          onClick={() => setActiveTab('facilities')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'facilities' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 size={18} /> {t('mh_tab_crisis')}
        </button>
      </div>

      {/* ── TAB 1: ACTIVE CASES ROSTER ─────────────────────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Filter & Case Roster List */}
          <div className="md:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('action_search') + '...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
              {CASE_STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                    statusFilter === st ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-500 py-6 text-center">{t('loading')}</p>
              ) : filteredCases.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">{t('mh_no_cases')}</p>
              ) : (
                filteredCases.map((c) => {
                  const riskObj = RISK_LEVELS.find((r) => r.value === c.riskLevel) || RISK_LEVELS[0];
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedCase?.id === c.id
                          ? 'border-red-600 bg-red-50/40 shadow-sm'
                          : 'border-slate-200 hover:border-red-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900">{c.caseNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${riskObj.bg}`}>
                            {riskObj.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold">
                          Patient ID: <span className="font-bold text-slate-800">{c.patientId}</span> • {c.assignedFacilityId || 'STH'}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right 2 Columns: Selected Case Master View */}
          <div className="md:col-span-2 space-y-6">
            {selectedCase ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border border-red-100">
                        Case: {selectedCase.caseNumber}
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border border-emerald-100">
                        {selectedCase.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-800">
                      Patient ID: {selectedCase.patientId}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Facility: <span className="font-bold text-slate-700">{selectedCase.assignedFacilityId || 'Stanton Territorial Hospital'}</span> • Type: <span className="font-bold text-brand-blue">{selectedCase.admissionType}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setPlanForm({
                          goals: selectedCase.recoveryPlan?.goals?.join(', ') || '',
                          copingMechanisms: selectedCase.recoveryPlan?.copingMechanisms?.join(', ') || '',
                          crisisSafetyPlan: selectedCase.recoveryPlan?.crisisSafetyPlan || '',
                          traditionalHealingIncluded: selectedCase.recoveryPlan?.traditionalHealingIncluded ?? true,
                          emergencyContact: selectedCase.recoveryPlan?.emergencyContact || ''
                        });
                        setShowPlanModal(true);
                      }}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles size={14} className="text-brand-blue" /> {t('mh_recovery_update')}
                    </button>
                    <button
                      onClick={() => setShowSessionModal(true)}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus size={14} /> {t('mh_log_session')}
                    </button>
                  </div>
                </div>

                {/* Risk Triage & Addictions Details Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Suicide Risk Triage Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <AlertTriangle size={14} className="text-red-500" /> {t('mh_risk_assessment')}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        RISK_LEVELS.find((r) => r.value === selectedCase.riskLevel)?.bg || 'bg-slate-200'
                      }`}>
                        {selectedCase.riskLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      {selectedCase.riskNotes || 'No immediate crisis notes flagged during intake.'}
                    </p>
                  </div>

                  {/* Addictions & Harm Reduction Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Flame size={14} className="text-orange-500" /> {t('mh_case_details')}
                    </span>
                    <div className="text-xs space-y-1 text-slate-800">
                      <p>Primary Substance: <span className="font-bold text-red-700">{selectedCase.primarySubstance || 'NONE'}</span></p>
                      <p>Opioid Agonist Therapy (OAT): <span className="font-bold text-emerald-700">{selectedCase.onOpioidAgonistTherapy ? 'ACTIVE (Methadone/Suboxone)' : 'NO'}</span></p>
                      <p>Adult FASD Assessment: <span className="font-bold text-slate-700">{selectedCase.fasdStatus || 'NOT_ASSESSED'}</span></p>
                    </div>
                  </div>
                </div>

                {/* Personal Recovery Plan Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <Sparkles size={16} className="text-red-600" /> {t('mh_recovery_plan')}
                    </h4>
                    {selectedCase.recoveryPlan?.traditionalHealingIncluded && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                        Traditional Healing Supported
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_recovery_goals')}</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-800 font-semibold">
                        {selectedCase.recoveryPlan?.goals?.map((g, i) => <li key={i}>{g}</li>) || <li>Daily wellness check-in</li>}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_coping')}</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-800 font-semibold">
                        {selectedCase.recoveryPlan?.copingMechanisms?.map((c, i) => <li key={i}>{c}</li>) || <li>Mindfulness &amp; outdoor land activity</li>}
                      </ul>
                    </div>

                    <div className="md:col-span-2 bg-white p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_plan')}</span>
                      <p className="text-slate-800 font-bold">
                        {selectedCase.recoveryPlan?.crisisSafetyPlan || 'Contact 24/7 NWT Helpline (1-800-661-0844) or nearest Community Health Centre'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1">
                        Emergency Contact: <span className="font-bold text-slate-800">{selectedCase.recoveryPlan?.emergencyContact || 'Family Next of Kin'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Session Log History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <FileText size={16} className="text-red-600" /> {t('mh_tab_sessions')}
                  </h4>
                  {sessionLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">{t('mh_no_sessions')}</p>
                  ) : (
                    <div className="space-y-2">
                      {sessionLogs.map((s) => (
                        <div key={s.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                              {s.sessionType}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {new Date(s.loggedAt || s.sessionDate).toLocaleString()} • {s.durationMinutes} mins
                            </span>
                          </div>
                          <p className="text-slate-700 font-medium mt-1">{s.notes}</p>
                          <p className="text-[10px] text-slate-400 font-bold">Facilitated by: {s.facilitatedBy || s.loggedBy || 'Counselor'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
                <Brain size={48} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold">{t('mh_select_case')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: COUNSELING & THERAPY SESSIONS LOG ───────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800">{t('mh_tab_sessions')}</h3>
            <span className="text-xs text-slate-500 font-semibold">{t('mh_aes_decrypted')}</span>
          </div>

          {sessionLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center italic">{t('mh_select_case')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessionLogs.map((s) => (
                <div key={s.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-md text-[10px]">
                      {s.sessionType}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {new Date(s.loggedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium">{s.notes}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-200 pt-2">
                    <span>Duration: {s.durationMinutes} mins</span>
                    <span>Facilitator: {s.facilitatedBy || s.loggedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: LEGISLATIVE ADMISSION HUBS (DYNAMIC) ────────────────────────── */}
      {activeTab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">NWT Legislative Admission Hubs &amp; Facilities</h3>
              <p className="text-xs text-slate-500 font-medium">Designated Form 1 Involuntary Psychiatric Admission Hubs &amp; Regional Health Centres</p>
            </div>
            <button
              onClick={() => setShowFacilityModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Plus size={16} /> Register New Admission Hub
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {facilities.map((f) => {
              const assignedCount = cases.filter(
                (c) => (c.assignedFacilityId === f.id || c.assignedFacilityId === f.name) && c.status !== 'DISCHARGED'
              ).length;
              const availableBeds = Math.max(0, (f.bedCapacity || 10) - assignedCount);

              return (
                <div key={f.id || f.name} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-brand-blue border border-blue-100 text-[10px] font-black rounded uppercase">
                      {f.region || 'NWT Region'}
                    </span>
                    <Building2 size={20} className="text-brand-blue" />
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-800">{f.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">Community: <span className="font-bold text-slate-700">{f.community}</span></p>
                  </div>

                  <div className="text-xs font-bold text-slate-700 bg-slate-50 p-3.5 rounded-xl space-y-1.5 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span>Total Bed Capacity:</span>
                      <span className="font-black text-slate-900">{f.bedCapacity || 10} Beds</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Mental Health Cases:</span>
                      <span className="font-black text-red-600">{assignedCount} Active</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                      <span>Open Psychiatric Capacity:</span>
                      <span className="font-black text-emerald-700">{availableBeds} Open</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL 1: NEW MENTAL HEALTH INTAKE ─────────────────────────────────── */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Brain size={18} className="text-purple-600" /> {t('mh_case_intake')}
              </h3>
              <button onClick={() => setShowIntakeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-4 text-xs">
              {/* Patient Autocomplete */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('form_search_patient')}</label>
                <input
                  type="text"
                  placeholder={t('form_type_patient_name')}
                  value={patientQuery}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                    fetchBackendPatients(patientQuery);
                  }}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />

                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="mt-1 bg-white border border-slate-200 rounded-xl max-h-40 overflow-y-auto shadow-xl z-50">
                    {searchResults.map((p) => {
                      const name = getPatientDisplayName(p);
                      const idStr = p.patientId || p.id || '';
                      return (
                        <div
                          key={p.id || p.patientId}
                          onClick={() => handleSelectPatient(p)}
                          className="px-3 py-2 hover:bg-purple-50 cursor-pointer text-xs border-b border-slate-100 flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">ID: {idStr}</p>
                          </div>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedPatientObj && (
                  <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-purple-900">{getPatientDisplayName(selectedPatientObj)}</p>
                      <p className="text-[10px] text-purple-700 font-semibold">ID: {selectedPatientObj.patientId || selectedPatientObj.id}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-purple-600" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('form_facility')}</label>
                <select
                  value={intakeForm.assignedFacilityId}
                  onChange={(e) => setIntakeForm({ ...intakeForm, assignedFacilityId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  {facilities.map((f) => (
                    <option key={f.id || f.name} value={f.id || f.name}>
                      {f.name} ({f.community || f.region || 'NWT'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_case_type')}</label>
                  <select
                    value={intakeForm.admissionType}
                    onChange={(e) => setIntakeForm({ ...intakeForm, admissionType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    {ADMISSION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_risk_level')}</label>
                  <select
                    value={intakeForm.riskLevel}
                    onChange={(e) => setIntakeForm({ ...intakeForm, riskLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Primary Substance</label>
                  <select
                    value={intakeForm.primarySubstance}
                    onChange={(e) => setIntakeForm({ ...intakeForm, primarySubstance: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    {SUBSTANCE_CATEGORIES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Opioid Agonist Therapy (OAT)</label>
                  <select
                    value={intakeForm.onOpioidAgonistTherapy ? 'true' : 'false'}
                    onChange={(e) => setIntakeForm({ ...intakeForm, onOpioidAgonistTherapy: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="false">No</option>
                    <option value="true">Active (Methadone / Suboxone)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_recovery_goals')}</label>
                <input
                  type="text"
                  value={intakeForm.goals}
                  onChange={(e) => setIntakeForm({ ...intakeForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_plan')}</label>
                <textarea
                  rows={2}
                  value={intakeForm.crisisSafetyPlan}
                  onChange={(e) => setIntakeForm({ ...intakeForm, crisisSafetyPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  {t('action_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: LOG THERAPY SESSION ───────────────────────────────────────── */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-red-600" /> {t('mh_log_session')}
              </h3>
              <button onClick={() => setShowSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSessionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_session_type')}</label>
                  <select
                    value={sessionForm.sessionType}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    {SESSION_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_session_duration')}</label>
                  <input
                    type="number"
                    value={sessionForm.durationMinutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_session_notes')}</label>
                <textarea
                  rows={3}
                  required
                  placeholder={t('form_soap_notes')}
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  {t('action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: UPDATE RECOVERY PLAN ────────────────────────────────────── */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Sparkles size={18} className="text-red-600" /> {t('mh_recovery_update')}
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_recovery_goals')}</label>
                <input
                  type="text"
                  value={planForm.goals}
                  onChange={(e) => setPlanForm({ ...planForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_coping')}</label>
                <input
                  type="text"
                  value={planForm.copingMechanisms}
                  onChange={(e) => setPlanForm({ ...planForm, copingMechanisms: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_plan')}</label>
                <textarea
                  rows={2}
                  value={planForm.crisisSafetyPlan}
                  onChange={(e) => setPlanForm({ ...planForm, crisisSafetyPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('mh_crisis_contacts')}</label>
                <input
                  type="text"
                  value={planForm.emergencyContact}
                  onChange={(e) => setPlanForm({ ...planForm, emergencyContact: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  {t('action_save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: REGISTER NEW ADMISSION HUB ───────────────────────────────── */}
      {showFacilityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Building2 size={18} className="text-red-600" /> {t('ltc_register_facility')}
              </h3>
              <button onClick={() => setShowFacilityModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFacilitySubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('ltc_facility_name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('ltc_placeholder_name')}
                  value={facilityForm.name}
                  onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('community')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('community')}
                    value={facilityForm.community}
                    onChange={(e) => setFacilityForm({ ...facilityForm, community: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('nwt_region')}</label>
                  <select
                    value={facilityForm.region}
                    onChange={(e) => setFacilityForm({ ...facilityForm, region: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="Yellowknife / North Slave">{t('region_north_slave')}</option>
                    <option value="South Slave">{t('region_south_slave')}</option>
                    <option value="Beaufort-Delta">{t('region_beaufort')}</option>
                    <option value="Dehcho">{t('region_dehcho')}</option>
                    <option value="Sahtu">{t('region_sahtu')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">{t('psych_bed_capacity')}</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={facilityForm.bedCapacity}
                  onChange={(e) => setFacilityForm({ ...facilityForm, bedCapacity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFacilityModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  {t('action_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
