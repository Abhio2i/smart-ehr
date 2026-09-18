import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import client from '../api/client';
import {
  Zap, QrCode, Send, User, Mail, Phone, IndianRupee,
  FileText, Stethoscope, Copy, CheckCircle2, ExternalLink,
  AlertCircle, Loader2, ArrowLeft
} from 'lucide-react';

export default function QuickPay() {
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
    client.get('/api/users/specialists?query=').then(r => setDoctors(r.data || [])).catch(() => {});
  }, []);

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

  const resetForm = () => {
    setResult(null);
    setError('');
    setForm(f => ({ ...f, patientName: '', patientEmail: '', patientPhone: '', amount: '', description: '' }));
  };

  // ── RESULT VIEW ────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6 pb-10 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={resetForm} className="p-2 rounded-xl bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="section-label mb-1">Quick Pay</p>
            <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Payment Link <span className="text-emerald-600">Created ✓</span></h1>
          </div>
        </div>

        <div className="card p-8 max-w-lg mx-auto text-center space-y-6">
          {/* Success icon */}
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>

          {/* Amount */}
          <div>
            <p className="text-sm text-[#8A97B0] font-semibold uppercase tracking-wider">Bill Amount</p>
            <p className="text-4xl font-black text-[#0F1A3A] mt-1">₹{Number(result.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <p className="text-sm text-[#8A97B0] mt-1">{result.patientName} • {result.claimNumber}</p>
          </div>

          {/* QR Code */}
          <div className="bg-[#F8FAFF] border-2 border-dashed border-[#DDE3F0] rounded-2xl p-6">
            <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mb-3">Scan QR to Pay</p>
            <div className="bg-white p-4 rounded-xl inline-block shadow-sm border border-[#E8ECF8]">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.shortUrl)}`}
                alt="Payment QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="text-xs text-[#A0AECB] mt-3">Patient can scan with any UPI app (PhonePe, GPay, Paytm)</p>
          </div>

          {/* Payment Link */}
          <div className="bg-[#F0F4FC] rounded-xl p-4 text-left">
            <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mb-2">Payment Link</p>
            <div className="flex items-center gap-2">
              <input
                value={result.shortUrl}
                readOnly
                className="input text-sm flex-1 bg-white font-mono"
              />
              <button onClick={copyLink} className="btn-primary px-4 py-2.5 text-sm shrink-0">
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Share Actions */}
          <div className="flex gap-3">
            <a href={result.shortUrl} target="_blank" rel="noopener noreferrer"
              className="btn-ghost border border-[#DDE3F0] flex-1 justify-center px-4 py-3 rounded-xl text-sm">
              <ExternalLink size={16} /> Open Link
            </a>
            <button onClick={resetForm}
              className="btn-primary flex-1 justify-center px-4 py-3 text-sm">
              <Zap size={16} /> New Quick Pay
            </button>
          </div>

          {/* Email Status */}
          {form.patientEmail && (
            <div className="flex items-center gap-2 justify-center text-sm text-emerald-600 bg-emerald-50 rounded-xl py-2 px-4 border border-emerald-100">
              <Mail size={14} />
              Payment link emailed to <strong>{form.patientEmail}</strong>
            </div>
          )}

          <p className="text-xs text-[#A0AECB]">Link expires in 24 hours. Receipt & doctor split happens automatically on payment.</p>
        </div>
      </div>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div>
        <p className="section-label mb-1">Billing</p>
        <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
          <Zap size={24} className="inline text-brand-blue mr-1" />
          Quick <span className="text-brand-blue">Pay</span>
        </h1>
        <p className="text-sm text-[#8A97B0] mt-0.5">Generate instant payment QR code & link — patient pays in 1 scan</p>
      </div>

      {/* Form Card */}
      <div className="card p-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-brand-red text-sm font-semibold">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {/* Patient Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Patient Name *</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                className="input pl-10"
                placeholder="Enter patient name"
                value={form.patientName}
                onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                type="number"
                min="1"
                step="0.01"
                className="input pl-10 text-xl font-black"
                placeholder="500.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Patient Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Patient Email (for payment link)</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                type="email"
                className="input pl-10"
                placeholder="patient@email.com"
                value={form.patientEmail}
                onChange={e => setForm(f => ({ ...f, patientEmail: e.target.value }))}
              />
            </div>
          </div>

          {/* Patient Phone */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Patient Phone</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input
                className="input pl-10"
                placeholder="+91 9876543210"
                value={form.patientPhone}
                onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Description</label>
            <div className="relative">
              <FileText size={16} className="absolute left-3.5 top-3 text-[#A0AECB]" />
              <textarea
                className="input pl-10 min-h-[70px] resize-none"
                placeholder="Consultation fee, Treatment, etc."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          {/* Doctor Select */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Assign Doctor (for auto-split)</label>
            <div className="relative">
              <Stethoscope size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <select
                className="input pl-10"
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
                <option value="">No doctor (skip auto-split)</option>
                {doctors.filter(d => d.role === 'PHYSICIAN').map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !form.patientName || !form.amount}
            className="btn-primary w-full justify-center py-3.5 text-base font-bold"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Generating...</>
            ) : (
              <><QrCode size={18} /> Generate QR & Payment Link</>
            )}
          </button>

          <p className="text-xs text-center text-[#A0AECB]">
            Patient gets email with pay link. Show QR on screen for instant scan. Auto receipt + doctor split on payment.
          </p>
        </form>
      </div>
    </div>
  );
}
