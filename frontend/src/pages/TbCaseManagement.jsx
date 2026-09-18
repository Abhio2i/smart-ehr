import { useState, useEffect, useCallback, memo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Plus, RefreshCw, X, ChevronRight, AlertTriangle, CheckCircle2,
  Users, Activity, Loader2, Search, ClipboardList, ArrowRight,
  Filter, Bell, Timer, TrendingUp, UserCheck, XCircle,
  Stethoscope, Building2, Info, Trash2, ChevronDown,
  BarChart3, Eye, Microscope, FileText, Link2, Calendar,
  Heart, Thermometer, Pill, AlertCircle, Shield, ChevronUp
} from 'lucide-react';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-CA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return str; }
};

const fmtDateTime = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleString('en-CA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return str; }
};

// ── Config Maps ───────────────────────────────────────────────────────────────

const CASE_STATUS_META = {
  SUSPECTED:           { label: 'Suspected',           cls: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500' },
  CONFIRMED:           { label: 'Confirmed',           cls: 'bg-red-50 text-red-700 border-red-200',           dot: 'bg-red-500' },
  ACTIVE_TREATMENT:    { label: 'Active Treatment',    cls: 'bg-blue-50 text-blue-700 border-blue-200',        dot: 'bg-blue-500' },
  TREATMENT_COMPLETED: { label: 'Treatment Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  LOST_TO_FOLLOW_UP:   { label: 'Lost to Follow-up',  cls: 'bg-gray-100 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
  DIED:                { label: 'Died',                cls: 'bg-rose-50 text-rose-700 border-rose-200',        dot: 'bg-rose-600' },
  CLOSED:              { label: 'Closed',              cls: 'bg-slate-50 text-slate-500 border-slate-200',     dot: 'bg-slate-400' },
};

const RISK_META = {
  HIGH:   { cls: 'bg-red-50 text-red-700 border-red-200',    dot: 'bg-red-500',    icon: '🔴' },
  MEDIUM: { cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: '🟡' },
  LOW:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: '🟢' },
};

const INVESTIGATION_META = {
  IDENTIFIED:          { label: 'Identified',        cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  CONTACTED:           { label: 'Contacted',         cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  EVALUATION_PENDING:  { label: 'Eval. Pending',     cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  EVALUATED:           { label: 'Evaluated',         cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  COMPLETED:           { label: 'Completed',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LOST_TO_FOLLOW_UP:   { label: 'Lost to Follow-up', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  REFUSED:             { label: 'Refused',           cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const CLASSIFICATION_META = {
  PULMONARY:         { label: 'Pulmonary TB',      icon: '🫁', cls: 'text-red-600' },
  EXTRA_PULMONARY:   { label: 'Extra-Pulmonary TB', icon: '🦴', cls: 'text-amber-600' },
  LATENT_TB_INFECTION: { label: 'LTBI (Latent)',   icon: '💤', cls: 'text-blue-600' },
};

const TST_RESULT_META = {
  POSITIVE:       { cls: 'text-red-600 font-bold', label: '+ Positive' },
  NEGATIVE:       { cls: 'text-emerald-600 font-bold', label: '- Negative' },
  INDETERMINATE:  { cls: 'text-amber-600 font-bold', label: '? Indeterminate' },
  PENDING_READ:   { cls: 'text-blue-600 font-bold', label: '⏳ Pending Read' },
};

// ── Sub-Components ────────────────────────────────────────────────────────────

const Modal = memo(({ open, onClose, title, children, size = 'md', subtitle }) => {
  if (!open) return null;
  const sizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,20,60,0.55)', backdropFilter: 'blur(6px)' }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between p-5 border-b border-[#F0F4FC]">
          <div>
            <h3 className="text-base font-black text-[#0F1A3A]">{title}</h3>
            {subtitle && <p className="text-xs text-[#8A97B0] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F0F4FC] transition-colors">
            <X size={16} className="text-[#5A6A8A]" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
});

const StatusBadge = ({ status, map }) => {
  const m = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.dot && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
      {m.label || status?.replace(/_/g, ' ')}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-black text-[#0F1A3A]">{value ?? '—'}</p>
      <p className="text-xs text-[#8A97B0] font-semibold">{label}</p>
      {sub && <p className="text-[10px] text-[#A0AECB] mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Field = ({ label, children, required, error, hint }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-[#3A4A6A]">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    {hint && !error && <p className="text-[10px] text-[#A0AECB]">{hint}</p>}
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TbCaseManagement() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const role = useSelector(st => st.auth.user?.role);
  const canStaff = ['ADMIN', 'PHYSICIAN'].includes(role);
  const canView  = ['ADMIN', 'PHYSICIAN', 'PARAMEDIC', 'MANAGER'].includes(role);

  const [tab, setTab] = useState('cases');
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filterStatus, setFilterStatus] = useState('');

  // Selected case & contacts
  const [selectedCase, setSelectedCase] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [tstTests, setTstTests] = useState([]);
  const [tstLoading, setTstLoading] = useState(false);

  // Modals
  const [addCaseOpen, setAddCaseOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addTstOpen, setAddTstOpen] = useState(false);
  const [caseDetailOpen, setCaseDetailOpen] = useState(false);
  const [sputumOpen, setSputumOpen] = useState(false);

  // Forms
  const [caseForm, setCaseForm] = useState({
    patientId: '', patientName: '', patientDob: '', patientPhone: '', patientAddress: '',
    classification: 'PULMONARY', tbSite: 'Lung', symptomStartDate: '', diagnosisDate: '',
    notificationDate: '', treatmentStartDate: '', riskFactors: [], facilityId: '',
    assignedNurseName: '', notes: ''
  });
  const [contactForm, setContactForm] = useState({
    contactName: '', contactPhone: '', contactEmail: '', contactAddress: '',
    dateOfBirth: '', gender: '', riskLevel: 'HIGH', exposureType: 'HOUSEHOLD',
    exposureStartDate: '', exposureEndDate: '', avgExposureHoursPerDay: '',
    assignedNurseName: '', notes: ''
  });
  const [tstForm, setTstForm] = useState({
    testType: 'TST', plantDate: '', plantedBy: '', plantArm: 'LEFT', plantBatchNumber: '',
    readDate: '', readBy: '', indurationMm: '', result: 'PENDING_READ',
    clinicianInterpretation: '', chestXrayDate: '', chestXrayResult: '', chestXrayFindings: '', notes: ''
  });
  const [sputumForm, setSputumForm] = useState({
    sampleIndex: '1',
    result: 'PENDING',
    dateCollected: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Directly Observed Therapy (DOT) Logs States
  const [dotLogs, setDotLogs] = useState([]);
  const [dotLoading, setDotLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Patient Lookup Search States
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const RISK_FACTORS = ['Homelessness', 'HIV/AIDS', 'Diabetes', 'Congregate Living', 'Recent Travel (High TB Burden)', 'Substance Use', 'Immunosuppressed', 'Healthcare Worker', 'Prison/Correctional'];

  // ── Fetch Functions ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/tb/stats');
      setStats(res.data);
    } catch { /* non-critical */ }
  }, []);

  const fetchCases = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = { page, size: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/api/tb/cases', { params });
      setCases(res.data?.content || []);
      setTotalPages(res.data?.totalPages || 0);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load TB cases.' })); }
    finally { setLoading(false); }
  }, [canView, page, filterStatus, dispatch]);

  const fetchContacts = useCallback(async (caseId) => {
    setContactsLoading(true);
    try {
      const res = await api.get(`/api/tb/cases/${caseId}/contacts`);
      setContacts(res.data || []);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load contacts.' })); }
    finally { setContactsLoading(false); }
  }, [dispatch]);

  const fetchTstTests = useCallback(async (contactId) => {
    setTstLoading(true);
    try {
      const res = await api.get(`/api/tb/contacts/${contactId}/tst`);
      setTstTests(res.data || []);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load TST tests.' })); }
    finally { setTstLoading(false); }
  }, [dispatch]);

  useEffect(() => { fetchStats(); fetchCases(); }, [fetchStats, fetchCases]);

  // ── Patient Lookup Search Action ───────────────────────────────────────────

  const handlePatientSearch = async (q) => {
    setPatientSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setPatientSearchResults([]);
      setShowPatientDropdown(false);
      return;
    }
    setSearchingPatients(true);
    try {
      const res = await api.get('/api/admin/patients/search', { params: { query: q, limit: 8 } });
      setPatientSearchResults(res.data || []);
      setShowPatientDropdown(true);
    } catch {
      // Fail silently for search lookups
    } finally {
      setSearchingPatients(false);
    }
  };

  const selectPatientFromSearch = (p) => {
    setCaseForm(f => ({
      ...f,
      patientId: p.patientId || p.id,
      patientName: p.patientName || p.displayName,
      patientDob: p.patientDateOfBirth || p.dateOfBirth || '',
      patientPhone: p.patientPhone || p.phone || '',
      patientAddress: p.patientAddress || ''
    }));
    setShowPatientDropdown(false);
    setPatientSearchQuery('');
  };

  // ── Case Actions ───────────────────────────────────────────────────────────

  const fetchDotLogs = useCallback(async (caseId) => {
    setDotLoading(true);
    try {
      const res = await api.get(`/api/tb/cases/${caseId}/dot`);
      setDotLogs(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load DOT compliance logs.' }));
    } finally {
      setDotLoading(false);
    }
  }, [dispatch]);

  const handleSelectCase = async (c) => {
    setSelectedCase(c);
    setSelectedContact(null);
    setTstTests([]);
    await fetchContacts(c.id);
    await fetchDotLogs(c.id);
    setTab('detail');
  };

  const handleRecordDot = async (caseId, dateStr, status) => {
    try {
      await api.post(`/api/tb/cases/${caseId}/dot`, {
        logDate: dateStr,
        status: status,
        notes: ''
      });
      dispatch(addToast({ type: 'success', message: 'Daily medication log updated.' }));
      fetchDotLogs(caseId);
      fetchStats();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update compliance log.' }));
    }
  };

  const handleUpdateSputum = async () => {
    if (!sputumForm.dateCollected) {
      dispatch(addToast({ type: 'error', message: 'Collection date is required.' }));
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.put(`/api/tb/cases/${selectedCase.id}/sputum`, sputumForm);
      setSelectedCase(res.data);
      dispatch(addToast({ type: 'success', message: `Sputum sample ${sputumForm.sampleIndex} result updated.` }));
      setSputumOpen(false);
      setSputumForm({ sampleIndex: '1', result: 'PENDING', dateCollected: '' });
      fetchCases();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update sputum result.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCase = async () => {
    if (!caseForm.patientName.trim() || !caseForm.patientId.trim()) {
      dispatch(addToast({ type: 'error', message: 'Patient ID and Name are required.' }));
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/tb/cases', caseForm);
      dispatch(addToast({ type: 'success', message: 'TB case created successfully.' }));
      setAddCaseOpen(false);
      setCaseForm({ patientId: '', patientName: '', patientDob: '', patientPhone: '', patientAddress: '', classification: 'PULMONARY', tbSite: 'Lung', symptomStartDate: '', diagnosisDate: '', notificationDate: '', treatmentStartDate: '', riskFactors: [], facilityId: '', assignedNurseName: '', notes: '' });
      fetchCases(); fetchStats();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.response?.data?.message || 'Failed to create case.' }));
    } finally { setSubmitting(false); }
  };

  const handleUpdateCaseStatus = async (caseId, newStatus) => {
    setActionLoading(true);
    try {
      const res = await api.put(`/api/tb/cases/${caseId}/status`, { status: newStatus });
      setSelectedCase(res.data);
      dispatch(addToast({ type: 'success', message: `Status updated to ${newStatus.replace(/_/g, ' ')}.` }));
      fetchCases(); fetchStats();
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to update status.' })); }
    finally { setActionLoading(false); }
  };

  // ── Contact Actions ────────────────────────────────────────────────────────

  const handleAddContact = async () => {
    if (!contactForm.contactName.trim()) {
      dispatch(addToast({ type: 'error', message: 'Contact name is required.' }));
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/tb/cases/${selectedCase.id}/contacts`, {
        ...contactForm,
        avgExposureHoursPerDay: contactForm.avgExposureHoursPerDay ? parseInt(contactForm.avgExposureHoursPerDay) : null
      });
      dispatch(addToast({ type: 'success', message: 'Contact linked to case.' }));
      setAddContactOpen(false);
      setContactForm({ contactName: '', contactPhone: '', contactEmail: '', contactAddress: '', dateOfBirth: '', gender: '', riskLevel: 'HIGH', exposureType: 'HOUSEHOLD', exposureStartDate: '', exposureEndDate: '', avgExposureHoursPerDay: '', assignedNurseName: '', notes: '' });
      fetchContacts(selectedCase.id);
      fetchStats();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.response?.data?.message || 'Failed to link contact.' }));
    } finally { setSubmitting(false); }
  };

  const handleUpdateContactStatus = async (contactId, newStatus) => {
    setActionLoading(true);
    try {
      await api.put(`/api/tb/contacts/${contactId}/status`, { status: newStatus });
      dispatch(addToast({ type: 'success', message: 'Contact status updated.' }));
      fetchContacts(selectedCase.id);
      fetchStats();
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to update contact status.' })); }
    finally { setActionLoading(false); }
  };

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
    fetchTstTests(contact.id);
    setTab('tst');
  };

  // ── TST Actions ────────────────────────────────────────────────────────────

  const handleAddTst = async () => {
    setSubmitting(true);
    try {
      await api.post(`/api/tb/contacts/${selectedContact.id}/tst`, {
        ...tstForm,
        indurationMm: tstForm.indurationMm ? parseInt(tstForm.indurationMm) : null
      });
      dispatch(addToast({ type: 'success', message: 'TST record saved.' }));
      setAddTstOpen(false);
      setTstForm({ testType: 'TST', plantDate: '', plantedBy: '', plantArm: 'LEFT', plantBatchNumber: '', readDate: '', readBy: '', indurationMm: '', result: 'PENDING_READ', clinicianInterpretation: '', chestXrayDate: '', chestXrayResult: '', chestXrayFindings: '', notes: '' });
      fetchTstTests(selectedContact.id);
    } catch (e) {
      dispatch(addToast({ type: 'error', message: e.response?.data?.message || 'Failed to save TST record.' }));
    } finally { setSubmitting(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[var(--bg-main)]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center shadow-lg">
              <Microscope size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F1A3A]">TB Case & Contact Management</h1>
              <p className="text-xs text-[#8A97B0] font-medium mt-0.5">Tuberculosis Case Registry · Contact Tracing · TST Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchCases(); fetchStats(); }} disabled={loading}
              className="btn-ghost px-3 py-2 text-xs rounded-xl border border-[#DDE3F0]">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {canStaff && (
              <button id="new-tb-case-btn" onClick={() => setAddCaseOpen(true)}
                className="btn-primary text-xs px-4 py-2 rounded-xl">
                <Plus size={14} /> New TB Case
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active Cases" value={stats?.activeTreatmentCases} icon={Activity}
            color="bg-gradient-to-br from-blue-500 to-blue-700" sub={`${stats?.confirmedCases || 0} confirmed`} />
          <StatCard label="Total Contacts" value={stats?.totalContacts} icon={Users}
            color="bg-gradient-to-br from-violet-500 to-violet-700" sub={`${stats?.highRiskContacts || 0} high risk`} />
          <StatCard label="Pending Evaluation" value={stats?.pendingEvaluationContacts} icon={Timer}
            color="bg-gradient-to-br from-amber-500 to-orange-600" sub="contacts awaiting TST" />
          <StatCard label="Investigations Done" value={stats?.completedContactInvestigations} icon={CheckCircle2}
            color="bg-gradient-to-br from-emerald-500 to-green-700" sub="completed" />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 mb-3">
        <div className="flex items-center gap-1 bg-[#F0F4FC] p-1 rounded-xl w-fit flex-wrap">
          <button onClick={() => setTab('cases')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
              tab === 'cases' ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
            }`}>
            <ClipboardList size={12} /> Case Registry
          </button>
          {selectedCase && (
            <>
              <button onClick={() => setTab('detail')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  tab === 'detail' ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
                }`}>
                <Info size={12} /> Case Overview
              </button>
              <button onClick={() => setTab('dot')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  tab === 'dot' ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
                }`}>
                <Calendar size={12} /> DOT Compliance
              </button>
              <button onClick={() => setTab('contacts')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  tab === 'contacts' ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
                }`}>
                <Users size={12} /> Contacts ({contacts.length})
              </button>
            </>
          )}
          {selectedContact && (
            <button onClick={() => setTab('tst')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                tab === 'tst' ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
              }`}>
              <Microscope size={12} /> TST: {selectedContact.contactName}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">

        {/* ── CASES TAB ─────────────────────────────────────────────────────── */}
        {tab === 'cases' && (
          <div>
            {/* Filters */}
            <div className="card-flat p-3 flex flex-wrap gap-3 mb-4">
              <select id="filter-case-status" className="select-input text-xs py-2 w-48"
                value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
                <option value="">All Statuses</option>
                {Object.entries(CASE_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button onClick={fetchCases} className="btn-primary text-xs px-4 py-2 rounded-xl">
                <Filter size={12} /> Apply
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-red-500" /></div>
            ) : cases.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Microscope size={28} className="text-red-300" />
                </div>
                <p className="text-sm font-bold text-[#5A6A8A]">No TB cases found</p>
                <p className="text-xs text-[#A0AECB] mt-1">Create the first TB index case to start contact tracing.</p>
                {canStaff && (
                  <button onClick={() => setAddCaseOpen(true)} className="btn-primary mt-4 text-xs px-4 py-2 mx-auto">
                    <Plus size={12} /> New TB Case
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map(c => {
                  const cls = CASE_STATUS_META[c.status] || CASE_STATUS_META.SUSPECTED;
                  const clf = CLASSIFICATION_META[c.classification] || {};
                  return (
                    <div key={c.id} onClick={() => handleSelectCase(c)}
                      className="card p-4 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-red-200 group">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center shrink-0">
                          <span className="text-lg">{clf.icon || '🫁'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-black text-[#0F1A3A]">{c.patientName}</p>
                            <span className="text-[10px] font-mono text-[#8A97B0] bg-[#F0F4FC] px-2 py-0.5 rounded-full">{c.caseNumber}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <StatusBadge status={c.status} map={CASE_STATUS_META} />
                            <span className={`text-[10px] font-bold ${clf.cls}`}>{clf.label}</span>
                            {c.tbSite && <span className="text-[10px] text-[#8A97B0]">📍 {c.tbSite}</span>}
                          </div>
                          <div className="flex flex-wrap gap-4 text-[11px] text-[#8A97B0]">
                            <span>Diagnosed: {fmtDate(c.diagnosisDate)}</span>
                            <span>Notified: {fmtDate(c.notificationDate)}</span>
                            {c.assignedNurseName && <span>Nurse: {c.assignedNurseName}</span>}
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-[#C8D5F0] group-hover:text-red-500 transition-colors shrink-0 mt-1" />
                      </div>
                    </div>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 pt-4">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                      className="btn-ghost text-xs px-3 py-2 rounded-xl border border-[#DDE3F0]">← Prev</button>
                    <span className="text-xs text-[#8A97B0] py-2">{page + 1} / {totalPages}</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                      className="btn-ghost text-xs px-3 py-2 rounded-xl border border-[#DDE3F0]">Next →</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CASE DETAIL OVERVIEW TAB ───────────────────────────────────────── */}
        {tab === 'detail' && selectedCase && (
          <div className="space-y-4">
            {/* Case Overview Summary Card */}
            <div className="card p-5 border-l-4 border-red-500">
              <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
                <div>
                  <h3 className="text-base font-black text-[#0F1A3A]">{selectedCase.patientName}</h3>
                  <p className="text-xs text-[#8A97B0] font-mono mt-0.5">Case Reference: {selectedCase.caseNumber}</p>
                </div>
                <div className="flex gap-2">
                  <select
                    className="select-input text-xs py-1.5"
                    value={selectedCase.status}
                    onChange={e => handleUpdateCaseStatus(selectedCase.id, e.target.value)}
                    disabled={actionLoading}
                  >
                    {Object.keys(CASE_STATUS_META).map(s => (
                      <option key={s} value={s}>{CASE_STATUS_META[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs mt-2 border-t border-[#F0F4FC] pt-4">
                <div>
                  <p className="text-[#8A97B0] font-semibold">Classification</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">
                    {CLASSIFICATION_META[selectedCase.classification]?.icon} {CLASSIFICATION_META[selectedCase.classification]?.label}
                  </p>
                </div>
                <div>
                  <p className="text-[#8A97B0] font-semibold">TB Site (Anatomical)</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">{selectedCase.tbSite || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[#8A97B0] font-semibold">Diagnosis Date</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">{fmtDate(selectedCase.diagnosisDate)}</p>
                </div>
                <div>
                  <p className="text-[#8A97B0] font-semibold">Symptom Start</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">{fmtDate(selectedCase.symptomStartDate)}</p>
                </div>
                <div>
                  <p className="text-[#8A97B0] font-semibold">Assigned Nurse</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">{selectedCase.assignedNurseName || 'Not Assigned'}</p>
                </div>
                <div>
                  <p className="text-[#8A97B0] font-semibold">Facility</p>
                  <p className="font-bold text-[#0F1A3A] mt-0.5">{selectedCase.facilityId || 'General Clinic'}</p>
                </div>
              </div>

              {selectedCase.riskFactors && selectedCase.riskFactors.length > 0 && (
                <div className="mt-4 border-t border-[#F0F4FC] pt-3">
                  <p className="text-xs text-[#8A97B0] font-semibold mb-2">Clinical Risk Factors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCase.riskFactors.map(rf => (
                      <span key={rf} className="text-[10px] font-bold bg-[#FFF3E0] text-[#E65100] px-2 py-0.5 rounded-lg border border-[#FFE0B2]">
                        ⚠️ {rf}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sputum Clearance Checklist */}
            <div className="card p-5">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-sm font-black text-[#0F1A3A]">Sputum Clearance Protocol</h4>
                  <p className="text-xs text-[#8A97B0] mt-0.5">Clearance requires 3 consecutive negative lab results (collected 8-24 hours apart)</p>
                </div>
                <button
                  onClick={() => setSputumOpen(true)}
                  className="btn-primary text-xs px-3 py-1.5 rounded-xl"
                >
                  <Microscope size={12} /> Log Sample
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { index: '1', result: selectedCase.sputumSample1Result, date: selectedCase.sputumSample1Date },
                  { index: '2', result: selectedCase.sputumSample2Result, date: selectedCase.sputumSample2Date },
                  { index: '3', result: selectedCase.sputumSample3Result, date: selectedCase.sputumSample3Date },
                ].map(s => {
                  let cls = 'border-[#DDE3F0] bg-white';
                  let iconColor = 'text-[#C8D5F0]';
                  if (s.result === 'NEGATIVE') {
                    cls = 'border-emerald-200 bg-emerald-50 text-emerald-800';
                    iconColor = 'text-emerald-500';
                  } else if (s.result === 'POSITIVE') {
                    cls = 'border-red-200 bg-red-50 text-red-800';
                    iconColor = 'text-red-500';
                  } else if (s.result === 'PENDING') {
                    cls = 'border-amber-200 bg-amber-50 text-amber-800 animate-pulse';
                    iconColor = 'text-amber-500';
                  }
                  return (
                    <div key={s.index} className={`border rounded-xl p-4 flex items-center gap-3 ${cls}`}>
                      <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center font-black text-xs shadow-sm shrink-0 ${iconColor}`}>
                        #{s.index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">Sputum Sample {s.index}</p>
                        <p className="text-[10px] uppercase font-bold tracking-wider mt-0.5">
                          {s.result || 'Not Collected'}
                        </p>
                        {s.date && <p className="text-[9px] mt-0.5 opacity-75">Date: {fmtDate(s.date)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── MEDICATION DOT CALENDAR TAB ────────────────────────────────────── */}
        {tab === 'dot' && selectedCase && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <div>
                  <h4 className="text-sm font-black text-[#0F1A3A]">Directly Observed Therapy (DOT) Logs</h4>
                  <p className="text-xs text-[#8A97B0] mt-0.5">Track daily medication compliance and nurse validations.</p>
                </div>
                {/* Month Selector */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() - 1);
                      setCurrentMonth(d);
                    }}
                    className="btn-ghost px-2 py-1 rounded-lg border border-[#DDE3F0] text-xs"
                  >
                    ← Prev Month
                  </button>
                  <span className="text-xs font-bold text-[#0F1A3A]">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      const d = new Date(currentMonth);
                      d.setMonth(d.getMonth() + 1);
                      setCurrentMonth(d);
                    }}
                    className="btn-ghost px-2 py-1 rounded-lg border border-[#DDE3F0] text-xs"
                  >
                    Next Month →
                  </button>
                </div>
              </div>

              {/* Compliance Stats */}
              {(() => {
                const logs = dotLogs.filter(l => {
                  const d = new Date(l.logDate);
                  return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
                });
                const obs = logs.filter(l => l.status === 'OBSERVED').length;
                const self = logs.filter(l => l.status === 'SELF_ADMINISTERED').length;
                const missed = logs.filter(l => l.status === 'MISSED').length;
                const total = logs.length;
                const rate = total > 0 ? Math.round(((obs + self) / total) * 100) : 0;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-[#F0F4FC] rounded-xl">
                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <p className="text-sm font-black text-emerald-600">{obs}</p>
                      <p className="text-[10px] font-bold text-[#8A97B0]">Observed (🟢)</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <p className="text-sm font-black text-blue-600">{self}</p>
                      <p className="text-[10px] font-bold text-[#8A97B0]">Self-Administered (🔵)</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <p className="text-sm font-black text-red-600">{missed}</p>
                      <p className="text-[10px] font-bold text-[#8A97B0]">Missed (🔴)</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg shadow-sm">
                      <p className="text-sm font-black text-violet-600">{rate}%</p>
                      <p className="text-[10px] font-bold text-[#8A97B0]">Compliance Rate</p>
                    </div>
                  </div>
                );
              })()}

              {/* Render Calendar Grid */}
              {(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();

                const daysArray = [];
                // Padding empty slots
                for (let i = 0; i < firstDayIndex; i++) {
                  daysArray.push(null);
                }
                for (let d = 1; d <= totalDays; d++) {
                  daysArray.push(new Date(year, month, d));
                }

                return (
                  <div className="grid grid-cols-7 gap-1.5 border-t border-[#F0F4FC] pt-4 text-center">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => (
                      <div key={w} className="text-[10px] font-bold text-[#8A97B0] pb-2 uppercase">{w}</div>
                    ))}

                    {daysArray.map((dateObj, idx) => {
                      if (!dateObj) return <div key={`empty-${idx}`} className="h-10 bg-slate-50 rounded-lg opacity-40" />;

                      // Check if log exists for this date
                      const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                      const log = dotLogs.find(l => l.logDate === dateStr);

                      let cellCls = 'bg-white border-[#DDE3F0] text-[#0F1A3A] hover:bg-[#F0F4FC]';
                      if (log?.status === 'OBSERVED') {
                        cellCls = 'bg-emerald-500 border-emerald-600 text-white font-bold hover:bg-emerald-600';
                      } else if (log?.status === 'SELF_ADMINISTERED') {
                        cellCls = 'bg-blue-500 border-blue-600 text-white font-bold hover:bg-blue-600';
                      } else if (log?.status === 'MISSED') {
                        cellCls = 'bg-red-500 border-red-600 text-white font-bold hover:bg-red-600';
                      }

                      return (
                        <div
                          key={dateStr}
                          className={`h-11 border rounded-lg flex flex-col justify-between p-1.5 text-xs font-semibold transition-all cursor-pointer relative group ${cellCls}`}
                        >
                          <div className="text-[10px] self-start">{dateObj.getDate()}</div>
                          
                          {/* Daily log record trigger tooltips */}
                          {canStaff && (
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black bg-opacity-70 rounded-lg gap-1 transition-opacity z-10">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRecordDot(selectedCase.id, dateStr, 'OBSERVED'); }}
                                className="w-4 h-4 bg-emerald-500 rounded flex items-center justify-center text-[9px] text-white font-bold"
                                title="Observed"
                              >O</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRecordDot(selectedCase.id, dateStr, 'SELF_ADMINISTERED'); }}
                                className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-[9px] text-white font-bold"
                                title="Self-Administered"
                              >S</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRecordDot(selectedCase.id, dateStr, 'MISSED'); }}
                                className="w-4 h-4 bg-red-500 rounded flex items-center justify-center text-[9px] text-white font-bold"
                                title="Missed"
                              >M</button>
                            </div>
                          )}

                          {log && (
                            <div className="text-[8px] tracking-wider opacity-75 uppercase truncate self-end font-bold">
                              {log.status === 'OBSERVED' ? 'OBS' : log.status === 'SELF_ADMINISTERED' ? 'SELF' : 'MISSED'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── CONTACTS TAB ──────────────────────────────────────────────────── */}
        {tab === 'contacts' && (
          <div>
            {!selectedCase ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-[#F0F4FC] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Link2 size={28} className="text-[#C8D5F0]" />
                </div>
                <p className="text-sm font-bold text-[#5A6A8A]">No case selected</p>
                <p className="text-xs text-[#A0AECB] mt-1">Select an index case from the Case Registry tab first.</p>
                <button onClick={() => setTab('cases')} className="btn-outline mt-4 text-xs px-4 py-2 mx-auto">
                  ← Go to Case Registry
                </button>
              </div>
            ) : (
              <div>
                {/* Case banner */}
                <div className="card-flat p-4 mb-4 flex items-center gap-3 border-l-4 border-red-400">
                  <Microscope size={18} className="text-red-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-black text-[#0F1A3A]">{selectedCase.patientName}</p>
                    <p className="text-xs text-[#8A97B0]">{selectedCase.caseNumber} · {CLASSIFICATION_META[selectedCase.classification]?.label}</p>
                  </div>
                  {canStaff && (
                    <div className="flex gap-2">
                      <label className="btn-outline text-xs px-3 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 border border-[#DDE3F0] hover:bg-slate-100">
                        <FileText size={13} className="text-red-500" />
                        <span>Bulk Import CSV</span>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !selectedCase) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              dispatch(addToast({ type: 'info', message: 'Processing bulk contact import...' }));
                              const res = await api.post(`/api/tb/cases/${selectedCase.id}/contacts/bulk-import`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                              });
                              const data = res.data;
                              dispatch(addToast({
                                type: 'success',
                                message: `Import Complete: ${data.successCount} contacts created, ${data.failureCount} failed.`
                              }));
                              fetchContacts(selectedCase.id);
                            } catch (err) {
                              console.error('Bulk contact import failed:', err);
                              dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Failed to bulk import contacts.' }));
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <button id="add-contact-btn" onClick={() => setAddContactOpen(true)}
                        className="btn-primary text-xs px-3 py-2 rounded-xl">
                        <Plus size={13} /> Add Contact
                      </button>
                    </div>
                  )}
                </div>

                {contactsLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-violet-500" /></div>
                ) : contacts.length === 0 ? (
                  <div className="card p-10 text-center">
                    <Users size={28} className="text-[#C8D5F0] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#5A6A8A]">No contacts linked yet</p>
                    <p className="text-xs text-[#A0AECB] mt-1">Add exposed contacts to begin the investigation.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {contacts.map(contact => {
                      const rm = RISK_META[contact.riskLevel] || RISK_META.LOW;
                      const im = INVESTIGATION_META[contact.investigationStatus] || {};
                      return (
                        <div key={contact.id} className="card p-4 hover:shadow-md transition-all duration-200">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F0F4FC] flex items-center justify-center font-black text-[#5A6A8A] text-base shrink-0">
                              {contact.contactName?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-[#0F1A3A] truncate">{contact.contactName}</p>
                              <p className="text-[11px] text-[#8A97B0]">{contact.contactPhone || '—'} · {contact.exposureType?.replace(/_/g, ' ')}</p>
                            </div>
                            <span className={`text-xs`}>{rm.icon}</span>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${rm.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${rm.dot}`} />
                              {contact.riskLevel} RISK
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold ${im.cls}`}>
                              {im.label || contact.investigationStatus?.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#8A97B0] mb-3 space-y-0.5">
                            <p>Exposure: {fmtDate(contact.exposureStartDate)} — {fmtDate(contact.exposureEndDate)}</p>
                            {contact.avgExposureHoursPerDay && <p>~{contact.avgExposureHoursPerDay} hrs/day exposure</p>}
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => handleSelectContact(contact)}
                              className="btn-ghost text-xs px-3 py-1.5 border border-[#DDE3F0] flex-1">
                              <Microscope size={11} /> TST Tests
                            </button>
                            {canStaff && (
                              <select value={contact.investigationStatus}
                                onChange={e => handleUpdateContactStatus(contact.id, e.target.value)}
                                disabled={actionLoading}
                                className="select-input text-[11px] py-1 flex-1">
                                {Object.keys(INVESTIGATION_META).map(s => (
                                  <option key={s} value={s}>{INVESTIGATION_META[s].label}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TST TESTS TAB ─────────────────────────────────────────────────── */}
        {tab === 'tst' && (
          <div>
            {!selectedContact ? (
              <div className="card p-12 text-center">
                <Microscope size={28} className="text-[#C8D5F0] mx-auto mb-3" />
                <p className="text-sm font-bold text-[#5A6A8A]">No contact selected</p>
                <p className="text-xs text-[#A0AECB] mt-1">Select a contact from the Contacts tab first.</p>
                <button onClick={() => setTab('contacts')} className="btn-outline mt-4 text-xs px-4 py-2 mx-auto">
                  ← Back to Contacts
                </button>
              </div>
            ) : (
              <div>
                {/* Contact banner */}
                <div className="card-flat p-4 mb-4 flex items-center gap-3 border-l-4 border-violet-400">
                  <Users size={18} className="text-violet-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-black text-[#0F1A3A]">{selectedContact.contactName}</p>
                    <p className="text-xs text-[#8A97B0]">
                      {RISK_META[selectedContact.riskLevel]?.icon} {selectedContact.riskLevel} RISK ·
                      {selectedContact.exposureType?.replace(/_/g, ' ')} exposure
                    </p>
                  </div>
                  {canStaff && (
                    <button id="add-tst-btn" onClick={() => setAddTstOpen(true)}
                      className="btn-primary text-xs px-3 py-2 rounded-xl">
                      <Plus size={13} /> Record TST
                    </button>
                  )}
                </div>

                {tstLoading ? (
                  <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-violet-500" /></div>
                ) : tstTests.length === 0 ? (
                  <div className="card p-10 text-center">
                    <Microscope size={28} className="text-[#C8D5F0] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#5A6A8A]">No TST records yet</p>
                    <p className="text-xs text-[#A0AECB] mt-1">Record the first TST plant to begin testing.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tstTests.map((test, i) => {
                      const rm = TST_RESULT_META[test.result] || {};
                      return (
                        <div key={test.id} className="card p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs font-black flex items-center justify-center">#{i+1}</span>
                              <span className="text-sm font-bold text-[#0F1A3A]">{test.testType === 'IGRA' ? 'IGRA Blood Test' : 'Tuberculin Skin Test (TST)'}</span>
                            </div>
                            <span className={`text-xs ${rm.cls}`}>{rm.label || test.result}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {/* Plant Details */}
                            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                              <p className="text-[10px] text-blue-400 font-bold uppercase mb-2">💉 Plant Details</p>
                              <p className="text-[#0F1A3A] font-semibold">{fmtDate(test.plantDate)}</p>
                              <p className="text-[#5A6A8A]">By: {test.plantedBy || '—'}</p>
                              <p className="text-[#5A6A8A]">Arm: {test.plantArm || '—'} · Batch: {test.plantBatchNumber || '—'}</p>
                            </div>

                            {/* Read Details */}
                            <div className={`rounded-xl p-3 border ${test.readDate ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                              <p className="text-[10px] text-emerald-600 font-bold uppercase mb-2">📏 Read Details</p>
                              {test.readDate ? (
                                <>
                                  <p className="text-[#0F1A3A] font-semibold">{fmtDate(test.readDate)}</p>
                                  <p className="text-[#5A6A8A]">By: {test.readBy || '—'}</p>
                                  <p className="text-[#5A6A8A] font-bold">{test.indurationMm != null ? `${test.indurationMm}mm induration` : '—'}</p>
                                </>
                              ) : (
                                <p className="text-amber-600 font-bold text-[11px]">⏳ Awaiting read (48–72 hrs)</p>
                              )}
                            </div>
                          </div>

                          {/* Chest X-Ray */}
                          {test.chestXrayDate && (
                            <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">🩻 Chest X-Ray</p>
                              <p className="text-xs text-[#0F1A3A]">{fmtDate(test.chestXrayDate)} · {test.chestXrayResult}</p>
                              {test.chestXrayFindings && <p className="text-[11px] text-[#5A6A8A] mt-0.5">{test.chestXrayFindings}</p>}
                            </div>
                          )}

                          {test.clinicianInterpretation && (
                            <div className="mt-3 text-[11px] text-[#5A6A8A] bg-[#F8FAFF] rounded-lg p-2.5 border border-[#F0F4FC]">
                              <span className="font-bold text-[#3A4A6A]">Clinician Note: </span>{test.clinicianInterpretation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* New TB Case Modal */}
      <Modal open={addCaseOpen} onClose={() => setAddCaseOpen(false)}
        title="Register New TB Case" subtitle="Create an index case and begin contact tracing." size="lg">
        <div className="space-y-4">
          <div className="relative">
            <Field label="Search & Select Patient" hint="Type Patient ID, Name, Phone or Email to lookup patient records. Select to auto-fill details below.">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-[#8A97B0]" />
                <input
                  id="tb-patient-search"
                  className="input text-sm pl-9"
                  placeholder="e.g. PAT-001 or John Smith..."
                  value={patientSearchQuery}
                  onChange={e => handlePatientSearch(e.target.value)}
                />
                {searchingPatients && <Loader2 size={12} className="animate-spin text-[#5A6A8A] absolute right-3" />}
              </div>
            </Field>

            {/* Dropdown list of lookup results */}
            {showPatientDropdown && patientSearchResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-xl max-h-56 overflow-y-auto">
                {patientSearchResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPatientFromSearch(p)}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#0F1A3A] hover:bg-[#F0F4FC] border-b border-[#F0F4FC] last:border-b-0 flex justify-between items-center"
                  >
                    <span>{p.patientName || p.displayName} <span className="text-[#8A97B0] font-mono ml-2">({p.patientId})</span></span>
                    <span className="text-[10px] bg-[#E3F2FD] text-[#0D47A1] px-2 py-0.5 rounded-full">Select</span>
                  </button>
                ))}
              </div>
            )}
            {showPatientDropdown && patientSearchResults.length === 0 && !searchingPatients && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-xl p-3 text-center text-xs text-[#8A97B0]">
                No patients found. Fill details manually below.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Patient ID (Manually or Prefilled)" required>
              <input id="tb-patient-id" className="input text-sm font-mono" placeholder="PAT-XXXXXXX"
                value={caseForm.patientId} onChange={e => setCaseForm(f => ({ ...f, patientId: e.target.value }))} />
            </Field>
            <Field label="Patient Name" required>
              <input id="tb-patient-name" className="input text-sm" placeholder="Full Name"
                value={caseForm.patientName} onChange={e => setCaseForm(f => ({ ...f, patientName: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth">
              <input id="tb-patient-dob" type="date" className="input text-sm"
                value={caseForm.patientDob} onChange={e => setCaseForm(f => ({ ...f, patientDob: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input id="tb-patient-phone" className="input text-sm" placeholder="Phone number"
                value={caseForm.patientPhone} onChange={e => setCaseForm(f => ({ ...f, patientPhone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Address">
            <input id="tb-patient-address" className="input text-sm" placeholder="Full address"
              value={caseForm.patientAddress} onChange={e => setCaseForm(f => ({ ...f, patientAddress: e.target.value }))} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="TB Classification" required>
              <select id="tb-classification" className="select-input text-sm"
                value={caseForm.classification}
                onChange={e => {
                  const val = e.target.value;
                  setCaseForm(f => ({
                    ...f,
                    classification: val,
                    tbSite: val === 'PULMONARY' ? 'Lung' : val === 'LATENT_TB_INFECTION' ? '' : f.tbSite
                  }));
                }}>
                {Object.entries(CLASSIFICATION_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="TB Site (Anatomical)" hint="e.g. Lung, Lymph Node, Spine">
              <input
                id="tb-site"
                className="input text-sm"
                placeholder={caseForm.classification === 'LATENT_TB_INFECTION' ? 'N/A for Latent TB' : 'e.g. Lung'}
                disabled={caseForm.classification === 'LATENT_TB_INFECTION'}
                value={caseForm.tbSite}
                onChange={e => setCaseForm(f => ({ ...f, tbSite: e.target.value }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Symptom Start Date">
              <input type="date" className="input text-sm"
                value={caseForm.symptomStartDate} onChange={e => setCaseForm(f => ({ ...f, symptomStartDate: e.target.value }))} />
            </Field>
            <Field label="Diagnosis Date">
              <input type="date" className="input text-sm"
                value={caseForm.diagnosisDate} onChange={e => setCaseForm(f => ({ ...f, diagnosisDate: e.target.value }))} />
            </Field>
            <Field label="Notification Date" hint="Date PHO notified">
              <input type="date" className="input text-sm"
                value={caseForm.notificationDate} onChange={e => setCaseForm(f => ({ ...f, notificationDate: e.target.value }))} />
            </Field>
          </div>

          <Field label="Risk Factors">
            <div className="flex flex-wrap gap-2">
              {RISK_FACTORS.map(rf => (
                <button key={rf} type="button"
                  onClick={() => setCaseForm(f => ({
                    ...f, riskFactors: f.riskFactors.includes(rf)
                      ? f.riskFactors.filter(x => x !== rf)
                      : [...f.riskFactors, rf]
                  }))}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    caseForm.riskFactors.includes(rf)
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-white text-[#5A6A8A] border-[#DDE3F0] hover:border-[#A0AECB]'
                  }`}>{rf}</button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Assigned Nurse">
              <input className="input text-sm" placeholder="Nurse name"
                value={caseForm.assignedNurseName} onChange={e => setCaseForm(f => ({ ...f, assignedNurseName: e.target.value }))} />
            </Field>
            <Field label="Facility">
              <input className="input text-sm" placeholder="Facility ID or name"
                value={caseForm.facilityId} onChange={e => setCaseForm(f => ({ ...f, facilityId: e.target.value }))} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea className="input text-sm" rows={3} placeholder="Clinical notes, additional context..."
              value={caseForm.notes} onChange={e => setCaseForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddCaseOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button id="submit-tb-case-btn" onClick={handleAddCase} disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : <><Plus size={14} /> Create Case</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Contact Modal */}
      <Modal open={addContactOpen} onClose={() => setAddContactOpen(false)}
        title="Link Contact to Case" subtitle={`Linking contact to ${selectedCase?.caseNumber || ''}`} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Full Name" required>
              <input id="contact-name" className="input text-sm" placeholder="Full name"
                value={contactForm.contactName} onChange={e => setContactForm(f => ({ ...f, contactName: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="input text-sm" placeholder="Phone number"
                value={contactForm.contactPhone} onChange={e => setContactForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" className="input text-sm" placeholder="Email address"
                value={contactForm.contactEmail} onChange={e => setContactForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </Field>
            <Field label="Date of Birth">
              <input type="date" className="input text-sm"
                value={contactForm.dateOfBirth} onChange={e => setContactForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
            </Field>
          </div>
          <Field label="Address">
            <input className="input text-sm" placeholder="Full address"
              value={contactForm.contactAddress} onChange={e => setContactForm(f => ({ ...f, contactAddress: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Risk Level" required>
              <select id="contact-risk-level" className="select-input text-sm"
                value={contactForm.riskLevel} onChange={e => setContactForm(f => ({ ...f, riskLevel: e.target.value }))}>
                {Object.entries(RISK_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {k}</option>)}
              </select>
            </Field>
            <Field label="Exposure Type" required>
              <select id="contact-exposure-type" className="select-input text-sm"
                value={contactForm.exposureType} onChange={e => setContactForm(f => ({ ...f, exposureType: e.target.value }))}>
                {['HOUSEHOLD','WORKPLACE','CONGREGATE_SETTING','SOCIAL','HEALTHCARE_SETTING','SCHOOL','OTHER'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Exposure Start">
              <input type="date" className="input text-sm"
                value={contactForm.exposureStartDate} onChange={e => setContactForm(f => ({ ...f, exposureStartDate: e.target.value }))} />
            </Field>
            <Field label="Exposure End">
              <input type="date" className="input text-sm"
                value={contactForm.exposureEndDate} onChange={e => setContactForm(f => ({ ...f, exposureEndDate: e.target.value }))} />
            </Field>
            <Field label="Avg Hours/Day">
              <input type="number" className="input text-sm" placeholder="Hours"
                value={contactForm.avgExposureHoursPerDay} onChange={e => setContactForm(f => ({ ...f, avgExposureHoursPerDay: e.target.value }))} />
            </Field>
          </div>
          <Field label="Assigned Nurse">
            <input className="input text-sm" placeholder="Nurse name"
              value={contactForm.assignedNurseName} onChange={e => setContactForm(f => ({ ...f, assignedNurseName: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <textarea className="input text-sm" rows={2} placeholder="Additional notes..."
              value={contactForm.notes} onChange={e => setContactForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddContactOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button id="submit-contact-btn" onClick={handleAddContact} disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Linking...</> : <><Link2 size={14} /> Link Contact</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add TST Test Modal */}
      <Modal open={addTstOpen} onClose={() => setAddTstOpen(false)}
        title="Record TST / IGRA Test" subtitle={`For: ${selectedContact?.contactName || ''}`} size="lg">
        <div className="space-y-4">
          <Field label="Test Type">
            <div className="flex gap-3">
              {['TST','IGRA'].map(t => (
                <button key={t} type="button" onClick={() => setTstForm(f => ({ ...f, testType: t }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    tstForm.testType === t ? 'bg-violet-50 text-violet-700 border-violet-400' : 'border-[#DDE3F0] text-[#5A6A8A] hover:border-[#A0AECB]'
                  }`}>{t === 'TST' ? '💉 TST (Skin Test)' : '🩸 IGRA (Blood Test)'}</button>
              ))}
            </div>
          </Field>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-xs font-bold text-blue-600 mb-3">💉 Plant Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Plant Date">
                <input type="date" className="input text-sm"
                  value={tstForm.plantDate} onChange={e => setTstForm(f => ({ ...f, plantDate: e.target.value }))} />
              </Field>
              <Field label="Planted By">
                <input className="input text-sm" placeholder="Nurse name"
                  value={tstForm.plantedBy} onChange={e => setTstForm(f => ({ ...f, plantedBy: e.target.value }))} />
              </Field>
              <Field label="Arm">
                <select className="select-input text-sm" value={tstForm.plantArm}
                  onChange={e => setTstForm(f => ({ ...f, plantArm: e.target.value }))}>
                  <option value="LEFT">Left Forearm</option>
                  <option value="RIGHT">Right Forearm</option>
                </select>
              </Field>
              <Field label="Batch Number">
                <input className="input text-sm" placeholder="PPD-2026-LOTXX"
                  value={tstForm.plantBatchNumber} onChange={e => setTstForm(f => ({ ...f, plantBatchNumber: e.target.value }))} />
              </Field>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-600 mb-3">📏 Read Details (48–72 hrs after plant)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Read Date">
                <input type="date" className="input text-sm"
                  value={tstForm.readDate} onChange={e => setTstForm(f => ({ ...f, readDate: e.target.value }))} />
              </Field>
              <Field label="Read By">
                <input className="input text-sm" placeholder="Nurse name"
                  value={tstForm.readBy} onChange={e => setTstForm(f => ({ ...f, readBy: e.target.value }))} />
              </Field>
              <Field label="Induration (mm)" hint="Measure raised bump, not redness">
                <input type="number" className="input text-sm" placeholder="e.g. 12"
                  value={tstForm.indurationMm} onChange={e => setTstForm(f => ({ ...f, indurationMm: e.target.value }))} />
              </Field>
              <Field label="Result">
                <select className="select-input text-sm" value={tstForm.result}
                  onChange={e => setTstForm(f => ({ ...f, result: e.target.value }))}>
                  {Object.entries(TST_RESULT_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
            </div>
          </div>

          <Field label="Clinician Interpretation">
            <textarea className="input text-sm" rows={2} placeholder="Clinical notes on result significance..."
              value={tstForm.clinicianInterpretation} onChange={e => setTstForm(f => ({ ...f, clinicianInterpretation: e.target.value }))} />
          </Field>

          {(tstForm.result === 'POSITIVE') && (
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <p className="text-xs font-bold text-rose-600 mb-3">🩻 Follow-up Chest X-Ray</p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="X-Ray Date">
                  <input type="date" className="input text-sm"
                    value={tstForm.chestXrayDate} onChange={e => setTstForm(f => ({ ...f, chestXrayDate: e.target.value }))} />
                </Field>
                <Field label="X-Ray Result">
                  <select className="select-input text-sm" value={tstForm.chestXrayResult}
                    onChange={e => setTstForm(f => ({ ...f, chestXrayResult: e.target.value }))}>
                    <option value="">Select...</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ABNORMAL">Abnormal</option>
                    <option value="SUSPECTED_ACTIVE_TB">Suspected Active TB</option>
                  </select>
                </Field>
                <Field label="Findings">
                  <input className="input text-sm" placeholder="Brief findings"
                    value={tstForm.chestXrayFindings} onChange={e => setTstForm(f => ({ ...f, chestXrayFindings: e.target.value }))} />
                </Field>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setAddTstOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button id="submit-tst-btn" onClick={handleAddTst} disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Microscope size={14} /> Save TST Record</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Log Sputum Sample Modal */}
      <Modal open={sputumOpen} onClose={() => setSputumOpen(false)}
        title="Record Sputum Sample Lab Result" subtitle={`Case: ${selectedCase?.caseNumber || ''}`}>
        <div className="space-y-4">
          <Field label="Sample Index" required>
            <select className="select-input text-sm" value={sputumForm.sampleIndex}
              onChange={e => setSputumForm(f => ({ ...f, sampleIndex: e.target.value }))}>
              <option value="1">Sample #1 (Initial)</option>
              <option value="2">Sample #2 (Follow-up)</option>
              <option value="3">Sample #3 (Final Clearance)</option>
            </select>
          </Field>
          <Field label="Lab Result" required>
            <select className="select-input text-sm" value={sputumForm.result}
              onChange={e => setSputumForm(f => ({ ...f, result: e.target.value }))}>
              <option value="PENDING">⏳ Lab Analysis Pending</option>
              <option value="NEGATIVE">🟢 NEGATIVE (No TB Detected)</option>
              <option value="POSITIVE">🔴 POSITIVE (Active Acid-Fast Bacilli)</option>
            </select>
          </Field>
          <Field label="Collection Date" required>
            <input type="date" className="input text-sm"
              value={sputumForm.dateCollected} onChange={e => setSputumForm(f => ({ ...f, dateCollected: e.target.value }))} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setSputumOpen(false)} className="btn-ghost flex-1">Cancel</button>
            <button id="submit-sputum-btn" onClick={handleUpdateSputum} disabled={submitting} className="btn-primary flex-1">
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Microscope size={14} /> Update Result</>}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
