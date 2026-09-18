import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import client from '../../api/client';
import {
  Zap, QrCode, Mail, Phone, IndianRupee, FileText, Stethoscope,
  Copy, CheckCircle2, ExternalLink, AlertCircle, Loader2, X, User
} from 'lucide-react';

export default function QuickPayModal({ isOpen, onClose, onSuccess }) {
  const user = useSelector(selectUser);
  const [form, setForm] = useState({
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    amount: '',
    description: '',
    doctorUserId: user?.userId || '',
    doctorName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
  });

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      client.get('/api/users/specialists?query=').then(r => setDoctors(r.data || [])).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount)
      };
      const res = await client.post('/api/billing/quick-pay', payload);
      setResult(res.data);
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to create payment link';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (result?.shortUrl) {
      navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRazorpayCheckout = async () => {
    if (!result || !result.claimId) return;
    try {
      const cId = result.claimId;
      const orderRes = await client.post(`/api/patient-portal/billing/claims/${cId}/razorpay-order`).catch(() => null);
      if (!orderRes || !orderRes.data || !orderRes.data.orderId) {
        alert('⚠️ Online Gateway not configured. Please use QR code or setup API keys in Provider Payments.');
        return;
      }
      const orderData = orderRes.data;
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Smart-eHR Medical Billing',
        description: `Quick Pay Invoice #${result.claimNumber || cId}`,
        order_id: orderData.orderId,
        prefill: {
          name: result.patientName || 'Patient'
        },
        handler: async function (response) {
          try {
            await client.post(`/api/patient-portal/billing/claims/${cId}/razorpay-verify`, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            alert('🎉 Payment completed & settled successfully!');
            handleClose();
          } catch (err) {
            alert('Payment verification failed.');
          }
        },
        theme: { color: '#1A3C8F' }
      };
      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        alert('Razorpay SDK loading... Please retry in a second.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to open payment gateway.');
    }
  };

  const handleClose = () => {
    setResult(null);
    setError('');
    setForm({
      patientName: '',
      patientEmail: '',
      patientPhone: '',
      amount: '',
      description: '',
      doctorUserId: user?.userId || '',
      doctorName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-[#DDE3F0]">
        
        {/* Header */}
        <div className="bg-[#1A3C8F] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold">
              <Zap size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Quick Pay (Instant QR)</h2>
              <p className="text-xs text-white/70">Create instant payment link & QR code for patient</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {result ? (
            /* Result View: QR & Link */
            <div className="text-center space-y-5">
              <div className="w-14 h-14 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>

              <div>
                <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider">Bill Created</p>
                <p className="text-3xl font-black text-[#0F1A3A] mt-1">₹{Number(result.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-[#8A97B0] mt-1">{result.patientName} • {result.claimNumber}</p>
              </div>

              {/* QR Code */}
              <div className="bg-[#F8FAFF] border-2 border-dashed border-[#DDE3F0] rounded-2xl p-4">
                <p className="text-[11px] text-[#8A97B0] font-bold uppercase tracking-wider mb-2">Scan QR with GPay / PhonePe / Paytm</p>
                <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-[#E8ECF8]">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.shortUrl)}`}
                    alt="Payment QR Code"
                    className="w-44 h-44 mx-auto"
                  />
                </div>
              </div>

              {/* Payment Link */}
              <div className="bg-[#F0F4FC] rounded-xl p-3 text-left">
                <p className="text-[10px] text-[#8A97B0] font-bold uppercase tracking-wider mb-1.5">Payment Link</p>
                <div className="flex items-center gap-2">
                  <input value={result.shortUrl} readOnly className="input text-xs flex-1 bg-white font-mono py-2" />
                  <button onClick={copyLink} className="btn-primary px-3 py-2 text-xs shrink-0">
                    {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {form.patientEmail && (
                <div className="flex items-center gap-2 justify-center text-xs text-emerald-600 bg-emerald-50 rounded-xl py-2 px-3 border border-emerald-100">
                  <Mail size={14} />
                  Payment link emailed to <strong>{form.patientEmail}</strong>
                </div>
              )}



              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleRazorpayCheckout}
                  className="bg-[#1A3C8F] hover:bg-[#132A6B] text-white flex-1 justify-center py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                >
                  <ExternalLink size={14} /> Pay Popup
                </button>
                <a href={result.shortUrl} target="_blank" rel="noopener noreferrer"
                  className="btn-ghost border border-[#DDE3F0] flex-1 justify-center py-2.5 text-xs">
                  <ExternalLink size={14} /> Open Link
                </a>
                <button onClick={() => setResult(null)} className="btn-primary flex-1 justify-center py-2.5 text-xs">
                  <Zap size={14} /> New Quick Pay
                </button>
              </div>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-brand-red text-xs font-semibold">
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </div>
              )}

              {/* Patient Name */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Patient Name *</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                  <input
                    className="input pl-9 text-xs py-2.5"
                    placeholder="Enter patient name"
                    value={form.patientName}
                    onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Amount (₹) *</label>
                <div className="relative">
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    className="input pl-9 text-lg font-black py-2"
                    placeholder="500.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Patient Email */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Patient Email (for link & receipt)</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                  <input
                    type="email"
                    className="input pl-9 text-xs py-2.5"
                    placeholder="patient@email.com"
                    value={form.patientEmail}
                    onChange={e => setForm(f => ({ ...f, patientEmail: e.target.value }))}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Description / Notes</label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3 top-3 text-[#A0AECB]" />
                  <textarea
                    className="input pl-9 text-xs py-2 min-h-[60px] resize-none"
                    placeholder="Consultation fee, Dental cleaning, Emergency care, etc."
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Doctor Select */}
              <div>
                <label className="block text-[11px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Assign Doctor (for auto payment split)</label>
                <div className="relative">
                  <Stethoscope size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                  <select
                    className="input pl-9 text-xs py-2.5"
                    value={form.doctorUserId}
                    onChange={e => {
                      const doc = doctors.find(d => d.id === e.target.value);
                      setForm(f => ({
                        ...f,
                        doctorUserId: e.target.value,
                        doctorName: doc ? `${doc.firstName} ${doc.lastName}` : ''
                      }));
                    }}
                  >
                    <option value="">No doctor (skip payment split)</option>
                    {doctors.filter(d => d.role === 'PHYSICIAN').map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !form.patientName || !form.amount}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all mt-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                Generate QR & Payment Link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
