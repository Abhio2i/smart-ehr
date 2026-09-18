import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Plus, Search, Trash2, RefreshCw, X, Edit2,
  User as UserIcon, Mail, Phone, Building, Lock,
  Shield, Check, ShieldAlert, Key, UserCheck, Activity, Fingerprint
} from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser, selectUsers, selectUserLoading } from '../store/slices/userSlice';
import { fetchOrganizations } from '../store/slices/orgSlice';
import { addToast } from '../store/slices/uiSlice';
import { selectRole, selectUser } from '../store/slices/authSlice';

const ROLES = ['ADMIN', 'MANAGER', 'PARAMEDIC', 'PHYSICIAN', 'QA_REVIEWER', 'VIEWER'];

const ROLE_BADGE = {
  ADMIN: 'badge badge-red',
  MANAGER: 'badge badge-blue',
  PARAMEDIC: 'badge badge-blue',
  PHYSICIAN: 'badge badge-green',
  QA_REVIEWER: 'badge badge-orange',
  VIEWER: 'badge badge-gray',
};

/* ── Modal Field ── */
const Field = ({ label, icon: Icon, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">{label}</label>
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />}
      {children}
    </div>
  </div>
);

const Users = () => {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const user = useSelector(selectUser);
  const currentUserRole = useSelector(selectRole);
  const users = useSelector(selectUsers);
  const loading = useSelector(selectUserLoading);
  const { organizations } = useSelector(state => state.org);

  const availableRoles = currentUserRole === 'ADMIN' ? ROLES : ROLES.filter(r => r !== 'ADMIN');

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const blank = { firstName: '', lastName: '', email: '', phone: '', organizationId: '', role: 'PHYSICIAN', specialty: 'CARDIOLOGY', password: '' };
  const [addForm, setAddForm] = useState(blank);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', role: 'PHYSICIAN', specialty: '', organizationId: '', active: true });

  const CLINICAL_SPECIALTIES = [
    'CARDIOLOGY', 'RADIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'OBSTETRIC_GYNECOLOGY',
    'SURGICAL_CARE', 'OPHTHALMOLOGY', 'DENTAL_CARE', 'LONG_TERM_CARE', 'MENTAL_HEALTH',
    'CHILD_FAMILY_SERVICES', 'REHABILITATION_SERVICES', 'TRAUMA_EMERGENCY', 'ORTHOPEDICS',
    'PEDIATRICS', 'INTENSIVE_CARE', 'PULMONOLOGY', 'GENERAL_SURGERY'
  ];

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchOrganizations());
  }, [dispatch]);

  const openAdd = () => {
    setLocalError('');
    const defaultOrgId = user?.organizationId || (organizations?.[0]?.id || '');
    setAddForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      organizationId: defaultOrgId,
      role: 'PHYSICIAN',
      specialty: 'CARDIOLOGY',
      password: ''
    });
    setIsAddOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setLocalError('');
    try {
      const finalOrgId = addForm.organizationId || user?.organizationId || (organizations?.[0]?.id || '');
      const payload = { ...addForm, organizationId: finalOrgId };
      await dispatch(createUser(payload)).unwrap();
      setIsAddOpen(false); setAddForm(blank);
      dispatch(addToast({ type: 'success', message: 'User created successfully' }));
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err?.message || err?.error || 'Failed to create user');
      setLocalError(errorMsg);
    }
    finally { setIsSubmitting(false); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ firstName: u.firstName || '', lastName: u.lastName || '', phone: u.phone || '', role: u.role || 'PHYSICIAN', specialty: u.specialty || '', organizationId: u.organizationId || '', active: u.active ?? true });
    setIsAddOpen(false); setIsEditOpen(true); setLocalError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setIsSubmitting(true); setLocalError('');
    try {
      const { organizationId: _omit, ...payload } = editForm;
      await dispatch(updateUser({ id: editUser.id, data: payload })).unwrap();
      setIsEditOpen(false); setEditUser(null);
      dispatch(addToast({ type: 'success', message: 'User updated successfully' }));
    } catch (err) { setLocalError(err); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      await dispatch(deleteUser(id)).unwrap();
      dispatch(addToast({ type: 'success', message: 'User deactivated' }));
    } catch (err) { dispatch(addToast({ type: 'error', message: err || 'Failed' })); }
  };

  const filtered = (users || []).filter(u =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = 'input' + ' pl-10';

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Administration</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">User <span className="text-brand-blue">Management</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage platform users and role assignments</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => dispatch(fetchUsers())} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openAdd} className="btn-primary text-sm px-4 py-2.5">
            <Plus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users?.length || 0, icon: UserIcon, blue: true },
          { label: 'Active', value: users?.filter(u => u.active).length || 0, icon: UserCheck, blue: true },
          { label: 'Paramedics', value: users?.filter(u => u.role === 'PARAMEDIC').length || 0, icon: Activity, blue: true },
          { label: 'QA Reviewers', value: users?.filter(u => u.role === 'QA_REVIEWER').length || 0, icon: Shield, blue: false },
        ].map(({ label, value, icon: Icon, blue }) => (
          <div key={label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${blue ? 'bg-[#EEF2FF] text-brand-blue' : 'bg-red-50 text-brand-red'}`}>
              <Icon size={18} />
            </div>
            <p className={`text-3xl font-black ${blue ? 'text-brand-blue' : 'text-brand-red'}`}>{value}</p>
            <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 p-5 border-b border-[#F0F4FC]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search users…" className="input pl-10 py-2.5 text-sm" />
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold ml-auto">{filtered.length} users</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Organization</th>
                <th>Contact</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !filtered.length ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan="5" className="py-4 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="py-16 text-center">
                  <UserIcon size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No users found</p>
                </td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue font-black text-sm shrink-0">
                        {(u.firstName?.charAt(0) || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-[#0F1A3A]">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-[#A0AECB]">ID: {u.id?.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className={ROLE_BADGE[u.role] || 'badge badge-gray'}>{u.role?.replace('_', ' ')}</span></td>
                  <td>
                    <div className="flex items-center gap-2 text-sm text-[#4B5A7A]">
                      <Building size={14} className="text-[#A0AECB]" /> {u.organizationName || '—'}
                    </div>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-[#8A97B0]"><Mail size={12} /> {u.email}</div>
                      {u.phone && <div className="flex items-center gap-1.5 text-xs text-[#8A97B0]"><Phone size={12} /> {u.phone}</div>}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)}
                        className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDelete(u.id)}
                        className="p-2 rounded-lg bg-[#FFF0F3] text-brand-red hover:bg-brand-red hover:text-white transition-all">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#DDE3F0] my-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <UserIcon size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg">{isAddOpen ? 'Add New User' : 'Edit User'}</h2>
                  <p className="text-xs text-[#8A97B0]">Fill in the details below</p>
                </div>
              </div>
              <button onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleCreate : handleEdit} className="p-6 space-y-4">
              {localError && (
                <div className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-brand-red text-sm font-semibold">
                  <ShieldAlert size={16} className="shrink-0" /> {localError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" icon={UserIcon}>
                  <input className={inputCls} placeholder="John" value={isAddOpen ? addForm.firstName : editForm.firstName}
                    onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, firstName: e.target.value }))} />
                </Field>
                <Field label="Last Name" icon={UserIcon}>
                  <input className={inputCls} placeholder="Doe" value={isAddOpen ? addForm.lastName : editForm.lastName}
                    onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, lastName: e.target.value }))} />
                </Field>
              </div>

              {isAddOpen && (
                <Field label="Email" icon={Mail}>
                  <input type="email" className={inputCls} placeholder="user@hospital.com" value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} required />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" icon={Phone}>
                  <input className={inputCls} placeholder="+91 9876543210" value={isAddOpen ? addForm.phone : editForm.phone}
                    onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Role" icon={Shield}>
                  <select className={inputCls} value={isAddOpen ? addForm.role : editForm.role}
                    onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, role: e.target.value }))}>
                    {availableRoles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </Field>
              </div>

              {(isAddOpen ? addForm.role : editForm.role) === 'PHYSICIAN' && (
                <Field label="Clinical Specialty" icon={Activity}>
                  <select className={inputCls} value={isAddOpen ? addForm.specialty : editForm.specialty}
                    onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, specialty: e.target.value }))}>
                    <option value="">Select Specialty</option>
                    {CLINICAL_SPECIALTIES.map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </Field>
              )}

              {isAddOpen && (
                <Field label="Password" icon={Key}>
                  <input type="password" className={inputCls} placeholder="••••••••" value={addForm.password}
                    onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} required />
                </Field>
              )}

              <Field label="Organization" icon={Building}>
                <select className={inputCls} value={isAddOpen ? (addForm.organizationId || user?.organizationId || '') : (editForm.organizationId || user?.organizationId || '')}
                  onChange={e => (isAddOpen ? setAddForm : setEditForm)(f => ({ ...f, organizationId: e.target.value }))}
                  disabled={currentUserRole !== 'ADMIN'}>
                  {currentUserRole === 'ADMIN' && <option value="">Select Organization</option>}
                  {user?.organizationId && !organizations.some(o => o.id === user.organizationId) && (
                    <option value={user.organizationId}>{user.organizationName || user.organizationId}</option>
                  )}
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  {!user?.organizationId && organizations.length === 0 && (
                    <option value="DEFAULT_ORG">Default Organization</option>
                  )}
                </select>
              </Field>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => isAddOpen ? setIsAddOpen(false) : setIsEditOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center py-2.5">
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                  {isSubmitting ? 'Saving…' : (isAddOpen ? 'Create User' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
