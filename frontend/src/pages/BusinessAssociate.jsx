import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, RefreshCw, X, Eye, Trash2, Handshake, Power, PowerOff } from 'lucide-react';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchBaas, createBaa, suspendVendor, activateVendor, fetchBaaDetails, selectBaas, selectBaaLoading, selectSelectedBaa } from '../store/slices/baaSlice';

const SERVICE_TYPES = [
  { value: 'NOTIFICATION_SERVICE', label: 'Notification Service' },
  { value: 'BILLING', label: 'Billing & Claims' },
  { value: 'DATA_ANALYTICS', label: 'Data Analytics' },
  { value: 'CLOUD_STORAGE', label: 'Cloud Storage' },
  { value: 'TRANSCRIPTION', label: 'Transcription' },
  { value: 'SCHEDULING', label: 'Scheduling' },
  { value: 'OTHER', label: 'Other' },
];
const BAA_STATUSES = ['ACTIVE', 'EXPIRED', 'TERMINATED', 'PENDING'];

const getStatusBadge = status => {
  const b = { ACTIVE: 'badge badge-green', EXPIRED: 'badge badge-orange', TERMINATED: 'badge badge-red', PENDING: 'badge badge-gray' };
  return b[status] || 'badge badge-gray';
};

const emptyForm = { organizationId: '', vendorName: '', serviceType: 'NOTIFICATION_SERVICE', baaStatus: 'ACTIVE', effectiveFrom: '', effectiveTo: '' };
const svcLabel = v => SERVICE_TYPES.find(s => s.value === v)?.label || v;

export default function BusinessAssociate() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const baas = useSelector(selectBaas);
  const loading = useSelector(selectBaaLoading);
  const selected = useSelector(selectSelectedBaa);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const fetch_ = useCallback(() => { dispatch(fetchBaas(user?.organizationId)); }, [dispatch, user]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const handleCreate = async e => {
    e.preventDefault(); setSubmitting(true);
    try {
      await dispatch(createBaa({
        vendorName: form.vendorName, serviceType: form.serviceType, organizationId: form.organizationId || user?.organizationId,
        baaStatus: form.baaStatus, effectiveFrom: form.effectiveFrom ? new Date(form.effectiveFrom).toISOString() : undefined,
        effectiveTo: form.effectiveTo ? new Date(form.effectiveTo).toISOString() : undefined,
      })).unwrap();
      dispatch(addToast({ type: 'success', message: 'BAA created.' }));
      setCreateOpen(false); setForm({ ...emptyForm });
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create BAA.' })); } 
    finally { setSubmitting(false); }
  };

  const handleSuspend = async id => {
    if (!window.confirm('Suspend this vendor?')) return;
    try {
      await dispatch(suspendVendor(id)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Vendor suspended.' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to suspend.' })); }
  };

  const handleActivate = async id => {
    try {
      await dispatch(activateVendor(id)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Vendor activated.' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to activate.' })); }
  };

  const view = async id => {
    try {
      await dispatch(fetchBaaDetails(id)).unwrap();
      setViewOpen(true);
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to load details.' })); }
  };

  const filtered = baas.filter(b => {
    const s = search.toLowerCase();
    const match = b.vendorName?.toLowerCase().includes(s) || b.serviceType?.toLowerCase().includes(s);
    return filter === 'all' ? match : (match && b.baaStatus?.toLowerCase() === filter);
  });

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Governance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Business <span className="text-brand-blue">Associates</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage third-party HIPAA compliance agreements</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetch_} disabled={loading} className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> New Agreement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Vendors', value: baas.length, color: 'text-[#0F1A3A]' },
          { label: 'Active', value: baas.filter(b => b.baaStatus === 'ACTIVE').length, color: 'text-green-600' },
          { label: 'Expired', value: baas.filter(b => b.baaStatus === 'EXPIRED').length, color: 'text-orange-600' },
          { label: 'Terminated', value: baas.filter(b => b.baaStatus === 'TERMINATED').length, color: 'text-red-600' }
        ].map((stat, i) => (
          <div key={i} className="card p-5">
            <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-2">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color} tracking-tight`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 border-b border-[#F0F4FC] bg-[#F8FAFF]">
          <div className="flex gap-2 p-1 bg-white rounded-xl border border-[#DDE3F0]">
             {['all','active'].map(f => (
               <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? 'bg-brand-blue text-white shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>{f}</button>
             ))}
          </div>
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="input pl-10 py-2 text-sm bg-white" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Service Type</th>
                <th>Status</th>
                <th>Effective Period</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                 <tr><td colSpan="5" className="py-3 px-5"><div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" /></td></tr>
              ) : filtered.length === 0 ? (
                 <tr><td colSpan="5" className="py-16 text-center">
                   <Handshake size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                   <p className="text-sm text-[#A0AECB] font-medium">No agreements found</p>
                 </td></tr>
              ) : filtered.map(b => (
                 <tr key={b.id}>
                    <td>
                      <p className="font-bold text-[#0F1A3A] mb-0.5">{b.vendorName}</p>
                      {b.documentRef && <p className="text-[10px] text-[#A0AECB] font-mono">Ref: {b.documentRef}</p>}
                    </td>
                    <td>
                      <span className="px-2.5 py-1 bg-[#F8FAFF] rounded-lg border border-[#DDE3F0] text-xs font-bold text-[#4B5A7A]">{svcLabel(b.serviceType)}</span>
                    </td>
                    <td><span className={getStatusBadge(b.baaStatus)}>{b.baaStatus}</span></td>
                    <td>
                       <p className="text-xs font-bold text-[#4B5A7A]">From: {b.effectiveFrom ? new Date(b.effectiveFrom).toLocaleDateString() : 'Pending'}</p>
                       <p className="text-xs text-[#8A97B0]">To: {b.effectiveTo ? new Date(b.effectiveTo).toLocaleDateString() : 'Perpetual'}</p>
                    </td>
                    <td className="text-right">
                       <div className="flex justify-end gap-2">
                          <button onClick={() => view(b.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent">
                             <Eye size={14} />
                          </button>
                          {b.baaStatus === 'ACTIVE' ? (
                             <button onClick={() => handleSuspend(b.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-orange-500 hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent" title="Suspend">
                                <PowerOff size={14} />
                             </button>
                          ) : (
                             <button onClick={() => handleActivate(b.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-green-500 hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent" title="Activate">
                                <Power size={14} />
                             </button>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
               <h2 className="font-black text-[#0F1A3A] text-lg">New BAA Protocol</h2>
               <button onClick={() => setCreateOpen(false)} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Vendor Legal Name *</label>
                  <input required value={form.vendorName} onChange={e => setForm({...form, vendorName: e.target.value})} placeholder="e.g. HealthTech Analytics Inc." className="input py-2 text-sm" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Service Type</label>
                     <select value={form.serviceType} onChange={e => setForm({...form, serviceType: e.target.value})} className="input py-2 text-sm">
                        {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                     </select>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Status</label>
                     <select value={form.baaStatus} onChange={e => setForm({...form, baaStatus: e.target.value})} className="input py-2 text-sm">
                        {BAA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Effective From</label>
                     <input type="datetime-local" value={form.effectiveFrom} onChange={e => setForm({...form, effectiveFrom: e.target.value})} className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Effective To</label>
                     <input type="datetime-local" value={form.effectiveTo} onChange={e => setForm({...form, effectiveTo: e.target.value})} className="input py-2 text-sm" />
                  </div>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Organization ID (Optional)</label>
                  <input value={form.organizationId} onChange={e => setForm({...form, organizationId: e.target.value})} placeholder={user?.organizationId || 'Default'} className="input py-2 text-sm" />
               </div>

               <div className="flex gap-3 pt-4 border-t border-[#F0F4FC]">
                  <button type="button" onClick={() => setCreateOpen(false)} className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                     {submitting ? <RefreshCw className="animate-spin" size={15} /> : <Plus size={15} />} Save Protocol
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {viewOpen && selected && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
               <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">Agreement Details</h2>
                  <p className="text-xs text-[#8A97B0] font-mono mt-0.5">ID: {selected.id}</p>
               </div>
               <button onClick={() => setViewOpen(false)} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
               {[
                 { k: 'Vendor', v: selected.vendorName },
                 { k: 'Service', v: svcLabel(selected.serviceType) },
                 { k: 'Status', v: selected.baaStatus, badge: true },
                 { k: 'Organization', v: selected.organizationId },
                 { k: 'Start Date', v: selected.effectiveFrom ? new Date(selected.effectiveFrom).toLocaleDateString() : '—' },
                 { k: 'End Date', v: selected.effectiveTo ? new Date(selected.effectiveTo).toLocaleDateString() : 'Perpetual' }
               ].map((item, i) => (
                 <div key={i} className="bg-[#F8FAFF] p-4 rounded-xl border border-[#DDE3F0]">
                    <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-1">{item.k}</p>
                    {item.badge ? <span className={getStatusBadge(item.v)}>{item.v}</span> : <p className="font-bold text-[#0F1A3A]">{item.v}</p>}
                 </div>
               ))}
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
