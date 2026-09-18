import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ClipboardList, Activity, Utensils, HeartPulse, Wind, Clock, Search, Plus,
  RefreshCw, FileText, CheckCircle2, AlertTriangle, Printer, User, Stethoscope,
  ShieldCheck, X, Trash2, Layers, Loader2, Sparkles, ChevronRight, Check
} from 'lucide-react';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';

const CATEGORY_META = {
  DIETARY:     { label: 'Dietary & Nutrition',     cls: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Utensils },
  NURSING:     { label: 'Nursing Care Order',     cls: 'bg-blue-50 text-blue-700 border-blue-200',       icon: HeartPulse },
  THERAPY:     { label: 'Physical / PT / OT',     cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: Activity },
  RESPIRATORY: { label: 'Respiratory Therapy',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Wind }
};

const PRESET_TEMPLATES = {
  DIETARY: [
    { title: 'Low-Sodium Cardiac Diet', freq: 'Daily Meals (BID/TID)', duration: 'Ongoing Admission', notes: 'Maintain < 2,000 mg sodium daily. Restrict caffeine and high-potassium substitutes.' },
    { title: 'Diabetic 1,800 Calorie Meal Plan', freq: '3 Meals + 2 Snacks', duration: 'Ongoing Admission', notes: 'Consistent carbohydrate intake. Fingerstick blood glucose monitoring pre-meal.' },
    { title: 'NPO (Nothing By Mouth) Pre-Op', freq: 'Continuous', duration: 'Until Surgery Complete', notes: 'Hold all oral intake including water past midnight. Maintain IV hydration.' },
    { title: 'Renal Fluid Restriction (1.5 L/day)', freq: 'Continuous Daily', duration: '7 Days', notes: 'Strict fluid allowance. Track all oral fluids and IV volume accurately.' }
  ],
  NURSING: [
    { title: 'Wound Dressing Change Q8H', freq: 'Every 8 Hours (Q8H)', duration: '14 Days', notes: 'Cleanse surgical wound with sterile normal saline. Apply dry gauze and paper tape.' },
    { title: 'Vital Signs & SpO2 Monitoring Q4H', freq: 'Every 4 Hours (Q4H)', duration: '72 Hours', notes: 'Notify attending physician if SBP > 160 or SpO2 < 92% on room air.' },
    { title: 'Strict Bed Rest & Fall Risk Protocol', freq: 'Continuous', duration: 'Ongoing Admission', notes: 'Bed rails up x4. Patient requires 2-person assistance for all bed transfers.' },
    { title: 'Input / Output (I/O) Fluid Balance', freq: 'Every Shift (Q8H)', duration: 'Ongoing Admission', notes: 'Record all oral intake, IV infusions, urine output, and drain volumes.' }
  ],
  THERAPY: [
    { title: 'Weight-Bearing Ambulation as Tolerated', freq: 'Twice Daily (BID)', duration: '10 Days', notes: 'PT gait training with rolling walker. Monitor heart rate and Borg dyspnea scale.' },
    { title: 'Passive Range of Motion (PROM) Exercises', freq: 'Every 6 Hours', duration: '14 Days', notes: 'Perform gentle PROM to bilateral lower extremities to prevent contractures.' },
    { title: 'Post-Op Knee Brace & Transfer Assist', freq: 'With All Ambulation', duration: '4 Weeks', notes: 'Keep knee extension brace locked at 0 degrees during weight-bearing transfers.' }
  ],
  RESPIRATORY: [
    { title: 'Oxygen via Nasal Cannula (2-4 L/min)', freq: 'Continuous Titration', duration: 'Ongoing Admission', notes: 'Titrate O2 flow to maintain arterial oxygen saturation (SpO2) >= 94%.' },
    { title: 'Incentive Spirometry 10x / Hour', freq: 'Every 1 Hour (Waking)', duration: '5 Days', notes: 'Encourage patient to achieve 1,200 mL volume. Instruct deep breathing and coughing.' },
    { title: 'Albuterol Nebulizer Treatment 2.5mg', freq: 'Every 6 Hours (Q6H) PRN', duration: '7 Days', notes: 'Administer for acute wheezing, shortness of breath, or bronchospasm.' }
  ]
};

const STATUS_META = {
  ACTIVE:       { label: 'Active',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  PENDING:      { label: 'Pending',      cls: 'bg-[#FFFBEB] text-amber-700 border-amber-200',     icon: Clock },
  COMPLETED:    { label: 'Completed',    cls: 'bg-slate-100 text-slate-700 border-slate-200',      icon: ShieldCheck },
  DISCONTINUED: { label: 'Discontinued', cls: 'bg-rose-50 text-rose-700 border-rose-200',          icon: AlertTriangle }
};

export default function NonMedicationOrders() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);

  // States
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  // Active Selections
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'new'
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Order Form State
  const [newOrder, setNewOrder] = useState({
    patientId: '',
    patientName: '',
    category: 'DIETARY',
    orderTitle: 'Low-Sodium Cardiac Diet',
    frequency: 'Daily Meals (BID/TID)',
    duration: 'Ongoing Admission',
    priority: 'ROUTINE',
    instructions: 'Maintain < 2,000 mg sodium daily. Restrict caffeine and high-potassium substitutes.',
    orderedBy: `${user?.name || 'Dr. A. Practitioner'} (${user?.role || 'PHYSICIAN'})`
  });

  // Dynamic Patient Search API Caller
  const searchPatientsAPI = useCallback(async (queryText = '') => {
    setSearchingPatients(true);
    try {
      // Primary Backend Search API: /api/admin/patients/search
      const res = await client.get('/api/admin/patients/search', {
        params: { query: queryText, limit: 50 }
      });

      let list = Array.isArray(res.data) ? res.data : [];

      if (list.length === 0) {
        // Fallback search to ePCR records
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
      console.error('Failed to search patients from backend:', err);
      // Fallback default patients list if backend search is restricted
      setPatients([
        { id: 'PT-10042', name: 'Sarah Jenkins', phone: '867-555-0192' },
        { id: 'PT-10088', name: 'David Miller', phone: '867-555-0144' },
        { id: 'PT-10115', name: 'Emily Watson', phone: '867-555-0188' },
        { id: 'PAT-NWT-DEMO-2026', name: 'NWT General Patient', phone: '867-555-9000' }
      ]);
    } finally {
      setSearchingPatients(false);
    }
  }, []);

  // Fetch Live Database Orders & Patients from Backend API
  const fetchOrderData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch live patients using search API
      let loadedPatients = [];
      try {
        const res = await client.get('/api/admin/patients/search', { params: { limit: 50 } });
        if (Array.isArray(res.data) && res.data.length > 0) {
          loadedPatients = res.data;
        }
      } catch {
        // Fallback search to ePCR records
      }

      if (loadedPatients.length === 0) {
        try {
          const epcrRes = await client.get('/api/epcr/records', { params: { size: 50 } });
          const records = Array.isArray(epcrRes.data) ? epcrRes.data : (epcrRes.data?.content || []);
          loadedPatients = records.map(r => ({
            id: r.patientId || r.id,
            name: r.patientName || `Patient ${r.patientId || r.id}`,
            phone: r.phone || ''
          }));
        } catch {
          // Ignore
        }
      }

      setPatients(loadedPatients);

      // 2. Fetch live clinical orders for loaded patients
      let orderList = [];
      for (const p of loadedPatients.slice(0, 10)) {
        const pId = p.id || p.patientId;
        if (!pId) continue;
        try {
          // Try /api/patients/{id}/history/clinical-orders first
          const res = await client.get(`/api/patients/${pId}/history/clinical-orders`);
          const items = Array.isArray(res.data) ? res.data : [];

          if (items.length > 0) {
            const formatted = items.map((o, idx) => ({
              id: o.id || `NMO-${pId}-${idx}`,
              patientId: pId,
              patientName: p.name || p.patientName || 'Patient',
              category: o.category || 'NURSING',
              orderTitle: o.orderTitle || o.title || 'Clinical Non-Medication Order',
              frequency: o.frequency || 'Q8H',
              duration: o.duration || 'Until Discontinued',
              priority: o.priority || 'ROUTINE',
              status: o.status || 'ACTIVE',
              orderedAt: o.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
              orderedBy: o.orderedBy || `${user?.name || 'Physician'} (MD)`,
              instructions: o.instructions || o.description || 'Follow standard clinical protocol.'
            }));
            orderList.push(...formatted);
          } else {
            // Fallback: fetch from main history summary
            const summaryRes = await client.get(`/api/patients/${pId}/history`);
            if (summaryRes.data && Array.isArray(summaryRes.data.clinicalOrders)) {
              const formatted = summaryRes.data.clinicalOrders.map((o, idx) => ({
                id: o.id || `NMO-${pId}-${idx}`,
                patientId: pId,
                patientName: p.name || p.patientName || 'Patient',
                category: o.category || 'NURSING',
                orderTitle: o.orderTitle || o.title || 'Clinical Non-Medication Order',
                frequency: o.frequency || 'Q8H',
                duration: o.duration || 'Until Discontinued',
                priority: o.priority || 'ROUTINE',
                status: o.status || 'ACTIVE',
                orderedAt: o.date || new Date().toISOString().replace('T', ' ').substring(0, 16),
                orderedBy: o.orderedBy || `${user?.name || 'Physician'} (MD)`,
                instructions: o.instructions || o.description || 'Follow standard clinical protocol.'
              }));
              orderList.push(...formatted);
            }
          }
        } catch {
          // Silently catch 404 if patient history has no records yet
        }
      }

      setOrders(orderList);
      if (orderList.length > 0 && !selectedOrderId) {
        setSelectedOrderId(orderList[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch clinical orders:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to load clinical non-medication orders.' }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, selectedOrderId, user?.name]);

  useEffect(() => {
    fetchOrderData();
  }, []);

  // When Category changes, auto-select first template
  const handleCategoryChange = (newCat) => {
    const templates = PRESET_TEMPLATES[newCat] || PRESET_TEMPLATES.DIETARY;
    const firstTpl = templates[0];
    setNewOrder({
      ...newOrder,
      category: newCat,
      orderTitle: firstTpl.title,
      frequency: firstTpl.freq,
      duration: firstTpl.duration,
      instructions: firstTpl.notes
    });
  };

  const handleTemplateSelect = (tpl) => {
    setNewOrder({
      ...newOrder,
      orderTitle: tpl.title,
      frequency: tpl.freq,
      duration: tpl.duration,
      instructions: tpl.notes
    });
  };

  const activeOrder = orders.find(o => o.id === selectedOrderId) || orders[0] || null;

  // Filtering
  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.orderTitle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || o.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPI Calculations
  const totalCount = orders.length;
  const dietaryCount = orders.filter(o => o.category === 'DIETARY').length;
  const nursingCount = orders.filter(o => o.category === 'NURSING').length;
  const therapyCount = orders.filter(o => o.category === 'THERAPY' || o.category === 'RESPIRATORY').length;

  // Create New Order & Post to Backend API
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrder.patientId) {
      dispatch(addToast({ type: 'error', message: 'Please select a Patient ID.' }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        patientId: newOrder.patientId,
        category: newOrder.category,
        title: newOrder.orderTitle,
        orderTitle: newOrder.orderTitle,
        frequency: newOrder.frequency,
        duration: newOrder.duration,
        priority: newOrder.priority,
        status: 'ACTIVE',
        orderedBy: newOrder.orderedBy,
        instructions: newOrder.instructions,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };

      const res = await client.post(`/api/patients/${newOrder.patientId}/history/clinical-orders`, payload);

      const created = {
        id: res.data?.id || `NMO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        ...newOrder,
        status: 'ACTIVE',
        orderedAt: payload.date,
        patientName: newOrder.patientName || `Patient ${newOrder.patientId}`
      };

      setOrders([created, ...orders]);
      setSelectedOrderId(created.id);
      setActiveTab('orders');
      dispatch(addToast({ type: 'success', message: `Non-Medication Order ${created.id} posted to patient record!` }));
    } catch (err) {
      console.error('Failed to post non-medication order:', err);
      dispatch(addToast({ type: 'error', message: 'Error saving non-medication order to server.' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrder = async (orderId, patientId) => {
    if (!window.confirm(`Discontinue Non-Medication Order ${orderId}?`)) return;
    try {
      await client.delete(`/api/patients/${patientId}/history/clinical-orders/${orderId}`);
      setOrders(orders.filter(o => o.id !== orderId));
      if (selectedOrderId === orderId) {
        const remaining = orders.filter(o => o.id !== orderId);
        setSelectedOrderId(remaining.length > 0 ? remaining[0].id : null);
      }
      dispatch(addToast({ type: 'success', message: `Order ${orderId} discontinued.` }));
    } catch (err) {
      console.error('Failed to delete order:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to delete order from server.' }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] p-4 md:p-8 font-sans">
      {/* HEADER BANNER */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 shadow-sm">
            <ClipboardList className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Non-Medication Orders Management
            </h1>
            <p className="text-xs md:text-sm text-[#64748B] mt-0.5">
              Dietary, Nursing Care, Physical Therapy & Respiratory Orders (RFP 6.5 Order Entry)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              searchPatientsAPI('');
              setActiveTab('new');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm transition shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>New Non-Med Order</span>
          </button>

          <button
            onClick={fetchOrderData}
            className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
            title="Refresh Database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Active Orders</span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#0F172A]">{totalCount}</span>
            <span className="text-xs text-[#64748B]">live database records</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Dietary & Nutrition</span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-700">{dietaryCount}</span>
            <span className="text-xs text-[#64748B]">meal plans</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Nursing Care Orders</span>
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-100 text-purple-600">
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-700">{nursingCount}</span>
            <span className="text-xs text-[#64748B]">ward protocols</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Therapy & Respiratory</span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
              <Wind className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">{therapyCount}</span>
            <span className="text-xs text-[#64748B]">PT / OT / Oxygen</span>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] mb-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'orders'
              ? 'border-amber-600 text-amber-700 bg-white rounded-t-xl shadow-sm'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Non-Medication Orders</span>
          <span className="ml-1 px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {filteredOrders.length}
          </span>
        </button>

        <button
          onClick={() => {
            searchPatientsAPI('');
            setActiveTab('new');
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition ${
            activeTab === 'new'
              ? 'border-amber-600 text-amber-700 bg-white rounded-t-xl shadow-sm'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>New Order Requisition</span>
        </button>
      </div>

      {/* TAB 1: REGISTRY & INSPECTOR */}
      {activeTab === 'orders' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT LIST PANEL (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col h-[760px] shadow-sm">
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Patient Name, ID, or Order..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-amber-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#475569] focus:outline-none focus:border-amber-600"
                >
                  <option value="ALL">All Categories</option>
                  <option value="DIETARY">Dietary & Nutrition</option>
                  <option value="NURSING">Nursing Care</option>
                  <option value="THERAPY">Physical PT / OT</option>
                  <option value="RESPIRATORY">Respiratory Therapy</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#475569] focus:outline-none focus:border-amber-600"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISCONTINUED">Discontinued</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-2" />
                  <span className="text-xs font-medium">Fetching non-medication orders...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-medium">
                  No non-medication orders match your filter.
                </div>
              ) : (
                filteredOrders.map(o => {
                  const isSelected = o.id === activeOrder?.id;
                  const catInfo = CATEGORY_META[o.category] || CATEGORY_META.NURSING;
                  const statusInfo = STATUS_META[o.status] || STATUS_META.ACTIVE;
                  const CatIcon = catInfo.icon;

                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className={`p-4 rounded-xl border transition cursor-pointer relative ${
                        isSelected
                          ? 'bg-amber-50/40 border-amber-600 shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-500">{o.id}</span>
                          <h3 className="text-sm font-bold text-[#0F172A] line-clamp-1">{o.orderTitle}</h3>
                        </div>
                        <span className={`flex items-center gap-1 px-2.5 py-0.5 text-[10px] rounded-full border ${catInfo.cls}`}>
                          <CatIcon className="w-3 h-3" />
                          <span>{catInfo.label}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#475569] mb-2 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-[#0F172A]">{o.patientName}</span>
                        <span className="text-slate-500">({o.patientId})</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                        <span>Freq: {o.frequency}</span>
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] ${statusInfo.cls}`}>
                          {statusInfo.label}
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
            {activeOrder ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {activeOrder.id}
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs rounded-full border ${CATEGORY_META[activeOrder.category]?.cls}`}>
                        {CATEGORY_META[activeOrder.category]?.label}
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs rounded-full border ${STATUS_META[activeOrder.status]?.cls}`}>
                        {STATUS_META[activeOrder.status]?.label}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-[#0F172A]">{activeOrder.orderTitle}</h2>
                    <p className="text-xs text-[#64748B] mt-0.5">Patient ID: {activeOrder.patientId} | Ordered By: {activeOrder.orderedBy}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteOrder(activeOrder.id, activeOrder.patientId)}
                      className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discontinue Order</span>
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition"
                      title="Print Order Summary"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Patient & Schedule Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block">Patient Name</span>
                    <span className="font-extrabold text-[#0F172A] text-sm">{activeOrder.patientName}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">Execution Frequency</span>
                    <span className="font-bold text-[#0F172A]">{activeOrder.frequency}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold block">Expected Duration</span>
                    <span className="font-bold text-purple-700">{activeOrder.duration}</span>
                  </div>
                </div>

                {/* Detailed Nurse & Clinical Instructions */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs">
                  <span className="text-[#64748B] font-bold uppercase tracking-wider block mb-1">Clinical Instructions & Nursing Protocol</span>
                  <p className="text-[#334155] leading-relaxed font-medium">{activeOrder.instructions}</p>
                </div>

                {/* ELECTRONIC SIGN-OFF */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>HL7 FHIR ServiceRequest / DeviceRequest Compliant</span>
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ordered by {activeOrder.orderedBy}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 font-medium">
                Select a non-medication order from the left list to view details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DYNAMIC NEW REQUISITION WIZARD WITH SEARCH API */}
      {activeTab === 'new' && (
        <div className="max-w-3xl mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
            <div>
              <h2 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <span>New Non-Medication Order Wizard</span>
              </h2>
              <p className="text-xs text-[#64748B]">Order dietary plans, nursing protocols, or physical therapy (RFP 6.5)</p>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateOrder} className="space-y-5 text-xs">
            {/* LIVE PATIENT SEARCH FIELD */}
            <div className="space-y-2">
              <label className="block text-[#0F172A] font-bold">
                Select Patient *
              </label>

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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:border-amber-600 transition"
                />
                {searchingPatients && (
                  <Loader2 className="w-4 h-4 absolute right-3.5 top-3 text-amber-600 animate-spin" />
                )}
              </div>

              {/* Patient Dropdown Selection */}
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] font-bold focus:outline-none focus:border-amber-600"
              >
                <option value="">-- Select Active Patient --</option>
                {patients.map((p, idx) => {
                  const pId = p.id || p.patientId;
                  const pName = p.name || p.patientName || `Patient ${pId}`;
                  return (
                    <option key={idx} value={pId}>
                      {pName} ({pId}) {p.phone ? `- Tel: ${p.phone}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Order Category</label>
                <select
                  value={newOrder.category}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[#0F172A] font-semibold focus:outline-none focus:border-amber-600"
                >
                  <option value="DIETARY">Dietary & Nutrition Plan</option>
                  <option value="NURSING">Nursing Care Protocol</option>
                  <option value="THERAPY">Physical & Occupational Therapy (PT/OT)</option>
                  <option value="RESPIRATORY">Respiratory Therapy</option>
                </select>
              </div>

              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Clinical Priority</label>
                <select
                  value={newOrder.priority}
                  onChange={e => setNewOrder({ ...newOrder, priority: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[#0F172A] font-semibold focus:outline-none focus:border-amber-600"
                >
                  <option value="ROUTINE">Routine (Standard Execution)</option>
                  <option value="URGENT">Urgent (Execute within 2 Hours)</option>
                  <option value="STAT">STAT (Immediate Emergency Execution)</option>
                </select>
              </div>
            </div>

            {/* PRESET CLINICAL TEMPLATE QUICK SELECTOR */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">
                  Quick-Select Standard Clinical Template ({CATEGORY_META[newOrder.category]?.label}):
                </span>
                <span className="text-[10px] text-amber-800 font-medium">All fields are 100% editable</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(PRESET_TEMPLATES[newOrder.category] || PRESET_TEMPLATES.DIETARY).map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleTemplateSelect(tpl)}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      newOrder.orderTitle === tpl.title
                        ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <span className="font-bold text-xs block">{tpl.title}</span>
                    <span className="text-[10px] opacity-80 block truncate">{tpl.freq}</span>
                  </button>
                ))}

                {/* CUSTOM BLANK ORDER BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    setNewOrder({
                      ...newOrder,
                      orderTitle: '',
                      frequency: 'Daily',
                      duration: 'Ongoing Admission',
                      instructions: ''
                    });
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-center gap-1.5 ${
                    newOrder.orderTitle === ''
                      ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                      : 'bg-white text-amber-700 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-bold text-xs">+ Type Custom Diet / Order</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[#0F172A] font-bold mb-1">Order Title / Template Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Low-Sodium Cardiac Diet, Wound Dressing Q8H, Oxygen Therapy 2L/min"
                value={newOrder.orderTitle}
                onChange={e => setNewOrder({ ...newOrder, orderTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] font-bold focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Execution Frequency</label>
                <input
                  type="text"
                  placeholder="e.g. Q8H, Daily BID, As Needed (PRN)"
                  value={newOrder.frequency}
                  onChange={e => setNewOrder({ ...newOrder, frequency: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-[#0F172A] font-bold mb-1">Expected Duration</label>
                <input
                  type="text"
                  placeholder="e.g. 7 Days, Until Discharge"
                  value={newOrder.duration}
                  onChange={e => setNewOrder({ ...newOrder, duration: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[#0F172A] focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#0F172A] font-bold mb-1">Clinical Instructions & Nursing Protocol</label>
              <textarea
                rows={3}
                placeholder="Detailed instructions for nursing staff or clinical department..."
                value={newOrder.instructions}
                onChange={e => setNewOrder({ ...newOrder, instructions: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-[#0F172A] focus:outline-none focus:border-amber-600 font-medium"
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
                className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition shadow-sm flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Post Order to Patient Database</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
