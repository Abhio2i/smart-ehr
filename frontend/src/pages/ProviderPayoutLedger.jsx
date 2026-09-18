import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectRole } from '../store/slices/authSlice';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { 
  Coins, Plus, Calendar, User, DollarSign, FileSpreadsheet, Lock, BookOpen, HelpCircle, X, ExternalLink, CheckCircle2, 
  Unlock, Eye, Sparkles, Stethoscope, Briefcase, Activity, CheckSquare, Hourglass, Trash2, Edit
} from 'lucide-react';

// Status Color Mapping matching existing EHR styles
const STATUS_META = {
  PENDING_REVIEW: { label: 'Pending Review', cls: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
  APPROVED:       { label: 'Approved',       cls: 'bg-blue-50 text-blue-600 border-blue-200',   dot: 'bg-blue-500' },
  PAID:           { label: 'Paid & Settled',  cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-600' },
  REJECTED:       { label: 'Rejected',       cls: 'bg-rose-50 text-rose-600 border-rose-200',   dot: 'bg-rose-500' }
};

export default function ProviderPayoutLedger() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';
  const isAdmin = role === 'ADMIN';

  // Multi-tenant organization selection
  const [selectedOrgId, setSelectedOrgId] = useState(user?.organizationId || '');
  const [organizations, setOrganizations] = useState([]);

  // Fetch real live organizations from backend
  useEffect(() => {
    if (isAdminOrManager) {
      client.get('/api/organizations')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.content || []);
          if (list && list.length > 0) {
            setOrganizations(list);
            if (!selectedOrgId) {
              setSelectedOrgId(user?.organizationId || list[0].id || list[0].code || 'org-nwt-ems-demo-001');
            }
          }
        })
        .catch(err => console.warn('Could not load organizations list:', err));
    }
  }, [isAdminOrManager, user?.organizationId]);

  const activeOrgObj = organizations.find(o => o.id === selectedOrgId || o.code === selectedOrgId);
  const activeOrgName = user?.organizationName || activeOrgObj?.name || activeOrgObj?.code || selectedOrgId || 'Default Organization';

  // State Management
  const [payouts, setPayouts] = useState([]);
  const [rates, setRates] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('payouts'); // payouts | shifts | rates
  const [selectedPayout, setSelectedPayout] = useState(null);

  // Active providers (fetched for dropdowns)
  const [providers, setProviders] = useState([]);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Overrides list state for user-friendly configuration
  const [overrideRows, setOverrideRows] = useState([]);

  // Active shift clock state
  const [activeShift, setActiveShift] = useState(null);
  const [clockTimer, setClockTimer] = useState('');

  // Modals States
  const [showRateModal, setShowRateModal] = useState(false);
  const [gatewayConfig, setGatewayConfig] = useState({
    provider: 'RAZORPAY',
    keyId: '',
    keySecret: '',
    webhookSecret: '',
    merchantId: '',
    razorpayxAccountNumber: '',
    active: false
  });
  const [doctorAccounts, setDoctorAccounts] = useState([]);
  const [showDoctorAccountModal, setShowDoctorAccountModal] = useState(false);
  const [doctorAccountForm, setDoctorAccountForm] = useState({
    doctorUserId: '',
    doctorName: '',
    accountType: 'BANK_ACCOUNT',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    linkedAccountRef: '',
    commissionPercent: 15.0
  });
  const [rateForm, setRateForm] = useState({
    providerId: '',
    providerRole: 'PHYSICIAN',
    paymentType: 'FEE_FOR_SERVICE',
    baseRate: 0.0,
    feePerProcedure: 0.0,
    effectiveFrom: new Date().toISOString().split('T')[0]
  });

  const [showGenModal, setShowGenModal] = useState(false);
  const [genForm, setGenForm] = useState({
    providerId: '',
    periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0]
  });

  const [showManualShiftModal, setShowManualShiftModal] = useState(false);
  const [manualShiftForm, setManualShiftForm] = useState({
    providerId: '',
    start: new Date().toISOString().slice(0, 16),
    end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
  });

  const getProviderName = (providerId) => {
    if (providerId === user?.id) {
      return `${user.firstName} ${user.lastName}`;
    }
    const matched = providers.find(p => p.id === providerId);
    return matched ? `${matched.firstName} ${matched.lastName}` : providerId;
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoStr.replace('T', ' ').split('.')[0];
    }
  };

  const formatHours = (hours) => {
    if (hours == null) return '0.00 hrs';
    if (hours < 0.1 && hours > 0) {
      const mins = Math.round(hours * 60);
      return `${hours.toFixed(2)} hrs (${mins} ${mins === 1 ? 'min' : 'mins'})`;
    }
    return `${hours.toFixed(2)} hrs`;
  };

  const fetchProviders = async () => {
    if (!selectedOrgId) return;
    try {
      const res = await client.get(`/api/users/organization/${selectedOrgId}`, { params: { size: 100 } });
      const content = res.data?.content || [];
      const filtered = content.filter(u => u.role === 'PHYSICIAN' || u.role === 'PARAMEDIC');
      setProviders(filtered);
      
      if (filtered.length > 0) {
        setRateForm(prev => ({
          ...prev,
          providerId: filtered[0].id,
          providerRole: filtered[0].role
        }));
        setGenForm(prev => ({
          ...prev,
          providerId: filtered[0].id
        }));
      }
    } catch (e) {
      console.error('Failed to load active providers list:', e);
    }
  };

  const fetchActiveShift = async () => {
    try {
      const res = await client.get('/api/billing/payouts/shifts/active');
      setActiveShift(res.data);
    } catch (e) {
      setActiveShift(null);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isAdminOrManager) {
        const [payoutsRes, ratesRes, shiftsRes] = await Promise.all([
          client.get('/api/billing/payouts', { params: { organizationId: selectedOrgId } }),
          client.get('/api/billing/payouts/rates', { params: { organizationId: selectedOrgId } }),
          client.get('/api/billing/payouts/shifts', { params: { organizationId: selectedOrgId } })
        ]);
        setPayouts(payoutsRes.data || []);
        setRates(ratesRes.data || []);
        setShifts(shiftsRes.data || []);
      } else {
        const [payoutsRes, shiftsRes, rateRes] = await Promise.all([
          client.get('/api/billing/payouts/me'),
          client.get(`/api/billing/payouts/shifts/provider/${user.id}`),
          client.get(`/api/billing/payouts/rates/provider/${user.id}`).catch(() => ({ data: null }))
        ]);
        setPayouts(payoutsRes.data || []);
        setShifts(shiftsRes.data || []);
        setRates(rateRes.data ? [rateRes.data] : []);
      }
    } catch (error) {
      console.error('Error fetching provider payouts:', error);
      dispatch(addToast({ type: 'error', message: 'Failed to load payroll database.' }));
    } finally {
      setLoading(false);
    }
  };

  const fetchGatewayConfig = async () => {
    try {
      const res = await client.get('/api/payments/gateway-config', { params: { organizationId: selectedOrgId } });
      if (res.data && res.data.active && res.data.keyId) {
        setGatewayConfig(res.data);
      } else {
        setGatewayConfig({ provider: 'RAZORPAY', keyId: '', keySecret: '', webhookSecret: '', merchantId: '', active: false });
      }
    } catch (e) {
      console.warn('Gateway config not set:', e);
      setGatewayConfig({ provider: 'RAZORPAY', keyId: '', keySecret: '', webhookSecret: '', merchantId: '', active: false });
    }
  };

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [payoutTxList, setPayoutTxList] = useState([]);

  const fetchPayoutTransactions = async () => {
    try {
      const res = await client.get('/api/payments/payout-transactions', { params: { organizationId: selectedOrgId } });
      if (res.data) setPayoutTxList(res.data);
    } catch (e) {
      console.warn('Failed to load payout transactions:', e);
    }
  };

  const fetchDoctorAccounts = async () => {
    try {
      const res = await client.get('/api/payments/doctor-accounts', { params: { organizationId: selectedOrgId } });
      if (res.data) setDoctorAccounts(res.data);
    } catch (e) {
      console.warn('Failed to load doctor payment accounts:', e);
    }
  };

  const handleSaveGatewayConfig = async (e) => {
    e.preventDefault();
    try {
      await client.post('/api/payments/gateway-config', { ...gatewayConfig, organizationId: selectedOrgId });
      dispatch(addToast({ type: 'success', message: `Payment Gateway saved for ${activeOrgName}!` }));
      fetchGatewayConfig();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to save gateway config.' }));
    }
  };

  const [editingDoctorAccount, setEditingDoctorAccount] = useState(null);

  const handleEditDoctorAccount = (acc) => {
    setEditingDoctorAccount(acc);
    setDoctorAccountForm({
      doctorUserId: acc.doctorUserId || '',
      doctorName: acc.doctorName || '',
      accountType: acc.accountType || 'BANK_ACCOUNT',
      accountNumber: acc.accountNumber || '',
      ifscCode: acc.ifscCode || '',
      upiId: acc.upiId || '',
      linkedAccountRef: acc.linkedAccountRef || '',
      commissionPercent: acc.commissionPercent || 15.0
    });
    setShowDoctorAccountModal(true);
  };

  const handleDeleteDoctorAccount = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor agreed payment account?')) return;
    try {
      await client.delete(`/api/payments/doctor-accounts/${id}`);
      dispatch(addToast({ type: 'success', message: 'Doctor payout account deleted successfully.' }));
      fetchDoctorAccounts();
    } catch (e) {
      console.error('Failed to delete doctor account:', e);
      dispatch(addToast({ type: 'error', message: 'Failed to delete doctor payout account.' }));
    }
  };

  const handleSaveDoctorAccount = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctorAccount && editingDoctorAccount.id) {
        await client.put(`/api/payments/doctor-accounts/${editingDoctorAccount.id}`, { ...doctorAccountForm, organizationId: selectedOrgId });
        dispatch(addToast({ type: 'success', message: 'Doctor payout account updated!' }));
      } else {
        await client.post('/api/payments/doctor-accounts', { ...doctorAccountForm, organizationId: selectedOrgId });
        dispatch(addToast({ type: 'success', message: 'Doctor payout account saved successfully!' }));
      }
      setShowDoctorAccountModal(false);
      setEditingDoctorAccount(null);
      fetchDoctorAccounts();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to save doctor payout account.' }));
    }
  };

  const handleTriggerInstantPayout = async (acc) => {
    if (!acc.upiId && acc.accountType !== 'UPI') {
      dispatch(addToast({ type: 'error', message: 'Doctor has no active UPI ID linked.' }));
      return;
    }
    const targetUpi = acc.upiId || 'doctor@upi';
    const claimNum = window.prompt(`Execute Instant UPI Payout to ${acc.doctorName || 'Doctor'} (${targetUpi})\n\nEnter Claim Number (e.g. CLM-2026-0001):`);
    if (!claimNum || !claimNum.trim()) return;

    try {
      const res = await client.post(`/api/payments/doctor-accounts/${acc.id}/payout`, {
        claimNumber: claimNum.trim()
      });
      dispatch(addToast({ 
        type: 'success', 
        message: res.data?.message || `Instant UPI Payout executed! ID: ${res.data?.payoutId}` 
      }));
      fetchPayoutTransactions();
    } catch (e) {
      dispatch(addToast({ 
        type: 'error', 
        message: e.response?.data?.message || 'Instant UPI Payout failed.' 
      }));
    }
  };

  useEffect(() => {
    fetchData();
    fetchActiveShift();
    if (isAdminOrManager) {
      fetchProviders();
      fetchGatewayConfig();
      fetchDoctorAccounts();
      fetchPayoutTransactions();
    }
  }, [isAdminOrManager, selectedOrgId]);

  // Clock in / out handlers
  const handleClockIn = async () => {
    try {
      const res = await client.post('/api/billing/payouts/shifts/clock-in');
      setActiveShift(res.data);
      dispatch(addToast({ type: 'success', message: 'Shift started! Clocked in successfully.' }));
      fetchData();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to clock in.' }));
    }
  };

  const handleClockOut = async () => {
    try {
      await client.post('/api/billing/payouts/shifts/clock-out');
      setActiveShift(null);
      dispatch(addToast({ type: 'success', message: 'Shift ended! Clocked out successfully.' }));
      fetchData();
    } catch (e) {
      dispatch(addToast({ type: 'error', message: 'Failed to clock out.' }));
    }
  };

  const handleLogManualShift = async (e) => {
    e.preventDefault();
    try {
      await client.post('/api/billing/payouts/shifts/manual', null, {
        params: {
          providerId: manualShiftForm.providerId,
          start: manualShiftForm.start + ':00',
          end: manualShiftForm.end + ':00'
        }
      });
      dispatch(addToast({ type: 'success', message: 'Manual shift logged successfully!' }));
      setShowManualShiftModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      dispatch(addToast({ type: 'error', message: 'Failed to log manual shift.' }));
    }
  };

  // Clock elapsed timer ticker
  useEffect(() => {
    if (!activeShift?.shiftStart) {
      setClockTimer('');
      return;
    }
    const updateTimer = () => {
      const start = new Date(activeShift.shiftStart);
      const now = new Date();
      const diffMs = now - start;
      if (diffMs < 0) return;
      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setClockTimer(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  // Handle Provider Selection inside Rate Configuration Form
  const handleProviderSelectChange = (providerId) => {
    const matched = providers.find(p => p.id === providerId);
    setRateForm(prev => ({
      ...prev,
      providerId,
      providerRole: matched ? matched.role : prev.providerRole
    }));
  };

  // Overrides list helpers
  const addOverrideRow = () => {
    setOverrideRows([...overrideRows, { sourceType: 'SURGICAL_CASE', rate: 0.0 }]);
  };

  const updateOverrideRow = (index, field, value) => {
    const copy = [...overrideRows];
    copy[index][field] = value;
    setOverrideRows(copy);
  };

  const removeOverrideRow = (index) => {
    setOverrideRows(overrideRows.filter((_, i) => i !== index));
  };

  // Calculations triggers
  const handleGeneratePayout = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post('/api/billing/payouts/generate', null, {
        params: {
          providerId: genForm.providerId,
          periodStart: genForm.periodStart,
          periodEnd: genForm.periodEnd,
          organizationId: orgId
        }
      });
      dispatch(addToast({ type: 'success', message: 'Payout sheet generated successfully!' }));
      setShowGenModal(false);
      fetchData();
      if (res.data) setSelectedPayout(res.data);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || error.response?.data || 'No closed shifts found in timeframe.';
      dispatch(addToast({ type: 'error', message: `Generation failed: ${msg}` }));
    }
  };

  const handleCreateRate = async (e) => {
    e.preventDefault();
    try {
      const overridesMap = {};
      overrideRows.forEach(row => {
        if (row.sourceType) {
          overridesMap[row.sourceType] = parseFloat(row.rate) || 0.0;
        }
      });

      await client.post('/api/billing/payouts/rates', {
        ...rateForm,
        procedureRateOverrides: overridesMap,
        organizationId: orgId
      });
      dispatch(addToast({ type: 'success', message: 'Payment rate configured successfully!' }));
      setShowRateModal(false);
      fetchData();
    } catch (error) {
      console.error(error);
      dispatch(addToast({ type: 'error', message: 'Failed to configure payment rate.' }));
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await client.put(`/api/billing/payouts/${id}/approve`);
      dispatch(addToast({ type: 'success', message: 'Payout approved for payment release.' }));
      setPayouts(payouts.map(p => p.id === id ? res.data : p));
      if (selectedPayout?.id === id) setSelectedPayout(res.data);
    } catch (error) {
      dispatch(addToast({ type: 'error', message: 'Approval failed.' }));
    }
  };

  const handleMarkPaid = async (id) => {
    try {
      const res = await client.put(`/api/billing/payouts/${id}/mark-paid`);
      dispatch(addToast({ type: 'success', message: 'Payout marked as PAID & SETTLED.' }));
      setPayouts(payouts.map(p => p.id === id ? res.data : p));
      if (selectedPayout?.id === id) setSelectedPayout(res.data);
    } catch (error) {
      dispatch(addToast({ type: 'error', message: 'Payment marking failed.' }));
    }
  };

  const handleDeletePayout = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payroll report? This will unlock associated shift logs.')) return;
    try {
      await client.delete(`/api/billing/payouts/${id}`);
      dispatch(addToast({ type: 'success', message: 'Payroll report deleted successfully.' }));
      setSelectedPayout(null);
      fetchData();
    } catch (err) {
      console.error(err);
      dispatch(addToast({ type: 'error', message: 'Failed to delete payroll report.' }));
    }
  };

  const handleDeleteRate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this payment rate configuration?')) return;
    try {
      await client.delete(`/api/billing/payouts/rates/${id}`);
      dispatch(addToast({ type: 'success', message: 'Payment rate configuration deleted.' }));
      fetchData();
    } catch (err) {
      console.error(err);
      dispatch(addToast({ type: 'error', message: 'Failed to delete payment rate.' }));
    }
  };

  const handleDeleteShift = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shift log?')) return;
    try {
      await client.delete(`/api/billing/payouts/shifts/${id}`);
      dispatch(addToast({ type: 'success', message: 'Shift log deleted successfully.' }));
      fetchData();
    } catch (err) {
      console.error(err);
      dispatch(addToast({ type: 'error', message: 'Failed to delete shift log.' }));
    }
  };

  // Open modals fresh
  const openRateConfigModal = () => {
    setOverrideRows([]);
    setRateForm({
      providerId: providers[0]?.id || '',
      providerRole: providers[0]?.role || 'PHYSICIAN',
      paymentType: 'FEE_FOR_SERVICE',
      baseRate: 0.0,
      feePerProcedure: 0.0,
      effectiveFrom: new Date().toISOString().split('T')[0]
    });
    setShowRateModal(true);
  };

  const openPayrollGenModal = () => {
    setGenForm({
      providerId: providers[0]?.id || '',
      periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0]
    });
    setShowGenModal(true);
  };

  // KPIs
  const stats = {
    pendingReview: payouts.filter(p => p.approvalStatus === 'PENDING_REVIEW').length,
    approved: payouts.filter(p => p.approvalStatus === 'APPROVED').length,
    paid: payouts.filter(p => p.approvalStatus === 'PAID').length,
    totalPaidAmount: payouts.filter(p => p.approvalStatus === 'PAID').reduce((sum, p) => sum + (p.totalPayout || 0), 0)
  };

  // Filter lists
  const filteredPayouts = payouts.filter(p => {
    const matchesStatus = statusFilter === 'ALL' || p.approvalStatus === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || p.providerName?.toLowerCase().includes(q) || p.providerId?.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans flex flex-col">
      
      {/* PROFESSIONAL ACTION HEADER */}
      <div className="bg-[#1A3C8F] text-white px-6 py-4 shadow-md shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#38BDF8] p-1 rounded-lg text-slate-900">
              <Coins size={18} />
            </span>
            <h1 className="text-md font-bold tracking-tight">Smart-eHR Provider Payments</h1>
            <span className="bg-white/10 text-white/70 font-mono text-[9px] px-2 py-0.5 rounded border border-white/10">GNWT DEPT OF HEALTH & SOCIAL SERVICES</span>
          </div>
          <p className="text-[11px] text-white/70 mt-1">Provider Shift Logs and Automated Payroll Processing Engine</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#132A6B] p-0.5 rounded-xl border border-white/10 self-stretch md:self-auto">
          <button
            onClick={() => { setActiveTab('payouts'); setSelectedPayout(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'payouts' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            <CheckSquare size={13} />
            Payout Reports
          </button>
          <button
            onClick={() => { setActiveTab('shifts'); setSelectedPayout(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'shifts' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={13} />
            Provider Shift Logs
          </button>
          {isAdminOrManager && (
            <>
              <button
                onClick={() => { setActiveTab('rates'); setSelectedPayout(null); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'rates' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <Briefcase size={13} />
                Payment Rates Config
              </button>
              <button
                onClick={() => { setActiveTab('gateway'); setSelectedPayout(null); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'gateway' ? 'bg-brand-red text-white shadow-sm' : 'text-white/60 hover:text-white'
                }`}
              >
                <Lock size={13} />
                Org Gateway & Accounts
              </button>
            </>
          )}
        </div>
      </div>

      {/* CORE WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 min-h-0">
        
        {/* LEFT SECTION: Main content grids and tables */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          
          {/* Active Shift Clock Card */}
          {!isAdminOrManager && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  activeShift ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Activity size={18} className={activeShift ? 'animate-pulse' : ''} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {activeShift ? 'You are currently Clocked In (Active General Shift)' : 'You are currently Clocked Out'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {activeShift 
                      ? `Started at ${activeShift.shiftStart?.replace('T', ' ').slice(0, 19)}` 
                      : 'Log your attendance hours to calculate hourly earnings.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {activeShift && clockTimer && (
                  <span className="font-mono font-bold text-xs bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-1 rounded-lg">
                    {clockTimer}
                  </span>
                )}
                {activeShift ? (
                  <button
                    onClick={handleClockOut}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm shadow-rose-600/10"
                  >
                    Clock Out & End Shift
                  </button>
                ) : (
                  <button
                    onClick={handleClockIn}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/10 flex items-center gap-1"
                  >
                    <Plus size={13} /> Clock In & Start Shift
                  </button>
                )}
              </div>
            </div>
          )}

          {/* KPI STATS BAR (Only for Payout Reports Tab) */}
          {activeTab === 'payouts' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              {[
                { label: 'Total Paid Out', value: `$${stats.totalPaidAmount.toFixed(2)}`, desc: 'Completed settlements', icon: Coins, bg: 'bg-emerald-50', border: 'border-emerald-200', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { label: 'Awaiting Payment', value: stats.approved, desc: 'Approved payouts pending release', icon: DollarSign, bg: 'bg-blue-50', border: 'border-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
                { label: 'Pending Review', value: stats.pendingReview, desc: 'Calculated payroll drafts', icon: Hourglass, bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                { label: 'Active Provider Rates', value: rates.length, desc: 'Standard & FFS rate configurations', icon: User, bg: 'bg-slate-50', border: 'border-slate-200', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' }
              ].map(({ label, value, desc, icon: Icon, bg, border, iconBg, iconColor }) => (
                <div key={label} className={`bg-white border rounded-xl p-4 shadow-sm ${border}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider leading-tight">{label}</p>
                      <p className="text-xl font-black text-slate-800 mt-1.5 leading-none">{value}</p>
                      <p className="text-[9px] text-[#64748B] mt-1 truncate max-w-[150px]">{desc}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                      <Icon size={14} className={iconColor} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row justify-between items-center gap-3 shadow-sm shrink-0">
            
            {/* Left side search & filtering */}
            <div className="flex-1 w-full flex flex-col sm:flex-row gap-2">
              {activeTab === 'payouts' && (
                <>
                  <input
                    type="text"
                    placeholder="Search by Provider Name or ID..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#38BDF8] focus:bg-white"
                  />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-[#38BDF8] focus:bg-white"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_REVIEW">Pending Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="PAID">Paid</option>
                  </select>
                </>
              )}
              {activeTab === 'shifts' && (
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 py-2">
                  <Activity size={14} className="text-[#1A3C8F]" /> Total Logged Shifts: {shifts.length}
                </p>
              )}
              {activeTab === 'rates' && (
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 py-2">
                  <Briefcase size={14} className="text-[#1A3C8F]" /> Configured Provider Contracts: {rates.length}
                </p>
              )}
            </div>

            {/* Right side Actions (Admins only) */}
            {isAdminOrManager && (
              <div className="flex gap-2 self-stretch md:self-auto shrink-0 justify-end">
                {activeTab === 'rates' && (
                  <button 
                    onClick={openRateConfigModal}
                    className="px-3.5 py-2 bg-[#1A3C8F] hover:bg-[#132A6B] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-[#1A3C8F]/20 cursor-pointer"
                  >
                    <Plus size={13} /> Configure Contract Rate
                  </button>
                )}
                {activeTab === 'shifts' && (
                  <button 
                    onClick={() => {
                      setManualShiftForm({
                        providerId: providers[0]?.id || '',
                        start: new Date().toISOString().slice(0, 16),
                        end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16)
                      });
                      setShowManualShiftModal(true);
                    }}
                    className="px-3.5 py-2 bg-[#1A3C8F] hover:bg-[#132A6B] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-[#1A3C8F]/20 cursor-pointer"
                  >
                    <Plus size={13} /> Log Manual Shift
                  </button>
                )}
                {activeTab === 'payouts' && (
                  <button 
                    onClick={openPayrollGenModal}
                    className="px-3.5 py-2 bg-[#1A3C8F] hover:bg-[#132A6B] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-[#1A3C8F]/20 cursor-pointer"
                  >
                    <Sparkles size={13} /> Calculate Payout
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TABLE CONTAINER */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex justify-center items-center py-20">
                <span className="animate-spin rounded-full h-7 w-7 border-t-2 border-[#1A3C8F]" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                
                {/* PAYOUT TAB */}
                {activeTab === 'payouts' && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4 font-bold">Provider</th>
                        <th className="py-3 px-3 font-bold">Payroll Period</th>
                        <th className="py-3 px-3 text-right font-bold">Hours</th>
                        <th className="py-3 px-3 text-right font-bold">Shift Pay</th>
                        <th className="py-3 px-3 text-right font-bold">Procedure Pay</th>
                        <th className="py-3 px-3 text-right font-bold">Total Payout</th>
                        <th className="py-3 px-3 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayouts.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-slate-400 italic">No payout records found.</td>
                        </tr>
                      ) : (
                        filteredPayouts.map(p => {
                          const meta = STATUS_META[p.approvalStatus] || STATUS_META.PENDING_REVIEW;
                          const isActive = selectedPayout?.id === p.id;
                          return (
                            <tr 
                              key={p.id} 
                              onClick={() => setSelectedPayout(p)}
                              className={`text-xs hover:bg-slate-50/80 cursor-pointer transition-all border-l-[3px] ${
                                isActive ? 'bg-sky-50/60 border-[#0284C7]' : 'border-transparent'
                              }`}
                            >
                              <td className="py-3 px-4 font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-[10px]">
                                    {p.providerName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800">{p.providerName}</span>
                                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">{p.providerId}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-500">
                                {p.payrollPeriodStart} to {p.payrollPeriodEnd}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">
                                {p.totalHoursWorked != null ? p.totalHoursWorked.toFixed(2) : '0.00'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">
                                ${p.shiftEarnings != null ? p.shiftEarnings.toFixed(2) : '0.00'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-slate-600">
                                ${p.totalProcedureEarnings != null ? p.totalProcedureEarnings.toFixed(2) : '0.00'}
                              </td>
                              <td className="py-3 px-3 text-right font-black text-brand-blue font-mono text-[11px]">
                                ${p.totalPayout != null ? p.totalPayout.toFixed(2) : '0.00'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${meta.cls}`}>
                                  <span className={`w-1 h-1 rounded-full ${meta.dot}`} />
                                  {meta.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {/* SHIFTS TAB */}
                {activeTab === 'shifts' && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4 font-bold">Provider Name</th>
                        <th className="py-3 px-3 font-bold">Start Time</th>
                        <th className="py-3 px-3 font-bold">End Time</th>
                        <th className="py-3 px-3 text-right font-bold">Hours Worked</th>
                        <th className="py-3 px-3 font-bold">Source Type</th>
                        <th className="py-3 px-3 font-bold">Source Reference</th>
                        <th className="py-3 px-3 text-center font-bold">Status</th>
                        {isAdminOrManager && <th className="py-3 px-3 text-right font-bold">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shifts.length === 0 ? (
                        <tr>
                          <td colSpan={isAdminOrManager ? "8" : "7"} className="p-8 text-center text-slate-400 italic">No shift logs found.</td>
                        </tr>
                      ) : (
                        shifts.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50 text-xs">
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{getProviderName(s.providerId)}</span>
                                <span className="text-[9px] text-slate-400 font-mono mt-0.5">{s.providerId}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500">{formatDateTime(s.shiftStart)}</td>
                            <td className="py-3 px-3 font-mono text-slate-500">{formatDateTime(s.shiftEnd)}</td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-[#1A3C8F]">{formatHours(s.hoursWorked)}</td>
                            <td className="py-3 px-3">
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-[9px] text-slate-600">
                                {s.sourceType}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{s.sourceRefId || '—'}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                s.status === 'LOCKED' ? 'bg-rose-50 text-rose-600 border-rose-200' : 
                                s.status === 'OPEN' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                'bg-green-50 text-green-600 border-green-200'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  s.status === 'LOCKED' ? 'bg-rose-500' : 
                                  s.status === 'OPEN' ? 'bg-amber-500' :
                                  'bg-green-500'
                                }`} />
                                {s.status}
                              </span>
                            </td>
                            {isAdminOrManager && (
                              <td className="py-3 px-3 text-right">
                                {s.status !== 'LOCKED' ? (
                                  <button 
                                    onClick={() => handleDeleteShift(s.id)}
                                    className="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-bold select-none px-1.5">Locked</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* RATES TAB */}
                {activeTab === 'rates' && isAdminOrManager && (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-4 font-bold">Provider Name</th>
                        <th className="py-3 px-3 font-bold">Role</th>
                        <th className="py-3 px-3 font-bold">Payment Type</th>
                        <th className="py-3 px-3 text-right font-bold">Hourly Rate</th>
                        <th className="py-3 px-3 text-right font-bold">Procedure Rate</th>
                        <th className="py-3 px-3 font-bold">Procedure Overrides</th>
                        <th className="py-3 px-3 text-center font-bold">Contract Status</th>
                        <th className="py-3 px-3 text-right font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rates.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-slate-400 italic">No rates mapped.</td>
                        </tr>
                      ) : (
                        rates.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 text-xs">
                            <td className="py-3 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{getProviderName(r.providerId)}</span>
                                <span className="text-[9px] text-slate-400 font-mono mt-0.5">{r.providerId}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-600">{r.providerRole}</td>
                            <td className="py-3 px-3 font-mono text-slate-500">{r.paymentType}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">${r.baseRate != null ? r.baseRate.toFixed(2) : '0.00'}</td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">${r.feePerProcedure != null ? r.feePerProcedure.toFixed(2) : '0.00'}</td>
                            <td className="py-3 px-3 font-mono text-[9px] text-slate-400">{JSON.stringify(r.procedureRateOverrides || {})}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                r.active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${r.active ? 'bg-green-500' : 'bg-slate-300'}`} />
                                {r.active ? 'ACTIVE' : 'EXPIRED'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button 
                                onClick={() => handleDeleteRate(r.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* GATEWAY & DOCTOR ACCOUNTS TAB */}
                {activeTab === 'gateway' && isAdminOrManager && (
                  <div className="p-6 flex flex-col gap-6">
                    {/* ONBOARDING & SETUP GUIDE BANNER */}
                    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-blue-700/50">
                      <div className="space-y-1">
                        <span className="bg-sky-400/20 text-sky-300 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-400/30 uppercase tracking-wider flex items-center gap-1 w-fit">
                          <Sparkles size={11} className="text-amber-400" />
                          Complete Integration & Onboarding Guide
                        </span>
                        <h3 className="font-bold text-sm text-white flex items-center gap-2 mt-1">
                          How to Connect RazorpayX & Automate Doctor Agreed Payment Payouts
                        </h3>
                        <p className="text-xs text-slate-300">
                          Follow the 3-step setup: Create RazorpayX account, paste API credentials below, and link doctor UPI IDs for instant payouts on patient bill settlement.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 cursor-pointer border border-amber-300/40"
                      >
                        <BookOpen size={15} />
                        View Step-by-Step Guide
                      </button>
                    </div>

                    {/* Org Payment Gateway Setup Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-3 mb-4 gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Lock size={16} className="text-[#1A3C8F]" />
                            Organization Payment Gateway Config
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">Configure merchant credentials for direct patient billing settlements.</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <div className="flex items-center gap-1.5 bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-xs">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Select Org:</span>
                              <select
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                className="text-xs font-bold text-[#1A3C8F] bg-transparent focus:outline-none cursor-pointer"
                              >
                                {organizations.length === 0 ? (
                                  <option value={selectedOrgId}>{activeOrgName}</option>
                                ) : (
                                  organizations.map(o => (
                                    <option key={o.id || o.code} value={o.id || o.code}>{o.name}</option>
                                  ))
                                )}
                              </select>
                            </div>
                          ) : (
                            <span className="px-3 py-1 bg-blue-100 text-[#1A3C8F] font-bold text-xs rounded-lg border border-blue-200">
                              {activeOrgName}
                            </span>
                          )}

                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full shrink-0">
                            Multi-Tenant Isolated
                          </span>
                        </div>
                      </div>

                      <form onSubmit={handleSaveGatewayConfig} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Gateway Provider</label>
                          <select
                            value={gatewayConfig.provider || 'RAZORPAY'}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, provider: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-[#38BDF8]"
                          >
                            <option value="RAZORPAY">Razorpay (India / Global)</option>
                            <option value="PHONEPE">PhonePe PG</option>
                            <option value="CASHFREE">Cashfree Payments</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Merchant / Account ID</label>
                          <input
                            type="text"
                            placeholder="Enter Merchant ID (Optional)"
                            value={gatewayConfig.merchantId || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, merchantId: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#38BDF8]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">API Key ID (`keyId`)</label>
                          <input
                            type="text"
                            placeholder="Enter Key ID (rzp_live_...)"
                            value={gatewayConfig.keyId || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, keyId: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#38BDF8]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">API Key Secret (`keySecret`)</label>
                          <input
                            type="password"
                            placeholder="Enter Key Secret"
                            value={gatewayConfig.keySecret || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, keySecret: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#38BDF8]"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 mb-1">Webhook Secret Key (`webhookSecret`)</label>
                          <input
                            type="text"
                            placeholder="Enter Webhook Secret Key"
                            value={gatewayConfig.webhookSecret || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, webhookSecret: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#38BDF8]"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            🔑 Enter <b>ONLY Secret Key</b> in this box (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">whsec_epcr_healthcare_9f8a...</code>)
                          </p>
                        </div>

                        {/* ⭐ RazorpayX Account Number — Doctor Split ke liye ZARURI */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">Auto Split</span>
                            RazorpayX Current Account Number
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 7878780123456789 — RazorpayX Dashboard se copy karo"
                            value={gatewayConfig.razorpayxAccountNumber || ''}
                            onChange={e => setGatewayConfig({ ...gatewayConfig, razorpayxAccountNumber: e.target.value })}
                            className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                          />
                          <p className="text-[10px] text-emerald-700 mt-1 font-semibold">
                            ⚡ Yahi account number doctor ko automatic UPI split ke liye use hoga jab patient bill pay kare.
                          </p>
                        </div>

                        <div className="md:col-span-2 flex justify-between items-center pt-2">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                            <input
                              type="checkbox"
                              checked={gatewayConfig.active !== false}
                              onChange={e => setGatewayConfig({ ...gatewayConfig, active: e.target.checked })}
                              className="rounded text-[#1A3C8F] focus:ring-0"
                            />
                            Active Gateway Config
                          </label>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#1A3C8F] hover:bg-[#132A6B] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            Save Gateway Credentials
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Doctor Onboarding Payment Accounts Table */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Stethoscope size={16} className="text-[#1A3C8F]" />
                            Doctor Onboarding Payment Accounts
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">Link payout bank accounts, UPI IDs, or Razorpay Route linked accounts per physician for automated settlements.</p>
                        </div>
                        <button
                          onClick={() => {
                            setDoctorAccountForm({
                              doctorUserId: providers[0]?.id || '',
                              doctorName: providers[0] ? `${providers[0].firstName} ${providers[0].lastName}` : '',
                              accountType: 'BANK_ACCOUNT',
                              accountNumber: '',
                              ifscCode: '',
                              upiId: '',
                              linkedAccountRef: '',
                              commissionPercent: 15.0
                            });
                            setShowDoctorAccountModal(true);
                          }}
                          className="px-3 py-1.5 bg-[#1A3C8F] hover:bg-[#132A6B] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={13} /> Link Doctor Account
                        </button>
                      </div>

                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                            <th className="py-2.5 px-3 font-bold">Doctor Name</th>
                            <th className="py-2.5 px-3 font-bold">Type</th>
                            <th className="py-2.5 px-3 font-bold">Account Details / UPI</th>
                            <th className="py-2.5 px-3 font-bold">Route Linked ID</th>
                            <th className="py-2.5 px-3 text-right font-bold">Agreed Payment %</th>
                            <th className="py-2.5 px-3 text-center font-bold">Status</th>
                            <th className="py-2.5 px-3 text-right font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {doctorAccounts.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="p-6 text-center text-slate-400 italic">No doctor payout accounts linked yet. Click "Link Doctor Account" to onboard a doctor.</td>
                            </tr>
                          ) : (
                            doctorAccounts.map(acc => (
                              <tr key={acc.id} className="hover:bg-slate-50">
                                <td className="py-3 px-3 font-bold text-slate-800">
                                  {acc.doctorName || acc.doctorUserId}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-600">
                                  {acc.accountType}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-600">
                                  {acc.accountType === 'UPI' ? acc.upiId : `${acc.accountNumber || '—'} (${acc.ifscCode || ''})`}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-500">
                                  {acc.linkedAccountRef || '—'}
                                </td>
                                <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                                  {acc.commissionPercent}%
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold text-[9px] rounded-full">
                                    ACTIVE
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* ⚡ Payout automated on bill payment */}
                                    <button
                                      onClick={() => handleEditDoctorAccount(acc)}
                                      className="p-1 text-[#1A3C8F] hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                      title="Edit Doctor Agreed Payment & Account"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDoctorAccount(acc.id)}
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                      title="Delete Doctor Account"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* RAZORPAYX INSTANT PAYOUT AUDIT LOG TABLE */}
                {isAdminOrManager && (
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-amber-500" />
                          RazorpayX Instant Doctor Payout Transactions (Audit Ledger)
                        </h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Real-time settlement history of patient bill total vs doctor agreed payment earned & paid</p>
                      </div>
                      <button
                        onClick={fetchPayoutTransactions}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                      >
                        Refresh Audit Log
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[9px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Claim #</th>
                            <th className="py-2.5 px-3">Doctor & UPI ID</th>
                            <th className="py-2.5 px-3 text-right">Patient Bill (₹)</th>
                            <th className="py-2.5 px-3 text-center">Comm. %</th>
                            <th className="py-2.5 px-3 text-right">Doctor Earned (₹)</th>
                            <th className="py-2.5 px-3 text-center">Payout Status</th>
                            <th className="py-2.5 px-3">Razorpay Ref ID</th>
                            <th className="py-2.5 px-3">Date & Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {payoutTxList.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="py-6 text-center text-slate-400 font-bold text-[10px]">
                                No RazorpayX instant payouts recorded yet. Payouts automatically log here when patients settle bills.
                              </td>
                            </tr>
                          ) : (
                            payoutTxList.map(tx => (
                              <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{tx.claimNumber}</td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800">{tx.doctorName}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">{tx.upiId}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                  ₹{tx.claimTotalAmount?.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 font-bold text-[10px]">
                                    {tx.commissionPercent}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                  ₹{tx.payoutAmount?.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${
                                    tx.status === 'PROCESSED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    tx.status === 'SIMULATED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    tx.status === 'PROCESSING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {tx.status === 'SIMULATED' ? '⚡ SIMULATED (PAID)' : tx.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[9px] text-slate-500">
                                  {tx.razorpayPayoutId || 'pout_simulated'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                                  {formatDateTime(tx.createdAt)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: SPLIT-SCREEN DETAILS INSPECTOR */}
        {selectedPayout && (
          <div className="w-full lg:w-[350px] bg-white border border-slate-200 rounded-xl p-5 shadow-md flex flex-col gap-4 shrink-0 transition-all duration-300">
            
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Selected Payroll</p>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-2">
                  <User size={15} className="text-[#1A3C8F]" />
                  {selectedPayout.providerName}
                </h3>
                <span className="text-[9px] text-slate-400 font-mono mt-1 block">ID: {selectedPayout.providerId}</span>
              </div>
              <button 
                onClick={() => setSelectedPayout(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Calculations Breakdown Box */}
            <div className="flex flex-col gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] font-semibold text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Payroll Period</span>
                <span className="font-mono text-slate-600">{selectedPayout.payrollPeriodStart} to {selectedPayout.payrollPeriodEnd}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Total Hours</span>
                <span className="font-mono text-slate-600">{selectedPayout.totalHoursWorked != null ? selectedPayout.totalHoursWorked.toFixed(2) : '0.00'} hrs</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Shift Base Pay</span>
                <span className="font-mono text-slate-600">${selectedPayout.shiftEarnings != null ? selectedPayout.shiftEarnings.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Procedure Incentive</span>
                <span className="font-mono text-slate-600">${selectedPayout.totalProcedureEarnings != null ? selectedPayout.totalProcedureEarnings.toFixed(2) : '0.00'}</span>
              </div>
              <div className="flex justify-between text-xs font-black text-[#1A3C8F] pt-2">
                <span className="uppercase tracking-wider text-[9px]">Calculated Pay</span>
                <span className="font-mono text-sm">${selectedPayout.totalPayout != null ? selectedPayout.totalPayout.toFixed(2) : '0.00'}</span>
              </div>
            </div>

            {/* Line items breakdown */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Line-Item Ledger Audit Trail</p>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {selectedPayout.lineItems?.map((item, idx) => (
                  <div key={idx} className="flex flex-col bg-white border border-slate-200 rounded-lg p-2.5 text-[11px] gap-1 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center">
                      <span className={`px-1.5 py-0.5 rounded font-black text-[8px] border ${
                        item.sourceType === 'SHIFT' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-purple-50 text-purple-600 border-purple-100'
                      }`}>
                        {item.sourceType}
                      </span>
                      <span className="font-bold font-mono text-slate-800">${item.amount?.toFixed(2)}</span>
                    </div>
                    <p className="text-slate-600 leading-tight">{item.description}</p>
                    <p className="text-[9px] text-slate-400 font-mono">Ref: {item.sourceRefId}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Release approval flow */}
            {isAdminOrManager && selectedPayout.approvalStatus !== 'PAID' && (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                <div className="flex gap-2">
                  {selectedPayout.approvalStatus === 'PENDING_REVIEW' && (
                    <button 
                      onClick={() => handleApprove(selectedPayout.id)}
                      className="flex-1 bg-[#1A3C8F] hover:bg-[#132A6B] text-white text-[10px] font-bold py-2 rounded-lg transition-colors cursor-pointer shadow-sm shadow-[#1A3C8F]/20 flex items-center justify-center gap-1"
                    >
                      Approve Release
                    </button>
                  )}
                  {selectedPayout.approvalStatus === 'APPROVED' && (
                    <button 
                      onClick={() => handleMarkPaid(selectedPayout.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1"
                    >
                      Mark as Paid & Settled
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => handleDeletePayout(selectedPayout.id)}
                  className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 size={12} /> Delete Report
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIGURE RATES CONTRACT MODAL */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-md w-full shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">Configure Provider Payment Rate</h3>
              <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleCreateRate} className="p-5 flex flex-col gap-4 text-xs font-semibold text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Provider</label>
                <select 
                  value={rateForm.providerId}
                  onChange={(e) => handleProviderSelectChange(e.target.value)}
                  required 
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contracted Role</label>
                  <input 
                    type="text"
                    value={rateForm.providerRole}
                    disabled
                    className="bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-500 rounded-lg p-2.5 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Type</label>
                  <select 
                    value={rateForm.paymentType}
                    onChange={(e) => setRateForm({...rateForm, paymentType: e.target.value})}
                    className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                  >
                    <option value="FEE_FOR_SERVICE">Fee for Service</option>
                    <option value="SHIFT_RATE">Shift Rate</option>
                    <option value="SALARY">Salary</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(rateForm.paymentType === 'SALARY' || rateForm.paymentType === 'SHIFT_RATE' || rateForm.paymentType === 'HYBRID') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Hourly Rate ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={rateForm.baseRate}
                      onChange={(e) => setRateForm({...rateForm, baseRate: parseFloat(e.target.value) || 0.0})}
                      className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                    />
                  </div>
                )}

                {(rateForm.paymentType === 'FEE_FOR_SERVICE' || rateForm.paymentType === 'HYBRID') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Fee per Procedure ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={rateForm.feePerProcedure}
                      onChange={(e) => setRateForm({...rateForm, feePerProcedure: parseFloat(e.target.value) || 0.0})}
                      className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Override Rows Configuration */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Incentive Rate Overrides</label>
                  <button 
                    type="button" 
                    onClick={addOverrideRow}
                    className="text-[10px] font-bold text-[#1A3C8F] hover:text-[#132A6B] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={11} /> Add Override
                  </button>
                </div>
                
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {overrideRows.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic p-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">No procedure-specific overrides configured.</p>
                  ) : (
                    overrideRows.map((row, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={row.sourceType}
                          onChange={(e) => updateOverrideRow(idx, 'sourceType', e.target.value)}
                          className="flex-1 bg-white border border-[#CBD5E1] text-[10px] font-semibold text-[#0F172A] rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                        >
                          <option value="SURGICAL_CASE">Surgical Case (SURGICAL_CASE)</option>
                          <option value="HOMECARE_VISIT">Home Care Visit (HOMECARE_VISIT)</option>
                          <option value="EPCR_INCIDENT">ePCR Incident (EPCR_INCIDENT)</option>
                        </select>
                        <div className="w-20 relative">
                          <span className="absolute left-2.5 top-2 text-slate-400">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => updateOverrideRow(idx, 'rate', parseFloat(e.target.value) || 0.0)}
                            className="w-full bg-white border border-[#CBD5E1] text-[10px] font-bold text-right rounded-lg p-1.5 pl-6 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOverrideRow(idx)}
                          className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-200 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowRateModal(false)}
                  className="bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#1A3C8F] hover:bg-[#132A6B] text-white text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer shadow-sm"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALCULATE PAYROLL RUN MODAL */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm w-full shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">Calculate Payroll Report</h3>
              <button onClick={() => setShowGenModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleGeneratePayout} className="p-5 flex flex-col gap-4 text-xs font-semibold text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Provider</label>
                <select 
                  value={genForm.providerId}
                  onChange={(e) => setGenForm({...genForm, providerId: e.target.value})}
                  required 
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                <input 
                  type="date" 
                  value={genForm.periodStart}
                  onChange={(e) => setGenForm({...genForm, periodStart: e.target.value})}
                  required
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                <input 
                  type="date" 
                  value={genForm.periodEnd}
                  onChange={(e) => setGenForm({...genForm, periodEnd: e.target.value})}
                  required
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-200 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowGenModal(false)}
                  className="bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#1A3C8F] hover:bg-[#132A6B] text-white text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer shadow-sm"
                >
                  Process Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL SHIFT MODAL FOR ADMIN */}
      {showManualShiftModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm w-full shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">Log Manual Shift</h3>
              <button onClick={() => setShowManualShiftModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleLogManualShift} className="p-5 flex flex-col gap-4 text-xs font-semibold text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Provider</label>
                <select 
                  value={manualShiftForm.providerId}
                  onChange={(e) => setManualShiftForm({...manualShiftForm, providerId: e.target.value})}
                  required 
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift Start Time</label>
                <input 
                  type="datetime-local" 
                  value={manualShiftForm.start}
                  onChange={(e) => setManualShiftForm({...manualShiftForm, start: e.target.value})}
                  required
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shift End Time</label>
                <input 
                  type="datetime-local" 
                  value={manualShiftForm.end}
                  onChange={(e) => setManualShiftForm({...manualShiftForm, end: e.target.value})}
                  required
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-200 mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowManualShiftModal(false)}
                  className="bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#1A3C8F] hover:bg-[#132A6B] text-white text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer shadow-sm"
                >
                  Log Shift Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LINK DOCTOR PAYMENT ACCOUNT MODAL */}
      {showDoctorAccountModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-md w-full shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">
                {editingDoctorAccount ? 'Edit Doctor Payment & Commission Account' : 'Onboard Doctor Payment Account'}
              </h3>
              <button onClick={() => { setShowDoctorAccountModal(false); setEditingDoctorAccount(null); }} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveDoctorAccount} className="p-5 flex flex-col gap-4 text-xs font-semibold text-slate-700">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Select Doctor / Provider</label>
                <select
                  value={doctorAccountForm.doctorUserId}
                  onChange={(e) => {
                    const matched = providers.find(p => p.id === e.target.value);
                    setDoctorAccountForm({
                      ...doctorAccountForm,
                      doctorUserId: e.target.value,
                      doctorName: matched ? `${matched.firstName} ${matched.lastName}` : e.target.value
                    });
                  }}
                  required
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account Payout Type</label>
                <select
                  value={doctorAccountForm.accountType}
                  onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, accountType: e.target.value })}
                  className="bg-white border border-[#CBD5E1] text-[11px] font-semibold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                >
                  <option value="BANK_ACCOUNT">Direct Bank Transfer (NEFT/IMPS)</option>
                  <option value="UPI">UPI Payment ID</option>
                  <option value="RAZORPAY_ROUTE">Razorpay Route Linked Account</option>
                </select>
              </div>

              {doctorAccountForm.accountType === 'UPI' ? (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doctor UPI ID</label>
                  <input
                    type="text"
                    placeholder="doctor@upi"
                    value={doctorAccountForm.upiId}
                    onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, upiId: e.target.value })}
                    required
                    className="bg-white border border-[#CBD5E1] text-[11px] font-mono text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bank Account No.</label>
                    <input
                      type="text"
                      placeholder="987654321012"
                      value={doctorAccountForm.accountNumber}
                      onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, accountNumber: e.target.value })}
                      className="bg-white border border-[#CBD5E1] text-[11px] font-mono text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="SBIN0001234"
                      value={doctorAccountForm.ifscCode}
                      onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, ifscCode: e.target.value })}
                      className="bg-white border border-[#CBD5E1] text-[11px] font-mono text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Razorpay Linked Acc ID</label>
                  <input
                    type="text"
                    placeholder="acc_L12345678"
                    value={doctorAccountForm.linkedAccountRef}
                    onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, linkedAccountRef: e.target.value })}
                    className="bg-white border border-[#CBD5E1] text-[11px] font-mono text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agreed Payment %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={doctorAccountForm.commissionPercent}
                    onChange={(e) => setDoctorAccountForm({ ...doctorAccountForm, commissionPercent: parseFloat(e.target.value) || 0 })}
                    className="bg-white border border-[#CBD5E1] text-[11px] font-bold text-[#0F172A] rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-200 mt-2">
                <button
                  type="button"
                  onClick={() => { setShowDoctorAccountModal(false); setEditingDoctorAccount(null); }}
                  className="bg-white border border-[#CBD5E1] hover:bg-slate-50 text-slate-700 text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#1A3C8F] hover:bg-[#132A6B] text-white text-[10px] font-bold px-3 py-2 rounded-lg cursor-pointer shadow-sm"
                >
                  {editingDoctorAccount ? 'Update Doctor Account' : 'Save Doctor Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTEGRATION & ONBOARDING GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-5 flex justify-between items-center">
              <div>
                <span className="bg-amber-400/20 text-amber-300 font-bold text-[10px] uppercase px-2 py-0.5 rounded border border-amber-400/30">
                  Smart-eHR Integration Guide
                </span>
                <h2 className="text-base font-extrabold mt-1 flex items-center gap-2">
                  <BookOpen size={18} className="text-amber-400" />
                  RazorpayX Account Setup & Doctor Payout Onboarding
                </h2>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              
              {/* Step 1 */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2">
                <h4 className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5">
                  <span className="bg-blue-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px]">1</span>
                  Create & Activate RazorpayX Account (5 Minutes)
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-2">
                  <li>Go to <a href="https://x.razorpay.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline inline-flex items-center gap-0.5">x.razorpay.com <ExternalLink size={10} /></a> and sign up with your Hospital Email.</li>
                  <li>Complete Organization KYC (Upload Business PAN, Bank Account Cheque, and Registration Certificate).</li>
                  <li>Activate <strong>RazorpayX Payouts</strong> and note your Virtual Current Account Number.</li>
                  <li>Go to <strong>My Account & Settings &rarr; Developer Controls / API Keys</strong> and copy your <code>Key ID</code>, <code>Key Secret</code>, and <code>Account Number</code>.</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
                <h4 className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                  <span className="bg-emerald-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px]">2</span>
                  Connect Keys in Smart-eHR (2 Minutes)
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>In the form behind this window, paste your <code>Key ID</code>, <code>Key Secret</code>, and <code>RazorpayX Account Number</code>.</li>
                  <li>Toggle <strong>Activate Gateway Status</strong> to <code>ON</code>.</li>
                  <li>Click <strong>Save Payment Gateway Config</strong>.</li>
                </ul>
              </div>

              {/* Step 3 */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2">
                <h4 className="font-extrabold text-xs text-amber-950 flex items-center gap-1.5">
                  <span className="bg-amber-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px]">3</span>
                  Add Doctor UPI IDs & Agreed Payment % (3 Minutes)
                </h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-2">
                  <li>Under <strong>Doctor Agreed Payment Accounts</strong>, click <strong>+ Add Doctor Account</strong>.</li>
                  <li>Select Doctor (e.g. <code>Dr. Kshitiz</code>), select <strong>UPI</strong>, and enter their UPI ID (e.g. <code>doctor@okicici</code> or PhonePe/GPay number).</li>
                  <li>Set agreed Agreed Payment % (e.g. <code>20%</code>) and click Save!</li>
                </ul>
              </div>

              {/* How it Works Summary */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  How Automatic Payouts Work (0-Seconds Settlement)
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  When a patient settles a bill online or via QR code, Smart-eHR automatically identifies the treating doctor, calculates their commission (e.g. ₹2,000 bill &times; 20% = ₹400), triggers an instant UPI transfer to the doctor's UPI ID, emails a receipt, and logs the transaction in the <strong>RazorpayX Audit Ledger</strong>.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-medium">Smart-eHR Automated Agreed Payment & Payout Engine v2.4</span>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
