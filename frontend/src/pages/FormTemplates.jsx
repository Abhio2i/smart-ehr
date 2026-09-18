import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Plus, Search, Trash2, RefreshCw, X, Edit2, Code, FileText, Download,
  Upload, AlertCircle, ChevronRight, Eye, Save, Settings, Layers,
  GripVertical, Type, Hash, AlignLeft, Calendar, List, CheckSquare,
  MessageSquare, Info, Activity, Fingerprint, Zap, Layout, Globe
} from 'lucide-react';
import { fetchFormTemplates, createFormTemplate, updateFormTemplate, fetchFormSubmissions } from '../store/slices/formTemplateSlice';
import { fetchOrganizations } from '../store/slices/orgSlice';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import DynamicFormRenderer from '../components/forms/DynamicFormRenderer';

const TEMPLATE_TYPES = ['EPCR', 'QA_FORM', 'FEEDBACK', 'CUSTOM'];
const FIELD_TYPES = [
  { value: 'text', label: 'Short Text', icon: <Type size={14} /> },
  { value: 'number', label: 'Number', icon: <Hash size={14} /> },
  { value: 'textarea', label: 'Long Text', icon: <AlignLeft size={14} /> },
  { value: 'date', label: 'Date Picker', icon: <Calendar size={14} /> },
  { value: 'select', label: 'Dropdown', icon: <List size={14} /> },
  { value: 'boolean', label: 'Yes/No Toggle', icon: <CheckSquare size={14} /> },
];

const FormTemplates = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { templates, submissions, loading } = useSelector(state => state.formTemplate);
  const { organizations } = useSelector(state => state.org);

  const [tab, setTab] = useState('templates');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedType, setSelectedType] = useState('EPCR');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState('create');
  const [editorTab, setEditorTab] = useState('visual');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  const [editorData, setEditorData] = useState({
    id: null, name: '', templateType: 'EPCR', version: 1, published: false, active: true, fields: [], schema: '{}', layout: '{}',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const orgId = selectedOrgId || user?.organizationId;

  useEffect(() => { dispatch(fetchOrganizations()); }, [dispatch]);

  useEffect(() => {
    if (orgId) {
      if (tab === 'templates') dispatch(fetchFormTemplates({ orgId, templateType: selectedType }));
      else dispatch(fetchFormSubmissions(orgId));
    }
  }, [orgId, tab, selectedType, dispatch]);

  useEffect(() => {
    if (editorTab === 'visual') {
      const newSchema = { fields: editorData.fields };
      setEditorData(prev => ({ ...prev, schema: JSON.stringify(newSchema, null, 2) }));
    }
  }, [editorData.fields, editorTab]);

  useEffect(() => {
    if (isEditorOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'auto';
    };
  }, [isEditorOpen]);

  const handleOpenEditor = (mode, template = null) => {
    setEditorMode(mode);
    setLeftPanelOpen(true);
    if (mode === 'edit' && template) {
      setEditorData({
        id: template.id, name: template.name || '', templateType: template.templateType || 'EPCR',
        version: template.version || 1, published: template.published || false, active: template.active || true,
        fields: template.schema?.fields || [], schema: JSON.stringify(template.schema || {}, null, 2),
        layout: JSON.stringify(template.layout || {}, null, 2),
      });
    } else {
      setEditorData({
        id: null, name: '', templateType: 'EPCR', version: 1, published: false, active: true,
        fields: [{ key: 'patientId', label: 'Patient ID', type: 'text', required: true }],
        schema: '{}', layout: '{}',
      });
    }
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async () => {
    setIsSubmitting(true);
    try {
      let finalSchema;
      try { finalSchema = JSON.parse(editorData.schema); } catch { throw new Error('Invalid JSON schema'); }

      const payload = {
        name: editorData.name, templateType: editorData.templateType, organizationId: orgId,
        schema: finalSchema, layout: {}, published: editorData.published, active: editorData.active
      };

      if (editorMode === 'create') {
        await dispatch(createFormTemplate(payload)).unwrap();
        dispatch(addToast({ type: 'success', message: 'Template saved successfully.' }));
      } else {
        await dispatch(updateFormTemplate({ id: editorData.id, data: payload })).unwrap();
        dispatch(addToast({ type: 'success', message: 'Template updated.' }));
      }
      setIsEditorOpen(false);
    } catch (err) { dispatch(addToast({ type: 'error', message: err.message || 'Failed to save.' })); }
    finally { setIsSubmitting(false); }
  };

  const addField = () => setEditorData(p => ({ ...p, fields: [...p.fields, { key: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false }] }));
  const updateField = (index, updates) => {
    const newFields = [...editorData.fields];
    newFields[index] = { ...newFields[index], ...updates };
    setEditorData(p => ({ ...p, fields: newFields }));
  };
  const removeField = index => setEditorData(p => ({ ...p, fields: p.fields.filter((_, i) => i !== index) }));

  const filtered = templates.filter(t => t.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Configuration</p>
          <h1 className="text-xl sm:text-2xl font-black text-[#0F1A3A] tracking-tight">Form <span className="text-brand-blue">Templates</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Design and manage data collection structures</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)} className="input py-2.5 text-sm flex-1 sm:flex-none sm:w-48">
            <option value="">Default Organization</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => dispatch(fetchFormTemplates({ orgId, templateType: selectedType }))} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => handleOpenEditor('create')} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> <span className="hidden sm:inline">New Template</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#F0F4FC] rounded-xl w-fit">
        {['templates', 'submissions'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 sm:px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${tab === t ? 'bg-white text-brand-blue shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>
            {t === 'templates' ? 'Templates' : 'Submissions'}
          </button>
        ))}
      </div>

      {tab === 'templates' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-48 bg-[#F0F4FC] rounded-2xl animate-pulse" />)
          ) : filtered.length === 0 ? (
            <div className="col-span-full card p-10 sm:p-16 text-center">
              <Layout size={40} className="text-[#DDE3F0] mx-auto mb-4" />
              <h3 className="font-black text-[#0F1A3A] text-lg mb-1">No Templates</h3>
              <p className="text-sm text-[#A0AECB]">Create a new template to get started.</p>
            </div>
          ) : filtered.map(template => (
            <div key={template.id} className="card p-5 group hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <div className="w-11 h-11 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all">
                  <Layout size={20} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={template.published ? 'badge badge-green' : 'badge badge-orange'}>
                    {template.published ? 'Published' : 'Draft'}
                  </span>
                  <span className="text-xs text-[#A0AECB] font-semibold">v{template.version}.0</span>
                </div>
              </div>
              <h3 className="text-lg font-black text-[#0F1A3A] mb-1 leading-tight line-clamp-1" title={template.name}>{template.name}</h3>
              <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mb-6 flex items-center gap-1">
                <Activity size={12} /> {template.templateType}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-[#F0F4FC]">
                <div className="flex -space-x-1">
                  {[1, 2, 3].map(i => <div key={i} className="w-5 h-5 rounded-full bg-[#F8FAFF] border border-[#DDE3F0]" />)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenEditor('edit', template)} className="p-2 bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white rounded-lg transition-all border border-[#DDE3F0] hover:border-transparent">
                    <Edit2 size={14} />
                  </button>
                  <button className="p-2 bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-red hover:text-white rounded-lg transition-all border border-[#DDE3F0] hover:border-transparent">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-10 sm:p-16 text-center">
          <Layers size={40} className="text-[#DDE3F0] mx-auto mb-4" />
          <p className="text-sm font-semibold text-[#A0AECB]">No submissions found.</p>
        </div>
      )}

      {/* Editor Modal - FIXED + RESPONSIVE */}
      {/* Editor Modal - FIXED */}
{isEditorOpen && createPortal(
        <div
          className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[200] flex items-stretch justify-end animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditorOpen(false); }}
        >
          {/* Panel: full screen on mobile, right-side panel on desktop */}
          <div
            className="bg-[#F8FAFF] shadow-2xl border-l border-[#DDE3F0] flex flex-col overflow-hidden w-full sm:w-[calc(100vw-260px)]"
          >
            {/* Editor Header */}
            <div className="p-3 border-b border-[#F0F4FC] bg-white flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center text-brand-blue shrink-0">
                  <Settings size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[#0F1A3A]">Template Editor</h2>
                  <input
                    value={editorData.name}
                    onChange={e => setEditorData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Enter template name..."
                    className="bg-transparent border-none text-sm text-[#4B5A7A] font-bold outline-none placeholder-[#A0AECB] w-full mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                {/* Tab switcher - hidden on very small, shown as icons on mobile */}
                <div className="hidden xs:flex sm:flex bg-[#F0F4FC] rounded-xl p-1">
                  {['visual', 'code', 'preview'].map(t => (
                    <button key={t} onClick={() => setEditorTab(t)}
                      className={`px-2 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${editorTab === t ? 'bg-white text-brand-blue shadow-sm' : 'text-[#8A97B0] hover:text-[#4B5A7A]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <button onClick={handleSaveTemplate} disabled={isSubmitting} className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2">
                  {isSubmitting ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                  <span className="hidden sm:inline">{isSubmitting ? 'Saving...' : 'Save Template'}</span>
                  <span className="sm:hidden">{isSubmitting ? '...' : 'Save'}</span>
                </button>
                <button onClick={() => setIsEditorOpen(false)} className="p-2 text-[#8A97B0] hover:bg-[#F0F4FC] rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Mobile tab bar (shown only on small screens) */}
            <div className="flex sm:hidden gap-1 p-2 bg-white border-b border-[#F0F4FC]">
              {['visual', 'code', 'preview'].map(t => (
                <button key={t} onClick={() => setEditorTab(t)}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${editorTab === t ? 'bg-[#EEF2FF] text-brand-blue' : 'text-[#8A97B0]'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* LEFT RAIL - hidden on mobile, toggle button shown */}
              {editorTab === 'visual' && (
                <>
                  {/* Toggle button for mobile */}
                  <button
                    onClick={() => setLeftPanelOpen(p => !p)}
                    className="sm:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-brand-blue text-white rounded-r-lg p-1.5 shadow-lg"
                    style={{ marginTop: '60px' }}
                  >
                    {leftPanelOpen ? <ChevronRight size={16} /> : <Plus size={16} />}
                  </button>

                  {/* Left panel */}
                  <div className={`${leftPanelOpen ? 'w-44 sm:w-56' : 'w-0'} shrink-0 border-r border-[#F0F4FC] bg-white overflow-y-auto flex flex-col transition-all duration-300`}>
                    <div className="p-3 sm:p-4">
                      <h4 className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-3 sm:mb-4">Elements</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {FIELD_TYPES.map(f => (
                          <button key={f.value} onClick={() => { addField(); setLeftPanelOpen(false); }}
                            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-[#F8FAFF] hover:bg-[#EEF2FF] border border-[#DDE3F0] rounded-xl transition-all text-left">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white border border-[#DDE3F0] flex items-center justify-center text-brand-blue shrink-0">
                              {f.icon}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-[#4B5A7A] flex-1 leading-tight">{f.label}</span>
                            <Plus size={12} className="text-[#A0AECB] shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* MAIN CANVAS */}
              <div className="flex-1 bg-[#F8FAFF] overflow-y-auto p-3 sm:p-4 min-w-0">
                {editorTab === 'visual' && (
                  <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
                    {editorData.fields.map((field, idx) => (
                      <div key={field.key} className="bg-white rounded-2xl p-4 sm:p-6 border border-[#DDE3F0] shadow-sm hover:shadow-md hover:border-brand-blue/30 transition-all group">
                        <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <GripVertical className="text-[#DDE3F0] cursor-grab shrink-0" size={18} />
                            <input
                              value={field.label}
                              onChange={e => updateField(idx, { label: e.target.value })}
                              className="bg-transparent border-none text-base sm:text-lg font-black text-[#0F1A3A] outline-none w-full placeholder-[#DDE3F0]"
                              placeholder="Field Label"
                            />
                          </div>
                          <button
                            onClick={() => removeField(idx)}
                            className="p-2 text-[#A0AECB] hover:text-brand-red hover:bg-red-50 rounded-lg transition-all shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {/* Responsive grid: 1 col on mobile, 2 on sm+ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pl-6 sm:pl-9">
                          <div className="space-y-1.5 sm:space-y-2">
                            <label className="text-xs font-bold text-[#8A97B0] uppercase tracking-wider">Field Key</label>
                            <input
                              value={field.key}
                              onChange={e => updateField(idx, { key: e.target.value })}
                              className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl px-3 py-2 text-sm font-mono text-[#4B5A7A] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all"
                              placeholder="field_key"
                            />
                          </div>
                          <div className="space-y-1.5 sm:space-y-2">
                            <label className="text-xs font-bold text-[#8A97B0] uppercase tracking-wider">Field Type</label>
                            <select
                              value={field.type}
                              onChange={e => updateField(idx, { type: e.target.value })}
                              className="w-full bg-white border border-[#DDE3F0] rounded-xl px-3 py-2 text-sm text-[#0F1A3A] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none cursor-pointer appearance-none transition-all"
                              style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238A97B0%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e")', backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', paddingRight: '32px' }}
                            >
                              {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                            </select>
                          </div>
                          <div className="col-span-1 sm:col-span-2 space-y-1.5 sm:space-y-2">
                            <label className="text-xs font-bold text-[#8A97B0] uppercase tracking-wider">Placeholder</label>
                            <input
                              value={field.placeholder || ''}
                              onChange={e => updateField(idx, { placeholder: e.target.value })}
                              className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl px-3 py-2 text-sm text-[#4B5A7A] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 outline-none transition-all placeholder-[#A0AECB]"
                              placeholder="e.g. Enter value..."
                            />
                          </div>
                          <div className="col-span-1 sm:col-span-2 flex items-center gap-3 pt-1 cursor-pointer w-fit"
                            onClick={() => updateField(idx, { required: !field.required })}>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${field.required ? 'bg-brand-blue border-brand-blue text-white' : 'border-[#DDE3F0] bg-[#F8FAFF]'}`}>
                              {field.required && <CheckSquare size={12} />}
                            </div>
                            <span className="text-sm font-semibold text-[#4B5A7A]">Required Field</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {editorData.fields.length === 0 && (
                      <div className="py-16 sm:py-20 text-center border-2 border-dashed border-[#DDE3F0] bg-white rounded-3xl">
                        <Zap className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-[#DDE3F0]" />
                        <p className="text-sm font-semibold text-[#A0AECB] px-4">Form is empty. Add elements from the left panel.</p>
                      </div>
                    )}
                  </div>
                )}

                {editorTab === 'code' && (
                  <div className="h-full min-h-[400px]">
                    <textarea
                      value={editorData.schema}
                      onChange={e => setEditorData(p => ({ ...p, schema: e.target.value }))}
                      className="w-full h-full min-h-[400px] bg-[#0F1A3A] border-none rounded-2xl p-4 sm:p-6 font-mono text-xs sm:text-sm text-green-400 outline-none resize-none shadow-inner"
                      placeholder='{ "fields": [] }'
                    />
                  </div>
                )}

                {editorTab === 'preview' && (
                  <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-10 border border-[#DDE3F0] shadow-sm">
                    <h3 className="text-xl sm:text-2xl font-black text-[#0F1A3A] mb-6 sm:mb-8">{editorData.name || 'Untitled Form'}</h3>
                    <DynamicFormRenderer schema={{ fields: editorData.fields }} onSubmit={() => { }} onCancel={() => { }} />
                  </div>
                )}
              </div>

              {/* RIGHT RAIL - hidden on mobile, shown on sm+ */}
              <div className="hidden sm:flex w-64 shrink-0 border-l border-[#F0F4FC] p-4 bg-white overflow-y-auto flex-col space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Properties</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Active', key: 'active', icon: <Activity size={14} /> },
                      { label: 'Published', key: 'published', icon: <Globe size={14} /> }
                    ].map(opt => (
                      <div key={opt.key}
                        className="flex items-center justify-between p-4 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] hover:border-brand-blue/30 transition-colors cursor-pointer"
                        onClick={() => setEditorData(p => ({ ...p, [opt.key]: !p[opt.key] }))}>
                        <div className="flex items-center gap-3 text-[#4B5A7A]">
                          {opt.icon}
                          <span className="text-sm font-bold">{opt.label}</span>
                        </div>
                        <div className={`w-11 h-6 rounded-full relative transition-all ${editorData[opt.key] ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${editorData[opt.key] ? 'left-5' : 'left-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Form Type</h4>
                  <select
                    value={editorData.templateType}
                    onChange={e => setEditorData(p => ({ ...p, templateType: e.target.value }))}
                    className="w-full bg-white border border-[#DDE3F0] rounded-xl px-4 py-2.5 text-sm text-[#0F1A3A] focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all cursor-pointer appearance-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238A97B0%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e")', backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat', paddingRight: '36px' }}
                  >
                    {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Mobile bottom bar for properties - shown only on small screens */}
                <div className="text-xs text-[#A0AECB] p-3 bg-[#F0F4FC] rounded-lg border border-[#DDE3F0] mt-auto">
                  <p className="font-semibold text-[#8A97B0] mb-1">💡 Tip:</p>
                  <p>Define fields to structure your form. Each field will appear in the generated form.</p>
                </div>
              </div>
            </div>

            {/* Mobile bottom bar for Properties (shown only on small screens) */}
            <div className="sm:hidden border-t border-[#F0F4FC] bg-white p-3 flex items-center gap-3 shrink-0">
              <select
                value={editorData.templateType}
                onChange={e => setEditorData(p => ({ ...p, templateType: e.target.value }))}
                className="flex-1 bg-white border border-[#DDE3F0] rounded-xl px-3 py-2 text-sm text-[#0F1A3A] focus:border-brand-blue focus:outline-none outline-none cursor-pointer"
              >
                {TEMPLATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {[
                { label: 'Active', key: 'active' },
                { label: 'Published', key: 'published' }
              ].map(opt => (
                <div key={opt.key}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setEditorData(p => ({ ...p, [opt.key]: !p[opt.key] }))}>
                  <div className={`w-9 h-5 rounded-full relative transition-all ${editorData[opt.key] ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${editorData[opt.key] ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-xs font-bold text-[#4B5A7A]">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
 , document.body)}
    </div>
  );
};

export default FormTemplates;