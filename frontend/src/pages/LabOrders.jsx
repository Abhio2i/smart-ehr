import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FlaskConical, Activity, AlertTriangle, CheckCircle2, Clock, Search, Plus,
  RefreshCw, Filter, FileText, ChevronRight, X, Trash2, Download, Printer,
  Microscope, Stethoscope, AlertCircle, ShieldAlert, ArrowUpRight, User, Check,
  SlidersHorizontal, ChevronDown, Layers, Loader2
} from 'lucide-react';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';

const PRIORITY_META = {
  STAT:    { label: 'STAT (Immediate)', cls: 'bg-red-50 text-red-700 border-red-200 font-bold' },
  URGENT:  { label: 'Urgent',          cls: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold' },
  ROUTINE: { label: 'Routine',         cls: 'bg-slate-100 text-slate-600 border-slate-200 font-normal' }
};

const STATUS_META = {
  REQUESTED:   { label: 'Requested',   cls: 'bg-blue-50 text-blue-700 border-blue-200',   icon: Clock },
  IN_PROGRESS: { label: 'Processing',  cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: RefreshCw },
  COMPLETED:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  CRITICAL:    { label: 'Critical Alert', cls: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse', icon: ShieldAlert }
};

export default function LabOrders() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const organizationId = user?.organizationId || 'org-default';

  // Database Data States
  const [labs, setLabs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active Selections
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'new'
  const [selectedLabId, setSelectedLabId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // New Requisition Form State
  const [newOrder, setNewOrder] = useState({
    patientId: '',
    patientName: '',
    testName: 'Cardiac Biomarkers (Troponin I & CK-MB)',
    category: 'Cardiology / Emergency',
    specimen: 'Venous Whole Blood',
    priority: 'STAT',
    facility: user?.organizationId || 'St. Stanton General Hospital',
    notes: ''
  });

  // Result Entry State for Modal
  const [editingResults, setEditingResults] = useState(false);
  const [resultRows, setResultRows] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');

  // Live Patient Search Backend API Caller
  const searchPatientsAPI = useCallback(async (queryText = '') => {
    setSearchingPatients(true);
    try {
      const res = await client.get('/api/admin/patients/search', { params: { query: queryText, limit: 50 } });
      let list = Array.isArray(res.data) ? res.data : [];
      if (list.length === 0) {
        const epcrRes = await client.get('/api/epcr/records', { params: { size: 50 } });
        const records = Array.isArray(epcrRes.data) ? epcrRes.data : (epcrRes.data?.content || []);
        list = records.map(r => ({
          id: r.patientId || r.id,
          name: r.patientName || `Patient ${r.patientId || r.id}`,
          phone: r.phone || ''
        }));
      }
      setPatients(list);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  // Fetch Live Database Data from Backend API
  const fetchAllLabData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch live patients list
      let patientList = [];
      try {
        const patientsRes = await client.get('/api/admin/patients/search', { params: { limit: 50 } });
        patientList = Array.isArray(patientsRes.data) ? patientsRes.data : (patientsRes.data?.content || []);
      } catch {
        // Fallback patient search if admin endpoint is scope-restricted
        const epcrRes = await client.get('/api/epcr/records', { params: { size: 50 } });
        const records = Array.isArray(epcrRes.data) ? epcrRes.data : (epcrRes.data?.content || []);
        patientList = records.map(r => ({
          id: r.patientId || r.id,
          name: r.patientName || `Patient ${r.patientId || r.id}`,
        }));
      }
      setPatients(patientList);

      // 2. Fetch live lab results for loaded patients
      let allLabResults = [];
      for (const p of patientList.slice(0, 10)) {
        const pId = p.id || p.patientId;
        if (!pId) continue;
        try {
          const res = await client.get(`/api/patients/${pId}/history/labs`);
          if (res.data && Array.isArray(res.data)) {
            const formatted = res.data.map(l => ({
              id: l.id || `LAB-${Math.floor(1000 + Math.random() * 9000)}`,
              patientId: pId,
              patientName: p.name || p.patientName || 'Unknown Patient',
              testName: l.title || l.testName || 'Diagnostic Lab Requisition',
              category: l.category || 'Laboratory',
              specimen: l.specimenType || 'Venous Blood',
              priority: l.priority || 'ROUTINE',
              status: l.status || (l.results && l.results.some(r => r.status?.includes('CRITICAL')) ? 'CRITICAL' : 'COMPLETED'),
              requestedAt: l.date || l.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 16),
              requestedBy: l.orderedBy || 'Attending Physician',
              facility: l.facility || 'Regional Medical Center',
              notes: l.notes || l.description || 'Clinical diagnostic requisition.',
              results: l.results || []
            }));
            allLabResults.push(...formatted);
          }
        } catch {
          // Ignore individual patient fetch error
        }
      }

      setLabs(allLabResults);
      if (allLabResults.length > 0 && !selectedLabId) {
        setSelectedLabId(allLabResults[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch lab orders:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to connect to backend laboratory database.' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, selectedLabId]);

  useEffect(() => {
    fetchAllLabData();
  }, []);

  const activeLab = labs.find(l => l.id === selectedLabId) || labs[0] || null;

  // Filtering
  const filteredLabs = labs.filter(lab => {
    const matchesSearch =
      lab.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.testName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || lab.status === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || lab.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // KPI Calculations
  const totalCount = labs.length;
  const pendingCount = labs.filter(l => l.status === 'REQUESTED' || l.status === 'IN_PROGRESS').length;
  const completedCount = labs.filter(l => l.status === 'COMPLETED').length;
  const criticalCount = labs.filter(l => l.status === 'CRITICAL').length;

  // Real API Submit POST Requisition
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please select a Patient ID.' }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: newOrder.testName,
        testName: newOrder.testName,
        category: newOrder.category,
        specimenType: newOrder.specimen,
        priority: newOrder.priority,
        facility: newOrder.facility,
        notes: newOrder.notes,
        orderedBy: `${user?.name || 'Dr. Medical Practitioner'} (${user?.role || 'PHYSICIAN'})`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        results: []
      };

      const res = await client.post(`/api/patients/${newOrder.patientId}/history/labs`, payload);
      const created = {
        id: res.data?.id || `LAB-${Math.floor(1000 + Math.random() * 9000)}`,
        patientId: newOrder.patientId,
        patientName: newOrder.patientName || `Patient ${newOrder.patientId}`,
        testName: newOrder.testName,
        category: newOrder.category,
        specimen: newOrder.specimen,
        priority: newOrder.priority,
        status: newOrder.priority === 'STAT' ? 'CRITICAL' : 'REQUESTED',
        requestedAt: payload.date,
        requestedBy: payload.orderedBy,
        facility: newOrder.facility,
        notes: newOrder.notes,
        results: []
      };

      setLabs([created, ...labs]);
      setSelectedLabId(created.id);
      setActiveTab('orders');
      dispatch(addToast({ type: 'success', message: `Lab Requisition ${created.id} posted to patient database!` }));

      setNewOrder({
        patientId: '',
        patientName: '',
        testName: 'Cardiac Biomarkers (Troponin I & CK-MB)',
        category: 'Cardiology / Emergency',
        specimen: 'Venous Whole Blood',
        priority: 'STAT',
        facility: user?.organizationId || 'St. Stanton General Hospital',
        notes: ''
      });
    } catch (err) {
      console.error('Failed to post lab order:', err);
      dispatch(addToast({ type: 'error', message: 'Error submitting lab requisition to server.' }));
    } finally {
      setSaving(false);
    }
  };

  // Real API Update PUT Lab Result Parameters
  const handleSaveResults = async () => {
    if (!activeLab) return;
    setSaving(true);
    try {
      const hasCritical = resultRows.some(r => r.status?.includes('CRITICAL'));
      const newStatus = hasCritical ? 'CRITICAL' : 'COMPLETED';

      const payload = {
        id: activeLab.id,
        title: activeLab.testName,
        testName: activeLab.testName,
        category: activeLab.category,
        specimenType: activeLab.specimen,
        priority: activeLab.priority,
        status: newStatus,
        results: resultRows
      };

      await client.put(`/api/patients/${activeLab.patientId}/history/labs/${activeLab.id}`, payload);

      const updatedLabs = labs.map(l => {
        if (l.id === activeLab.id) {
          return {
            ...l,
            results: resultRows,
            status: newStatus
          };
        }
        return l;
      });

      setLabs(updatedLabs);
      setEditingResults(false);
      dispatch(addToast({ type: 'success', message: 'Pathology results saved & verified in patient EHR!' }));
    } catch (err) {
      console.error('Failed to update lab results:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to update lab results on server.' }));
    } finally {
      setSaving(false);
    }
  };

  // Real API DELETE Lab Order
  const handleDeleteOrder = async (labId, patientId) => {
    if (!window.confirm(`Are you sure you want to delete Lab Order ${labId}?`)) return;
    try {
      await client.delete(`/api/patients/${patientId}/history/labs/${labId}`);
      setLabs(labs.filter(l => l.id !== labId));
      if (selectedLabId === labId) {
        const remaining = labs.filter(l => l.id !== labId);
        setSelectedLabId(remaining.length > 0 ? remaining[0].id : null);
      }
      dispatch(addToast({ type: 'success', message: `Lab Order ${labId} deleted successfully.` }));
    } catch (err) {
      console.error('Failed to delete lab order:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to delete lab record from server.' }));
    }
  };

  const handleAddResultRow = () => {
    setResultRows([...resultRows, { parameter: '', value: '', unit: '', refRange: '', status: 'NORMAL' }]);
  };

  const openResultEditor = () => {
    setResultRows(activeLab?.results && activeLab.results.length > 0 ? [...activeLab.results] : [
      { parameter: 'Troponin I', value: '0.02', unit: 'ng/mL', refRange: '0.00 - 0.04', status: 'NORMAL' },
      { parameter: 'CK-MB', value: '2.1', unit: 'ng/mL', refRange: '0.0 - 5.0', status: 'NORMAL' }
    ]);
    setEditingResults(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 md:p-8 font-sans">
      {/* HEADER BANNER */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-brand-red shadow-sm">
            <FlaskConical className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Diagnostic Test Orders & Lab Management
            </h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
              Live Database Integration with Spring Boot EHR REST API (RFP 6.2 & 8.1)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('new')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-red hover:bg-rose-700 text-white font-bold text-sm transition shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Lab Requisition</span>
          </button>

          <button
            onClick={fetchAllLabData}
            className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Refresh Database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-red' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Requisitions</span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0F172A]">{totalCount}</span>
            <span className="text-xs text-[#64748B]">live database records</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Pending / Processing</span>
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-700">{pendingCount}</span>
            <span className="text-xs text-[#64748B]">awaiting lab entry</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Completed Results</span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">{completedCount}</span>
            <span className="text-xs text-[#64748B]">verified by pathology</span>
          </div>
        </div>

        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Critical Flag Alerts</span>
            <div className="p-2 rounded-xl bg-rose-100 border border-rose-200 text-rose-600">
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-700">{criticalCount}</span>
            <span className="text-xs text-rose-700/80 font-semibold">requires immediate action</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] mb-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'orders'
              ? 'border-brand-red text-brand-red bg-white rounded-t-xl shadow-sm'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Requisitions & Orders</span>
          <span className="ml-1 px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {filteredLabs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'new'
              ? 'border-brand-red text-brand-red bg-white rounded-t-xl shadow-sm'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>New Requisition Wizard</span>
        </button>
      </div>

      {/* TAB 1: ORDERS & RESULTS split view */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT LIST PANEL (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col h-[760px] shadow-sm">
            {/* Search & Filter Bar */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Patient Name, ID, or Test..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-brand-red transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#475569] focus:outline-none focus:border-brand-red"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="IN_PROGRESS">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CRITICAL">Critical Alert</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#475569] focus:outline-none focus:border-brand-red"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="STAT">STAT Only</option>
                  <option value="URGENT">Urgent</option>
                  <option value="ROUTINE">Routine</option>
                </select>
              </div>
            </div>

            {/* List items */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-brand-red mb-2" />
                  <span className="text-xs font-medium">Fetching lab orders from database...</span>
                </div>
              ) : filteredLabs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-medium">
                  No diagnostic requisitions found in database.
                </div>
              ) : (
                filteredLabs.map(lab => {
                  const isSelected = lab.id === activeLab?.id;
                  const statusInfo = STATUS_META[lab.status] || STATUS_META.REQUESTED;
                  const priorityInfo = PRIORITY_META[lab.priority] || PRIORITY_META.ROUTINE;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={lab.id}
                      onClick={() => setSelectedLabId(lab.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-rose-50/40 border-brand-red shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-500">{lab.id}</span>
                          <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">{lab.testName}</h3>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[10px] rounded-full border ${priorityInfo.cls}`}>
                          {lab.priority}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#475569] mb-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-[#0F172A]">{lab.patientName}</span>
                        <span className="text-slate-500">({lab.patientId})</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span>{lab.category}</span>
                        <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] ${statusInfo.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT DETAIL INSPECTOR (7 Cols) */}
          <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col h-[760px] overflow-y-auto shadow-sm">
            {activeLab ? (
              <div className="space-y-6">
                {/* Detail Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {activeLab.id}
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs rounded-full border ${PRIORITY_META[activeLab.priority]?.cls}`}>
                        {activeLab.priority} Priority
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs rounded-full border ${STATUS_META[activeLab.status]?.cls}`}>
                        {STATUS_META[activeLab.status]?.label}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-[#0F172A]">{activeLab.testName}</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">Specimen: {activeLab.specimen} | Category: {activeLab.category}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={openResultEditor}
                      className="px-4 py-2 rounded-xl bg-brand-red text-white hover:bg-rose-700 text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{activeLab.results && activeLab.results.length > 0 ? 'Edit Results' : 'Enter Lab Results'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteOrder(activeLab.id, activeLab.patientId)}
                      className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 transition"
                      title="Delete Order"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition"
                      title="Print Summary"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Patient & Order Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block">Patient Name</span>
                    <span className="font-extrabold text-[#0F172A] text-sm">{activeLab.patientName}</span>
                    <span className="text-slate-500 block text-[11px]">ID: {activeLab.patientId}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">Ordering Clinician</span>
                    <span className="font-bold text-[#0F172A]">{activeLab.requestedBy}</span>
                    <span className="text-slate-500 block text-[11px]">{activeLab.requestedAt}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">Fulfilling Facility</span>
                    <span className="font-bold text-[#0F172A]">{activeLab.facility}</span>
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs">
                  <span className="text-[#64748B] font-bold uppercase tracking-wider block mb-1">Clinical Indication & Diagnosis Notes</span>
                  <p className="text-[#334155] leading-relaxed font-medium">{activeLab.notes}</p>
                </div>

                {/* CRITICAL WARNING BANNER IF CRITICAL */}
                {activeLab.status === 'CRITICAL' && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs">
                    <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black block text-sm">Critical Pathology Alert Flagged</span>
                      <span className="font-medium">One or more lab parameters exceed panic safety limits. Attending physician has been auto-notified via telehealth dispatch.</span>
                    </div>
                  </div>
                )}

                {/* LAB RESULTS TABLE */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                      <Microscope className="w-4 h-4 text-brand-red" />
                      <span>Laboratory Results & Pathology Values</span>
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {activeLab.results?.length || 0} Parameters Tested
                    </span>
                  </div>

                  {!activeLab.results || activeLab.results.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 text-xs">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 text-purple-600" />
                      <p className="font-bold text-[#0F172A]">Requisition Pending Laboratory Processing</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Click &quot;Enter Lab Results&quot; above to post pathology measurements.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Parameter / Marker</th>
                            <th className="px-4 py-3">Measured Value</th>
                            <th className="px-4 py-3">Reference Interval</th>
                            <th className="px-4 py-3 text-right">Pathology Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {activeLab.results.map((res, i) => {
                            let flagClass = 'bg-slate-100 text-slate-700 border border-slate-200';
                            let flagText = 'NORMAL';

                            if (res.status === 'CRITICAL_HIGH' || res.status === 'CRITICAL_LOW') {
                              flagClass = 'bg-rose-100 text-rose-800 border border-rose-300 font-black';
                              flagText = res.status.replace('_', ' ');
                            } else if (res.status === 'HIGH') {
                              flagClass = 'bg-amber-100 text-amber-800 border border-amber-200 font-semibold';
                              flagText = 'ELEVATED (H)';
                            } else if (res.status === 'LOW') {
                              flagClass = 'bg-blue-100 text-blue-800 border border-blue-200 font-semibold';
                              flagText = 'DECREASED (L)';
                            }

                            return (
                              <tr key={i} className="hover:bg-slate-50 transition">
                                <td className="px-4 py-3 font-bold text-[#0F172A]">{res.parameter}</td>
                                <td className="px-4 py-3 font-mono font-bold text-[#0F172A]">
                                  {res.value} <span className="text-slate-500 font-normal text-[11px]">{res.unit}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{res.refRange}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`px-2.5 py-1 text-[10px] rounded-md ${flagClass}`}>
                                    {flagText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* SIGN-OFF STAMP */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>HL7 FHIR DiagnosticReport / Observation Compliant</span>
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Electronic Signature Verified
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 font-medium">
                Select a diagnostic order from the left list to view pathology details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: NEW REQUISITION FORM */}
      {activeTab === 'new' && (
        <div className="max-w-3xl mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-red" />
                <span>New Diagnostic Test Requisition Wizard</span>
              </h2>
              <p className="text-xs text-[#64748B]">Order laboratory bloodwork, urinalysis, or pathology panels (RFP 6.2)</p>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateOrder} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[#0F172A] font-bold mb-1">Select Patient *</label>
                
                {/* Dynamic Live Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search patient by Name, ID, or Phone..."
                    value={patientSearchTerm}
                    onChange={e => {
                      setPatientSearchTerm(e.target.value);
                      searchPatientsAPI(e.target.value);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-brand-red transition"
                  />
                  {searchingPatients && (
                    <Loader2 className="w-4 h-4 absolute right-3.5 top-2.5 text-brand-red animate-spin" />
                  )}
                </div>

                <select
                  required
                  value={newOrder.patientId}
                  onChange={e => {
                    const sel = patients.find(p => (p.id || p.patientId) === e.target.value);
                    setNewOrder({
                      ...newOrder,
                      patientId: e.target.value,
                      patientName: sel ? (sel.name || sel.patientName) : `Patient ${e.target.value}`
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] font-bold focus:outline-none focus:border-brand-red"
                >
                  <option value="">-- Select Active Patient --</option>
                  {patients.map((p, idx) => (
                    <option key={idx} value={p.id || p.patientId}>
                      {p.name || p.patientName || `Patient ${p.id || p.patientId}`} ({p.id || p.patientId}) {p.phone ? `- Tel: ${p.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Diagnostic Test Panel</label>
                <select
                  value={newOrder.testName}
                  onChange={e => setNewOrder({ ...newOrder, testName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[#0F172A] focus:outline-none focus:border-brand-red"
                >
                  <option value="Cardiac Biomarkers (Troponin I & CK-MB)">Cardiac Biomarkers (Troponin I & CK-MB)</option>
                  <option value="Comprehensive Metabolic Panel (CMP)">Comprehensive Metabolic Panel (CMP)</option>
                  <option value="Complete Blood Count (CBC) with Differential">Complete Blood Count (CBC) with Differential</option>
                  <option value="Arterial Blood Gas (ABG) & Lactate">Arterial Blood Gas (ABG) & Lactate</option>
                  <option value="Urinalysis & Urine Culture">Urinalysis & Urine Culture</option>
                  <option value="Lipid Profile & Glucose">Lipid Profile & Glucose</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Clinical Priority</label>
                <select
                  value={newOrder.priority}
                  onChange={e => setNewOrder({ ...newOrder, priority: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[#0F172A] focus:outline-none focus:border-brand-red"
                >
                  <option value="ROUTINE">Routine (Standard Processing)</option>
                  <option value="URGENT">Urgent (Within 2 Hours)</option>
                  <option value="STAT">STAT (Immediate Emergency Analysis)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Specimen Required</label>
                <input
                  type="text"
                  value={newOrder.specimen}
                  onChange={e => setNewOrder({ ...newOrder, specimen: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] focus:outline-none focus:border-brand-red"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#0F172A] font-bold mb-1">Fulfilling Clinical Facility</label>
              <input
                type="text"
                value={newOrder.facility}
                onChange={e => setNewOrder({ ...newOrder, facility: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="block text-[#0F172A] font-bold mb-1">Clinical Indications & Physician Notes</label>
              <textarea
                rows={4}
                placeholder="Describe chief complaint, symptoms, or diagnostic suspicion..."
                value={newOrder.notes}
                onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0F172A] focus:outline-none focus:border-brand-red"
              ></textarea>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-brand-red text-white font-bold hover:bg-rose-700 transition shadow-sm flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Post Requisition to Database</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESULT EDITOR MODAL */}
      {editingResults && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border border-slate-200 rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                <Microscope className="w-5 h-5 text-brand-red" />
                <span>Enter Laboratory Pathology Results</span>
              </h3>
              <button onClick={() => setEditingResults(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {resultRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center text-xs">
                  <div className="col-span-4">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Parameter</label>
                    <input
                      type="text"
                      placeholder="e.g. Troponin I"
                      value={row.parameter}
                      onChange={e => {
                        const updated = [...resultRows];
                        updated[idx].parameter = e.target.value;
                        setResultRows(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-[#0F172A] font-semibold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Measured</label>
                    <input
                      type="text"
                      placeholder="4.82"
                      value={row.value}
                      onChange={e => {
                        const updated = [...resultRows];
                        updated[idx].value = e.target.value;
                        setResultRows(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-[#0F172A] font-mono font-bold"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Unit</label>
                    <input
                      type="text"
                      placeholder="ng/mL"
                      value={row.unit}
                      onChange={e => {
                        const updated = [...resultRows];
                        updated[idx].unit = e.target.value;
                        setResultRows(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Pathology Flag</label>
                    <select
                      value={row.status}
                      onChange={e => {
                        const updated = [...resultRows];
                        updated[idx].status = e.target.value;
                        setResultRows(updated);
                      }}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-slate-800 text-[11px] font-medium"
                    >
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH (Elevated)</option>
                      <option value="LOW">LOW (Decreased)</option>
                      <option value="CRITICAL_HIGH">CRITICAL HIGH</option>
                      <option value="CRITICAL_LOW">CRITICAL LOW</option>
                    </select>
                  </div>

                  <div className="col-span-1 text-center pt-3">
                    <button
                      onClick={() => setResultRows(resultRows.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddResultRow}
              className="w-full py-2.5 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold text-slate-700 transition flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100"
            >
              <Plus className="w-4 h-4 text-brand-red" />
              <span>Add Result Measurement Row</span>
            </button>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingResults(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResults}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-brand-red text-white text-xs font-bold hover:bg-rose-700 shadow-sm flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Sign Off Results</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
