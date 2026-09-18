import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, X, Eye, CheckCircle2,
  FileText, User, ClipboardList, AlertCircle,
  Layers, Target, Save, MessageSquare
} from 'lucide-react';
import client from '../api/client';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchFormTemplates } from '../store/slices/formTemplateSlice';
import {
  fetchQaReviews, fetchPendingReviews, fetchQaReviewStats, createQaReview, completeQaReview,
  selectReviews, selectReviewsLoading, selectQaPagination, selectQaStats
} from '../store/slices/qaSlice';
import { fetchRecords, selectRecords } from '../store/slices/epcrSlice';
import { fetchFeedbackThreads, createFeedbackThread } from '../store/slices/feedbackSlice';
import DynamicFormRenderer from '../components/forms/DynamicFormRenderer';

const STATUS_BADGE = {
  PENDING:      'badge badge-orange',
  QA_PENDING:   'badge badge-orange',
  IN_PROGRESS:  'badge badge-blue',
  COMPLETED:    'badge badge-green',
  QA_COMPLETED: 'badge badge-green',
  APPROVED:     'badge badge-green',
  REJECTED:     'badge badge-red',
};

const StatusBadge = ({ status }) => (
  <span className={STATUS_BADGE[status] || 'badge badge-gray'}>
    {(status || 'PENDING').replace(/_/g, ' ')}
  </span>
);

const renderRecordValue = (key, value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'YES' : 'NO';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (key === 'auditTrail') {
      return (
        <div className="space-y-3 mt-1 pl-2 border-l-2 border-slate-200">
          {value.map((entry, i) => (
            <div key={i} className="text-xs text-[#4B5A7A] bg-slate-50 border border-slate-200/50 p-2.5 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0F1A3A] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded text-[10px]">{entry.action}</span>
                <span className="text-[10px] text-[#A0AECB] font-mono">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</span>
              </div>
              <div className="font-medium text-[#0F1A3A]">
                Performed by: <span className="font-semibold">{entry.performedByName || entry.performedBy || 'Unknown'}</span> 
                {entry.ipAddress && ` (IP: ${entry.ipAddress})`}
              </div>
              {entry.fieldChanged && entry.fieldChanged !== 'record' && (
                <div className="text-[11px] text-[#4B5A7A]">
                  Field changed: <span className="font-mono text-brand-blue font-semibold">{entry.fieldChanged}</span>
                </div>
              )}
              {entry.newValue && (
                <div className="text-[11px] text-[#4B5A7A] italic">
                  "{entry.newValue}"
                </div>
              )}
              {entry.notes && (
                <div className="text-[10px] text-[#8A97B0] border-t border-slate-200/50 pt-1 mt-1">
                  Note: {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    if (typeof value[0] !== 'object') {
      return value.join(', ');
    }
    if (key === 'crew') {
      return (
        <div className="space-y-1 mt-1 pl-2 border-l-2 border-slate-200">
          {value.map((c, i) => (
            <div key={i} className="text-xs text-[#4B5A7A]">
              <span className="font-bold text-[#0F1A3A]">{c.name}</span> ({c.role || 'Paramedic'} - {c.certificationLevel || 'ALS'})
            </div>
          ))}
        </div>
      );
    }
    if (key === 'structuredComplaints') {
      return (
        <div className="space-y-1.5 mt-1 pl-2 border-l-2 border-amber-200">
          {value.map((c, i) => (
            <div key={i} className="text-xs text-[#4B5A7A] bg-amber-50/50 p-1.5 rounded-lg">
              <span className="font-bold text-[#0F1A3A]">{c.complaint}</span> (Onset: {c.onset || '—'}, Severity: <span className="font-bold text-brand-blue">{c.severity || '—'}/10</span>)
            </div>
          ))}
        </div>
      );
    }
    if (key === 'structuredVitals') {
      return (
        <div className="space-y-1.5 mt-1 pl-2 border-l-2 border-emerald-200">
          {value.map((v, i) => (
            <div key={i} className="text-xs text-[#4B5A7A] bg-emerald-50/50 p-1.5 rounded-lg space-y-0.5">
              <div className="font-bold text-[#0F1A3A]">Log #{i+1} at {v.recordedAt ? new Date(v.recordedAt).toLocaleTimeString() : '—'}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px]">
                {v.systolicBP && v.diastolicBP && <div>BP: {v.systolicBP}/{v.diastolicBP}</div>}
                {v.heartRate && <div>HR: {v.heartRate} bpm</div>}
                {v.respiratoryRate && <div>RR: {v.respiratoryRate}/min</div>}
                {v.oxygenSaturation && <div>SpO2: {v.oxygenSaturation}%</div>}
                {v.temperature && <div>Temp: {v.temperature}°C</div>}
                {v.bloodGlucose && <div>Sugar: {v.bloodGlucose} mg/dL</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (key === 'structuredMedications') {
      return (
        <div className="space-y-1 mt-1 pl-2 border-l-2 border-indigo-200">
          {value.map((m, i) => (
            <div key={i} className="text-xs text-[#4B5A7A]">
              <span className="font-bold text-[#0F1A3A]">{m.medicationName}</span> ({m.dosage} {m.unit} via {m.route || 'ORAL'})
            </div>
          ))}
        </div>
      );
    }
    if (key === 'structuredProcedures') {
      return (
        <div className="space-y-1 mt-1 pl-2 border-l-2 border-purple-200">
          {value.map((p, i) => (
            <div key={i} className="text-xs text-[#4B5A7A]">
              <span className="font-bold text-[#0F1A3A]">{p.procedureName}</span> ({p.successful ? 'Success' : 'Attempted'} - {p.bodysite || '—'})
            </div>
          ))}
        </div>
      );
    }
    return <pre className="text-xs bg-slate-50 p-2 rounded-xl overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>;
  }
  if (typeof value === 'object') {
    if (key === 'medicalHistory') {
      return (
        <div className="grid grid-cols-1 gap-1 mt-1 pl-2 border-l-2 border-red-200 text-xs text-[#4B5A7A]">
          {value.allergies?.length > 0 && <div><span className="font-semibold">Allergies:</span> {value.allergies.join(', ')}</div>}
          {value.pastConditions?.length > 0 && <div><span className="font-semibold">Past Conditions:</span> {value.pastConditions.join(', ')}</div>}
          {value.currentMedications?.length > 0 && <div><span className="font-semibold">Current Meds:</span> {value.currentMedications.join(', ')}</div>}
          {value.surgicalHistory?.length > 0 && <div><span className="font-semibold">Surgical History:</span> {value.surgicalHistory.join(', ')}</div>}
          {value.primaryPhysicianName && <div><span className="font-semibold">Physician:</span> {value.primaryPhysicianName} ({value.primaryPhysicianContact || '—'})</div>}
          {value.advanceDirective && <div><span className="font-semibold">Advance Directive:</span> YES ({value.advanceDirectiveType})</div>}
          {value.dnrOnFile !== undefined && <div><span className="font-semibold">DNR:</span> {value.dnrOnFile ? 'YES' : 'NO'}</div>}
        </div>
      );
    }
    if (key === 'sceneAssessment') {
      return (
        <div className="grid grid-cols-1 gap-1 mt-1 pl-2 border-l-2 border-amber-200 text-xs text-[#4B5A7A]">
          {value.sceneType && <div><span className="font-semibold">Type:</span> {value.sceneType}</div>}
          {value.triageTag && <div><span className="font-semibold">Triage:</span> {value.triageTag}</div>}
          {value.weatherConditions && <div><span className="font-semibold">Weather:</span> {value.weatherConditions}</div>}
          {value.sceneSafe !== undefined && <div><span className="font-semibold">Scene Safe:</span> {value.sceneSafe ? 'YES' : 'NO'}</div>}
          {value.sceneHazards && <div><span className="font-semibold">Hazards:</span> {value.sceneHazards}</div>}
        </div>
      );
    }
    if (key === 'timeline') {
      return (
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 pl-2 border-l-2 border-slate-200 text-xs text-[#4B5A7A] font-mono">
          {value.callReceivedAt && <div>Call Rx: {new Date(value.callReceivedAt).toLocaleTimeString()}</div>}
          {value.arrivedSceneAt && <div>Arrived: {new Date(value.arrivedSceneAt).toLocaleTimeString()}</div>}
          {value.patientContactAt && <div>Contact: {new Date(value.patientContactAt).toLocaleTimeString()}</div>}
          {value.departedSceneAt && <div>Departed: {new Date(value.departedSceneAt).toLocaleTimeString()}</div>}
          {value.arrivedDestinationAt && <div>Arrived Dest: {new Date(value.arrivedDestinationAt).toLocaleTimeString()}</div>}
          {value.transferOfCareAt && <div>Handoff: {new Date(value.transferOfCareAt).toLocaleTimeString()}</div>}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-0.5 mt-1 pl-2 border-l-2 border-indigo-200 text-xs text-[#4B5A7A]">
        {Object.entries(value).map(([subK, subV]) => {
          if (subV === null || subV === undefined || subV === '') return null;
          const displayVal = typeof subV === 'object' ? JSON.stringify(subV) : String(subV);
          return (
            <div key={subK} className="truncate">
              <span className="font-semibold">{subK.replace(/([A-Z])/g,' $1')}:</span> {displayVal}
            </div>
          );
        })}
      </div>
    );
  }
  return String(value);
};

const QaReviews = () => {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const { t }     = useLanguage();
  const user     = useSelector(selectUser);
  const reviews  = useSelector(selectReviews);
  const loading  = useSelector(selectReviewsLoading);
  const records  = useSelector(selectRecords);
  const { templates: qaTemplates } = useSelector(state => state.formTemplate);
  const pagination = useSelector(selectQaPagination);
  const stats      = useSelector(selectQaStats);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(
    user?.role === 'QA_REVIEWER' ? 'pending' : 'all'
  );
  const [isCreateOpen, setIsCreateOpen]   = useState(false);
  const [isViewOpen, setIsViewOpen]       = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [createForm, setCreateForm] = useState({ patientCareRecordId:'', templateId:'', feedback:'' });
  const [completeForm, setCompleteForm] = useState({ score:'', passed:true, feedback:'', responses:{} });
  const [currentPage, setCurrentPage] = useState(0);

  const PAGE_SIZE = 20;

  const fetchReviews_ = (pageNum = 0) => {
    dispatch(fetchQaReviews({
      page: pageNum,
      size: PAGE_SIZE,
      filterStatus,
    }));
    dispatch(fetchQaReviewStats());
  };

  useEffect(() => {
    setCurrentPage(0);
    fetchReviews_(0);
    dispatch(fetchRecords({ page: 0, size: 20 }));
    dispatch(fetchFormTemplates({ orgId:user?.organizationId, templateType:'QA_FORM' }));
  }, [filterStatus, user, dispatch]);

  const handleCreate = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(createQaReview({ patientCareRecordId:createForm.patientCareRecordId, qaFormId:createForm.templateId, reviewerId:user?.id, feedback:createForm.feedback, responses:{} })).unwrap();
      setIsCreateOpen(false);
      setCreateForm({ patientCareRecordId:'', templateId:'', feedback:'' });
      dispatch(addToast({ type:'success', message:'QA Review initiated' }));
      fetchReviews_(currentPage);
    } catch (err) { dispatch(addToast({ type:'error', message:err || 'Failed to create review' })); }
    finally { setIsSubmitting(false); }
  };

  const openComplete = (review) => {
    setSelectedReview(review);
    setCompleteForm({ score:review.score||'', passed:review.passed??true, feedback:review.feedback||'', responses:review.responses||{} });
    setIsCompleteOpen(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(completeQaReview({ id:selectedReview.id, data:{ ...completeForm, status:'COMPLETED' } })).unwrap();
      setIsCompleteOpen(false);
      dispatch(addToast({ type:'success', message:'QA Review completed' }));
      fetchReviews_(currentPage);
    } catch (err) { dispatch(addToast({ type:'error', message:err || 'Failed' })); }
    finally { setIsSubmitting(false); }
  };

  const openView = async (review) => {
    setSelectedReview(review);
    try {
      const res = await client.get(`/api/epcr/records/${review.recordId}`);
      setSelectedRecord(res.data); setIsViewOpen(true);
    } catch { dispatch(addToast({ type:'error', message:'Failed to load record' })); }
  };

  const handleDiscussReview = async (review) => {
    setIsSubmitting(true);
    try {
      const fetchedThreads = await dispatch(fetchFeedbackThreads()).unwrap();
      const list = Array.isArray(fetchedThreads) ? fetchedThreads : (fetchedThreads?.content || []);
      const existingThread = list.find(t => t.patientCareRecordId === review.recordId);
      
      if (existingThread) {
        navigate('/feedback', { state: { expandThreadId: existingThread.id } });
      } else {
        const patientName = review.recordDisplay ? (review.recordDisplay.includes(' (') ? review.recordDisplay.split(' (')[0] : review.recordDisplay) : 'Unknown Patient';
        const newThread = await dispatch(createFeedbackThread({
          patientCareRecordId: review.recordId,
          userId: user?.id,
          subject: `Clarification: QA Review for Patient ${patientName} (Record #${review.recordId.substring(0, 8).toUpperCase()})`,
          messages: [],
          status: 'OPEN'
        })).unwrap();
        navigate('/feedback', { state: { expandThreadId: newThread.id } });
      }
      setIsViewOpen(false);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to initiate discussion' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = (reviews || []).filter(r => {
    const patientName = r.recordDisplay ? (r.recordDisplay.includes(' (') ? r.recordDisplay.split(' (')[0] : r.recordDisplay) : '';
    return r.recordId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.feedback?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = pagination.totalPages || 1;
  const handlePage = (p) => {
    const next = Math.max(0, Math.min(p, totalPages - 1));
    setCurrentPage(next);
    fetchReviews_(next);
  };

  const inputCls = 'input py-2.5 text-sm';

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Quality Assurance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">QA <span className="text-brand-blue">Reviews</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Clinical oversight and validation matrix</p>
        </div>
        <div className="flex gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="input py-2.5 text-sm pr-4 min-w-[140px]">
            <option value="all">All Reviews</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={() => fetchReviews_(currentPage)} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> New Review
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Reviews', value:stats.total || 0, icon:ClipboardList, red:false },
          { label:'Pending', value:stats.pending || 0, icon:AlertCircle, red:true },
          { label:'Completed', value:stats.completed || 0, icon:CheckCircle2, red:false },
          { label:'Templates', value:qaTemplates?.length||0, icon:Layers, red:false },
        ].map(({ label, value, icon: Icon, red }) => (
          <div key={label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${red ? 'bg-red-50 text-brand-red' : 'bg-[#EEF2FF] text-brand-blue'}`}>
              <Icon size={18} />
            </div>
            <p className={`text-3xl font-black ${red ? 'text-brand-red' : 'text-brand-blue'}`}>{value}</p>
            <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-[#F0F4FC]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search reviews…" className="input pl-10 py-2.5 text-sm" />
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold sm:ml-auto">
            {searchTerm 
              ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''} on this page` 
              : `${pagination.totalElements || reviews.length} review${(pagination.totalElements || reviews.length) !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Reviewer</th>
                <th>Status</th>
                <th>Score</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan="5" className="py-3 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center">
                  <ClipboardList size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No reviews found</p>
                </td></tr>
              ) : filtered.map(review => (
                <tr key={review.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue shrink-0">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F1A3A]">{review.recordDisplay ? (review.recordDisplay.includes(' (') ? review.recordDisplay.split(' (')[0] : review.recordDisplay) : 'Unknown Patient'}</p>
                        <p className="text-xs text-[#A0AECB] font-mono">Record: #{review.recordId?.substring(0,8).toUpperCase()} | Review ID: {review.id?.substring(0,8)}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 text-sm text-[#4B5A7A]">
                      <User size={13} className="text-[#A0AECB]" />
                      {review.reviewerId === user?.id ? 'You' : (review.reviewerName || 'Unassigned')}
                    </div>
                  </td>
                  <td><StatusBadge status={review.status} /></td>
                  <td>
                    {review.score !== null && review.score !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-[#F0F4FC] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${review.score >= 80 ? 'bg-emerald-500' : review.score >= 60 ? 'bg-amber-500' : 'bg-brand-red'}`}
                            style={{ width:`${review.score}%` }} />
                        </div>
                        <span className="text-sm font-bold text-[#0F1A3A]">{review.score}%</span>
                      </div>
                    ) : <span className="text-xs text-[#A0AECB]">Pending</span>}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openView(review)}
                        className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                        <Eye size={15} />
                      </button>
                      {['PENDING','QA_PENDING','IN_PROGRESS'].includes(review.status) && (
                        <button onClick={() => openComplete(review)}
                          className="p-2 rounded-lg bg-[#F0FDF4] text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all">
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
              <button type="button" onClick={() => { handlePage(0); }}       disabled={currentPage === 0 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">«</button>
              <button type="button" onClick={() => { handlePage(currentPage - 1); }} disabled={currentPage === 0 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">‹ Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let start = Math.max(0, currentPage - 2);
                const end = Math.min(totalPages - 1, start + 4);
                start = Math.max(0, end - 4);
                const pg = start + i;
                if (pg > end) return null;
                return (
                  <button type="button" key={pg} onClick={() => handlePage(pg)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      pg === currentPage ? 'bg-brand-blue text-white border-brand-blue' : 'border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue'
                    }`}>{pg + 1}</button>
                );
              })}
              <button type="button" onClick={() => { handlePage(currentPage + 1); }} disabled={currentPage >= totalPages - 1 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">Next ›</button>
              <button type="button" onClick={() => { handlePage(totalPages - 1); }} disabled={currentPage >= totalPages - 1 || loading} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#DDE3F0] text-[#4B5A7A] hover:bg-[#EEF2FF] hover:border-brand-blue hover:text-brand-blue disabled:opacity-40 transition-all">»</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <Target size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">Initiate QA Review</h2>
                  <p className="text-xs text-[#8A97B0]">Select record and template</p>
                </div>
              </div>
              <button onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">EPCR Record</label>
                <select required value={createForm.patientCareRecordId}
                  onChange={e => setCreateForm({ ...createForm, patientCareRecordId:e.target.value })}
                  className={inputCls}>
                  <option value="">Select Record</option>
                  {records.map(r => <option key={r.id} value={r.id}>{r.patientName || 'Anonymous'} — #{r.id?.substring(0,8).toUpperCase()} ({r.diagnosis || 'No Diagnosis'})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">QA Template</label>
                <select required value={createForm.templateId}
                  onChange={e => setCreateForm({ ...createForm, templateId:e.target.value })}
                  className={inputCls}>
                  <option value="">Select Template</option>
                  {qaTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Initial Notes</label>
                <textarea rows={3} value={createForm.feedback}
                  onChange={e => setCreateForm({ ...createForm, feedback:e.target.value })}
                  placeholder="Enter initial review notes…" className="input py-2.5 text-sm resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Target size={15} />}
                  {isSubmitting ? 'Creating…' : 'Create Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {isCompleteOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">Complete Review</h2>
                  <p className="text-xs text-[#8A97B0]">
                    Patient: {selectedReview?.recordDisplay ? (selectedReview.recordDisplay.includes(' (') ? selectedReview.recordDisplay.split(' (')[0] : selectedReview.recordDisplay) : 'Unknown Patient'} 
                    {selectedReview?.recordId && ` (Record: #${selectedReview.recordId.substring(0,8).toUpperCase()})`}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCompleteOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleComplete} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Quality Score (%)</label>
                  <input type="number" min="0" max="100" required value={completeForm.score}
                    onChange={e => setCompleteForm({ ...completeForm, score:e.target.value })}
                    className={inputCls} placeholder="0–100" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Result</label>
                  <div className="flex items-center gap-3 h-[46px] px-4 bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl">
                    <button type="button" onClick={() => setCompleteForm({ ...completeForm, passed:!completeForm.passed })}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${completeForm.passed ? 'bg-emerald-500' : 'bg-brand-red'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${completeForm.passed ? 'left-7' : 'left-1'}`} />
                    </button>
                    <span className={`text-sm font-bold ${completeForm.passed ? 'text-emerald-600' : 'text-brand-red'}`}>
                      {completeForm.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
              </div>

              {qaTemplates.find(t => t.id === selectedReview?.qaFormId) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Form Fields</label>
                  <div className="border border-[#DDE3F0] rounded-xl p-4">
                    <DynamicFormRenderer
                      schema={qaTemplates.find(t => t.id === selectedReview?.qaFormId)?.schema || { fields:[] }}
                      onSubmit={(data) => setCompleteForm({ ...completeForm, responses:data })}
                      initialData={completeForm.responses}
                      hideActions={true}
                      onChange={(data) => setCompleteForm({ ...completeForm, responses:data })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Feedback</label>
                <textarea rows={4} required value={completeForm.feedback}
                  onChange={e => setCompleteForm({ ...completeForm, feedback:e.target.value })}
                  placeholder="Provide detailed review feedback…" className="input py-2.5 text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCompleteOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                  {isSubmitting ? 'Saving…' : 'Complete Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewOpen && selectedReview && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <Eye size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">Review Details</h2>
                  <p className="text-xs text-[#8A97B0]">#{selectedReview.id?.substring(0,12).toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIsViewOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <h4 className="text-xs font-black text-brand-blue uppercase tracking-wider pb-2 border-b border-[#F0F4FC]">Review Info</h4>
                {[
                  { label:'Patient', value:selectedReview.recordDisplay ? (selectedReview.recordDisplay.includes(' (') ? selectedReview.recordDisplay.split(' (')[0] : selectedReview.recordDisplay) : 'Unknown Patient' },
                  { label:'Record ID', value:selectedReview.recordId },
                  { label:'Reviewer', value:selectedReview.reviewerName || 'Unassigned' },
                  { label:'Created', value:new Date(selectedReview.createdAt).toLocaleString() },
                  { label:'Template', value:qaTemplates.find(t => t.id === selectedReview.qaFormId)?.name || 'Standard' },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-semibold text-[#0F1A3A]">{value}</p>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mr-1">Status</p>
                  <StatusBadge status={selectedReview.status} />
                </div>
                {selectedReview.feedback && (
                  <div className="p-4 bg-[#EEF2FF] rounded-xl">
                    <p className="text-xs font-bold text-brand-blue uppercase tracking-wider mb-2">Feedback</p>
                    <p className="text-sm text-[#4B5A7A] italic">"{selectedReview.feedback}"</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-black text-brand-red uppercase tracking-wider pb-2 border-b border-[#F0F4FC]">Patient Record</h4>
                {selectedRecord ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {Object.entries(selectedRecord).filter(([k]) => !['id','createdAt','updatedAt'].includes(k)).map(([k, v]) => (
                      <div key={k} className="space-y-1 border-b border-[#F0F4FC]/50 pb-2 last:border-0 last:pb-0">
                        <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">{k.replace(/([A-Z])/g,' $1')}</p>
                        <div className="text-sm text-[#0F1A3A] font-medium">{renderRecordValue(k, v)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="animate-spin text-[#A0AECB]" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-[#F0F4FC] flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => handleDiscussReview(selectedReview)} 
                disabled={isSubmitting}
                className="btn-primary bg-[#1A3C8F] hover:bg-[#1A3C8F]/95 text-sm px-5 py-2.5 flex items-center gap-2"
              >
                {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                Discuss this Review
              </button>
              <button 
                type="button"
                onClick={() => setIsViewOpen(false)} 
                className="btn-ghost border border-[#DDE3F0] text-sm px-6 py-2.5 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QaReviews;
