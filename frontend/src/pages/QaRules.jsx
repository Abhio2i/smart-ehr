import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Plus, Search, Trash2, RefreshCw, X, Edit2, AlertCircle, CheckCircle2, 
  Shield, Activity, Zap, Layers, Filter, Fingerprint,
  ShieldCheck, ShieldAlert
} from 'lucide-react';
import { fetchQARules, createQARule, updateQARule, deleteQARule } from '../store/slices/qaRulesSlice';
import { fetchOrganizations } from '../store/slices/orgSlice';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';

const OPERATORS = ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'IN_LIST', 'NOT_IN_LIST'];
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const SEVERITY_BADGE = {
  LOW:      'badge badge-gray',
  MEDIUM:   'badge badge-blue',
  HIGH:     'badge badge-orange',
  CRITICAL: 'badge badge-red',
};

const inputCls = 'input py-2.5 text-sm';
const labelCls = 'text-xs font-bold text-[#4B5A7A] uppercase tracking-wider mb-1.5 block';

const QaRules = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { rules, loading } = useSelector(state => state.qaRules);
  const { organizations } = useSelector(state => state.org);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '', fieldPath: '', operator: 'EQUALS', expectedValue: '', severity: 'MEDIUM', message: '', active: true,
  });

  const [editForm, setEditForm] = useState({
    name: '', fieldPath: '', operator: 'EQUALS', expectedValue: '', severity: 'MEDIUM', message: '', active: true,
  });

  const orgId = selectedOrgId || user?.organizationId;

  useEffect(() => {
    dispatch(fetchOrganizations());
    if (orgId) dispatch(fetchQARules(orgId));
  }, [orgId, dispatch]);

  const handleCreate = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(createQARule({ ...addForm, organizationId: orgId })).unwrap();
      setIsAddOpen(false); setAddForm({ name: '', fieldPath: '', operator: 'EQUALS', expectedValue: '', severity: 'MEDIUM', message: '', active: true });
      dispatch(addToast({ type: 'success', message: 'Rule created successfully' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create rule.' })); } 
    finally { setIsSubmitting(false); }
  };

  const openEdit = rule => {
    setEditRule(rule);
    setEditForm({ 
      name: rule.name || '', fieldPath: rule.fieldPath || '', operator: rule.operator || 'EQUALS', 
      expectedValue: rule.expectedValue || '', severity: rule.severity || 'MEDIUM', 
      message: rule.message || '', active: rule.active ?? true 
    });
    setIsEditOpen(true);
  };

  const handleEdit = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(updateQARule({ id: editRule.id, data: editForm })).unwrap();
      setIsEditOpen(false); dispatch(addToast({ type: 'success', message: 'Rule updated' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to update rule.' })); } 
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this QA rule?')) return;
    try {
      await dispatch(deleteQARule(id)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Rule deleted' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to delete rule.' })); }
  };

  const filtered = (rules || []).filter(r => 
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.fieldPath?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Quality Assurance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Validation <span className="text-brand-blue">Rules</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Automated clinical data validation criteria</p>
        </div>
        <div className="flex gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)} className="input py-2.5 text-sm w-48">
            <option value="">Default Organization</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => dispatch(fetchQARules(orgId))} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsAddOpen(true)} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> New Rule
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Rules', value: rules?.filter(r => r.active).length || 0, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'High Priority', value: rules?.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL').length || 0, icon: Zap, color: 'text-brand-red', bg: 'bg-red-50' },
          { label: 'Logic Nodes', value: 'L3_CORE', icon: Layers, color: 'text-brand-blue', bg: 'bg-[#EEF2FF]' },
          { label: 'Total Rules', value: rules?.length || 0, icon: Fingerprint, color: 'text-[#4B5A7A]', bg: 'bg-[#F8FAFF]' },
        ].map((stat, i) => (
          <div key={i} className="stat-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.bg} ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main Table Content */}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 border-b border-[#F0F4FC]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search rules..." className="input pl-10 py-2.5 text-sm" />
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold sm:ml-auto">{filtered.length} rules</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Validation Logic</th>
                <th>Severity</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan="5" className="py-3 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center">
                  <ShieldAlert size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No validation rules found</p>
                </td></tr>
              ) : filtered.map(rule => (
                <tr key={rule.id}>
                  <td>
                    <div>
                      <p className="font-bold text-[#0F1A3A] mb-0.5">{rule.name}</p>
                      <p className="text-[10px] text-[#A0AECB] font-mono">ID: {rule.id?.substring(0, 8)}</p>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <code className="px-2 py-0.5 bg-[#F8FAFF] rounded text-xs font-semibold text-brand-blue border border-[#DDE3F0]">{rule.fieldPath}</code>
                        <span className="text-[10px] font-bold text-[#8A97B0] uppercase">{rule.operator}</span>
                        <code className="px-2 py-0.5 bg-[#F8FAFF] rounded text-xs font-semibold text-[#4B5A7A] border border-[#DDE3F0]">{rule.expectedValue}</code>
                      </div>
                      <p className="text-xs text-[#8A97B0] italic mt-1 line-clamp-1">"{rule.message}"</p>
                    </div>
                  </td>
                  <td>
                    <span className={SEVERITY_BADGE[rule.severity] || SEVERITY_BADGE.MEDIUM}>{rule.severity}</span>
                  </td>
                  <td>
                    <span className={rule.active ? 'badge badge-green' : 'badge badge-gray'}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(rule)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-red hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                   <Shield size={20} />
                </div>
                <h2 className="font-black text-[#0F1A3A] text-lg">{isAddOpen ? 'New Validation Rule' : 'Edit Rule'}</h2>
              </div>
              <button onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleCreate : handleEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Rule Name *</label>
                  <input required value={(isAddOpen ? addForm : editForm).name} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), name: e.target.value })}
                    placeholder="e.g. Check Vitals Complete" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Data Field Path *</label>
                  <input required value={(isAddOpen ? addForm : editForm).fieldPath} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), fieldPath: e.target.value })}
                    placeholder="e.g. demographics.age" className={inputCls} />
                </div>
                
                <div className="space-y-1.5">
                  <label className={labelCls}>Operator</label>
                  <select value={(isAddOpen ? addForm : editForm).operator} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), operator: e.target.value })} className={inputCls}>
                    {OPERATORS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Expected Value</label>
                  <input required value={(isAddOpen ? addForm : editForm).expectedValue} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), expectedValue: e.target.value })}
                    placeholder="e.g. true" className={inputCls} />
                </div>
                
                <div className="space-y-1.5">
                  <label className={labelCls}>Severity</label>
                  <select value={(isAddOpen ? addForm : editForm).severity} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), severity: e.target.value })} className={inputCls}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6 cursor-pointer w-fit" onClick={() => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), active: !(isAddOpen ? addForm : editForm).active })}>
                   <div className={`w-10 h-5 rounded-full relative transition-all ${(isAddOpen ? addForm : editForm).active ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${(isAddOpen ? addForm : editForm).active ? 'left-5' : 'left-0.5'}`} />
                   </div>
                   <span className="text-sm font-semibold text-[#4B5A7A]">Rule Active</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className={labelCls}>Alert Message *</label>
                <textarea required rows={3} value={(isAddOpen ? addForm : editForm).message} onChange={e => (isAddOpen ? setAddForm : setEditForm)({ ...(isAddOpen ? addForm : editForm), message: e.target.value })}
                  className="input py-2.5 text-sm resize-none" placeholder="Message shown when validation fails..." />
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {isSubmitting ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QaRules;
