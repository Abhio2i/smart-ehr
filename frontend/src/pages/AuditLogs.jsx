import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  Server, Search, RefreshCw, FileText, Globe, User,
  Activity, Shield, ShieldCheck, Clock, Database, Lock, AlertCircle, LayoutGrid, CheckCircle2, XCircle
} from 'lucide-react';
import { fetchUsers, selectUsers } from '../store/slices/userSlice';
import {
  fetchAuditLogs, selectAuditLogs, selectAuditLoading,
  selectAuditHasMore, selectAuditPage, selectAuditError
} from '../store/slices/auditSlice';

const ACTION_BADGE = {
  LOGIN:       'badge badge-blue',
  LOGOUT:      'badge badge-gray',
  CREATE:      'badge badge-green',
  UPDATE:      'badge badge-blue',
  DELETE:      'badge badge-red',
  DEIDENTIFY:  'badge badge-gray',
  BREAK_GLASS: 'badge badge-red',
};

const getActionBadge = (action) => {
  if (!action) return ACTION_BADGE.LOGOUT;
  const u = action.toUpperCase();
  if (u.includes('LOGIN'))  return ACTION_BADGE.LOGIN;
  if (u.includes('CREATE')) return ACTION_BADGE.CREATE;
  if (u.includes('UPDATE')) return ACTION_BADGE.UPDATE;
  if (u.includes('DELETE')) return ACTION_BADGE.DELETE;
  if (u.includes('BREAK'))  return ACTION_BADGE.BREAK_GLASS;
  if (u.includes('DEIDENTIFY') || u.includes('ANONYMIZE')) return ACTION_BADGE.DEIDENTIFY;
  return ACTION_BADGE.LOGOUT;
};

const AuditLogs = () => {
  const dispatch = useDispatch();
  const { t }    = useLanguage();
  const logs    = useSelector(selectAuditLogs);
  const loading = useSelector(selectAuditLoading);
  const hasMore = useSelector(selectAuditHasMore);
  const page    = useSelector(selectAuditPage);
  const allUsers = useSelector(selectUsers);

  const [searchTerm, setSearchTerm]     = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const usersById = {};
  allUsers.forEach(u => { if (u.id) usersById[u.id] = u; if (u.userId) usersById[u.userId] = u; });

  const displayUser = (log) => {
    const uid = log.userId || log.actorId || log.performedBy || log.createdBy;
    const u = uid ? usersById[uid] : null;
    if (u) return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || uid;
    return log.username || log.userName || log.user || uid || '—';
  };

  const fetchLogs = (pageNum = 0, isAppend = false) =>
    dispatch(fetchAuditLogs({ page: pageNum, size: 20, isAppend }));

  useEffect(() => { dispatch(fetchUsers()); fetchLogs(0, false); }, [dispatch]);

  const actionTypes = [...new Set((Array.isArray(logs) ? logs : []).map(l => l.action).filter(Boolean))];

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
    const matchSearch = !searchTerm ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayUser(log).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = filterAction === 'ALL' || log.action === filterAction;
    const matchStatus = filterStatus === 'ALL' ||
      (filterStatus === 'SUCCESS' && log.status !== 'FAILURE' && log.status !== 'ERROR') ||
      (filterStatus === 'FAILURE' && (log.status === 'FAILURE' || log.status === 'ERROR'));
    return matchSearch && matchAction && matchStatus;
  });

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) return;

    const headers = ["Timestamp", "Action", "Status", "Performed By", "User ID", "IP Address", "Category", "Target ID", "Details"];
    
    const rows = filteredLogs.map(log => [
      log.timestamp ? new Date(log.timestamp).toLocaleString() : '',
      log.action || '',
      log.status || 'SUCCESS',
      displayUser(log),
      log.userId || log.actorId || log.performedBy || '',
      log.ipAddress || '—',
      log.entityType || log.category || '',
      log.entityId || log.targetId || '',
      log.details || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Logs_Export_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Administration</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Audit <span className="text-brand-blue">Logs</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Immutable activity and security event registry</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => fetchLogs(0, false)} disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExportCSV} disabled={!filteredLogs || filteredLogs.length === 0}
            className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2 hover:bg-brand-blue/90 active:scale-95 transition-all">
            <FileText size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: logs?.length || 0, icon: Activity, bgClass: 'bg-[#EEF2FF] text-brand-blue', textClass: 'text-[#0F1A3A]' },
          { label: 'Success Events', value: (Array.isArray(logs) ? logs : []).filter(l => l.status !== 'FAILURE' && l.status !== 'ERROR').length, icon: CheckCircle2, bgClass: 'bg-emerald-50 text-emerald-600', textClass: 'text-emerald-700' },
          { label: 'Failed Events', value: (Array.isArray(logs) ? logs : []).filter(l => l.status === 'FAILURE' || l.status === 'ERROR').length, icon: XCircle, bgClass: 'bg-rose-50 text-rose-500', textClass: 'text-rose-600' },
          { label: 'Storage Encryption', value: 'AES-256', icon: Database, bgClass: 'bg-amber-50 text-amber-600', textClass: 'text-amber-700' },
        ].map(({ label, value, icon: Icon, bgClass, textClass }) => (
          <div key={label} className="stat-card border border-[#E2E8F0] bg-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bgClass}`}>
                <Icon size={16} />
              </div>
            </div>
            <p className={`text-2xl font-black mt-4 ${textClass}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden border border-[#E2E8F0] rounded-2xl bg-white shadow-sm">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-5 border-b border-[#F0F4FC]">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search logs by action, user, IP..." className="input pl-10 py-2.5 text-sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <LayoutGrid size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
                className="input pl-10 py-2.5 text-sm pr-4 min-w-[160px]">
                <option value="ALL">All Actions</option>
                {actionTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="relative">
              <Shield size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="input pl-10 py-2.5 text-sm pr-4 min-w-[150px]">
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failures Only</option>
              </select>
            </div>
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold lg:ml-auto">{filteredLogs.length} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-left">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Timestamp</th>
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Action</th>
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Status</th>
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">User</th>
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">IP Address</th>
                <th className="py-3 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FC]">
              {loading && !filteredLogs.length ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan="6" className="py-3 px-5">
                    <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                  </td></tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="6" className="py-16 text-center">
                  <ShieldCheck size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No events found</p>
                </td></tr>
              ) : filteredLogs.map(log => {
                const isFail = log.status === 'FAILURE' || log.status === 'ERROR' || (log.details && log.details.toLowerCase().includes('fail'));
                return (
                  <tr key={log.id} className="hover:bg-[#F8FAFF] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#EEF2FF] rounded-lg flex items-center justify-center text-brand-blue shrink-0">
                          <Clock size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F1A3A]">
                            {new Date(log.timestamp || log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-[#A0AECB]">
                            {new Date(log.timestamp || log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={getActionBadge(log.action)}>
                        {log.action?.replace(/_/g,' ') || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      {isFail ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Failure
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Success
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-[#F0F4FC] rounded-lg flex items-center justify-center text-[#8A97B0]">
                          <User size={13} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F1A3A]">{displayUser(log)}</p>
                          <p className="text-[10px] text-[#A0AECB] font-mono">UID: {(log.userId || '—')?.substring?.(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 text-sm font-mono text-[#4B5A7A]">
                        <Globe size={13} className="text-[#A0AECB]" /> {log.ipAddress || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <p className="text-sm font-semibold text-[#0F1A3A]">{log.entityType || 'System'}</p>
                      {isFail ? (
                        <p className="text-xs text-rose-600 bg-rose-50/50 border border-rose-100/50 px-2 py-1.5 rounded-lg mt-1 max-w-[280px] break-words font-mono font-medium leading-normal">
                          {log.details || 'Execution failed.'}
                        </p>
                      ) : (
                        <p className="text-xs text-[#8A97B0] truncate max-w-[280px] font-medium leading-normal">{log.details || '—'}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="p-5 border-t border-[#F0F4FC] text-center">
            <button onClick={() => fetchLogs(page + 1, true)}
              className="btn-outline text-sm px-6 py-2.5">
              {loading ? <RefreshCw size={15} className="animate-spin mr-1.5" /> : null}
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-4 p-5 bg-[#EEF2FF] rounded-2xl border border-[#C8D5F0]">
        <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center shrink-0">
          <Lock size={18} className="text-white" />
        </div>
        <p className="text-sm text-brand-blue font-medium">
          This registry is immutable and encrypted with AES-256-GCM. All access events are permanently recorded.
        </p>
      </div>
    </div>
  );
};

export default AuditLogs;
