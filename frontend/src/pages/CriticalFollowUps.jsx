import { useEffect, useState, useMemo, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFollowUps,
  selectFollowUpTasks,
  selectFollowUpLoading,
  selectFollowUpError,
  selectFollowUpPagination,
} from '../store/slices/followUpSlice';
import {
  AlertTriangle, Search, RefreshCw, ChevronLeft, ChevronRight,
  Mail, Calendar, Clock, Activity, Filter, Download, HeartPulse,
  CheckCircle2, Hourglass, SendHorizonal,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────
const STATUS_META = {
  PENDING: { label: 'Pending',  cls: 'badge-orange', Icon: Hourglass     },
  SENT:    { label: 'Sent',     cls: 'badge-green',  Icon: SendHorizonal  },
  FAILED:  { label: 'Failed',   cls: 'badge-red',    Icon: AlertTriangle  },
};

const fmtDate = (str) => {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return str; }
};

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

// ── Sub-components ────────────────────────────────────────────────────
const StatusBadge = memo(({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.PENDING;
  const Icon = meta.Icon;
  return (
    <span className={`badge ${meta.cls} flex items-center gap-1`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
});

const ReasonChip = memo(({ reason }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-brand-red border border-red-100">
    <AlertTriangle size={9} />
    {reason}
  </span>
));

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className="h-3.5 bg-[#F0F4FC] rounded w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

// ── Main Page ─────────────────────────────────────────────────────────
const CriticalFollowUps = () => {
  const dispatch   = useDispatch();
  const tasks      = useSelector(selectFollowUpTasks);
  const loading    = useSelector(selectFollowUpLoading);
  const error      = useSelector(selectFollowUpError);
  const pagination = useSelector(selectFollowUpPagination);

  const [search,    setSearch]    = useState('');
  const [statusFilter, setStatus] = useState('ALL');
  const [page,      setPage]      = useState(0);
  const PAGE_SIZE = 10;

  const load = (p = 0) => {
    dispatch(fetchFollowUps({
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      page: p,
      size: PAGE_SIZE,
    }));
    setPage(p);
  };

  useEffect(() => { load(0); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tasks;
    return tasks.filter(t =>
      (t.patientName || t.patientId || '').toLowerCase().includes(q) ||
      (t.patientEmail || '').toLowerCase().includes(q) ||
      (t.criticalReasons || []).some(r => r.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  // Stats
  const pending = tasks.filter(t => t.status === 'PENDING').length;
  const sent    = tasks.filter(t => t.status === 'SENT').length;
  const overdue = tasks.filter(t => t.status === 'PENDING' && isOverdue(t.dueDate)).length;

  return (
    <div className="space-y-6 pb-10 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#A0AECB] uppercase tracking-widest mb-1">
            Patient Care
          </p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            <HeartPulse size={24} className="text-brand-red" />
            Critical Follow-Ups
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            Patients flagged for follow-up after emergency care events.
            Emails are sent automatically at 8 AM on the due date.
          </p>
        </div>
        <button
          id="critical-followups-refresh-btn"
          onClick={() => load(page)}
          disabled={loading}
          className="btn-primary text-sm px-4 py-2 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Follow-Ups', value: pending, Icon: Hourglass,   color: 'orange' },
          { label: 'Emails Sent',        value: sent,    Icon: Mail,         color: 'green'  },
          { label: 'Overdue',            value: overdue, Icon: AlertTriangle, color: 'red'   },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-3xl font-black ${
                  color === 'red' ? 'text-brand-red' :
                  color === 'orange' ? 'text-orange-500' :
                  'text-green-600'
                }`}>{loading ? '—' : value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                color === 'red' ? 'bg-red-50 text-brand-red' :
                color === 'orange' ? 'bg-orange-50 text-orange-500' :
                'bg-green-50 text-green-600'
              }`}>
                <Icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters & Search ── */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input
              id="critical-followups-search"
              type="text"
              placeholder="Search patient, email or reason…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-9 py-2.5 text-sm"
            />
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[#A0AECB] shrink-0" />
            {['ALL', 'PENDING', 'SENT', 'FAILED'].map(s => (
              <button
                key={s}
                id={`critical-followups-filter-${s.toLowerCase()}`}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-[#F0F4FC] text-[#8A97B0] hover:bg-[#E8EEFA] hover:text-brand-blue'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-brand-red text-sm font-semibold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F4FC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-brand-red">
              <Activity size={17} />
            </div>
            <h2 className="text-sm font-bold text-[#0F1A3A]">Follow-Up Patient List</h2>
          </div>
          <span className="text-xs text-[#A0AECB] font-semibold">
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Patient</th>
                <th>Critical Reasons</th>
                <th>Due Date</th>
                <th>Incident Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <CheckCircle2 size={40} className="text-[#DDE3F0] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[#A0AECB]">No critical follow-ups found</p>
                    <p className="text-xs text-[#C0CADF] mt-1">
                      {statusFilter !== 'ALL'
                        ? `No tasks with status "${statusFilter}"`
                        : 'All patients are on track — great job!'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((task, idx) => {
                  const due = isOverdue(task.dueDate) && task.status === 'PENDING';
                  return (
                    <tr
                      key={task.id || task.patientId || idx}
                      className="hover:bg-[#F8FAFF] transition-colors"
                      id={`followup-row-${task.patientId || idx}`}
                    >
                      {/* # */}
                      <td>
                        <span className="text-xs text-[#A0AECB] font-semibold">
                          {page * PAGE_SIZE + idx + 1}
                        </span>
                      </td>

                      {/* Patient */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 ${
                            due ? 'bg-brand-red' : 'bg-brand-blue'
                          }`}>
                            {(task.patientName || task.patientId || 'P').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F1A3A] truncate">
                              {task.patientName || task.patientId || 'Patient'}
                            </p>
                            <p className="text-xs text-[#A0AECB] flex items-center gap-1 truncate">
                              <Mail size={9} />
                              {task.patientEmail || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Reasons */}
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(task.criticalReasons || []).map((r, ri) => (
                            <ReasonChip key={ri} reason={r} />
                          ))}
                          {(!task.criticalReasons || task.criticalReasons.length === 0) && (
                            <span className="text-xs text-[#A0AECB]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td>
                        <div className={`flex items-center gap-1.5 text-sm font-semibold ${
                          due ? 'text-brand-red' : 'text-[#4B5A7A]'
                        }`}>
                          <Calendar size={12} />
                          {fmtDate(task.dueDate)}
                          {due && (
                            <span className="badge badge-red text-[9px] px-1.5 py-0.5">OVERDUE</span>
                          )}
                        </div>
                      </td>

                      {/* Incident Date */}
                      <td>
                        <div className="flex items-center gap-1.5 text-sm text-[#8A97B0]">
                          <Clock size={12} />
                          {fmtDate(task.incidentDate)}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={task.status} />
                        {task.sentAt && (
                          <p className="text-[10px] text-[#A0AECB] mt-0.5">
                            Sent: {fmtDate(task.sentAt)}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F4FC]">
            <p className="text-xs text-[#A0AECB] font-semibold">
              Page {page + 1} of {pagination.totalPages} · {pagination.totalElements} total
            </p>
            <div className="flex items-center gap-2">
              <button
                id="critical-followups-prev-btn"
                onClick={() => load(page - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg bg-[#F0F4FC] disabled:opacity-40 hover:bg-[#E8EEFA] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                id="critical-followups-next-btn"
                onClick={() => load(page + 1)}
                disabled={pagination.isLast}
                className="p-1.5 rounded-lg bg-[#F0F4FC] disabled:opacity-40 hover:bg-[#E8EEFA] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── How it works callout ── */}
      <div className="card p-5 border-l-4 border-brand-blue bg-[#F8FAFF]">
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue shrink-0">
            <Mail size={15} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F1A3A] mb-1">How automatic emails work</p>
            <p className="text-xs text-[#8A97B0] leading-relaxed">
              When a paramedic submits an ePCR, the system automatically checks vitals.
              Patients with critical readings (Low SpO₂, High BP, etc.) are flagged
              and a follow-up task is created. Every morning at <strong>8:00 AM</strong>, the
              scheduler finds all <em>PENDING</em> tasks whose due date has passed and sends
              an email reminding the patient to seek follow-up care. No manual action needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriticalFollowUps;
