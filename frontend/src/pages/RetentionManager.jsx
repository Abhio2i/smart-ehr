import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import {
  Archive, ShieldCheck, FolderPlus, FileText, Calendar, Clock,
  Lock, Unlock, Plus, RefreshCw, AlertTriangle, CheckCircle, Trash2,
  Folder, ArrowRight, Loader2, Info
} from 'lucide-react';

export default function RetentionManager() {
  const dispatch = useDispatch();
  const role = useSelector(st => st.auth.user?.role);
  const canModify = role === 'ADMIN';

  const [tab, setTab] = useState('folders');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // States
  const [rules, setRules] = useState([]);
  const [folders, setFolders] = useState([]);
  const [dispositions, setDispositions] = useState([]);

  // Modals
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);

  // Forms
  const [ruleForm, setRuleForm] = useState({
    policyName: '',
    retentionPeriodYears: 3,
    actionAfterPeriod: 'REVIEW',
    description: ''
  });

  const [folderForm, setFolderForm] = useState({
    folderName: '',
    parentFolderId: '',
    retentionRuleId: ''
  });

  const [holdForm, setHoldForm] = useState({
    recordType: 'TB_CASE',
    recordId: '',
    hold: true,
    reason: ''
  });

  const [reviewNotes, setReviewNotes] = useState({});

  // ── Fetch Functions ────────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    try {
      const res = await api.get('/api/retention/rules');
      setRules(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load retention policies.' }));
    }
  }, [dispatch]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.get('/api/retention/folders');
      setFolders(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load archive folders.' }));
    }
  }, [dispatch]);

  const fetchDispositions = useCallback(async () => {
    try {
      const res = await api.get('/api/retention/dispositions');
      setDispositions(res.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load disposition queue.' }));
    }
  }, [dispatch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchFolders(), fetchDispositions()]);
    setLoading(false);
  }, [fetchRules, fetchFolders, fetchDispositions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.policyName) return;
    setSubmitting(true);
    try {
      await api.post('/api/retention/rules', ruleForm);
      dispatch(addToast({ type: 'success', message: 'Retention policy created successfully.' }));
      setRuleModalOpen(false);
      setRuleForm({ policyName: '', retentionPeriodYears: 3, actionAfterPeriod: 'REVIEW', description: '' });
      fetchRules();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to create retention rule.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderForm.folderName) return;
    setSubmitting(true);
    try {
      await api.post('/api/retention/folders', folderForm);
      dispatch(addToast({ type: 'success', message: 'Archive folder created.' }));
      setFolderModalOpen(false);
      setFolderForm({ folderName: '', parentFolderId: '', retentionRuleId: '' });
      fetchFolders();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to create folder.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetHold = async (e) => {
    e.preventDefault();
    if (!holdForm.recordId) return;
    setSubmitting(true);
    try {
      await api.put(`/api/retention/records/${holdForm.recordType}/${holdForm.recordId}/hold`, {
        hold: holdForm.hold,
        reason: holdForm.reason
      });
      dispatch(addToast({
        type: 'success',
        message: holdForm.hold ? 'Record locked under Legal/Audit Hold.' : 'Record hold lock released.'
      }));
      setHoldModalOpen(false);
      setHoldForm({ recordType: 'TB_CASE', recordId: '', hold: true, reason: '' });
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to process hold toggle.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispositionAction = async (id, status) => {
    const notes = reviewNotes[id] || '';
    try {
      await api.post(`/api/retention/dispositions/${id}/action`, { status, notes });
      dispatch(addToast({ type: 'success', message: `Disposition workflow action registered: ${status}` }));
      fetchDispositions();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to authorize disposition action.' }));
    }
  };

  // Helper date formatter
  const fmtDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-main)]">
      
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A3C8F] to-[#132A6B] flex items-center justify-center shadow-md">
              <Archive size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#0F1A3A]">Data Retention & Archiving</h1>
              <p className="text-xs text-[#8A97B0] font-medium mt-0.5">Compliant record lifecycle tracking, folder policy inheritance, and holds.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={loading}
              className="btn-ghost px-3 py-2 text-xs rounded-xl border border-[#DDE3F0]">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {canModify && (
              <div className="flex gap-2">
                <label className="btn-outline text-xs px-3 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 border border-[#DDE3F0] hover:bg-slate-100">
                  <FileText size={14} className="text-blue-600" />
                  <span>Bulk Import (CSV/XML)</span>
                  <input
                    type="file"
                    accept=".csv,.xml"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        dispatch(addToast({ type: 'info', message: 'Processing bulk metadata import...' }));
                        const res = await api.post('/api/retention/rules/bulk-import', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        const data = res.data;
                        dispatch(addToast({
                          type: 'success',
                          message: `Bulk Import Complete: ${data.successCount} imported, ${data.failureCount} failed.`
                        }));
                        fetchRules();
                      } catch (err) {
                        console.error('Bulk import failed:', err);
                        dispatch(addToast({ type: 'error', message: 'Bulk metadata import failed.' }));
                      } finally {
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <button onClick={() => setFolderModalOpen(true)}
                  className="btn-outline text-xs px-3 py-2 rounded-xl">
                  <FolderPlus size={14} /> New Folder
                </button>
                <button onClick={() => setRuleModalOpen(true)}
                  className="btn-primary text-xs px-4 py-2 rounded-xl">
                  <Plus size={14} /> Create Policy
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="shrink-0 px-6 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
            <p className="text-xs opacity-75 font-semibold">Configured Rules</p>
            <p className="text-2xl font-black mt-1">{rules.length}</p>
            <p className="text-[10px] opacity-60 mt-1">TB and general records policies</p>
          </div>
          <div className="card p-4 bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <p className="text-xs opacity-75 font-semibold">Active Folders</p>
            <p className="text-2xl font-black mt-1">{folders.length}</p>
            <p className="text-[10px] opacity-60 mt-1">Hierarchical directories explorer</p>
          </div>
          <div className="card p-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <p className="text-xs opacity-75 font-semibold">Pending Review</p>
            <p className="text-2xl font-black mt-1">{dispositions.length}</p>
            <p className="text-[10px] opacity-60 mt-1">Expired items awaiting manager</p>
          </div>
          <div className="card p-4 bg-gradient-to-br from-rose-500 to-rose-700 text-white cursor-pointer"
            onClick={() => setHoldModalOpen(true)}>
            <p className="text-xs opacity-75 font-semibold">Legal holds manager</p>
            <p className="text-xs font-bold mt-2 flex items-center gap-1.5 bg-white/20 px-2.5 py-1 rounded-lg w-fit">
              <Lock size={12} /> Lock Record
            </p>
            <p className="text-[10px] opacity-60 mt-1">Freeze files from automatic expiry</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 mb-3">
        <div className="flex items-center gap-1 bg-[#F0F4FC] p-1 rounded-xl w-fit">
          {[
            { key: 'folders', label: 'Archive Explorer', icon: Folder },
            { key: 'policies', label: 'Retention Policies', icon: ShieldCheck },
            { key: 'dispositions', label: `Dispositions Queue (${dispositions.length})`, icon: Clock },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                tab === key ? 'bg-white text-[#0F1A3A] shadow-sm' : 'text-[#5A6A8A] hover:text-[#0F1A3A]'
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        
        {/* ── FOLDER EXPLORER TAB ────────────────────────────────────────────── */}
        {tab === 'folders' && (
          <div className="card p-5">
            <h3 className="text-sm font-black text-[#0F1A3A] mb-4">Hierarchical Folder Navigator</h3>
            
            {folders.length === 0 ? (
              <div className="text-center py-12 text-[#8A97B0]">
                <Folder size={36} className="mx-auto text-slate-300 mb-3" />
                <p className="text-xs font-bold">No folders created yet</p>
                <p className="text-[11px] mt-0.5">Use "New Folder" button at the top to group records.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {folders.map(f => {
                  const policy = rules.find(r => r.id === f.retentionRuleId);
                  return (
                    <div key={f.id} className="border border-[#DDE3F0] rounded-xl p-4 flex items-start gap-3 bg-[#F8FAFF] hover:shadow-sm transition-shadow">
                      <Folder className="text-[#1A3C8F] shrink-0" size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-[#0F1A3A] truncate">{f.folderName}</p>
                        <p className="text-[10px] text-[#8A97B0] font-medium mt-1">
                          Rule: <span className="font-bold text-[#1A3C8F]">{policy ? policy.policyName : 'None (Inherited)'}</span>
                        </p>
                        <div className="flex justify-between items-center mt-3 text-[9px] text-[#8A97B0] font-mono border-t border-[#DDE3F0] pt-2">
                          <span>Created: {new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── POLICIES TAB ───────────────────────────────────────────────────── */}
        {tab === 'policies' && (
          <div className="card p-5 overflow-x-auto">
            <h3 className="text-sm font-black text-[#0F1A3A] mb-4">Standard Retention Policies</h3>
            
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DDE3F0] text-[#8A97B0]">
                  <th className="pb-2 font-bold">Policy Name</th>
                  <th className="pb-2 font-bold">Retention Period</th>
                  <th className="pb-2 font-bold">Action Expiry</th>
                  <th className="pb-2 font-bold">Description</th>
                  <th className="pb-2 font-bold">Created By</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-b border-[#F0F4FC] hover:bg-[#F8FAFF]">
                    <td className="py-3 font-bold text-[#0F1A3A]">{r.policyName}</td>
                    <td className="py-3 font-semibold text-[#5A6A8A]">{r.retentionPeriodYears} Years</td>
                    <td className="py-3">
                      <span className="bg-[#E3F2FD] text-[#0D47A1] px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {r.actionAfterPeriod}
                      </span>
                    </td>
                    <td className="py-3 text-[#8A97B0] max-w-xs truncate">{r.description || '—'}</td>
                    <td className="py-3 text-[#8A97B0] font-mono text-[10px]">{r.createdBy}</td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#8A97B0]">No policies defined.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── DISPOSITIONS TAB ───────────────────────────────────────────────── */}
        {tab === 'dispositions' && (
          <div className="card p-5">
            <h3 className="text-sm font-black text-[#0F1A3A] mb-4">Disposition Queue (Manager Review Required)</h3>
            
            {dispositions.length === 0 ? (
              <div className="text-center py-12 text-[#8A97B0]">
                <ShieldCheck size={36} className="mx-auto text-emerald-300 mb-3" />
                <p className="text-xs font-bold text-emerald-700">All records fully compliant</p>
                <p className="text-[11px] mt-0.5">No expired records currently awaiting disposition approvals.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dispositions.map(d => (
                  <div key={d.id} className="border border-[#DDE3F0] rounded-xl p-4 bg-[#FFF8F8] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2] text-[10px] font-bold px-2 py-0.5 rounded">
                          {d.recordType}
                        </span>
                        <h4 className="text-xs font-bold text-[#0F1A3A]">{d.recordName}</h4>
                      </div>
                      <p className="text-[10px] text-[#8A97B0]">
                        Retention Expiry Date: <span className="font-mono font-bold text-[#C62828]">{fmtDate(d.expiryDate)}</span>
                      </p>
                      <input
                        className="input text-[11px] py-1 mt-2 w-full max-w-sm placeholder-[#A0AECB]"
                        placeholder="Log review notes / comments..."
                        value={reviewNotes[d.id] || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setReviewNotes(prev => ({ ...prev, [d.id]: val }));
                        }}
                      />
                    </div>

                    {canModify && (
                      <div className="flex gap-2 shrink-0 self-end md:self-auto">
                        <button
                          onClick={() => handleDispositionAction(d.id, 'APPROVED_DISPOSAL')}
                          className="btn-danger text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1"
                          title="Permanently Delete"
                        >
                          <Trash2 size={12} /> Dispose
                        </button>
                        <button
                          onClick={() => handleDispositionAction(d.id, 'APPROVED_ARCHIVE')}
                          className="btn-outline text-[10px] px-3 py-1.5 rounded-lg border-blue-300 text-blue-700 flex items-center gap-1"
                          title="Archive Cold Storage"
                        >
                          <Archive size={12} /> Archive
                        </button>
                        <button
                          onClick={() => handleDispositionAction(d.id, 'EXTENDED')}
                          className="btn-ghost text-[10px] px-3 py-1.5 rounded-lg border border-[#DDE3F0] flex items-center gap-1"
                          title="Extend 5 Years"
                        >
                          Extend (+5Y)
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* New Policy Modal */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-[#0F1A3A]">Define Retention Policy</h3>
            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Policy Name</label>
                <input className="input text-sm" placeholder="e.g. TB Case Records 3Y" required
                  value={ruleForm.policyName} onChange={e => setRuleForm(f => ({ ...f, policyName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Period (Years)</label>
                  <input type="number" className="input text-sm" min={1} max={100} required
                    value={ruleForm.retentionPeriodYears} onChange={e => setRuleForm(f => ({ ...f, retentionPeriodYears: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Action Expiry</label>
                  <select className="select-input text-sm"
                    value={ruleForm.actionAfterPeriod} onChange={e => setRuleForm(f => ({ ...f, actionAfterPeriod: e.target.value }))}>
                    <option value="REVIEW">Manager Audit Review</option>
                    <option value="DELETE">Auto Permanent Delete</option>
                    <option value="ARCHIVE">Auto Archive Cold Storage</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Description</label>
                <textarea className="input text-sm" rows={2} placeholder="Explain policy criteria..."
                  value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setRuleModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Save Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {folderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-[#0F1A3A]">Create Archive Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Folder Name</label>
                <input className="input text-sm" placeholder="e.g. Outbreak Cluster 2026" required
                  value={folderForm.folderName} onChange={e => setFolderForm(f => ({ ...f, folderName: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Parent Folder (Hierarchy)</label>
                <select className="select-input text-sm"
                  value={folderForm.parentFolderId} onChange={e => setFolderForm(f => ({ ...f, parentFolderId: e.target.value }))}>
                  <option value="">Root (No Parent)</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.folderName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Policy Rule (Optional)</label>
                <select className="select-input text-sm"
                  value={folderForm.retentionRuleId} onChange={e => setFolderForm(f => ({ ...f, retentionRuleId: e.target.value }))}>
                  <option value="">Inherit Parent Policy</option>
                  {rules.map(r => <option key={r.id} value={r.id}>{r.policyName} ({r.retentionPeriodYears}Y)</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setFolderModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legal Hold Modal */}
      {holdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-[#0F1A3A] flex items-center gap-2">
              <Lock size={18} className="text-rose-600" /> Legal Hold Lock Manager
            </h3>
            <p className="text-xs text-[#8A97B0]">
              Freeze record expiries. A locked record is protected from any automated retention archiving/deletion.
            </p>
            <form onSubmit={handleSetHold} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Record Type</label>
                  <select className="select-input text-sm"
                    value={holdForm.recordType} onChange={e => setHoldForm(f => ({ ...f, recordType: e.target.value }))}>
                    <option value="TB_CASE">Tuberculosis Case</option>
                    <option value="EPCR">Emergency ePCR</option>
                    <option value="PATIENT">Patient Account</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Action</label>
                  <select className="select-input text-sm"
                    value={holdForm.hold ? 'lock' : 'unlock'}
                    onChange={e => setHoldForm(f => ({ ...f, hold: e.target.value === 'lock' }))}>
                    <option value="lock">Lock (Apply Hold)</option>
                    <option value="unlock">Unlock (Release Hold)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Record ID (Database Reference)</label>
                <input className="input text-sm font-mono" placeholder="Record ID (e.g. 6a5dafa...)" required
                  value={holdForm.recordId} onChange={e => setHoldForm(f => ({ ...f, recordId: e.target.value }))} />
              </div>
              {holdForm.hold && (
                <div>
                  <label className="text-[10px] font-bold text-[#8A97B0] uppercase block mb-1">Hold Lock Reason</label>
                  <input className="input text-sm" placeholder="e.g. Active Municipal Audit 2026" required
                    value={holdForm.reason} onChange={e => setHoldForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setHoldModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1 bg-rose-600 hover:bg-rose-700">
                  {submitting ? 'Processing...' : 'Apply Hold Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
