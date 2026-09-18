import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSharesInbox, selectSharesInbox, selectShareLoading, selectShareError } from '../store/slices/shareSlice';
import ShareDetailsModal from '../components/sharing/ShareDetailsModal';
import RecordShareModal from '../components/sharing/RecordShareModal';
import {
  Share2, Inbox, Clock, CheckCircle2, XCircle, Search, RefreshCw, Eye, Plus, ShieldCheck,
  FileText, Activity, AlertCircle, LayoutGrid, User, ExternalLink, ArrowRight, UserCheck
} from 'lucide-react';

export const RecordShares = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const inboxData = useSelector(selectSharesInbox);
  const loading = useSelector(selectShareLoading);
  const error = useSelector(selectShareError);
  const currentUser = useSelector((state) => state.auth.user);

  const [selectedShare, setSelectedShare] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, VIEWED, RESPONDED, REVOKED
  const [selectedOrgFilter, setSelectedOrgFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchSharesInbox());
  }, [dispatch]);

  const shares = inboxData?.content || (Array.isArray(inboxData) ? inboxData : []);

  const uniqueOrgs = Array.from(new Set(shares.map(s => s.organizationId).filter(Boolean)));

  const filteredShares = shares.filter(share => {
    if (activeTab !== 'ALL' && share.status !== activeTab) return false;
    if (selectedOrgFilter !== 'ALL' && share.organizationId !== selectedOrgFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (share.recordId && share.recordId.toLowerCase().includes(q)) ||
      (share.specialistName && share.specialistName.toLowerCase().includes(q)) ||
      (share.sharedByName && share.sharedByName.toLowerCase().includes(q)) ||
      (share.specialtyRequested && share.specialtyRequested.toLowerCase().includes(q)) ||
      (share.organizationId && share.organizationId.toLowerCase().includes(q))
    );
  });

  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatRecordId = (rawId) => {
    if (!rawId) return 'REC-UNKNOWN';
    if (rawId.startsWith('rec-') || rawId.startsWith('REC-')) return rawId.toUpperCase();
    if (rawId.length > 8) {
      return `REC-${rawId.substring(rawId.length - 8).toUpperCase()}`;
    }
    return `REC-${rawId.toUpperCase()}`;
  };

  const formatSpecialty = (spec) => {
    if (!spec) return 'General Medicine';
    return spec
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case 'VIEWED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-brand-blue border border-blue-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-brand-blue" />
            Opened / Viewed
          </span>
        );
      case 'RESPONDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Responded
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <XCircle size={12} className="text-rose-500" />
            Revoked
          </span>
        );
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  // Stats calculation
  const totalCount = shares.length;
  const pendingCount = shares.filter(s => s.status === 'PENDING').length;
  const respondedCount = shares.filter(s => s.status === 'RESPONDED').length;
  const revokedCount = shares.filter(s => s.status === 'REVOKED').length;

  const isDoctor = currentUser?.role === 'PHYSICIAN' || currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 font-sans">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <p className="text-xs font-black text-brand-blue uppercase tracking-widest mb-1">Clinical Collaboration</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            Record <span className="text-brand-blue">Shares</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage specialist consultations, record transfers, and clinical opinions.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch(fetchSharesInbox())}
            disabled={loading}
            className="p-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#4B5A7A] rounded-xl transition shadow-sm"
            title="Refresh Shares Inbox"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          
          {isDoctor ? (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-2 active:scale-95"
            >
              <Plus size={16} />
              <span>New Share Consultation</span>
            </button>
          ) : (
            <div
              className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
              title="Record sharing and clinical specialist consultations are restricted to Senior Physicians / Doctors"
            >
              <ShieldCheck size={15} className="text-amber-600 shrink-0" />
              <span>Senior Doctor Sharing Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Shares', value: totalCount, icon: Share2, bgClass: 'bg-[#EEF2FF] text-brand-blue', textClass: 'text-[#0F1A3A]' },
          { label: 'Pending Review', value: pendingCount, icon: Clock, bgClass: 'bg-amber-50 text-amber-600', textClass: 'text-amber-700' },
          { label: 'Opinions Received', value: respondedCount, icon: CheckCircle2, bgClass: 'bg-emerald-50 text-emerald-600', textClass: 'text-emerald-700' },
          { label: 'Revoked Shares', value: revokedCount, icon: XCircle, bgClass: 'bg-rose-50 text-rose-500', textClass: 'text-rose-600' },
        ].map(({ label, value, icon: Icon, bgClass, textClass }) => (
          <div key={label} className="border border-[#E2E8F0] bg-white rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div className="flex justify-between items-start">
              <span className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider">{label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${bgClass}`}>
                <Icon size={16} />
              </div>
            </div>
            <p className={`text-2xl font-black mt-3 ${textClass}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Main Container Card */}
      <div className="card overflow-hidden border border-[#E2E8F0] rounded-2xl bg-white shadow-sm">
        
        {/* Filter / Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-5 border-b border-[#F0F4FC]">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input
              type="text"
              placeholder="Search by Record ID, Specialist, or Specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none transition"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F8FAFC] p-1.5 rounded-xl border border-[#E2E8F0]">
            {['ALL', 'PENDING', 'VIEWED', 'RESPONDED', 'REVOKED'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === tab
                    ? 'bg-white text-brand-blue shadow-sm border border-[#E2E8F0]'
                    : 'text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Organization Filter Dropdown (Admin & Multi-Org) */}
          {(currentUser?.role === 'ADMIN' || uniqueOrgs.length > 1) && (
            <div className="flex items-center gap-2 bg-[#EEF2FF] px-3 py-1.5 rounded-xl border border-[#C8D5F0]">
              <ShieldCheck size={14} className="text-brand-blue shrink-0" />
              <select
                value={selectedOrgFilter}
                onChange={(e) => setSelectedOrgFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-brand-blue outline-none cursor-pointer"
              >
                <option value="ALL">All Organizations</option>
                {uniqueOrgs.map(org => {
                  const s = shares.find(item => item.organizationId === org);
                  const orgName = s?.organizationName || (org ? `Org (${org})` : 'General Organization');
                  return <option key={org} value={org}>{orgName}</option>;
                })}
              </select>
            </div>
          )}

          <span className="text-xs text-[#A0AECB] font-semibold lg:ml-auto">
            Showing {filteredShares.length} shares
          </span>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Record Reference</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Organization</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Shared By (Sharer)</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Shared To (Recipient Doctor)</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Type & Specialty</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Status</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider">Created</th>
                <th className="py-3.5 px-5 text-xs font-black text-[#4B5A7A] uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F4FC]">
              {loading && filteredShares.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan="8" className="py-4 px-5">
                      <div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredShares.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-16 text-center">
                    <Inbox size={40} className="text-[#DDE3F0] mx-auto mb-3" />
                    <p className="text-base font-bold text-[#0F1A3A]">No Record Shares Found</p>
                    <p className="text-xs text-[#8A97B0] max-w-sm mx-auto mt-1">
                      No medical record shares match your selected search or filter options.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredShares.map((share) => (
                  <tr key={share.id} className="hover:bg-[#F8FAFF] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const targetId = share.patientId || share.recordId;
                            navigate(targetId ? `/patient-history/${targetId}` : '/epcr');
                          }}
                          className="px-2.5 py-1 bg-[#EEF2FF] hover:bg-brand-blue hover:text-white border border-[#C8D5F0] rounded-lg text-brand-blue font-mono font-bold text-xs transition shadow-xs flex items-center gap-1 group"
                          title="Open Patient History & Record"
                        >
                          <span>{formatRecordId(share.recordId)}</span>
                          <ExternalLink size={10} className="opacity-60 group-hover:opacity-100" />
                        </button>
                        <button
                          onClick={() => handleCopy(share.recordId, `rec-${share.id}`)}
                          className="text-[#8A97B0] hover:text-brand-blue transition p-1"
                          title="Copy Full Record ID"
                        >
                          {copiedId === `rec-${share.id}` ? <CheckCircle2 size={13} className="text-emerald-600" /> : <FileText size={13} />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="px-2.5 py-1 bg-[#F0F4FC] border border-[#DDE3F0] rounded-lg text-[#0F1A3A] font-bold text-xs inline-flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-brand-blue" />
                        <span>{share.organizationName || (share.organizationId ? `Org (${share.organizationId})` : 'General Organization')}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#0F1A3A] font-semibold">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-brand-blue border border-[#C8D5F0] flex items-center justify-center font-black text-xs shrink-0">
                          {(share.sharedByName || 'P').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#0F1A3A]">{share.sharedByName || 'Provider'}</p>
                          <p className="text-[11px] text-brand-blue font-semibold">Sender / Referring</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#F0F4FC] rounded-xl flex items-center justify-center text-brand-blue border border-[#DDE3F0] font-bold text-xs shrink-0">
                          <UserCheck size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#0F1A3A] flex items-center gap-1.5">
                            <span>{share.specialistName || share.specialistEmail || 'Assigned Specialist'}</span>
                          </p>
                          {share.specialistOrganizationName ? (
                            <p className="text-[11px] text-[#8A97B0] font-medium">{share.specialistOrganizationName}</p>
                          ) : (
                            <p className="text-[11px] text-[#8A97B0] font-semibold">Recipient Doctor</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                            share.shareType === 'INTERNAL'
                              ? 'bg-blue-100 text-brand-blue border border-blue-200'
                              : 'bg-purple-100 text-purple-700 border border-purple-200'
                          }`}>
                            {share.shareType === 'INTERNAL' ? 'Internal Specialist' : 'External Link'}
                          </span>
                        </div>
                        <span className="text-[#0F1A3A] font-bold text-xs flex items-center gap-1">
                          <Activity size={12} className="text-brand-blue" />
                          {formatSpecialty(share.specialtyRequested)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      {getStatusBadge(share.status)}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-[#8A97B0]">
                      <div className="font-semibold text-[#0F1A3A]">{new Date(share.createdAt).toLocaleDateString()}</div>
                      <div className="text-[11px] text-[#A0AECB]">{new Date(share.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {share.shareType === 'EXTERNAL' && share.accessTokenHash && (
                          <button
                            onClick={() => handleCopy(`${window.location.origin}/shared/${share.id}`, `link-${share.id}`)}
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-xs transition border border-purple-200 inline-flex items-center gap-1"
                            title="Copy Share Token Access Link"
                          >
                            {copiedId === `link-${share.id}` ? <CheckCircle2 size={13} className="text-emerald-600" /> : <ExternalLink size={13} />}
                            <span>Link</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedShare(share);
                            setIsDetailsOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-[#F0F4FC] hover:bg-brand-blue hover:text-white text-brand-blue rounded-xl font-bold text-xs transition border border-[#DDE3F0] inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye size={14} />
                          <span>View Details</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="flex items-center gap-3 p-4 bg-[#EEF2FF] rounded-2xl border border-[#C8D5F0] text-xs text-brand-blue font-medium">
        <ShieldCheck size={18} className="shrink-0 text-brand-blue" />
        <span>All record sharing transactions are encrypted, audited under HIPAA compliance guidelines, and subject to role-based access rules.</span>
      </div>

      {/* Modals */}
      {selectedShare && (
        <ShareDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedShare(null);
          }}
          share={selectedShare}
          currentUserId={currentUser?.id || currentUser?.userId}
        />
      )}

      <RecordShareModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        recordId="rec-101"
      />

    </div>
  );
};

export default RecordShares;
