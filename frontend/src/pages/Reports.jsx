import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  BarChart2, TrendingUp, FileText, RefreshCw, Calendar,
  Activity, Filter, Download, Settings, ChevronDown,
  CheckCircle, AlertTriangle, Layers, Database
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart as RPieChart, Pie, Cell, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  fetchAllReports, fetchCustomReport,
  fetchReportStats, fetchQaPerformance, fetchRecordsByStatus,
  selectReportStats, selectStatsLoading,
  selectReportQaPerf, selectQaLoading,
  selectReportByStatus, selectByStatusLoading,
  selectCustomReport, selectCustomReportLoading,
  fetchBuilderStats, selectBuilderStats, selectBuilderStatsLoading,
  fetchBuilderRecords, selectBuilderRecords, selectBuilderPagination,
  selectBuilderLoading,
} from '../store/slices/reportSlice';
import {
  fetchIncidentTypes, selectIncidentTypes,
} from '../store/slices/epcrSlice';
import { fetchQaReviews, selectReviews } from '../store/slices/qaSlice';
import { addToast } from '../store/slices/uiSlice';
import GlobalLoader from '../components/common/GlobalLoader';
import PatientAnalyticsWidget from '../components/analytics/PatientAnalyticsWidget';

/* ─── Constants ──────────────────────────────────────────────────── */
const COLORS   = ['#1A3C8F', '#C8102E', '#059669', '#EA580C', '#7C3AED', '#0891B2', '#DB2777'];
const PAGE_SIZE = 15; // Larger page size for backend pagination (less frequent round-trips)
const TABS = [
  { id: 'overview',     label: 'System Analytics' },
  { id: 'patients',     label: 'Patient Analytics' },
  { id: 'queryBuilder', label: 'QI Query Builder'  },
];
const X_OPTIONS = [
  { value: 'incidentType',     label: 'Incident Type'  },
  { value: 'incidentLocation', label: 'Location'        },
  { value: 'status',           label: 'Record Status'   },
  { value: 'paramedicsName',   label: 'Paramedic'       },
  { value: 'month',            label: 'Month'           },
];
const Y_OPTIONS = [
  { value: 'volume',   label: 'Incident Volume'  },
  { value: 'avgScore', label: 'Avg QA Score (%)'  },
  { value: 'passRate', label: 'QA Pass Rate (%)'  },
];
const CHART_TYPE_OPTIONS = [
  { value: 'bar',  label: 'Bar Chart'  },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie',  label: 'Pie Chart'  },
];
const TABLE_HEADERS = ['Patient', 'Incident Type', 'Location', 'Date', 'Paramedic', 'Status', 'QA Score', 'QA Reviewer'];
const BADGE_MAP = {
  APPROVED: 'badge-green', QA_APPROVED: 'badge-green',
  REJECTED: 'badge-red',
  DRAFT: 'badge-blue', SUBMITTED: 'badge-blue', QA_PENDING: 'badge-blue',
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const toTitle = (str) =>
  str ? str.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

const fmtNum = (v) =>
  typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : (v ?? '—');

/* ─── useDebounce ────────────────────────────────────────────────── */
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ─── SearchableSelect ───────────────────────────────────────────── */
const SearchableSelect = memo(({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const ref             = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);
  const filtered = useMemo(
    () => q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options,
    [options, q],
  );
  const handleToggle = useCallback(() => { setOpen(p => !p); setQ(''); }, []);
  const handlePick   = useCallback((v) => { onChange(v); setOpen(false); }, [onChange]);
  const stopProp     = useCallback((e) => e.stopPropagation(), []);

  return (
    <div ref={ref} className="relative w-full">
      <div
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 bg-[#F8FAFF] border border-[#DDE3F0] hover:border-[#A0B0D0] rounded-xl px-3.5 py-2.5 cursor-pointer select-none transition-all"
      >
        <span className={`text-sm font-semibold truncate ${selected?.value ? 'text-[#0F1A3A]' : 'text-[#8A97B0]'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-[#8A97B0] transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-[#DDE3F0] rounded-xl shadow-xl max-h-56 flex flex-col overflow-hidden">
          {options.length > 5 && (
            <div className="p-2 border-b border-[#F0F4FC]">
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} onClick={stopProp}
                placeholder="Search..." className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#1A3C8F]" />
            </div>
          )}
          <div className="overflow-y-auto py-1">
            {filtered.length === 0
              ? <p className="px-4 py-3 text-xs text-[#8A97B0] text-center">No results</p>
              : filtered.map(opt => (
                <div key={opt.value} onClick={() => handlePick(opt.value)}
                  className={`px-4 py-2 text-xs font-semibold cursor-pointer transition-colors hover:bg-[#EEF2FF] hover:text-[#1A3C8F] ${opt.value === value ? 'bg-[#EEF2FF] text-[#1A3C8F]' : 'text-[#4B5A7A]'}`}>
                  {opt.label}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
});
SearchableSelect.displayName = 'SearchableSelect';

/* ─── Memoized sub-components ────────────────────────────────────── */
const CustomTooltip = memo(({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const displayLabel = payload[0]?.payload?.fullName || label;
  return (
    <div className="bg-white border border-[#DDE3F0] rounded-xl p-3 shadow-lg text-xs max-w-[280px] break-words">
      <p className="font-bold text-[#4B5A7A] mb-1">{displayLabel}</p>
      {payload.map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: e.color || e.fill }} />
          <span className="font-semibold text-[#0F1A3A]">{e.name}: <span className="text-[#1A3C8F]">{e.value}</span></span>
        </div>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

const StatCard = memo(({ icon: Icon, label, value, color = 'text-[#1A3C8F]', loading }) => (
  <div className="stat-card">
    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center mb-3">
      <Icon size={18} className={color} />
    </div>
    {loading
      ? <div className="h-8 w-16 bg-[#F0F4FC] rounded-lg animate-pulse mb-1" />
      : <p className={`text-2xl font-black ${color}`}>{value}</p>
    }
    <p className="text-[10px] text-[#8A97B0] font-black uppercase tracking-wider mt-1.5">{label}</p>
  </div>
));
StatCard.displayName = 'StatCard';

const StatusBadge = memo(({ status }) => (
  <span className={`badge ${BADGE_MAP[status] || 'badge-blue'}`}>{toTitle(status)}</span>
));
StatusBadge.displayName = 'StatusBadge';

const TableRow = memo(({ row }) => (
  <tr className="border-b border-[#F8FAFF] hover:bg-[#F8FAFF] transition-colors">
    <td className="px-4 py-3 font-semibold text-[#0F1A3A] whitespace-nowrap">{row.patientName}</td>
    <td className="px-4 py-3 text-[#4B5A7A]">{toTitle(row.incidentType)}</td>
    <td className="px-4 py-3 text-[#4B5A7A] max-w-[120px] truncate">{row.incidentLocation}</td>
    <td className="px-4 py-3 text-[#8A97B0] whitespace-nowrap">
      {row.incidentDateTime ? new Date(row.incidentDateTime).toLocaleDateString() : '—'}
    </td>
    <td className="px-4 py-3 text-[#4B5A7A] whitespace-nowrap">{row.paramedicsName}</td>
    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
    <td className="px-4 py-3 font-bold">
      {row.qaScore != null
        ? <span className={row.qaScore >= 80 ? 'text-[#059669]' : 'text-[#C8102E]'}>{row.qaScore}%</span>
        : <span className="text-[#A0AECB] font-normal text-xs">Pending</span>}
    </td>
    <td className="px-4 py-3 text-[#8A97B0]">{row.qaReviewer}</td>
  </tr>
));
TableRow.displayName = 'TableRow';

/* ════════════════════════════════════════════════════════════════ */
/*  Reports                                                          */
/* ════════════════════════════════════════════════════════════════ */
const Reports = () => {
  const dispatch = useDispatch();
  const { t } = useLanguage();

  /* ── Redux selectors ──────────────────────────────────────────── */
  const stats           = useSelector(selectReportStats);
  const statsLoading    = useSelector(selectStatsLoading);
  const qaPerf          = useSelector(selectReportQaPerf);
  const qaLoading       = useSelector(selectQaLoading);
  const byStatus        = useSelector(selectReportByStatus);
  const byStatusLoading = useSelector(selectByStatusLoading);
  const customReport    = useSelector(selectCustomReport);
  const customLoading   = useSelector(selectCustomReportLoading);
  const loading         = statsLoading || qaLoading || byStatusLoading; // combined for refresh button
  const builderStats    = useSelector(selectBuilderStats);
  const bsLoading       = useSelector(selectBuilderStatsLoading);
  const builderLoading  = useSelector(selectBuilderLoading)  ?? false;
  const records         = useSelector(selectBuilderRecords) || [];
  const reviews         = useSelector(selectReviews)        || [];
  const incidentTypes   = useSelector(selectIncidentTypes)  || [];
  const pagination      = useSelector(selectBuilderPagination); // { page, totalPages, totalElements, isLast }

  /* ── Global loading: any network call in flight ───────────────── */
  const isAnyLoading = statsLoading || qaLoading || byStatusLoading || customLoading || bsLoading || builderLoading;

  /* ── UI state ─────────────────────────────────────────────────── */
  const [activeTab,   setActiveTab]   = useState('overview');
  const [rangeStart,  setRangeStart]  = useState('');
  const [rangeEnd,    setRangeEnd]    = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page,        setPage]        = useState(0);

  /* ── Query Builder filter state ───────────────────────────────── */
  // Backend-sent filters (search, date, type, status) — trigger refetch
  const [searchText,         setSearchText]         = useState('');
  const [startDate,          setStartDate]          = useState('');
  const [endDate,            setEndDate]            = useState('');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('');
  const [statusFilter,       setStatusFilter]       = useState('');

  /* Chart config */
  const [xDim,      setXDim]      = useState('incidentType');
  const [yMetric,   setYMetric]   = useState('volume');
  const [chartType, setChartType] = useState('bar');

  /* ── Ref: hold current backend filters for pagination clicks ──── */
  const backendFiltersRef = useRef({});

  /* ── Build current backend filter object ──────────────────────── */
  const dSearchText = useDebounce(searchText, 500);
  const dStartDate  = useDebounce(startDate, 500);
  const dEndDate    = useDebounce(endDate,   500);

  const backendFilters = useMemo(() => {
    const f = {};
    if (dSearchText)         f.search       = dSearchText;
    if (dStartDate)          f.startDate    = dStartDate;
    if (dEndDate)            f.endDate      = dEndDate;
    if (incidentTypeFilter)  f.incidentType = incidentTypeFilter;
    if (statusFilter)        f.status       = statusFilter;
    return f;
  }, [dSearchText, dStartDate, dEndDate, incidentTypeFilter, statusFilter]);

  /* ── Core fetch helpers ───────────────────────────────────────── */
  const fetchPage = useCallback((pageNum, filters = backendFiltersRef.current) => {
    dispatch(fetchBuilderRecords({ page: pageNum, size: PAGE_SIZE, ...filters }));
  }, [dispatch]);

  /* ── Overview tab initial load ────────────────────────────────── */
  const loadOverview = useCallback(() => {
    dispatch(fetchAllReports());
    dispatch(fetchIncidentTypes());
    // Fetch reviews once for QA join (bounded, not repeated per page)
    dispatch(fetchQaReviews({ page: 0, size: 200 }));
  }, [dispatch]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  /* ── When switching to Query Builder: initial load ─────────────── */
  useEffect(() => {
    if (activeTab === 'queryBuilder') {
      fetchPage(0, {});
      dispatch(fetchBuilderStats({}));
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── When backend filters change: reset to page 0 + refetch ────── */
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (activeTab !== 'queryBuilder') return;
    backendFiltersRef.current = backendFilters;
    setPage(0);
    fetchPage(0, backendFilters);
    // Builder stats uses backend filters
    dispatch(fetchBuilderStats(backendFilters));
  }, [backendFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Overview: custom date range report ─────────────────────────── */
  const handleCustomRange = useCallback((e) => {
    e.preventDefault();
    dispatch(fetchCustomReport({ startDate: rangeStart, endDate: rangeEnd }));
  }, [dispatch, rangeStart, rangeEnd]);

  /* ── Pagination ──────────────────────────────────────────────────── */
  const totalPages = pagination?.totalPages ?? 1;
  const totalElements = pagination?.totalElements ?? 0;

  const goNext = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [page, fetchPage]);

  const goPrev = useCallback(() => {
    const prev = page - 1;
    setPage(prev);
    fetchPage(prev);
  }, [page, fetchPage]);

  /* ── Tab switch ──────────────────────────────────────────────────── */
  const handleTabChange = useCallback((id) => {
    setActiveTab(id);
    setPage(0);
  }, []);

  /* ── Reset all filters ───────────────────────────────────────────── */
  const resetFilters = useCallback(() => {
    setSearchText('');
    setStartDate(''); setEndDate('');
    setIncidentTypeFilter(''); setStatusFilter('');
    setPage(0);
    dispatch(addToast({ type: 'info', message: 'Filters cleared' }));
  }, [dispatch]);

  /* ── Toggle filter panel ─────────────────────────────────────────── */
  const toggleFilters = useCallback(() => setFiltersOpen(p => !p), []);

  /* ── Stable onChange handlers ────────────────────────────────────── */
  const onType      = useCallback((v) => { setIncidentTypeFilter(v); }, []);
  const onStatus    = useCallback((v) => { setStatusFilter(v);       }, []);

  /* ── Join current-page records with cached reviews ───────────────── */
  const joinedData = useMemo(() => {
    const revMap = {};
    reviews.forEach(r => { if (r.recordId) revMap[r.recordId] = r; });
    return records.map(rec => {
      const rev = revMap[rec.id];
      return {
        ...rec,
        patientName:      rec.patientName      || 'Anonymous',
        incidentType:     rec.incidentType     || 'GENERAL',
        incidentLocation: rec.incidentLocation || '—',
        paramedicsName:   rec.paramedicsName   || 'Unassigned',
        status:           rec.status           || 'DRAFT',
        qaScore:          rev?.score,
        qaPassed:         rev?.passed,
        qaStatus:         rev?.status,
        qaReviewer:       rev?.reviewerName    || 'Unassigned',
        feedback:         rev?.feedback        || '',
      };
    });
  }, [records, reviews]);

  /* ── Local filter logic replaced by backend pagination results ───── */
  const filteredData = joinedData;

  /* ── Chart data (from current page) ─────────────────────────────── */
  const chartData = useMemo(() => {
    const groups = {};
    filteredData.forEach(item => {
      let key;
      switch (xDim) {
        case 'incidentType':     key = toTitle(item.incidentType);  break;
        case 'incidentLocation': key = item.incidentLocation || '—'; break;
        case 'status':           key = toTitle(item.status);         break;
        case 'paramedicsName':   key = item.paramedicsName || 'Unassigned'; break;
        case 'month':
          key = item.incidentDateTime
            ? new Date(item.incidentDateTime).toLocaleString('default', { month: 'short', year: '2-digit' })
            : 'Unknown';
          break;
        default: key = 'Other';
      }
      if (!groups[key]) groups[key] = { count: 0, scoreSum: 0, passed: 0, reviewed: 0 };
      const g = groups[key];
      g.count++;
      if (item.qaScore != null) { g.scoreSum += item.qaScore; g.reviewed++; if (item.qaPassed) g.passed++; }
    });
    return Object.entries(groups).map(([name, g]) => {
      const avg = g.reviewed > 0 ? Math.round(g.scoreSum / g.reviewed)        : 0;
      const pr  = g.reviewed > 0 ? Math.round((g.passed  / g.reviewed) * 100) : 0;
      const truncatedName = name.length > 20 ? name.slice(0, 17) + '...' : name;
      return { 
        name: truncatedName, 
        fullName: name, 
        value: yMetric === 'volume' ? g.count : yMetric === 'avgScore' ? avg : pr, 
        volume: g.count, 
        avgScore: avg, 
        passRate: pr 
      };
    });
  }, [filteredData, xDim, yMetric]);

  /* ── Backend stats (aggregate across ALL matching records) ────────── */
  const statsCards = useMemo(() => {
    if (!builderStats) return null;

    const stats = builderStats.statistics || {};
    const qa = builderStats.qaPerformance || {};

    const total = stats.totalRecords || 0;
    const reviewed = stats.totalReviews || qa.totalReviews || 0;
    const pending = qa.pendingReviews || 0;
    const passed = qa.passedReviews || 0;

    // Calculate pass rate from backend review statistics
    const passRate = reviewed > 0 ? Math.round((passed / reviewed) * 100) : 0;

    // Calculate average score dynamically from reviews matching current records
    const matchedRecordIds = new Set(records.map(r => r.id));
    const matchedReviews = reviews.filter(r => r.recordId && matchedRecordIds.has(r.recordId) && r.score != null);
    const avgScore = matchedReviews.length > 0
      ? Math.round(matchedReviews.reduce((sum, r) => sum + r.score, 0) / matchedReviews.length)
      : 0;

    return {
      total,
      reviewed,
      avgScore,
      passRate,
      pending,
    };
  }, [builderStats, records, reviews]);

  /* ── Overview: by-status pie data ───────────────────────────────── */
  const statusChartData = useMemo(() =>
    byStatus ? Object.entries(byStatus).map(([name, value]) => ({ name: toTitle(name), value: Number(value) || 0 })) : [],
  [byStatus]);

  /* ── Incident type options from backend ──────────────────────────── */
  const incidentTypeOptions = useMemo(() => [
    { value: '', label: 'All Types' },
    ...incidentTypes.map(t => ({ value: t, label: toTitle(t) })),
  ], [incidentTypes]);

  /* ── Status options from current page ───────────────────────────── */
  const statusOptions = useMemo(() => {
    const seen = new Set();
    const opts = [{ value: '', label: 'All Statuses' }];
    joinedData.forEach(d => {
      if (d.status && !seen.has(d.status)) { seen.add(d.status); opts.push({ value: d.status, label: toTitle(d.status) }); }
    });
    return opts;
  }, [joinedData]);

  /* ── Governance alerts from current page ─────────────────────────── */
  const govAlerts = useMemo(() =>
    filteredData.filter(i => i.status === 'REJECTED' || (i.qaScore != null && i.qaScore < 80)).slice(0, 10),
  [filteredData]);

  /* ── CSV Export ──────────────────────────────────────────────────── */
  const exportCSV = useCallback(() => {
    if (!filteredData.length) { dispatch(addToast({ type: 'warning', message: 'No data to export' })); return; }
    const headers = ['ID', 'Patient', 'Incident Type', 'Location', 'Date', 'Paramedic', 'Status', 'QA Score', 'QA Status', 'QA Reviewer'];
    const rows = filteredData.map(d => [
      d.id, d.patientName, d.incidentType, d.incidentLocation,
      d.incidentDateTime ? new Date(d.incidentDateTime).toLocaleString() : '—',
      d.paramedicsName, d.status,
      d.qaScore != null ? `${d.qaScore}%` : 'Pending',
      d.qaStatus || 'Unreviewed', d.qaReviewer,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `qa_qi_report_${new Date().toISOString().split('T')[0]}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    dispatch(addToast({ type: 'success', message: `Exported ${filteredData.length} records` }));
  }, [filteredData, dispatch]);

  /* ── Chart JSX ───────────────────────────────────────────────────── */
  const chartNode = useMemo(() => {
    if (!chartData.length)
      return <div className="h-full flex items-center justify-center text-sm text-[#8A97B0]">No data — adjust filters</div>;

    const yLabel  = yMetric === 'volume' ? 'Count' : yMetric === 'avgScore' ? 'Avg Score (%)' : 'Pass Rate (%)';
    const tooltip = <Tooltip content={<CustomTooltip />} />;

    if (chartType === 'pie')
      return (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <RPieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%"
              label={({ name, value }) => `${name}: ${value}`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            {tooltip}<Legend />
          </RPieChart>
        </ResponsiveContainer>
      );

    const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart;
    const DataComp  = chartType === 'line' ? Line      : chartType === 'area' ? Area      : Bar;
    const dataProps = chartType === 'area'
      ? { type: 'monotone', fill: '#1A3C8F', stroke: '#1A3C8F', fillOpacity: 0.2 }
      : chartType === 'line'
      ? { type: 'monotone', stroke: '#1A3C8F', strokeWidth: 2, dot: false }
      : { fill: '#1A3C8F', radius: [4, 4, 0, 0] };

    return (
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <ChartComp data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FC" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8A97B0' }} />
          <YAxis tick={{ fontSize: 10, fill: '#8A97B0' }}
            label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: '#8A97B0' } }} />
          {tooltip}
          <DataComp dataKey="value" name={yLabel} {...dataProps} />
        </ChartComp>
      </ResponsiveContainer>
    );
  }, [chartData, chartType, yMetric]);

  /* ════════════════ RENDER ═════════════════════════════════════════ */
  return (
    <div className="relative space-y-6 pb-10 animate-fade-in">

      {/* ── Global Loading Overlay ─────────────────────────────────── */}
      <GlobalLoader
        visible={isAnyLoading}
        label="Loading data…"
        sublabel="Please wait while we fetch your records"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Analytics & QI</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Reports & <span className="text-brand-blue">Governance</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Operational metrics, clinical performance, and dynamic query builder</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadOverview} disabled={loading} className="btn-ghost border border-[#DDE3F0] px-3.5 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {activeTab === 'queryBuilder' && (
            <button onClick={exportCSV} className="btn-primary px-4 py-2.5 rounded-xl flex items-center gap-2">
              <Download size={16} /> Export Page CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#DDE3F0]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)}
            className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-all ${
              activeTab === tab.id ? 'border-[#1A3C8F] text-[#1A3C8F]' : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB 1: OVERVIEW ═══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* ── Summary Stat Cards ─────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs font-black text-[#A0AECB] uppercase tracking-wider pl-1">Overview Statistics</p>
            {statsLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="stat-card animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-[#F0F4FC] mb-3" />
                    <div className="h-8 w-16 bg-[#F0F4FC] rounded-lg mb-2" />
                    <div className="h-2 w-20 bg-[#F0F4FC] rounded-full" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(stats)
                  .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                  .slice(0, 8)
                  .map(([key, val], i) => {
                    const icons = [FileText, Activity, TrendingUp, BarChart2, CheckCircle, Layers, AlertTriangle, Calendar];
                    return (
                      <StatCard key={key} icon={icons[i % 8]} label={toTitle(key)} value={fmtNum(val)} />
                    );
                  })}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <p className="text-sm text-[#A0AECB]">No statistics available. Click refresh to load.</p>
              </div>
            )}
          </div>

          {/* ── Charts Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Records by Status — Bar Chart */}
            <div className="card p-6">
              <p className="text-sm font-bold text-[#0F1A3A] mb-1">Records by Status</p>
              <p className="text-xs text-[#8A97B0] mb-4">Distribution across all ePCR statuses</p>
              {byStatusLoading ? (
                <div className="h-[240px] flex items-center justify-center">
                  <RefreshCw size={24} className="text-[#DDE3F0] animate-spin" />
                </div>
              ) : statusChartData.length > 0 ? (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={statusChartData} margin={{ top: 4, right: 8, left: -20, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FC" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#8A97B0' }} angle={-25} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: '#8A97B0' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-sm text-[#A0AECB]">
                  No status data available
                </div>
              )}
              {/* Legend */}
              {statusChartData.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#F0F4FC]">
                  {statusChartData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] font-semibold text-[#4B5A7A]">{item.name}: <span className="font-black">{item.value}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* QA Performance — Progress bars */}
            <div className="card p-6">
              <p className="text-sm font-bold text-[#0F1A3A] mb-1">QA Performance Metrics</p>
              <p className="text-xs text-[#8A97B0] mb-4">Quality assurance review indicators</p>
              {qaLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex justify-between mb-1">
                        <div className="h-3 w-28 bg-[#F0F4FC] rounded" />
                        <div className="h-3 w-10 bg-[#F0F4FC] rounded" />
                      </div>
                      <div className="h-1.5 bg-[#F0F4FC] rounded-full" />
                    </div>
                  ))}
                </div>
              ) : qaPerf ? (
                <div className="space-y-4">
                  {Object.entries(qaPerf)
                    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                    .map(([k, v]) => {
                      const num = typeof v === 'number' ? v : parseFloat(v) || 0;
                      // Detect if it's a percentage/rate (0-100) or a raw count
                      const isRate = k.toLowerCase().includes('rate') || k.toLowerCase().includes('percent') || k.toLowerCase().includes('score');
                      const pct = isRate ? Math.min(100, Math.max(0, Math.abs(num))) : Math.min(100, (num / 500) * 100);
                      const color = isRate && num >= 80 ? '#059669' : isRate && num < 60 ? '#C8102E' : '#1A3C8F';
                      return (
                        <div key={k}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-semibold text-[#4B5A7A]">{toTitle(k)}</span>
                            <span className="font-black text-[#0F1A3A]" style={{ color }}>{fmtNum(v)}{isRate && typeof v === 'number' ? '%' : ''}</span>
                          </div>
                          <div className="h-2 bg-[#F0F4FC] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-[#A0AECB]">
                  No QA performance data available
                </div>
              )}
            </div>
          </div>

          {/* ── Custom Date Range Report ────────────────────────────── */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#EEF2FF] rounded-xl flex items-center justify-center">
                <Calendar size={15} className="text-[#1A3C8F]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F1A3A]">Custom Date Range Report</p>
                <p className="text-xs text-[#8A97B0]">Generate aggregated stats for any date window</p>
              </div>
            </div>
            <form onSubmit={handleCustomRange} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Start Date</label>
                <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="input py-2" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">End Date</label>
                <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="input py-2" />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={customLoading || !rangeStart || !rangeEnd}
                  className="btn-primary w-full py-2 rounded-xl disabled:opacity-50">
                  {customLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin" /> Generating...
                    </span>
                  ) : 'Generate Report'}
                </button>
              </div>
            </form>

            {customReport && (() => {
              // Known backend metadata keys to exclude from display
              const SKIP_KEYS = new Set([
                'period', 'reportgeneratedat', 'requestedstartdate', 'requestedenddate',
                'generatedat', 'startedat', 'endedat', 'createdat', 'updatedat',
              ]);
              // Detect ISO date strings like "2026-06-05T11:50:04..."
              const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);

              // Flatten nested statistics and qaPerformance maps from custom report response
              const statsObj = {
                ...(customReport.statistics || {}),
                ...(customReport.qaPerformance || {})
              };

              const entries = Object.entries(statsObj)
                .filter(([k, v]) =>
                  v !== null &&
                  v !== undefined &&
                  typeof v !== 'object' &&
                  !SKIP_KEYS.has(k.toLowerCase()) &&
                  !isIsoDate(v)
                )
                .slice(0, 8);

              if (!entries.length) return (
                <div className="mt-5 pt-5 border-t border-[#F0F4FC] text-center py-4">
                  <p className="text-sm text-[#A0AECB]">No numeric stats returned for this date range</p>
                </div>
              );

              return (
                <div className="mt-5 pt-5 border-t border-[#F0F4FC]">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-black text-[#A0AECB] uppercase tracking-wider">Results</p>
                    <p className="text-[10px] text-[#8A97B0] font-semibold">{rangeStart} to {rangeEnd}</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {entries.map(([k, v], i) => {
                      const isRate = k.toLowerCase().includes('rate') || k.toLowerCase().includes('score') || k.toLowerCase().includes('percent');
                      const icons  = [FileText, Activity, TrendingUp, BarChart2, CheckCircle, Layers, AlertTriangle, Calendar];
                      const Icon   = icons[i % 8];
                      const num    = typeof v === 'number' ? v : parseFloat(v) || 0;
                      const color  = isRate && num >= 80 ? '#059669' : isRate && num < 60 ? '#C8102E' : '#1A3C8F';
                      return (
                        <div key={k}
                          className="relative overflow-hidden bg-gradient-to-br from-[#F8FAFF] to-white rounded-2xl p-4 border border-[#DDE3F0] hover:border-[#A0B0D0] hover:shadow-sm transition-all">
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: `${color}18` }}>
                            <Icon size={12} style={{ color }} />
                          </div>
                          <p className="text-2xl font-black mt-1" style={{ color }}>
                            {fmtNum(v)}{isRate && typeof v === 'number' ? '%' : ''}
                          </p>
                          <p className="text-[10px] text-[#8A97B0] font-black uppercase tracking-wider mt-2 leading-tight">
                            {toTitle(k)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* ══ TAB 2: PATIENT ANALYTICS ══════════════════════════════════ */}
      {activeTab === 'patients' && (
        <PatientAnalyticsWidget />
      )}

      {/* ══ TAB 3: QI QUERY BUILDER ════════════════════════════════════ */}
      {activeTab === 'queryBuilder' && (
        <div className="space-y-6">

          {/* Backend pagination badge */}
          <div className="flex items-center gap-2 text-xs text-[#8A97B0] font-semibold">
            <Database size={13} className="text-[#1A3C8F]" />
            <span>Backend-paginated · {totalElements > 0 ? `${totalElements} total records across ${totalPages} pages` : 'Loading...'}</span>
          </div>

          {/* Filter panel */}
          <div className="card relative z-30">
            <button onClick={toggleFilters}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-[#F0F4FC] bg-slate-50 hover:bg-[#F0F4FC] transition-colors rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-[#1A3C8F]" />
                <span className="text-sm font-bold text-[#0F1A3A]">Dynamic Query Filters</span>
                {(startDate || endDate || incidentTypeFilter || statusFilter || searchText) && (
                  <span className="ml-2 text-[10px] bg-[#1A3C8F] text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                )}
              </div>
              <ChevronDown size={16} className={`text-[#8A97B0] transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>

            {filtersOpen && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">Search Records</label>
                    <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Name, location, type..." className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input py-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">Incident Type</label>
                    <SearchableSelect value={incidentTypeFilter} onChange={onType} options={incidentTypeOptions} placeholder="All Types" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">Record Status</label>
                    <SearchableSelect value={statusFilter} onChange={onStatus} options={statusOptions} placeholder="All Statuses" />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-[#F0F4FC]">
                  <button onClick={resetFilters} className="btn-ghost border border-[#DDE3F0] rounded-xl px-4 py-2 text-xs">
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats — from backend aggregate */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={FileText}    label="Total Records"  loading={bsLoading}
              value={statsCards ? statsCards.total    : (totalElements || '—')} />
            <StatCard icon={Activity}    label="Reviewed"       loading={bsLoading}
              value={statsCards ? statsCards.reviewed : '—'}  color="text-[#059669]" />
            <StatCard icon={TrendingUp}  label="Avg QA Score"   loading={bsLoading}
              value={statsCards ? `${fmtNum(statsCards.avgScore)}%` : '—'} />
            <StatCard icon={CheckCircle} label="Pass Rate"      loading={bsLoading}
              value={statsCards ? `${fmtNum(statsCards.passRate)}%` : '—'}
              color={(statsCards?.passRate ?? 0) >= 80 ? 'text-[#059669]' : 'text-[#C8102E]'} />
            <StatCard icon={Layers}      label="Pending Review" loading={bsLoading}
              value={statsCards ? statsCards.pending  : '—'}  color="text-[#C8102E]" />
          </div>

          {/* Visualization — current page data */}
          <div className="card p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#EEF2FF] rounded-xl flex items-center justify-center">
                  <Settings size={15} className="text-[#1A3C8F]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0F1A3A]">Custom Visualization</p>
                  <p className="text-xs text-[#8A97B0]">Chart based on current page · {filteredData.length} records</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:min-w-[480px]">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider pl-0.5">X-Axis</span>
                  <SearchableSelect value={xDim} onChange={setXDim} options={X_OPTIONS} placeholder="Dimension" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider pl-0.5">Y-Axis</span>
                  <SearchableSelect value={yMetric} onChange={setYMetric} options={Y_OPTIONS} placeholder="Metric" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider pl-0.5">Chart Type</span>
                  <SearchableSelect value={chartType} onChange={setChartType} options={CHART_TYPE_OPTIONS} placeholder="Chart" />
                </div>
              </div>
            </div>
            <div className="h-[320px]">{chartNode}</div>
          </div>

          {/* Data table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F4FC] bg-slate-50 flex items-center justify-between">
              <p className="text-sm font-bold text-[#0F1A3A]">QA/QI Records</p>
              <p className="text-xs text-[#8A97B0] font-semibold">
                Page {page + 1} of {totalPages} · {filteredData.length} shown
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#F0F4FC]">
                    {TABLE_HEADERS.map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black text-[#8A97B0] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {builderLoading ? (
                    /* Shimmer skeleton rows while loading */
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-[#F8FAFF] animate-pulse">
                        {TABLE_HEADERS.map((h) => (
                          <td key={h} className="px-4 py-3">
                            <div className="h-3 bg-[#F0F4FC] rounded-full" style={{ width: `${55 + (i * 7 + h.length * 3) % 35}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredData.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-[#A0AECB]">No records match the current filters</td></tr>
                  ) : (
                    filteredData.map((row, i) => <TableRow key={row.id ?? i} row={row} />)
                  )}
                </tbody>
              </table>
            </div>

            {/* Backend pagination controls */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#F0F4FC] bg-slate-50">
              <button disabled={page === 0} onClick={goPrev}
                className="px-4 py-1.5 text-xs font-bold text-[#4B5A7A] border border-[#DDE3F0] rounded-lg hover:bg-white disabled:opacity-40 transition-colors">
                ← Previous
              </button>
              <div className="flex items-center gap-1">
                {/* Page number pills */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button key={p} onClick={() => { setPage(p); fetchPage(p); }}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${p === page ? 'bg-[#1A3C8F] text-white' : 'text-[#4B5A7A] hover:bg-[#F0F4FC]'}`}>
                      {p + 1}
                    </button>
                  );
                })}
              </div>
              <button disabled={page >= totalPages - 1} onClick={goNext}
                className="px-4 py-1.5 text-xs font-bold text-[#4B5A7A] border border-[#DDE3F0] rounded-lg hover:bg-white disabled:opacity-40 transition-colors">
                Next →
              </button>
            </div>
          </div>

          {/* Governance alerts */}
          {govAlerts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0F4FC] bg-slate-50 flex items-center gap-2">
                <AlertTriangle size={15} className="text-[#C8102E]" />
                <p className="text-sm font-bold text-[#0F1A3A]">Governance Alerts</p>
                <span className="ml-auto text-xs text-[#8A97B0]">{govAlerts.length} on this page</span>
              </div>
              <div className="divide-y divide-[#F0F4FC] max-h-64 overflow-y-auto">
                {govAlerts.map((item, i) => (
                  <div key={item.id ?? i} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${item.status === 'REJECTED' || item.qaScore < 60 ? 'bg-[#C8102E]' : 'bg-[#EA580C]'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0F1A3A]">
                        {item.status === 'REJECTED' ? 'ePCR Rejected' : `Low QA Score: ${item.qaScore}%`}
                        {' — '}
                        <span className="font-normal text-[#8A97B0]">{item.patientName}</span>
                      </p>
                      <p className="text-[10px] text-[#A0AECB] mt-0.5">
                        Paramedic: {item.paramedicsName} · {item.incidentDateTime ? new Date(item.incidentDateTime).toLocaleDateString() : '—'}
                        {item.feedback ? ` · "${item.feedback.slice(0, 60)}${item.feedback.length > 60 ? '…' : ''}"` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default Reports;
