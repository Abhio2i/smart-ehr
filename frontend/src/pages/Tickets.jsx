import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  LifeBuoy, RefreshCw, ChevronDown, CheckCircle, Clock,
  AlertTriangle, Search, Image, Calendar, User, Eye, X, Filter,
  FileQuestion, Inbox, CheckCircle2, AlertOctagon
} from 'lucide-react';
import { fetchTickets, updateTicketStatus, selectTickets, selectTicketsLoading } from '../store/slices/ticketSlice';
import { addToast } from '../store/slices/uiSlice';
import { selectRole } from '../store/slices/authSlice';

const STATUS_CONFIG = {
  OPEN: { label: 'Open', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: RefreshCw },
  RESOLVED: { label: 'Resolved', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
  CLOSED: { label: 'Closed', color: 'text-slate-600 bg-slate-50 border-slate-100', icon: X }
};

const PRIORITY_CONFIG = {
  LOW: { label: 'Low', color: 'bg-slate-100 text-slate-800' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-800 font-bold' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-800 font-black animate-pulse' }
};

const CATEGORY_MAP = {
  BUG: 'Application Bug',
  USABILITY: 'Usability/Design',
  ACCESS: 'Access/Auth',
  OTHER: 'Other Support'
};

const Tickets = () => {
  const dispatch = useDispatch();
  const tickets = useSelector(selectTickets);
  const loading = useSelector(selectTicketsLoading);
  const role = useSelector(selectRole);
  const isAdmin = role === 'ADMIN';

  const [expandedId, setExpandedId] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    dispatch(fetchTickets());
  }, [dispatch]);

  const handleUpdateStatus = async (ticketId, nextStatus) => {
    try {
      await dispatch(updateTicketStatus({ id: ticketId, status: nextStatus })).unwrap();
      dispatch(addToast({ type: 'success', message: `Ticket marked as ${nextStatus.replace('_', ' ').toLowerCase()}` }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to update status.' }));
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchSubject = t.subject?.toLowerCase().includes(term);
      const matchDesc = t.description?.toLowerCase().includes(term);
      const matchCreator = t.creatorName?.toLowerCase().includes(term);
      return matchSubject || matchDesc || matchCreator;
    }
    return true;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Calculate stats based on total loaded tickets
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const inProgressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  return (
    <div className="space-y-6 pb-12 p-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Helpdesk & Support</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Support <span className="text-brand-blue">Tickets</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            {isAdmin ? 'Manage and track issues submitted by Doctors and Caregivers' : 'Track the status of your submitted support requests'}
          </p>
        </div>
        <div>
          <button
            onClick={() => dispatch(fetchTickets())}
            disabled={loading}
            className="btn-ghost border border-[#DDE3F0] px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold bg-white shadow-sm hover:shadow transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Tickets', count: totalCount, icon: Inbox, color: 'text-brand-blue bg-blue-50 border-blue-100' },
            { label: 'Open Tickets', count: openCount, icon: AlertOctagon, color: 'text-rose-600 bg-rose-50 border-rose-100' },
            { label: 'In Progress', count: inProgressCount, icon: RefreshCw, color: 'text-amber-600 bg-amber-50 border-amber-100' },
            { label: 'Resolved Issues', count: resolvedCount, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' }
          ].map((stat, i) => {
            const StatIcon = stat.icon;
            return (
              <div key={i} className="card p-4 flex items-center justify-between gap-4 border border-[#DDE3F0] bg-white">
                <div>
                  <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-black text-[#0F1A3A] mt-1 leading-none">{stat.count}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${stat.color}`}>
                  <StatIcon size={18} className={stat.label === 'In Progress' && inProgressCount > 0 ? 'animate-spin-slow' : ''} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters Area */}
      {isAdmin ? (
        <div className="card p-5 border border-[#DDE3F0] bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
            <Filter size={14} className="text-[#8A97B0]" />
            <h3 className="text-xs font-black text-[#0F1A3A] uppercase tracking-wider">Search & Filter Criteria</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Keyword Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB] w-4 h-4" />
              <input
                type="text"
                placeholder="Search subject, user or keyword..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input pl-10 py-2.5 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white transition-all placeholder:text-[#A0AECB]"
              />
            </div>

            {/* Status filter */}
            <div>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="input py-2.5 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open Only</option>
                <option value="IN_PROGRESS">In Progress Only</option>
                <option value="RESOLVED">Resolved Only</option>
                <option value="CLOSED">Closed Only</option>
              </select>
            </div>

            {/* Priority filter */}
            <div>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="input py-2.5 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">Low Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="URGENT">Urgent Priority</option>
              </select>
            </div>

            {/* Category filter */}
            <div>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="input py-2.5 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white"
              >
                <option value="ALL">All Categories</option>
                <option value="BUG">Application Bug</option>
                <option value="USABILITY">Usability/Design</option>
                <option value="ACCESS">Access/Auth</option>
                <option value="OTHER">Other Issues</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        /* Simplified Non-Admin Filters */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#DDE3F0] shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB] w-4 h-4" />
            <input
              type="text"
              placeholder="Search your tickets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input pl-10 py-2.5 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white transition-all placeholder:text-[#A0AECB]"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input py-2.5 px-3 text-xs bg-slate-50/50 border-[#DDE3F0] focus:bg-white rounded-xl"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {loading && sortedTickets.length === 0 ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-[#F0F4FC] border border-[#DDE3F0] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : sortedTickets.length === 0 ? (
        <div className="card p-16 text-center border border-[#DDE3F0] bg-white">
          <LifeBuoy size={48} className="text-[#C8D5F0] mx-auto mb-4" />
          <h3 className="font-black text-[#0F1A3A] text-lg mb-1">No Tickets Match</h3>
          <p className="text-sm text-[#A0AECB] max-w-sm mx-auto">
            Try adjusting your search query or filter tags to display matching support requests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTickets.map(ticket => {
            const isExpanded = expandedId === ticket.id;
            const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
            const StatusIcon = statusCfg.icon;
            const priorityCfg = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

            return (
              <div
                key={ticket.id}
                className={`card overflow-hidden border border-[#DDE3F0] bg-white transition-all duration-300 ${
                  isExpanded ? 'ring-2 ring-brand-blue/5 border-brand-blue shadow-md' : 'hover:border-brand-blue/30 hover:shadow-sm'
                }`}
              >
                {/* Collapsed Header View */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* User profile bubble with dynamic letter */}
                    <div className="w-10 h-10 rounded-xl bg-[#F0F4FC] text-brand-blue border border-[#DDE3F0] flex items-center justify-center font-black text-sm shrink-0">
                      {(ticket.creatorName?.split(':')[1]?.trim()?.charAt(0) || ticket.creatorName?.charAt(0) || 'U').toUpperCase()}
                    </div>
                    
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-black text-sm ${isExpanded ? 'text-brand-blue' : 'text-[#0F1A3A]'}`}>
                          {ticket.subject || 'Untitled Support Request'}
                        </h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusCfg.color}`}>
                          <StatusIcon size={10} className={ticket.status === 'IN_PROGRESS' ? 'animate-spin-slow' : ''} />
                          {statusCfg.label}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                          {CATEGORY_MAP[ticket.category] || ticket.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[#A0AECB] font-medium flex-wrap">
                        {isAdmin && (
                          <>
                            <span className="flex items-center gap-1"><User size={12} /> {ticket.creatorName || 'Unknown User'}</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="flex items-center gap-1"><Calendar size={12} /> {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</span>
                        {ticket.screenshotUrl && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 text-brand-blue font-bold bg-[#EEF2FF] px-1.5 py-0.5 rounded-md text-[10px]"><Image size={11} /> Screenshots Attached</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
                    <button
                      type="button"
                      className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all ${
                        isExpanded ? 'bg-brand-blue text-white border-brand-blue' : 'bg-slate-50 border-[#DDE3F0] text-[#4B5A7A] hover:bg-slate-100'
                      }`}
                    >
                      {isExpanded ? 'Hide Details' : 'View Details'}
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-[#F0F4FC] bg-[#F8FAFF] p-6 space-y-6">
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left: Metadata & Description */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Description Details</label>
                          <div className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm">
                            <p className="text-xs text-[#0F1A3A] leading-relaxed whitespace-pre-wrap font-medium">
                              {ticket.description}
                            </p>
                          </div>
                        </div>

                        {/* Reporter Details (Admin Only) */}
                        {isAdmin && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Reporter Contact & Organization</label>
                            <div className="bg-white p-4 rounded-2xl border border-[#DDE3F0] shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                              <div>
                                <span className="text-[9px] font-black text-[#8A97B0] uppercase block">Email</span>
                                <span className="text-xs font-bold text-[#0F1A3A] select-all">{ticket.creatorEmail || 'Not recorded'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-[#8A97B0] uppercase block">Phone</span>
                                <span className="text-xs font-bold text-[#0F1A3A] select-all">{ticket.creatorPhone || 'Not recorded'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-black text-[#8A97B0] uppercase block">Organization</span>
                                <span className="text-xs font-bold text-[#0F1A3A]">{ticket.organizationName || 'Not recorded'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Extra Metadata Logs */}
                        <div className="grid grid-cols-2 gap-4 bg-[#F0F4FC]/50 p-4 rounded-xl border border-[#DDE3F0]/60">
                          <div>
                            <span className="text-[9px] font-black text-[#8A97B0] uppercase block">Ticket ID</span>
                            <span className="text-[10px] font-mono font-bold text-[#0F1A3A]">{ticket.id}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-[#8A97B0] uppercase block">Last Updated</span>
                            <span className="text-[10px] font-bold text-[#0F1A3A]">
                              {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Attachment Preview */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Attachment Screenshot</label>
                        {ticket.screenshotUrl ? (
                          <div className="relative group rounded-2xl overflow-hidden border border-[#DDE3F0] bg-white p-2.5 shadow-sm">
                            <img
                              src={ticket.screenshotUrl}
                              alt="Screenshot"
                              className="max-h-[220px] w-full rounded-xl object-contain bg-slate-50 cursor-zoom-in group-hover:opacity-90 transition-opacity"
                              onClick={() => setZoomImage(ticket.screenshotUrl)}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none">
                              <span className="bg-white/90 text-[#0F1A3A] text-[10px] font-black px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5">
                                <Eye size={12} /> Click to Zoom
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-[#DDE3F0] rounded-2xl p-8 text-center bg-white flex flex-col items-center justify-center h-[180px]">
                            <Image size={24} className="text-[#C8D5F0] mb-2" />
                            <p className="text-[10px] text-[#A0AECB] font-bold">No Screenshots Attached</p>
                            <p className="text-[9px] text-[#C8D5F0] mt-0.5">Reporter did not attach an image</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Update Control Row */}
                    <div className="pt-5 border-t border-[#F0F4FC] flex flex-wrap items-center justify-between gap-4">
                      {isAdmin ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-[#4B5A7A]">Update State:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { id: 'OPEN', label: 'Open', color: 'hover:border-blue-400 hover:text-blue-600 bg-blue-50/10' },
                              { id: 'IN_PROGRESS', label: 'In Progress', color: 'hover:border-amber-400 hover:text-amber-600 bg-amber-50/10' },
                              { id: 'RESOLVED', label: 'Resolved', color: 'hover:border-emerald-400 hover:text-emerald-600 bg-emerald-50/10' },
                              { id: 'CLOSED', label: 'Closed', color: 'hover:border-slate-400 hover:text-slate-600 bg-slate-50/10' }
                            ].map(act => {
                              const isSelected = ticket.status === act.id;
                              return (
                                <button
                                  key={act.id}
                                  disabled={isSelected}
                                  onClick={() => handleUpdateStatus(ticket.id, act.id)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                    isSelected
                                      ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                                      : `bg-white border-[#DDE3F0] text-[#4B5A7A] ${act.color}`
                                  }`}
                                >
                                  {act.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#4B5A7A]">Current State:</span>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border flex items-center gap-1 ${statusCfg.color}`}>
                            <StatusIcon size={12} className={ticket.status === 'IN_PROGRESS' ? 'animate-spin-slow' : ''} />
                            {statusCfg.label}
                          </span>
                        </div>
                      )}

                      {ticket.resolvedAt ? (
                        <div className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl shadow-inner">
                          <CheckCircle size={14} /> Resolving log: resolved at {new Date(ticket.resolvedAt).toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-xs text-rose-500 font-bold flex items-center gap-1.5 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl">
                          <AlertTriangle size={14} className="animate-bounce" /> Awaiting administrative resolution
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox / Zoom Dialog */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-[#0F1A3A]/95 backdrop-blur-md z-[110] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setZoomImage(null)}
        >
          <div className="relative max-w-5xl w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img
              src={zoomImage}
              alt="Zoomed Screenshot Lightbox"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-[-44px] right-2 md:right-0 p-2 bg-white/10 text-white hover:text-brand-red rounded-full hover:bg-white/20 transition-all border border-white/10"
              title="Close image overlay"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
