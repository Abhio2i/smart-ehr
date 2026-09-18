import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, RefreshCw, X, Eye, ShieldCheck, ShieldOff } from 'lucide-react';
import client from '../api/client';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchConsents, createConsent, revokeConsent, selectConsents, selectHipaaLoading } from '../store/slices/hipaaSlice';

const CONSENT_TYPES = [
  { value: 'TREATMENT', label: 'Treatment' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'OPERATIONS', label: 'Health Care Operations' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'DISCLOSURE', label: 'Disclosure to Third Party' },
];
const CAPTURE_METHODS = [
  { value: 'ELECTRONIC', label: 'Electronic Signature' },
  { value: 'PAPER', label: 'Paper Form' },
  { value: 'VERBAL', label: 'Verbal Confirmation' },
  { value: 'PORTAL', label: 'Patient Portal' },
];
const DATA_CATEGORIES = ['PHI', 'MENTAL_HEALTH', 'SUBSTANCE_ABUSE', 'HIV_STATUS', 'GENETIC_INFO', 'BILLING'];
const RECIPIENT_TYPES = ['INSURANCE', 'EMPLOYER', 'FAMILY', 'RESEARCHER', 'PUBLIC_HEALTH', 'LAW_ENFORCEMENT'];

const STATUS_STYLE = {
  ACTIVE: 'badge badge-green',
  REVOKED: 'badge badge-red',
  EXPIRED: 'badge badge-orange',
};

const emptyForm = {
  patientId: '', consentType: 'TREATMENT', effectiveFrom: '', effectiveTo: '',
  dataCategories: [], recipientTypes: [], captureMethod: 'ELECTRONIC', documentRef: '',
};

const consentTypeLabel = v => CONSENT_TYPES.find(t => t.value === v)?.label || v;
const captureLabel = v => CAPTURE_METHODS.find(m => m.value === v)?.label || v;

function ToggleChips({ options, selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const active = selected.includes(val);
        return (
          <button key={val} type="button" onClick={() => onChange(active ? selected.filter(x => x !== val) : [...selected, val])}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${active ? 'bg-brand-blue text-white border-brand-blue' : 'bg-[#F8FAFF] text-[#4B5A7A] border-[#DDE3F0] hover:border-[#A0AECB]'}`}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

export default function HipaaConsent() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const consents = useSelector(selectConsents);
  const loading = useSelector(selectHipaaLoading);
  const [search, setSearch] = useState('');
  const isPatient = user?.role === 'PATIENT';
  const [patId, setPatId] = useState(isPatient ? (user?.patientId || user?.id || '') : '');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const fetch_ = useCallback(() => { dispatch(fetchConsents(patId.trim())); }, [dispatch, patId]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleCreate = async e => {
    e.preventDefault();
    if (!form.patientId.trim()) { dispatch(addToast({ type: 'error', message: 'Patient ID is required.' })); return; }
    setSubmitting(true);
    try {
      const payload = {
        consentType: form.consentType,
        effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : undefined,
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
        dataCategories: form.dataCategories, recipientTypes: form.recipientTypes,
        captureMethod: form.captureMethod, documentRef: form.documentRef || undefined,
      };
      await dispatch(createConsent({ patientId: form.patientId.trim(), organizationId: user?.organizationId || '', payload })).unwrap();
      dispatch(addToast({ type: 'success', message: 'Consent created.' }));
      setCreateOpen(false); setForm({ ...emptyForm });
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create consent.' })); } 
    finally { setSubmitting(false); }
  };

  const revoke = async consent => {
    if (!window.confirm('Revoke consent for patient?')) return;
    try {
      await dispatch(revokeConsent({ patientId: consent.patientId, consentId: consent.id })).unwrap();
      dispatch(addToast({ type: 'success', message: 'Consent revoked.' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to revoke.' })); }
  };

  const view = async id => {
    try {
      const r = await client.get(`/api/hipaa/consent/${id}`);
      setSelected(r.data); setViewOpen(true);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load details.' })); }
  };

  const filtered = consents.filter(c => c.patientId?.toLowerCase().includes(search.toLowerCase()) || consentTypeLabel(c.consentType).toLowerCase().includes(search.toLowerCase()) || c.status?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">HIPAA Compliance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Patient <span className="text-brand-blue">Consent</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage patient authorizations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetch_} disabled={loading} className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {!isPatient && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
              <Plus size={16} /> New Consent
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Consents', value: consents.length, color: 'text-[#0F1A3A]' },
          { label: 'Active', value: consents.filter(c => c.status === 'ACTIVE').length, color: 'text-green-600' },
          { label: 'Revoked', value: consents.filter(c => c.status === 'REVOKED').length, color: 'text-red-600' },
          { label: 'Expired', value: consents.filter(c => c.status === 'EXPIRED').length, color: 'text-orange-600' },
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 border-b border-[#F0F4FC] bg-[#F8FAFF]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search consents..." className="input pl-10 py-2.5 text-sm bg-white" />
          </div>
          {!isPatient && (
            <div className="flex-1 max-w-sm">
               <input value={patId} onChange={e => setPatId(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetch_()} placeholder="Filter by Patient ID (press Enter)" className="input py-2.5 text-sm bg-white" />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient ID</th>
                <th>Consent Type</th>
                <th>Data Categories</th>
                <th>Status</th>
                <th>Validity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan="6" className="py-3 px-5"><div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" /></td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan="6" className="py-16 text-center">
                   <ShieldCheck size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                   <p className="text-sm text-[#A0AECB] font-medium">No consent records found.</p>
                 </td></tr>
              ) : filtered.map(c => (
                 <tr key={c.id}>
                    <td><span className="font-bold text-[#0F1A3A]">{c.patientId?.substring(0, 16)}...</span></td>
                    <td><span className="font-bold text-[#4B5A7A]">{consentTypeLabel(c.consentType)}</span></td>
                    <td>
                       <div className="flex flex-wrap gap-1.5">
                          {(c.dataCategories || []).slice(0, 2).map(d => (
                             <span key={d} className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#F8FAFF] text-[#4B5A7A] rounded border border-[#DDE3F0]">{d.replace(/_/g, ' ')}</span>
                          ))}
                          {(c.dataCategories || []).length > 2 && <span className="text-xs font-bold text-[#A0AECB]">+{c.dataCategories.length - 2}</span>}
                          {!c.dataCategories?.length && <span className="text-xs text-[#A0AECB]">—</span>}
                       </div>
                    </td>
                    <td><span className={STATUS_STYLE[c.status] || STATUS_STYLE.ACTIVE}>{c.status || 'ACTIVE'}</span></td>
                    <td>
                       <p className="text-xs font-bold text-[#4B5A7A]">From: {c.effectiveFrom ? new Date(c.effectiveFrom).toLocaleDateString() : '—'}</p>
                       <p className="text-xs text-[#8A97B0]">To: {c.effectiveTo ? new Date(c.effectiveTo).toLocaleDateString() : 'No expiry'}</p>
                    </td>
                    <td className="text-right">
                       <div className="flex justify-end gap-2">
                          <button onClick={() => view(c.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent"><Eye size={14} /></button>
                          {c.status === 'ACTIVE' && (
                             <button onClick={() => revoke(c)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-red hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent"><ShieldOff size={14} /></button>
                          )}
                       </div>
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
               <h2 className="font-black text-[#0F1A3A] text-lg">Create Consent</h2>
               <button onClick={() => { setCreateOpen(false); setForm({ ...emptyForm }); }} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 overflow-y-auto space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Patient ID *</label>
                     <input required value={form.patientId} onChange={e => setForm({...form, patientId: e.target.value})} placeholder="e.g. pat-123" className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Consent Type *</label>
                     <select required value={form.consentType} onChange={e => setForm({...form, consentType: e.target.value})} className="input py-2 text-sm">
                        {CONSENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                     </select>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Effective From *</label>
                     <input type="datetime-local" required value={form.effectiveFrom} onChange={e => setForm({...form, effectiveFrom: e.target.value})} className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Effective To</label>
                     <input type="datetime-local" value={form.effectiveTo} onChange={e => setForm({...form, effectiveTo: e.target.value})} className="input py-2 text-sm" />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Capture Method</label>
                     <select value={form.captureMethod} onChange={e => setForm({...form, captureMethod: e.target.value})} className="input py-2 text-sm">
                        {CAPTURE_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Document Reference</label>
                     <input value={form.documentRef} onChange={e => setForm({...form, documentRef: e.target.value})} placeholder="e.g. FORM-001" className="input py-2 text-sm" />
                  </div>
               </div>

               <div className="space-y-2 pt-2 border-t border-[#F0F4FC]">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Data Categories Covered</label>
                  <ToggleChips options={DATA_CATEGORIES} selected={form.dataCategories} onChange={val => setForm({...form, dataCategories: val})} />
               </div>

               <div className="space-y-2 pt-2 border-t border-[#F0F4FC]">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Recipient Types Authorized</label>
                  <ToggleChips options={RECIPIENT_TYPES} selected={form.recipientTypes} onChange={val => setForm({...form, recipientTypes: val})} />
               </div>

               <div className="flex gap-3 pt-4 border-t border-[#F0F4FC]">
                  <button type="button" onClick={() => { setCreateOpen(false); setForm({ ...emptyForm }); }} className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                     {submitting ? <RefreshCw className="animate-spin" size={15} /> : <Plus size={15} />} Create
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
                  <h2 className="font-black text-[#0F1A3A] text-lg">Consent Details</h2>
                  <p className="text-xs text-[#8A97B0] mt-0.5">{consentTypeLabel(selected.consentType)}</p>
               </div>
               <button onClick={() => setViewOpen(false)} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  {[
                     ['Patient ID', selected.patientId],
                     ['Capture Method', captureLabel(selected.captureMethod)],
                     ['Effective From', selected.effectiveFrom ? new Date(selected.effectiveFrom).toLocaleDateString() : '—'],
                     ['Effective To', selected.effectiveTo ? new Date(selected.effectiveTo).toLocaleDateString() : 'No expiry'],
                  ].map(([k,v]) => (
                     <div key={k} className="bg-[#F8FAFF] p-3 rounded-xl border border-[#DDE3F0]">
                        <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider mb-1">{k}</p>
                        <p className="text-sm font-bold text-[#0F1A3A]">{v}</p>
                     </div>
                  ))}
               </div>
               
               <div className="flex items-center gap-3 pt-2">
                  <span className={STATUS_STYLE[selected.status] || STATUS_STYLE.ACTIVE}>{selected.status}</span>
               </div>

               {selected.dataCategories?.length > 0 && (
                  <div className="pt-2">
                     <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider mb-2">Data Categories</p>
                     <div className="flex flex-wrap gap-1.5">
                        {selected.dataCategories.map(d => <span key={d} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-[#EEF2FF] text-brand-blue rounded border border-blue-100">{d.replace(/_/g, ' ')}</span>)}
                     </div>
                  </div>
               )}

               {selected.recipientTypes?.length > 0 && (
                  <div className="pt-2">
                     <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider mb-2">Authorized Recipients</p>
                     <div className="flex flex-wrap gap-1.5">
                        {selected.recipientTypes.map(r => <span key={r} className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-brand-red rounded border border-orange-100">{r.replace(/_/g, ' ')}</span>)}
                     </div>
                  </div>
               )}
            </div>
            
            <div className="p-6 border-t border-[#F0F4FC] flex justify-end gap-3">
               {selected.status === 'ACTIVE' && (
                  <button onClick={() => { setViewOpen(false); revoke(selected); }} className="btn-ghost border border-[#DDE3F0] text-brand-red hover:bg-red-50 flex items-center gap-2 px-4">
                     <ShieldOff size={16} /> Revoke Consent
                  </button>
               )}
               <button onClick={() => setViewOpen(false)} className="btn-primary px-6 py-2.5 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
