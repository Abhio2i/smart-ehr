import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plane, BedDouble, Ticket, Plus, RefreshCw, X, ChevronDown,
  Calendar, MapPin, User, Hash, DollarSign, FileText,
  CheckCircle2, Clock, XCircle, Loader2, AlertTriangle, Trash2
} from 'lucide-react';
import client from '../api/client';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/slices/uiSlice';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (str) => {
  if (!str) return '—';
  try { return new Date(str).toLocaleDateString('en-CA', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return str; }
};

const fmtDateTime = (str) => {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('en-CA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return str; }
};

const STATUS_META = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200',   icon: Clock },
  APPROVED:  { label: 'Approved',  cls: 'bg-blue-100 text-blue-700 border-blue-200',      icon: CheckCircle2 },
  BOOKED:    { label: 'Booked',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  COMPLETED: { label: 'Completed', cls: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 border-red-200',         icon: XCircle },
  SUBMITTED: { label: 'Submitted', cls: 'bg-purple-100 text-purple-700 border-purple-200', icon: FileText },
  PAID:      { label: 'Paid',      cls: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700 border-red-200',         icon: XCircle },
  DRAFT:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-600 border-gray-200',      icon: FileText },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.PENDING;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.cls}`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
};

const TRANSPORT_TYPES = ['FLIGHT', 'GROUND', 'AIR_AMBULANCE', 'HELICOPTER', 'WATER'];

// ── Travel Requests Tab ───────────────────────────────────────────────────────
const TravelRequestsTab = () => {
  const dispatch = useDispatch();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    patientId: '', patientName: '', sourceFacility: '',
    destinationFacility: '', travelDate: '', transportType: 'FLIGHT',
    organizationId: 'org-default',
  });
  const [formError, setFormError] = useState('');

  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId');
  const queryPatientName = searchParams.get('patientName');

  const prefillSourceFromLastRequest = (targetPatientId) => {
    const patientRequests = requests
      .filter(r => r.patientId === targetPatientId)
      .sort((a, b) => new Date(a.travelDate || a.createdAt) - new Date(b.travelDate || b.createdAt));
    if (patientRequests.length > 0) {
      const lastRequest = patientRequests[patientRequests.length - 1];
      return lastRequest.destinationFacility || '';
    }
    return '';
  };

  useEffect(() => {
    if (queryPatientId) {
      const defaultSource = prefillSourceFromLastRequest(queryPatientId);
      setForm(f => ({
        ...f,
        patientId: queryPatientId,
        patientName: queryPatientName || '',
        sourceFacility: defaultSource || f.sourceFacility
      }));
      setPatientSearch(queryPatientName || '');
      setIsModalOpen(true);
    }
  }, [queryPatientId, queryPatientName, requests]);

  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    setSearchingPatient(true);
    const delayDebounceFn = setTimeout(() => {
      client.get('/api/admin/patients/search', { params: { query: patientSearch, limit: 10 } })
        .then(res => {
          setPatientResults(res.data || []);
          setShowPatientDropdown(true);
        })
        .catch(() => {})
        .finally(() => setSearchingPatient(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [patientSearch]);

  const selectPatient = (p) => {
    const targetPatientId = p.patientId || p.id;
    const defaultSource = prefillSourceFromLastRequest(targetPatientId);
    setForm(f => ({
      ...f,
      patientId: targetPatientId,
      patientName: p.displayName || p.patientName || '',
      sourceFacility: defaultSource,
    }));
    setPatientSearch(p.displayName || p.patientName || '');
    setShowPatientDropdown(false);
  };

  const loadRequests = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await client.get('/api/travel/requests');
      setRequests(res.data || []);
    } catch (e) {
      setError('Failed to load travel requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const openCreate = () => {
    setForm({ patientId: '', patientName: '', sourceFacility: '', destinationFacility: '', travelDate: '', transportType: 'FLIGHT', organizationId: 'org-default' });
    setPatientSearch('');
    setPatientResults([]);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patientId.trim() || !form.sourceFacility.trim() || !form.destinationFacility.trim() || !form.travelDate) {
      setFormError('Patient ID, source, destination, and travel date are required.');
      return;
    }
    setSubmitting(true); setFormError('');
    try {
      await client.post('/api/travel/requests', form);
      dispatch(addToast({ type: 'success', message: 'Medical Travel Request submitted successfully!' }));
      setIsModalOpen(false);
      loadRequests();
    } catch (e) {
      setFormError(e?.response?.data?.message || 'Failed to create travel request.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = (req) => { setSelectedReq(req); setIsDetailOpen(true); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-[#0F1A3A] text-base">Travel Requests</h3>
          <p className="text-xs text-[#8A97B0] mt-0.5">Manage patient medical travel bookings and approvals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadRequests} disabled={loading} className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={openCreate} className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5">
            <Plus size={13} /> New Request
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F0F4FC] bg-[#F7F9FD]">
                {['Patient', 'Route', 'Travel Date', 'Transport', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#4B5A7A] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FC]">
              {loading && requests.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-[#F0F4FC] rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : requests.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center">
                  <Plane size={36} className="mx-auto text-[#C4CDD9] mb-3" />
                  <p className="text-sm font-bold text-[#4B5A7A]">No Travel Requests Found</p>
                  <p className="text-xs text-[#8A97B0]">Click "New Request" to submit a patient travel request.</p>
                </td></tr>
              ) : requests.map(req => (
                <tr key={req.id} className="hover:bg-[#F7F9FD] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#0F1A3A] text-xs">{req.patientName || '—'}</p>
                    <p className="text-[10px] text-[#8A97B0] font-mono">{req.patientId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-[#4B5A7A]">
                      <span className="font-semibold">{req.sourceFacility}</span>
                      <span className="text-[#C4CDD9]">→</span>
                      <span className="font-semibold">{req.destinationFacility}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#4B5A7A]">{fmtDate(req.travelDate)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#4B5A7A] bg-[#F0F4FC] px-2 py-0.5 rounded-full">
                      <Plane size={10} /> {req.transportType}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => viewDetail(req)} className="text-xs text-brand-blue font-bold hover:underline">
                        View Details
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to delete this travel request?")) {
                            try {
                              await client.delete(`/api/travel/requests/${req.id}`);
                              dispatch(addToast({ type: 'success', message: 'Medical Travel Request deleted successfully!' }));
                              loadRequests();
                            } catch (e) {
                              dispatch(addToast({ type: 'error', message: 'Failed to delete travel request.' }));
                            }
                          }
                        }}
                        className="text-xs text-red-600 font-bold hover:text-red-800 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                  <Plane size={14} className="text-brand-blue" />
                </div>
                <h3 className="font-black text-[#0F1A3A]">New Travel Request</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#8A97B0] hover:text-[#0F1A3A]"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 relative">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Search &amp; Select Patient *</label>
                  <div className="relative">
                    <input
                      value={patientSearch}
                      onChange={e => {
                        setPatientSearch(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      className="form-input text-sm w-full pl-8"
                      placeholder="Type patient name, phone, or ID to search..."
                    />
                    <User className="absolute left-2.5 top-2.5 text-[#8A97B0]" size={14} />
                    {searchingPatient && (
                      <Loader2 className="absolute right-2.5 top-2.5 text-brand-blue animate-spin" size={14} />
                    )}
                  </div>

                  {/* Autocomplete dropdown overlay */}
                  {showPatientDropdown && patientResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-[#DDE3F0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-[#F0F4FC] custom-scrollbar">
                      {patientResults.map(p => (
                        <button
                          key={p.patientId || p.id}
                          type="button"
                          onClick={() => selectPatient(p)}
                          className="w-full text-left px-4 py-2 hover:bg-[#F8FAFF] transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-[#0F1A3A]">{p.displayName || p.patientName}</p>
                            <p className="text-[10px] text-[#8A97B0] mt-0.5">ID: {p.patientId || p.id} · DOB: {p.patientDateOfBirth || p.dateOfBirth || '—'}</p>
                          </div>
                          {p.phone && <span className="text-[10px] text-[#4B5A7A] font-bold">{p.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Patient Banner */}
                  {form.patientId && (
                    <div className="mt-2 bg-[#F0F4FC] border border-[#DDE3F0] rounded-lg p-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-brand-blue uppercase tracking-wide">Selected Patient</p>
                        <p className="text-xs font-black text-[#0F1A3A] mt-0.5">{form.patientName}</p>
                        <p className="text-[9px] text-[#4B5A7A] font-bold">ID: {form.patientId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, patientId: '', patientName: '' }));
                          setPatientSearch('');
                        }}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Source Facility *</label>
                  <input value={form.sourceFacility} onChange={e => setForm({ ...form, sourceFacility: e.target.value })}
                    className="form-input text-sm w-full" placeholder="e.g. Stanton Territorial Hospital" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Destination Facility *</label>
                  <input value={form.destinationFacility} onChange={e => setForm({ ...form, destinationFacility: e.target.value })}
                    className="form-input text-sm w-full" placeholder="e.g. Alberta Health Services" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Travel Date *</label>
                  <input type="date" value={form.travelDate} onChange={e => setForm({ ...form, travelDate: e.target.value })}
                    className="form-input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Transport Type</label>
                  <select value={form.transportType} onChange={e => setForm({ ...form, transportType: e.target.value })}
                    className="form-input text-sm w-full">
                    {TRANSPORT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              {formError && <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost text-sm px-4 py-2">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {isDetailOpen && selectedReq && (
        <RequestDetailPanel
          req={selectedReq}
          onClose={() => { setIsDetailOpen(false); setSelectedReq(null); }}
          onRefresh={loadRequests}
        />
      )}
    </div>
  );
};

// ── Request Detail Panel ──────────────────────────────────────────────────────
const RequestDetailPanel = ({ req, onClose, onRefresh }) => {
  const dispatch = useDispatch();
  const [accommodation, setAccommodation] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null); // 'accommodation' | 'voucher' | 'status'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Status update
  const [newStatus, setNewStatus] = useState(req.status);
  const [flightNumber, setFlightNumber] = useState(req.flightNumber || '');

  // Accommodation form
  const [hotel, setHotel] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [accomCost, setAccomCost] = useState('');

  // Voucher form
  const [voucherAmount, setVoucherAmount] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');

  const handleToggleAccommodation = () => {
    if (activeSection === 'accommodation') {
      setActiveSection(null);
    } else {
      if (accommodation) {
        setHotel(accommodation.hotelName || '');
        setCheckIn(accommodation.checkInDate ? accommodation.checkInDate.substring(0, 10) : '');
        setCheckOut(accommodation.checkOutDate ? accommodation.checkOutDate.substring(0, 10) : '');
        setAccomCost(accommodation.cost ? accommodation.cost.toString() : '');
      } else {
        setHotel('');
        setCheckIn('');
        setCheckOut('');
        setAccomCost('');
      }
      setActiveSection('accommodation');
    }
  };

  const handleToggleVoucher = () => {
    if (activeSection === 'voucher') {
      setActiveSection(null);
    } else {
      if (voucher) {
        setVoucherAmount(voucher.amount ? voucher.amount.toString() : '');
        setVoucherNotes(voucher.notes || '');
      } else {
        setVoucherAmount('');
        setVoucherNotes('');
      }
      setActiveSection('voucher');
    }
  };

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, vcRes] = await Promise.allSettled([
        client.get(`/api/travel/requests/${req.id}/accommodation`),
        client.get(`/api/travel/requests/${req.id}/voucher`),
      ]);
      if (accRes.status === 'fulfilled') setAccommodation(accRes.value.data);
      if (vcRes.status === 'fulfilled') setVoucher(vcRes.value.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, [req.id]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const handleStatusUpdate = async () => {
    setSubmitting(true); setError('');
    try {
      await client.put(`/api/travel/requests/${req.id}/status`, null, {
        params: { status: newStatus, flightNumber: flightNumber || undefined },
      });
      dispatch(addToast({ type: 'success', message: 'Travel status updated successfully!' }));
      setActiveSection(null);
      onRefresh();
    } catch (e) { setError(e?.response?.data?.message || 'Status update failed.'); }
    finally { setSubmitting(false); }
  };

  const handleAccommodationCreate = async () => {
    if (!hotel.trim() || !checkIn || !checkOut) { setError('Hotel, check-in, and check-out dates are required.'); return; }
    setSubmitting(true); setError('');
    try {
      await client.post(`/api/travel/requests/${req.id}/accommodation`, {
        hotelName: hotel, checkInDate: checkIn, checkOutDate: checkOut,
        cost: accomCost ? parseFloat(accomCost) : null,
      });
      dispatch(addToast({ type: 'success', message: 'Accommodation details saved successfully!' }));
      setActiveSection(null);
      loadDetails();
    } catch (e) { setError(e?.response?.data?.message || 'Failed to save accommodation.'); }
    finally { setSubmitting(false); }
  };

  const handleVoucherCreate = async () => {
    if (!voucherAmount) { setError('Voucher amount is required.'); return; }
    setSubmitting(true); setError('');
    try {
      await client.post(`/api/travel/requests/${req.id}/vouchers`, null, {
        params: { amount: parseFloat(voucherAmount), notes: voucherNotes || undefined },
      });
      dispatch(addToast({ type: 'success', message: 'Travel voucher details saved successfully!' }));
      setActiveSection(null);
      loadDetails();
    } catch (e) { setError(e?.response?.data?.message || 'Failed to generate voucher.'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-[#F0F4FC] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-blue/10 rounded-xl flex items-center justify-center">
              <Plane size={16} className="text-brand-blue" />
            </div>
            <div>
              <h3 className="font-black text-[#0F1A3A] text-base">Travel Request Details</h3>
              <p className="text-xs text-[#8A97B0] font-mono">{req.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#8A97B0] hover:text-[#0F1A3A]"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Core Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: User, label: 'Patient', value: `${req.patientName || 'Unknown'} (${req.patientId})` },
              { icon: Plane, label: 'Transport', value: req.transportType },
              { icon: MapPin, label: 'Route', value: `${req.sourceFacility} → ${req.destinationFacility}` },
              { icon: Calendar, label: 'Travel Date', value: fmtDate(req.travelDate) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-[#F7F9FD] rounded-xl p-3 flex items-start gap-2.5">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  <Icon size={12} className="text-brand-blue" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-[#0F1A3A]">{value || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status + Flight */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#F7F9FD] rounded-xl p-3">
              <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider mb-1">Status</p>
              <StatusBadge status={req.status} />
            </div>
            {req.flightNumber && (
              <div className="flex-1 bg-[#F7F9FD] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider mb-1">Flight #</p>
                <p className="text-sm font-bold text-[#0F1A3A]">{req.flightNumber}</p>
              </div>
            )}
            {req.flightTime && (
              <div className="flex-1 bg-[#F7F9FD] rounded-xl p-3">
                <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider mb-1">Flight Time</p>
                <p className="text-sm font-bold text-[#0F1A3A]">{fmtDateTime(req.flightTime)}</p>
              </div>
            )}
          </div>

          {error && <div className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setActiveSection(activeSection === 'status' ? null : 'status')}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
              <ChevronDown size={13} /> Update Status
            </button>
            <button onClick={handleToggleAccommodation}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
              <BedDouble size={13} /> {accommodation ? 'Update Accommodation' : 'Add Accommodation'}
            </button>
            <button onClick={handleToggleVoucher}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5">
              <Ticket size={13} /> {voucher ? 'Update Voucher' : 'Generate Voucher'}
            </button>
            <button
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete this travel request?")) {
                  try {
                    await client.delete(`/api/travel/requests/${req.id}`);
                    dispatch(addToast({ type: 'success', message: 'Medical Travel Request deleted successfully!' }));
                    onClose();
                    onRefresh();
                  } catch (e) {
                    setError('Failed to delete travel request.');
                  }
                }
              }}
              className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 size={13} /> Delete Request
            </button>
          </div>

          {/* Expandable Panels */}
          {activeSection === 'status' && (
            <div className="bg-[#F7F9FD] rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">Update Travel Status</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">New Status</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="form-input text-sm w-full">
                    {['PENDING','APPROVED','BOOKED','COMPLETED','CANCELLED'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Flight Number</label>
                  <input value={flightNumber} onChange={e => setFlightNumber(e.target.value)}
                    className="form-input text-sm w-full" placeholder="e.g. WJ 340" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleStatusUpdate} disabled={submitting} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  {submitting ? 'Saving…' : 'Save Status'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'accommodation' && (
            <div className="bg-[#F7F9FD] rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">
                {accommodation ? 'Update Accommodation / Lodging' : 'Add Accommodation / Lodging'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Hotel / Accommodation Name *</label>
                  <input value={hotel} onChange={e => setHotel(e.target.value)} className="form-input text-sm w-full" placeholder="e.g. Yellowknife Inn" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Check-In Date *</label>
                  <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className="form-input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Check-Out Date *</label>
                  <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className="form-input text-sm w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Est. Cost (CAD)</label>
                  <input type="number" value={accomCost} onChange={e => setAccomCost(e.target.value)} className="form-input text-sm w-full" placeholder="0.00" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleAccommodationCreate} disabled={submitting} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <BedDouble size={12} />}
                  {submitting ? 'Saving…' : accommodation ? 'Update Accommodation' : 'Save Accommodation'}
                </button>
              </div>
            </div>
          )}

          {activeSection === 'voucher' && (
            <div className="bg-[#F7F9FD] rounded-xl p-4 space-y-3">
              <p className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">
                {voucher ? 'Update Travel Voucher' : 'Generate Travel Voucher'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Amount (CAD) *</label>
                  <input type="number" value={voucherAmount} onChange={e => setVoucherAmount(e.target.value)} className="form-input text-sm w-full" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4B5A7A] mb-1">Notes</label>
                  <input value={voucherNotes} onChange={e => setVoucherNotes(e.target.value)} className="form-input text-sm w-full" placeholder="e.g. Meals and taxi" />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleVoucherCreate} disabled={submitting} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />}
                  {submitting ? 'Saving…' : voucher ? 'Update Voucher' : 'Generate Voucher'}
                </button>
              </div>
            </div>
          )}

          {/* Accommodation Summary */}
          {accommodation && (
            <div className="rounded-xl border border-[#E8EEFA] overflow-hidden">
              <div className="bg-[#F0F4FC] px-4 py-2 flex items-center gap-2">
                <BedDouble size={13} className="text-brand-blue" />
                <p className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">Accommodation</p>
                <StatusBadge status={accommodation.status} />
              </div>
              <div className="grid grid-cols-3 gap-0 divide-x divide-[#F0F4FC]">
                {[
                  { label: 'Hotel', value: accommodation.hotelName },
                  { label: 'Check-In', value: fmtDate(accommodation.checkInDate) },
                  { label: 'Check-Out', value: fmtDate(accommodation.checkOutDate) },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-[#0F1A3A]">{value || '—'}</p>
                  </div>
                ))}
              </div>
              {accommodation.cost && (
                <div className="border-t border-[#F0F4FC] px-4 py-2 text-xs text-[#4B5A7A]">
                  <span className="font-bold">Estimated Cost:</span> CAD ${accommodation.cost.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Voucher Summary */}
          {voucher && (
            <div className="rounded-xl border border-[#E8EEFA] overflow-hidden">
              <div className="bg-[#F0F4FC] px-4 py-2 flex items-center gap-2">
                <Ticket size={13} className="text-brand-blue" />
                <p className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">Travel Voucher</p>
                <StatusBadge status={voucher.status} />
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#F0F4FC]">
                {[
                  { label: 'Voucher #', value: voucher.voucherNumber },
                  { label: 'Amount (CAD)', value: voucher.amount ? `$${voucher.amount.toFixed(2)}` : '—' },
                  { label: 'Approved By', value: voucher.approvedBy || 'Pending' },
                ].map(({ label, value }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-[#0F1A3A]">{value}</p>
                  </div>
                ))}
              </div>
              {voucher.notes && (
                <div className="border-t border-[#F0F4FC] px-4 py-2 text-xs text-[#4B5A7A]">
                  <span className="font-bold">Notes:</span> {voucher.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main MedicalTravel Page ───────────────────────────────────────────────────
const MedicalTravel = () => {
  return (
    <div className="p-5 space-y-5 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-blue to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Plane size={16} className="text-white" />
            </div>
            <h1 className="font-black text-[#0F1A3A] text-xl">Medical Travel Management</h1>
          </div>
          <p className="text-sm text-[#8A97B0] ml-10">
            Coordinate patient travel, flight bookings, lodging, and reimbursement vouchers
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#F7F9FD] rounded-xl px-4 py-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-[#4B5A7A]">NWT Medical Travel Active</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Pending Requests', icon: Clock, color: 'bg-amber-50 text-amber-600' },
          { label: 'Booked Flights', icon: Plane, color: 'bg-blue-50 text-blue-600' },
          { label: 'Active Lodgings', icon: BedDouble, color: 'bg-purple-50 text-purple-600' },
          { label: 'Vouchers Issued', icon: Ticket, color: 'bg-green-50 text-green-600' },
        ].map(({ label, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-[#0F1A3A]">—</p>
              <p className="text-xs text-[#8A97B0]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="card p-6">
        <TravelRequestsTab />
      </div>
    </div>
  );
};

export default MedicalTravel;
