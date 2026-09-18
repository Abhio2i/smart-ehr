import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShieldCheck, Loader2, Check, Search, UserCheck, Zap, CheckCircle2, CreditCard } from 'lucide-react';
import { createClaim, searchPatients } from '../../api/billingApi';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/uiSlice';

import client from '../../api/client';

const PAYER_OPTIONS = [
  { id: 'SELF_PAY', label: 'Self-Pay / Cash (Direct Patient)', logo: '👤', desc: 'Direct Cash / UPI / Card Payment' },
  { id: 'PRIVATE_INSURER', label: 'Private Health Insurance', logo: '💼', desc: 'Star Health, HDFC Ergo, Max Bupa' },
  { id: 'NWT_HEALTH_CARE_PLAN', label: 'Government Health Scheme', logo: '📜', desc: 'Ayushman Bharat / CGHS / State Scheme' },
  { id: 'RMBA_RECIPROCAL', label: 'Corporate / Reciprocal Plan', logo: '🏢', desc: 'TPA & Corporate Billing' }
];

const COMMON_DIAGNOSES = [
  { code: 'K02.9', description: 'Dental Caries / Tooth Decay, Unspecified' },
  { code: 'K05.3', description: 'Chronic Periodontitis / Plaque' },
  { code: 'K04.0', description: 'Pulpitis / Severe Toothache' },
  { code: 'R07.9', description: 'Chest Pain, Unspecified' },
  { code: 'R06.02', description: 'Shortness of Breath' },
  { code: 'I21.9', description: 'Acute Myocardial Infarction' }
];

const COMMON_SERVICES = [
  { code: 'SUP-01', description: 'Oxygen therapy / airway management', rate: 75.00, sourceType: 'MEDICATION' },
  { code: 'DENT-CMP-01', description: 'Composite Filling (Tooth Restoration)', rate: 3000.00, sourceType: 'PROCEDURE' },
  { code: 'DENT-SCL-01', description: 'Scaling and Polishing (Deep Cleaning)', rate: 2000.00, sourceType: 'PROCEDURE' },
  { code: 'DENT-FLU-01', description: 'Fluoride Treatment', rate: 1500.00, sourceType: 'PROCEDURE' },
  { code: 'DENT-CAR-01', description: 'Caries Treatment (per tooth)', rate: 1500.00, sourceType: 'PROCEDURE' },
  { code: 'DENT-RCT-01', description: 'Single Sitting RCT (Root Canal Treatment)', rate: 4500.00, sourceType: 'PROCEDURE' },
  { code: 'DENT-CON-01', description: 'Specialist Consultation Fee', rate: 800.00, sourceType: 'PROCEDURE' },
  { code: 'AMB-IND-01', description: 'Ground Ambulance Transport Service', rate: 1200.00, sourceType: 'TRANSPORT' },
  { code: 'MED-KIT-01', description: 'Prescribed Medical & Surgical Supplies', rate: 650.00, sourceType: 'MEDICATION' }
];

export default function CreateClaimModal({ isOpen, onClose, onSuccess }) {
  const dispatch = useDispatch();

  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [payerId, setPayerId] = useState('SELF_PAY');
  const [payerDetails, setPayerDetails] = useState('');
  const [icdCode, setIcdCode] = useState('K02.9');
  const [facilityCode, setFacilityCode] = useState('SMILE-CLINIC-01');
  const [providerBillingNumber, setProviderBillingNumber] = useState('DOC-SWATI-95600');
  const [doctorsList, setDoctorsList] = useState([]);

  // Fetch onboarded doctor accounts for dropdown selection
  useEffect(() => {
    if (isOpen) {
      client.get('/api/payments/doctor-accounts')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : [];
          setDoctorsList(list);
          if (list.length > 0) {
            const firstDoc = list[0].doctorName || list[0].doctorUserId;
            if (firstDoc) setProviderBillingNumber(firstDoc);
          }
        })
        .catch(err => console.warn('Could not fetch doctor accounts:', err));
    }
  }, [isOpen]);

  // Patient Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [items, setItems] = useState([
    { sourceType: 'PROCEDURE', serviceCode: 'DENT-SCL-01', description: 'Scaling and Polishing (Deep Cleaning)', quantity: 1, unitPrice: 2000.00 },
    { sourceType: 'PROCEDURE', serviceCode: 'DENT-FLU-01', description: 'Fluoride Treatment', quantity: 1, unitPrice: 1500.00 },
    { sourceType: 'PROCEDURE', serviceCode: 'DENT-CMP-01', description: 'Composite Filling (Tooth Restoration)', quantity: 1, unitPrice: 3000.00 }
  ]);

  const [selectedServiceCode, setSelectedServiceCode] = useState('DENT-CAR-01');
  const [customDescription, setCustomDescription] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [addQuantity, setAddQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Payment state: null | 'paying' | 'paid'
  const [paymentState, setPaymentState] = useState(null);
  const [paidClaimInfo, setPaidClaimInfo] = useState(null);

  const openRazorpayPopup = (claimId, amountRupees, pName) => {
    return new Promise(async (resolve, reject) => {
      try {
        const orderRes = await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-order`);
        const orderData = orderRes.data;
        if (!orderData || !orderData.orderId) {
          reject(new Error('Gateway not configured'));
          return;
        }
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Smart-eHR Medical Billing',
          description: `Invoice #${claimId}`,
          order_id: orderData.orderId,
          prefill: { name: pName || 'Patient' },
          handler: async function (response) {
            try {
              await client.post(`/api/patient-portal/billing/claims/${claimId}/razorpay-verify`, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              resolve({ paymentId: response.razorpay_payment_id });
            } catch (err) {
              reject(new Error('Payment verification failed'));
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled by user'))
          },
          theme: { color: '#1A3C8F' }
        };
        if (!window.Razorpay) {
          reject(new Error('Razorpay SDK not loaded'));
          return;
        }
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (e) {
        reject(e);
      }
    });
  };

  // Trigger search on query change
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPatients(searchQuery.trim());
        setSearchResults(results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Patient search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectPatient = (patient) => {
    const pId = patient.patientId || patient.id || '';
    const pName = patient.displayName || patient.patientName || '';
    setPatientId(pId);
    setPatientName(pName);
    if (patient.phone || patient.patientPhone) {
      setPayerDetails(patient.phone || patient.patientPhone);
    }
    if (patient.doctor) {
      setProviderBillingNumber(patient.doctor);
    }
    setShowDropdown(false);
    dispatch(addToast({ type: 'info', message: `Selected Patient: ${pName || pId}` }));
  };

  if (!isOpen) return null;


  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleAddItem = () => {
    if (isCustom) {
      if (!customDescription.trim() || !customPrice) {
        dispatch(addToast({ type: 'error', message: 'Please enter custom charge description and amount.' }));
        return;
      }
      const price = parseFloat(customPrice) || 0;
      setItems(prev => [...prev, {
        sourceType: 'PROCEDURE',
        serviceCode: `CUST-${Date.now().toString().slice(-4)}`,
        description: customDescription.trim(),
        quantity: addQuantity,
        unitPrice: price
      }]);
      setCustomDescription('');
      setCustomPrice('');
      return;
    }

    const service = COMMON_SERVICES.find(s => s.code === selectedServiceCode);
    if (!service) return;

    setItems(prev => {
      const idx = prev.findIndex(i => i.serviceCode === service.code);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += addQuantity;
        return copy;
      }
      return [...prev, {
        sourceType: service.sourceType,
        serviceCode: service.code,
        description: service.description,
        quantity: addQuantity,
        unitPrice: service.rate
      }];
    });
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index, qty) => {
    const val = Math.max(1, parseInt(qty) || 1);
    setItems(prev => {
      const copy = [...prev];
      copy[index].quantity = val;
      return copy;
    });
  };

  const copyLink = () => {
    if (qrResult?.shortUrl) {
      navigator.clipboard.writeText(qrResult.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e, payNow = false) => {
    if (e) e.preventDefault();

    if (!patientId.trim()) {
      dispatch(addToast({ type: 'error', message: 'Patient ID is required.' }));
      return;
    }
    if (items.length === 0) {
      dispatch(addToast({ type: 'error', message: 'Please attach at least one treatment procedure or line item.' }));
      return;
    }

    setLoading(true);
    const idempotencyKey = `create-claim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const payload = {
        patientId: patientId.trim(),
        patientName: patientName.trim() || undefined,
        payerId,
        payerDetails: payerDetails.trim() || undefined,
        icdCode,
        facilityCode,
        providerBillingNumber,
        items
      };

      const createdClaim = await createClaim(payload, idempotencyKey);
      const claimId = createdClaim?.id || createdClaim?._id || createdClaim?.claimId;
      setLoading(false);

      if (payNow) {
        if (!claimId) {
          dispatch(addToast({ type: 'warning', message: 'Claim created, but could not get Claim ID for payment.' }));
          if (onSuccess) onSuccess(createdClaim);
          onClose();
          return;
        }

        dispatch(addToast({ type: 'info', message: '✅ Bill saved! Opening payment gateway...' }));

        try {
          const pName = patientName.trim() || patientId.trim();
          await openRazorpayPopup(claimId, totalAmount, pName);
          // Payment succeeded
          setPaymentState('paid');
          setPaidClaimInfo({
            claimNumber: createdClaim?.claimNumber || claimId,
            patientName: pName,
            amount: totalAmount
          });
          dispatch(addToast({ type: 'success', message: '🎉 Payment done! Receipt emailed to patient.' }));
          if (onSuccess) onSuccess(createdClaim);
        } catch (payErr) {
          const msg = payErr?.message || 'Payment was not completed.';
          if (msg.includes('cancelled')) {
            dispatch(addToast({ type: 'warning', message: 'Payment cancelled. Claim is saved — you can pay later from Claims list.' }));
          } else {
            dispatch(addToast({ type: 'error', message: msg }));
          }
          if (onSuccess) onSuccess(createdClaim);
          onClose();
        }
      } else {
        dispatch(addToast({ type: 'success', message: `Invoice ${createdClaim?.claimNumber || 'Bill'} saved successfully!` }));
        if (onSuccess) onSuccess(createdClaim);
        onClose();
      }
    } catch (err) {
      setLoading(false);
      console.error('Failed to create claim:', err);
      const msg = err.response?.data?.message || 'Failed to generate billing claim.';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-200">

        {/* Modal Header */}
        <div className="bg-[#1A3C8F] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sky-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">Generate Medical / Dental Treatment Bill</h2>
              <p className="text-[10px] text-white/70">Create patient invoice & treatment charges summary (₹ INR)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {paymentState === 'paid' ? (
          /* PAYMENT SUCCESS SCREEN */
          <div className="p-8 text-center space-y-5">
            <div className="w-20 h-20 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 size={44} />
            </div>
            <div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-3 py-1 rounded-full">
                🎉 Payment Received & Settled
              </span>
              <p className="text-3xl font-black text-[#0F1A3A] mt-3">
                ₹{Number(paidClaimInfo?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {paidClaimInfo?.patientName} • Bill #{paidClaimInfo?.claimNumber}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 text-xs text-left font-medium space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-800 text-sm">
                <CheckCircle2 size={16} /> Payment Verified Successfully!
              </p>
              <p className="text-[11px] text-emerald-700">
                • Official receipt emailed to patient.<br />
                • Doctor payment split processed automatically.
              </p>
            </div>
            <button
              onClick={() => { setPaymentState(null); setPaidClaimInfo(null); onClose(); }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-bold shadow-md rounded-xl flex items-center justify-center gap-2"
            >
              <Check size={16} /> Done — Close Window
            </button>
          </div>
        ) : (
          /* REGULAR FORM BODY */
          <form onSubmit={e => handleSubmit(e, false)} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">

          {/* Section 1: Patient Identity & Live Backend Search */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Patient Demographics</h3>
              <span className="text-[9px] font-bold text-[#1A3C8F] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                <Search size={10} /> Live Backend Search
              </span>
            </div>

            {/* Live Patient Search Input */}
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Search Patient in Database (Name / ID / Phone)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to search e.g. Muskan, PAT-95600, or phone number..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-8 p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                />
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                {searching && <Loader2 size={14} className="absolute right-2.5 top-2.5 text-[#1A3C8F] animate-spin" />}
              </div>

              {/* Auto-complete Search Results Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((p, idx) => (
                    <div
                      key={p.id || p.patientId || idx}
                      onClick={() => handleSelectPatient(p)}
                      className="p-2.5 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#1A3C8F]/10 text-[#1A3C8F] flex items-center justify-center font-bold text-xs shrink-0">
                          <UserCheck size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{p.displayName || p.patientName || 'Unnamed Patient'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            ID: {p.patientId || p.id} {p.phone || p.patientPhone ? `• Phone: ${p.phone || p.patientPhone}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#1A3C8F] bg-blue-50 px-2 py-0.5 rounded">Select →</span>
                    </div>
                  ))}
                </div>
              )}

              {showDropdown && !searching && searchResults.length === 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl p-3 shadow-lg z-50 text-center text-xs text-slate-400 italic">
                  No matching patients found in database. You can manually enter details below.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Patient ID / Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAT-95600 or Muskan-29"
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Patient Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Muskan Kukkreja"
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Payer Insurance / Payment Type */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Payment / Billing Category</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PAYER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPayerId(opt.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    payerId === opt.id
                      ? 'bg-[#1A3C8F]/10 border-[#1A3C8F] ring-1 ring-[#1A3C8F] shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full font-bold text-xs text-slate-800">
                    <span>{opt.logo} {opt.label}</span>
                    {payerId === opt.id && <Check size={14} className="text-[#1A3C8F]" />}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">Receipt / Ref / Policy Number</label>
              <input
                type="text"
                placeholder="e.g. REC-2020-01 or Policy ID"
                value={payerDetails}
                onChange={e => setPayerDetails(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Diagnosis & Clinic Context */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Diagnosis & Doctor Context</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Primary Diagnosis Code</label>
                <select
                  value={icdCode}
                  onChange={e => setIcdCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                >
                  {COMMON_DIAGNOSES.map(d => (
                    <option key={d.code} value={d.code}>{d.code} — {d.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Attending Doctor (Agreed Payment Recipient) *</label>
                {doctorsList.length > 0 ? (
                  <select
                    value={providerBillingNumber}
                    onChange={e => setProviderBillingNumber(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                  >
                    {doctorsList.map(d => (
                      <option key={d.id || d.doctorUserId} value={d.doctorName || d.doctorUserId}>
                        👨‍⚕️ {d.doctorName} ({d.commissionPercent || 15}% Agreed Payment)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={providerBillingNumber}
                    onChange={e => setProviderBillingNumber(e.target.value)}
                    placeholder="e.g. Dr Kshitiz / Dr Swati"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Treatment Procedures Ledger */}
          <div className="space-y-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Treatment Procedures & Charges (₹ INR)</h3>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-[10px] font-bold text-[#1A3C8F] underline cursor-pointer"
              >
                {isCustom ? '← Select Preset Procedure' : '+ Add Custom Charge'}
              </button>
            </div>

            {isCustom ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Custom Procedure (e.g. Scaling & Polishing)"
                  value={customDescription}
                  onChange={e => setCustomDescription(e.target.value)}
                  className="sm:col-span-2 bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedServiceCode}
                  onChange={e => setSelectedServiceCode(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                >
                  {COMMON_SERVICES.map(s => (
                    <option key={s.code} value={s.code}>{s.description} — ₹{s.rate.toFixed(2)}</option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  value={addQuantity}
                  onChange={e => setAddQuantity(parseInt(e.target.value) || 1)}
                  className="w-16 bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-center text-slate-800 focus:ring-2 focus:ring-[#1A3C8F] focus:outline-none"
                />

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-[#1A3C8F] hover:bg-[#153278] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            )}

            {isCustom && (
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full bg-[#1A3C8F] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Add Custom Treatment Charge
              </button>
            )}

            {/* Added line items table */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {items.length === 0 ? (
                <p className="text-center text-xs text-slate-400 italic py-4 bg-white rounded-lg border border-dashed border-slate-200">
                  No treatment charges attached yet.
                </p>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs gap-3 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.description}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{item.serviceCode} • ₹{item.unitPrice.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => handleQuantityChange(idx, e.target.value)}
                        className="w-14 bg-slate-50 border border-slate-300 rounded p-1 text-center font-bold text-xs"
                      />
                      <span className="font-mono font-bold text-emerald-700 text-xs">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Row */}
            <div className="bg-[#1A3C8F] text-white p-3 rounded-lg flex justify-between items-center mt-2">
              <span className="text-xs font-bold opacity-90">Total Bill Amount (INR)</span>
              <span className="text-base font-black">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={e => handleSubmit(e, false)}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Save Claim Only
            </button>

            <button
              type="button"
              onClick={e => handleSubmit(e, true)}
              disabled={loading || totalAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              💳 Save & Pay Now (Razorpay)
            </button>
          </div>

        </form>
        )}

      </div>
    </div>
  );
}

