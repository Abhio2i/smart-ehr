import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  Clock,
  ExternalLink,
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  Plus,
  Stethoscope,
  Thermometer,
  Plane,
  Smile,
} from 'lucide-react';
import client from '../../api/client';
import { addToast } from '../../store/slices/uiSlice';
import { TravelOverviewPanel } from './GeneralOverviewPage';
import FdiToothChartWidget from '../../components/dental/FdiToothChartWidget';

const getId = (item) => item?.id || item?.conditionId || item?.medicationId || item?.encounterId || item?.admissionId || item?.labResultId || item?.documentId;
const getConditionLinkId = (item) => {
  const value = item?.conditionId || item?.relatedConditionId || item?.condition?.id || item?.condition?.conditionId;
  if (value && typeof value === 'object') return value.id || value.conditionId || value._id || '';
  return value || '';
};
const sameId = (a, b) => String(a || '') === String(b || '');
const timelineKey = (item, index) => [
  item?.eventType || item?.type || 'event',
  item?.sourceId || getId(item) || item?.title || 'unknown',
  item?.date || item?.eventDate || item?.timestamp || 'no-date',
  index,
].join(':');
const text = (value, fallback = 'Not recorded') => (value === 0 || value ? String(value) : fallback);
const date = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';

const statusClass = (status) => {
  const key = String(status || '').toUpperCase();
  if (['ACTIVE', 'ABNORMAL', 'OPEN', 'ONGOING'].includes(key)) return 'bg-red-50 text-red-700 border-red-100';
  if (['RESOLVED', 'NORMAL', 'STOPPED', 'COMPLETED'].includes(key)) return 'bg-green-50 text-green-700 border-green-100';
  if (['CHRONIC', 'MODERATE'].includes(key)) return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-[#E8EEF8] text-brand-blue border-[#DDE3F0]';
};

const EVENT_TYPE_STYLES = {
  CONDITION_DIAGNOSED: { icon: HeartPulse, color: '#C8102E', bg: '#FEE2E2', label: 'Condition Diagnosed' },
  CONDITION_RESOLVED: { icon: Check, color: '#059669', bg: '#D1FAE5', label: 'Condition Resolved' },
  MEDICATION_STARTED: { icon: Pill, color: '#7C3AED', bg: '#F3E8FF', label: 'Medication Started' },
  MEDICATION_STOPPED: { icon: Pill, color: '#6B7280', bg: '#F3F4F6', label: 'Medication Stopped' },
  EPCR_ENCOUNTER: { icon: Stethoscope, color: '#EA580C', bg: '#FFEDD5', label: 'ePCR Encounter' },
  HOSPITAL_ADMISSION: { icon: Activity, color: '#0891B2', bg: '#CFFAFE', label: 'Hospital Admission' },
  LAB_RESULT: { icon: FlaskConical, color: '#1A3C8F', bg: '#DBEAFE', label: 'Lab Result' },
  DOCUMENT: { icon: FileText, color: '#475569', bg: '#E2E8F0', label: 'Document' },
};
const DEFAULT_EVENT_STYLE = { icon: Activity, color: '#4B5A7A', bg: '#E8EEF8', label: 'Event' };

const getEventStyle = (eventType) => {
  const key = String(eventType || '').toUpperCase().replace(/[\s-]+/g, '_');
  return EVENT_TYPE_STYLES[key] || DEFAULT_EVENT_STYLE;
};

const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return 'Upcoming';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

const assessVitalStatus = (v) => {
  const crit = [
    v.systolicBP != null && (v.systolicBP > 180 || v.systolicBP < 80),
    v.diastolicBP != null && (v.diastolicBP > 120 || v.diastolicBP < 50),
    v.heartRate != null && (v.heartRate > 150 || v.heartRate < 40),
    v.oxygenSaturation != null && v.oxygenSaturation < 88,
    v.respiratoryRate != null && (v.respiratoryRate > 30 || v.respiratoryRate < 8),
    v.temperature != null && (v.temperature > 39.5 || v.temperature < 35),
  ];
  if (crit.some(Boolean)) return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' };
  const warn = [
    v.systolicBP != null && (v.systolicBP > 140 || v.systolicBP < 90),
    v.diastolicBP != null && (v.diastolicBP > 90 || v.diastolicBP < 60),
    v.heartRate != null && (v.heartRate > 100 || v.heartRate < 60),
    v.oxygenSaturation != null && v.oxygenSaturation < 95,
    v.respiratoryRate != null && (v.respiratoryRate > 20 || v.respiratoryRate < 12),
    v.temperature != null && (v.temperature > 37.2 || v.temperature < 36.1),
  ];
  if (warn.some(Boolean)) return { label: 'Monitor', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'Normal', cls: 'bg-green-100 text-green-700 border-green-200' };
};

const viewSecureDocument = async (dispatch, patientId, documentId) => {
  if (!documentId || !patientId) return;
  try {
    const res = await client.get(`/api/patients/${patientId}/history/documents/${documentId}/signed-url`, { hideToast: true });
    window.open(res.data.url, '_blank');
  } catch (error) {
    const status = error.response?.status;
    const message = status === 404
      ? 'This document was stored on a previous server and must be re-uploaded to be accessible.'
      : (error.response?.data?.message || 'Unable to open document. Please try again or contact support.');
    dispatch(addToast({ type: 'error', message }));
  }
};

const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${className}`}>
    {children}
  </span>
);

const Empty = ({ children }) => (
  <div className="rounded-xl border border-dashed border-[#DDE3F0] bg-[#F8FAFF] px-4 py-8 text-center text-sm font-semibold text-[#8A97B0]">
    {children}
  </div>
);

const SecureInlineImage = ({ patientId, doc, className, onError }) => {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(false);
  const missingDocument = !patientId || !getId(doc);

  useEffect(() => {
    let active = true;
    const documentId = getId(doc);
    if (!patientId || !documentId) return;
    client.get(`/api/patients/${patientId}/history/documents/${documentId}/signed-url`, { hideToast: true })
      .then(res => { if (active) setSrc(res.data.url); })
      .catch(() => { if (active) setErr(true); });
    return () => { active = false; };
  }, [patientId, doc]);

  if (err || missingDocument) return <div className="w-full h-24 flex items-center justify-center text-[#A0AECB]"><FileText size={32} /></div>;
  if (!src) return <div className="w-full h-32 flex items-center justify-center text-[#A0AECB] animate-pulse bg-gray-50"><FileText size={32} className="opacity-30" /></div>;

  return (
    <img
      src={src}
      alt={doc.fileName || doc.name || 'Medical image'}
      className={className}
      onError={onError}
    />
  );
};

function DentistPatientOverview({
  canEdit,
  conditions,
  dispatch,
  documents,
  encounters,
  labResults,
  medications,
  patientId,
  setModal,
  setTimelineViewItem,
  timeline,
  vitals,
  displayName,
}) {
  const navigate = useNavigate();
  const [topTravelRequests, setTopTravelRequests] = useState([]);
  useEffect(() => {
    if (!patientId) return;
    client.get('/api/travel/requests', { params: { patientId } })
      .then(res => setTopTravelRequests(res.data || []))
      .catch(() => {});
  }, [patientId]);

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between bg-blue-50/80 border border-blue-100 rounded-lg px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-[#1A3C8F] text-white flex items-center justify-center font-bold">
            <Smile size={14} />
          </div>
          <div>
            <span className="text-[11px] font-black text-[#0F1A3A]">FDI Oral &amp; Dental Health Chart</span>
            <span className="text-[10px] text-slate-500 font-semibold ml-2">Tooth condition matrix, treatment logs &amp; school screenings</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/dental?patientId=${patientId}&patientName=${encodeURIComponent(displayName || 'Patient')}`)}
          className="flex items-center gap-1.5 bg-[#1A3C8F] hover:bg-blue-900 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Smile size={13} /> Full Screen Dental EHR <ExternalLink size={11} />
        </button>
      </div>



                        <div className="grid grid-cols-3 gap-2 shrink-0">
                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm px-3 py-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-md bg-red-50 flex items-center justify-center shrink-0"><HeartPulse size={11} className="text-red-600" /></div>
                                <span className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Conditions</span>
                                <span className="text-[9px] font-black text-red-600 bg-red-50 px-1 rounded">{conditions.filter(c => c.status === 'ACTIVE').length} active</span>
                              </div>
                              {canEdit && <button type="button" onClick={() => setModal({ type: 'conditions' })} className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center shrink-0"><Plus size={9} /></button>}
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-[52px] overflow-y-auto custom-scrollbar">
                              {conditions.length === 0 ? <span className="text-[9px] text-[#A0AECB]">None on record</span> : conditions.map((c, i) => (
                                <span key={getId(c) || i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusClass(c.status)}`}>
                                  <span className={`w-1 h-1 rounded-full shrink-0 ${c.status === 'ACTIVE' ? 'bg-red-500 animate-pulse' : 'bg-green-400'}`} />
                                  {c.name}{c.severity ? ` · ${c.severity}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm px-3 py-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-md bg-purple-50 flex items-center justify-center shrink-0"><Pill size={11} className="text-purple-600" /></div>
                                <span className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Medications</span>
                                <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1 rounded">{medications.filter(m => !m.status || m.status === 'ACTIVE').length} active</span>
                              </div>
                              {canEdit && <button type="button" onClick={() => setModal({ type: 'medications' })} className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center shrink-0"><Plus size={9} /></button>}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {medications.length === 0 ? <span className="text-[9px] text-[#A0AECB]">None on record</span> : medications.map((m, i) => (
                                <span key={getId(m) || i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusClass(m.status)}`}>
                                  {m.name || m.medicationName}{m.dosage ? ` ${m.dosage}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Medical Travel Box */}
                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm px-3 py-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-md bg-blue-50 flex items-center justify-center shrink-0"><Plane size={11} className="text-brand-blue" /></div>
                                <span className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Medical Travel</span>
                                <span className="text-[9px] font-black text-brand-blue bg-blue-50 px-1 rounded">
                                  {topTravelRequests.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length} active
                                </span>
                              </div>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/medical-travel?patientId=${patientId}&patientName=${encodeURIComponent(displayName || 'Patient')}`);
                                  }}
                                  className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center shrink-0 hover:bg-red-700 transition-colors"
                                >
                                  <Plus size={9} />
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 max-h-[85px] overflow-y-auto custom-scrollbar">
                              {topTravelRequests.length === 0 ? (
                                <span className="text-[9px] text-[#A0AECB]">None on record</span>
                              ) : (
                                topTravelRequests.map((r, i) => (
                                  <div key={r.id || i} className="flex items-start justify-between text-[9px] font-bold text-[#4B5A7A] gap-2 mb-1 last:mb-0">
                                    <span className="leading-tight break-words flex-1 pr-1">{r.sourceFacility} → {r.destinationFacility}</span>
                                    <span className={`px-1 py-0.2 rounded-full text-[8px] scale-95 origin-right shrink-0 mt-0.5 ${
                                      r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                      r.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                                      r.status === 'BOOKED' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>{r.status}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const isImageFile = (doc) => {
                            const name = (doc.fileName || doc.name || '').toLowerCase();
                            return /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)$/.test(name);
                          };

                          const QuickDocBox = ({ label, color, accent, docs, imgs, conditionId, phase }) => {
                            return (
                              <section className={`bg-white border ${color} rounded-lg shadow-sm overflow-hidden shrink-0`}>
                                <div className={`flex items-center justify-between border-b ${color} px-2 py-1 ${accent} shrink-0`}>
                                  <div className="flex items-center gap-2">
                                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${accent}`}><FileText size={13} /></div>
                                    <div>
                                      <h2 className="text-[10px] font-black text-[#0F1A3A]">{label} Documents</h2>
                                      <p className="text-[9px] font-bold text-[#A0AECB]">{docs.length + imgs.length} file{docs.length + imgs.length !== 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => setModal({
                                        type: 'documents',
                                        initialValues: {
                                          conditionId: conditionId || '',
                                          documentPhase: phase,
                                        },
                                      })}
                                      className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center shrink-0"
                                    >
                                      <Plus size={9} />
                                    </button>
                                  )}
                                </div>
                                <div className="bg-white">
                                  {docs.length === 0 && imgs.length === 0 ? (
                                    <div className="p-3 text-center">
                                      <FileText className="mx-auto text-[#A0AECB] opacity-50 mb-1" size={16} />
                                      <p className="text-[9px] font-bold text-[#0F1A3A]">No {label.toLowerCase()} documents.</p>
                                    </div>
                                  ) : null}
                                  {imgs.length > 0 && (() => {
                                    const sortedImgs = [...imgs].sort((a, b) => new Date(b.date || b.uploadedAt) - new Date(a.date || a.uploadedAt));
                                    return (
                                      <div className={`${sortedImgs.length > 1 ? 'flex gap-2 overflow-x-auto custom-scrollbar p-2' : 'p-2'} border-b border-[#F0F4FC]`}>
                                        {sortedImgs.map((doc) => {
                                          return (
                                            <div key={getId(doc)} className={`flex flex-col rounded-lg overflow-hidden bg-[#0A1128] border border-[#DDE3F0] shadow-sm ${sortedImgs.length > 1 ? 'min-w-[200px]' : 'w-full'}`}>
                                              <div className="relative group">
                                                <SecureInlineImage
                                                  patientId={patientId}
                                                  doc={doc}
                                                  className="w-full h-52 object-contain"
                                                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                                                />
                                                <div className="hidden w-full h-52 items-center justify-center text-[#A0AECB] bg-[#0A1128]">
                                                  <FileText size={36} />
                                                </div>
                                                <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/70 to-transparent pointer-events-none flex items-start justify-between gap-2">
                                                  <p className="text-[10px] font-bold text-white truncate drop-shadow-md">{doc.fileName || doc.name || 'Image'}</p>
                                                  <p className="text-[8px] font-black text-white shrink-0 drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm uppercase">{date(doc.date || doc.uploadedAt)}</p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => viewSecureDocument(dispatch, patientId, getId(doc))}
                                                  className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all"
                                                  title="Open full size"
                                                >
                                                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/95 text-[#0F1A3A] text-[10px] font-black px-3 py-1.5 rounded-full shadow-md">
                                                    <ExternalLink size={12} /> View
                                                  </span>
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                  {docs.length > 0 && (() => {
                                    const sortedDocs = [...docs].sort((a, b) => new Date(b.date || b.uploadedAt) - new Date(a.date || a.uploadedAt));
                                    return (
                                      <div className="divide-y divide-[#F0F4FC]">
                                        {sortedDocs.map(doc => (
                                          <div key={getId(doc)} className="px-3 py-2 hover:bg-[#F8FAFF] transition-colors">
                                            <div className="flex items-start gap-3">
                                              <div className="h-8 w-8 rounded-lg bg-[#F0F4FC] flex items-center justify-center shrink-0 mt-0.5">
                                                <FileText size={16} className="text-[#475569]" />
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                  <p className="text-sm font-bold text-[#0F1A3A] truncate">{doc.fileName || doc.name || 'Document'}</p>
                                                  <button type="button" onClick={() => viewSecureDocument(dispatch, patientId, getId(doc))} className="text-[11px] font-black text-brand-blue hover:underline shrink-0 flex items-center gap-0.5">
                                                    View <ExternalLink size={12} />
                                                  </button>
                                                </div>
                                                <p className="text-xs font-bold text-[#A0AECB] mt-1">
                                                  {(doc.type || 'FILE').replace(/_/g, ' ')} · {date(doc.date || doc.uploadedAt)}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </section>
                            );
                          };

                          const VitalsBox = ({ label, v, accentCls, borderCls }) => {
                            const st = v ? assessVitalStatus(v) : null;
                            return (
                              <section className={`bg-white border ${borderCls} rounded-lg shadow-sm overflow-hidden shrink-0`}>
                                <div className={`flex items-center justify-between border-b ${borderCls} px-2 py-1 ${accentCls}`}>
                                  <div className="flex items-center gap-1.5">
                                    <div className={`h-4 w-4 rounded flex items-center justify-center ${accentCls}`}><Thermometer size={10} /></div>
                                    <h2 className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide">{label} Vitals</h2>
                                    {v && <span className="text-[8px] font-bold text-[#A0AECB]">{date(v.recordedAt || v.createdAt)}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {st && <span className={`text-[8px] font-black px-1 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>}
                                    {canEdit && (
                                      <button type="button" onClick={() => setModal({ type: 'vitals' })} className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center hover:bg-red-700 transition-colors shrink-0">
                                        <Plus size={11} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="px-2 py-1 flex flex-wrap gap-1">
                                  {(() => {
                                    const VITAL_KEYS = [
                                      { k: 'BP', val: v?.systolicBP ? `${v.systolicBP}/${v.diastolicBP}` : null, u: 'mmHg', w: v && (v.systolicBP > 140 || v.systolicBP < 90) },
                                      { k: 'HR', val: v?.heartRate ?? null, u: 'bpm', w: v && (v.heartRate > 100 || v.heartRate < 60) },
                                      { k: 'SpO₂', val: v?.oxygenSaturation ?? null, u: '%', w: v && v.oxygenSaturation < 95 },
                                      { k: 'Temp', val: v?.temperature ?? null, u: '°C', w: v && (v.temperature > 37.2 || v.temperature < 36.1) },
                                      { k: 'RR', val: v?.respiratoryRate ?? null, u: '/min', w: v && (v.respiratoryRate > 20 || v.respiratoryRate < 12) },
                                      { k: 'GCS', val: v?.glasgowComaScale ?? null, u: '/15', w: v && v.glasgowComaScale < 14 },
                                    ];
                                    return VITAL_KEYS.map(x => (
                                      <span key={x.k} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border ${x.val != null && x.val !== '' ? (x.w ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-[#F8FAFF] border-[#DDE3F0] text-[#0F1A3A]') : 'bg-[#F8FAFF] border-[#DDE3F0] text-[#A0AECB]'}`}>
                                        <span className="text-[7px] font-black uppercase" style={{ color: 'inherit', opacity: 0.6 }}>{x.k}</span>
                                        <span className="tabular-nums font-black">{x.val != null && x.val !== '' ? x.val : 'N/A'}</span>
                                        {x.val != null && x.val !== '' && <span className="text-[7px] text-[#8A97B0]">{x.u}</span>}
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </section>
                            );
                          };

                          const getValidTime = (dateVal) => {
                            if (!dateVal) return null;
                            if (Array.isArray(dateVal)) {
                              return new Date(dateVal[0], dateVal[1] - 1, dateVal[2], dateVal[3] || 0, dateVal[4] || 0, dateVal[5] || 0).getTime();
                            }
                            const t = new Date(dateVal).getTime();
                            return isNaN(t) ? null : t;
                          };

                          const conditionSortTime = (condition) => getValidTime(condition.createdAt || condition.updatedAt || condition.dateDiagnosed || condition.diagnosedAt);

                          const activeConditions = conditions
                            .map((condition, index) => ({ condition, index, time: conditionSortTime(condition) }))
                            .filter(({ condition }) => !condition.status || condition.status === 'ACTIVE')
                            .sort((a, b) => {
                              if (a.time !== null && b.time !== null && a.time !== b.time) return a.time - b.time;
                              if (a.time !== null && b.time === null) return -1;
                              if (a.time === null && b.time !== null) return 1;
                              return b.index - a.index;
                            })
                            .map(({ condition }) => condition);

                          const fallbackCondition = conditions.length > 0 ? conditions[0] : null;
                          const conditionsToDisplay = activeConditions.length > 0 ? activeConditions : [fallbackCondition];

                          return (
                            <>
                              <div className="flex flex-col gap-6 mt-2">
                                {(() => {
                                  const sortedV = [...vitals].sort((a, b) => new Date(a.recordedAt || a.createdAt) - new Date(b.recordedAt || b.createdAt));
                                  const preVitalCond = sortedV[0] || null;
                                  const postVitalCond = sortedV.length > 1 ? sortedV[sortedV.length - 1] : null;

                                  return (
                                    <div className="grid grid-cols-2 gap-2 shrink-0">
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-1.5 border-b-2 border-brand-blue pb-1 shrink-0">
                                          <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                                          <h3 className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Pre-Treatment Vitals</h3>
                                        </div>
                                        <VitalsBox label="Pre-Treatment" v={preVitalCond} accentCls="bg-[#EFF6FF] text-[#1A3C8F]" borderCls="border-[#DBEAFE]" />
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-1.5 border-b-2 border-green-500 pb-1 shrink-0">
                                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                          <h3 className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Post-Treatment Vitals</h3>
                                        </div>
                                        <VitalsBox label="Post-Treatment" v={postVitalCond} accentCls="bg-[#F0FDF4] text-[#16A34A]" borderCls="border-[#DCFCE7]" />
                                      </div>
                                    </div>
                                  );
                                })()}

                                {conditionsToDisplay.map((cond, idx) => {
                                  const condId = getId(cond) || cond?._id;
                                  const blockDocs = documents.filter(d => {
                                    const docConditionId = getConditionLinkId(d);
                                    if (!condId) return !docConditionId;
                                    return sameId(docConditionId, condId);
                                  });

                                  const PRE_KEYS = ['PRE', 'CONSENT', 'XRAY', 'X-RAY', 'REFERRAL', 'INITIAL'];
                                  const POST_KEYS = ['POST', 'DISCHARGE', 'FOLLOW', 'RESULT', 'REPORT', 'PRESCRIPTION'];
                                  const isPre = (d) => d.documentPhase === 'PRE' || (!d.documentPhase && PRE_KEYS.some(k => String(d.type || d.category || '').toUpperCase().includes(k)));
                                  const isPost = (d) => d.documentPhase === 'POST' || (!d.documentPhase && POST_KEYS.some(k => String(d.type || d.category || '').toUpperCase().includes(k)));

                                  const preDocs = blockDocs.filter(isPre);
                                  const postDocs = blockDocs.filter(isPost);
                                  const otherDocs = blockDocs.filter(d => !isPre(d) && !isPost(d));

                                  const finalPre = preDocs.length ? preDocs : otherDocs.slice(0, Math.ceil(otherDocs.length / 2));
                                  const finalPost = postDocs.length ? postDocs : otherDocs.slice(Math.ceil(otherDocs.length / 2));

                                  const preImagesCond = finalPre.filter(isImageFile);
                                  const preDocsOnlyCond = finalPre.filter(d => !isImageFile(d));
                                  const postImagesCond = finalPost.filter(isImageFile);
                                  const postDocsOnlyCond = finalPost.filter(d => !isImageFile(d));

                                  return (
                                    <div key={condId || idx} className="flex flex-col gap-2">
                                      {conditionsToDisplay.length > 1 && cond && (
                                        <div className="flex items-center gap-1.5 px-1 pt-1">
                                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                          <h3 className="text-[12px] font-black text-[#0F1A3A] uppercase tracking-wide">INCIDENT: {cond.name || 'Condition'}</h3>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-2 mt-1">
                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-1.5 border-b-2 border-brand-blue pb-1 shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                                            <h3 className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Pre-Treatment Evidence</h3>
                                          </div>
                                          {(canEdit || preImagesCond.length > 0 || preDocsOnlyCond.length > 0) && (
                                            <div className="shrink-0"><QuickDocBox label="Pre-Treatment" color="border-[#DBEAFE]" accent="bg-[#EFF6FF] text-[#1A3C8F]" docs={preDocsOnlyCond} imgs={preImagesCond} conditionId={condId} phase="PRE" /></div>
                                          )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                          <div className="flex items-center gap-1.5 border-b-2 border-green-500 pb-1 shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <h3 className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Post-Treatment Evidence</h3>
                                          </div>
                                          {(canEdit || postImagesCond.length > 0 || postDocsOnlyCond.length > 0) && (
                                            <div className="shrink-0"><QuickDocBox label="Post-Treatment" color="border-[#DCFCE7]" accent="bg-[#F0FDF4] text-[#16A34A]" docs={postDocsOnlyCond} imgs={postImagesCond} conditionId={condId} phase="POST" /></div>
                                          )}
                                        </div>
                                      </div>

                                      {cond && (
                                        <div className="grid grid-cols-4 gap-2 mb-2 mt-1">
                                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm p-3 flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                              <h3 className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide">Findings</h3>
                                            </div>
                                            <p className="text-[10px] text-[#4B5A7A] leading-snug flex-1">{cond.findings || '—'}</p>
                                          </div>
                                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm p-3 flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                              <h3 className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide">Symptoms</h3>
                                            </div>
                                            <p className="text-[10px] text-[#4B5A7A] leading-snug flex-1">{cond.symptoms || '—'}</p>
                                          </div>
                                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm p-3 flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                              <h3 className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide">Analysis</h3>
                                            </div>
                                            <p className="text-[10px] text-[#4B5A7A] leading-snug flex-1">{cond.analysis || '—'}</p>
                                          </div>
                                          <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm p-3 flex flex-col">
                                            <div className="flex items-center gap-1.5 mb-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                              <h3 className="text-[9px] font-black text-[#0F1A3A] uppercase tracking-wide">Recommended Treatment</h3>
                                            </div>
                                            <p className="text-[10px] text-[#4B5A7A] leading-snug flex-1">{cond.recommendedTreatment || '—'}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="grid grid-cols-2 gap-2 mt-2 flex-1">
                                <div className="flex flex-col flex-1">
                                  <section className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm overflow-hidden flex flex-col flex-1">
                                    <div className="flex items-center justify-between border-b border-[#DDE3F0] px-2 py-1 shrink-0 bg-[#F8FAFF]">
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-md bg-[#DBEAFE] flex items-center justify-center"><FlaskConical size={11} className="text-[#1A3C8F]" /></div>
                                        <h2 className="text-[10px] font-black text-[#0F1A3A]">Lab Results</h2>
                                      </div>
                                      {canEdit && (
                                        <button type="button" onClick={() => setModal({ type: 'labResults' })} className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center hover:bg-red-700 transition-colors shrink-0">
                                          <Plus size={11} />
                                        </button>
                                      )}
                                    </div>
                                    <div className="divide-y divide-[#F0F4FC] overflow-y-auto custom-scrollbar max-h-[150px]">
                                      {labResults.length === 0 ? <div className="p-2"><Empty>No lab results.</Empty></div> : labResults.map(lab => (
                                        <div key={getId(lab)} className="flex flex-col gap-1 px-2 py-1.5 hover:bg-[#F8FAFF] transition-colors">
                                          <div className="flex items-center justify-between">
                                            <div className="min-w-0">
                                              <p className="text-[10px] font-bold text-[#0F1A3A] truncate">{lab.testName || lab.name}</p>
                                              <p className="text-[9px] font-bold text-[#A0AECB]">{date(lab.date || lab.resultDate)}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs font-black text-brand-blue shrink-0 ml-1">{text(lab.value)} <span className="text-[9px] text-[#8A97B0]">{lab.unit}</span></p>
                                              {lab.interpretation && (
                                                <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${String(lab.interpretation).toUpperCase() === 'NORMAL' ? 'text-green-600' : 'text-red-500'
                                                  }`}>{lab.interpretation}</p>
                                              )}
                                            </div>
                                          </div>
                                          {lab.normalRange && (
                                            <p className="text-[8px] text-[#8A97B0] font-semibold">Ref Range: {lab.normalRange}</p>
                                          )}
                                          {lab.notes && (
                                            <p className="text-[9px] text-[#4B5A7A] italic leading-tight border-l-2 border-[#DDE3F0] pl-1.5">{lab.notes}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </section>
                                </div>

                                <div className="flex flex-col flex-1">
                                  <section className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm overflow-hidden flex flex-col flex-1">
                                    <div className="flex items-center justify-between border-b border-[#DDE3F0] px-2 py-1 shrink-0 bg-[#F8FAFF]">
                                      <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-md bg-orange-50 flex items-center justify-center"><Stethoscope size={11} className="text-orange-600" /></div>
                                        <h2 className="text-[10px] font-black text-[#0F1A3A]">Procedures &amp; Visits</h2>
                                      </div>
                                      {canEdit && (
                                        <button type="button" onClick={() => setModal({ type: 'encounters' })} className="w-5 h-5 rounded-md bg-[#C8102E] text-white flex items-center justify-center hover:bg-red-700 transition-colors shrink-0">
                                          <Plus size={11} />
                                        </button>
                                      )}
                                    </div>
                                    <div className="divide-y divide-[#F0F4FC] max-h-[80px] overflow-y-auto custom-scrollbar">
                                      {encounters.length === 0 ? <div className="p-2"><Empty>No visits.</Empty></div> : encounters.map(enc => (
                                        <div key={getId(enc)} className="px-2 py-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <p className="text-[10px] font-bold text-[#0F1A3A] truncate">{enc.chiefComplaint || enc.type || 'Visit'}</p>
                                            {enc.outcome && <Badge className="bg-[#E8EEF8] text-brand-blue border-[#DDE3F0] text-[9px] shrink-0">{enc.outcome}</Badge>}
                                          </div>
                                          <p className="text-[9px] font-bold text-[#A0AECB]">{date(enc.date || enc.encounterDate)}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </section>
                                </div>
                              </div>

                              {/* FDI Dental Tooth Chart Widget (Placed below Labs Results & Procedures / Visits) */}
                              <div className="mt-3 shrink-0">
                                <FdiToothChartWidget patientId={patientId} patientName={displayName} />
                              </div>

                              <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm overflow-hidden shrink-0 mt-2">
                                <div className="flex items-center gap-2 border-b border-[#DDE3F0] px-3 py-1.5">
                                  <div className="h-5 w-5 rounded-md bg-[#E8EEF8] flex items-center justify-center"><Clock size={11} className="text-[#4B5A7A]" /></div>
                                  <h2 className="text-[10px] font-black text-[#0F1A3A] uppercase tracking-wide">Recent Activity</h2>
                                  <span className="text-[9px] font-bold text-[#A0AECB]">{timeline.length} event{timeline.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="divide-y divide-[#F0F4FC] max-h-[140px] overflow-y-auto custom-scrollbar">
                                  {timeline.length === 0
                                    ? <p className="text-[9px] text-[#A0AECB] px-3 py-2">No activity recorded yet.</p>
                                    : timeline.slice(0, 8).map((item, index) => {
                                      const st = getEventStyle(item.eventType || item.type);
                                      const Icon = st.icon;
                                      const eventDate = item.date || item.eventDate || item.timestamp;
                                      return (
                                        <button
                                          key={timelineKey(item, index)}
                                          type="button"
                                          onClick={() => setTimelineViewItem(item)}
                                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F8FAFF] transition-colors text-left"
                                        >
                                          <div className="h-5 w-5 rounded flex items-center justify-center shrink-0" style={{ background: st.bg, color: st.color }}>
                                            <Icon size={10} />
                                          </div>
                                          <span className="text-[9px] font-black uppercase tracking-wide shrink-0" style={{ color: st.color }}>{st.label}</span>
                                          <span className="text-[9px] font-bold text-[#0F1A3A] truncate flex-1">{item.title || ''}</span>
                                          <span className="text-[8px] font-bold text-[#A0AECB] shrink-0">{eventDate ? relativeTime(eventDate) : ''}</span>
                                        </button>
                                      );
                                    })
                                  }
                                </div>
                              </div>

                              <div className="bg-white border border-[#DDE3F0] rounded-lg shadow-sm overflow-hidden shrink-0 mt-2 p-3">
                                <TravelOverviewPanel patientId={patientId} />
                              </div>
                            </>
                          );
                        })()}
                      </div>

  );
}

export default DentistPatientOverview;
