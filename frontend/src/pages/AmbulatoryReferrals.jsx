import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch } from 'react-redux';
import {
  Stethoscope, Plus, Search, Activity, AlertTriangle, Clock,
  CheckCircle2, ChevronRight, FileText, X, RefreshCw,
  User, Building2, Calendar, ClipboardList, Send,
  ArrowRight, Eye, Filter, Clipboard, Heart, Brain,
  Microscope, Scissors, BarChart2, Baby, Eye as EyeIcon,
  Wind, Bone
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ── Constants ──────────────────────────────────────────────────────────────────

const PERMANENT_SPECIALTIES = [
  'ANESTHESIOLOGY', 'GENERAL_SURGERY', 'INTERNAL_MEDICINE', 'OBGYN',
  'ORTHOPEDICS', 'OPHTHALMOLOGY', 'ENT', 'MEDICAL_ONCOLOGY',
  'PEDIATRICS', 'PSYCHIATRY', 'RADIOLOGY'
];

const VISITING_SPECIALTIES = [
  'GASTROENTEROLOGY', 'NEPHROLOGY', 'NEUROLOGY',
  'PEDIATRIC_ALLERGY', 'PEDIATRIC_CARDIOLOGY', 'PEDIATRIC_NEUROLOGY', 'UROLOGY'
];

const ALL_SPECIALTIES = [...PERMANENT_SPECIALTIES, ...VISITING_SPECIALTIES];

const SPECIALTY_LABELS = {
  ANESTHESIOLOGY:      'Anesthesiology',
  GENERAL_SURGERY:     'General Surgery',
  INTERNAL_MEDICINE:   'Internal Medicine',
  OBGYN:               'OB/GYN',
  ORTHOPEDICS:         'Orthopedics',
  OPHTHALMOLOGY:       'Ophthalmology',
  ENT:                 'ENT',
  MEDICAL_ONCOLOGY:    'Medical Oncology',
  PEDIATRICS:          'Pediatrics',
  PSYCHIATRY:          'Psychiatry',
  RADIOLOGY:           'Radiology',
  GASTROENTEROLOGY:    'Gastroenterology',
  NEPHROLOGY:          'Nephrology',
  NEUROLOGY:           'Neurology',
  PEDIATRIC_ALLERGY:   'Pediatric Allergy',
  PEDIATRIC_CARDIOLOGY:'Pediatric Cardiology',
  PEDIATRIC_NEUROLOGY: 'Pediatric Neurology',
  UROLOGY:             'Urology',
};

const URGENCY_CONFIG = {
  ROUTINE:  { label: 'Routine',  cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  URGENT:   { label: 'Urgent',   cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  EMERGENT: { label: 'Emergent', cls: 'bg-red-100 text-red-800 border-red-200' },
};

const STATUS_CONFIG = {
  SUBMITTED:  { label: 'Submitted',  cls: 'bg-sky-100 text-sky-700 border-sky-200',         dot: 'bg-sky-500' },
  TRIAGED:    { label: 'Triaged',    cls: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  WAITLISTED: { label: 'Waitlisted', cls: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  SCHEDULED:  { label: 'Scheduled',  cls: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  COMPLETED:  { label: 'Completed',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  DECLINED:   { label: 'Declined',   cls: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500' },
};

const TRIAGE_DOMAINS = [
  { key: 'physicalNeeds',     label: 'Physical Needs',     icon: Heart,         desc: 'Pain, mobility, chronic conditions, ADL limitations' },
  { key: 'emotionalNeeds',    label: 'Emotional Needs',    icon: Brain,         desc: 'Mental health, trauma history, coping capacity' },
  { key: 'psychosocialNeeds', label: 'Psychosocial Needs', icon: User,          desc: 'Housing, social support, family dynamics, culture' },
  { key: 'educationalNeeds',  label: 'Educational Needs',  icon: ClipboardList, desc: 'Health literacy, language barriers, self-care readiness' },
];

const TRIAGE_ITEMS = {
  physicalNeeds:     ['Chronic Pain', 'Limited Mobility', 'Respiratory Issues', 'Cardiac Concerns', 'Neurological Symptoms', 'Wound/Skin Care', 'Nutritional Deficit'],
  emotionalNeeds:    ['Depression / Anxiety', 'PTSD / Trauma', 'Crisis Risk', 'Grief / Loss', 'Substance Use Impact', 'Cognitive Decline'],
  psychosocialNeeds: ['Unstable Housing', 'Social Isolation', 'Family / Cultural Factors', 'Financial Hardship', 'Remote Location Barriers', 'Elder / Child Safety'],
  educationalNeeds:  ['Health Literacy Gap', 'Language Barrier', 'Self-Care Deficit', 'Medication Non-Compliance', 'Follow-Up Attendance Risk'],
};

// ── Helper Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.SUBMITTED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function UrgencyBadge({ urgency }) {
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.ROUTINE;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ value, label, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-2xl font-black text-[#0F1A3A]">{value}</span>
      </div>
      <p className="text-xs font-semibold text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AmbulatoryReferrals() {
  const dispatch = useDispatch();
  const { t } = useLanguage();

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState('referrals');
  const [referrals, setReferrals]       = useState([]);
  const [specialties, setSpecialties]   = useState(ALL_SPECIALTIES);
  const [loading, setLoading]           = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create Referral modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: '', patientName: '', referringProviderId: '',
    specialty: '', facilityId: 'STH', reasonForReferral: '', urgency: 'ROUTINE'
  });
  const [submitting, setSubmitting] = useState(false);

  const resetCreateModal = () => {
    setShowCreate(false);
    setCreateForm({ patientId: '', patientName: '', referringProviderId: '', specialty: '', facilityId: 'STH', reasonForReferral: '', urgency: 'ROUTINE' });
    setPatientSearchQuery('');
    setPatientResults([]);
    setSelectedPatient(null);
  };

  // Patient search autocomplete
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientResults, setPatientResults]         = useState([]);
  const [patientSearching, setPatientSearching]     = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient]       = useState(null);
  const patientSearchRef = useRef(null);
  const patientDebounceRef = useRef(null);

  // Detail / Triage modal
  const [selected, setSelected]   = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showTriage, setShowTriage] = useState(false);
  const [triageData, setTriageData] = useState({
    physicalNeeds: {}, emotionalNeeds: {}, psychosocialNeeds: {}, educationalNeeds: {}
  });
  const [triageSubmitting, setTriageSubmitting] = useState(false);
  const [promotingToWaitlist, setPromotingToWaitlist] = useState(false);

  // ── Patient Search ────────────────────────────────────────────────────

  const searchPatients = useCallback(async (query) => {
    if (!query || query.trim().length < 2) { setPatientResults([]); setShowPatientDropdown(false); return; }
    setPatientSearching(true);
    try {
      const res = await client.get(`/api/admin/patients/search?query=${encodeURIComponent(query)}&limit=8`);
      setPatientResults(res.data || []);
      setShowPatientDropdown(true);
    } catch {
      setPatientResults([]);
    } finally {
      setPatientSearching(false);
    }
  }, []);

  // Debounced patient search
  useEffect(() => {
    clearTimeout(patientDebounceRef.current);
    patientDebounceRef.current = setTimeout(() => searchPatients(patientSearchQuery), 350);
    return () => clearTimeout(patientDebounceRef.current);
  }, [patientSearchQuery, searchPatients]);

  // Click outside → close patient dropdown
  useEffect(() => {
    const handler = (e) => { if (patientSearchRef.current && !patientSearchRef.current.contains(e.target)) setShowPatientDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPatient = (p) => {
    const name = p.displayName || p.patientName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || 'Unknown';
    const id   = p.patientId || p.id || '';
    setSelectedPatient({ ...p, name, id });
    setPatientSearchQuery(name);
    setCreateForm(prev => ({ ...prev, patientId: id, patientName: name }));
    setShowPatientDropdown(false);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setPatientSearchQuery('');
    setPatientResults([]);
    setCreateForm(prev => ({ ...prev, patientId: '', patientName: '' }));
  };

  // ── API Calls ─────────────────────────────────────────────────────────────

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 0, size: 50 });
      if (specialtyFilter) params.append('specialty', specialtyFilter);
      if (statusFilter)    params.append('status', statusFilter);
      const res = await client.get(`/api/ambulatory/referrals?${params}`);
      const data = res.data;
      setReferrals(Array.isArray(data) ? data : data?.content || []);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to load referrals' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, specialtyFilter, statusFilter]);

  const fetchSpecialties = useCallback(async () => {
    try {
      const res = await client.get('/api/ambulatory/specialties');
      if (Array.isArray(res.data) && res.data.length > 0) setSpecialties(res.data);
    } catch {
      // fallback to local constant
    }
  }, []);

  useEffect(() => {
    fetchSpecialties();
    fetchReferrals();
  }, [fetchSpecialties, fetchReferrals]);

  // ── Create Referral ───────────────────────────────────────────────────────

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.patientId || !createForm.patientName || !createForm.specialty) {
      dispatch(addToast({ type: 'error', message: 'Please select a patient and specialty.' }));
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/api/ambulatory/referrals', {
        ...createForm,
        referringProviderId: createForm.referringProviderId || 'GP-001'
      });
      dispatch(addToast({ type: 'success', message: 'Referral submitted successfully.' }));
      resetCreateModal();
      fetchReferrals();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to create referral' }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Triage ────────────────────────────────────────────────────────────────

  const handleTriageSubmit = async () => {
    if (!selected) return;
    setTriageSubmitting(true);
    try {
      const payload = {};
      TRIAGE_DOMAINS.forEach(({ key }) => {
        payload[key] = triageData[key] || {};
      });
      const res = await client.put(`/api/ambulatory/referrals/${selected.id}/triage`, payload);
      dispatch(addToast({ type: 'success', message: 'Triage recorded successfully.' }));
      setSelected(res.data);
      setShowTriage(false);
      fetchReferrals();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to save triage' }));
    } finally {
      setTriageSubmitting(false);
    }
  };

  // ── Promote to Waitlist ───────────────────────────────────────────────────

  const handlePromoteToWaitlist = async (referral) => {
    setPromotingToWaitlist(true);
    try {
      const res = await client.post(`/api/ambulatory/referrals/${referral.id}/waitlist`);
      dispatch(addToast({ type: 'success', message: `Patient placed on ${SPECIALTY_LABELS[referral.specialty] || referral.specialty} waitlist.` }));
      setSelected(res.data);
      fetchReferrals();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to promote to waitlist' }));
    } finally {
      setPromotingToWaitlist(false);
    }
  };

  // ── Status Update (Decline) ───────────────────────────────────────────────

  const handleDecline = async (referral) => {
    if (!window.confirm('Decline this referral?')) return;
    try {
      await client.put(`/api/ambulatory/referrals/${referral.id}/status?status=DECLINED`);
      dispatch(addToast({ type: 'info', message: 'Referral declined.' }));
      fetchReferrals();
      if (showDetail) setShowDetail(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to decline referral' }));
    }
  };

  // ── Derived / Filtered Data ───────────────────────────────────────────────

  const filtered = referrals.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (r.patientName || '').toLowerCase().includes(q)
      || (r.specialty || '').toLowerCase().includes(q)
      || (r.reasonForReferral || '').toLowerCase().includes(q)
      || (r.id || '').toLowerCase().includes(q);
  });

  const kpis = {
    total:      referrals.length,
    submitted:  referrals.filter(r => r.status === 'SUBMITTED').length,
    triaged:    referrals.filter(r => r.status === 'TRIAGED').length,
    waitlisted: referrals.filter(r => r.status === 'WAITLISTED').length,
    completed:  referrals.filter(r => r.status === 'COMPLETED').length,
  };

  // ── Triage checkbox toggle ────────────────────────────────────────────────

  const toggleTriageItem = (domain, item) => {
    setTriageData(prev => {
      const existing = prev[domain] || {};
      const updated = { ...existing };
      if (updated[item]) delete updated[item];
      else updated[item] = true;
      return { ...prev, [domain]: updated };
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F7FC] p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1A3C8F] to-[#C8102E] flex items-center justify-center shadow-lg">
            <Stethoscope size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0F1A3A]">{t('Ambulatory Referrals')}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('11 Permanent · 6 Visiting Specialties · RFP 2.10')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#C8102E] hover:bg-[#a00e26] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-red-200 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus size={16} /> {t('New Referral')}
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard value={kpis.total}      label={t('Total Referrals')}  icon={FileText}     color="bg-[#1A3C8F]" />
        <KpiCard value={kpis.submitted}  label={t('Awaiting Triage')} icon={Clock}         color="bg-sky-500" />
        <KpiCard value={kpis.triaged}    label={t('Triaged')}          icon={ClipboardList} color="bg-violet-500" />
        <KpiCard value={kpis.waitlisted} label={t('Waitlisted')}       icon={Activity}      color="bg-amber-500" />
        <KpiCard value={kpis.completed}  label={t('Completed')}        icon={CheckCircle2}  color="bg-emerald-500" />
      </div>

      {/* ── Filters & Search ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={t('Search patient, specialty, reason...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1A3C8F] focus:ring-1 focus:ring-[#1A3C8F] outline-none bg-slate-50 transition-all"
            />
          </div>

          {/* Specialty filter */}
          <select
            value={specialtyFilter}
            onChange={e => setSpecialtyFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1A3C8F] outline-none bg-slate-50 min-w-[180px]"
          >
            <option value="">{t('All Specialties')}</option>
            <optgroup label={t('Permanent')}>
              {PERMANENT_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
            </optgroup>
            <optgroup label={t('Visiting')}>
              {VISITING_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
            </optgroup>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#1A3C8F] outline-none bg-slate-50 min-w-[160px]"
          >
            <option value="">{t('All Statuses')}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <button onClick={fetchReferrals} className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:text-[#1A3C8F] hover:border-[#1A3C8F] transition-colors bg-slate-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Specialty Cards (Overview) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Stethoscope size={15} className="text-[#1A3C8F]" />
          {t('Supported Specialties')}
        </h2>
        <div className="mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#1A3C8F] mb-2">{t('Permanent (11)')}</p>
          <div className="flex flex-wrap gap-2">
            {PERMANENT_SPECIALTIES.map(s => (
              <button key={s}
                onClick={() => setSpecialtyFilter(specialtyFilter === s ? '' : s)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  specialtyFilter === s
                    ? 'bg-[#1A3C8F] text-white border-[#1A3C8F]'
                    : 'bg-blue-50 text-[#1A3C8F] border-blue-100 hover:bg-blue-100'
                }`}
              >
                {SPECIALTY_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">{t('Visiting (6)')}</p>
          <div className="flex flex-wrap gap-2">
            {VISITING_SPECIALTIES.map(s => (
              <button key={s}
                onClick={() => setSpecialtyFilter(specialtyFilter === s ? '' : s)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  specialtyFilter === s
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                }`}
              >
                {SPECIALTY_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Referrals Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700">
            {t('Referrals')}
            <span className="ml-2 px-2 py-0.5 bg-[#1A3C8F]/10 text-[#1A3C8F] text-[10px] font-black rounded-full">
              {filtered.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-medium">{t('Loading...')}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Stethoscope size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-400">{t('No referrals found')}</p>
            <p className="text-xs text-slate-300 mt-1">{t('Submit a new referral to get started')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[t('Patient'), t('Specialty'), t('Urgency'), t('Status'), t('Referring Provider'), t('Reason'), t('Actions')].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1A3C8F] to-[#C8102E] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                          {(r.patientName || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F1A3A] text-xs leading-tight">{r.patientName || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400">ID: {r.patientId || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-xs text-[#0F1A3A]">{SPECIALTY_LABELS[r.specialty] || r.specialty}</p>
                        <p className="text-[10px] text-slate-400">
                          {PERMANENT_SPECIALTIES.includes(r.specialty) ? t('Permanent') : t('Visiting')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3"><UrgencyBadge urgency={r.urgency} /></td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-medium">{r.referringProviderId || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-slate-600 max-w-[160px] truncate" title={r.reasonForReferral}>
                        {r.reasonForReferral || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setSelected(r); setShowDetail(true); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1A3C8F] hover:bg-blue-50 transition-colors"
                          title={t('View Details')}
                        >
                          <Eye size={14} />
                        </button>
                        {r.status === 'SUBMITTED' && (
                          <button
                            onClick={() => { setSelected(r); setTriageData({ physicalNeeds: {}, emotionalNeeds: {}, psychosocialNeeds: {}, educationalNeeds: {} }); setShowTriage(true); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                            title={t('Record Triage')}
                          >
                            <ClipboardList size={14} />
                          </button>
                        )}
                        {r.status === 'TRIAGED' && (
                          <button
                            onClick={() => handlePromoteToWaitlist(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title={t('Promote to Waitlist')}
                          >
                            <ArrowRight size={14} />
                          </button>
                        )}
                        {!['COMPLETED', 'DECLINED', 'WAITLISTED', 'SCHEDULED'].includes(r.status) && (
                          <button
                            onClick={() => handleDecline(r)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title={t('Decline Referral')}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE REFERRAL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A3C8F] to-[#C8102E] flex items-center justify-center">
                  <Plus size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0F1A3A]">{t('New Ambulatory Referral')}</h2>
                  <p className="text-xs text-slate-500">{t('Refer patient to a specialist')}</p>
                </div>
              </div>
              <button onClick={resetCreateModal} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* ── Patient Search (replaces manual Patient ID + Name fields) ── */}
              <div ref={patientSearchRef} className="relative col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  {t('Patient')} *
                  {createForm.patientId && (
                    <span className="ml-2 text-emerald-600 font-semibold">✓ Selected</span>
                  )}
                </label>

                {/* Selected patient card */}
                {selectedPatient ? (
                  <div className="flex items-center gap-3 bg-gradient-to-r from-[#1A3C8F]/5 to-transparent border border-[#1A3C8F]/20 rounded-xl px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A3C8F] to-[#C8102E] flex items-center justify-center text-white font-black text-sm shrink-0">
                      {selectedPatient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#0F1A3A] truncate">{selectedPatient.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">ID: {selectedPatient.id}</span>
                        {selectedPatient.age && <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold">{selectedPatient.age}y</span>}
                        {(selectedPatient.gender || selectedPatient.patientGender) && <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-semibold">{selectedPatient.gender || selectedPatient.patientGender}</span>}
                        {(selectedPatient.phone || selectedPatient.patientPhone) && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-semibold">{selectedPatient.phone || selectedPatient.patientPhone}</span>}
                        {selectedPatient.bloodGroup && <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">{selectedPatient.bloodGroup}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={clearPatient}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    {patientSearching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={13} />}
                    <input
                      type="text"
                      value={patientSearchQuery}
                      onChange={e => setPatientSearchQuery(e.target.value)}
                      onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                      placeholder={t('Type patient name, ID, phone or email...')}
                      className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] focus:ring-1 focus:ring-[#1A3C8F] outline-none bg-slate-50 transition-all"
                    />
                  </div>
                )}

                {/* Dropdown results */}
                {showPatientDropdown && patientResults.length > 0 && !selectedPatient && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {patientResults.map((p, i) => {
                      const name = p.displayName || p.patientName || p.email || 'Unknown';
                      const pid  = p.patientId || p.id || '';
                      return (
                        <button key={pid || i} type="button"
                          onClick={() => selectPatient(p)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1A3C8F]/5 transition-colors text-left border-b border-slate-50 last:border-0">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1A3C8F] to-[#C8102E] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#0F1A3A] truncate">{name}</p>
                            <p className="text-[10px] text-slate-400">{pid}{p.age ? ` · ${p.age}y` : ''}{(p.gender || p.patientGender) ? ` · ${p.gender || p.patientGender}` : ''}</p>
                          </div>
                          {(p.phone || p.patientPhone) && (
                            <span className="text-[10px] text-slate-400 shrink-0">{p.phone || p.patientPhone}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {showPatientDropdown && patientResults.length === 0 && !patientSearching && patientSearchQuery.length >= 2 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3 text-xs text-slate-400 text-center">
                    {t('No patients found matching')} "{patientSearchQuery}"
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('Referring Provider ID')}</label>
                  <input
                    type="text"
                    value={createForm.referringProviderId}
                    onChange={e => setCreateForm(p => ({ ...p, referringProviderId: e.target.value }))}
                    placeholder="GP / Physician ID"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] focus:ring-1 focus:ring-[#1A3C8F] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('Facility')}</label>
                  <select
                    value={createForm.facilityId}
                    onChange={e => setCreateForm(p => ({ ...p, facilityId: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] outline-none"
                  >
                    <option value="STH">Stanton Territorial Hospital</option>
                    <option value="HRRHC">Hay River Regional (HRRHC)</option>
                    <option value="IRH">Inuvik Regional (IRH)</option>
                    <option value="FWFN">Fort Smith Health Centre</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('Specialty')} *</label>
                  <select
                    required
                    value={createForm.specialty}
                    onChange={e => setCreateForm(p => ({ ...p, specialty: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] outline-none"
                  >
                    <option value="">{t('Select specialty...')}</option>
                    <optgroup label={t('Permanent (11)')}>
                      {PERMANENT_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
                    </optgroup>
                    <optgroup label={t('Visiting (6)')}>
                      {VISITING_SPECIALTIES.map(s => <option key={s} value={s}>{SPECIALTY_LABELS[s]}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('Urgency')} *</label>
                  <select
                    required
                    value={createForm.urgency}
                    onChange={e => setCreateForm(p => ({ ...p, urgency: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] outline-none"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="EMERGENT">Emergent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">{t('Reason for Referral')} *</label>
                <textarea
                  required
                  rows={3}
                  value={createForm.reasonForReferral}
                  onChange={e => setCreateForm(p => ({ ...p, reasonForReferral: e.target.value }))}
                  placeholder={t('Describe the clinical indication for this referral...')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-[#1A3C8F] focus:ring-1 focus:ring-[#1A3C8F] outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetCreateModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  {t('Cancel')}
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#a00e26] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {t('Submit Referral')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-[#0F1A3A]">{t('Referral Details')}</h2>
                <p className="text-xs text-slate-400 mt-0.5">ID: {selected.id}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Status + Urgency row */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={selected.status} />
                <UrgencyBadge urgency={selected.urgency} />
                <span className="text-xs text-slate-400">{SPECIALTY_LABELS[selected.specialty] || selected.specialty}</span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Patient', `${selected.patientName} (${selected.patientId})`],
                  ['Referring Provider', selected.referringProviderId],
                  ['Facility', selected.facilityId],
                  ['Specialty Type', PERMANENT_SPECIALTIES.includes(selected.specialty) ? 'Permanent' : 'Visiting'],
                  ['Created By', selected.createdBy],
                  ['Created At', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{t(label)}</p>
                    <p className="text-xs font-semibold text-[#0F1A3A]">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{t('Reason for Referral')}</p>
                <p className="text-sm text-slate-700">{selected.reasonForReferral || '—'}</p>
              </div>

              {/* Triage section */}
              {selected.triage && (
                <div className="border border-violet-100 rounded-xl p-4 bg-violet-50/30">
                  <p className="text-xs font-black text-violet-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <ClipboardList size={13} /> {t('Triage Assessment')}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {TRIAGE_DOMAINS.map(({ key, label }) => {
                      const items = Object.keys(selected.triage[key] || {});
                      return (
                        <div key={key} className="bg-white rounded-lg p-3 border border-violet-100">
                          <p className="text-[10px] font-bold text-violet-600 mb-1">{label}</p>
                          {items.length > 0
                            ? items.map(i => <p key={i} className="text-[10px] text-slate-600">• {i}</p>)
                            : <p className="text-[10px] text-slate-300">None flagged</p>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between bg-violet-100 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-violet-700">{t('Triage Score')}</span>
                    <span className="text-lg font-black text-violet-800">{selected.triage.triageScore ?? '—'}</span>
                  </div>
                  {selected.triage.triagedBy && (
                    <p className="text-[10px] text-slate-400 mt-2">
                      {t('Triaged by')} {selected.triage.triagedBy} · {selected.triage.triagedAt ? new Date(selected.triage.triagedAt).toLocaleDateString() : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Waitlist link */}
              {selected.linkedWaitlistEntryId && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Activity size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">{t('Waitlist Entry')}: {selected.linkedWaitlistEntryId}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                {selected.status === 'SUBMITTED' && (
                  <button
                    onClick={() => { setShowDetail(false); setTriageData({ physicalNeeds: {}, emotionalNeeds: {}, psychosocialNeeds: {}, educationalNeeds: {} }); setShowTriage(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"
                  >
                    <ClipboardList size={14} /> {t('Record Triage')}
                  </button>
                )}
                {selected.status === 'TRIAGED' && (
                  <button
                    onClick={() => { handlePromoteToWaitlist(selected); }}
                    disabled={promotingToWaitlist}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
                  >
                    {promotingToWaitlist ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {t('Promote to Waitlist')}
                  </button>
                )}
                {!['COMPLETED', 'DECLINED', 'WAITLISTED', 'SCHEDULED'].includes(selected.status) && (
                  <button
                    onClick={() => handleDecline(selected)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold transition-colors border border-red-200"
                  >
                    <X size={14} /> {t('Decline')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TRIAGE MODAL — 4-Domain Accreditation Checklist
      ══════════════════════════════════════════════════════════════════════ */}
      {showTriage && selected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                  <ClipboardList size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0F1A3A]">{t('Triage Assessment')}</h2>
                  <p className="text-xs text-slate-500">{selected.patientName} · {SPECIALTY_LABELS[selected.specialty]}</p>
                </div>
              </div>
              <button onClick={() => setShowTriage(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700 font-medium">
                {t('Select all applicable needs across the 4 accreditation domains. The triage score is computed automatically based on your selections.')}
              </div>

              {TRIAGE_DOMAINS.map(({ key, label, icon: Icon, desc }) => (
                <div key={key} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Icon size={14} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                    <span className="ml-auto text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                      {Object.keys(triageData[key] || {}).length} {t('selected')}
                    </span>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {TRIAGE_ITEMS[key].map(item => {
                      const active = !!(triageData[key] || {})[item];
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleTriageItem(key, item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                            active
                              ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                          }`}
                        >
                          {active && <span className="mr-1">✓</span>}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Score preview */}
              <div className="bg-gradient-to-r from-violet-600 to-[#1A3C8F] rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-semibold">{t('Estimated Triage Score')}</p>
                  <p className="text-white text-[10px] mt-0.5">
                    {t('≥6 → Urgent · ≥3 → High · <3 → Routine')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-white">
                    {TRIAGE_DOMAINS.reduce((sum, { key }) => sum + Object.keys(triageData[key] || {}).length, 0)}
                  </span>
                  <p className="text-white/60 text-[10px] mt-0.5">
                    {(() => {
                      const score = TRIAGE_DOMAINS.reduce((sum, { key }) => sum + Object.keys(triageData[key] || {}).length, 0);
                      if (score >= 6) return '→ URGENT';
                      if (score >= 3) return '→ HIGH';
                      return '→ ROUTINE';
                    })()}
                  </p>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button onClick={() => setShowTriage(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                  {t('Cancel')}
                </button>
                <button onClick={handleTriageSubmit} disabled={triageSubmitting}
                  className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
                  {triageSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {t('Save Triage Assessment')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
