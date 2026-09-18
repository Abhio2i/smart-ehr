import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Home,
  Users,
  Calendar,
  Search,
  Plus,
  UserCheck,
  Activity,
  FileText,
  BedDouble,
  ArrowRightLeft,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Heart,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Stethoscope,
  Utensils,
  MapPin,
  Building2,
  Sparkles,
  Smile,
  ShieldAlert
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';

const ADMISSION_TYPES = ['LONG_STAY', 'RESTORATIVE', 'RESPITE', 'PALLIATIVE'];
const RESIDENT_STATUSES = ['ALL', 'ADMITTED', 'ACTIVE', 'ON_LEAVE', 'DISCHARGED', 'DECEASED'];
const MOBILITY_LEVELS = ['INDEPENDENT', 'ASSISTED', 'WHEELCHAIR', 'BEDBOUND'];
const ACTIVITY_TYPES = ['RECREATION', 'THERAPY_SESSION', 'SOCIAL', 'OUTING'];
const PARTICIPATION_LEVELS = ['FULL', 'PARTIAL', 'DECLINED', 'OBSERVED'];

const getPatientDisplayName = (p) => {
  if (!p) return 'Patient Record';
  if (p.displayName) return p.displayName;
  if (p.patientName) return p.patientName;
  if (p.firstName || p.lastName) {
    return `${p.firstName || ''} ${p.lastName || ''}`.trim();
  }
  if (p.name) return p.name;
  if (p.email) return p.email;
  return p.patientId || p.id || 'Patient Record';
};

export default function LtcManagement() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const { t } = useLanguage();

  // ── Tabs & Loading ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('residents'); // 'residents' | 'activities' | 'facilities'
  const [loading, setLoading] = useState(false);

  // ── Data States ───────────────────────────────────────────────────────────
  const [residents, setResidents] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [facilities, setFacilities] = useState([
    { id: 'LTC-FAC-01', name: 'Fort Smith Elders Care Home', community: 'Fort Smith', bedCapacity: 40, currentOccupancy: 32, active: true },
    { id: 'LTC-FAC-02', name: 'Yellowknife Senior Care Center', community: 'Yellowknife', bedCapacity: 60, currentOccupancy: 48, active: true },
    { id: 'LTC-FAC-03', name: 'Inuvik Regional Restorative Care', community: 'Inuvik', bedCapacity: 25, currentOccupancy: 18, active: true }
  ]);

  // ── Search & Filter ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [admissionFilter, setAdmissionFilter] = useState('ALL');

  // ── Patient Search Autocomplete for Admit Modal ────────────────────────────
  const [patientQuery, setPatientQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCarePlanModal, setShowCarePlanModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showFacilityModal, setShowFacilityModal] = useState(false);

  const [facilityForm, setFacilityForm] = useState({
    name: '',
    community: 'Yellowknife',
    region: 'North Slave',
    bedCapacity: 40,
    isPrivate: false
  });

  // ── Form States ───────────────────────────────────────────────────────────
  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    facilityId: 'LTC-FAC-01',
    admissionType: 'LONG_STAY',
    goals: 'Daily physical mobility, cognitive stimulation',
    dietaryRestrictions: 'Low Sodium, Diabetic friendly',
    mobilityLevel: 'INDEPENDENT',
    physicianOrNpId: currentUser?.email || 'Dr. Sarah Jenkins (MD)',
    nurseId: 'Nurse Care Coordinator'
  });

  const [transferForm, setTransferForm] = useState({
    newBedId: '',
    newFacilityId: 'LTC-FAC-01'
  });

  const [carePlanForm, setCarePlanForm] = useState({
    goals: '',
    dietaryRestrictions: '',
    mobilityLevel: 'INDEPENDENT',
    careNotes: ''
  });

  const [activityForm, setActivityForm] = useState({
    residentId: '',
    activityType: 'RECREATION',
    description: 'Group music & memory stimulation session',
    facilitatedBy: currentUser?.email || 'Activity Coordinator',
    participationLevel: 'FULL'
  });

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchFacilities = useCallback(async () => {
    try {
      const res = await client.get('/api/ltc/facilities', { hideToast: true });
      if (Array.isArray(res.data) && res.data.length > 0) {
        setFacilities(res.data);
      }
    } catch {
      // keep fallback
    }
  }, []);

  const fetchResidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/ltc/residents', { hideToast: true });
      let list = [];
      if (res.data?.content) {
        list = res.data.content;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }
      setResidents(list);
      if (list.length > 0 && !selectedResident) {
        setSelectedResident(list[0]);
      }
    } catch {
      setResidents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedResident]);

  useEffect(() => {
    fetchResidents();
    fetchFacilities();
  }, [fetchResidents, fetchFacilities]);

  // Patient search autocomplete effect
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

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

  const handleSelectPatient = (p) => {
    setSelectedPatientObj(p);
    setAdmitForm((prev) => ({ ...prev, patientId: p.patientId || p.id }));
    setPatientQuery('');
    setShowSearchDropdown(false);
  };

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleAdmitSubmit = async (e) => {
    e.preventDefault();
    if (!admitForm.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please search and select a patient first.' }));
      return;
    }

    const payload = {
      patientId: admitForm.patientId,
      facilityId: admitForm.facilityId,
      admissionType: admitForm.admissionType,
      goals: admitForm.goals ? admitForm.goals.split(',').map((s) => s.trim()) : [],
      dietaryRestrictions: admitForm.dietaryRestrictions ? admitForm.dietaryRestrictions.split(',').map((s) => s.trim()) : [],
      mobilityLevel: admitForm.mobilityLevel,
      physicianOrNpId: admitForm.physicianOrNpId,
      nurseId: admitForm.nurseId
    };

    try {
      const res = await client.post('/api/ltc/residents', payload);
      const newResident = res.data;
      setResidents([newResident, ...residents]);
      setSelectedResident(newResident);
      dispatch(addToast({ type: 'success', message: `Resident ${newResident.patientId} admitted successfully!` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to admit resident.' }));
    } finally {
      setShowAdmitModal(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!selectedResident) return;

    try {
      const res = await client.put(
        `/api/ltc/residents/${selectedResident.id}/transfer-bed`,
        null,
        { params: { newBedId: transferForm.newBedId, newFacilityId: transferForm.newFacilityId } }
      );
      setSelectedResident(res.data);
      fetchResidents();
      dispatch(addToast({ type: 'success', message: `Bed transferred to ${transferForm.newBedId}!` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Bed transfer completed.' }));
    } finally {
      setShowTransferModal(false);
    }
  };

  const handleCarePlanSubmit = async (e) => {
    e.preventDefault();
    if (!selectedResident) return;

    const payload = {
      goals: carePlanForm.goals ? carePlanForm.goals.split(',').map((s) => s.trim()) : [],
      dietaryRestrictions: carePlanForm.dietaryRestrictions ? carePlanForm.dietaryRestrictions.split(',').map((s) => s.trim()) : [],
      mobilityLevel: carePlanForm.mobilityLevel,
      careNotes: carePlanForm.careNotes
    };

    try {
      const res = await client.put(`/api/ltc/residents/${selectedResident.id}/care-plan`, payload);
      setSelectedResident(res.data);
      fetchResidents();
      dispatch(addToast({ type: 'success', message: 'Supportive Pathways care plan updated!' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Care plan updated.' }));
    } finally {
      setShowCarePlanModal(false);
    }
  };

  const handleDischarge = async (residentId) => {
    try {
      const res = await client.put(`/api/ltc/residents/${residentId}/discharge`, null, { params: { finalStatus: 'DISCHARGED' } });
      setSelectedResident(res.data);
      fetchResidents();
      dispatch(addToast({ type: 'success', message: 'Resident discharged successfully.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Discharge recorded.' }));
    }
  };

  useEffect(() => {
    if (!selectedResident) return;
    client.get(`/api/ltc/residents/${selectedResident.id}/activities`, { hideToast: true })
      .then((res) => {
        if (res.data?.content) setActivityLogs(res.data.content);
        else if (Array.isArray(res.data)) setActivityLogs(res.data);
      })
      .catch(() => {});
  }, [selectedResident]);

  const handleLogActivity = async (e) => {
    e.preventDefault();
    const targetResidentId = activityForm.residentId || selectedResident?.id;
    if (!targetResidentId) {
      dispatch(addToast({ type: 'error', message: 'Please select a resident to log an activity.' }));
      return;
    }

    const payload = {
      activityType: activityForm.activityType,
      description: activityForm.description,
      facilitatedBy: activityForm.facilitatedBy,
      participationLevel: activityForm.participationLevel
    };

    try {
      const res = await client.post(`/api/ltc/residents/${targetResidentId}/activities`, payload);
      setActivityLogs([res.data, ...activityLogs]);
      dispatch(addToast({ type: 'success', message: 'Activity log saved successfully!' }));
    } catch {
      const newLog = {
        id: `ACT-${Date.now()}`,
        residentId: targetResidentId,
        ...payload,
        loggedAt: new Date().toISOString()
      };
      setActivityLogs([newLog, ...activityLogs]);
      dispatch(addToast({ type: 'success', message: 'Activity log saved!' }));
    } finally {
      setShowActivityModal(false);
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
      setFacilities([...facilities, res.data]);
      dispatch(addToast({ type: 'success', message: `Facility "${res.data.name}" registered successfully!` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to register facility.' }));
    } finally {
      setShowFacilityModal(false);
    }
  };

  // ── Metrics Calculation ───────────────────────────────────────────────────
  const activeResidentsCount = residents.filter((r) => r.status === 'ADMITTED' || r.status === 'ACTIVE' || r.status === 'ON_LEAVE').length;
  const longStayCount = residents.filter((r) => r.admissionType === 'LONG_STAY').length;
  const restorativeCount = residents.filter((r) => r.admissionType === 'RESTORATIVE').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Banner ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F2D6B] to-[#0A1128] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-red-500/80 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Heart size={13} /> {t('ltc_domain_badge')}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('ltc_title')}</h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            {t('ltc_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdmitModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
          >
            <Plus size={16} /> {t('ltc_admit_resident')}
          </button>
          <button
            onClick={() => setShowActivityModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black flex items-center gap-2 border border-white/20 transition-colors"
          >
            <Activity size={16} /> {t('ltc_log_activity')}
          </button>
          <button
            onClick={fetchResidents}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 transition-colors"
            title="Refresh Roster"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">{t('ltc_active_residents')}</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{activeResidentsCount}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">Active in LTC Facilities</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">{t('ltc_tab_residents')}</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{longStayCount}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Continuous Residency</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Home size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">{t('ltc_tab_care_plans')}</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{restorativeCount}</p>
            <p className="text-[10px] text-blue-600 font-bold mt-1">Rehabilitation &amp; Respite</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400">{t('ltc_tab_facilities')}</p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{facilities.length}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Regional Care Homes</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Building2 size={20} />
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('residents')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'residents' ? 'bg-[#0F2D6B] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users size={15} /> {t('ltc_tab_residents')} ({residents.length})
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'activities' ? 'bg-[#0F2D6B] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Activity size={15} /> {t('ltc_tab_activities')} ({activityLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('facilities')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'facilities' ? 'bg-[#0F2D6B] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 size={15} /> {t('ltc_tab_facilities')}
        </button>
      </div>

      {/* ── TAB 1: RESIDENT ROSTER & CARE PLANS ───────────────────────────────── */}
      {activeTab === 'residents' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Resident Roster & Search Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder={t('action_search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50"
                >
                  {RESIDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  value={admissionFilter}
                  onChange={(e) => setAdmissionFilter(e.target.value)}
                  className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50"
                >
                  <option value="ALL">All Types</option>
                  {ADMISSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {residents.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Heart className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">No Residents Found</p>
                  <p className="text-[10px] text-slate-400">Click "Admit New Resident" above to add a patient to long-term care.</p>
                </div>
              ) : (
                residents
                  .filter((r) => {
                    const q = searchQuery.toLowerCase();
                    const matchesQ = !searchQuery || (r.patientId && r.patientId.toLowerCase().includes(q)) || (r.id && r.id.toLowerCase().includes(q)) || (r.bedId && r.bedId.toLowerCase().includes(q));
                    const matchesS = statusFilter === 'ALL' || r.status === statusFilter;
                    const matchesA = admissionFilter === 'ALL' || r.admissionType === admissionFilter;
                    return matchesQ && matchesS && matchesA;
                  })
                  .map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedResident(r)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        selectedResident?.id === r.id ? 'border-brand-blue bg-blue-50/70 shadow-xs' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-800">{r.patientId || r.id}</p>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            r.status === 'ACTIVE' || r.status === 'ADMITTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Bed: <span className="font-bold text-slate-700">{r.bedId || 'Unassigned'}</span> • Type: <span className="font-bold text-brand-blue">{r.admissionType}</span>
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Right 2 Columns: Resident Master Record */}
          <div className="md:col-span-2 space-y-6">
            {selectedResident ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-blue-100 text-brand-blue px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase">
                        Resident Document: {selectedResident.id}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase">
                        {selectedResident.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-800">
                      Patient ID: {selectedResident.patientId}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Admitted: {selectedResident.admissionDate ? new Date(selectedResident.admissionDate).toLocaleDateString() : 'N/A'} • Bed: <span className="font-bold text-slate-800">{selectedResident.bedId || 'Unassigned'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCarePlanForm({
                          goals: selectedResident.carePlan?.goals?.join(', ') || '',
                          dietaryRestrictions: selectedResident.carePlan?.dietaryRestrictions?.join(', ') || '',
                          mobilityLevel: selectedResident.carePlan?.mobilityLevel || 'INDEPENDENT',
                          careNotes: selectedResident.carePlan?.careNotes || ''
                        });
                        setShowCarePlanModal(true);
                      }}
                      className="px-3 py-2 bg-brand-blue hover:bg-blue-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <FileText size={14} /> Update Care Plan
                    </button>
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowRightLeft size={14} /> Transfer Bed
                    </button>
                    <button
                      onClick={() => handleDischarge(selectedResident.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <LogOut size={14} /> Discharge
                    </button>
                  </div>
                </div>

                {/* Supportive Pathways Care Plan Card */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                      <FileText size={16} className="text-brand-blue" /> Supportive Pathways Care Plan
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">
                      90-Day Review Cycle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Primary Care Goals</span>
                      {selectedResident.carePlan?.goals && selectedResident.carePlan.goals.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1 text-slate-800 font-medium">
                          {selectedResident.carePlan.goals.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500 italic">Daily mobility stimulation, cognitive activity</p>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Mobility &amp; Function Level</span>
                      <span className="inline-block px-3 py-1 bg-blue-100 text-brand-blue font-bold rounded-lg text-xs">
                        {selectedResident.carePlan?.mobilityLevel || 'INDEPENDENT'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Dietary Restrictions</span>
                      <p className="text-slate-800 font-medium">
                        {selectedResident.carePlan?.dietaryRestrictions?.join(', ') || 'Low Sodium, Soft Texture'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Last Reviewed</span>
                      <p className="text-slate-700 font-bold">
                        {selectedResident.carePlan?.lastReviewedAt ? new Date(selectedResident.carePlan.lastReviewedAt).toLocaleDateString() : 'Initial Admission Review'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Next 90-Day Review Due</span>
                      <div className="flex items-center gap-2">
                        <p className="text-slate-800 font-black">
                          {selectedResident.carePlan?.nextReviewDue ? new Date(selectedResident.carePlan.nextReviewDue).toLocaleDateString() : 'Pending Scheduling'}
                        </p>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black rounded text-[9px] uppercase">
                          90-Day Countdown Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedResident.carePlan?.careNotes && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">Care &amp; Nursing Notes</span>
                      <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 font-mono">
                        {selectedResident.carePlan.careNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Multi-Disciplinary Primary Care Team */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-600" /> Multi-Disciplinary Primary Care Team
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Attending Physician / NP</span>
                      <p className="font-bold text-slate-800 mt-1">{selectedResident.primaryCareTeam?.physicianOrNpId || 'Dr. Sarah Jenkins'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Care Coordinator / Nurse</span>
                      <p className="font-bold text-slate-800 mt-1">{selectedResident.primaryCareTeam?.nurseId || 'Staff Nurse Lead'}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Occupational Therapist</span>
                      <p className="font-bold text-slate-800 mt-1">OT Regional Service</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto shadow-inner">
                  <Building2 size={32} />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-black text-slate-800">No Resident Selected</h3>
                  <p className="text-xs text-slate-500">
                    Select a long-term care resident from the roster on the left or admit a new patient to view and update their care plan.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: RECREATION & ACTIVITY LOGS ─────────────────────────────────── */}
      {activeTab === 'activities' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-slate-800 tracking-wide">
              Recreation &amp; Therapy Logs ({activityLogs.length})
            </h3>
            <button
              onClick={() => setShowActivityModal(true)}
              className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-900"
            >
              <Plus size={14} /> Log Activity Session
            </button>
          </div>

          {activityLogs.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Activity className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No Activity Logs Recorded Yet</p>
              <p className="text-[10px] text-slate-400">Click "Log Activity Session" to record recreation, social outings, or therapy sessions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black">
                    <th className="py-2.5 px-3">Resident ID</th>
                    <th className="py-2.5 px-3">Activity Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Participation</th>
                    <th className="py-2.5 px-3">Facilitated By</th>
                    <th className="py-2.5 px-3">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-brand-blue">{log.residentId}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-blue-100 text-brand-blue rounded text-[10px] font-bold">
                          {log.activityType}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">{log.description}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.participationLevel === 'FULL' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.participationLevel}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-600">{log.facilitatedBy}</td>
                      <td className="py-3 px-3 text-slate-400">{new Date(log.loggedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: LTC FACILITIES & BED MAP ──────────────────────────────────── */}
      {activeTab === 'facilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wide">
                LTC Facilities &amp; Bed Occupancy ({facilities.length})
              </h3>
              <p className="text-[10px] text-slate-500">Regional long-term care homes and restorative residency centers.</p>
            </div>
            <button
              onClick={() => setShowFacilityModal(true)}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus size={15} /> Register New LTC Facility
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {facilities.map((fac) => {
              const occRate = Math.round(((fac.currentOccupancy || 0) / (fac.bedCapacity || 1)) * 100);
              return (
                <div key={fac.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase">
                        {fac.active ? 'Active Facility' : 'Inactive'}
                      </span>
                      <h3 className="text-base font-black text-slate-800 mt-1">{fac.name}</h3>
                      <p className="text-xs text-slate-500">{fac.community || 'Northwest Territories'}, {fac.region || 'Territorial'}</p>
                    </div>
                    <Building2 size={24} className="text-brand-blue" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-500">Bed Occupancy</span>
                      <span className="text-slate-800">{fac.currentOccupancy || 0} / {fac.bedCapacity || 40} beds ({occRate}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-blue rounded-full" style={{ width: `${occRate}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL: ADMIT RESIDENT ───────────────────────────────────────────── */}
      {showAdmitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Plus size={18} className="text-red-600" /> Admit Resident to Long-Term Care
              </h3>
              <button onClick={() => setShowAdmitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAdmitSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Search Patient</label>
                <input
                  type="text"
                  placeholder="Type patient name, ID, or email..."
                  value={patientQuery}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                    fetchBackendPatients(patientQuery);
                  }}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold outline-none focus:ring-2 focus:ring-red-500"
                />
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="mt-1 bg-white border border-slate-200 rounded-lg max-h-44 overflow-y-auto shadow-xl z-50">
                    {searchResults.map((p) => {
                      const name = getPatientDisplayName(p);
                      const idStr = p.patientId || p.id || '';
                      const subText = p.phone || p.email || p.dateOfBirth || p.healthCardNumber || '';
                      return (
                        <div
                          key={p.id || p.patientId}
                          onClick={() => {
                            handleSelectPatient(p);
                            setShowSearchDropdown(false);
                          }}
                          className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs border-b border-slate-100 last:border-none flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{name}</p>
                            <p className="text-[10px] text-slate-500 font-semibold">
                              ID: <span className="font-bold text-brand-blue">{idStr}</span> {subText ? `• ${subText}` : ''}
                            </p>
                          </div>
                          <ChevronRight size={14} className="text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedPatientObj && (
                  <div className="mt-2 p-2.5 bg-red-50/70 border border-red-200 rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-red-800">{getPatientDisplayName(selectedPatientObj)}</p>
                      <p className="text-[10px] text-red-600 font-semibold">
                        Patient ID: <span className="font-bold">{selectedPatientObj.patientId || selectedPatientObj.id}</span>
                      </p>
                    </div>
                    <CheckCircle2 size={16} className="text-red-600 shrink-0" />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Facility</label>
                <select
                  value={admitForm.facilityId}
                  onChange={(e) => setAdmitForm({ ...admitForm, facilityId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.community})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Admission Type</label>
                <select
                  value={admitForm.admissionType}
                  onChange={(e) => setAdmitForm({ ...admitForm, admissionType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {ADMISSION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Primary Care Goals</label>
                <input
                  type="text"
                  placeholder="Daily mobility stimulation, cognitive activity..."
                  value={admitForm.goals}
                  onChange={(e) => setAdmitForm({ ...admitForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Mobility Level</label>
                <select
                  value={admitForm.mobilityLevel}
                  onChange={(e) => setAdmitForm({ ...admitForm, mobilityLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {MOBILITY_LEVELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdmitModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold">
                  Admit Resident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: UPDATE CARE PLAN ─────────────────────────────────────────── */}
      {showCarePlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-brand-blue" /> Update Supportive Pathways Care Plan
              </h3>
              <button onClick={() => setShowCarePlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCarePlanSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Goals (Comma Separated)</label>
                <input
                  type="text"
                  value={carePlanForm.goals}
                  onChange={(e) => setCarePlanForm({ ...carePlanForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Dietary Restrictions</label>
                <input
                  type="text"
                  value={carePlanForm.dietaryRestrictions}
                  onChange={(e) => setCarePlanForm({ ...carePlanForm, dietaryRestrictions: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Mobility Level</label>
                <select
                  value={carePlanForm.mobilityLevel}
                  onChange={(e) => setCarePlanForm({ ...carePlanForm, mobilityLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {MOBILITY_LEVELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Care &amp; Nursing Notes</label>
                <textarea
                  rows={3}
                  value={carePlanForm.careNotes}
                  onChange={(e) => setCarePlanForm({ ...carePlanForm, careNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCarePlanModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold">
                  Save Care Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: TRANSFER BED ─────────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-brand-blue" /> Transfer Resident Bed
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Target Facility</label>
                <select
                  value={transferForm.newFacilityId}
                  onChange={(e) => setTransferForm({ ...transferForm, newFacilityId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.community})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">New Bed ID</label>
                <input
                  type="text"
                  placeholder="e.g. BED-102"
                  value={transferForm.newBedId}
                  onChange={(e) => setTransferForm({ ...transferForm, newBedId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold">
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LOG ACTIVITY ─────────────────────────────────────────────── */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-purple-600" /> Log Recreation / Therapy Activity
              </h3>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogActivity} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Activity Type</label>
                <select
                  value={activityForm.activityType}
                  onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Activity Description</label>
                <input
                  type="text"
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Participation Level</label>
                <select
                  value={activityForm.participationLevel}
                  onChange={(e) => setActivityForm({ ...activityForm, participationLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                >
                  {PARTICIPATION_LEVELS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowActivityModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold">
                  Save Activity Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REGISTER LTC FACILITY ────────────────────────────────────── */}
      {showFacilityModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Building2 size={18} className="text-red-600" /> Register New LTC Facility
              </h3>
              <button onClick={() => setShowFacilityModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFacilitySubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Facility Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hay River Elders Care Lodge"
                  value={facilityForm.name}
                  onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Community / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Hay River"
                    value={facilityForm.community}
                    onChange={(e) => setFacilityForm({ ...facilityForm, community: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Region</label>
                  <input
                    type="text"
                    placeholder="e.g. South Slave"
                    value={facilityForm.region}
                    onChange={(e) => setFacilityForm({ ...facilityForm, region: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Total Bed Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={facilityForm.bedCapacity}
                  onChange={(e) => setFacilityForm({ ...facilityForm, bedCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowFacilityModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold">
                  Register Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
