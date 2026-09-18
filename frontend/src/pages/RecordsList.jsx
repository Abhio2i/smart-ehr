import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Plus, Search, FileEdit, Trash2, Eye, RefreshCw, X,
  Send, AlertCircle, MapPin, FileText, AlertTriangle,
  User, Heart, Activity, Clock, Truck, Shield, Plane, BedDouble, Ticket, CheckCircle2, XCircle, Loader2, ZoomIn, Share2
} from 'lucide-react';
import RecordShareModal from '../components/sharing/RecordShareModal';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import {
  fetchRecords as fetchEpcrRecords, deleteRecord,
  submitRecord, selectRecords, selectEpcrLoading, selectEpcrPagination,
  fetchIncidentTypes, selectIncidentTypes
} from '../store/slices/epcrSlice';
import { fetchAllPatientHistory } from '../store/slices/patientHistorySlice';
import client, { extractErrorMessage } from '../api/client';
import { fetchUnreadNotifications } from '../store/slices/notificationSlice';
import AiSuggestionPanel from '../components/common/AiSuggestionPanel';

// ── Medical Travel Card (shown inside ePCR detail view) ───────────────────────
const TRAVEL_STATUS_META = {
  PENDING:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700',   icon: Clock },
  APPROVED:  { label: 'Approved',  cls: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  BOOKED:    { label: 'Booked',    cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  COMPLETED: { label: 'Completed', cls: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700',       icon: XCircle },
  SUBMITTED: { label: 'Submitted', cls: 'bg-purple-100 text-purple-700', icon: FileText },
  PAID:      { label: 'Paid',      cls: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  REJECTED:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700',       icon: XCircle },
};

const TravelStatusBadge = ({ status }) => {
  const meta = TRAVEL_STATUS_META[status] || TRAVEL_STATUS_META.PENDING;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.cls}`}>
      <Icon size={10} /> {meta.label}
    </span>
  );
};

const MedicalTravelCard = ({ epcrId, patientId, epcrRecord }) => {
  const dispatch = useDispatch();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submittingTravel, setSubmittingTravel] = useState(false);
  const [accomMap, setAccomMap] = useState({});
  const [voucherMap, setVoucherMap] = useState({});

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [genForm, setGenForm] = useState({
    sourceFacility: '',
    destinationFacility: '',
    transportType: 'FLIGHT',
    travelDate: ''
  });

  const handleOpenGenerate = () => {
    let defaultSource = epcrRecord?.transportDestination || 'Local Clinic/Hospital';
    let defaultDest = '';
    if (requests && requests.length > 0) {
      const sorted = [...requests].sort((a, b) => new Date(a.travelDate || a.createdAt) - new Date(b.travelDate || b.createdAt));
      const last = sorted[sorted.length - 1];
      if (last.destinationFacility) {
        defaultSource = last.destinationFacility;
      }
    }
    const defaultMode = epcrRecord?.transportMode || 'FLIGHT';
    const defaultDate = epcrRecord?.incidentDateTime ? epcrRecord.incidentDateTime.substring(0, 10) : new Date().toISOString().substring(0, 10);
    setGenForm({
      sourceFacility: defaultSource,
      destinationFacility: defaultDest,
      transportType: defaultMode.toUpperCase() === 'AIR' ? 'FLIGHT' : defaultMode,
      travelDate: defaultDate
    });
    setShowConfirmModal(true);
  };

  useEffect(() => {
    if (!epcrId && !patientId) return;
    setLoading(true);
    const fetchPromise = epcrId
      ? client.get(`/api/travel/by-epcr/${epcrId}`)
          .then(res => res.data ? [res.data] : [])
          .catch(() => patientId
            ? client.get('/api/travel/requests', { params: { patientId } }).then(r => r.data || [])
            : [])
      : client.get('/api/travel/requests', { params: { patientId } }).then(r => r.data || []);
    fetchPromise
      .then(data => setRequests(data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [epcrId, patientId]);

  useEffect(() => {
    if (requests && requests.length > 0) {
      requests.forEach(req => {
        if (!accomMap[req.id]) {
          client.get(`/api/travel/requests/${req.id}/accommodation`)
            .then(r => setAccomMap(m => ({ ...m, [req.id]: r.data })))
            .catch(() => {});
        }
        if (!voucherMap[req.id]) {
          client.get(`/api/travel/requests/${req.id}/voucher`)
            .then(r => setVoucherMap(m => ({ ...m, [req.id]: r.data })))
            .catch(() => {});
        }
      });
    }
  }, [requests]); // eslint-disable-line

  if (!epcrId && !patientId) return null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-brand-blue/10 flex items-center justify-center">
          <Plane size={13} className="text-brand-blue" />
        </div>
        <h4 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wide">Medical Travel</h4>
        {epcrId && (
          <span className="text-[9px] font-bold text-brand-blue bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
            ePCR Linked
          </span>
        )}
        <span className="ml-auto text-[10px] text-[#8A97B0] font-semibold">
          {requests.length} record{requests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2].map(i => <div key={i} className="h-12 bg-[#F0F4FC] rounded-xl animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-5 flex flex-col items-center gap-2">
          <Plane size={24} className="text-[#C4CDD9] mb-1" />
          <p className="text-xs text-[#8A97B0]">No medical travel request linked to this ePCR record yet.</p>
          <button
            type="button"
            onClick={handleOpenGenerate}
            disabled={loading}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-blue-700 text-white text-[10px] font-black px-3.5 py-1.5 rounded-lg transition-all shadow-sm uppercase tracking-wider disabled:opacity-50 mt-1"
          >
            <Plus size={10} /> Generate Travel Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div key={req.id} className="border border-[#E8EEFA] rounded-xl overflow-hidden shadow-xs">
              {/* Request Header */}
              <div className="bg-[#F7F9FD] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-[#0F1A3A]">
                    {req.sourceFacility} → {req.destinationFacility}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TravelStatusBadge status={req.status} />
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("Are you sure you want to delete this travel request?")) {
                        try {
                          await client.delete(`/api/travel/requests/${req.id}`);
                          dispatch(addToast({ type: 'success', message: 'Medical Travel Request deleted successfully!' }));
                          setRequests(prev => prev.filter(r => r.id !== req.id));
                        } catch (e) {
                          dispatch(addToast({ type: 'error', message: 'Failed to delete travel request.' }));
                        }
                      }
                    }}
                    className="text-[#8A97B0] hover:text-red-600 transition-colors p-0.5 rounded"
                    title="Delete Travel Request"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {/* Request Details */}
              <div className="grid grid-cols-3 divide-x divide-[#F0F4FC]">
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase">Transport</p>
                  <p className="text-xs font-bold text-[#4B5A7A]">{req.transportType}</p>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase">Travel Date</p>
                  <p className="text-xs font-bold text-[#4B5A7A]">
                    {req.travelDate ? new Date(req.travelDate).toLocaleDateString('en-CA', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                  </p>
                </div>
                <div className="px-4 py-2.5">
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase">Flight #</p>
                  <p className="text-xs font-bold text-[#4B5A7A]">{req.flightNumber || '—'}</p>
                </div>
              </div>

              {/* Accommodation info */}
              {accomMap[req.id] ? (
                <div className="px-4 py-3 border-t border-[#F0F4FC]">
                  <p className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <BedDouble size={10} className="text-purple-500" /> Accommodation / Lodging
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Hotel', value: accomMap[req.id].hotelName },
                      { label: 'Check-In', value: accomMap[req.id].checkInDate ? new Date(accomMap[req.id].checkInDate).toLocaleDateString('en-CA', { day:'2-digit', month:'short' }) : '—' },
                      { label: 'Check-Out', value: accomMap[req.id].checkOutDate ? new Date(accomMap[req.id].checkOutDate).toLocaleDateString('en-CA', { day:'2-digit', month:'short' }) : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#F7F9FD] rounded-lg p-2 border border-slate-100">
                        <p className="text-[8px] font-bold text-[#8A97B0] uppercase">{label}</p>
                        <p className="text-[10px] font-black text-[#0F1A3A] mt-0.5 truncate">{value || '—'}</p>
                      </div>
                    ))}
                  </div>
                  {accomMap[req.id].cost && (
                    <p className="text-[9px] text-[#4B5A7A] mt-2 font-medium">
                      Est. Cost: <span className="font-bold text-[#0F1A3A]">CAD ${accomMap[req.id].cost.toFixed(2)}</span>
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-4 py-2 border-t border-[#F0F4FC] flex items-center gap-1.5 text-[#8A97B0]">
                  <BedDouble size={10} />
                  <span className="text-[9px] italic">No accommodation booked yet.</span>
                </div>
              )}

              {/* Voucher info */}
              {voucherMap[req.id] ? (
                <div className="px-4 py-3 border-t border-[#F0F4FC]">
                  <p className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Ticket size={10} className="text-green-600" /> Travel Voucher
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="bg-[#F7F9FD] rounded-lg px-3 py-1.5 flex-1 border border-slate-100">
                      <p className="text-[8px] font-bold text-[#8A97B0] uppercase">Voucher #</p>
                      <p className="text-[10px] font-black text-[#0F1A3A] font-mono mt-0.5">{voucherMap[req.id].voucherNumber}</p>
                    </div>
                    <div className="bg-[#F7F9FD] rounded-lg px-3 py-1.5 flex-1 border border-slate-100">
                      <p className="text-[8px] font-bold text-[#8A97B0] uppercase">Amount</p>
                      <p className="text-[10px] font-black text-[#0F1A3A] mt-0.5">CAD ${voucherMap[req.id].amount?.toFixed(2)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-50 text-purple-700">
                      {voucherMap[req.id].status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 border-t border-[#F0F4FC] flex items-center gap-1.5 text-[#8A97B0]">
                  <Ticket size={10} />
                  <span className="text-[9px] italic">No voucher generated yet.</span>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleOpenGenerate}
              className="flex items-center gap-1.5 bg-[#F0F4FC] hover:bg-brand-blue hover:text-white text-brand-blue text-[9px] font-black px-3.5 py-1.5 rounded-lg transition-all shadow-xs uppercase tracking-wider"
            >
              <Plus size={10} /> Add Next Transfer Leg
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 text-left">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
              <Plane className="text-brand-blue" size={16} />
              <h4 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wide">Generate Travel Request</h4>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase mb-1">Source Facility / Location</label>
                <input
                  value={genForm.sourceFacility}
                  onChange={e => setGenForm({ ...genForm, sourceFacility: e.target.value })}
                  className="form-input text-xs w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase mb-1">Destination Facility</label>
                <input
                  value={genForm.destinationFacility}
                  onChange={e => setGenForm({ ...genForm, destinationFacility: e.target.value })}
                  className="form-input text-xs w-full"
                  placeholder="e.g. Stanton Territorial Hospital"
                />
                <p className="text-[9px] text-amber-600 mt-1 italic font-medium">
                  Note: Adjust this if travel destination is different from ePCR transport destination.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase mb-1">Transport Type</label>
                  <select
                    value={genForm.transportType}
                    onChange={e => setGenForm({ ...genForm, transportType: e.target.value })}
                    className="form-input text-xs w-full"
                  >
                    {['FLIGHT', 'GROUND', 'AIR_AMBULANCE', 'HELICOPTER', 'WATER'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase mb-1">Travel Date</label>
                  <input
                    type="date"
                    value={genForm.travelDate}
                    onChange={e => setGenForm({ ...genForm, travelDate: e.target.value })}
                    className="form-input text-xs w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F0F4FC]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submittingTravel}
                className="btn-ghost text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingTravel}
                onClick={() => {
                  setSubmittingTravel(true);
                  client.post(`/api/travel/from-epcr/${epcrId}`, null, {
                    params: {
                      transportType: genForm.transportType,
                      sourceFacility: genForm.sourceFacility,
                      destinationFacility: genForm.destinationFacility,
                      travelDate: genForm.travelDate
                    }
                  })
                  .then(res => {
                    if (res.data) {
                      dispatch(addToast({ type: 'success', message: 'Medical Travel Request generated successfully!' }));
                      setRequests(prev => {
                        if (prev.some(r => r.id === res.data.id)) return prev;
                        return [...prev, res.data];
                      });
                    }
                    setShowConfirmModal(false);
                  })
                  .catch(() => {})
                  .finally(() => setSubmittingTravel(false));
                }}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {submittingTravel ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                {submittingTravel ? 'Generating…' : 'Confirm & Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const INCIDENT_TYPES = [
  'GENERAL', 'EMERGENCY', 'TRAUMA', 'CARDIOLOGY', 'RESPIRATORY', 'NEUROLOGY',
  'OBSTETRIC', 'PEDIATRIC', 'BEHAVIORAL', 'DENTIST', 'ONCOLOGY', 'RADIOLOGY',
  'ORTHOPEDIC', 'DERMATOLOGY', 'OPHTHALMOLOGY', 'ENT', 'GASTROENTEROLOGY',
  'UROLOGY', 'NEPHROLOGY', 'ENDOCRINOLOGY', 'PSYCHIATRY', 'GERIATRIC',
  'ALLERGY', 'INFECTIOUS_DISEASE', 'OTHER',
];

const INCIDENT_TYPE_COLORS = {
  GENERAL: 'bg-blue-50 text-blue-700 border-blue-200',
  EMERGENCY: 'bg-red-50 text-red-700 border-red-200',
  TRAUMA: 'bg-orange-50 text-orange-700 border-orange-200',
  CARDIOLOGY: 'bg-rose-50 text-rose-700 border-rose-200',
  RESPIRATORY: 'bg-sky-50 text-sky-700 border-sky-200',
  NEUROLOGY: 'bg-violet-50 text-violet-700 border-violet-200',
  OBSTETRIC: 'bg-pink-50 text-pink-700 border-pink-200',
  PEDIATRIC: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  BEHAVIORAL: 'bg-purple-50 text-purple-700 border-purple-200',
  DENTIST: 'bg-teal-50 text-teal-700 border-teal-200',
  ONCOLOGY: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  RADIOLOGY: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ORTHOPEDIC: 'bg-amber-50 text-amber-700 border-amber-200',
  DERMATOLOGY: 'bg-lime-50 text-lime-700 border-lime-200',
  OTHER: 'bg-slate-50 text-slate-600 border-slate-200',
};

const IncidentTypeBadge = ({ type }) => {
  if (!type) return <span className="text-[#A0AECB] text-xs">—</span>;
  
  const getIncidentTypeColor = (rawType) => {
    const t = String(rawType).toUpperCase();
    if (t === 'DENTIST' || t === 'DENTAL' || t.includes('DENT')) return 'bg-teal-50 text-teal-700 border-teal-200';
    if (t.includes('CARDIO') || t.includes('CARDIAC')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (t.includes('TRAUMA')) return 'bg-orange-50 text-orange-700 border-orange-200';
    if (t.includes('OBSTETRIC') || t.includes('OBG')) return 'bg-pink-50 text-pink-700 border-pink-200';
    if (t.includes('ONCOLOGY')) return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    if (t.includes('RADIOLOGY')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (t.includes('PEDIATRIC')) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    if (t.includes('NEURO')) return 'bg-violet-50 text-violet-700 border-violet-200';
    if (t.includes('RESPIRATORY')) return 'bg-sky-50 text-sky-700 border-sky-200';
    if (t.includes('BEHAVIORAL')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (t.includes('EMERGENCY')) return 'bg-red-50 text-red-700 border-red-200';
    if (t.includes('GENERAL')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (t.includes('ENT')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (t.includes('COLLISION') || t.includes('TRANSFER')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    
    return INCIDENT_TYPE_COLORS[t] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const colorCls = getIncidentTypeColor(type);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${colorCls}`}>
      {type.replace(/_/g, ' ')}
    </span>
  );
};

const STATUS_BADGE = {
  DRAFT: 'badge badge-gray',
  DRAFT_OFFLINE: 'badge bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  PENDING: 'badge badge-gray',
  IN_PROGRESS: 'badge badge-blue',
  ACTIVE: 'badge badge-blue',
  COMPLETED: 'badge badge-blue',
  SUBMITTED: 'badge badge-blue',
  APPROVED: 'badge badge-green',
  QA_APPROVED: 'badge badge-green',
  QA_COMPLETED: 'badge badge-green',
  REJECTED: 'badge badge-red',
  ARCHIVED: 'badge badge-gray',
  QA_PENDING: 'badge badge-orange',
};

const StatusBadge = ({ status }) => (
  <span className={STATUS_BADGE[status] || 'badge badge-gray'}>
    {(status || 'DRAFT').replace(/_/g, ' ')}
  </span>
);

const getClinicalTagStyle = (tag) => {
  if (!tag) return 'bg-slate-50 text-slate-600 border-slate-200';
  const raw = tag.toUpperCase();
  if (raw.includes('IMPLANT')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (raw.includes('CROWN') || raw.includes('BRIDGE')) return 'bg-teal-50 text-teal-700 border-teal-200';
  if (raw.includes('ROOT CANAL') || raw.includes('ENDO')) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  if (raw.includes('EXTRACTION')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (raw.includes('RESTORATION') || raw.includes('FILLING')) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (raw.includes('ORTHO')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (raw.includes('DENTAL')) return 'bg-teal-50/60 text-teal-700 border-teal-100';
  
  if (raw.includes('ARREST')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (raw.includes('INFARCTION') || raw.includes('HEART ATTACK')) return 'bg-rose-100 text-rose-800 border-rose-300';
  if (raw.includes('ARRHYTHMIA') || raw.includes('AFIB')) return 'bg-pink-50 text-pink-700 border-pink-200';
  if (raw.includes('CARDIAC')) return 'bg-rose-50/60 text-rose-700 border-rose-100';
  
  if (raw.includes('FRACTURE')) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (raw.includes('FALL')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (raw.includes('ACCIDENT') || raw.includes('MVA')) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (raw.includes('TRAUMA')) return 'bg-orange-50/60 text-orange-700 border-orange-100';

  if (raw.includes('CHEMO')) return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
  if (raw.includes('BIOPSY')) return 'bg-violet-50 text-violet-700 border-violet-200';
  if (raw.includes('ONCOLOGY')) return 'bg-fuchsia-50/60 text-fuchsia-700 border-fuchsia-100';

  return 'bg-blue-50/70 text-brand-blue border-blue-100';
};

const ClinicalTagBadge = ({ tag }) => {
  if (!tag) return null;
  const colorCls = getClinicalTagStyle(tag);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${colorCls}`}>
      {tag}
    </span>
  );
};

const CTAS_BADGE_STYLE = {
  1: 'bg-red-600 text-white font-black border-red-700 shadow-sm',
  2: 'bg-orange-500 text-white font-black border-orange-600 shadow-sm',
  3: 'bg-yellow-500 text-slate-900 font-black border-yellow-600 shadow-sm',
  4: 'bg-emerald-600 text-white font-black border-emerald-700 shadow-sm',
  5: 'bg-blue-600 text-white font-black border-blue-700 shadow-sm',
};

const CtasBadge = ({ level, name }) => {
  if (!level) return null;
  const style = CTAS_BADGE_STYLE[level] || 'bg-slate-200 text-slate-800';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${style}`}>
      CTAS {level} {name ? `• ${name}` : ''}
    </span>
  );
};

const DetailRow = ({ label, value, colSpan = 1 }) => {
  const v = (value === null || value === undefined || value === '') ? '—' : value;
  return (
    <div className={`space-y-1 ${colSpan > 1 ? `col-span-${colSpan}` : ''}`}>
      <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">{label}</p>
      <p className="text-sm font-semibold text-[#0F1A3A] break-words">{v}</p>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, color = "text-brand-blue" }) => (
  <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-100 mb-4">
    <div className={`p-2 rounded-lg bg-slate-50 ${color}`}><Icon size={18} /></div>
    <h4 className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</h4>
  </div>
);

const PAGE_SIZE = 20;

const RecordsList = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const dispatch   = useDispatch();
  const { t }      = useLanguage();
  const user = useSelector(selectUser);
  const records = useSelector(selectRecords);
  const loading = useSelector(selectEpcrLoading);
  const pagination = useSelector(selectEpcrPagination);
  const backendIncidentTypes = useSelector(selectIncidentTypes);
  const incidentTypesOptions = backendIncidentTypes && backendIncidentTypes.length > 0
    ? backendIncidentTypes
    : INCIDENT_TYPES;

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [resendingHl7, setResendingHl7] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [shareModalRecordId, setShareModalRecordId] = useState(null);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isParamedic = user?.role === 'PARAMEDIC';
  const isDoctor = user?.role === 'PHYSICIAN' || isAdmin;

  const canEditRecord = (r) => {
    if (isAdmin) return true;
    if (['PARAMEDIC', 'QA_REVIEWER', 'PHYSICIAN'].includes(user?.role)) {
      return !r.status || ['DRAFT', 'PENDING', 'ACTIVE', 'APPROVED'].includes(r.status);
    }
    return false;
  };

  const canDeleteRecord = (r) => {
    if (isAdmin) return true;
    if (isParamedic) {
      return !r.status || ['DRAFT', 'PENDING', 'ACTIVE'].includes(r.status);
    }
    return false;
  };

  const canSubmitRecord = (r) => {
    if (isAdmin) return true;
    if (isParamedic) {
      return !r.status || ['DRAFT', 'PENDING', 'ACTIVE'].includes(r.status);
    }
    return false;
  };

  const fetchPage = (pageNum = 0) => {
    setCurrentPage(pageNum);
    dispatch(fetchEpcrRecords({
      page: pageNum,
      size: PAGE_SIZE,
      status:       statusFilter  || undefined,
      incidentType: typeFilter    || undefined,
      search:       searchTerm    || undefined,
      startDate:    dateFrom      || undefined,
      endDate:      dateTo        || undefined,
    })).unwrap()
      .catch(err => dispatch(addToast({ type: 'error', message: extractErrorMessage(err) })));
  };

  // ── Voice-command auto-open ─────────────────────────────────────────────
  // If the route was triggered by the voice button,
  // autoOpenId will be in location state — open the record modal immediately.
  useEffect(() => {
    const autoOpenId = location.state?.autoOpenId;
    if (!autoOpenId) return;

    const record = location.state.autoOpenRecord || { id: autoOpenId };

    // Clear router state so a page refresh doesn't re-open
    navigate(location.pathname, { replace: true, state: {} });

    // Open detail modal immediately
    setTimeout(async () => {
      setViewRecord(record);
      setIsViewOpen(true);
      setModalLoading(true);
      if (record.id?.startsWith('temp-') || record.isOfflineDraft || record.status === 'DRAFT_OFFLINE') {
        try {
          const { getOfflineDrafts } = await import('../utils/offlineEpcr');
          const offlineDraftsMap = getOfflineDrafts();
          const localDraft = offlineDraftsMap[record.id] || record;
          setViewRecord(localDraft);
        } catch {
          // Fallback to record
        } finally {
          setModalLoading(false);
        }
        return;
      }
      client.get(`/api/epcr/records/${record.id}`)
        .then((res) => setViewRecord(res.data))
        .catch((err) => {
          dispatch(addToast({ type: 'error', message: extractErrorMessage(err) }));
          setIsViewOpen(false);
        })
        .finally(() => setModalLoading(false));
    }, 150);
  }, [location.state?.autoOpenId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    dispatch(fetchEpcrRecords({ page: 0, size: PAGE_SIZE }));
    dispatch(fetchIncidentTypes());
  }, [dispatch, user]);

  // Re-fetch from backend whenever filters change (debounce search by 400ms)
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => fetchPage(0), searchTerm ? 400 : 0);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, typeFilter, dateFrom, dateTo, user]);

  // Auto-refresh record list when offline records finish syncing
  useEffect(() => {
    const handleSyncComplete = () => {
      fetchPage(0);
    };
    window.addEventListener('epcr-synced', handleSyncComplete);
    return () => window.removeEventListener('epcr-synced', handleSyncComplete);
  }, [user]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = !!(searchTerm || statusFilter || typeFilter || dateFrom || dateTo);

  const handleView = async (record) => {
    setModalLoading(true);
    setViewRecord(record);
    setIsViewOpen(true);
    if (record.id?.startsWith('temp-') || record.isOfflineDraft || record.status === 'DRAFT_OFFLINE') {
      try {
        const { getOfflineDrafts } = await import('../utils/offlineEpcr');
        const offlineDraftsMap = getOfflineDrafts();
        const localDraft = offlineDraftsMap[record.id] || record;
        setViewRecord(localDraft);
      } catch {
        // Fallback to initial record
      } finally {
        setModalLoading(false);
      }
      return;
    }
    try {
      const res = await client.get(`/api/epcr/records/${record.id}`);
      setViewRecord(res.data);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) }));
      setIsViewOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteClick = (record) => setConfirmAction({ type: 'delete', recordId: record.id, message: `Delete record for: ${record.patientName || 'Anonymous'}?` });
  
  const handleResendHl7 = async (id) => {
    setResendingHl7(true);
    try {
      await client.post(`/api/hl7/records/${id}/resend`);
      dispatch(addToast({ type: 'success', message: 'HL7 ADT message transmission triggered successfully!' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) || 'Failed to trigger HL7 transmission' }));
    } finally {
      setResendingHl7(false);
    }
  };
  const handleSubmitRecord = (record) => setConfirmAction({
    type: 'submit',
    recordId: record.id,
    patientId: record.patientId || record.patient?.id,
    message: 'Submit this record to QA review?',
  });

  const executeConfirm = async () => {
    const { type, recordId, patientId } = confirmAction;
    setConfirmAction(null);
    try {
      if (type === 'delete') {
        if (recordId && recordId.startsWith('temp-')) {
          const { deleteOfflineDraft } = await import('../utils/offlineEpcr');
          deleteOfflineDraft(recordId);
          dispatch(addToast({ type: 'success', message: 'Offline draft removed' }));
        } else {
          await dispatch(deleteRecord(recordId)).unwrap();
          dispatch(addToast({ type: 'success', message: 'Record deleted' }));
        }
      } else {
        const submitted = await dispatch(submitRecord(recordId)).unwrap();
        const syncedPatientId = patientId || submitted?.patientId || submitted?.patient?.id;
        if (syncedPatientId) await dispatch(fetchAllPatientHistory(syncedPatientId));
        dispatch(addToast({ type: 'success', message: 'Record submitted for QA review' }));
        // Refresh notifications immediately so the QA assignment bell updates
        dispatch(fetchUnreadNotifications());
      }
      fetchPage(currentPage);
      setIsViewOpen(false);
    } catch (err) { dispatch(addToast({ type: 'error', message: extractErrorMessage(err) })); }
  };

  // All filtering is now done server-side — records from Redux are already the filtered page
  const pagedRecords = records;
  const totalFiltered = pagination.totalElements || records.length;
  const totalPages    = pagination.totalPages    || 1;
  const handlePage    = (p) => {
    const next = Math.max(0, Math.min(p, totalPages - 1));
    fetchPage(next);
  };

  return (
    <div className="space-y-5 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">{t('category_records')}</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">{t('epcr_title')}</h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">{t('epcr_subtitle')}</p>
        </div>
        {['ADMIN', 'PARAMEDIC'].includes(user?.role) && (
          <button onClick={() => navigate('/epcr/new')} className="btn-primary text-sm px-4 py-2.5 shrink-0">
            <Plus size={16} /> {t('action_new')}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t('search_placeholder')}
              className="input pl-9 py-2.5 text-sm w-full"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input py-2.5 text-sm"
          >
            <option value="">All Statuses</option>
            {['DRAFT','SUBMITTED','QA_PENDING','QA_APPROVED','APPROVED','REJECTED'].map(s => (
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
            ))}
          </select>

          {/* Incident Type */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="input py-2.5 text-sm"
          >
            <option value="">All Types</option>
            {incidentTypesOptions.map(t => (
              <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
            ))}
          </select>

          {/* Date range + clear */}
          <div className="flex gap-2 items-center">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input py-2.5 text-sm flex-1 min-w-0" title="From date" />
            <span className="text-[#A0AECB] text-xs font-bold shrink-0">–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input py-2.5 text-sm flex-1 min-w-0" title="To date" />
            {hasFilters && (
              <button onClick={clearFilters} title="Clear all filters"
                className="p-2 rounded-lg text-[#A0AECB] hover:text-brand-red hover:bg-red-50 transition-colors shrink-0">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {hasFilters && (
          <p className="text-xs text-[#A0AECB] mt-2.5 font-medium">
            Showing <span className="font-bold text-[#0F1A3A]">{totalFiltered}</span> results
          </p>
        )}
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F4FC]">
          <p className="text-xs font-semibold text-[#A0AECB]">
            {hasFilters
              ? <>{totalFiltered} match{totalFiltered !== 1 ? 'es' : ''} <span className="text-[#C0CADF]">of {pagination.totalElements} records</span></>
              : <>{pagination.totalElements || records.length} record{(pagination.totalElements || records.length) !== 1 ? 's' : ''}</>}
          </p>
          <button onClick={() => fetchPage(currentPage)} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#A0AECB] hover:text-brand-blue transition-colors disabled:opacity-40">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Location</th>
                <th>Incident Type</th>
                <th>Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && records.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan="6" className="py-3 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : pagedRecords.length === 0 ? (
                <tr><td colSpan="6" className="py-16 text-center">
                  <FileText size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No records found</p>
                </td></tr>
              ) : pagedRecords.map(r => {
                const photoUrl = r.patientPhotoUrl || r.patient?.patientPhotoUrl;
                return (
                 <tr key={r.id}>
                   <td>
                     <div className="flex items-center gap-3">
                       <div
                         className="relative group w-12 h-12 bg-[#EEF2FF] rounded-2xl flex items-center justify-center text-brand-blue font-black text-base shrink-0 overflow-hidden border-2 border-brand-blue/30 shadow-sm cursor-pointer"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (photoUrl) {
                             setEnlargedPhoto(photoUrl);
                           } else {
                             handleView(r);
                           }
                         }}
                         title={photoUrl ? "Click to enlarge patient photo" : "Click to view patient details"}
                       >
                         {photoUrl ? (
                           <>
                             <img
                               src={photoUrl}
                               alt={r.patientName || 'Patient'}
                               className="w-full h-full object-cover group-hover:scale-110 transition-all duration-300"
                             />
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                               <ZoomIn size={16} />
                             </div>
                           </>
                         ) : (
                           <>
                             <span>{(r.patientName || 'A').charAt(0).toUpperCase()}</span>
                             <div className="absolute inset-0 bg-brand-blue/80 text-white text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-center p-0.5 leading-none">
                               <Plus size={12} /> Photo
                             </div>
                           </>
                         )}
                       </div>
                        <p className="font-semibold text-[#0F1A3A] flex items-center gap-1.5">
                          {r.patientName || 'Anonymous'}
                          {r.travelRequestId && (
                            <span className="inline-flex items-center justify-center w-4.5 h-4.5 bg-blue-50 text-brand-blue rounded-full border border-blue-100 shrink-0" title="Linked Medical Travel Request Active">
                              <Plane size={10} />
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#A0AECB] font-mono">#{r.id?.substring(0, 8)}</p>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-sm text-[#4B5A7A]">
                      <MapPin size={13} className="text-[#A0AECB]" /> {r.incidentLocation || '—'}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      <IncidentTypeBadge type={r.incidentType} />
                      <ClinicalTagBadge tag={r.clinicalTag} />
                    </div>
                  </td>
                  <td className="text-sm text-[#4B5A7A]">
                    {r.incidentDateTime ? new Date(r.incidentDateTime).toLocaleDateString() : '—'}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleView(r)}
                        className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all"
                        title="View Record">
                        <Eye size={15} />
                      </button>
                      {isDoctor && (
                        <button onClick={() => setShareModalRecordId(r.id)}
                          className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                          title="Share ePCR Record">
                          <Share2 size={15} />
                        </button>
                      )}
                      {canEditRecord(r) && (
                        <button onClick={() => navigate(`/epcr/new?id=${r.id}`)}
                          className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                          <FileEdit size={15} />
                        </button>
                      )}
                      {canDeleteRecord(r) && (
                        <button onClick={() => handleDeleteClick(r)}
                          className="p-2 rounded-lg bg-[#FFF0F3] text-brand-red hover:bg-brand-red hover:text-white transition-all">
                          <Trash2 size={15} />
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F4FC]">
            <span className="text-xs text-[#8A97B0]">
              Page <span className="font-bold text-[#0F1A3A]">{currentPage + 1}</span> of{' '}
              <span className="font-bold text-[#0F1A3A]">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { handlePage(0); }}       disabled={currentPage === 0 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">«</button>
              <button onClick={() => { handlePage(currentPage - 1); }} disabled={currentPage === 0 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">‹ Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let start = Math.max(0, currentPage - 2);
                const end = Math.min(totalPages - 1, start + 4);
                start = Math.max(0, end - 4);
                const pg = start + i;
                if (pg > end) return null;
                return (
                  <button key={pg} onClick={() => handlePage(pg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      pg === currentPage ? 'bg-brand-blue text-white border-brand-blue' : 'border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue'
                    }`}>{pg + 1}</button>
                );
              })}
              <button onClick={() => { handlePage(currentPage + 1); }} disabled={currentPage >= totalPages - 1 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">Next ›</button>
              <button onClick={() => { handlePage(totalPages - 1); }} disabled={currentPage >= totalPages - 1 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">»</button>
            </div>
          </div>
        )}
      </div>

      {/* View Modal */}
      {isViewOpen && viewRecord && createPortal(
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[9999] flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-[#DDE3F0] my-4">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue text-lg font-black shrink-0 overflow-hidden border-2 border-brand-blue/20 shadow-sm">
                  {viewRecord.patientPhotoUrl ? (
                    <img src={viewRecord.patientPhotoUrl} alt={viewRecord.patientName || 'Patient'} className="w-full h-full object-cover" />
                  ) : (
                    (viewRecord.patientName || 'A').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-xl">{viewRecord.patientName || 'Anonymous'}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={viewRecord.status} />
                    <span className="text-xs text-[#A0AECB] font-mono">#{viewRecord.id}</span>
                    <ClinicalTagBadge tag={viewRecord.clinicalTag} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canSubmitRecord(viewRecord) && (
                  <button onClick={() => handleSubmitRecord(viewRecord)} className="btn-danger text-sm px-4 py-2">
                    <Send size={15} /> Submit to QA
                  </button>
                )}
                <button onClick={() => setIsViewOpen(false)}
                  className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto max-h-[75vh] bg-[#F8FAFC]">
              {modalLoading ? (
                <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="animate-spin text-brand-blue w-8 h-8" />
                  <p className="text-xs font-black uppercase tracking-wider text-[#A0AECB] animate-pulse">Decrypting Secure Health Record...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Subject Information */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                  <SectionHeader icon={User} title="Subject Information" color="text-brand-blue" />

                  {viewRecord.patientPhotoUrl && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 border-2 border-brand-blue/30 rounded-2xl flex flex-col sm:flex-row items-center gap-5 shadow-sm">
                      <div
                        className="relative group shrink-0 cursor-pointer overflow-hidden rounded-2xl"
                        onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(viewRecord.patientPhotoUrl); }}
                        title="Click to view full screen"
                      >
                        <img
                          src={viewRecord.patientPhotoUrl}
                          alt={viewRecord.patientName || 'Patient Visual Recognition'}
                          className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg group-hover:scale-110 transition-all duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-wider gap-1">
                          <ZoomIn size={20} />
                          <span>Click to Zoom</span>
                        </div>
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-blue text-white text-[10px] font-black uppercase tracking-widest shadow-xs">
                          <User size={11} /> Doctor Patient Recognition
                        </div>
                        <h4 className="text-sm font-black text-[#0F1A3A] tracking-tight">Patient Visual Reference Photo</h4>
                        <p className="text-xs text-[#4B5A7A] leading-relaxed">
                          High-resolution visual reference to verify and recognize <span className="font-bold text-[#0F1A3A]">{viewRecord.patientName || 'this patient'}</span> during clinical handoff and care. Click image to enlarge full screen.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Name" value={viewRecord.patientName} />
                    <DetailRow label="DOB" value={viewRecord.patientDateOfBirth} />
                    <DetailRow label="Gender" value={viewRecord.patientGender} />
                    <DetailRow label="Age" value={viewRecord.age} />
                    <DetailRow label="Phone" value={viewRecord.patientPhone} />
                    <DetailRow label="Email" value={viewRecord.email} />
                    <DetailRow label="SSN (Last 4)" value={viewRecord.patientSSNLast4} />
                    <DetailRow label="Blood Group" value={viewRecord.bloodGroup} />
                    <DetailRow label="Height" value={viewRecord.height ? `${viewRecord.height} cm` : ''} />
                    <DetailRow label="Weight" value={viewRecord.weight ? `${viewRecord.weight} kg` : ''} />
                    <DetailRow label="Address" value={viewRecord.patientAddress} colSpan={2} />
                  </div>

                  <div className="mt-6">
                    <SectionHeader icon={Heart} title="Medical History" color="text-brand-red" />
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label="Allergies" value={viewRecord.allergy || viewRecord.medicalHistory?.allergies?.join(', ')} colSpan={2} />
                      <DetailRow label="Comorbidities" value={viewRecord.comorbidity || viewRecord.medicalHistory?.pastConditions?.join(', ')} colSpan={2} />
                      <DetailRow label="Current Meds" value={viewRecord.currentMedicines || viewRecord.medicalHistory?.currentMedications?.join(', ')} colSpan={2} />
                      <DetailRow label="Surgical History" value={viewRecord.medicalHistory?.surgicalHistory?.join(', ')} colSpan={2} />
                      <DetailRow label="Physician" value={viewRecord.doctor || viewRecord.medicalHistory?.primaryPhysicianName} />
                      <DetailRow label="Physician Contact" value={viewRecord.medicalHistory?.primaryPhysicianContact} />
                      <DetailRow label="Advance Directive" value={viewRecord.medicalHistory?.advanceDirective ? `YES - ${viewRecord.medicalHistory?.advanceDirectiveType}` : 'NO'} />
                      <DetailRow label="DNR On File" value={viewRecord.medicalHistory?.dnrOnFile ? 'YES' : 'NO'} />
                      <DetailRow label="Smoker" value={viewRecord.medicalHistory?.smoker ? 'YES' : 'NO'} />
                      <DetailRow label="Alcohol Use" value={viewRecord.medicalHistory?.alcoholUse ? 'YES' : 'NO'} />
                      <DetailRow label="Substance Use" value={viewRecord.medicalHistory?.substanceUse ? `YES - ${viewRecord.medicalHistory?.substanceUseDetails}` : 'NO'} colSpan={2} />
                      {viewRecord.patientGender === 'FEMALE' && (
                        <>
                          <DetailRow label="Pregnant" value={viewRecord.medicalHistory?.pregnant ? 'YES' : 'NO'} />
                          <DetailRow label="Gestational Wk" value={viewRecord.medicalHistory?.gestationalWeekIfPregnant} />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Incident & Scene */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                  <SectionHeader icon={AlertTriangle} title="Incident & Scene" color="text-amber-500" />
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Incident No." value={viewRecord.incidentNumber} />
                    <DetailRow label="Date/Time" value={viewRecord.incidentDateTime ? new Date(viewRecord.incidentDateTime).toLocaleString() : ''} />
                    <DetailRow label="Type" value={viewRecord.incidentType} />
                    <DetailRow label="Location" value={viewRecord.incidentLocation} />
                    <DetailRow label="Description" value={viewRecord.incidentDescription} colSpan={2} />
                  </div>

                  {viewRecord.sceneAssessment && (
                    <div className="mt-6">
                      <SectionHeader icon={Activity} title="Scene Assessment" color="text-amber-600" />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailRow label="Scene Type" value={viewRecord.sceneAssessment.sceneType} />
                        <DetailRow label="Triage Tag" value={viewRecord.sceneAssessment.triageTag} />
                        <DetailRow label="Patients Count" value={viewRecord.sceneAssessment.numberOfPatients} />
                        <DetailRow label="Mass Casualty" value={viewRecord.sceneAssessment.massCasualtyIncident ? 'YES' : 'NO'} />
                        <DetailRow label="Trauma Call" value={viewRecord.sceneAssessment.traumaCall ? 'YES' : 'NO'} />
                        <DetailRow label="Scene Safe" value={viewRecord.sceneAssessment.sceneSafe ? 'YES' : 'NO'} />
                        <DetailRow label="Weather" value={viewRecord.sceneAssessment.weatherConditions} />
                        <DetailRow label="Lighting" value={viewRecord.sceneAssessment.lightingConditions} />
                        <DetailRow label="Access Difficulty" value={viewRecord.sceneAssessment.patientAccessDifficulty} />
                        <DetailRow label="Bystander CPR" value={viewRecord.sceneAssessment.bystanderCPRPerformed ? 'YES' : 'NO'} />
                        <DetailRow label="AED Used" value={viewRecord.sceneAssessment.aedUsedByBystander ? 'YES' : 'NO'} />
                        <DetailRow label="Mech. of Injury" value={viewRecord.sceneAssessment.mechanismOfInjury} colSpan={2} />
                        <DetailRow label="Injury Location" value={viewRecord.sceneAssessment.injuryLocation} colSpan={2} />
                        <DetailRow label="Hazards" value={viewRecord.sceneAssessment.sceneHazards} colSpan={2} />
                        <DetailRow label="Witness Present" value={viewRecord.sceneAssessment.witnessPresent ? `YES - ${viewRecord.sceneAssessment.witnessName}` : 'NO'} colSpan={2} />
                        {viewRecord.sceneAssessment.witnessPresent && (
                          <DetailRow label="Witness Contact" value={viewRecord.sceneAssessment.witnessContact} colSpan={2} />
                        )}
                        {viewRecord.sceneAssessment.geoLocation && (
                          <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <p className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Scene Geo-coordinates</p>
                            <DetailRow label="Latitude" value={viewRecord.sceneAssessment.geoLocation.latitude} />
                            <DetailRow label="Longitude" value={viewRecord.sceneAssessment.geoLocation.longitude} />
                            <DetailRow label="Altitude" value={viewRecord.sceneAssessment.geoLocation.altitude ? `${viewRecord.sceneAssessment.geoLocation.altitude} m` : ''} />
                            <DetailRow label="Geohash" value={viewRecord.sceneAssessment.geoLocation.geohash} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {viewRecord.timeline && (
                    <div className="mt-6">
                      <SectionHeader icon={Clock} title="Timeline" color="text-slate-500" />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailRow label="Call Received" value={viewRecord.timeline.callReceivedAt ? new Date(viewRecord.timeline.callReceivedAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Dispatched" value={viewRecord.timeline.dispatchedAt ? new Date(viewRecord.timeline.dispatchedAt).toLocaleTimeString() : ''} />
                        <DetailRow label="En Route" value={viewRecord.timeline.enRouteAt ? new Date(viewRecord.timeline.enRouteAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Arrived Scene" value={viewRecord.timeline.arrivedSceneAt ? new Date(viewRecord.timeline.arrivedSceneAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Patient Contact" value={viewRecord.timeline.patientContactAt ? new Date(viewRecord.timeline.patientContactAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Departed Scene" value={viewRecord.timeline.departedSceneAt ? new Date(viewRecord.timeline.departedSceneAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Arrived Dest." value={viewRecord.timeline.arrivedDestinationAt ? new Date(viewRecord.timeline.arrivedDestinationAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Transfer of Care" value={viewRecord.timeline.transferOfCareAt ? new Date(viewRecord.timeline.transferOfCareAt).toLocaleTimeString() : ''} />
                        <DetailRow label="Unit Available" value={viewRecord.timeline.unitAvailableAt ? new Date(viewRecord.timeline.unitAvailableAt).toLocaleTimeString() : ''} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Clinical Assessment */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                  <SectionHeader icon={Heart} title="Clinical & Vitals" color="text-emerald-600" />
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <DetailRow label="BP" value={viewRecord.systolicBp && viewRecord.diastolicBp ? `${viewRecord.systolicBp}/${viewRecord.diastolicBp}` : ''} />
                    <DetailRow label="Heart Rate" value={viewRecord.heartRate || viewRecord.pulseRate} />
                    <DetailRow label="Resp. Rate" value={viewRecord.respirationRate} />
                    <DetailRow label="SpO2" value={viewRecord.spo2 ? `${viewRecord.spo2}%` : ''} />
                    <DetailRow label="Temp" value={viewRecord.temperature ? `${viewRecord.temperature}°C` : ''} />
                    <DetailRow label="Blood Sugar" value={viewRecord.bloodSugar} />
                    <DetailRow label="GCS" value={viewRecord.glasgowComaScale} />
                    <DetailRow label="Hemoglobin" value={viewRecord.hemoglobin} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Primary Impression" value={viewRecord.primaryImpression} colSpan={2} />
                    <DetailRow label="Secondary Imp." value={viewRecord.secondaryImpression} colSpan={2} />
                    <DetailRow label="Diagnosis" value={viewRecord.diagnosis} colSpan={2} />
                    <DetailRow label="ICD-10 Code" value={viewRecord.icd10Code} />
                    <DetailRow label="Treatment" value={viewRecord.treatmentProvided} colSpan={2} />
                    <DetailRow label="Treatment Plan" value={viewRecord.treatmentPlan} colSpan={2} />
                  </div>

                  {(viewRecord.complaints?.length > 0 || viewRecord.vitals?.length > 0 || viewRecord.medicationsAdministered?.length > 0 || viewRecord.proceduresPerformed?.length > 0) && (
                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                      {viewRecord.complaints?.length > 0 && <DetailRow label="Complaints Logs" value={viewRecord.complaints.join(', ')} colSpan={2} />}
                      {viewRecord.vitals?.length > 0 && <DetailRow label="Vitals Logs" value={viewRecord.vitals.join(', ')} colSpan={2} />}
                      {viewRecord.medicationsAdministered?.length > 0 && <DetailRow label="Meds Administered" value={viewRecord.medicationsAdministered.join(', ')} colSpan={2} />}
                      {viewRecord.proceduresPerformed?.length > 0 && <DetailRow label="Procedures" value={viewRecord.proceduresPerformed.join(', ')} colSpan={2} />}
                    </div>
                  )}
                </div>

                {/* Disposition & Transport */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                  <SectionHeader icon={Truck} title="Disposition & Transport" color="text-indigo-500" />
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow label="Destination" value={viewRecord.transportDestination || viewRecord.transport?.destinationName} colSpan={2} />
                    <DetailRow label="Facility ID" value={viewRecord.transport?.destinationFacilityId} />
                    <DetailRow label="Facility Address" value={viewRecord.transport?.destinationAddress} colSpan={2} />
                    <DetailRow label="Facility Type" value={viewRecord.transport?.destinationType} />
                    <DetailRow label="Mode" value={viewRecord.transportMode || viewRecord.transport?.transportMode} />
                    <DetailRow label="Care Level" value={viewRecord.careLevel || viewRecord.transport?.careLevel} />
                    <DetailRow label="Transport Reason" value={viewRecord.transport?.transportReason} colSpan={2} />
                    {viewRecord.transport?.refusalOfTransportReason && (
                      <DetailRow label="Refusal Reason" value={viewRecord.transport.refusalOfTransportReason} colSpan={2} />
                    )}
                    <DetailRow label="Receiving Physician" value={viewRecord.transport?.receivingPhysicianName} />
                    <DetailRow label="Receiving Nurse" value={viewRecord.transport?.receivingNurseName} />
                    <DetailRow label="Condition Depart" value={viewRecord.transport?.patientConditionOnDeparture} />
                    <DetailRow label="Condition Arrive" value={viewRecord.transport?.patientConditionOnArrival} />
                    <DetailRow label="Hospital Notified" value={viewRecord.transport?.hospitalNotified ? `YES - ${viewRecord.transport?.hospitalNotifiedAt ? new Date(viewRecord.transport.hospitalNotifiedAt).toLocaleTimeString() : ''}` : 'NO'} />
                    <DetailRow label="Continued CPR" value={viewRecord.transport?.continuedCPRDuringTransport ? 'YES' : 'NO'} />
                    <DetailRow label="AED Used Transport" value={viewRecord.transport?.aedUsedDuringTransport ? 'YES' : 'NO'} />
                    {viewRecord.transport?.destinationGeoLocation && (
                      <div className="col-span-2 grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-wider">Destination Geo-coordinates</p>
                        <DetailRow label="Latitude" value={viewRecord.transport.destinationGeoLocation.latitude} />
                        <DetailRow label="Longitude" value={viewRecord.transport.destinationGeoLocation.longitude} />
                        <DetailRow label="Altitude" value={viewRecord.transport.destinationGeoLocation.altitude ? `${viewRecord.transport.destinationGeoLocation.altitude} m` : ''} />
                        <DetailRow label="Geohash" value={viewRecord.transport.destinationGeoLocation.geohash} />
                      </div>
                    )}
                    <DetailRow label="Handoff Report" value={viewRecord.transport?.handoffReport} colSpan={2} />
                    <DetailRow label="Paramedic" value={viewRecord.paramedicsName} />
                    <DetailRow label="Organization" value={viewRecord.organizationName} />
                  </div>

                  {viewRecord.consent && (
                    <div className="mt-6">
                      <SectionHeader icon={Shield} title="Consent & Refusals" color="text-slate-600" />
                      <div className="grid grid-cols-2 gap-4">
                        <DetailRow label="Consent Obtained" value={viewRecord.consent.patientConsentObtained ? 'YES' : 'NO'} />
                        <DetailRow label="Consent Type" value={viewRecord.consent.consentType} />
                        <DetailRow label="Decision Capacity" value={viewRecord.consent.patientHasDecisionCapacity ? 'YES' : 'NO'} />
                        <DetailRow label="Informed of Risks" value={viewRecord.consent.patientInformedOfRisks ? 'YES' : 'NO'} />
                        {viewRecord.consent.refusalOfCare && (
                          <>
                            <DetailRow label="Refused Care" value="YES" />
                            <DetailRow label="Refusal Reason" value={viewRecord.consent.refusalReason} colSpan={2} />
                            {viewRecord.consent.refusalWitnessed && (
                              <>
                                <DetailRow label="Refusal Witnessed" value="YES" />
                                <DetailRow label="Witness Name" value={viewRecord.consent.witnessName} />
                                <DetailRow label="Witness Contact" value={viewRecord.consent.witnessContact} colSpan={2} />
                              </>
                            )}
                          </>
                        )}
                        {viewRecord.consent.capacityAssessmentNotes && (
                          <DetailRow label="Capacity Notes" value={viewRecord.consent.capacityAssessmentNotes} colSpan={2} />
                        )}
                        <DetailRow label="Guardian Consent" value={viewRecord.consent.guardianConsentObtained ? 'YES' : 'NO'} />
                        {viewRecord.consent.guardianConsentObtained && (
                          <>
                            <DetailRow label="Guardian Name" value={viewRecord.consent.guardianName} />
                            <DetailRow label="Relationship" value={viewRecord.consent.guardianRelationship} />
                            <DetailRow label="Guardian Phone" value={viewRecord.consent.guardianPhone} colSpan={2} />
                          </>
                        )}
                        {(viewRecord.consent.patientSignatureAttachmentId || viewRecord.consent.guardianSignatureAttachmentId || viewRecord.consent.crewSignatureAttachmentId) && (
                          <div className="col-span-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-2">
                            <DetailRow label="Patient Sig ID" value={viewRecord.consent.patientSignatureAttachmentId} />
                            <DetailRow label="Guardian Sig ID" value={viewRecord.consent.guardianSignatureAttachmentId} />
                            <DetailRow label="Crew Sig ID" value={viewRecord.consent.crewSignatureAttachmentId} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Medical Travel linked to this patient */}
                <MedicalTravelCard epcrId={viewRecord.id} patientId={viewRecord.patientId || viewRecord.patientRegistrationId} epcrRecord={viewRecord} />

                {/* Structured Lists Section */}
                {((viewRecord.crew && viewRecord.crew.length > 0) ||
                  (viewRecord.structuredComplaints && viewRecord.structuredComplaints.length > 0) ||
                  (viewRecord.structuredVitals && viewRecord.structuredVitals.length > 0) ||
                  (viewRecord.structuredMedications && viewRecord.structuredMedications.length > 0) ||
                  (viewRecord.structuredProcedures && viewRecord.structuredProcedures.length > 0)) && (
                  <div className="col-span-1 lg:col-span-2 border-t border-[#DDE3F0] pt-6 space-y-8">
                    
                    {/* Incident Crew */}
                    {viewRecord.crew && viewRecord.crew.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                        <SectionHeader icon={User} title="Incident Crew Members" color="text-brand-blue" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {viewRecord.crew.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative shadow-sm">
                              <p className="font-bold text-[#0F1A3A] text-sm">{c.name}</p>
                              <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.role} | {c.certificationLevel}</p>
                              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-[#4B5A7A] font-medium">
                                <div>Cert #: {c.certificationNumber || '—'}</div>
                                <div>Expires: {c.certificationExpiryDate || '—'}</div>
                              </div>
                              {c.primaryClinician && (
                                <span className="mt-2.5 inline-block text-[9px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded uppercase tracking-wider">Primary Clinician</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structured Complaints */}
                    {viewRecord.structuredComplaints && viewRecord.structuredComplaints.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                        <SectionHeader icon={Activity} title="Structured Complaints Details" color="text-amber-500" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {viewRecord.structuredComplaints.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                              <p className="font-bold text-[#0F1A3A] text-sm">{c.complaint} {c.traumaRelated && <span className="text-[9px] bg-brand-red/10 text-brand-red font-black px-1.5 py-0.5 rounded ml-1 uppercase">TRAUMA</span>}</p>
                              <p className="text-xs font-medium text-[#4B5A7A] mt-1">Onset: {c.onset} | Severity: <span className="font-bold text-brand-blue">{c.severity}/10</span></p>
                              <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs text-[#4B5A7A] font-medium">
                                {c.provocation && <div>Provoked by: {c.provocation}</div>}
                                {c.quality && <div>Quality: {c.quality}</div>}
                                {c.radiation && <div>Radiation: {c.radiation}</div>}
                                {c.timing && <div>Timing: {c.timing}</div>}
                                {c.associatedSymptoms && <div className="col-span-2">Symptoms: {c.associatedSymptoms}</div>}
                                {c.onsetTime && <div className="col-span-2">Onset Time: {new Date(c.onsetTime).toLocaleString()}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structured Vitals Log */}
                    {viewRecord.structuredVitals && viewRecord.structuredVitals.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                        <SectionHeader icon={Heart} title="Structured Vitals History Logs" color="text-emerald-600" />
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                          {viewRecord.structuredVitals.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                              <p className="font-bold text-[#A0AECB] text-[10px] uppercase tracking-wider">Log #{idx+1} | {new Date(c.recordedAt).toLocaleString()}</p>
                              <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-3 text-xs font-semibold text-[#0F1A3A]">
                                {c.systolicBP && c.diastolicBP && <div>BP: <span className="text-brand-blue">{c.systolicBP}/{c.diastolicBP}</span></div>}
                                {c.heartRate && <div>HR: <span className="text-brand-blue">{c.heartRate} bpm</span></div>}
                                {c.respiratoryRate && <div>RR: <span className="text-brand-blue">{c.respiratoryRate}/min</span></div>}
                                {c.oxygenSaturation && <div>SpO2: <span className="text-emerald-600">{c.oxygenSaturation}%</span></div>}
                                {c.temperature && <div>Temp: <span className="text-brand-blue">{c.temperature}°C ({c.temperatureRoute})</span></div>}
                                {c.bloodGlucose && <div>Glucose: <span className="text-brand-blue">{c.bloodGlucose} mg/dL</span></div>}
                              </div>
                              <div className="mt-3 pt-2 border-t border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] text-[#4B5A7A] font-medium">
                                {c.glasgowComaScale && <div>GCS: <span className="font-bold text-brand-blue">{c.glasgowComaScale}</span> (E{c.gcEye} V{c.gcVerbal} M{c.gcMotor})</div>}
                                {c.avpu && <div>AVPU: <span className="font-bold">{c.avpu}</span></div>}
                                {c.painScore !== null && c.painScore !== undefined && <div>Pain: <span className="font-bold text-brand-red">{c.painScore}/10</span> {c.painLocation ? `(${c.painLocation})` : ''}</div>}
                                {c.skinColor && <div>Skin: {c.skinColor}, {c.skinCondition}, {c.skinTemperature}</div>}
                                {(c.pupilLeft || c.pupilRight) && <div>Pupils: L{c.pupilLeft} R{c.pupilRight} {c.pupilsEqual ? '(Equal' : '(Unequal'} {c.pupilsReactive ? 'Reactive)' : 'Nonreactive)'}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structured Medications */}
                    {viewRecord.structuredMedications && viewRecord.structuredMedications.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                        <SectionHeader icon={Heart} title="Structured Medications Administered" color="text-indigo-500" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {viewRecord.structuredMedications.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                              <p className="font-bold text-[#0F1A3A] text-sm">{c.medicationName} {c.brandName ? `(${c.brandName})` : ''}</p>
                              <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.dosage} {c.unit} via {c.route}</p>
                              <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs text-[#4B5A7A] font-medium">
                                {c.administeredAt && <div>Time: {new Date(c.administeredAt).toLocaleTimeString()}</div>}
                                {c.administeredBy && <div>By: {c.administeredBy}</div>}
                                <div>Attempts: {c.administrationAttempts}</div>
                                {c.patientResponse && <div>Response: {c.patientResponse}</div>}
                                {c.indication && <div className="col-span-2">Indication: {c.indication}</div>}
                                {c.adverseReactionDetails && <div className="col-span-2">Adverse: {c.adverseReactionDetails}</div>}
                                {c.notes && <div className="col-span-2 text-slate-400 italic">Notes: {c.notes}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Structured Procedures */}
                    {viewRecord.structuredProcedures && viewRecord.structuredProcedures.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#DDE3F0]">
                        <SectionHeader icon={Activity} title="Structured Procedures Performed" color="text-indigo-600" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {viewRecord.structuredProcedures.map((c, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                              <p className="font-bold text-[#0F1A3A] text-sm">{c.procedureName} {c.successful ? <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded ml-1 uppercase">SUCCESSFUL</span> : <span className="text-[9px] bg-brand-red/10 text-brand-red font-black px-1.5 py-0.5 rounded ml-1 uppercase">FAILED</span>}</p>
                              <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.bodysite ? `Site: ${c.bodysite}` : 'Site: Unspecified'} | Attempts: {c.attempts}</p>
                              <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs text-[#4B5A7A] font-medium">
                                {c.performedAt && <div>Time: {new Date(c.performedAt).toLocaleTimeString()}</div>}
                                {c.performedBy && <div>By: {c.performedBy}</div>}
                                {c.patientResponse && <div>Response: {c.patientResponse}</div>}
                                {c.snomedCode && <div>SNOMED: {c.snomedCode}</div>}
                                {c.complications && <div className="col-span-2">Complications: {c.complications}</div>}
                                {c.notes && <div className="col-span-2 text-slate-400 italic">Notes: {c.notes}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
                </div>
              )}
            </div>

            {/* AI Suggestion Panel — shown for all roles, generate restricted to PHYSICIAN/ADMIN/MANAGER */}
            {!modalLoading && viewRecord.id && (
              <div className="px-6 pb-5">
                <AiSuggestionPanel
                  recordId={viewRecord.id}
                  userRole={user?.role}
                />
              </div>
            )}

            <div className="p-5 border-t border-[#F0F4FC] flex justify-end gap-3">
              {user && ['ADMIN', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER'].includes(user.role) && (
                <button
                  onClick={() => handleResendHl7(viewRecord.id)}
                  disabled={resendingHl7}
                  className="btn-danger bg-brand-blue hover:bg-brand-blue/90 border border-brand-blue text-sm px-5 py-2.5 flex items-center gap-2"
                >
                  <RefreshCw size={15} className={resendingHl7 ? 'animate-spin' : ''} />
                  {resendingHl7 ? 'Syncing…' : 'Sync HL7 with Hospital'}
                </button>
              )}
              <button onClick={() => setIsViewOpen(false)} className="btn-primary text-sm px-6 py-2.5">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Modal */}
      {confirmAction && createPortal(
        <div className="fixed inset-0 bg-[#0F1A3A]/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#DDE3F0] p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-brand-red" />
            </div>
            <h3 className="font-black text-[#0F1A3A] text-lg mb-2">Confirm Action</h3>
            <p className="text-sm text-[#8A97B0] mb-6">{confirmAction.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
              <button onClick={executeConfirm} className="btn-danger flex-1 justify-center py-2.5 text-sm">Confirm</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Full-Screen Patient Photo Lightbox Modal */}
      {enlargedPhoto && createPortal(
        <div
          className="fixed inset-0 bg-[#0F1A3A]/85 backdrop-blur-md z-[10000] flex flex-col items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEnlargedPhoto(null)}
              className="absolute -top-12 right-0 p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <X size={20} /> Close
            </button>
            <div className="bg-white p-3 rounded-3xl shadow-2xl border-4 border-white/20 max-h-[85vh] flex flex-col items-center">
              <img
                src={enlargedPhoto}
                alt="Enlarged Patient Recognition Photo"
                className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-md"
              />
              <div className="mt-3 flex items-center gap-2 text-slate-800 text-xs font-black uppercase tracking-wider">
                <User size={16} className="text-brand-blue" /> High-Resolution Doctor Patient Visual Recognition
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {shareModalRecordId && (
        <RecordShareModal
          isOpen={!!shareModalRecordId}
          onClose={() => setShareModalRecordId(null)}
          recordId={shareModalRecordId}
        />
      )}
    </div>
  );
};

export default RecordsList;
