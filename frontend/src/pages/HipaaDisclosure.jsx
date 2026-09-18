import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, RefreshCw, X, Eye, BookOpen, Filter } from 'lucide-react';
import client from '../api/client';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchDisclosures, createDisclosure, selectDisclosures, selectHipaaLoading } from '../store/slices/hipaaSlice';

const PURPOSE_OPTIONS = [
  { value: 'TREATMENT', label: 'Treatment' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OPERATIONS', label: 'Health Care Operations' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'PUBLIC_HEALTH', label: 'Public Health Activity' },
  { value: 'LAW_ENFORCEMENT', label: 'Law Enforcement' },
  { value: 'OTHER', label: 'Other' },
];
const LEGAL_BASIS_OPTIONS = [
  { value: 'HIPAA_TPO', label: 'HIPAA TPO (Treatment/Payment/Operations)' },
  { value: 'PATIENT_AUTHORIZATION', label: 'Patient Authorization' },
  { value: 'PUBLIC_INTEREST', label: 'Public Interest' },
  { value: 'LAW_ENFORCEMENT', label: 'Law Enforcement' },
  { value: 'JUDICIAL_ORDER', label: 'Judicial Order' },
];
const METHOD_OPTIONS = [
  { value: 'SECURE_TRANSFER', label: 'Secure Transfer' },
  { value: 'EMAIL', label: 'Encrypted Email' },
  { value: 'FAX', label: 'Secure Fax' },
  { value: 'MAIL', label: 'Physical Mail' },
  { value: 'PORTAL', label: 'Patient Portal' },
  { value: 'IN_PERSON', label: 'In Person' },
];
const DATA_ELEMENTS = ['diagnosis', 'medications', 'vitals', 'patient_info', 'treatment', 'billing', 'labs', 'imaging'];

const PURPOSE_COLORS = {
  TREATMENT: 'badge badge-green',
  PAYMENT: 'badge badge-blue',
  RESEARCH: 'badge badge-orange',
  OTHER: 'badge badge-gray',
};

const purposeLabel = v => PURPOSE_OPTIONS.find(p => p.value === v)?.label || v;
const legalBasisLabel = v => LEGAL_BASIS_OPTIONS.find(l => l.value === v)?.label || v;
const methodLabel = v => METHOD_OPTIONS.find(m => m.value === v)?.label || v;
const purposeColor = v => PURPOSE_COLORS[v] || PURPOSE_COLORS.OTHER;

const emptyForm = {
  patientId: '', organizationId: '', recordId: '', recipientName: '', recipientType: '',
  purpose: 'TREATMENT', legalBasis: 'HIPAA_TPO', consentId: '', method: 'SECURE_TRANSFER', dataElements: [],
};

export default function HipaaDisclosure() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const disclosures = useSelector(selectDisclosures);
  const loading = useSelector(selectHipaaLoading);
  const [search, setSearch] = useState('');
  const [filterPurpose, setFilterPurpose] = useState('ALL');
  const isPatient = user?.role === 'PATIENT';
  const [patId, setPatId] = useState(isPatient ? (user?.patientId || user?.id || '') : '');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const fetch_ = useCallback(() => { dispatch(fetchDisclosures({ patientId: patId.trim() || undefined, organizationId: user?.organizationId })); }, [dispatch, patId, user]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleCreate = async e => {
    e.preventDefault();
    if (!form.patientId.trim()) { dispatch(addToast({ type: 'error', message: 'Patient ID required.' })); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, organizationId: form.organizationId || user?.organizationId };
      await dispatch(createDisclosure(payload)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Disclosure log created.' }));
      setCreateOpen(false); setForm({ ...emptyForm });
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create log.' })); } 
    finally { setSubmitting(false); }
  };

  const view = async id => {
    try {
      const r = await client.get(`/api/hipaa/disclosure/${id}`);
      setSelected(r.data); setViewOpen(true);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load.' })); }
  };

  const toggleElement = el => setForm(f => ({ ...f, dataElements: f.dataElements.includes(el) ? f.dataElements.filter(x => x !== el) : [...f.dataElements, el] }));

  const filtered = disclosures.filter(d => {
    const matchSearch = d.patientId?.toLowerCase().includes(search.toLowerCase()) || d.recipientName?.toLowerCase().includes(search.toLowerCase()) || purposeLabel(d.purpose).toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterPurpose === 'ALL' || d.purpose === filterPurpose);
  });

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">HIPAA Compliance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Disclosure <span className="text-brand-blue">Accounting</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Track PHI disclosures for HIPAA accounting (AoD)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetch_} disabled={loading} className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {!isPatient && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
              <Plus size={16} /> Log Disclosure
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Disclosures', value: disclosures.length, color: 'text-[#0F1A3A]' },
          { label: 'Treatment (TPO)', value: disclosures.filter(d => d.purpose === 'TREATMENT').length, color: 'text-green-600' },
          { label: 'Research', value: disclosures.filter(d => d.purpose === 'RESEARCH').length, color: 'text-orange-600' },
          { label: 'Other', value: disclosures.filter(d => !['TREATMENT', 'RESEARCH'].includes(d.purpose)).length, color: 'text-[#4B5A7A]' },
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 border-b border-[#F0F4FC] bg-[#F8FAFF]">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input pl-10 py-2.5 text-sm bg-white w-48" />
            </div>
            {!isPatient && (
              <input value={patId} onChange={e => setPatId(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetch_()} placeholder="Filter Patient ID (Enter)" className="input py-2.5 text-sm bg-white w-48" />
            )}
            <select value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)} className="input py-2.5 text-sm bg-white w-40">
              <option value="ALL">All Purposes</option>
              {PURPOSE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient & Record</th>
                <th>Recipient</th>
                <th>Purpose</th>
                <th>Method</th>
                <th>Data Disclosed</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan="7" className="py-3 px-5"><div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" /></td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan="7" className="py-16 text-center">
                   <BookOpen size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                   <p className="text-sm text-[#A0AECB] font-medium">No disclosures found.</p>
                 </td></tr>
              ) : filtered.map(d => (
                 <tr key={d.id}>
                    <td>
                      <p className="font-bold text-[#0F1A3A]">{d.patientId?.substring(0, 16)}...</p>
                      {d.recordId && <p className="text-[10px] text-[#A0AECB] font-mono mt-0.5">Rec: {d.recordId?.substring(0, 8)}</p>}
                    </td>
                    <td>
                      <p className="font-bold text-[#4B5A7A]">{d.recipientName || '—'}</p>
                      {d.recipientType && <p className="text-xs text-[#8A97B0]">{d.recipientType.replace(/_/g, ' ')}</p>}
                    </td>
                    <td><span className={purposeColor(d.purpose)}>{purposeLabel(d.purpose)}</span></td>
                    <td><span className="text-xs font-bold text-[#4B5A7A] bg-[#F8FAFF] px-2 py-1 rounded border border-[#DDE3F0]">{methodLabel(d.method)}</span></td>
                    <td>
                       <div className="flex flex-wrap gap-1">
                          {(d.dataElements || []).slice(0, 2).map(el => (
                             <span key={el} className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#F8FAFF] text-[#4B5A7A] rounded border border-[#DDE3F0]">{el}</span>
                          ))}
                          {(d.dataElements || []).length > 2 && <span className="text-[10px] font-bold text-[#A0AECB]">+{d.dataElements.length - 2}</span>}
                       </div>
                    </td>
                    <td>
                       <span className="text-sm font-bold text-[#4B5A7A]">{d.disclosedAt ? new Date(d.disclosedAt).toLocaleDateString() : d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}</span>
                    </td>
                    <td className="text-right">
                       <button onClick={() => view(d.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent"><Eye size={14} /></button>
                    </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
               <h2 className="font-black text-[#0F1A3A] text-lg">Log PHI Disclosure</h2>
               <button onClick={() => { setCreateOpen(false); setForm({ ...emptyForm }); }} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Patient ID *</label>
                     <input required value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} placeholder="e.g. pat-123" className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Record ID (Optional)</label>
                     <input value={form.recordId} onChange={e => setForm({...form, recordId: e.target.value})} placeholder="e.g. rec-456" className="input py-2 text-sm" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Recipient Name *</label>
                     <input required value={form.recipientName} onChange={e => setForm({...form, recipientName: e.target.value})} placeholder="Dr. Smith / Hospital" className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Recipient Type</label>
                     <input value={form.recipientType} onChange={e => setForm({...form, recipientType: e.target.value})} placeholder="PHYSICIAN, INSURANCE..." className="input py-2 text-sm" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Purpose *</label>
                     <select required value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className="input py-2 text-sm">
                        {PURPOSE_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Legal Basis</label>
                     <select value={form.legalBasis} onChange={e => setForm({...form, legalBasis: e.target.value})} className="input py-2 text-sm">
                        {LEGAL_BASIS_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                     </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Transfer Method</label>
                     <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="input py-2 text-sm">
                        {METHOD_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Consent ID (Optional)</label>
                     <input value={form.consentId} onChange={e => setForm({...form, consentId: e.target.value})} placeholder="Consent Ref" className="input py-2 text-sm" />
                  </div>
               </div>

               <div className="space-y-2 pt-2 border-t border-[#F0F4FC]">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Data Elements Disclosed</label>
                  <div className="flex flex-wrap gap-2">
                     {DATA_ELEMENTS.map(el => (
                        <button key={el} type="button" onClick={() => toggleElement(el)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${form.dataElements.includes(el) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-[#F8FAFF] text-[#4B5A7A] border-[#DDE3F0] hover:border-[#A0AECB]'}`}>
                           {el.replace(/_/g, ' ')}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="flex gap-3 pt-4 border-t border-[#F0F4FC]">
                  <button type="button" onClick={() => { setCreateOpen(false); setForm({ ...emptyForm }); }} className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                     {submitting ? <RefreshCw className="animate-spin" size={15} /> : <Plus size={15} />} Log Disclosure
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {viewOpen && selected && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#DDE3F0] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
               <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">Disclosure Details</h2>
                  <p className="text-xs text-[#8A97B0] mt-0.5">{purposeLabel(selected.purpose)}</p>
               </div>
               <button onClick={() => setViewOpen(false)} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  {[
                     ['Patient ID', selected.patientId],
                     ['Record ID', selected.recordId],
                     ['Recipient', selected.recipientName],
                     ['Type', selected.recipientType],
                     ['Legal Basis', legalBasisLabel(selected.legalBasis)],
                     ['Method', methodLabel(selected.method)],
                     ['Date', selected.disclosedAt ? new Date(selected.disclosedAt).toLocaleString() : selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'],
                     ['Consent Ref', selected.consentId],
                  ].map(([k,v]) => (
                     <div key={k} className="bg-[#F8FAFF] p-3 rounded-xl border border-[#DDE3F0]">
                        <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider mb-1">{k}</p>
                        <p className="text-sm font-bold text-[#0F1A3A]">{v || '—'}</p>
                     </div>
                  ))}
               </div>

               {selected.dataElements?.length > 0 && (
                  <div className="pt-2">
                     <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider mb-2">Data Elements</p>
                     <div className="flex flex-wrap gap-1.5">
                        {selected.dataElements.map(el => <span key={el} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#EEF2FF] text-brand-blue rounded border border-blue-100">{el.replace(/_/g, ' ')}</span>)}
                     </div>
                  </div>
               )}
            </div>
            
            <div className="p-6 border-t border-[#F0F4FC] flex justify-end">
               <button onClick={() => setViewOpen(false)} className="btn-primary px-6 py-2.5 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
