import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Activity,
  Plus,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
  Sliders,
  Baby,
  Brain,
  X,
  Lock,
  Heart
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';

const FIM_ITEMS = [
  // Self-Care
  { id: 'eating', label: 'Eating', category: 'Self-Care' },
  { id: 'grooming', label: 'Grooming', category: 'Self-Care' },
  { id: 'bathing', label: 'Bathing', category: 'Self-Care' },
  { id: 'dressingUpper', label: 'Dressing - Upper Body', category: 'Self-Care' },
  { id: 'dressingLower', label: 'Dressing - Lower Body', category: 'Self-Care' },
  { id: 'toileting', label: 'Toileting', category: 'Self-Care' },
  // Sphincter Control
  { id: 'bladderManagement', label: 'Bladder Management', category: 'Sphincter Control' },
  { id: 'bowelManagement', label: 'Bowel Management', category: 'Sphincter Control' },
  // Transfers
  { id: 'transfersBed', label: 'Transfers: Bed, Chair, Wheelchair', category: 'Transfers' },
  { id: 'transfersToilet', label: 'Transfers: Toilet', category: 'Transfers' },
  { id: 'transfersTub', label: 'Transfers: Tub or Shower', category: 'Transfers' },
  // Locomotion
  { id: 'locomotionWalk', label: 'Locomotion: Walk / Wheelchair', category: 'Locomotion' },
  { id: 'locomotionStairs', label: 'Locomotion: Stairs', category: 'Locomotion' },
  // Communication
  { id: 'comprehension', label: 'Comprehension (Auditory/Visual)', category: 'Communication' },
  { id: 'expression', label: 'Expression (Verbal/Non-Verbal)', category: 'Communication' },
  // Social Cognition
  { id: 'socialInteraction', label: 'Social Interaction', category: 'Social Cognition' },
  { id: 'problemSolving', label: 'Problem Solving', category: 'Social Cognition' },
  { id: 'memory', label: 'Memory', category: 'Social Cognition' }
];

const FIM_LEVELS = [
  { level: 7, label: '7 - Complete Independence (Timely, Safe)' },
  { level: 6, label: '6 - Modified Independence (Device, Extra Time)' },
  { level: 5, label: '5 - Supervision or Setup' },
  { level: 4, label: '4 - Minimal Contact Assist (Subject = 75%+)' },
  { level: 3, label: '3 - Moderate Assist (Subject = 50%+)' },
  { level: 2, label: '2 - Maximal Assist (Subject = 25%+)' },
  { level: 1, label: '1 - Total Assist (Subject = < 25%)' }
];

const DISCIPLINES = ['ALL', 'PT', 'OT', 'SLP', 'SPEECH'];
const STATUSES = ['ALL', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'ON_HOLD'];

const getPatientDisplayName = (p) => {
  if (!p) return 'Patient Record';
  if (p.displayName) return p.displayName;
  if (p.patientName) return p.patientName;
  if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim();
  if (p.name) return p.name;
  return p.patientId || p.id || 'Patient Record';
};

export default function RehabilitationServices() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const { t } = useLanguage();

  // ── Navigation & Filters ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'sessions' | 'fim' | 'development'
  const [selectedDiscipline, setSelectedDiscipline] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Data States ───────────────────────────────────────────────────────────
  const [treatmentPlans, setTreatmentPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [fimAssessments, setFimAssessments] = useState([]);
  const [devAssessments, setDevAssessments] = useState([]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showFimModal, setShowFimModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);

  // Patient Autocomplete State inside Modals
  const [patientQuery, setPatientQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);

  // Form States
  const [planForm, setPlanForm] = useState({
    patientId: '',
    patientName: '',
    facilityId: 'St. Stanton Rehabilitation Centre',
    discipline: 'PT',
    goals: 'Improve lower limb strength, Independent ambulation 50m with gait aid',
    assignedProviderId: currentUser?.email || 'Lead Physical Therapist',
    startDate: new Date().toISOString().split('T')[0],
    targetDischargeDate: ''
  });

  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().split('T')[0],
    durationMinutes: 45,
    activitiesPerformed: 'Parallel bar ambulation, Balance retraining, Passive ROM exercises',
    progressNotes: 'Patient completed 45-min gait retraining. Tolerated treatment well with minimal fatigue.'
  });

  // Default FIM item scores (default level 5 = Supervision)
  const initialFimScores = {};
  FIM_ITEMS.forEach((item) => { initialFimScores[item.id] = 5; });
  const [fimScores, setFimScores] = useState(initialFimScores);

  const [devForm, setDevForm] = useState({
    patientId: '',
    patientName: '',
    assessmentType: 'ASD_SCREENING',
    screeningToolUsed: 'M-CHAT-R',
    recommendedFollowUp: 'Refer to Pediatric Speech-Language Specialist for full diagnostic workup.',
    mchatEyeContact: 'Pass',
    mchatPointing: 'Pass',
    mchatResponseToName: 'Pass',
    fasdGrowthDeficit: 'Normal',
    fasdFacialFeatures: 'Non-characteristic',
    fasdCnsDysfunction: 'Mild delay'
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

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDiscipline !== 'ALL') params.discipline = selectedDiscipline;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      const res = await client.get('/api/rehab/treatment-plans', { params, hideToast: true });
      let list = [];
      if (res.data?.content) list = res.data.content;
      else if (Array.isArray(res.data)) list = res.data;

      setTreatmentPlans(list);
      if (list.length > 0 && !selectedPlan) {
        setSelectedPlan(list[0]);
      }
    } catch {
      setTreatmentPlans([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDiscipline, selectedStatus, selectedPlan]);

  const fetchPlanDetails = useCallback(async (planId) => {
    if (!planId) return;
    try {
      const [sessRes, fimRes] = await Promise.all([
        client.get(`/api/rehab/treatment-plans/${planId}/sessions`, { hideToast: true }),
        client.get(`/api/rehab/treatment-plans/${planId}/fim-assessments`, { hideToast: true })
      ]);

      let sessList = [];
      if (sessRes.data?.content) sessList = sessRes.data.content;
      else if (Array.isArray(sessRes.data)) sessList = sessRes.data;
      setSessions(sessList);

      let fimList = fimRes.data || [];
      setFimAssessments(fimList);
    } catch {
      setSessions([]);
      setFimAssessments([]);
    }
  }, []);

  const fetchDevAssessments = useCallback(async () => {
    try {
      const res = await client.get('/api/rehab/development-assessments', { hideToast: true });
      let list = [];
      if (res.data?.content) list = res.data.content;
      else if (Array.isArray(res.data)) list = res.data;
      setDevAssessments(list);
    } catch {
      setDevAssessments([]);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchDevAssessments();
  }, [fetchPlans, fetchDevAssessments]);

  useEffect(() => {
    if (selectedPlan?.id) {
      fetchPlanDetails(selectedPlan.id);
    }
  }, [selectedPlan, fetchPlanDetails]);

  // ── Action Handlers ───────────────────────────────────────────────────────
  const handleSelectPatient = (p) => {
    setSelectedPatientObj(p);
    setPlanForm((prev) => ({
      ...prev,
      patientId: p.patientId || p.id,
      patientName: getPatientDisplayName(p)
    }));
    setDevForm((prev) => ({
      ...prev,
      patientId: p.patientId || p.id,
      patientName: getPatientDisplayName(p)
    }));
    setPatientQuery('');
    setShowSearchDropdown(false);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!planForm.patientName) {
      dispatch(addToast({ type: 'error', message: 'Patient name is required.' }));
      return;
    }

    const payload = {
      ...planForm,
      goals: planForm.goals.split(',').map((g) => g.trim()).filter(Boolean)
    };

    try {
      const res = await client.post('/api/rehab/treatment-plans', payload);
      setSelectedPlan(res.data);
      fetchPlans();
      dispatch(addToast({ type: 'success', message: `Rehab Plan ${res.data.planNumber} created!` }));
      setShowPlanModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Plan creation failed.' }));
    }
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) {
      dispatch(addToast({ type: 'error', message: 'Please select a treatment plan.' }));
      return;
    }

    const payload = {
      ...sessionForm,
      activitiesPerformed: sessionForm.activitiesPerformed.split(',').map((a) => a.trim()).filter(Boolean)
    };

    try {
      const res = await client.post(`/api/rehab/treatment-plans/${selectedPlan.id}/sessions`, payload);
      fetchPlanDetails(selectedPlan.id);
      dispatch(addToast({ type: 'success', message: 'Therapy session logged successfully!' }));
      setShowSessionModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Session logging failed.' }));
    }
  };

  const handleFimSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPlan) {
      dispatch(addToast({ type: 'error', message: 'Please select a treatment plan.' }));
      return;
    }

    try {
      const res = await client.post(`/api/rehab/treatment-plans/${selectedPlan.id}/fim-assessments`, { items: fimScores });
      fetchPlanDetails(selectedPlan.id);
      dispatch(addToast({ type: 'success', message: `FIM Score recorded! Total Score: ${res.data.totalScore}/126` }));
      setShowFimModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'FIM scoring failed.' }));
    }
  };

  const handleDevSubmit = async (e) => {
    e.preventDefault();
    if (!devForm.patientName) {
      dispatch(addToast({ type: 'error', message: 'Child patient name is required.' }));
      return;
    }

    const resultsPayload = devForm.assessmentType === 'ASD_SCREENING'
      ? { eyeContact: devForm.mchatEyeContact, pointing: devForm.mchatPointing, responseToName: devForm.mchatResponseToName }
      : { growthDeficit: devForm.fasdGrowthDeficit, facialFeatures: devForm.fasdFacialFeatures, cnsDysfunction: devForm.fasdCnsDysfunction };

    const payload = {
      patientId: devForm.patientId,
      patientName: devForm.patientName,
      assessmentType: devForm.assessmentType,
      screeningToolUsed: devForm.screeningToolUsed,
      results: resultsPayload,
      recommendedFollowUp: devForm.recommendedFollowUp
    };

    try {
      const res = await client.post('/api/rehab/development-assessments', payload);
      fetchDevAssessments();
      dispatch(addToast({ type: 'success', message: `Child Development Assessment recorded for ${res.data.patientName}!` }));
      setShowDevModal(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Development assessment failed.' }));
    }
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const activePlansCount = treatmentPlans.filter((p) => p.status === 'ACTIVE').length;
  const ptCount = treatmentPlans.filter((p) => p.discipline === 'PT').length;
  const otCount = treatmentPlans.filter((p) => p.discipline === 'OT').length;

  const currentFimScore = fimAssessments.length > 0 ? fimAssessments[0].totalScore : null;

  const filteredPlans = treatmentPlans.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || p.planNumber?.toLowerCase().includes(q) || p.patientName?.toLowerCase().includes(q) || p.patientId?.toLowerCase().includes(q);
    return matchQ;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header Banner (Long-Term Care / Signature Theme) ─────────────── */}
      <div className="bg-gradient-to-r from-[#0F2D6B] to-[#0A1128] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-red-500/80 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Activity size={13} /> {t('rehab_domain_badge')}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">{t('rehab_title')}</h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            {t('rehab_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
          >
            <Plus size={16} /> {t('rehab_create_plan')}
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('rehab_active_plans')}</span>
            <span className="text-xl font-black text-slate-800">{activePlansCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-brand-blue rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('rehab_pt_ot_caseload')}</span>
            <span className="text-xl font-black text-slate-900">{ptCount} PT • {otCount} OT</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Sliders size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('rehab_latest_fim')}</span>
            <span className="text-xl font-black text-emerald-800">
              {currentFimScore !== null ? `${currentFimScore} / 126` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Baby size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('rehab_dev_assessments')}</span>
            <span className="text-xl font-black text-purple-800">{devAssessments.length}</span>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Tabs ───────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'plans' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={18} /> {t('rehab_tab_plans')}
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'sessions' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock size={18} /> {t('rehab_tab_sessions')}
        </button>
        <button
          onClick={() => setActiveTab('fim')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'fim' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders size={18} /> {t('rehab_tab_fim')}
        </button>
        <button
          onClick={() => setActiveTab('development')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'development' ? 'border-red-600 text-red-600 font-extrabold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Baby size={18} /> {t('rehab_tab_development')}
        </button>
      </div>

      {/* ── TAB 1: TREATMENT PLANS (PT / OT / SLP) ────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Filter & Roster */}
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
              {DISCIPLINES.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDiscipline(d)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                    selectedDiscipline === d ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-500 py-6 text-center">Loading rehab plans...</p>
              ) : filteredPlans.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center italic">No rehabilitation care plans found.</p>
              ) : (
                filteredPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedPlan?.id === plan.id
                        ? 'border-red-600 bg-red-50/40 shadow-sm'
                        : 'border-slate-200 hover:border-red-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-900">{plan.patientName || plan.planNumber}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-brand-blue text-[9px] font-bold rounded border border-blue-200">
                          {plan.discipline}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold">
                        Plan: <span className="font-bold text-slate-800">{plan.planNumber}</span> • Status: <span className="font-bold text-emerald-700">{plan.status}</span>
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right 2 Columns: Selected Plan Master View */}
          <div className="md:col-span-2 space-y-6">
            {selectedPlan ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-red-50 text-red-700 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border border-red-100">
                        Plan: {selectedPlan.planNumber}
                      </span>
                      <span className="bg-blue-50 text-brand-blue px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border border-blue-100">
                        Discipline: {selectedPlan.discipline}
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border border-emerald-100">
                        {selectedPlan.status}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-800">
                      Patient: {selectedPlan.patientName} (ID: {selectedPlan.patientId})
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Facility: <span className="font-bold text-slate-700">{selectedPlan.facilityId}</span> • Provider: <span className="font-bold text-brand-blue">{selectedPlan.assignedProviderId}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSessionModal(true)}
                      className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Clock size={14} /> Log Session
                    </button>
                    <button
                      onClick={() => setShowFimModal(true)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Sliders size={14} className="text-brand-blue" /> Score FIM
                    </button>
                  </div>
                </div>

                {/* Goals & Care Targets */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-red-600" /> Rehabilitation Care Goals &amp; Functional Targets
                  </h4>
                  <ul className="space-y-2 text-xs font-bold text-slate-700">
                    {selectedPlan.goals?.map((g, idx) => (
                      <li key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {g}
                      </li>
                    )) || <li className="text-slate-400 italic">No specific goals entered yet.</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center text-slate-400 italic">
                Select a rehabilitation care plan to view master details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: THERAPY SESSIONS & AES-256 NOTES ────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Therapy Session Logs &amp; AES-256 Notes</h3>
              <p className="text-xs text-slate-500 font-medium">Recorded therapy sessions, duration, performed exercises, and encrypted progress notes</p>
            </div>
            <button
              onClick={() => setShowSessionModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Clock size={16} /> Log Therapy Session
            </button>
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 italic text-xs">
                No therapy sessions logged for this care plan.
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-xs text-slate-800 flex items-center gap-2">
                      <Calendar size={14} className="text-red-600" /> Date: {s.sessionDate} • Duration: {s.durationMinutes} mins
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">Provider: {s.facilitatedBy}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Activities Performed</span>
                    <div className="flex flex-wrap gap-1.5">
                      {s.activitiesPerformed?.map((act, i) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-[11px] font-bold">
                          {act}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                        <Lock size={12} className="text-emerald-700" /> AES-256 Decrypted Progress Note
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      {s.encryptedProgressNotes || 'No notes entered.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: 18-ITEM FIM FUNCTIONAL OUTCOME SCORING ─────────────────────── */}
      {activeTab === 'fim' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Functional Independence Measure (FIM) Scoring</h3>
              <p className="text-xs text-slate-500 font-medium">Standardized 18-item functional evaluation (Motor &amp; Cognitive domains, scale 1 to 7)</p>
            </div>
            <button
              onClick={() => setShowFimModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Sliders size={16} /> Perform FIM Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fimAssessments.map((fim) => (
              <div key={fim.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black rounded uppercase">
                    Assessed: {new Date(fim.assessedAt).toLocaleDateString()}
                  </span>
                  <span className="px-3 py-1 bg-red-600 text-white text-sm font-black rounded-xl shadow-sm">
                    FIM Score: {fim.totalScore} / 126
                  </span>
                </div>

                <div className="text-xs font-bold text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1">
                  <p>Evaluator: <span className="font-black text-slate-900">{fim.assessedBy}</span></p>
                  <p>Schema Version: <span className="font-black text-brand-blue">v{fim.version || 1}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: CHILD DEVELOPMENT TEAM (ASD / FASD) ────────────────────────── */}
      {activeTab === 'development' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-800">Child Development Team (ASD &amp; FASD Evaluations)</h3>
              <p className="text-xs text-slate-500 font-medium">Pediatric M-CHAT-R Autism Screening &amp; 4-Digit FASD Diagnostic Code Assessments</p>
            </div>
            <button
              onClick={() => setShowDevModal(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Baby size={16} /> Record Pediatric Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {devAssessments.map((dev) => (
              <div key={dev.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-purple-50 text-purple-800 border border-purple-100 text-[10px] font-black rounded uppercase">
                    Tool: {dev.screeningToolUsed}
                  </span>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-brand-blue text-[10px] font-bold rounded-full">
                    {dev.assessmentType}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-800">Child: {dev.patientName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Assessed By: <span className="font-bold text-slate-700">{dev.assessedBy}</span></p>
                </div>

                <div className="space-y-2 text-xs font-bold text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-purple-900 font-black">Follow-up Recommendation:</p>
                  <p className="text-slate-700 font-medium">{dev.recommendedFollowUp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODAL 1: CREATE REHAB CARE PLAN ────────────────────────────────────── */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Activity size={18} className="text-red-600" /> Create Rehabilitation Care Plan
              </h3>
              <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePlanSubmit} className="space-y-4 text-xs">
              {/* Patient Autocomplete */}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Search Patient Record</label>
                <input
                  type="text"
                  placeholder="Type patient name..."
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
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Patient Name</label>
                <input
                  type="text"
                  required
                  value={planForm.patientName}
                  onChange={(e) => setPlanForm({ ...planForm, patientName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Discipline</label>
                  <select
                    value={planForm.discipline}
                    onChange={(e) => setPlanForm({ ...planForm, discipline: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="PT">PT (Physiotherapy)</option>
                    <option value="OT">OT (Occupational Therapy)</option>
                    <option value="SLP">SLP (Speech-Language Pathology)</option>
                    <option value="SPEECH">Speech Therapy</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Facility</label>
                  <input
                    type="text"
                    value={planForm.facilityId}
                    onChange={(e) => setPlanForm({ ...planForm, facilityId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Rehab Care Goals (Comma Separated)</label>
                <textarea
                  rows={2}
                  value={planForm.goals}
                  onChange={(e) => setPlanForm({ ...planForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: LOG THERAPY SESSION ───────────────────────────────────────── */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Clock size={18} className="text-red-600" /> Log Therapy Session
              </h3>
              <button onClick={() => setShowSessionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSessionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Session Date</label>
                  <input
                    type="date"
                    value={sessionForm.sessionDate}
                    onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={sessionForm.durationMinutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: parseInt(e.target.value) || 45 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Activities Performed</label>
                <input
                  type="text"
                  placeholder="e.g. Gait retraining, Parallel bars, Passive ROM"
                  value={sessionForm.activitiesPerformed}
                  onChange={(e) => setSessionForm({ ...sessionForm, activitiesPerformed: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Progress Notes (Encrypted AES-256)</label>
                <textarea
                  rows={3}
                  value={sessionForm.progressNotes}
                  onChange={(e) => setSessionForm({ ...sessionForm, progressNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSessionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: PERFORM FIM ASSESSMENT ──────────────────────────────────── */}
      {showFimModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Sliders size={18} className="text-red-600" /> 18-Item FIM Functional Evaluation
              </h3>
              <button onClick={() => setShowFimModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFimSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIM_ITEMS.map((item) => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">{item.label}</span>
                      <span className="text-[10px] text-brand-blue font-extrabold uppercase">{item.category}</span>
                    </div>
                    <select
                      value={fimScores[item.id] || 5}
                      onChange={(e) => setFimScores({ ...fimScores, [item.id]: parseInt(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    >
                      {FIM_LEVELS.map((lvl) => (
                        <option key={lvl.level} value={lvl.level}>{lvl.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFimModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Submit FIM Evaluation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CHILD DEVELOPMENT ASSESSMENT ────────────────────────────── */}
      {showDevModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Baby size={18} className="text-red-600" /> Pediatric Child Development Evaluation
              </h3>
              <button onClick={() => setShowDevModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDevSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Child Patient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leo Sangris"
                  value={devForm.patientName}
                  onChange={(e) => setDevForm({ ...devForm, patientName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Assessment Type</label>
                <select
                  value={devForm.assessmentType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDevForm({
                      ...devForm,
                      assessmentType: val,
                      screeningToolUsed: val === 'ASD_SCREENING' ? 'M-CHAT-R' : '4-Digit Diagnostic Code'
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="ASD_SCREENING">Autism Spectrum Screening (ASD)</option>
                  <option value="FASD_PEDIATRIC">Fetal Alcohol Spectrum Evaluation (FASD)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Follow-up Recommendation</label>
                <textarea
                  rows={2}
                  value={devForm.recommendedFollowUp}
                  onChange={(e) => setDevForm({ ...devForm, recommendedFollowUp: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDevModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
                >
                  Record Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
