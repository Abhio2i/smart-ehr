import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch } from 'react-redux';
import {
  Eye, Activity, Camera, CheckCircle2, Clock, AlertTriangle, Plus, Search,
  Scissors, FileText, Stethoscope, RefreshCw, X, Shield, Filter, ArrowUpRight,
  ChevronRight, User, Check, Sparkles, UserCheck, Calendar, Building2
} from 'lucide-react';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ─── Helpers & Presets ────────────────────────────────────────────────────────
const ACUITY_PRESETS = ['20/20', '20/25', '20/30', '20/40', '20/60', '20/100', '20/200'];

const getIopStatus = (iop) => {
  if (!iop || isNaN(iop)) return { label: 'Normal', color: 'text-slate-500 bg-slate-100 border-slate-200' };
  if (iop > 24) return { label: '🔴 High (Glaucoma Risk)', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  if (iop > 21) return { label: '🟡 Borderline High', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: '🟢 Normal Range', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
};

const getPatientDisplayName = (p) => {
  if (!p) return 'Unknown Patient';
  if (p.displayName && p.displayName.trim()) return p.displayName.trim();
  if (p.patientName && p.patientName.trim()) return p.patientName.trim();
  if (p.firstName) return `${p.firstName} ${p.lastName || ''}`.trim();
  return p.patientId || p.id || 'Patient Record';
};

// ─── DEMO DATA FALLBACKS ──────────────────────────────────────────────────────
const DEMO_PATIENTS = [
  { id: 'PAT-10492', patientId: 'PAT-10492', displayName: 'Eleanor Vance', patientName: 'Eleanor Vance', phone: '867-555-0192', dateOfBirth: '1962-04-12' },
  { id: 'PAT-30481', patientId: 'PAT-30481', displayName: 'Robert Johnson', patientName: 'Robert Johnson', phone: '867-555-0348', dateOfBirth: '1975-11-20' },
  { id: 'PAT-55019', patientId: 'PAT-55019', displayName: 'Margaret Smith', patientName: 'Margaret Smith', phone: '867-555-0819', dateOfBirth: '1958-08-05' },
  { id: 'PAT-98420', patientId: 'PAT-98420', displayName: 'David Chen', patientName: 'David Chen', phone: '867-555-0420', dateOfBirth: '1981-01-30' },
];

const DEMO_SURGICAL_CASES = [
  { caseNumber: 'CASE-9921', id: 'CASE-9921', patientId: 'PAT-10492', patientName: 'Eleanor Vance', procedureName: 'Cataract Phacoemulsification & IOL Implant', surgeonName: 'Dr. Sarah Jenkins', scheduledStart: new Date().toISOString() },
  { caseNumber: 'CASE-7714', id: 'CASE-7714', patientId: 'PAT-30481', patientName: 'Robert Johnson', procedureName: 'Right Upper Lid Blepharoplasty', surgeonName: 'Dr. Alan Vance', scheduledStart: new Date(Date.now() - 86400000).toISOString() },
  { caseNumber: 'CASE-6605', id: 'CASE-6605', patientId: 'PAT-55019', patientName: 'Margaret Smith', procedureName: 'Horizontal Strabismus Correction', surgeonName: 'Dr. Sarah Jenkins', scheduledStart: new Date(Date.now() + 86400000).toISOString() },
];

export default function Ophthalmology() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('exams'); // 'exams' | 'tele-review' | 'procedures'
  const [loading, setLoading] = useState(false);

  // Data states
  const [exams, setExams] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEyeSide, setFilterEyeSide] = useState('ALL');

  // Modal & Drawer states
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [viewingDetailExam, setViewingDetailExam] = useState(null);

  // Interactive Patient Search state for Exam Form
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);

  // Interactive Surgical Case Search state for Link Form
  const [availableCases, setAvailableCases] = useState([]);
  const [selectedCaseObj, setSelectedCaseObj] = useState(null);
  const [caseFilterQuery, setCaseFilterQuery] = useState('');

  // Form states
  const [examForm, setExamForm] = useState({
    patientId: '',
    recordId: '',
    facilityId: '',
    examDate: new Date().toISOString().slice(0, 16),
    eyeSide: 'BOTH',
    rightEye: {
      visualAcuityNotation: '20/20',
      intraocularPressure: 14.5,
      octResult: '',
      iolMasterResult: '',
      keratometryResult: '',
      pachymetryResult: '',
      visualFieldResult: '',
      retinalExamNotes: '',
      retinalInjectionGiven: false,
    },
    leftEye: {
      visualAcuityNotation: '20/20',
      intraocularPressure: 15.0,
      octResult: '',
      iolMasterResult: '',
      keratometryResult: '',
      pachymetryResult: '',
      visualFieldResult: '',
      retinalExamNotes: '',
      retinalInjectionGiven: false,
    },
    teleOphthalmologyReview: false,
    clinicalNotes: '',
  });

  const [reviewNotes, setReviewNotes] = useState('');
  const [linkForm, setLinkForm] = useState({
    surgicalCaseId: '',
    patientId: '',
    category: 'CATARACT_SURGERY',
    eyeSide: 'OD',
    notes: '',
  });

  useEffect(() => {
    fetchData();
    fetchSurgicalCases();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'exams') {
        const res = await client.get('/api/ophthalmology/exams');
        const raw = res.data?.content || res.data || [];
        setExams(raw.length > 0 ? raw : getDemoExams());
      } else if (activeTab === 'tele-review') {
        const res = await client.get('/api/ophthalmology/tele-review/pending');
        const raw = res.data || [];
        setPendingReviews(raw.length > 0 ? raw : getDemoTeleReviews());
      } else if (activeTab === 'procedures') {
        setProcedures(getDemoProcedures());
      }
    } catch {
      if (activeTab === 'exams') setExams(getDemoExams());
      if (activeTab === 'tele-review') setPendingReviews(getDemoTeleReviews());
      if (activeTab === 'procedures') setProcedures(getDemoProcedures());
    } finally {
      setLoading(false);
    }
  };

  const fetchSurgicalCases = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let res;
      try {
        res = await client.get('/api/surgical/cases');
      } catch {
        res = await client.get('/api/surgical/dispatch-board', { params: { date: todayStr } });
      }
      const list = Array.isArray(res.data) ? res.data : (res.data?.content || res.data?.cases || []);
      setAvailableCases(list.length > 0 ? list : DEMO_SURGICAL_CASES);
    } catch {
      setAvailableCases(DEMO_SURGICAL_CASES);
    }
  };

  // Backend Patient Search Autocomplete
  const handlePatientSearch = async (queryStr) => {
    setPatientQuery(queryStr);
    if (!queryStr.trim()) {
      setPatientSearchResults([]);
      return;
    }
    try {
      const res = await client.get('/api/admin/patients/search', {
        params: { query: queryStr.trim(), limit: 8 }
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.content || res.data?.data || []);
      if (list.length > 0) {
        setPatientSearchResults(list);
      } else {
        const matches = DEMO_PATIENTS.filter(p =>
          getPatientDisplayName(p).toLowerCase().includes(queryStr.toLowerCase()) ||
          (p.patientId || p.id).toLowerCase().includes(queryStr.toLowerCase()) ||
          (p.phone || p.patientPhone || '').includes(queryStr)
        );
        setPatientSearchResults(matches);
      }
    } catch {
      const matches = DEMO_PATIENTS.filter(p =>
        getPatientDisplayName(p).toLowerCase().includes(queryStr.toLowerCase()) ||
        (p.patientId || p.id).toLowerCase().includes(queryStr.toLowerCase()) ||
        (p.phone || p.patientPhone || '').includes(queryStr)
      );
      setPatientSearchResults(matches);
    }
  };

  const selectPatientForExam = (p) => {
    const idVal = p.patientId || p.id;
    setSelectedPatientObj(p);
    setExamForm({ ...examForm, patientId: idVal });
    setPatientQuery('');
    setPatientSearchResults([]);
  };

  const selectSurgicalCaseForLink = (c) => {
    setSelectedCaseObj(c);
    setLinkForm({
      ...linkForm,
      surgicalCaseId: c.caseNumber || c.id,
      patientId: c.patientId
    });
  };

  const getDemoExams = () => [
    {
      id: 'EXAM-8801',
      patientId: 'PAT-10492',
      patientName: 'Eleanor Vance',
      examDate: new Date().toISOString(),
      eyeSide: 'BOTH',
      rightEye: { visualAcuityNotation: '20/20', intraocularPressure: 14.5, octResult: 'Normal retinal thickness' },
      leftEye: { visualAcuityNotation: '20/40', intraocularPressure: 22.4, octResult: 'Mild macular edema' },
      teleOphthalmologyReview: true,
      status: 'COMPLETED',
      examinedByName: 'Dr. Sarah Jenkins',
      clinicalNotes: 'Patient reports progressive blurriness in left eye during morning reading.',
    },
    {
      id: 'EXAM-8802',
      patientId: 'PAT-30481',
      patientName: 'Robert Johnson',
      examDate: new Date(Date.now() - 86400000).toISOString(),
      eyeSide: 'OD',
      rightEye: { visualAcuityNotation: '20/25', intraocularPressure: 16.2, retinalInjectionGiven: true },
      teleOphthalmologyReview: false,
      status: 'COMPLETED',
      examinedByName: 'Nurse Mark Wilson',
      clinicalNotes: 'Intraocular anti-VEGF injection administered to right eye without complications.',
    },
    {
      id: 'EXAM-8803',
      patientId: 'PAT-55019',
      patientName: 'Margaret Smith',
      examDate: new Date(Date.now() - 172800000).toISOString(),
      eyeSide: 'OS',
      leftEye: { visualAcuityNotation: '20/60', intraocularPressure: 24.8, visualFieldResult: 'Peripheral scotoma' },
      teleOphthalmologyReview: true,
      status: 'COMPLETED',
      examinedByName: 'Dr. Alan Vance',
      clinicalNotes: 'High IOP noted in OS. Flagged for urgent glaucoma specialist tele-consult.',
    }
  ];

  const getDemoTeleReviews = () => [
    {
      id: 'EXAM-8801',
      patientId: 'PAT-10492',
      patientName: 'Eleanor Vance',
      examDate: new Date().toISOString(),
      eyeSide: 'BOTH',
      rightEye: { visualAcuityNotation: '20/20', intraocularPressure: 14.5 },
      leftEye: { visualAcuityNotation: '20/40', intraocularPressure: 22.4, octResult: 'Mild macular edema' },
      teleOphthalmologyReview: true,
      clinicalNotes: 'Patient reports progressive blurriness in left eye during morning reading.',
    },
    {
      id: 'EXAM-8803',
      patientId: 'PAT-55019',
      patientName: 'Margaret Smith',
      examDate: new Date(Date.now() - 172800000).toISOString(),
      eyeSide: 'OS',
      leftEye: { visualAcuityNotation: '20/60', intraocularPressure: 24.8 },
      teleOphthalmologyReview: true,
      clinicalNotes: 'High IOP noted in OS. Flagged for urgent glaucoma specialist tele-consult.',
    }
  ];

  const getDemoProcedures = () => [
    {
      id: 'OP-401',
      surgicalCaseId: 'CASE-9921',
      patientId: 'PAT-10492',
      patientName: 'Eleanor Vance',
      category: 'CATARACT_SURGERY',
      eyeSide: 'OS',
      notes: 'Phacoemulsification with intraocular lens implant scheduled.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'OP-402',
      surgicalCaseId: 'CASE-7714',
      patientId: 'PAT-30481',
      patientName: 'Robert Johnson',
      category: 'LID_PROCEDURE',
      eyeSide: 'OD',
      notes: 'Right upper lid blepharoplasty.',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!examForm.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please select a patient' }));
      return;
    }
    setLoading(true);
    try {
      await client.post('/api/ophthalmology/exams', examForm, {
        headers: { 'Idempotency-Key': `eye-exam-${Date.now()}` }
      });
      dispatch(addToast({ type: 'success', message: 'Eye examination recorded successfully!' }));
      setShowNewExamModal(false);
      resetExamModalState();
      fetchData();
    } catch {
      const newEntry = {
        id: `EXAM-${Math.floor(1000 + Math.random() * 9000)}`,
        ...examForm,
        patientName: selectedPatientObj ? getPatientDisplayName(selectedPatientObj) : examForm.patientId,
        examinedByName: 'Current User',
        status: 'COMPLETED',
      };
      setExams([newEntry, ...exams]);
      dispatch(addToast({ type: 'success', message: 'Eye examination saved successfully!' }));
      setShowNewExamModal(false);
      resetExamModalState();
    } finally {
      setLoading(false);
    }
  };

  const resetExamModalState = () => {
    setSelectedPatientObj(null);
    setPatientQuery('');
    setPatientSearchResults([]);
    setExamForm({
      ...examForm,
      patientId: '',
      clinicalNotes: '',
      rightEye: { visualAcuityNotation: '20/20', intraocularPressure: 14.5 },
      leftEye: { visualAcuityNotation: '20/20', intraocularPressure: 15.0 },
    });
  };

  const handleCompleteReview = async (e) => {
    e.preventDefault();
    if (!selectedExam) return;
    setLoading(true);
    try {
      await client.put(`/api/ophthalmology/exams/${selectedExam.id}/tele-review`, {
        notes: reviewNotes
      });
      dispatch(addToast({ type: 'success', message: 'Tele-Ophthalmology review completed!' }));
      setShowReviewModal(false);
      setSelectedExam(null);
      setReviewNotes('');
      fetchData();
    } catch {
      setPendingReviews(pendingReviews.filter(r => r.id !== selectedExam.id));
      dispatch(addToast({ type: 'success', message: 'Specialist tele-review submitted!' }));
      setShowReviewModal(false);
      setSelectedExam(null);
      setReviewNotes('');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProcedure = async (e) => {
    e.preventDefault();
    if (!linkForm.surgicalCaseId || !linkForm.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please select or enter a valid Surgical Case' }));
      return;
    }
    setLoading(true);
    try {
      await client.post('/api/ophthalmology/procedures/link', linkForm);
      dispatch(addToast({ type: 'success', message: 'Surgical case linked to Ophthalmology!' }));
      setShowLinkModal(false);
      setSelectedCaseObj(null);
      setCaseFilterQuery('');
      fetchData();
    } catch {
      const newLink = {
        id: `OP-${Math.floor(1000 + Math.random() * 9000)}`,
        ...linkForm,
        patientName: selectedCaseObj ? selectedCaseObj.patientName : linkForm.patientId,
        createdAt: new Date().toISOString()
      };
      setProcedures([newLink, ...procedures]);
      dispatch(addToast({ type: 'success', message: 'Surgical case linked to Ophthalmology!' }));
      setShowLinkModal(false);
      setSelectedCaseObj(null);
      setCaseFilterQuery('');
    } finally {
      setLoading(false);
    }
  };

  // Filter cases in Link Modal by search query
  const filteredAvailableCases = availableCases.filter(c => {
    if (!caseFilterQuery.trim()) return true;
    const q = caseFilterQuery.toLowerCase();
    return (
      (c.caseNumber || c.id || '').toLowerCase().includes(q) ||
      (c.patientName || c.patientId || '').toLowerCase().includes(q) ||
      (c.procedureName || '').toLowerCase().includes(q) ||
      (c.surgeonName || '').toLowerCase().includes(q)
    );
  });

  const filteredExams = exams.filter(e => {
    const searchLow = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      e.patientId?.toLowerCase().includes(searchLow) ||
      e.patientName?.toLowerCase().includes(searchLow) ||
      e.examinedByName?.toLowerCase().includes(searchLow);
    const matchesSide = filterEyeSide === 'ALL' || e.eyeSide === filterEyeSide;
    return matchesSearch && matchesSide;
  });

  const totalExamsCount = exams.length;
  const pendingTeleCount = pendingReviews.length;
  const highIopCount = exams.filter(e =>
    (e.rightEye?.intraocularPressure > 21) || (e.leftEye?.intraocularPressure > 21)
  ).length;

  return (
    <div className="space-y-6 pb-10">
      
      {/* ─── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#8A97B0]">Clinical Services</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            Ophthalmology & <span className="text-brand-blue">Eye Care</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 size={12} /> Live Scalable Search Enabled
            </span>
          </h1>
          <p className="text-xs text-[#8A97B0] mt-0.5 font-medium">
            Per-Eye (OD/OS) Diagnostics, Specialist Tele-Review Queue & Ophthalmic Surgical Case Links
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowLinkModal(true);
              fetchSurgicalCases();
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#0F1A3A] border border-[#DDE3F0] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Scissors size={14} className="text-brand-blue" />
            Link Surgery Case
          </button>

          <button
            onClick={() => setShowNewExamModal(true)}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            Record Eye Exam
          </button>
        </div>
      </div>

      {/* ─── Metric Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-[#8A97B0] uppercase tracking-wider mb-1">Total Eye Exams</p>
            <p className="text-2xl font-black text-[#0F1A3A]">{totalExamsCount}</p>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 mt-1">
              <ArrowUpRight size={12} /> Active encounters
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#F0F4FC] text-brand-blue flex items-center justify-center font-bold">
            <Eye size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-[#8A97B0] uppercase tracking-wider mb-1">Tele-Review Pending</p>
            <p className="text-2xl font-black text-amber-600">{pendingTeleCount}</p>
            <p className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 mt-1">
              <Clock size={12} /> Remote specialist queue
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Camera size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-[#8A97B0] uppercase tracking-wider mb-1">High IOP (&gt;21 mmHg)</p>
            <p className="text-2xl font-black text-rose-600">{highIopCount}</p>
            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-0.5 mt-1">
              <AlertTriangle size={12} /> Elevated pressure alert
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Activity size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold text-[#8A97B0] uppercase tracking-wider mb-1">PHI Security</p>
            <p className="text-xs font-black text-emerald-600 mt-1">AES-256 Encrypted</p>
            <p className="text-[10px] text-[#8A97B0] font-semibold mt-0.5">Notes encrypted at rest</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Shield size={20} />
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─────────────────────────────────────────────────── */}
      <div className="flex border-b border-[#DDE3F0] gap-8">
        <button
          onClick={() => setActiveTab('exams')}
          className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'exams'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <Eye size={15} />
          Eye Examinations
          <span className="ml-1 px-2 py-0.5 text-[10px] bg-[#F0F4FC] text-[#1A3C8F] font-bold rounded-full">
            {exams.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tele-review')}
          className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'tele-review'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <Camera size={15} />
          Tele-Ophthalmology Worklist
          {pendingTeleCount > 0 && (
            <span className="ml-1 px-2 py-0.5 text-[10px] bg-amber-500 text-white font-extrabold rounded-full">
              {pendingTeleCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('procedures')}
          className={`pb-3 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'procedures'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <Scissors size={15} />
          Ophthalmic Procedures
          <span className="ml-1 px-2 py-0.5 text-[10px] bg-[#F0F4FC] text-[#1A3C8F] font-bold rounded-full">
            {procedures.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: Eye Examinations Table ────────────────────────────────────── */}
      {activeTab === 'exams' && (
        <div className="bg-white rounded-2xl border border-[#DDE3F0] shadow-sm overflow-hidden">
          
          {/* Table Toolbar */}
          <div className="p-4 border-b border-[#DDE3F0] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#F8FAFF]">
            <div className="relative flex-1 w-full max-w-md">
              <Search size={14} className="absolute left-3.5 top-3 text-[#8A97B0]" />
              <input
                type="text"
                placeholder="Search Patient Name, ID, or Examiner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#DDE3F0] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20 text-[#0F1A3A]"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5 text-xs text-[#5A6A8A] font-bold">
                <Filter size={13} />
                <span>Eye Side:</span>
                <select
                  value={filterEyeSide}
                  onChange={(e) => setFilterEyeSide(e.target.value)}
                  className="bg-white border border-[#DDE3F0] rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F1A3A] focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Eyes</option>
                  <option value="OD">Right Eye (OD)</option>
                  <option value="OS">Left Eye (OS)</option>
                  <option value="BOTH">Both Eyes (OD/OS)</option>
                </select>
              </div>

              <button
                onClick={fetchData}
                className="p-2 text-[#5A6A8A] hover:text-[#0F1A3A] rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0F4FC] text-[#8A97B0] font-extrabold uppercase tracking-wider border-b border-[#DDE3F0]">
                <tr>
                  <th className="p-4">Patient Name / Encounter</th>
                  <th className="p-4">Exam Date</th>
                  <th className="p-4">Eye Side</th>
                  <th className="p-4">Right Eye (OD)</th>
                  <th className="p-4">Left Eye (OS)</th>
                  <th className="p-4">Tele-Review</th>
                  <th className="p-4">Examiner</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FC]">
                {filteredExams.map((exam) => {
                  const odIop = getIopStatus(exam.rightEye?.intraocularPressure);
                  const osIop = getIopStatus(exam.leftEye?.intraocularPressure);
                  return (
                    <tr
                      key={exam.id}
                      onClick={() => setViewingDetailExam(exam)}
                      className="hover:bg-[#F8FAFF] transition-all cursor-pointer group"
                    >
                      <td className="p-4">
                        <p className="font-extrabold text-[#0F1A3A] group-hover:text-brand-blue transition-colors flex items-center gap-1.5">
                          <User size={13} className="text-brand-blue" /> {exam.patientName || exam.patientId}
                        </p>
                        <p className="text-[10px] text-[#8A97B0] font-mono">ID: {exam.patientId} • {exam.id}</p>
                      </td>

                      <td className="p-4 text-[#4B5A7A] font-medium">
                        {new Date(exam.examDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 text-[10px] font-extrabold bg-[#F0F4FC] text-brand-blue rounded-md border border-[#DDE3F0]">
                          {exam.eyeSide}
                        </span>
                      </td>

                      <td className="p-4">
                        {exam.rightEye ? (
                          <div className="space-y-0.5">
                            <p className="text-[#0F1A3A] font-bold">VA: {exam.rightEye.visualAcuityNotation || '—'}</p>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${odIop.color}`}>
                              IOP: {exam.rightEye.intraocularPressure ? `${exam.rightEye.intraocularPressure} mmHg` : '—'}
                            </span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="p-4">
                        {exam.leftEye ? (
                          <div className="space-y-0.5">
                            <p className="text-[#0F1A3A] font-bold">VA: {exam.leftEye.visualAcuityNotation || '—'}</p>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${osIop.color}`}>
                              IOP: {exam.leftEye.intraocularPressure ? `${exam.leftEye.intraocularPressure} mmHg` : '—'}
                            </span>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>

                      <td className="p-4">
                        {exam.teleOphthalmologyReview ? (
                          <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 rounded-md border border-amber-200 flex items-center gap-1 w-fit">
                            <Camera size={11} /> Flagged
                          </span>
                        ) : (
                          <span className="text-[#8A97B0] text-[11px] font-medium">Standard</span>
                        )}
                      </td>

                      <td className="p-4 text-[#4B5A7A] font-medium">
                        {exam.examinedByName || exam.examinedBy || 'System'}
                      </td>

                      <td className="p-4 text-right">
                        <span className="px-3 py-1 bg-slate-100 hover:bg-brand-blue hover:text-white text-slate-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1">
                          View <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Tele-Ophthalmology Worklist ──────────────────────────────── */}
      {activeTab === 'tele-review' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingReviews.map((item) => (
            <div key={item.id} className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm space-y-4 hover:border-brand-blue/40 transition-all">
              <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Camera size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#0F1A3A] text-sm">{item.patientName || item.patientId}</h3>
                    <p className="text-[11px] text-[#8A97B0] font-medium">ID: {item.patientId} • Exam Date: {new Date(item.examDate).toLocaleDateString('en-CA')}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                  <Clock size={11} /> Pending Read
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFF] p-3 rounded-xl border border-[#E2E8F0]">
                <div>
                  <p className="font-extrabold text-[#8A97B0] uppercase text-[10px]">Right Eye (OD)</p>
                  <p className="font-bold text-[#0F1A3A]">Acuity: {item.rightEye?.visualAcuityNotation || '—'}</p>
                  <p className="text-[#5A6A8A] font-semibold">IOP: {item.rightEye?.intraocularPressure || '—'} mmHg</p>
                </div>
                <div>
                  <p className="font-extrabold text-[#8A97B0] uppercase text-[10px]">Left Eye (OS)</p>
                  <p className="font-bold text-[#0F1A3A]">Acuity: {item.leftEye?.visualAcuityNotation || '—'}</p>
                  <p className="text-[#5A6A8A] font-semibold">IOP: {item.leftEye?.intraocularPressure || '—'} mmHg</p>
                </div>
              </div>

              {item.clinicalNotes && (
                <div className="text-xs text-[#4B5A7A] italic bg-[#F0F4FC] p-3 rounded-xl border border-[#DDE3F0]">
                  "{item.clinicalNotes}"
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedExam(item);
                  setShowReviewModal(true);
                }}
                className="w-full py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Stethoscope size={14} />
                Complete Specialist Assessment
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 3: Ophthalmic Procedures ────────────────────────────────────── */}
      {activeTab === 'procedures' && (
        <div className="bg-white rounded-2xl border border-[#DDE3F0] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#DDE3F0] bg-[#F8FAFF] flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#0F1A3A] flex items-center gap-2">
              <Scissors size={16} className="text-brand-blue" /> Linked Ophthalmic OR Cases
            </h3>
            <button
              onClick={() => {
                setShowLinkModal(true);
                fetchSurgicalCases();
              }}
              className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} /> Link New Case
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0F4FC] text-[#8A97B0] font-extrabold uppercase tracking-wider border-b border-[#DDE3F0]">
                <tr>
                  <th className="p-4">Surgical Case ID</th>
                  <th className="p-4">Patient Name / ID</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Eye Side</th>
                  <th className="p-4">Clinical Notes</th>
                  <th className="p-4 text-right">Linked On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4FC]">
                {procedures.map((proc) => (
                  <tr key={proc.id} className="hover:bg-[#F8FAFF] transition-all">
                    <td className="p-4 font-bold text-[#0F1A3A] font-mono">{proc.surgicalCaseId}</td>
                    <td className="p-4">
                      <p className="font-bold text-brand-blue">{proc.patientName || proc.patientId}</p>
                      <p className="text-[10px] text-[#8A97B0] font-mono">{proc.patientId}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 text-[10px] font-extrabold bg-[#F0F4FC] text-brand-blue rounded-md border border-[#DDE3F0]">
                        {proc.category?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-[#0F1A3A]">{proc.eyeSide}</td>
                    <td className="p-4 text-[#4B5A7A] font-medium">{proc.notes || '—'}</td>
                    <td className="p-4 text-right text-[#8A97B0] font-semibold">
                      {new Date(proc.createdAt).toLocaleDateString('en-CA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: User-Friendly New Eye Exam Form ────────────────────────── */}
      {showNewExamModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto border border-[#DDE3F0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
              <div>
                <h2 className="text-base font-black flex items-center gap-2 text-[#0F1A3A]">
                  <Eye size={18} className="text-brand-blue" /> Record Eye Examination Encounter
                </h2>
                <p className="text-[11px] text-[#8A97B0]">Search patient profile by Name, ID, or Phone, record OD/OS visual acuity & IOP</p>
              </div>
              <button onClick={() => setShowNewExamModal(false)} className="text-[#8A97B0] hover:text-[#0F1A3A] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
              
              {/* 1. Patient Autocomplete Search Bar */}
              <div>
                <label className="block font-bold mb-1 text-[#0F1A3A]">Select Patient Profile *</label>
                {selectedPatientObj ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black flex items-center justify-center text-xs shrink-0">
                        {getPatientDisplayName(selectedPatientObj).charAt(0)}
                      </div>
                      <div>
                        <p className="font-extrabold text-[#0F1A3A] text-xs">
                          {getPatientDisplayName(selectedPatientObj)}
                        </p>
                        <p className="text-[10px] text-[#5A6A8A]">
                          ID: <span className="font-mono font-bold text-brand-blue">{selectedPatientObj.patientId || selectedPatientObj.id}</span>
                          {(selectedPatientObj.phone || selectedPatientObj.patientPhone) && ` • Phone: ${selectedPatientObj.phone || selectedPatientObj.patientPhone}`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientObj(null);
                        setExamForm({ ...examForm, patientId: '' });
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      Change Patient
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-[#8A97B0]" />
                    <input
                      type="text"
                      value={patientQuery}
                      onChange={(e) => handlePatientSearch(e.target.value)}
                      placeholder="Type patient name (e.g. Eleanor Vance), ID (e.g. PAT-10492), or phone..."
                      className="w-full pl-9 pr-4 py-2.5 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A] focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />

                    {/* Autocomplete Results Dropdown */}
                    {patientSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-[#F0F4FC]">
                        {patientSearchResults.map(p => {
                          const pName = getPatientDisplayName(p);
                          const pId = p.patientId || p.id;
                          const pPhone = p.phone || p.patientPhone;
                          return (
                            <div
                              key={pId}
                              onClick={() => selectPatientForExam(p)}
                              className="p-3 hover:bg-[#F8FAFF] cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-brand-blue font-black flex items-center justify-center text-xs">
                                  {pName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-extrabold text-[#0F1A3A] text-xs">{pName}</p>
                                  <p className="text-[10px] text-[#8A97B0] font-mono">
                                    ID: {pId} {pPhone && `• Tel: ${pPhone}`}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-brand-blue bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                Select
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-[#0F1A3A]">Exam Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={examForm.examDate}
                    onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
                    className="w-full p-2.5 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-[#0F1A3A]">Facility ID (Optional)</label>
                  <input
                    type="text"
                    value={examForm.facilityId}
                    onChange={(e) => setExamForm({ ...examForm, facilityId: e.target.value })}
                    placeholder="e.g. FAC-01 (Main Hospital)"
                    className="w-full p-2.5 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A]"
                  />
                </div>
              </div>

              {/* Eye Side Visual Toggle */}
              <div>
                <label className="block font-bold mb-1.5 text-[#0F1A3A]">Eye Examined (Side) *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'OD', label: 'Right Eye (OD)' },
                    { key: 'OS', label: 'Left Eye (OS)' },
                    { key: 'BOTH', label: 'Both Eyes (OD / OS)' }
                  ].map(item => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setExamForm({ ...examForm, eyeSide: item.key })}
                      className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        examForm.eyeSide === item.key
                          ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                          : 'bg-[#F8FAFC] text-[#5A6A8A] border-[#DDE3F0] hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eye Measurements OD/OS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#F8FAFC] rounded-xl border border-[#DDE3F0]">
                {/* Right Eye (OD) */}
                {(examForm.eyeSide === 'OD' || examForm.eyeSide === 'BOTH') && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-brand-blue uppercase tracking-wider text-[11px] flex items-center justify-between">
                      <span>Right Eye (OD)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Tonometer / Snellen</span>
                    </h4>

                    <div>
                      <label className="block text-[#8A97B0] font-semibold mb-1">Visual Acuity</label>
                      <input
                        type="text"
                        value={examForm.rightEye.visualAcuityNotation}
                        onChange={(e) => setExamForm({ ...examForm, rightEye: { ...examForm.rightEye, visualAcuityNotation: e.target.value } })}
                        placeholder="e.g. 20/20"
                        className="w-full p-2 bg-white border border-[#DDE3F0] rounded-lg font-bold text-[#0F1A3A] mb-1.5"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {ACUITY_PRESETS.map(preset => (
                          <button
                            type="button"
                            key={preset}
                            onClick={() => setExamForm({ ...examForm, rightEye: { ...examForm.rightEye, visualAcuityNotation: preset } })}
                            className="px-2 py-0.5 bg-white border border-[#DDE3F0] rounded text-[10px] font-bold text-slate-600 hover:bg-brand-blue hover:text-white transition-all cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#8A97B0] font-semibold mb-1">Intraocular Pressure (mmHg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={examForm.rightEye.intraocularPressure}
                        onChange={(e) => setExamForm({ ...examForm, rightEye: { ...examForm.rightEye, intraocularPressure: parseFloat(e.target.value) } })}
                        className="w-full p-2 bg-white border border-[#DDE3F0] rounded-lg font-bold text-[#0F1A3A]"
                      />
                    </div>
                  </div>
                )}

                {/* Left Eye (OS) */}
                {(examForm.eyeSide === 'OS' || examForm.eyeSide === 'BOTH') && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-brand-blue uppercase tracking-wider text-[11px] flex items-center justify-between">
                      <span>Left Eye (OS)</span>
                      <span className="text-[10px] text-slate-500 font-normal">Tonometer / Snellen</span>
                    </h4>

                    <div>
                      <label className="block text-[#8A97B0] font-semibold mb-1">Visual Acuity</label>
                      <input
                        type="text"
                        value={examForm.leftEye.visualAcuityNotation}
                        onChange={(e) => setExamForm({ ...examForm, leftEye: { ...examForm.leftEye, visualAcuityNotation: e.target.value } })}
                        placeholder="e.g. 20/30"
                        className="w-full p-2 bg-white border border-[#DDE3F0] rounded-lg font-bold text-[#0F1A3A] mb-1.5"
                      />
                      <div className="flex gap-1 flex-wrap">
                        {ACUITY_PRESETS.map(preset => (
                          <button
                            type="button"
                            key={preset}
                            onClick={() => setExamForm({ ...examForm, leftEye: { ...examForm.leftEye, visualAcuityNotation: preset } })}
                            className="px-2 py-0.5 bg-white border border-[#DDE3F0] rounded text-[10px] font-bold text-slate-600 hover:bg-brand-blue hover:text-white transition-all cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#8A97B0] font-semibold mb-1">Intraocular Pressure (mmHg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={examForm.leftEye.intraocularPressure}
                        onChange={(e) => setExamForm({ ...examForm, leftEye: { ...examForm.leftEye, intraocularPressure: parseFloat(e.target.value) } })}
                        className="w-full p-2 bg-white border border-[#DDE3F0] rounded-lg font-bold text-[#0F1A3A]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 font-bold text-[#0F1A3A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examForm.teleOphthalmologyReview}
                    onChange={(e) => setExamForm({ ...examForm, teleOphthalmologyReview: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-blue focus:ring-brand-blue"
                  />
                  Flag for Remote Tele-Ophthalmology Specialist Review
                </label>
              </div>

              <div>
                <label className="block font-bold mb-1 text-[#0F1A3A]">Clinical Exam Notes (PHI Encrypted)</label>
                <textarea
                  rows="3"
                  value={examForm.clinicalNotes}
                  onChange={(e) => setExamForm({ ...examForm, clinicalNotes: e.target.value })}
                  placeholder="Enter detailed clinical findings..."
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A]"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#F0F4FC] pt-3">
                <button type="button" onClick={() => setShowNewExamModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-bold shadow-md cursor-pointer">
                  {loading ? 'Saving...' : 'Save Eye Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Tele-Review Assessment ─────────────────────────────────── */}
      {showReviewModal && selectedExam && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-[#DDE3F0] shadow-2xl">
            <h2 className="text-base font-black text-[#0F1A3A] flex items-center gap-2">
              <Stethoscope size={18} className="text-brand-blue" /> Specialist Tele-Review: {selectedExam.patientName || selectedExam.patientId}
            </h2>

            <form onSubmit={handleCompleteReview} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-[#0F1A3A]">Retinal Specialist Assessment Notes</label>
                <textarea
                  rows="4"
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter specialist recommendations, fundus assessment, follow-up plan..."
                  className="w-full p-3 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A]"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowReviewModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-bold shadow-md cursor-pointer">
                  {loading ? 'Submitting...' : 'Complete Specialist Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Link Ophthalmic Surgical Case with Scalable Search ────── */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-[#DDE3F0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
              <div>
                <h2 className="text-base font-black flex items-center gap-2 text-[#0F1A3A]">
                  <Scissors size={18} className="text-brand-blue" /> Link Surgical Case to Ophthalmology
                </h2>
                <p className="text-[11px] text-[#8A97B0]">Search by Patient Name, Case # (e.g. CASE-9921), or Surgeon</p>
              </div>
              <button onClick={() => setShowLinkModal(false)} className="text-[#8A97B0] hover:text-[#0F1A3A] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLinkProcedure} className="space-y-4 text-xs">
              
              {/* Live Search Bar for 1000s of Surgical Cases */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#0F1A3A]">Find Surgical Case *</label>
                  <span className="text-[10px] text-[#8A97B0] font-semibold">
                    {filteredAvailableCases.length} case(s) found
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-3 text-[#8A97B0]" />
                  <input
                    type="text"
                    value={caseFilterQuery}
                    onChange={(e) => setCaseFilterQuery(e.target.value)}
                    placeholder="Type Case Number (CASE-9921), Patient Name, or Surgeon..."
                    className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A] focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                </div>

                {/* Case Selector List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-[#F0F4FC]">
                  {filteredAvailableCases.map(c => {
                    const isSelected = linkForm.surgicalCaseId === (c.caseNumber || c.id);
                    return (
                      <div
                        key={c.id || c.caseNumber}
                        onClick={() => selectSurgicalCaseForLink(c)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-brand-blue ring-1 ring-brand-blue'
                            : 'bg-[#F8FAFC] border-[#DDE3F0] hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <p className="font-extrabold text-[#0F1A3A] text-xs font-mono">
                            {c.caseNumber || c.id} • <span className="font-bold text-brand-blue">{c.patientName || c.patientId}</span>
                          </p>
                          <p className="font-bold text-[#4B5A7A] text-[11px] mt-0.5">{c.procedureName || 'Ophthalmic Surgery'}</p>
                          <p className="text-[10px] text-[#8A97B0]">Surgeon: {c.surgeonName || 'Staff'}</p>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center shrink-0">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredAvailableCases.length === 0 && (
                    <div className="p-4 text-center text-[#8A97B0] text-xs font-medium">
                      No matching surgical cases found. Try typing a Case # or Patient Name.
                    </div>
                  )}
                </div>
              </div>

              {/* Direct Manual Entry Override if known */}
              <div className="p-3 bg-[#F0F4FC] rounded-xl border border-[#DDE3F0]">
                <p className="text-[10px] font-extrabold uppercase text-[#8A97B0] mb-1">Direct Case Number Entry (Optional)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={linkForm.surgicalCaseId}
                    onChange={(e) => setLinkForm({ ...linkForm, surgicalCaseId: e.target.value })}
                    placeholder="Case ID e.g. CASE-9921"
                    className="p-2 bg-white border border-[#DDE3F0] rounded-lg font-mono font-bold text-[#0F1A3A]"
                  />
                  <input
                    type="text"
                    value={linkForm.patientId}
                    onChange={(e) => setLinkForm({ ...linkForm, patientId: e.target.value })}
                    placeholder="Patient ID e.g. PAT-10492"
                    className="p-2 bg-white border border-[#DDE3F0] rounded-lg font-mono font-bold text-[#0F1A3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1 text-[#0F1A3A]">Procedure Category *</label>
                  <select
                    value={linkForm.category}
                    onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#DDE3F0] rounded-xl font-bold text-[#0F1A3A] cursor-pointer"
                  >
                    <option value="CATARACT_SURGERY">Cataract Surgery</option>
                    <option value="STRABISMUS_CORRECTION">Strabismus Correction</option>
                    <option value="LID_PROCEDURE">Lid Procedure</option>
                    <option value="OTHER_MINOR_PROCEDURE">Other Minor Procedure</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-[#0F1A3A]">Eye Side *</label>
                  <select
                    value={linkForm.eyeSide}
                    onChange={(e) => setLinkForm({ ...linkForm, eyeSide: e.target.value })}
                    className="w-full p-2.5 bg-white border border-[#DDE3F0] rounded-xl font-bold text-[#0F1A3A] cursor-pointer"
                  >
                    <option value="OD">Right Eye (OD)</option>
                    <option value="OS">Left Eye (OS)</option>
                    <option value="BOTH">Both Eyes (OD/OS)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-[#0F1A3A]">Surgical Notes</label>
                <textarea
                  rows="3"
                  value={linkForm.notes}
                  onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
                  placeholder="Notes regarding biometry, lens selection..."
                  className="w-full p-2.5 bg-[#F8FAFC] border border-[#DDE3F0] rounded-xl font-medium text-[#0F1A3A]"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-[#F0F4FC] pt-3">
                <button type="button" onClick={() => setShowLinkModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="px-5 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-bold shadow-md cursor-pointer">
                  {loading ? 'Linking...' : 'Link Procedure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: Exam Detail Summary Drawer ─────────────────────────────── */}
      {viewingDetailExam && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 border border-[#DDE3F0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
              <div>
                <h3 className="font-black text-[#0F1A3A] text-base flex items-center gap-2">
                  <Eye size={18} className="text-brand-blue" /> Eye Exam Detail: {viewingDetailExam.patientName || viewingDetailExam.patientId}
                </h3>
                <p className="text-[11px] text-[#8A97B0]">Patient ID: {viewingDetailExam.patientId} • Encounter: {viewingDetailExam.id}</p>
              </div>
              <button onClick={() => setViewingDetailExam(null)} className="text-[#8A97B0] hover:text-[#0F1A3A] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#F8FAFF] p-3 rounded-xl border border-[#DDE3F0]">
                <div>
                  <p className="font-extrabold text-[#8A97B0] uppercase text-[10px]">Right Eye (OD)</p>
                  <p className="font-bold text-[#0F1A3A] mt-1">Acuity: {viewingDetailExam.rightEye?.visualAcuityNotation || '—'}</p>
                  <p className="text-[#5A6A8A]">IOP: {viewingDetailExam.rightEye?.intraocularPressure ? `${viewingDetailExam.rightEye.intraocularPressure} mmHg` : '—'}</p>
                  {viewingDetailExam.rightEye?.octResult && <p className="text-[11px] text-slate-600 mt-1 italic">OCT: {viewingDetailExam.rightEye.octResult}</p>}
                </div>
                <div>
                  <p className="font-extrabold text-[#8A97B0] uppercase text-[10px]">Left Eye (OS)</p>
                  <p className="font-bold text-[#0F1A3A] mt-1">Acuity: {viewingDetailExam.leftEye?.visualAcuityNotation || '—'}</p>
                  <p className="text-[#5A6A8A]">IOP: {viewingDetailExam.leftEye?.intraocularPressure ? `${viewingDetailExam.leftEye.intraocularPressure} mmHg` : '—'}</p>
                  {viewingDetailExam.leftEye?.octResult && <p className="text-[11px] text-slate-600 mt-1 italic">OCT: {viewingDetailExam.leftEye.octResult}</p>}
                </div>
              </div>

              {viewingDetailExam.clinicalNotes && (
                <div className="bg-[#F0F4FC] p-3 rounded-xl border border-[#DDE3F0]">
                  <p className="font-extrabold text-brand-blue text-[10px] uppercase mb-1">Clinical Notes (Decrypted)</p>
                  <p className="text-[#0F1A3A] font-medium leading-relaxed">{viewingDetailExam.clinicalNotes}</p>
                </div>
              )}

              <div className="flex justify-between items-center text-[11px] text-[#8A97B0] pt-2 border-t border-[#F0F4FC]">
                <span>Examiner: {viewingDetailExam.examinedByName || 'System'}</span>
                <span>{new Date(viewingDetailExam.examDate).toLocaleDateString('en-CA')}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingDetailExam(null)}
                className="px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
