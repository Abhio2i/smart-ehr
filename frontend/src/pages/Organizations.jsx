import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Building2, Plus, Search, RefreshCw, X, Eye, Trash2, Edit2,
  Check, AlertCircle, MapPin, Globe, Phone, Mail, Shield, Activity, Landmark
} from 'lucide-react';
import client, { extractErrorMessage } from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';
import { fetchOrganizations, createOrganization, updateOrganization, deleteOrganization } from '../store/slices/orgSlice';

const OrgField = ({ label, name, type = 'text', form, setForm, errors = {}, placeholder }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">{label}</label>
    <input
      type={type}
      value={form[name] || ''}
      onChange={e => setForm({ ...form, [name]: e.target.value })}
      placeholder={placeholder || label}
      className={`input py-2.5 text-sm ${errors[name] ? 'border-brand-red focus:border-brand-red' : ''}`}
    />
    {errors[name] && <p className="text-xs text-brand-red font-semibold">{errors[name]}</p>}
  </div>
);

const Organizations = () => {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const user = useSelector(selectUser);
  const { organizations, loading } = useSelector(state => state.org);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen]   = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError]       = useState('');
  const [fieldErrors, setFieldErrors]   = useState({});

  const blankForm = { name:'', code:'', email:'', phone:'', website:'', address:'', city:'', state:'', zipCode:'', country:'USA', active:true };
  const [addForm, setAddForm]   = useState(blankForm);
  const [editForm, setEditForm] = useState(blankForm);

  useEffect(() => { dispatch(fetchOrganizations()); }, [dispatch]);

  const handleApiError = (err) => {
    const data = err?.response?.data;
    const fields = {};
    if (data?.message === 'Validation failed' && data?.data) Object.assign(fields, data.data);
    if (Array.isArray(data?.errors)) data.errors.forEach(e => { if (e.field) fields[e.field] = e.defaultMessage || e.message; });
    setFieldErrors(fields);
    const msg = typeof err === 'string' ? err : extractErrorMessage(err);
    setFormError(Object.keys(fields).length > 0 ? 'Please fix highlighted fields.' : msg);
  };

  const validate = (form) => {
    const e = {};
    if (!form.name?.trim() || form.name.trim().length < 2) e.name = 'Name is required (min 2 chars)';
    if (!form.code?.trim() || form.code.trim().length < 2) e.code = 'Code is required (min 2 chars)';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    return e;
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setFormError(''); setFieldErrors({});
    const errs = validate(addForm);
    if (Object.keys(errs).length) { setFieldErrors(errs); setFormError('Fix errors below.'); return; }
    setIsSubmitting(true);
    try {
      await dispatch(createOrganization(addForm)).unwrap();
      setIsAddOpen(false); setAddForm(blankForm);
      dispatch(addToast({ type:'success', message:'Organization created' }));
    } catch (err) { handleApiError(err); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setFormError(''); setFieldErrors({});
    const errs = validate(editForm);
    if (Object.keys(errs).length) { setFieldErrors(errs); setFormError('Fix errors below.'); return; }
    setIsSubmitting(true);
    try {
      await dispatch(updateOrganization({ id:selectedOrg.id, data:editForm })).unwrap();
      setIsEditOpen(false);
      dispatch(addToast({ type:'success', message:'Organization updated' }));
    } catch (err) { handleApiError(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this organization?')) return;
    try {
      await dispatch(deleteOrganization(id)).unwrap();
      dispatch(addToast({ type:'success', message:'Organization deleted' }));
    } catch (err) { dispatch(addToast({ type:'error', message:extractErrorMessage(err) })); }
  };

  const openEdit = (org) => { setSelectedOrg(org); setEditForm({ ...org }); setFormError(''); setFieldErrors({}); setIsEditOpen(true); };
  const openView = (org) => { setSelectedOrg(org); setIsViewOpen(true); };

  const filtered = organizations.filter(o =>
    o.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Administration</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Organizations</h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage organization registry and settings</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => dispatch(fetchOrganizations())} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {user?.role === 'ADMIN' && (
            <button onClick={() => { setFormError(''); setFieldErrors({}); setIsAddOpen(true); }}
              className="btn-primary text-sm px-4 py-2.5">
              <Plus size={16} /> Add Organization
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total', value:organizations.length, icon:Building2 },
          { label:'Active', value:organizations.filter(o=>o.active).length, icon:Activity },
          { label:'Cities', value:[...new Set(organizations.map(o=>o.city).filter(Boolean))].length, icon:MapPin },
          { label:'Countries', value:[...new Set(organizations.map(o=>o.country).filter(Boolean))].length, icon:Globe },
        ].map(({ label, value, icon:Icon }) => (
          <div key={label} className="stat-card">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-brand-blue flex items-center justify-center mb-3">
              <Icon size={18} />
            </div>
            <p className="text-3xl font-black text-brand-blue">{value}</p>
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
              placeholder="Search organizations…" className="input pl-10 py-2.5 text-sm" />
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold sm:ml-auto">{filtered.length} orgs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Location</th>
                <th>Contact</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !filtered.length ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan="5" className="py-3 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center">
                  <Building2 size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No organizations found</p>
                </td></tr>
              ) : filtered.map(org => (
                <tr key={org.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue font-black text-sm">
                        {org.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F1A3A]">{org.name}</p>
                        <p className="text-xs text-[#A0AECB] font-mono">{org.code}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-sm text-[#4B5A7A]">
                      <MapPin size={13} className="text-[#A0AECB]" />
                      {org.city || '—'}{org.state ? `, ${org.state}` : ''}
                    </div>
                  </td>
                  <td>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-[#8A97B0]"><Mail size={11}/> {org.email || '—'}</div>
                      <div className="flex items-center gap-1.5 text-xs text-[#8A97B0]"><Phone size={11}/> {org.phone || '—'}</div>
                    </div>
                  </td>
                  <td>
                    <span className={org.active ? 'badge badge-green' : 'badge badge-red'}>
                      {org.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openView(org)}
                        className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                        <Eye size={15} />
                      </button>
                      {(user?.role === 'ADMIN' || (user?.role === 'MANAGER' && user?.organizationId === org.id)) && (
                        <button onClick={() => openEdit(org)}
                          className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                          <Edit2 size={15} />
                        </button>
                      )}
                      {user?.role === 'ADMIN' && (
                        <button onClick={() => handleDelete(org.id)}
                          className="p-2 rounded-lg bg-[#FFF0F3] text-brand-red hover:bg-brand-red hover:text-white transition-all">
                          <Trash2 size={15} />
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

      {/* Add / Edit Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-[#DDE3F0] my-4">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">{isAddOpen ? 'Add Organization' : 'Edit Organization'}</h2>
                  <p className="text-xs text-[#8A97B0]">Fill in organization details</p>
                </div>
              </div>
              <button onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={isAddOpen ? handleCreate : handleEdit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-brand-red text-sm font-semibold">
                  <AlertCircle size={16} className="shrink-0" /> {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <OrgField label="Name" name="name" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} placeholder="Hospital Name" />
                <OrgField label="Code" name="code" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} placeholder="ORG001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <OrgField label="Email" name="email" type="email" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} placeholder="info@org.com" />
                <OrgField label="Phone" name="phone" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} placeholder="+1 555 000 0000" />
              </div>
              <OrgField label="Address" name="address" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} placeholder="123 Main St" />
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2"><OrgField label="City" name="city" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} /></div>
                <OrgField label="State" name="state" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} />
                <OrgField label="ZIP" name="zipCode" form={isAddOpen?addForm:editForm} setForm={isAddOpen?setAddForm:setEditForm} errors={fieldErrors} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5 text-sm">
                  {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                  {isSubmitting ? 'Saving…' : (isAddOpen ? 'Create' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewOpen && selectedOrg && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#DDE3F0]">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue font-black text-lg">
                  {selectedOrg.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">{selectedOrg.name}</h2>
                  <p className="text-xs font-mono text-[#A0AECB]">{selectedOrg.code}</p>
                </div>
              </div>
              <button onClick={() => setIsViewOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { label:'Email', value:selectedOrg.email, icon:Mail },
                { label:'Phone', value:selectedOrg.phone, icon:Phone },
                { label:'Location', value:`${selectedOrg.city||'—'}, ${selectedOrg.state||'—'}`, icon:MapPin },
                { label:'Website', value:selectedOrg.website, icon:Globe },
                { label:'Country', value:selectedOrg.country, icon:Landmark },
                { label:'Status', value:selectedOrg.active ? 'Active' : 'Inactive', icon:Shield },
              ].map(({ label, value, icon:Icon }) => (
                <div key={label} className="space-y-1 p-3 bg-[#F8FAFF] rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-[#A0AECB] font-bold uppercase tracking-wider">
                    <Icon size={12} /> {label}
                  </div>
                  <p className="text-sm font-semibold text-[#0F1A3A]">{value || '—'}</p>
                </div>
              ))}
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

export default Organizations;
