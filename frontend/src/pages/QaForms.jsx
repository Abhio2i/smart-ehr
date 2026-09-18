import { useState, useEffect } from 'react';
import { ClipboardList, Plus, RefreshCw, X, Trash2, Eye, Check } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import client from '../api/client';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchQaForms, createQaForm, selectForms, selectFormsLoading } from '../store/slices/qaSlice';
import { safeUUID } from '../utils/uuid';

const QUESTION_TYPES = ['YES_NO', 'TEXT', 'NUMERIC', 'MULTIPLE_CHOICE', 'RATING'];
const emptyForm = () => ({
  name: '', description: '', organizationId: '', reviewCategory: '', callTypes: '', active: true,
  questions: [{ id: safeUUID(), question: '', type: 'YES_NO', required: true, options: [] }],
  auditCriteria: []
});

const QaForms = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const forms   = useSelector(selectForms);
  const loading = useSelector(selectFormsLoading);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen]     = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData]         = useState(emptyForm());

  useEffect(() => { dispatch(fetchQaForms(user?.organizationId)); }, [user, dispatch]);

  const addQuestion = () => setFormData(p => ({ ...p, questions: [...p.questions, { id: safeUUID(), question: '', type: 'YES_NO', required: true, options: [] }] }));
  const updateQuestion = (idx, field, val) => setFormData(p => { const qs = [...p.questions]; qs[idx] = { ...qs[idx], [field]: val }; return { ...p, questions: qs }; });
  const removeQuestion = idx => setFormData(p => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));

  const handleCreate = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        organizationId: formData.organizationId || user?.organizationId,
        callTypes: formData.callTypes ? formData.callTypes.split(',').map(s => s.trim()).filter(Boolean) : [],
        questions: formData.questions.map(q => ({ id: q.id, question: q.question, type: q.type, required: q.required, options: q.type === 'MULTIPLE_CHOICE' ? q.options : [] })),
        auditCriteria: []
      };
      await dispatch(createQaForm(payload)).unwrap();
      setIsCreateOpen(false); setFormData(emptyForm());
      dispatch(addToast({ type: 'success', message: 'QA form created' }));
    } catch { dispatch(addToast({ type: 'error', message: 'Failed to create form.' })); }
    finally { setIsSubmitting(false); }
  };

  const viewForm = async id => {
    try { const res = await client.get(`/api/qa/forms/${id}`); setSelectedForm(res.data); setIsViewOpen(true); }
    catch { dispatch(addToast({ type: 'error', message: 'Failed to load form.' })); }
  };

  const inputCls = 'input py-2.5 text-sm';
  const labelCls = 'text-xs font-bold text-[#4B5A7A] uppercase tracking-wider';

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Quality Assurance</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">QA <span className="text-brand-blue">Forms</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Design and manage QA evaluation protocols</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => dispatch(fetchQaForms(user?.organizationId))} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> New Form
          </button>
        </div>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && !(Array.isArray(forms) ? forms : []).length ? (
          [...Array(3)].map((_, i) => <div key={i} className="h-48 bg-[#F0F4FC] rounded-2xl animate-pulse" />)
        ) : (Array.isArray(forms) ? forms : []).length === 0 ? (
          <div className="col-span-full card p-16 text-center">
            <ClipboardList size={40} className="text-[#DDE3F0] mx-auto mb-4" />
            <h3 className="font-black text-[#0F1A3A] text-lg mb-1">No QA Forms</h3>
            <p className="text-sm text-[#A0AECB]">Create your first evaluation form to get started</p>
          </div>
        ) : (Array.isArray(forms) ? forms : []).map(form => (
          <div key={form.id} className="card p-5 group hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all">
                <ClipboardList size={20} />
              </div>
              <div className="flex items-center gap-2">
                <span className={form.active ? 'badge badge-green' : 'badge badge-gray'}>
                  {form.active ? 'Active' : 'Draft'}
                </span>
                <span className="text-xs text-[#A0AECB]">v{form.version || 1}</span>
              </div>
            </div>
            <h3 className="font-black text-[#0F1A3A] text-base mb-1">{form.name}</h3>
            <p className="text-xs text-[#8A97B0] uppercase tracking-wider mb-3">{form.reviewCategory || 'General'}</p>
            {form.description && <p className="text-xs text-[#8A97B0] leading-relaxed mb-4 line-clamp-2">{form.description}</p>}
            <div className="flex items-center justify-between pt-4 border-t border-[#F0F4FC]">
              <div className="flex items-center gap-2">
                <span className="badge badge-blue">{form.questions?.length || 0} questions</span>
                {form.callTypes?.slice(0,2).map(ct => <span key={ct} className="badge badge-gray">{ct}</span>)}
              </div>
              <button onClick={() => viewForm(form.id)}
                className="p-2 rounded-lg bg-[#EEF2FF] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                <Eye size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <ClipboardList size={20} />
                </div>
                <h2 className="font-black text-[#0F1A3A] text-lg">Create QA Form</h2>
              </div>
              <button onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Form Name *</label>
                  <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Cardiac Review Form" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Review Category</label>
                  <input value={formData.reviewCategory} onChange={e => setFormData({ ...formData, reviewCategory: e.target.value })}
                    placeholder="e.g. CARDIAC, TRAUMA" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Description</label>
                <textarea rows={2} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Form purpose and scope…" className="input py-2.5 text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Call Types (comma-separated)</label>
                <input value={formData.callTypes} onChange={e => setFormData({ ...formData, callTypes: e.target.value })}
                  placeholder="e.g. ALS, BLS, CRITICAL_CARE" className={inputCls} />
              </div>

              {/* Questions */}
              <div className="space-y-3 pt-2 border-t border-[#F0F4FC]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Questions ({formData.questions.length})</label>
                  <button type="button" onClick={addQuestion}
                    className="btn-ghost border border-[#DDE3F0] rounded-xl px-3 py-1.5 text-xs">
                    <Plus size={13} /> Add Question
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.questions.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-brand-blue uppercase">Question {idx + 1}</span>
                        {formData.questions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(idx)}
                            className="p-1 rounded-lg text-[#A0AECB] hover:text-brand-red hover:bg-red-50 transition-all">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <input value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)}
                        placeholder="Enter question…" className={inputCls} />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className={labelCls}>Type</label>
                          <select value={q.type} onChange={e => updateQuestion(idx, 'type', e.target.value)} className={inputCls}>
                            {QUESTION_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div className={`w-10 h-5 rounded-full relative transition-all ${q.required ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}
                              onClick={() => updateQuestion(idx, 'required', !q.required)}>
                              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${q.required ? 'left-5' : 'left-0.5'}`} />
                            </div>
                            <span className="text-xs font-semibold text-[#4B5A7A]">Required</span>
                          </label>
                        </div>
                      </div>
                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div className="space-y-1">
                          <label className={labelCls}>Options (comma-separated)</label>
                          <input value={q.options.join(', ')}
                            onChange={e => updateQuestion(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="e.g. Pass, Fail, N/A" className={inputCls} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => setIsCreateOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                  {isSubmitting ? 'Creating…' : 'Create Form'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewOpen && selectedForm && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div>
                <h2 className="font-black text-[#0F1A3A] text-xl">{selectedForm.name}</h2>
                <p className="text-xs text-[#8A97B0] mt-0.5">{selectedForm.reviewCategory || 'General'} · v{selectedForm.version || 1}</p>
              </div>
              <button onClick={() => setIsViewOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label:'Category', value:selectedForm.reviewCategory||'General' },
                  { label:'Version', value:`v${selectedForm.version||1}` },
                  { label:'Questions', value:selectedForm.questions?.length||0 },
                  { label:'Status', value:selectedForm.active?'Active':'Draft' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 bg-[#F8FAFF] rounded-xl text-center">
                    <p className="text-xs text-[#A0AECB] font-semibold uppercase">{label}</p>
                    <p className="font-black text-brand-blue text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {selectedForm.description && (
                <div className="p-4 bg-[#EEF2FF] rounded-xl border-l-4 border-brand-blue">
                  <p className="text-sm text-[#4B5A7A]">{selectedForm.description}</p>
                </div>
              )}
              {selectedForm.callTypes?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedForm.callTypes.map(ct => <span key={ct} className="badge badge-gray">{ct}</span>)}
                </div>
              )}
              {selectedForm.questions?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-black text-[#A0AECB] uppercase tracking-wider">Questions</p>
                  {selectedForm.questions.map((q, i) => (
                    <div key={q.id || i} className="p-4 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-black text-brand-blue">Q{i + 1}</span>
                        <div className="flex gap-2">
                          <span className="badge badge-gray">{q.type}</span>
                          {q.required && <span className="badge badge-red">Required</span>}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[#0F1A3A]">{q.question}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 border-t border-[#F0F4FC] flex justify-end">
              <button onClick={() => setIsViewOpen(false)} className="btn-primary text-sm px-6 py-2.5">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QaForms;
