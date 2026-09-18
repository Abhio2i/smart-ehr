import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FileText, ShieldCheck, AlertTriangle, CheckCircle2, Search, Plus,
  RefreshCw, DollarSign, Archive, Clock, CreditCard, ChevronRight, X,
  Trash2, FileSpreadsheet, Edit3, ArrowRight, Loader2, Download, Activity,
  Stethoscope, ShieldAlert, BadgeInfo, Check, Calendar, CheckSquare, Layers, Phone, Zap
} from 'lucide-react';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import CreateClaimModal from '../components/billing/CreateClaimModal';
import QuickPayModal from '../components/billing/QuickPayModal';
import { submitClaim, denyClaim, appealClaim, voidClaim } from '../api/billingApi';

// STATUS COLOR CONFIG
const STATUS_META = {
  DRAFT:     { label: 'Draft',      cls: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]',      dot: 'bg-[#64748B]',     icon: Edit3 },
  VALIDATED: { label: 'Validated',  cls: 'bg-[#EEF2FF] text-[#4F46E5] border-[#E0E7FF]',  dot: 'bg-[#6366F1]',    icon: ShieldCheck },
  SUBMITTED: { label: 'Submitted',  cls: 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]',    dot: 'bg-[#F59E0B]',    icon: Clock },
  PAID:      { label: 'Paid',       cls: 'bg-[#ECFDF5] text-[#059669] border-[#D1FAE5]', dot: 'bg-[#10B981]', icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',   cls: 'bg-[#FFF1F2] text-[#E11D48] border-[#FFE4E6]',          dot: 'bg-[#F43F5E]',       icon: AlertTriangle },
};

// PAYER PLAN METADATA
const PAYER_META = {
  SELF_PAY:              { label: 'Self-Pay / Cash (Direct Patient)', logo: '👤', code: 'PRIVATE', numPattern: 'N/A' },
  PRIVATE_INSURER:       { label: 'Private Health Insurance', logo: '💼', code: 'PRIVATE-INS', numPattern: 'Policy / Member ID' },
  NWT_HEALTH_CARE_PLAN: { label: 'Government Health Scheme', logo: '📜', code: 'GOV-SCHEME', numPattern: 'Ayushman / CGHS / State ID' },
  NWT_GOVT:              { label: 'NWT Health Care Plan (DHSS)', logo: '🍁', code: 'NWT-GOV', numPattern: 'NWT-#####-##' },
  RMBA_RECIPROCAL:       { label: 'Corporate / Reciprocal Plan', logo: '🏢', code: 'RECIP-CORP', numPattern: 'TPA & Corporate Billing' },
  HOME_PROVINCE:         { label: 'Reciprocal Provincial Plan', logo: '🗺️', code: 'RECIP-PROV', numPattern: 'XX-######### (e.g. AB-123456789)' },
  NIHB:                  { label: 'Federal NIHB Plan (ISC)', logo: '🪶', code: 'FED-NIHB', numPattern: 'Treaty / Client Number' },
};

const DEFAULT_DIAGNOSES = [
  { code: 'K02.9', description: 'Dental Caries / Tooth Decay, Unspecified' },
  { code: 'K05.3', description: 'Chronic Periodontitis / Plaque' },
  { code: 'K04.0', description: 'Pulpitis / Severe Toothache' },
  { code: 'R07.9', description: 'Chest Pain, Unspecified' },
  { code: 'R06.02', description: 'Shortness of Breath' },
  { code: 'I21.9', description: 'Acute Myocardial Infarction' }
];

const DEFAULT_FACILITIES = [
  { id: 'SMILE-CLINIC-01', name: 'SmileCare Dental & General Clinic' },
  { id: 'STH-01', name: 'Stanton Territorial Hospital (Yellowknife)' },
  { id: 'HRH-02', name: 'Hay River Regional Health Centre' },
  { id: 'YKH-03', name: 'Yellowknife Primary Care Centre' }
];

const DEFAULT_SERVICES = [
  { code: 'SUP-01', description: 'Oxygen therapy / airway management', rate: 75.00 },
  { code: 'DENT-CMP-01', description: 'Composite Filling (Tooth Restoration)', rate: 3000.00 },
  { code: 'DENT-SCL-01', description: 'Scaling and Polishing (Deep Cleaning)', rate: 2000.00 },
  { code: 'DENT-FLU-01', description: 'Fluoride Treatment', rate: 1500.00 },
  { code: 'DENT-CAR-01', description: 'Caries Treatment (per tooth)', rate: 1500.00 },
  { code: 'DENT-RCT-01', description: 'Single Sitting RCT (Root Canal Treatment)', rate: 4500.00 },
  { code: 'DENT-CON-01', description: 'Specialist Consultation Fee', rate: 800.00 },
  { code: 'AMB-IND-01', description: 'Ground Ambulance Transport Service', rate: 1200.00 },
  { code: 'MED-KIT-01', description: 'Prescribed Medical & Surgical Supplies', rate: 650.00 }
];

export default function ClaimsManagement() {
  const dispatch = useDispatch();
  const organizationId = useSelector(state => state.auth.user?.organizationId || 'org-default');
  
  // Tabs Navigation: 'claims' | 'batches' | 'schedule'
  const [activeTab, setActiveTab] = useState('claims');

  // User-friendly patient display helpers
  const getPatientName = (c) => {
    if (!c) return 'Patient';
    if (c.patientName && !c.patientName.startsWith('PAT-') && c.patientName !== 'Valued Patient') {
      return c.patientName;
    }
    if (c.patientId) {
      const cleanId = c.patientId.replace(/^PAT-/, '#');
      return `Patient ${cleanId}`;
    }
    return 'Registered Patient';
  };

  const getPatientInitials = (c) => {
    if (!c) return 'PT';
    if (c.patientName && !c.patientName.startsWith('PAT-') && c.patientName !== 'Valued Patient') {
      const parts = c.patientName.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0] ? parts[0].slice(0, 2).toUpperCase() : 'PT';
    }
    return 'PT';
  };

  // Database Data
  const [claims, setClaims] = useState([]);
  const [stats, setStats] = useState({ outstanding: 0, submittedPending: 0, paid: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [serviceCodes, setServiceCodes] = useState(DEFAULT_SERVICES);
  const [diagnoses, setDiagnoses] = useState(DEFAULT_DIAGNOSES);
  const [facilities, setFacilities] = useState(DEFAULT_FACILITIES);
  
  // Selection States
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeClaimId, setActiveClaimId] = useState(null); // Split-Screen Inspector Claim ID

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [payerFilter, setPayerFilter] = useState('ALL');
  
  // Inspector & Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    payerId: '',
    payerDetails: '',
    serviceLocation: '',
    icdCode: '',
    providerBillingNumber: '',
  });
  
  // Manual adding inputs inside Inspector
  const [addCode, setAddCode] = useState('');
  const [addQty, setAddQty] = useState(1);

  // Status Action States
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Submission Batches — loaded dynamically from backend
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  // Modal State for Manual Claim Generation & Pay QR Re-Open
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Razorpay Payment State for Existing Claims
  const [payingClaim, setPayingClaim] = useState(null);      // claim being paid
  const [payingInProgress, setPayingInProgress] = useState(false);
  const [paidConfirmInfo, setPaidConfirmInfo] = useState(null); // shows success screen

  const openRazorpayForClaim = async (claimToPay) => {
    const claimId = claimToPay.id || claimToPay.claimNumber;
    const amountRupees = claimToPay.totalAmount ?? claimToPay.totalCharged ?? 1;
    const pName = claimToPay.patientName || claimToPay.patientId || 'Patient';

    if (!window.Razorpay) {
      dispatch(addToast({ type: 'warning', message: 'Razorpay SDK not loaded. Please refresh and retry.' }));
      return;
    }

    setPayingInProgress(true);
    try {
      const orderRes = await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-order`);
      const orderData = orderRes?.data;
      if (!orderData || !orderData.orderId) {
        dispatch(addToast({ type: 'warning', message: '⚠️ Payment gateway not configured. Please setup Razorpay API keys in Provider Payments.' }));
        setPayingInProgress(false);
        return;
      }

      setPayingInProgress(false);
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Smart-eHR Medical Billing',
        description: `Bill #${claimToPay.claimNumber || claimId}`,
        order_id: orderData.orderId,
        prefill: { name: pName },
        handler: async function (response) {
          try {
            await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            setPaidConfirmInfo({
              patientName: pName,
              amount: amountRupees,
              claimNumber: claimToPay.claimNumber || claimId
            });
            dispatch(addToast({ type: 'success', message: '🎉 Payment done! Receipt emailed to patient.' }));
            loadClaims();
            loadStats();
          } catch (err) {
            dispatch(addToast({ type: 'error', message: 'Payment verification failed. Please contact support.' }));
          }
        },
        modal: {
          ondismiss: () => dispatch(addToast({ type: 'info', message: 'Payment window closed. Claim is still unpaid.' }))
        },
        theme: { color: '#1A3C8F' }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setPayingInProgress(false);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to open payment gateway';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };

  // APIs Loading
  const loadStats = useCallback(async () => {
    try {
      const res = await client.get('/api/billing/claims/stats', { params: { organizationId } });
      setStats(res.data || { outstanding: 0, submittedPending: 0, paid: 0, rejected: 0 });
    } catch (err) {
      console.error('Failed stats fetch:', err);
    }
  }, [organizationId]);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const [res, patientRes] = await Promise.all([
        client.get('/api/billing/claims', { params: { organizationId, page: 0, size: 200 } }),
        client.get('/api/admin/patients/search', { params: { query: '', limit: 100 } }).catch(() => ({ data: [] }))
      ]);

      const data = Array.isArray(res.data) ? res.data : (res.data?.content || []);
      const patientList = Array.isArray(patientRes.data) ? patientRes.data : [];

      const patientMap = {};
      patientList.forEach(p => {
        const pId = p.patientId || p.id;
        const name = p.displayName || p.patientName;
        if (pId && name && !name.startsWith('PAT-')) {
          patientMap[pId] = name;
        }
      });

      // Normalize: unify totalAmount and resolve real patient names
      const normalized = data.map(c => {
        let realName = c.patientName;
        if ((!realName || realName.startsWith('PAT-') || realName === 'Valued Patient') && c.patientId && patientMap[c.patientId]) {
          realName = patientMap[c.patientId];
        }
        return {
          ...c,
          patientName: realName,
          totalAmount: (() => {
            if (c.items && c.items.length > 0) {
              return c.items.reduce((acc, i) => acc + (i.total ?? ((i.unitPrice ?? 0) * (i.quantity ?? 1))), 0);
            }
            const raw = c.totalAmount ?? c.totalCharged ?? c.patientResponsibility ?? 0;
            return typeof raw === 'number' ? raw : parseFloat(raw) || 0;
          })(),
        };
      });

      setClaims(normalized);
      if (normalized.length > 0 && !activeClaimId) {
        setActiveClaimId(normalized[0].id);
      }
    } catch (err) {
      console.error('Failed claims fetch:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to load claims database.' }));
    } finally {
      setLoading(false);
    }
  }, [organizationId, activeClaimId, dispatch]);

  const loadServiceCodes = useCallback(async () => {
    try {
      const res = await client.get('/api/billing/claims/service-codes');
      const data = res.data && res.data.length > 0 ? res.data : DEFAULT_SERVICES;
      setServiceCodes(data);
      if (data.length > 0) {
        setAddCode(data[0].code);
      }
    } catch (err) {
      console.error('Failed to load service codes:', err);
      setServiceCodes(DEFAULT_SERVICES);
    }
  }, []);

  const loadDiagnoses = useCallback(async () => {
    try {
      const res = await client.get('/api/billing/claims/diagnostic-codes');
      setDiagnoses(res.data && res.data.length > 0 ? res.data : DEFAULT_DIAGNOSES);
    } catch (err) {
      console.error('Failed to load diagnoses:', err);
      setDiagnoses(DEFAULT_DIAGNOSES);
    }
  }, []);

  const loadFacilities = useCallback(async () => {
    try {
      const res = await client.get('/api/hl7/hospitals');
      setFacilities(res.data && res.data.length > 0 ? res.data : DEFAULT_FACILITIES);
    } catch (err) {
      console.error('Failed to load facilities:', err);
      setFacilities(DEFAULT_FACILITIES);
    }
  }, []);

  // (polling removed — Razorpay popup handles settlement inline)

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await client.get('/api/billing/claims/batches', { params: { organizationId } });
      setBatches(res.data || []);
    } catch (err) {
      // 404 = backend not yet restarted with new endpoint — silently skip
      if (err?.response?.status !== 404) {
        console.error('Failed to load batches:', err);
      }
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [organizationId]);

  const reloadAll = useCallback(() => {
    loadStats();
    loadClaims();
    loadServiceCodes();
    loadDiagnoses();
    loadFacilities();
    loadBatches();
  }, [loadStats, loadClaims, loadServiceCodes, loadDiagnoses, loadFacilities, loadBatches]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Active Claim item details selector
  const activeClaim = claims.find(c => c.id === activeClaimId) || null;

  // Filter calculations
  const filteredClaims = claims.filter(c => {
    if (c.status === 'VOID') return false;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesPayer = payerFilter === 'ALL' || c.payerId === payerFilter;
    const s = searchQuery.toLowerCase().trim();
    const matchesQuery = !s || 
      c.claimNumber?.toLowerCase().includes(s) || 
      c.patientId?.toLowerCase().includes(s) || 
      c.payerDetails?.toLowerCase().includes(s);
    return matchesStatus && matchesPayer && matchesQuery;
  });

  // Checkbox multi selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredClaims.filter(c => c.status === 'DRAFT' || c.status === 'VALIDATED').map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Perform card validation check
  const handleValidateCard = async (id) => {
    setIsValidating(true);
    try {
      await client.post(`/api/billing/claims/${id}/validate`);
      dispatch(addToast({ type: 'success', message: 'Coverage card validation check passed.' }));
      reloadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Incorrect card number format.';
      dispatch(addToast({ type: 'error', message: msg }));
      reloadAll();
    } finally {
      setIsValidating(false);
    }
  };

  // Submit single claim to carrier
  const handleSubmitSingleClaim = async (id) => {
    setIsSubmitting(true);
    try {
      await submitClaim(id);
      dispatch(addToast({ type: 'success', message: 'Claim submitted successfully to carrier clearinghouse.' }));
      reloadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit claim.';
      dispatch(addToast({ type: 'error', message: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deny claim with reason
  const handleDenySingleClaim = async (id) => {
    const reason = window.prompt('Enter reason for claim denial:', 'Ineligible patient card format or invalid service code');
    if (!reason) return;
    const code = window.prompt('Enter Denial Code:', 'DENY-CARD-400');

    try {
      await denyClaim(id, code || 'DENY-400', reason);
      dispatch(addToast({ type: 'info', message: 'Claim marked as DENIED.' }));
      reloadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to deny claim.';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };

  // Appeal denied claim
  const handleAppealSingleClaim = async (id) => {
    try {
      await appealClaim(id);
      dispatch(addToast({ type: 'success', message: 'Claim status updated to APPEALED.' }));
      reloadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to appeal claim.';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };

  // Permanently delete / void claim
  const handleDeleteClaim = async (target) => {
    const targetObj = typeof target === 'object' && target !== null ? target : (activeClaim && (activeClaim.id === target || activeClaim.claimNumber === target) ? activeClaim : null);
    const targetStatus = targetObj?.status || (claims.find(c => c.id === target || c.claimNumber === target)?.status);

    if (targetStatus === 'PAID') {
      dispatch(addToast({ type: 'error', message: 'Cannot delete a paid claim. Settled invoices must be retained for healthcare compliance.' }));
      return;
    }

    const claimId = typeof target === 'object' && target !== null 
      ? (target.id || target.claimNumber) 
      : (target || activeClaim?.id || activeClaim?.claimNumber);

    if (!claimId) {
      dispatch(addToast({ type: 'error', message: 'Unable to identify claim for deletion.' }));
      return;
    }

    if (!window.confirm(`Are you sure you want to delete claim #${claimId}?`)) return;

    try {
      await voidClaim(claimId);
      dispatch(addToast({ type: 'success', message: 'Claim permanently deleted.' }));
      setClaims(prev => prev.filter(c => c.id !== claimId && c.claimNumber !== claimId));
      if (activeClaimId === claimId || (activeClaim && (activeClaim.id === claimId || activeClaim.claimNumber === claimId))) {
        setActiveClaimId(null);
      }
      reloadAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete claim.';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };


  // Batch Submit selected
  const handleTransmitBatch = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await client.post('/api/billing/claims/batch-submit', { claimIds: selectedIds });
      const batchId = res.data.batchId;
      
      const batchSum = claims.filter(c => selectedIds.includes(c.id)).reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
      
      dispatch(addToast({ 
        type: 'success', 
        message: `Transmission successful! Created Batch ID: ${batchId}` 
      }));

      setBatches(prev => [
        { id: batchId, date: new Date().toISOString().replace('T', ' ').substring(0, 16), count: selectedIds.length, total: batchSum, status: 'TRANSMITTED', payer: claims.find(c => selectedIds.includes(c.id))?.payerId || 'NWT_GOVT' },
        ...prev
      ]);
      
      setSelectedIds([]);
      reloadAll();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Batch submission failed.' }));
    }
  };

  // Editing Claim actions
  const startEdit = () => {
    if (!activeClaim) return;
    setEditForm({
      payerId: activeClaim.payerId || 'SELF_PAY',
      payerDetails: activeClaim.payerDetails || '',
      providerBillingNumber: activeClaim.providerBillingNumber || 'DOC-SWATI-95600',
      facilityCode: activeClaim.facilityCode || 'SMILE-CLINIC-01',
      icdCode: activeClaim.icdCode || 'K02.9',
      items: activeClaim.items ? [...activeClaim.items] : []
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const computedTotal = (editForm.items || []).reduce((sum, i) => sum + (i.total || ((i.unitPrice || 0) * (i.quantity || 1))), 0);
      const payload = {
        ...editForm,
        totalAmount: computedTotal
      };
      await client.put(`/api/billing/claims/${activeClaim.id}`, payload);
      dispatch(addToast({ type: 'success', message: 'Claim invoice updated successfully.' }));
      setIsEditing(false);
      reloadAll();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: 'Failed to update claim details.' }));
    } finally {
      setIsSaving(false);
    }
  };

  // Manual code addition functions inside Edit Form
  const handleAddItem = () => {
    const list = serviceCodes.length > 0 ? serviceCodes : [
      { code: 'AMB-01', description: 'Ambulance Emergency Ground Transport', rate: 1500 },
      { code: 'EM-02', description: 'Emergency Triage & Assessment', rate: 850 },
      { code: 'MED-03', description: 'Advanced Airway & Paramedic Kit', rate: 450 },
      { code: 'CON-04', description: 'Specialist Physician Clinical Consultation', rate: 2000 }
    ];
    const targetCode = selectedAddCode || list[0].code;
    const matched = list.find(sc => sc.code === targetCode) || list[0];
    const unitRate = matched.rate || matched.unitPrice || 1500;

    setEditForm(prev => {
      const copy = [...prev.items];
      const existingIdx = copy.findIndex(item => item.serviceCode === matched.code);
      if (existingIdx > -1) {
        const item = { ...copy[existingIdx] };
        item.quantity += addQty;
        item.unitPrice = item.unitPrice || unitRate;
        item.total = item.quantity * item.unitPrice;
        copy[existingIdx] = item;
      } else {
        copy.push({
          serviceCode: matched.code,
          description: matched.description,
          quantity: addQty,
          unitPrice: unitRate,
          total: addQty * unitRate
        });
      }
      return { ...prev, items: copy };
    });
  };

  const handleRemoveItem = (index) => {
    setEditForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleEditItemQty = (index, qty) => {
    const val = Math.max(0, parseInt(qty) || 0);
    setEditForm(prev => {
      const copy = [...prev.items];
      if (val === 0) {
        return {
          ...prev,
          items: copy.filter((_, i) => i !== index)
        };
      }
      const target = { ...copy[index] };
      target.quantity = val;
      target.total = val * (target.unitPrice || 0);
      copy[index] = target;
      return { ...prev, items: copy };
    });
  };

  // Download XML batch file from backend
  const handleDownloadBatch = async (batchId) => {
    try {
      const res = await client.get(`/api/billing/claims/batches/${batchId}/xml`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batchId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      dispatch(addToast({ type: 'info', message: `Batch ${batchId} — XML export not yet available on this server.` }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex flex-col">
      
      {/* PROFESSIONAL ACTION HEADER */}
      <div className="bg-[#1A3C8F] text-white px-6 py-4 shadow-md shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#38BDF8] p-1 rounded-lg text-slate-900">
              <Stethoscope size={18} />
            </span>
            <h1 className="text-md font-bold tracking-tight">Smart-eHR Billing Portal</h1>
            <span className="bg-white/10 text-white/70 font-mono text-[9px] px-2 py-0.5 rounded border border-white/10">GNWT DEPT OF HEALTH & SOCIAL SERVICES</span>
          </div>
          <p className="text-[11px] text-white/70 mt-1">Reciprocal Billing Claims Validation Engine & Batch Dispatcher</p>
        </div>

        {/* Tab & Action Controls */}
        <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#38BDF8] hover:bg-sky-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Plus size={14} />
            New Claim
          </button>

          <div className="flex bg-[#132A6B] p-0.5 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('claims')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'claims' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              <CheckSquare size={13} />
              Audits & Claims
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'batches' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              <FileSpreadsheet size={13} />
              XML Transmission Logs ({batches.length})
            </button>
          </div>
        </div>

      </div>

      {/* TAB 1: CLAIMS AUDIT REGISTRY (SPLIT SCREEN WORKSPACE) */}
      {activeTab === 'claims' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 min-h-0">
          
          {/* LEFT 60%: TABLE & FILTERS */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            
            {/* KPI STATS BAR */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              {[
                { label: 'Draft Queue', value: stats.outstanding, filter: 'DRAFT',     icon: Edit3,       bg: 'bg-slate-50',   border: 'border-slate-200', iconBg: 'bg-slate-100',   iconColor: 'text-slate-500',   activeBorder: 'border-sky-400 ring-2 ring-sky-100' },
                { label: 'Awaiting Carrier', value: stats.submittedPending, filter: 'SUBMITTED', icon: Clock,  bg: 'bg-amber-50',   border: 'border-amber-200', iconBg: 'bg-amber-100',   iconColor: 'text-amber-500',   activeBorder: 'border-amber-400 ring-2 ring-amber-100' },
                { label: 'Paid & Settled', value: stats.paid, filter: 'PAID',           icon: CheckCircle2, bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',  activeBorder: 'border-emerald-400 ring-2 ring-emerald-100' },
                { label: 'Rejected', value: stats.rejected, filter: 'REJECTED',        icon: AlertTriangle,bg: 'bg-rose-50',    border: 'border-rose-200',   iconBg: 'bg-rose-100',    iconColor: 'text-rose-500',    activeBorder: 'border-rose-400 ring-2 ring-rose-100' },
              ].map(({ label, value, filter, icon: Icon, bg, border, iconBg, iconColor, activeBorder }) => (
                <div
                  key={filter}
                  onClick={() => setStatusFilter(prev => prev === filter ? 'ALL' : filter)}
                  className={`bg-white border rounded-xl p-4 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md ${
                    statusFilter === filter ? activeBorder : border
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider leading-tight">{label}</p>
                      <p className="text-2xl font-black text-[#0F172A] mt-1 leading-none">{value ?? 0}</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={iconColor} />
                    </div>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${iconBg.replace('bg-', 'bg-').replace('-100', '-400')}`}
                      style={{ width: `${Math.min(100, ((value ?? 0) / Math.max(1, (stats.outstanding || 0) + (stats.submittedPending || 0) + (stats.paid || 0) + (stats.rejected || 0))) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* FILTER SEARCH PANEL */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row gap-3 shadow-sm shrink-0">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-3 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Search by Claim # or patient ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#38BDF8] focus:bg-white"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={payerFilter}
                  onChange={e => setPayerFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg p-2 focus:outline-none focus:bg-white"
                >
                  <option value="ALL">All Carriers</option>
                  <option value="NWT_GOVT">NWT DHSS Plan</option>
                  <option value="HOME_PROVINCE">Reciprocal Billing</option>
                  <option value="NIHB">ISC Federal NIHB</option>
                  <option value="SELF_PAY">Self-Pay</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg p-2 focus:outline-none focus:bg-white"
                >
                  <option value="ALL">All States</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="VALIDATED">VALIDATED</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="PAID">PAID</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
            </div>

            {/* MAIN DATA TABLE VIEW */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
              
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-[#64748B] gap-2.5">
                  <Loader2 className="animate-spin text-brand-blue" size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Verifying Registry...</span>
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <Archive size={32} className="text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-[#0F172A]">No claims in this category</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Claims generate when an ePCR is QA approved.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[10px] font-bold text-[#64748B] uppercase tracking-wider sticky top-0 z-10">
                        <th className="py-3 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-[#CBD5E1] text-[#1A3C8F] focus:ring-brand-blue"
                            checked={
                              filteredClaims.length > 0 &&
                              filteredClaims
                                .filter(c => c.status === 'DRAFT' || c.status === 'VALIDATED')
                                .every(c => selectedIds.includes(c.id))
                            }
                            onChange={handleSelectAll}
                          />
                        </th>
                        <th className="py-3 px-3">Claim ID</th>
                        <th className="py-3 px-3">Patient Details</th>
                        <th className="py-3 px-3">Carrier Payer</th>
                        <th className="py-3 px-3 text-right">Fee</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredClaims.map(c => {
                        const meta = STATUS_META[c.status] || STATUS_META.DRAFT;
                        const payer = PAYER_META[c.payerId] || PAYER_META.SELF_PAY;
                        const isActive = activeClaimId === c.id;
                        return (
                          <tr
                            key={c.id}
                            onClick={() => { setActiveClaimId(c.id); setIsEditing(false); }}
                            className={`text-xs hover:bg-slate-50/80 transition-all cursor-pointer group ${
                              isActive ? 'bg-sky-50/60 border-l-[3px] border-[#0284C7]' : 'border-l-[3px] border-transparent'
                            }`}
                          >
                            {/* Selector */}
                            <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-[#1A3C8F] focus:ring-[#1A3C8F]"
                                checked={selectedIds.includes(c.id)}
                                onChange={() => handleSelectOne(c.id)}
                              />
                            </td>

                            {/* Claim ID */}
                            <td className="py-3 px-3">
                              <span className="font-mono text-[10px] font-bold text-[#1A3C8F] bg-blue-50 px-1.5 py-0.5 rounded">{c.claimNumber}</span>
                            </td>

                            {/* Patient Details */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[10px] font-black text-[#1A3C8F] shrink-0 shadow-sm">
                                  {getPatientInitials(c)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-slate-800 text-[11px] leading-tight truncate max-w-[130px]" title={getPatientName(c)}>
                                    {getPatientName(c)}
                                  </span>
                                  <span className="font-mono text-[9px] text-[#64748B] mt-0.5 leading-none">
                                    {c.patientId || '—'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Payer Plan */}
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                                {payer.logo} {payer.code}
                              </span>
                            </td>

                            {/* Fee amount */}
                            <td className="py-3 px-3 text-right">
                              <span className={`font-black text-[11px] ${ (c.totalAmount ?? 0) === 0 ? 'text-rose-400' : 'text-emerald-600' }`}>
                                ₹{(c.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${meta.cls}`}>
                                <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {c.status !== 'PAID' && (
                                  <button
                                    type="button"
                                    onClick={() => openRazorpayForClaim(c)}
                                    className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                                    title="Pay via Razorpay"
                                  >
                                    {payingInProgress ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
                                    Pay Now
                                  </button>
                                )}
                                {c.status === 'PAID' ? (
                                  <span className="p-1.5 inline-flex items-center gap-1 text-[10px] text-slate-300 font-bold cursor-not-allowed" title="Paid claims cannot be deleted for audit compliance">
                                    <ShieldCheck size={14} className="text-emerald-500/50" />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClaim(c)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                    title="Delete Claim"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT 40%: INLINE CLAIM INSPECTOR */}
          <div className="w-full lg:w-[380px] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
            
            {activeClaim ? (
              <div className="flex-1 flex flex-col min-h-0">
                
                {/* Inspector Header */}
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
                  <div>
                    <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider font-mono">Invoice Auditor</span>
                    <h2 className="text-xs font-black text-[#0F172A] mt-0.5">Claim Ref: <span className="font-mono text-brand-blue">{activeClaim.claimNumber}</span></h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && activeClaim.status === 'DRAFT' && (
                      <button
                        onClick={startEdit}
                        className="bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        Audit & Edit
                      </button>
                    )}
                    {activeClaim.status !== 'PAID' && (
                      <button
                        onClick={() => handleDeleteClaim(activeClaim)}
                        className="bg-rose-50 border border-rose-200 hover:bg-rose-600 hover:text-white text-rose-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="Permanently Delete Claim"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Inspector Details View */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  
                  {/* Warning banner for zero items */}
                  {(!activeClaim.items || activeClaim.items.length === 0) && !isEditing && (
                    <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl p-3 flex gap-2 text-[11px] text-[#B45309]">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Procedure Required</p>
                        <p className="opacity-90">No billing service codes are associated with this claim. Edit details to attach a standard code.</p>
                      </div>
                    </div>
                  )}

                  {/* Rejected Warning banner */}
                  {activeClaim.status === 'REJECTED' && !isEditing && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2 text-[11px] text-rose-700">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Card Format Rejection</p>
                        <p className="opacity-90">{activeClaim.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="space-y-3">

                      {/* Section 1: Payer / Insurance */}
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Payment / Insurance</p>
                        </div>
                        <div className="p-3 space-y-3">
                          {/* Carrier tiles */}
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'SELF_PAY',              label: 'Self-Pay',       icon: '👤', desc: 'Direct Cash / UPI / Card' },
                              { id: 'PRIVATE_INSURER',       label: 'Private Ins.',   icon: '💼', desc: 'Star Health / HDFC / Max' },
                              { id: 'NWT_HEALTH_CARE_PLAN', label: 'Govt Scheme',    icon: '�', desc: 'Ayushman / CGHS / State' },
                              { id: 'RMBA_RECIPROCAL',       label: 'Corporate TPA',  icon: '🏢', desc: 'TPA & Corporate Billing' },
                              { id: 'NWT_GOVT',              label: 'NWT Plan',       icon: '🍁', desc: 'NWT DHSS Coverage' },
                              { id: 'HOME_PROVINCE',         label: 'Provincial',     icon: '�️', desc: 'Reciprocal Provincial Plan' },
                              { id: 'NIHB',                  label: 'Fed NIHB',       icon: '🪶', desc: 'Indigenous Services' },
                            ].map(scheme => {
                              const isSelected = editForm.payerId === scheme.id;
                              return (
                                <button
                                  key={scheme.id}
                                  type="button"
                                  onClick={() => setEditForm(prev => ({ ...prev, payerId: scheme.id }))}
                                  className={`flex flex-col items-start text-left p-2.5 rounded-xl border text-[11px] transition-all duration-200 cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#1A3C8F]/10 border-[#1A3C8F] ring-1 ring-[#1A3C8F]'
                                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-extrabold text-[#0F172A] w-full">
                                    <span className="text-sm">{scheme.icon}</span>
                                    <span>{scheme.label}</span>
                                    {isSelected && <Check size={11} className="ml-auto text-[#1A3C8F]" />}
                                  </div>
                                  <span className="text-[9px] text-slate-500 mt-0.5">{scheme.desc}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Health card input */}
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-500">Health Card / Registration #</label>
                              <span className="text-[9px] font-mono font-bold text-[#1A3C8F] bg-blue-50 px-1.5 py-0.5 rounded">
                                {editForm.payerId === 'NWT_GOVT' ? 'NWT-12345-12' :
                                 editForm.payerId === 'HOME_PROVINCE' ? 'AB-123456789' :
                                 editForm.payerId === 'NIHB' ? 'Treaty Ref' :
                                 editForm.payerId === 'PRIVATE_INSURER' ? 'Policy ID' :
                                 editForm.payerId === 'NWT_HEALTH_CARE_PLAN' ? 'Govt Ref' :
                                 editForm.payerId === 'RMBA_RECIPROCAL' ? 'TPA Ref' : 'N/A'}
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={editForm.payerDetails}
                                onChange={e => setEditForm(prev => ({ ...prev, payerDetails: e.target.value }))}
                                placeholder={
                                  editForm.payerId === 'NWT_GOVT' ? 'NWT-#####-##' :
                                  editForm.payerId === 'HOME_PROVINCE' ? 'XX-#########' :
                                  editForm.payerId === 'NIHB' ? 'Enter federal treaty reference...' :
                                  editForm.payerId === 'PRIVATE_INSURER' ? 'Enter policy / membership card number...' :
                                  editForm.payerId === 'NWT_HEALTH_CARE_PLAN' ? 'Enter Govt health card / Ayushman ID...' :
                                  editForm.payerId === 'RMBA_RECIPROCAL' ? 'Enter TPA authorization reference...' : 'No card required'
                                }
                                disabled={editForm.payerId === 'SELF_PAY'}
                                className="w-full bg-white border border-slate-300 text-[11px] font-semibold text-slate-800 rounded-lg p-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-[#1A3C8F] disabled:bg-slate-100 disabled:text-slate-400"
                              />
                              {editForm.payerDetails && editForm.payerId !== 'SELF_PAY' && (
                                <div className="absolute right-3 top-2.5">
                                  {editForm.payerDetails.trim().length >= 3 ? (
                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                  ) : (
                                    <AlertTriangle size={14} className="text-amber-400" />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Clinical Context */}
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Clinical Context</p>
                        </div>
                        <div className="p-3 space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Primary Diagnosis (ICD-10)</label>
                            <select
                              value={editForm.icdCode}
                              onChange={e => setEditForm(prev => ({ ...prev, icdCode: e.target.value }))}
                              className="w-full bg-white border border-slate-300 text-[11px] font-semibold text-slate-800 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#1A3C8F]"
                            >
                              {diagnoses.map(d => (
                                <option key={d.code} value={d.code}>{d.code} — {d.description}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Service Location / Facility</label>
                            <select
                              value={editForm.facilityCode}
                              onChange={e => setEditForm(prev => ({ ...prev, facilityCode: e.target.value }))}
                              className="w-full bg-white border border-slate-300 text-[11px] font-semibold text-slate-800 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#1A3C8F]"
                            >
                              {facilities.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">Provider Billing # / Doctor ID</label>
                            <input
                              type="text"
                              value={editForm.providerBillingNumber || ''}
                              onChange={e => setEditForm(prev => ({ ...prev, providerBillingNumber: e.target.value }))}
                              placeholder="e.g. DOC-SWATI-95600 or YK-883492"
                              className="w-full bg-white border border-slate-300 text-[11px] font-semibold text-slate-800 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-[#1A3C8F]"
                            />
                          </div>
                        </div>
                      </div>



                      {/* Save / Cancel */}
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          onClick={cancelEdit}
                          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={isSaving}
                          className="bg-[#1A3C8F] hover:bg-[#153278] text-white text-[11px] font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Save Changes
                        </button>
                      </div>

                    </div>
                  ) : (
                    // READ ONLY INSPECTOR — USER-FRIENDLY REDESIGN
                    <div className="space-y-3">

                      {/* Patient Card */}
                      <div className="bg-gradient-to-r from-blue-50 to-slate-50 rounded-xl border border-blue-100 p-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#1A3C8F] flex items-center justify-center text-sm font-black text-white shrink-0 shadow-md">
                          {getPatientInitials(activeClaim)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-[#0F172A] truncate">
                            {getPatientName(activeClaim)}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500 mt-0.5">{activeClaim.patientId || '—'}</p>
                          {activeClaim.patientPhone && (
                            <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                              <Phone size={9} /> {activeClaim.patientPhone}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Amount</p>
                          <p className={`text-base font-black mt-0.5 ${(activeClaim.totalAmount ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            ₹{(activeClaim.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Claim Details Grid */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Claim Details</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          
                          {/* Insurance Carrier */}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Insurance Carrier</span>
                            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                              {PAYER_META[activeClaim.payerId]?.logo} {PAYER_META[activeClaim.payerId]?.label || activeClaim.payerId || 'Self-Pay'}
                            </span>
                          </div>

                          {/* Health Card */}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Health Card / Ref #</span>
                            {activeClaim.payerDetails ? (
                              <span className="font-mono text-[11px] font-bold text-[#1A3C8F]">{activeClaim.payerDetails}</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not Set</span>
                            )}
                          </div>

                          {/* ICD-10 */}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">ICD-10 Diagnosis</span>
                            {activeClaim.icdCode ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={9} /> {activeClaim.icdCode}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 italic">Needs Review</span>
                            )}
                          </div>
                          {activeClaim.icdCode && diagnoses.find(d => d.code === activeClaim.icdCode) && (
                            <div className="px-4 py-1.5 bg-slate-50/60">
                              <p className="text-[10px] text-slate-500 italic">{diagnoses.find(d => d.code === activeClaim.icdCode)?.description}</p>
                            </div>
                          )}

                          {/* Service Location */}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Service Location</span>
                            {activeClaim.facilityCode ? (
                              <span className="text-[10px] font-bold text-slate-700">
                                {facilities.find(f => f.id === activeClaim.facilityCode)?.name || activeClaim.facilityCode}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not Assigned</span>
                            )}
                          </div>

                          {/* Provider */}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Provider Billing #</span>
                            {activeClaim.providerBillingNumber ? (
                              <span className="font-mono text-[10px] font-semibold text-slate-700">{activeClaim.providerBillingNumber}</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Not Set</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Invoice Ledger */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Invoice Ledger</p>
                          <span className="text-[10px] font-bold text-slate-400">{activeClaim.items?.length || 0} line item{(activeClaim.items?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>

                        {activeClaim.items && activeClaim.items.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {activeClaim.items.map((item, index) => (
                              <div key={index} className="px-4 py-2.5 flex justify-between items-center gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-slate-800 leading-tight truncate">{item.description}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{item.serviceCode}</span>
                                    <span className="text-[9px] text-slate-400">qty {item.quantity} × ₹{item.unitPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                                <span className="font-black text-[13px] text-emerald-700 shrink-0">₹{item.total?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                            <div className="bg-[#1A3C8F] text-white px-4 py-3 flex justify-between items-center">
                              <span className="text-[11px] font-bold opacity-80">Total Billed (INR)</span>
                              <span className="text-base font-black">₹{(activeClaim.totalAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 flex flex-col items-center justify-center text-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                              <AlertTriangle size={16} className="text-slate-400" />
                            </div>
                            <p className="text-xs font-bold text-slate-600">No Procedures Attached</p>
                            <p className="text-[10px] text-slate-400 max-w-[180px]">Click <strong>Audit & Edit</strong> above to attach billing service codes and generate the invoice total.</p>
                          </div>
                        )}
                      </div>

                      {/* Audit Trail */}
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Audit Trail</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Created</span>
                            <span className="font-bold text-[10px] text-slate-700">
                              {activeClaim.createdAt ? new Date(activeClaim.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </div>
                          {activeClaim.submittedAt && (
                            <div className="px-4 py-2.5 flex justify-between items-center">
                              <span className="text-[10px] text-slate-500 font-semibold">Submitted</span>
                              <span className="font-bold text-[10px] text-indigo-600">
                                {new Date(activeClaim.submittedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          {activeClaim.batchId && (
                            <div className="px-4 py-2.5 flex justify-between items-center">
                              <span className="text-[10px] text-slate-500 font-semibold">Batch ID</span>
                              <span className="font-mono text-[10px] font-bold text-slate-700">{activeClaim.batchId}</span>
                            </div>
                          )}
                          <div className="px-4 py-2.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 font-semibold">Patient Ref</span>
                            <span className="font-mono text-[10px] font-bold text-slate-600">{activeClaim.patientId || '—'}</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

                {/* Inspector Footer Actions */}
                {!isEditing && (
                  <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap justify-between items-center gap-2 shrink-0">
                    {/* Delete button for all non-PAID claims */}
                    {activeClaim.status !== 'PAID' ? (
                      <button
                        onClick={() => handleDeleteClaim(activeClaim.id || activeClaim.claimNumber)}
                        className="border border-rose-200 hover:bg-rose-50 text-rose-600 text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        <Trash2 size={11} />
                        Delete Claim
                      </button>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2">
                      {/* Validate eligibility */}
                      {(activeClaim.status === 'DRAFT' || activeClaim.status === 'REJECTED') && (
                        <button
                          onClick={() => handleValidateCard(activeClaim.id)}
                          disabled={isValidating}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          {isValidating && <Loader2 size={11} className="animate-spin" />}
                          Verify Card
                        </button>
                      )}

                      {/* Status Transition Action Buttons */}
                      {(activeClaim.status === 'DRAFT' || activeClaim.status === 'VALIDATED') && (
                        <button
                          onClick={() => handleSubmitSingleClaim(activeClaim.id)}
                          disabled={isSubmitting}
                          className="bg-[#1A3C8F] hover:bg-[#153278] text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer hover:scale-105"
                        >
                          {isSubmitting ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                          Submit to Payer
                        </button>
                      )}

                      {activeClaim.status === 'SUBMITTED' && (
                        <button
                          onClick={() => handleDenySingleClaim(activeClaim.id)}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <AlertTriangle size={11} />
                          Mark Denied
                        </button>
                      )}

                      {(activeClaim.status === 'DENIED' || activeClaim.status === 'REJECTED') && (
                        <button
                          onClick={() => handleAppealSingleClaim(activeClaim.id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                        >
                          <RefreshCw size={11} />
                          Submit Appeal
                        </button>
                      )}
                    </div>
                  </div>
                )}


              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-2.5">
                <FileText size={36} className="text-slate-300" />
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">No Claim Selected</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Select an entry from the list on the left to audit or validate details.</p>
                </div>
              </div>
            )}

          </div>

          {/* STICKY BATCH TRANSMIT BAR */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#0F172A] text-white shadow-2xl rounded-2xl px-6 py-4 flex items-center justify-between gap-8 z-40 animate-slide-up w-[90%] max-w-2xl border border-slate-800">
              <div>
                <p className="text-xs font-black text-white">{selectedIds.length} Claim{selectedIds.length > 1 ? 's' : ''} Selected for Batch</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Ready to compile into reciprocal billing batch file.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds([])}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] px-3 py-2 rounded-xl cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleTransmitBatch}
                  className="bg-[#38BDF8] hover:bg-sky-400 text-slate-950 font-bold text-[10px] px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  Transmit Submission Batch
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: BATCH SUBMISSIONS LOG VIEW */}
      {activeTab === 'batches' && (
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          <div className="max-w-4xl mx-auto space-y-4">
            
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-black text-[#0F172A] flex items-center gap-1.5">
                <FileSpreadsheet className="text-indigo-500" size={16} />
                Reciprocal Billing Electronic Batch Transfers
              </h2>
              <p className="text-xs text-[#64748B] mt-1">
                Submissions generated and transmitted to the Territorial Healthcare Clearinghouse (NWT DHSS and Alberta Netcare integration nodes).
              </p>
            </div>

            {batchesLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-xs font-bold">Loading transmission logs...</span>
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                <FileSpreadsheet size={32} className="text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No Batch Transmissions Yet</p>
                <p className="text-[10px] text-slate-400">Transmit validated claims to generate a batch record.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {batches.map(b => (
                  <div key={b.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[11px] font-bold text-[#1A3C8F] bg-blue-50 px-2 py-0.5 rounded">{b.id}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          b.status === 'TRANSMITTED' ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'bg-[#ECFDF5] text-[#059669]'
                        }`}>{b.status}</span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 font-semibold">
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Carrier / Payer</span>
                          <span className="font-bold">{PAYER_META[b.payer]?.logo} {PAYER_META[b.payer]?.code || b.payer}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Transmission Date</span>
                          <span>{b.date || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Claim Count</span>
                          <span className="font-black text-[#0F172A]">{b.count} record{b.count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-100 pt-1.5 mt-1">
                          <span className="text-[#64748B]">Total Billed</span>
                          <span className="font-extrabold text-emerald-700">${(b.total ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadBatch(b.id)}
                      className="w-full mt-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 p-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      <Download size={13} className="text-[#64748B]" /> Download Claims XML Data File
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* CREATE CLAIM MODAL */}
      <CreateClaimModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => reloadAll()}
      />

      {/* RAZORPAY PAYMENT SUCCESS CONFIRMATION */}
      {paidConfirmInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-[#DDE3F0] text-center p-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                🎉 Payment Received & Settled
              </span>
              <p className="text-3xl font-black text-[#0F1A3A] mt-3">
                ₹{Number(paidConfirmInfo.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {paidConfirmInfo.patientName} • Bill #{paidConfirmInfo.claimNumber}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left text-xs text-emerald-800 space-y-1">
              <p className="font-bold flex items-center gap-1"><CheckCircle2 size={14} /> Payment Verified!</p>
              <p className="text-[11px] text-emerald-700">
                • Official receipt emailed to patient.<br />
                • Doctor payment split processed automatically.
              </p>
            </div>
            <button
              onClick={() => setPaidConfirmInfo(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold shadow-md"
            >
              ✓ Done — Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}


