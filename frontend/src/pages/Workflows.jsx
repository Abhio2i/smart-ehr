import { useState, useEffect } from 'react';
import {
  GitBranch, Plus, RefreshCw, X, Trash2, Edit2,
  Rocket, Check, ChevronRight, ArrowUpRight,
  ToggleLeft, ToggleRight, AlertCircle
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import {
  fetchWorkflows, createWorkflow, updateWorkflow,
  deleteWorkflow, createDeployment,
  selectWorkflows, selectWorkflowLoading
} from '../store/slices/workflowSlice';
import { fetchOrganizations } from '../store/slices/orgSlice';
import FormBuilder from '../components/forms/FormBuilder';

/* ── Shared style tokens (same as Dashboard) ── */
const inputCls = 'w-full bg-white border border-[#DDE3F0] rounded-xl px-4 py-2.5 text-sm text-[#0F1A3A] focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all placeholder-[#A0AECB] font-medium';
const labelCls = 'block text-xs font-semibold text-[#8A97B0] mb-1.5';

const ROLES = ['ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'VIEWER'];
const emptyStep = () => ({ stepNumber: 1, stepName: '', assignedRole: 'PARAMEDIC', action: '', durationDays: 1, isMandatory: true });
const emptyForm = (user) => ({ name: '', description: '', organizationId: user?.organizationId || '', domain: '', category: '', active: true, steps: [emptyStep()], formSchema: { fields: [] } });

/* ── Section Header (same as Dashboard) ── */
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 p-5 border-b border-[#F0F4FC]">
    <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-brand-blue flex items-center justify-center">
      <Icon size={17} />
    </div>
    <h2 className="text-sm font-bold text-[#0F1A3A]">{title}</h2>
  </div>
);

/* ── Status Badge ── */
const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-[#F0F4FC] text-[#8A97B0] border border-[#DDE3F0]'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-[#C0CADF]'}`} />
    {active ? 'Active' : 'Draft'}
  </span>
);

/* ── Steps Editor ── */
const StepsEditor = ({ form, setForm }) => {
  const addStep = () => setForm(prev => ({ ...prev, steps: [...prev.steps, { ...emptyStep(), stepNumber: prev.steps.length + 1 }] }));
  const updateStep = (idx, field, val) => {
    const steps = [...form.steps];
    steps[idx] = { ...steps[idx], [field]: val };
    setForm({ ...form, steps });
  };
  const removeStep = (idx) => setForm({ ...form, steps: form.steps.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <label className={labelCls}>Steps ({form.steps?.length || 0})</label>
        <button type="button" onClick={addStep} className="flex items-center gap-1.5 text-xs font-semibold text-brand-blue hover:text-brand-blue/80 transition-colors">
          <Plus size={13} /> Add Step
        </button>
      </div>
      <div className="space-y-3">
        {form.steps?.map((step, idx) => (
          <div key={idx} className="p-4 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-brand-blue bg-[#EEF2FF] px-2.5 py-0.5 rounded-full">Step {idx + 1}</span>
              {form.steps.length > 1 && (
                <button type="button" onClick={() => removeStep(idx)} className="w-6 h-6 flex items-center justify-center rounded-lg text-[#A0AECB] hover:text-brand-red hover:bg-red-50 transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Step Name</label>
                <input value={step.stepName} onChange={e => updateStep(idx, 'stepName', e.target.value)} className={inputCls} placeholder="e.g. Initial Assessment" />
              </div>
              <div>
                <label className={labelCls}>Assigned Role</label>
                <select value={step.assignedRole} onChange={e => updateStep(idx, 'assignedRole', e.target.value)} className={inputCls + ' appearance-none cursor-pointer'}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Action</label>
                <input value={step.action} onChange={e => updateStep(idx, 'action', e.target.value)} className={inputCls} placeholder="e.g. APPROVE" />
              </div>
              <div>
                <label className={labelCls}>Duration (days)</label>
                <input type="number" min="1" value={step.durationDays} onChange={e => updateStep(idx, 'durationDays', parseInt(e.target.value) || 1)} className={inputCls} placeholder="1" />
              </div>
              <div className="flex flex-col justify-end">
                <label className={labelCls}>Mandatory</label>
                <button
                  type="button"
                  onClick={() => updateStep(idx, 'isMandatory', !step.isMandatory)}
                  className="flex items-center gap-2 px-3 py-2.5 border border-[#DDE3F0] rounded-xl hover:border-brand-blue transition-colors bg-white"
                >
                  {step.isMandatory
                    ? <ToggleRight size={18} className="text-brand-blue" />
                    : <ToggleLeft size={18} className="text-[#A0AECB]" />}
                  <span className={`text-xs font-semibold ${step.isMandatory ? 'text-brand-blue' : 'text-[#8A97B0]'}`}>
                    {step.isMandatory ? 'Yes' : 'No'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Workflow Modal ── */
const WfModal = ({ mode, form, setForm, onSubmit, onClose, isSubmitting, error }) => (
  <div className="fixed inset-0 bg-[#0F1A3A]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden my-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#F0F4FC]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-brand-blue flex items-center justify-center">
            <GitBranch size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0F1A3A]">{mode === 'create' ? 'New Workflow' : 'Edit Workflow'}</h2>
            <p className="text-xs text-[#A0AECB]">{mode === 'create' ? 'Define a new clinical protocol sequence' : 'Update workflow configuration'}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-[#0F1A3A] hover:bg-[#F0F4FC] transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <form onSubmit={onSubmit}>
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-brand-red">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Workflow Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className={inputCls} placeholder="e.g. Patient Intake Review" />
            </div>
            <div>
              <label className={labelCls}>Domain</label>
              <input value={form.domain || ''} onChange={e => setForm({ ...form, domain: e.target.value })} className={inputCls} placeholder="e.g. Clinical, Administrative" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <input value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls} placeholder="e.g. QA Governance, Compliance" />
            </div>
            <div>
              <label className={labelCls}>Review Tag</label>
              <input value={form.reviewCategory || ''} onChange={e => setForm({ ...form, reviewCategory: e.target.value })} className={inputCls} placeholder="e.g. CARDIAC_SOP, TRAUMA_PROTOCOL" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls + ' resize-none'} placeholder="Describe the purpose and scope of this workflow..." />
          </div>

          {/* Active toggle */}
          <div>
            <label className={labelCls}>Status</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, active: !form.active })}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#DDE3F0] rounded-xl hover:border-brand-blue transition-colors"
            >
              {form.active
                ? <ToggleRight size={20} className="text-brand-blue" />
                : <ToggleLeft size={20} className="text-[#A0AECB]" />}
              <span className={`text-sm font-semibold ${form.active ? 'text-brand-blue' : 'text-[#8A97B0]'}`}>
                {form.active ? 'Active' : 'Draft'}
              </span>
            </button>
          </div>

          {/* Steps */}
          <div className="pt-2 border-t border-[#F0F4FC]">
            <StepsEditor form={form} setForm={setForm} />
          </div>

          {/* Form Builder */}
          <div className="pt-2 border-t border-[#F0F4FC]">
            <label className={labelCls + ' mb-3'}>Form Schema</label>
            <FormBuilder
              schema={form.formSchema || { fields: [] }}
              onChange={newSchema => setForm({ ...form, formSchema: newSchema })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-3 border-t border-[#F0F4FC] bg-[#FAFBFF]">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-[#8A97B0] hover:text-[#0F1A3A] transition-colors">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-4 py-1.5 text-xs flex items-center gap-2 disabled:opacity-60">
            {isSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Workflow' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

/* ── Deploy Modal ── */
const DeployModal = ({ workflow, orgs, onClose, onDeploy, isSubmitting, error }) => {
  const [deployTargets, setDeployTargets] = useState([]);
  const toggleTarget = (id) => setDeployTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const available = orgs.filter(o => o.id !== workflow.organizationId);

  return (
    <div className="fixed inset-0 bg-[#0F1A3A]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden my-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#F0F4FC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-brand-blue flex items-center justify-center">
              <Rocket size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F1A3A]">Deploy Workflow</h2>
              <p className="text-xs text-[#A0AECB] truncate max-w-xs">{workflow.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-[#0F1A3A] hover:bg-[#F0F4FC] transition-colors shrink-0">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onDeploy(deployTargets); }}>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-semibold text-brand-red">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <p className="text-xs font-semibold text-[#8A97B0]">Select target organizations:</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {available.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-[#A0AECB] font-medium">No other organizations available</p>
                </div>
              ) : available.map(org => (
                <label key={org.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#DDE3F0] cursor-pointer hover:border-brand-blue hover:bg-[#F8FAFF] transition-colors group">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${deployTargets.includes(org.id) ? 'bg-brand-blue border-brand-blue' : 'border-[#DDE3F0] group-hover:border-brand-blue'}`}>
                    {deployTargets.includes(org.id) && <Check size={12} className="text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={deployTargets.includes(org.id)} onChange={() => toggleTarget(org.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F1A3A] truncate">{org.name}</p>
                    <p className="text-xs text-[#A0AECB]">{org.code}</p>
                  </div>
                </label>
              ))}
            </div>
            {deployTargets.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FF] rounded-xl">
                <Check size={13} className="text-brand-blue" />
                <span className="text-xs font-semibold text-brand-blue">{deployTargets.length} organization{deployTargets.length > 1 ? 's' : ''} selected</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 p-4 border-t border-[#F0F4FC] bg-[#FAFBFF]">
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-[#8A97B0] hover:text-[#0F1A3A] transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting || !deployTargets.length} className="btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-60">
              {isSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <Rocket size={12} />}
              {isSubmitting ? 'Deploying...' : 'Deploy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ── Workflow Card ── */
const WorkflowCard = ({ wf, onEdit, onDelete, onDeploy, isAdmin }) => (
  <div className="card hover:shadow-[0_4px_24px_rgba(26,60,143,0.08)] transition-all group">
    {/* Card Header */}
    <div className="p-5 border-b border-[#F0F4FC]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EEF2FF] text-brand-blue flex items-center justify-center shrink-0 group-hover:bg-brand-blue group-hover:text-white transition-colors">
            <GitBranch size={17} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0F1A3A] truncate">{wf.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {wf.domain && <span className="text-[10px] font-semibold text-[#A0AECB] bg-[#F0F4FC] px-2 py-0.5 rounded">{wf.domain}</span>}
              {wf.category && <span className="text-[10px] text-[#A0AECB]">{wf.category}</span>}
            </div>
          </div>
        </div>
        <StatusBadge active={wf.active} />
      </div>
    </div>

    {/* Description */}
    {wf.description && (
      <div className="px-5 pt-4">
        <p className="text-xs text-[#8A97B0] line-clamp-2 leading-relaxed">{wf.description}</p>
      </div>
    )}

    {/* Steps Pipeline */}
    <div className="px-5 py-4">
      <p className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-widest mb-3">
        Pipeline · {wf.steps?.length || 0} step{wf.steps?.length !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {wf.steps?.slice(0, 6).map((step, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] border border-[#DDE3F0] flex items-center justify-center text-[10px] font-bold text-brand-blue">
                {i + 1}
              </div>
              {step.stepName && (
                <span className="text-[9px] text-[#A0AECB] mt-1 max-w-[56px] text-center leading-tight truncate">{step.stepName}</span>
              )}
            </div>
            {i < (wf.steps?.length || 0) - 1 && i < 5 && (
              <ChevronRight size={12} className="text-[#DDE3F0] shrink-0 mb-3" />
            )}
          </div>
        ))}
        {wf.steps?.length > 6 && (
          <span className="text-[10px] font-semibold text-[#A0AECB] ml-1 mb-3">+{wf.steps.length - 6} more</span>
        )}
        {(!wf.steps || wf.steps.length === 0) && (
          <span className="text-xs text-[#C0CADF]">No steps defined</span>
        )}
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#F0F4FC]">
      {isAdmin && (
        <button onClick={() => onDeploy(wf)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-brand-blue hover:bg-[#EEF2FF] transition-colors" title="Deploy">
          <Rocket size={14} />
        </button>
      )}
      <button onClick={() => onEdit(wf)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-brand-blue hover:bg-[#EEF2FF] transition-colors" title="Edit">
        <Edit2 size={14} />
      </button>
      <button onClick={() => onDelete(wf.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-brand-red hover:bg-red-50 transition-colors" title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  </div>
);

/* ── Main Workflows Page ── */
const Workflows = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const workflows = useSelector(selectWorkflows);
  const loading = useSelector(selectWorkflowLoading);
  const { organizations: orgs } = useSelector(state => state.org);

  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editWf, setEditWf] = useState(null);
  const [deployWf, setDeployWf] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wfForm, setWfForm] = useState(emptyForm(user));

  const fetchData = () => {
    dispatch(fetchWorkflows(user?.organizationId));
    dispatch(fetchOrganizations());
  };

  useEffect(() => { fetchData(); }, [user, dispatch]);

  const openEdit = (wf) => { setEditWf(wf); setWfForm({ ...wf }); };

  const handleCreate = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setError('');
    try {
      await dispatch(createWorkflow({ ...wfForm, rules: [], formSchema: {} })).unwrap();
      setIsCreateOpen(false); setWfForm(emptyForm(user));
      dispatch(addToast({ type: 'success', message: 'Workflow created successfully.' }));
    } catch (err) { setError(err || 'Failed to create workflow.'); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setError('');
    try {
      await dispatch(updateWorkflow({ id: editWf.id, data: wfForm })).unwrap();
      setEditWf(null);
      dispatch(addToast({ type: 'success', message: 'Workflow updated.' }));
    } catch (err) { setError(err || 'Failed to update workflow.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await dispatch(deleteWorkflow(id)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Workflow deleted.' }));
    } catch (err) { dispatch(addToast({ type: 'error', message: err || 'Failed to delete.' })); }
  };

  const handleDeploy = async (targets) => {
    if (!targets.length) return;
    setIsSubmitting(true); setError('');
    try {
      await dispatch(createDeployment({ targetOrganizationIds: targets, configType: 'WORKFLOW', configId: deployWf.id, configVersion: 1 })).unwrap();
      setDeployWf(null);
      dispatch(addToast({ type: 'success', message: 'Deployment initiated.' }));
    } catch (err) { setError(err || 'Failed to deploy.'); }
    finally { setIsSubmitting(false); }
  };

  const wfList = Array.isArray(workflows) ? workflows : [];

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#A0AECB] uppercase tracking-widest mb-1">Process Management</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            <span className="text-brand-blue">Workflows</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Design and manage clinical protocol sequences.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-[#DDE3F0] bg-white text-[#8A97B0] hover:text-brand-blue hover:border-brand-blue transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setWfForm(emptyForm(user)); setIsCreateOpen(true); }}
            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          >
            <Plus size={15} /> New Workflow
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: wfList.length, color: 'bg-[#EEF2FF] text-brand-blue' },
          { label: 'Active', value: wfList.filter(w => w.active).length, color: 'bg-green-50 text-green-600' },
          { label: 'Draft', value: wfList.filter(w => !w.active).length, color: 'bg-[#F0F4FC] text-[#8A97B0]' },
          { label: 'Avg Steps', value: wfList.length ? Math.round(wfList.reduce((s, w) => s + (w.steps?.length || 0), 0) / wfList.length) : 0, color: 'bg-[#EEF2FF] text-brand-blue' },
        ].map((s, i) => (
          <div key={i} className="card p-5">
            <p className={`text-2xl font-black leading-none mb-1 ${s.color.split(' ')[1]}`}>{s.value}</p>
            <p className="text-xs font-semibold text-[#8A97B0]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Workflows Grid */}
      <div className="card">
        <SectionHeader icon={GitBranch} title="All Workflows" />

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[#F0F4FC] p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#F0F4FC] rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#F0F4FC] rounded w-32" />
                    <div className="h-2.5 bg-[#F0F4FC] rounded w-20" />
                  </div>
                </div>
                <div className="h-2.5 bg-[#F0F4FC] rounded w-full" />
                <div className="flex gap-2">
                  {[...Array(4)].map((_, j) => <div key={j} className="w-7 h-7 bg-[#F0F4FC] rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : wfList.length === 0 ? (
          <div className="py-16 text-center">
            <GitBranch size={32} className="text-[#DDE3F0] mx-auto mb-3" />
            <p className="text-sm text-[#A0AECB] font-medium">No workflows yet</p>
            <p className="text-xs text-[#C0CADF] mt-1">Create your first workflow to get started</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 p-5">
            {wfList.map(wf => (
              <WorkflowCard
                key={wf.id}
                wf={wf}
                onEdit={openEdit}
                onDelete={handleDelete}
                onDeploy={setDeployWf}
                isAdmin={user?.role === 'ADMIN'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <WfModal
          mode="create"
          form={wfForm}
          setForm={setWfForm}
          onSubmit={handleCreate}
          onClose={() => setIsCreateOpen(false)}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}

      {/* Edit Modal */}
      {editWf && (
        <WfModal
          mode="edit"
          form={wfForm}
          setForm={setWfForm}
          onSubmit={handleEdit}
          onClose={() => setEditWf(null)}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}

      {/* Deploy Modal */}
      {deployWf && (
        <DeployModal
          workflow={deployWf}
          orgs={orgs}
          onClose={() => setDeployWf(null)}
          onDeploy={handleDeploy}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </div>
  );
};

export default Workflows;