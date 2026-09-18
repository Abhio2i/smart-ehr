import { useEffect, useState, memo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser, selectRole } from '../store/slices/authSlice';
import { fetchPendingReviews, selectPendingReviews } from '../store/slices/qaSlice';
import { fetchFollowUps, selectPendingFollowUps, selectFollowUpLoading } from '../store/slices/followUpSlice';
import StatsCard from '../components/common/StatsCard';
import {
  FileText, CheckSquare, Bell, GitBranch, Users, Building2,
  TrendingUp, Clock, AlertCircle, ChevronRight, Activity,
  ArrowUpRight, Sparkles, LayoutDashboard, AlertTriangle, Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROLE_MENU } from '../constants/permissions';
import AnalyticsCharts from '../components/dashboard/AnalyticsCharts';
import client from '../api/client';

/* ── Status Badge ── */
const STATUS_COLOR = {
  DRAFT:       'badge-gray',
  PENDING:     'badge-orange',
  IN_PROGRESS: 'badge-blue',
  ACTIVE:      'badge-blue',
  COMPLETED:   'badge-blue',
  SUBMITTED:   'badge-blue',
  APPROVED:    'badge-green',
  QA_APPROVED: 'badge-green',
  QA_COMPLETED:'badge-green',
  REJECTED:    'badge-red',
  ARCHIVED:    'badge-gray',
  QA_PENDING:  'badge-orange',
};

const Badge = memo(({ status }) => (
  <span className={`badge ${STATUS_COLOR[status] || 'badge-gray'}`}>
    {(status || 'DRAFT').replace(/_/g, ' ')}
  </span>
));

/* ── Section Header ── */
const SectionHeader = memo(({ icon: Icon, title, linkTo, linkLabel, accent }) => (
  <div className={`flex items-center justify-between p-5 border-b border-[#F0F4FC]`}>
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ? 'bg-red-50 text-brand-red' : 'bg-[#EEF2FF] text-brand-blue'}`}>
        <Icon size={17} />
      </div>
      <h2 className="text-sm font-bold text-[#0F1A3A]">{title}</h2>
    </div>
    {linkTo && (
      <Link to={linkTo} className="flex items-center gap-1 text-xs font-semibold text-[#8A97B0] hover:text-brand-blue transition-colors group">
        {linkLabel} <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    )}
  </div>
));

/* ── Recent EPCR Records ── */
const RecentRecords = memo(({ records, loading }) => (
  <div className="card">
    <SectionHeader icon={FileText} title="Recent EPCR Records" linkTo="/epcr" linkLabel="View All" />
    <div className="divide-y divide-[#F8FAFF]">
      {loading
        ? [...Array(4)].map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-[#F0F4FC] rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#F0F4FC] rounded w-40" />
              <div className="h-2.5 bg-[#F0F4FC] rounded w-24" />
            </div>
            <div className="h-5 bg-[#F0F4FC] rounded w-16" />
          </div>
        ))
        : records.length === 0
          ? (
            <div className="py-12 text-center">
              <FileText size={32} className="text-[#DDE3F0] mx-auto mb-3" />
              <p className="text-sm text-[#A0AECB] font-medium">No records yet</p>
            </div>
          )
          : records.map(r => (
            <div key={r.id} className="px-5 py-4 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors group">
              <div className="w-8 h-8 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue text-xs font-black shrink-0">
                {(r.patientName || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F1A3A] truncate">{r.patientName || 'Anonymous Subject'}</p>
                <p className="text-xs text-[#A0AECB] truncate">{r.incidentLocation || 'Location pending'}</p>
              </div>
              <Badge status={r.status} />
            </div>
          ))
      }
    </div>
  </div>
));

/* ── Pending QA Queue ── */
const PendingQueue = memo(({ pending, loading }) => (
  <div className="card">
    <SectionHeader icon={Clock} title="Pending QA Reviews" linkTo="/qa/reviews" linkLabel="Review All" accent />
    <div className="divide-y divide-[#F8FAFF]">
      {loading
        ? [...Array(4)].map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-[#F0F4FC] rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#F0F4FC] rounded w-36" />
              <div className="h-2.5 bg-[#F0F4FC] rounded w-20" />
            </div>
          </div>
        ))
        : pending.length === 0
          ? (
            <div className="py-12 text-center">
              <CheckSquare size={32} className="text-[#DDE3F0] mx-auto mb-3" />
              <p className="text-sm text-[#A0AECB] font-medium">Queue is clear</p>
            </div>
          )
          : pending.map(r => (
            <div key={r.id} className="px-5 py-4 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors">
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-brand-red text-xs font-black shrink-0">
                {(r.patientName || 'R').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F1A3A] truncate">{r.patientName || 'Review Object'}</p>
                <p className="text-xs text-[#A0AECB] truncate">{r.workflowName || 'Standard Protocol'}</p>
              </div>
              <Badge status={r.status || 'PENDING'} />
            </div>
          ))
      }
    </div>
  </div>
));

/* ── Critical Follow-Up Alert Panel (Paramedic) ── */
const CriticalAlertPanel = memo(({ tasks, loading }) => (
  <div className="card overflow-hidden">
    <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 text-brand-red">
          <AlertTriangle size={17} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#0F1A3A]">Critical Follow-Ups</h2>
          <p className="text-[11px] text-[#A0AECB]">Patients needing follow-up care</p>
        </div>
      </div>
      <Link to="/critical-follow-ups"
        className="flex items-center gap-1 text-xs font-semibold text-[#8A97B0] hover:text-brand-blue transition-colors group">
        View All <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    </div>
    <div className="divide-y divide-[#F8FAFF]">
      {loading
        ? [...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 bg-[#F0F4FC] rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#F0F4FC] rounded w-32" />
              <div className="h-2.5 bg-[#F0F4FC] rounded w-24" />
            </div>
            <div className="h-5 bg-[#F0F4FC] rounded w-16" />
          </div>
        ))
        : tasks.length === 0
          ? (
            <div className="py-10 text-center">
              <CheckSquare size={28} className="text-[#DDE3F0] mx-auto mb-2" />
              <p className="text-sm text-[#A0AECB] font-medium">No pending follow-ups</p>
            </div>
          )
          : tasks.slice(0, 5).map((t, i) => (
            <div key={t.id || t.patientId || i}
              className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#F8FAFF] transition-colors">
              <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center text-brand-red font-black text-xs shrink-0">
                {(t.patientName || t.patientId || 'P').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F1A3A] truncate">{t.patientName || t.patientId}</p>
                <p className="text-xs text-[#A0AECB] flex items-center gap-1 truncate">
                  <Mail size={9} />{t.patientEmail || '—'}
                </p>
              </div>
              <div className="text-right shrink-0">
                {(t.criticalReasons || []).slice(0, 1).map((r, ri) => (
                  <span key={ri} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-brand-red border border-red-100">
                    <AlertTriangle size={9} />{r}
                  </span>
                ))}
              </div>
            </div>
          ))
      }
    </div>
  </div>
));

/* ── Quick Links ── */
const QUICK_LINK_ROUTES = {
  Organizations:  { path: '/organizations', icon: Building2 },
  Users:          { path: '/users',          icon: Users },
  EPCR:           { path: '/epcr',           icon: FileText },
  'QA Forms':     { path: '/qa/forms',       icon: CheckSquare },
  'QA Reviews':   { path: '/qa/reviews',     icon: CheckSquare },
  Workflows:      { path: '/workflows',      icon: GitBranch },
  Deployments:    { path: '/deployments',    icon: GitBranch },
  Reports:        { path: '/reports',        icon: TrendingUp },
  Feedback:       { path: '/feedback',       icon: Bell },
  Notifications:  { path: '/notifications',  icon: Bell },
};

const QuickLinks = memo(({ role }) => {
  const items = (ROLE_MENU[role] || []).filter(m => m !== 'Dashboard').slice(0, 6);
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles size={16} className="text-brand-red" />
        <h2 className="text-sm font-bold text-[#0F1A3A]">Quick Access</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {items.map(m => {
          const cfg = QUICK_LINK_ROUTES[m]; if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <Link key={m} to={cfg.path}
              className="flex flex-col items-center gap-2.5 p-4 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] hover:border-brand-blue hover:bg-white hover:shadow-[0_4px_16px_rgba(26,60,143,0.1)] transition-all group text-center">
              <div className="w-9 h-9 bg-white rounded-xl border border-[#DDE3F0] flex items-center justify-center group-hover:bg-brand-blue group-hover:border-brand-blue transition-colors shadow-sm">
                <Icon size={16} className="text-[#A0AECB] group-hover:text-white transition-colors" />
              </div>
              <span className="text-[11px] font-semibold text-[#8A97B0] group-hover:text-brand-blue transition-colors leading-tight">{m}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

/* ── Role Dashboards ── */
const AdminDashboard = ({ summary, pending, loading }) => {
  const records = summary?.recentRecords || [];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<FileText size={20} />}   label="Total EPCR Records" value={summary?.records?.total ?? 0} color="blue" loading={loading} />
        <StatsCard icon={<CheckSquare size={20} />} label="QA Reviews"         value={summary?.qa?.totalReviews ?? 0} color="blue" loading={loading} />
        <StatsCard icon={<Clock size={20} />}       label="Pending QA"         value={summary?.qa?.pending ?? 0} color="red"  loading={loading} />
        <StatsCard icon={<Bell size={20} />}        label="Unread Alerts"      value={summary?.notifications?.unreadCount ?? 0}         color="red"  loading={loading} />
      </div>
      <QuickLinks role="ADMIN" />
      <AnalyticsCharts />
      <div className="grid lg:grid-cols-2 gap-4">
        <RecentRecords records={records} loading={loading} />
        <PendingQueue pending={pending.slice(0, 5)} loading={loading} />
      </div>
    </div>
  );
};

const ManagerDashboard = ({ summary, pending, loading }) => {
  const pendingCount = (summary?.qa?.pending && summary.qa.pending > 0)
    ? summary.qa.pending
    : (pending?.length || 0);

  const totalCount = (summary?.qa?.totalReviews && summary.qa.totalReviews > 0)
    ? summary.qa.totalReviews
    : (summary?.records?.total || 0);

  const completedCount = (summary?.records?.completed || 0)
    + (summary?.records?.approved || 0)
    + (summary?.records?.submitted || 0);

  const attentionCount = pendingCount + (summary?.records?.drafts || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Clock size={20} />}       label="Pending Reviews"   value={pendingCount}    color="red"  loading={loading} />
        <StatsCard icon={<CheckSquare size={20} />} label="Total Records"     value={totalCount}      color="blue" loading={loading} />
        <StatsCard icon={<CheckSquare size={20} />} label="Active / Completed" value={completedCount} color="blue" loading={loading} />
        <StatsCard icon={<AlertCircle size={20} />} label="Needs Attention"   value={attentionCount} color="red"  loading={loading} />
      </div>
      <QuickLinks role="MANAGER" />
      <AnalyticsCharts />
      <PendingQueue pending={pending.slice(0, 8)} loading={loading} />
    </div>
  );
};

const ParamedicDashboard = ({ summary, loading }) => {
  const records     = summary?.recentRecords || [];
  const followUps   = useSelector(selectPendingFollowUps);
  const fuLoading   = useSelector(selectFollowUpLoading);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<FileText size={20} />}    label="My Records"    value={summary?.records?.total ?? 0}                  color="blue" loading={loading} />
        <StatsCard icon={<FileText size={20} />}    label="Drafts"        value={summary?.records?.drafts ?? 0}                 color="blue" loading={loading} />
        <StatsCard icon={<TrendingUp size={20} />}  label="Submitted"     value={summary?.records?.submitted ?? 0}              color="blue" loading={loading} />
        <StatsCard icon={<AlertTriangle size={20} />} label="Critical Follow-Ups" value={followUps.length}              color="red"  loading={fuLoading} />
      </div>
      <QuickLinks role="PARAMEDIC" />
      <div className="grid lg:grid-cols-2 gap-4">
        <RecentRecords records={records} loading={loading} />
        <CriticalAlertPanel tasks={followUps} loading={fuLoading} />
      </div>
    </div>
  );
};

/* ── Main Dashboard ── */
const Dashboard = () => {
  const dispatch  = useDispatch();
  const user      = useSelector(selectUser);
  const role      = useSelector(selectRole);
  const pending   = useSelector(selectPendingReviews) || [];
  const { t, lang } = useLanguage();

  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!user) return;          // wait until auth is confirmed
    
    const refreshData = async (isFirst = false) => {
      // OPTIMIZATION: Avoid background fetches when browser tab is inactive
      if (!isFirst && document.visibilityState !== 'visible') return;

      try {
        const promises = [];
        
        // Fetch consolidated dashboard summary
        promises.push(
          client.get('/api/dashboard/summary', { hideToast: true })
            .then(res => setSummary(res.data))
        );
        
        // Fetch pending review objects for list display
        if (ROLE_MENU[role]?.includes('QA Reviews')) {
          promises.push(dispatch(fetchPendingReviews()).unwrap());
        }

        // Fetch critical follow-ups for paramedics and physicians
        if (ROLE_MENU[role]?.includes('Critical Follow-Ups')) {
          promises.push(dispatch(fetchFollowUps({ status: 'PENDING', size: 20 })));
        }

        // Silent background pre-cache of detailed ePCR records for offline support
        if (ROLE_MENU[role]?.includes('EPCR') && navigator.onLine) {
          const fetchUrl = user?.organizationId 
            ? `/api/epcr/records/organization/${user.organizationId}` 
            : '/api/epcr/records?page=0&size=1000';
          promises.push(client.get(fetchUrl, { hideToast: true }).catch(() => {}));
        }

        if (isFirst) {
          await Promise.allSettled(promises);
          setIsInitialLoad(false);
        }
      } catch (err) {
        if (isFirst) setIsInitialLoad(false);
      }
    };

    // Fetch immediately on mount and wait for initial load completion
    refreshData(true);

    // OPTIMIZATION: Trigger refresh when browser tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    // OPTIMIZATION: Relax polling interval from 10s to 30s
    const intervalId = setInterval(() => refreshData(false), 30000);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dispatch, role, user]);

  const props = { summary, pending, loading: isInitialLoad };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const rawName = user?.firstName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const cleanName = rawName.replace(/^Dr\.?\s*/i, '');
  const displayName = rawName.toLowerCase().includes('dr') || role === 'PHYSICIAN' ? `Dr. ${cleanName}` : cleanName;

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#A0AECB] uppercase tracking-widest mb-1">{greeting}</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            {displayName}, <span className="text-brand-blue">{t('dash_welcome') === 'dash_welcome' ? 'Welcome back' : t('dash_welcome')}</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">{t('dash_subtitle') === 'dash_subtitle' ? 'System overview, QA reviews, and clinical operations status.' : t('dash_subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Role pill */}
          <div className="pill">
            <LayoutDashboard size={13} /> {role}
          </div>
          {/* New record CTA for paramedics */}
          {(role === 'PARAMEDIC') && (
            <Link to="/epcr/new" className="btn-primary text-sm px-4 py-2">
              + New EPCR
            </Link>
          )}
        </div>
      </div>

      {/* Role-specific dashboard */}
      {role === 'ADMIN'       && <AdminDashboard      {...props} />}
      {role === 'MANAGER'     && <ManagerDashboard    {...props} />}
      {role === 'PARAMEDIC'   && <ParamedicDashboard  {...props} />}
      {role === 'PHYSICIAN'   && <AdminDashboard      {...props} />}
      {role === 'QA_REVIEWER' && <ManagerDashboard    {...props} />}
      {role === 'VIEWER'      && <ParamedicDashboard  {...props} />}
    </div>
  );
};

export default Dashboard;
