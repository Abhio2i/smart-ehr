import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  HeartHandshake,
  Plus,
  Search,
  ShieldAlert,
  Users,
  Home,
  FileText,
  Award,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Heart,
  UserCheck,
  X
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';

const RISK_LEVELS = [
  { value: 'LOW', label: 'Low Risk', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'MODERATE', label: 'Moderate Risk', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'HIGH', label: 'High Protection Risk', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'IMMEDIATE_PROTECTION', label: 'Immediate Protection Alert', bg: 'bg-red-100 text-red-800 border-red-200' }
];

const CUSTODY_STATUSES = [
  { value: 'VOLUNTARY_CARE_AGREEMENT', label: 'Voluntary Care Agreement' },
  { value: 'INTERIM_CUSTODY_ORDER', label: 'Interim Custody Order' },
  { value: 'PERMANENT_CUSTODY', label: 'Permanent Custody Order' },
  { value: 'SUPPORT_SERVICES', label: 'Family Support Services' }
];

const CASE_STATUSES = ['ALL', 'OPEN_INTAKE', 'ACTIVE_PROTECTION', 'FOSTER_PLACEMENT', 'ADOPTION_PENDING', 'DISCHARGED'];

const getPatientDisplayName = (p) => {
  if (!p) return 'Child Record';
  if (p.displayName) return p.displayName;
  if (p.patientName) return p.patientName;
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim();
  if (p.name) return p.name;
  return p.patientId || p.id || 'Child Record';
};

export default function ChildFamilyServices() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const { t } = useLanguage();

  // ── Tabs & Navigation ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'foster' | 'adoptions'
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data States ───────────────────────────────────────────────────────────
  const [cfsCases, setCfsCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [fosterHomes, setFosterHomes] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [adoptions, setAdoptions] = useState([]);

  // ── Modal States ──────────────────────────────────────────────────────────
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showFosterModal, setShowFosterModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [showAdoptionModal, setShowAdoptionModal] = useState(false);

  // Patient Autocomplete State inside Intake Modal
  const [patientQuery, setPatientQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);

  // Form States
  const [intakeForm, setIntakeForm] = useState({
    childPatientId: '',
    childName: '',
    dateOfBirth: '',
    gender: 'MALE',
    indigenousCommunity: '',
    protectionRiskLevel: 'LOW',
    legalCustodyStatus: 'VOLUNTARY_CARE_AGREEMENT',
    assignedSocialWorkerId: currentUser?.email || '',
    assignedCommunityFacilityId: '',
    protectionConcerns: '',
    familySafetyPlan: '',
    emergencyContact: ''
  });

  const [fosterForm, setFosterForm] = useState({
    primaryCaregiverName: '',
    secondaryCaregiverName: '',
    homeType: 'REGULAR_FOSTER_HOME',
    community: '',
    region: '',
    maxChildCapacity: 2,
    contactPhone: ''
  });

  const [placementForm, setPlacementForm] = useState({
    fosterHomeId: '',
    placementType: 'LICENSED_FOSTER',
    placementStartDate: new Date().toISOString().split('T')[0],
    monthlyStipendAmount: 1200.0,
    notes: ''
  });

  const [adoptionForm, setAdoptionForm] = useState({
    cfsCaseId: '',
    childPatientId: '',
    adoptionType: 'CUSTOM_INDIGENOUS_ADOPTION',
    adoptiveParentNames: '',
    community: '',
    region: '',
    customAdoptionCommissionerName: 'Custom Adoption Commissioner Elder',
    bandCouncilSupportReceived: true
  });

  // ── API Fetchers ──────────────────────────────────────────────────────────
  const fetchBackendPatients = useCallback(async (queryStr) => {
    if (!queryStr || queryStr.length < 2) {
      setSearchResults([]);
      return;
    }
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
      const res = await client.get('/api/cfs/cases', { params, hideToast: true });
      let list = [];
      if (res.data?.content) list = res.data.content;
      else if (Array.isArray(res.data)) list = res.data;

      setCfsCases(list);
      if (list.length > 0 && !selectedCase) {
        setSelectedCase(list[0]);
      }
    } catch {
      setCfsCases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCase]);

  const fetchFosterHomes = useCallback(async () => {
    try {
      const res = await client.get('/api/cfs/foster-homes', { hideToast: true });
      setFosterHomes(res.data || []);
    } catch {
      setFosterHomes([]);
    }
  }, []);

  const fetchAdoptions = useCallback(async () => {
    try {
      const res = await client.get('/api/cfs/adoptions', { hideToast: true });
      let list = [];
      if (res.data?.content) list = res.data.content;
      else if (Array.isArray(res.data)) list = res.data;

      setAdoptions(list);
    } catch {
      setAdoptions([]);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchFosterHomes();
    fetchAdoptions();
  }, [fetchCases, fetchFosterHomes, fetchAdoptions]);

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleSelectPatient = (p) => {
    setSelectedPatientObj(p);
    setIntakeForm((prev) => ({
      ...prev,
      childPatientId: p.patientId || p.id,
      childName: getPatientDisplayName(p),
      dateOfBirth: p.dateOfBirth || '2019-01-01'
    }));
    setPatientQuery('');
    setShowSearchDropdown(false);
  };

  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!intakeForm.childName) {
      dispatch(addToast({ type: 'error', message: 'Please enter child name or select patient.' }));
      return;
    }

    const payload = {
      ...intakeForm,
      protectionConcerns: intakeForm.protectionConcerns.split(',').map((s) => s.trim()).filter(Boolean)
    };

    try {
      const res = await client.post('/api/cfs/cases', payload);
      setSelectedCase(res.data);
      fetchCases();
      dispatch(addToast({ type: 'success', message: `CFS Case ${res.data.caseNumber} opened successfully!` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Intake failed.' }));
    } finally {
      setShowIntakeModal(false);
    }
  };

  const handleFosterSubmit = async (e) => {
    e.preventDefault();
    if (!fosterForm.primaryCaregiverName) {
      dispatch(addToast({ type: 'error', message: 'Caregiver name is required.' }));
      return;
    }
    try {
      const res = await client.post('/api/cfs/foster-homes', fosterForm);
      setFosterHomes((prev) => [...prev, res.data]);
      dispatch(addToast({ type: 'success', message: `Foster Home ${res.data.homeLicenseNumber} registered!` }));
      setShowFosterModal(false);
      setFosterForm({
        primaryCaregiverName: '',
        secondaryCaregiverName: '',
        homeType: 'REGULAR_FOSTER_HOME',
        community: '',
        region: '',
        maxChildCapacity: 2,
        contactPhone: ''
      });
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to register home.' }));
    }
  };

  const handlePlacementSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCase || !placementForm.fosterHomeId) {
      dispatch(addToast({ type: 'error', message: 'Please select a foster home.' }));
      return;
    }
    try {
      const res = await client.post(`/api/cfs/cases/${selectedCase.id}/placements`, placementForm);
      setPlacements((prev) => [...prev, res.data]);
      fetchCases();
      fetchFosterHomes();
      dispatch(addToast({ type: 'success', message: 'Child placement record created!' }));
      setShowPlacementModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Placement creation failed.' }));
    }
  };

  const handleAdoptionSubmit = async (e) => {
    e.preventDefault();
    if (!adoptionForm.adoptiveParentNames) {
      dispatch(addToast({ type: 'error', message: 'Adoptive parent names are required.' }));
      return;
    }
    const payload = {
      ...adoptionForm,
      cfsCaseId: selectedCase?.id || adoptionForm.cfsCaseId,
      childPatientId: selectedCase?.childPatientId || 'PAT-CHILD-01'
    };
    try {
      const res = await client.post('/api/cfs/adoptions', payload);
      setAdoptions((prev) => [...prev, res.data]);
      fetchCases();
      dispatch(addToast({ type: 'success', message: `Adoption file ${res.data.adoptionFileNumber} initiated!` }));
      setShowAdoptionModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Adoption filing failed.' }));
    }
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const activeCasesCount = cfsCases.filter((c) => c.caseStatus !== 'DISCHARGED').length;
  const highRiskCount = cfsCases.filter((c) => c.protectionRiskLevel === 'HIGH' || c.protectionRiskLevel === 'IMMEDIATE_PROTECTION').length;
  const fosterPlacementsCount = cfsCases.filter((c) => c.caseStatus === 'FOSTER_PLACEMENT').length;
  const customAdoptionsCount = adoptions.filter((a) => a.adoptionType === 'CUSTOM_INDIGENOUS_ADOPTION').length;

  const filteredCases = cfsCases.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || c.caseNumber?.toLowerCase().includes(q) || c.childName?.toLowerCase().includes(q) || c.childPatientId?.toLowerCase().includes(q);
    return matchQ;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Banner (Long-Term Care / Signature Theme) ─────────────── */}
      <div className="bg-gradient-to-r from-[#0F2D6B] to-[#0A1128] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-red-500/80 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <HeartHandshake size={13} /> {t('cfs_domain_badge')}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('cfs_title')}</h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            {t('cfs_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowIntakeModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
          >
            <Plus size={16} /> {t('cfs_open_case')}
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('cfs_active_cases')}</span>
            <span className="text-xl font-black text-slate-800">{activeCasesCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-xl">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('cfs_risk_level')}</span>
            <span className="text-xl font-black text-red-600">{highRiskCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-brand-blue rounded-xl">
            <Home size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('cfs_placements')}</span>
            <span className="text-xl font-black text-slate-900">{fosterPlacementsCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Award size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('cfs_pending_adoptions')}</span>
            <span className="text-xl font-black text-emerald-800">{customAdoptionsCount}</span>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Tabs ───────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('cases')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'cases' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HeartHandshake size={18} /> {t('cfs_tab_cases')}
        </button>
        <button
          onClick={() => setActiveTab('foster')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'foster' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home size={18} /> {t('cfs_tab_foster')}
        </button>
        <button
          onClick={() => setActiveTab('adoptions')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'adoptions' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award size={18} /> {t('cfs_tab_adoptions')}
        </button>
      </div>

      {/* ── TAB 1: CHILD PROTECTION CASE ROSTER ───────────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Filter & Case Roster */}
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
                <p className="text-xs text-slate-500 py-6 text-center">Loading CFS cases...</p>
              ) : filteredCases.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">No child protection cases found.</p>
              ) : (
                filteredCases.map((c) => {
                  const riskObj = RISK_LEVELS.find((r) => r.value === c.protectionRiskLevel) || RISK_LEVELS[0];
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
                          <span className="font-extrabold text-xs text-slate-900">{c.childName || c.caseNumber}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${riskObj.bg}`}>
                            {riskObj.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold">
                          Case: <span className="font-bold text-slate-800">{c.caseNumber}</span> • {c.indigenousCommunity || 'NWT Community'}
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
                        {selectedCase.caseStatus}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-800">
                      Child Name: {selectedCase.childName} (DOB: {selectedCase.dateOfBirth || 'N/A'})
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Indigenous Community: <span className="font-bold text-slate-700">{selectedCase.indigenousCommunity || 'NWT Community'}</span> • Worker: <span className="font-bold text-brand-blue">{selectedCase.assignedSocialWorkerId}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPlacementModal(true)}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Home size={14} /> Assign Foster Placement
                    </button>
                    <button
                      onClick={() => setShowAdoptionModal(true)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Award size={14} className="text-brand-blue" /> File Adoption
                    </button>
                  </div>
                </div>

                {/* Risk Triage & Legal Status Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <AlertTriangle size={14} className="text-red-500" /> Child Protection Risk Level
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                        RISK_LEVELS.find((r) => r.value === selectedCase.protectionRiskLevel)?.bg || 'bg-slate-200'
                      }`}>
                        {selectedCase.protectionRiskLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      Concerns: <span className="font-bold">{selectedCase.protectionConcerns?.join(', ') || 'Community supervision support'}</span>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <FileText size={14} className="text-blue-500" /> Legal Custody Status Order
                    </span>
                    <div className="text-xs space-y-1 text-slate-800 font-semibold">
                      <p>Order Type: <span className="font-bold text-brand-blue">{selectedCase.legalCustodyStatus}</span></p>
                      <p>CFS Centre: <span className="font-bold text-slate-700">{selectedCase.assignedCommunityFacilityId}</span></p>
                    </div>
                  </div>
                </div>

                {/* Encrypted Family Safety Plan Card */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <HeartHandshake size={16} className="text-red-600" /> Encrypted Family Safety &amp; Wellness Plan
                    </h4>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                      AES-256 Encrypted Note
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 font-bold bg-white p-3 rounded-xl border border-slate-200">
                    {selectedCase.familySafetyPlanEncrypted || 'Standard community wellness & safety agreement in effect.'}
                  </p>

                  <p className="text-[10px] text-slate-500 font-semibold">
                    Emergency Kinship Contact: <span className="font-bold text-slate-800">{selectedCase.emergencyContact || 'Family Next of Kin'}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 italic">
                Select a child protection case from the roster to view master details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: FOSTER CARE & KINSHIP PLACEMENT HUB ─────────────────────────── */}
      {activeTab === 'foster' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Licensed Foster Homes &amp; Kinship Caregivers</h3>
              <p className="text-xs text-slate-500 font-medium">NWT Approved Foster Homes, Kinship Placements &amp; Monthly Maintenance Stipends</p>
            </div>
            <button
              onClick={() => setShowFosterModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Plus size={16} /> Register Approved Foster Home
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fosterHomes.map((fh) => (
              <div key={fh.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-blue-50 text-brand-blue border border-blue-100 text-[10px] font-black rounded uppercase">
                    License: {fh.homeLicenseNumber}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    {fh.licenseStatus}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-800">{fh.primaryCaregiverName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Community: <span className="font-bold text-slate-700">{fh.community}</span> ({fh.region})</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Max Capacity</span>
                    <span className="font-black text-slate-900">{fh.maxChildCapacity} Children</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Current Placements</span>
                    <span className="font-black text-red-600">{fh.currentPlacementCount} Placed</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Care Type</span>
                    <span className="font-black text-brand-blue">{fh.homeType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block">Safety Check</span>
                    <span className="font-black text-emerald-700">{fh.homeSafetyAssessmentApproved ? 'PASSED' : 'PENDING'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: CUSTOM INDIGENOUS & STATUTORY ADOPTIONS ────────────────────── */}
      {activeTab === 'adoptions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">NWT Custom Indigenous &amp; Legal Statutory Adoptions</h3>
              <p className="text-xs text-slate-500 font-medium">Custom Adoption Commissioners, Band Council Resolutions &amp; Court Finalizations</p>
            </div>
            <button
              onClick={() => setShowAdoptionModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Plus size={16} /> File New Adoption Case
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {adoptions.map((a) => (
              <div key={a.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-100 text-[10px] font-black rounded uppercase">
                    File #: {a.adoptionFileNumber}
                  </span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    {a.courtOrderStatus}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-800">Parents: {a.adoptiveParentNames}</h3>
                  <p className="text-xs text-slate-500 font-medium">Type: <span className="font-bold text-purple-700">{a.adoptionType}</span></p>
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p>Commissioner: <span className="font-black text-slate-900">{a.customAdoptionCommissionerName || 'NWT Adoption Commissioner'}</span></p>
                  <p>Band Council Support: <span className="font-black text-emerald-700">{a.bandCouncilSupportReceived ? 'APPROVED & SUPPORTED' : 'PENDING'}</span></p>
                  <p>Home Study Status: <span className="font-black text-brand-blue">{a.homeStudyStatus}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL 1: NEW CFS INTAKE ────────────────────────────────────────────── */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <HeartHandshake size={18} className="text-red-600" /> Open Child &amp; Family Protection Case
              </h3>
              <button onClick={() => setShowIntakeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-4 text-xs">
              {/* Patient Autocomplete */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Search Patient Record</label>
                <input
                  type="text"
                  placeholder="Type child name, ID..."
                  value={patientQuery}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                    fetchBackendPatients(patientQuery);
                  }}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-red-500"
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
                          className="px-3 py-2 hover:bg-red-50 cursor-pointer text-xs border-b border-slate-100 flex items-center justify-between"
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
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-red-900">{getPatientDisplayName(selectedPatientObj)}</p>
                      <p className="text-[10px] text-red-700 font-semibold">ID: {selectedPatientObj.patientId || selectedPatientObj.id}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-red-600" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Child Name</label>
                <input
                  type="text"
                  required
                  value={intakeForm.childName}
                  onChange={(e) => setIntakeForm({ ...intakeForm, childName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Indigenous Community</label>
                  <input
                    type="text"
                    value={intakeForm.indigenousCommunity}
                    onChange={(e) => setIntakeForm({ ...intakeForm, indigenousCommunity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Protection Risk Level</label>
                  <select
                    value={intakeForm.protectionRiskLevel}
                    onChange={(e) => setIntakeForm({ ...intakeForm, protectionRiskLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    {RISK_LEVELS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Legal Custody Status Order</label>
                <select
                  value={intakeForm.legalCustodyStatus}
                  onChange={(e) => setIntakeForm({ ...intakeForm, legalCustodyStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  {CUSTODY_STATUSES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Family Safety Plan (Encrypted)</label>
                <textarea
                  rows={2}
                  value={intakeForm.familySafetyPlan}
                  onChange={(e) => setIntakeForm({ ...intakeForm, familySafetyPlan: e.target.value })}
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
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Open CFS Case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: REGISTER FOSTER HOME ─────────────────────────────────────── */}
      {showFosterModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Home size={18} className="text-red-600" /> Register Foster / Kinship Home
              </h3>
              <button onClick={() => setShowFosterModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFosterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Primary Caregiver Name</label>
                <input
                  type="text"
                  required
                  value={fosterForm.primaryCaregiverName}
                  onChange={(e) => setFosterForm({ ...fosterForm, primaryCaregiverName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Community</label>
                  <input
                    type="text"
                    required
                    value={fosterForm.community}
                    onChange={(e) => setFosterForm({ ...fosterForm, community: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Max Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={fosterForm.maxChildCapacity}
                    onChange={(e) => setFosterForm({ ...fosterForm, maxChildCapacity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFosterModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Register Foster Home
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: ASSIGN CHILD PLACEMENT ──────────────────────────────────── */}
      {showPlacementModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Home size={18} className="text-red-600" /> Assign Foster Care Placement
              </h3>
              <button onClick={() => setShowPlacementModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePlacementSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Select Licensed Foster Home</label>
                <select
                  value={placementForm.fosterHomeId}
                  onChange={(e) => setPlacementForm({ ...placementForm, fosterHomeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="">-- Choose Foster Home --</option>
                  {fosterHomes.map((fh) => (
                    <option key={fh.id} value={fh.id}>
                      {fh.primaryCaregiverName} ({fh.community}) - License: {fh.homeLicenseNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Monthly Caregiver Stipend ($)</label>
                <input
                  type="number"
                  value={placementForm.monthlyStipendAmount}
                  onChange={(e) => setPlacementForm({ ...placementForm, monthlyStipendAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlacementModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Placement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: INITIATE ADOPTION CASE ───────────────────────────────────── */}
      {showAdoptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Award size={18} className="text-red-600" /> Initiate Adoption File
              </h3>
              <button onClick={() => setShowAdoptionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAdoptionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Adoptive Parent Name(s)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Joseph & Clara Sangris"
                  value={adoptionForm.adoptiveParentNames}
                  onChange={(e) => setAdoptionForm({ ...adoptionForm, adoptiveParentNames: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Adoption Type</label>
                <select
                  value={adoptionForm.adoptionType}
                  onChange={(e) => setAdoptionForm({ ...adoptionForm, adoptionType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="CUSTOM_INDIGENOUS_ADOPTION">NWT Custom Indigenous Adoption</option>
                  <option value="STATUTORY_LEGAL_ADOPTION">Statutory Court Legal Adoption</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Custom Adoption Commissioner</label>
                <input
                  type="text"
                  value={adoptionForm.customAdoptionCommissionerName}
                  onChange={(e) => setAdoptionForm({ ...adoptionForm, customAdoptionCommissionerName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdoptionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  File Adoption Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
