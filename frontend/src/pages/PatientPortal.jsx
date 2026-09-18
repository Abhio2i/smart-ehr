import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  RefreshCw, X, Eye, FileEdit, Ban, History, User,
  AlertCircle, ChevronRight, Shield, Plus, Trash2,
  Clock, CheckCircle2, ShieldCheck, Fingerprint, ShieldAlert,
  ArrowLeft, Activity, Heart, ClipboardCheck, Lock, FileText, CreditCard,
  ChevronDown, TrendingUp, Droplets, Thermometer, Wind, ClipboardList,
  Pill, Stethoscope, Calendar, FlaskConical, HeartPulse, Check, BedDouble, Tag, CalendarDays, UserRound, ExternalLink, MapPin, CloudLightning, Zap, Users, MessageSquare, Bot, Sparkles, Plane, Home, Paperclip, Contrast, ZoomIn
} from 'lucide-react';
import PatientChatbot from '../components/common/PatientChatbot';
import PatientPaymentModal from '../components/billing/PatientPaymentModal';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceArea,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { addToast } from '../store/slices/uiSlice';
import {
  fetchPortalData, createAmendment, createRestriction,
  selectPortalRecords, selectPortalAmendments, selectPortalRestrictions,
  selectPortalDisclosures, selectPortalLoading,
  selectPortalAppointments, selectPortalTravelBundles
} from '../store/slices/patientPortalSlice';
import {
  createDocument,
  deleteDocument,
  fetchAllPatientHistory,
  selectAdmissions,
  selectConditions,
  selectDocuments,
  selectEncounters,
  selectHistoryLoading,
  selectHistorySummary,
  selectLabResults,
  selectMedications,
  selectTimeline,
  selectVitals
} from '../store/slices/patientHistorySlice';
import client from '../api/client';
import AuditLogs from './AuditLogs';
import { getPatientClaims } from '../api/billingApi';


const asList = d => Array.isArray(d) ? d : (d?.content ?? []);

const parseNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const pickNumber = (data, keys, fallback = null) => {
  for (const key of keys) {
    const value = parseNumber(data?.[key]);
    if (value !== null) return value;
  }
  return fallback;
};

const parseBloodPressure = data => {
  const raw = data?.bloodPressure || data?.bp || data?.bloodPressureReading;
  if (typeof raw === 'string') {
    const values = raw.match(/\d+(\.\d+)?/g)?.map(Number) || [];
    if (values.length >= 2) return { systolic: values[0], diastolic: values[1], label: `${values[0]}/${values[1]}` };
  }

  const systolic = pickNumber(data, ['vitalsSystolic', 'systolicBp', 'systolicBP', 'systolic', 'bpSystolic'], null);
  const diastolic = pickNumber(data, ['vitalsDiastolic', 'diastolicBp', 'diastolicBP', 'diastolic', 'bpDiastolic'], null);
  const label = (systolic !== null && diastolic !== null) ? `${systolic}/${diastolic}` : 'N/A';
  return { systolic, diastolic, label };
};

const buildVitals = data => {
  const bp = parseBloodPressure(data);
  const heartRate = pickNumber(data, ['vitalsPulse', 'heartRate', 'pulseRate', 'pulse'], null);
  const temperature = pickNumber(data, ['vitalsTemp', 'temperature', 'bodyTemperature', 'temp'], null);
  const spo2 = pickNumber(data, ['vitalsSpo2', 'spo2', 'spO2', 'oxygenSaturation', 'o2Saturation'], null);
  const respiratoryRate = pickNumber(data, ['vitalsRespiratory', 'respiratoryRate', 'respirationRate', 'respRate'], null);
  const bloodSugar = pickNumber(data, ['vitalsBloodSugar', 'bloodSugar', 'glucose', 'bloodGlucose'], null);
  const etco2 = pickNumber(data, ['vitalsEtco2', 'etco2', 'endTidalCo2'], null);
  const gcs = pickNumber(data, ['vitalsGcs', 'gcs', 'glasgowComaScale'], null);
  const height = pickNumber(data, ['height', 'patientHeight'], null);
  const weight = pickNumber(data, ['weight', 'patientWeight'], null);

  return { ...bp, heartRate, temperature, spo2, respiratoryRate, bloodSugar, etco2, gcs, height, weight };
};

const makeTrend = vitals => {
  const points = [
    ['-30m', -5, -3, -0.4, -1, 1, -2, -1, 0],
    ['-24m', -2, -1, -0.1, 0, -1, 1, 0, 0],
    ['-18m', 3, 2, 0.2, -1, 0, 0, 3, -1],
    ['-12m', -1, 1, 0.1, 1, 1, 2, -2, 0],
    ['-6m', 2, -2, -0.2, 0, 0, -1, 1, 0],
    ['Now', 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  return points.map(([time, hr, bp, temp, spo2, rr, etco2, glucose, gcs]) => ({
    time,
    heartRate: vitals.heartRate === null ? null : Math.max(35, Math.round(vitals.heartRate + hr)),
    systolic: vitals.systolic === null ? null : Math.max(70, Math.round(vitals.systolic + bp)),
    diastolic: vitals.diastolic === null ? null : Math.max(40, Math.round(vitals.diastolic + bp / 2)),
    temperature: vitals.temperature === null ? null : Number((vitals.temperature + temp).toFixed(1)),
    spo2: vitals.spo2 === null ? null : Math.min(100, Math.max(70, Math.round(vitals.spo2 + spo2))),
    respiratoryRate: vitals.respiratoryRate === null ? null : Math.max(6, Math.round(vitals.respiratoryRate + rr)),
    etco2: vitals.etco2 === null ? null : Math.max(5, Math.round(vitals.etco2 + etco2)),
    bloodSugar: vitals.bloodSugar === null ? null : Math.max(30, Math.round(vitals.bloodSugar + glucose)),
    gcs: vitals.gcs === null ? null : Math.min(15, Math.max(3, Math.round(vitals.gcs + gcs))),
  }));
};

// Animated pulse indicator
const PulseIndicator = ({ value, max, color = '#C8102E' }) => {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(prev => (prev + 1) % 100);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const percentage = (value / max) * 100;

  return (
    <div className="space-y-2">
      <div className="relative w-full h-8 bg-[#F0F4FC] rounded-full overflow-hidden border border-[#DDE3F0]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: color,
            opacity: 0.6,
          }}
        />
        <div
          className="absolute h-full rounded-full"
          style={{
            width: `${percentage}%`,
            background: color,
            opacity: 1 - pulse / 100,
          }}
        />
      </div>
      <p className="text-xs text-[#A0AECB] text-center">{percentage.toFixed(0)}% Normal</p>
    </div>
  );
};

// Heartbeat pulse component
const HeartbeatPulse = ({ bpm }) => {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (bpm === null || bpm === undefined || bpm === 'N/A') return;
    const interval = setInterval(() => {
      setBeat(prev => (prev + 1) % 100);
    }, 60);
    return () => clearInterval(interval);
  }, [bpm]);

  if (bpm === null || bpm === undefined || bpm === 'N/A') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
          N/A
        </div>
        <p className="text-sm font-bold text-[#8A97B0]">No Pulse Data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#DDE3F0" strokeWidth="1" />
          <circle
            cx="50"
            cy="50"
            r={35 + Math.sin((beat / 100) * Math.PI * 2) * 3}
            fill="none"
            stroke="#C8102E"
            strokeWidth="2"
            opacity={1 - beat / 100}
          />
          <circle cx="50" cy="50" r="8" fill="#C8102E" />
        </svg>
      </div>
      <p className="text-sm font-bold text-[#4B5A7A]">{bpm} <span className="text-xs text-[#A0AECB]">BPM</span></p>
    </div>
  );
};

const VitalTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur border border-[#DDE3F0] shadow-xl rounded-xl p-3">
      <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider mb-2">{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs font-bold text-[#4B5A7A]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}: {entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, unit, range, color, bgColor, children }) => {
  const hasValue = value !== null && value !== undefined && value !== 'N/A';
  return (
    <div className="card p-5 space-y-4 border border-[#DDE3F0]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgColor, color }}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider truncate">{label}</p>
            <p className="text-2xl font-black text-[#0F1A3A] tabular-nums">
              {hasValue ? value : 'N/A'} {hasValue && <span className="text-sm text-[#8A97B0]">{unit}</span>}
            </p>
          </div>
        </div>
      </div>
      <div className="h-24">
        {children}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[#A0AECB]">{range}</p>
        <span className={hasValue ? "badge badge-green" : "badge badge-gray"}>
          {hasValue ? "Live" : "No Data"}
        </span>
      </div>
    </div>
  );
};

// Vital signs summary cards
const VitalCard = ({ icon: Icon, label, value, unit, bgColor = '#EEF2FF', iconColor = '#1A3C8F' }) => (
  <div className="flex items-center gap-3 p-3 bg-[#F8FAFF] rounded-lg border border-[#DDE3F0]">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgColor, color: iconColor }}>
      <Icon size={18} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-[#A0AECB] font-semibold uppercase">{label}</p>
      <p className="text-sm font-bold text-[#0F1A3A]">{value} <span className="text-xs text-[#8A97B0]">{unit}</span></p>
    </div>
  </div>
);


/* ────────────────── Vitals: constants & helpers ────────────────── */

const VITAL_METRICS = [
  { key: 'systolicBP', label: 'Systolic BP', short: 'BP Sys', unit: 'mmHg', color: '#C8102E', lo: 90, hi: 140 },
  { key: 'diastolicBP', label: 'Diastolic BP', short: 'BP Dia', unit: 'mmHg', color: '#E8476E', lo: 60, hi: 90 },
  { key: 'heartRate', label: 'Heart Rate', short: 'HR', unit: 'bpm', color: '#7C3AED', lo: 60, hi: 100 },
  { key: 'oxygenSaturation', label: 'SpO₂', short: 'SpO₂', unit: '%', color: '#059669', lo: 95, hi: 100 },
  { key: 'respiratoryRate', label: 'Resp Rate', short: 'RR', unit: '/min', color: '#0891B2', lo: 12, hi: 20 },
  { key: 'temperature', label: 'Temperature', short: 'Temp', unit: '°C', color: '#EA580C', lo: 36.1, hi: 37.2 },
  { key: 'bloodGlucose', label: 'Blood Glucose', short: 'Glucose', unit: 'mg/dL', color: '#CA8A04', lo: 70, hi: 100 },
  { key: 'glasgowComaScale', label: 'GCS', short: 'GCS', unit: '/15', color: '#1A3C8F', lo: 14, hi: 15 },
  { key: 'painScore', label: 'Pain Score', short: 'Pain', unit: '/10', color: '#DC2626', lo: 0, hi: 3 },
];

const metricByKey = Object.fromEntries(VITAL_METRICS.map((m) => [m.key, m]));

const assessVitalStatus = (v) => {
  const crit = [
    v.systolicBP != null && (v.systolicBP > 180 || v.systolicBP < 80),
    v.diastolicBP != null && (v.diastolicBP > 120 || v.diastolicBP < 50),
    v.heartRate != null && (v.heartRate > 150 || v.heartRate < 40),
    v.oxygenSaturation != null && v.oxygenSaturation < 88,
    v.respiratoryRate != null && (v.respiratoryRate > 30 || v.respiratoryRate < 8),
    v.temperature != null && (v.temperature > 39.5 || v.temperature < 35),
  ];
  if (crit.some(Boolean)) return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' };
  const warn = [
    v.systolicBP != null && (v.systolicBP > 140 || v.systolicBP < 90),
    v.diastolicBP != null && (v.diastolicBP > 90 || v.diastolicBP < 60),
    v.heartRate != null && (v.heartRate > 100 || v.heartRate < 60),
    v.oxygenSaturation != null && v.oxygenSaturation < 95,
    v.respiratoryRate != null && (v.respiratoryRate > 20 || v.respiratoryRate < 12),
    v.temperature != null && (v.temperature > 37.2 || v.temperature < 36.1),
  ];
  if (warn.some(Boolean)) return { label: 'Monitor', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'Normal', cls: 'bg-green-100 text-green-700 border-green-200' };
};

const vitalPill = (value, metric) => {
  if (value == null || value === '') return null;
  const m = typeof metric === 'string' ? metricByKey[metric] : metric;
  if (!m) return null;
  const num = Number(value);
  const outOfRange = !isNaN(num) && (num < m.lo || num > m.hi);
  return (
    <span key={m.key} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border ${outOfRange ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-[#F0F4FC] text-[#0F1A3A] border-[#DDE3F0]'}`}>
      <span className="text-[10px] font-black text-[#8A97B0] uppercase">{m.short}</span>
      {value}{m.unit ? <span className="text-[10px] text-[#A0AECB] ml-0.5">{m.unit}</span> : null}
    </span>
  );
};

const TIME_FILTERS = [
  { key: 'all', label: 'All' },
  { key: '24h', label: '24 h', ms: 86400000 },
  { key: '7d', label: '7 days', ms: 604800000 },
  { key: '30d', label: '30 days', ms: 2592000000 },
];

const formatChartTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}\n${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

/* ────────────────── VitalsPortalTab component ────────────────── */

function VitalsPortalTab({ vitals, onView }) {
  const [subTab, setSubTab] = useState('chart');
  const [timeFilter, setTimeFilter] = useState('all');
  const [primaryMetric, setPrimaryMetric] = useState('systolicBP');
  const [compareMetrics, setCompareMetrics] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const filtered = useMemo(() => {
    let list = [...vitals];
    if (timeFilter !== 'all') {
      const cutoff = Date.now() - TIME_FILTERS.find((f) => f.key === timeFilter)?.ms;
      list = list.filter((v) => new Date(v.recordedAt || v.createdAt).getTime() >= cutoff);
    }
    return list;
  }, [vitals, timeFilter]);

  const historyList = useMemo(() => [...filtered].sort((a, b) => new Date(b.recordedAt || b.createdAt) - new Date(a.recordedAt || a.createdAt)), [filtered]);
  const chartData = useMemo(() => [...filtered].sort((a, b) => new Date(a.recordedAt || a.createdAt) - new Date(b.recordedAt || b.createdAt)).map((v) => ({
    ...v,
    time: new Date(v.recordedAt || v.createdAt).getTime(),
    label: formatChartTime(v.recordedAt || v.createdAt),
  })), [filtered]);

  const toggleCompare = useCallback((key) => {
    setCompareMetrics((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : prev.length < 3 ? [...prev, key] : prev);
  }, []);

  const activeChartMetrics = useMemo(() => {
    const keys = [primaryMetric, ...(showCompare ? compareMetrics : [])];
    return [...new Set(keys)].map((k) => metricByKey[k]).filter(Boolean);
  }, [primaryMetric, compareMetrics, showCompare]);

  const latest = chartData[chartData.length - 1] || {};

  return (
    <div className="space-y-6">
      {/* Sub-tab toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex rounded-xl border border-[#DDE3F0] bg-white overflow-hidden">
          {[['history', 'Reading History', Clock], ['chart', 'Trend Chart', TrendingUp]].map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setSubTab(id)} className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold transition ${subTab === id ? 'bg-brand-blue text-white' : 'text-[#4B5A7A] hover:bg-[#F8FAFF]'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-[#DDE3F0] bg-white overflow-hidden">
          {TIME_FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setTimeFilter(f.key)} className={`px-4 py-2 text-xs font-bold transition ${timeFilter === f.key ? 'bg-[#0F1A3A] text-white' : 'text-[#4B5A7A] hover:bg-[#F8FAFF]'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center bg-[#F8FAFF] rounded-2xl border border-dashed border-[#DDE3F0]">
           <Activity className="w-12 h-12 mx-auto mb-3 text-[#DDE3F0]" />
           <p className="text-sm font-bold text-[#8A97B0]">No vital readings recorded{timeFilter !== 'all' ? ` in the selected time range` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary Metric Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricCard 
              icon={HeartPulse} label="Heart Rate" 
              value={latest.heartRate} unit="bpm" 
              range="Latest Reading" color="#C8102E" bgColor="#FEE2E2"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrGradPortal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C8102E" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C8102E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="heartRate" stroke="#C8102E" strokeWidth={2} fill="url(#hrGradPortal)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </MetricCard>

            <MetricCard 
              icon={Activity} label="Blood Pressure" 
              value={latest.systolicBP ? `${latest.systolicBP}/${latest.diastolicBP}` : 'N/A'} unit="mmHg" 
              range="Latest Reading" color="#1A3C8F" bgColor="#DBEAFE"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <Line type="monotone" dataKey="systolicBP" stroke="#1A3C8F" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="diastolicBP" stroke="#60A5FA" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </MetricCard>

            <MetricCard 
              icon={Activity} label="SpO₂" 
              value={latest.oxygenSaturation} unit="%" 
              range="Latest Reading" color="#059669" bgColor="#D1FAE5"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spo2GradPortal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="oxygenSaturation" stroke="#059669" strokeWidth={2} fill="url(#spo2GradPortal)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </MetricCard>
          </div>

          <div className="border-t border-[#F0F4FC] pt-8">
            {subTab === 'history' ? (
              /* ── Reading History ── */
              <div className="grid grid-cols-1 gap-4">
                {historyList.map((v, idx) => {
                  const status = assessVitalStatus(v);
                  const ts = v.recordedAt || v.createdAt;
                  return (
                    <div key={v.id || idx} className="group relative bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-blue/5 hover:border-brand-blue/30 transition-all cursor-default">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          {/* Time & status */}
                          <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="text-sm font-black text-[#0F1A3A] bg-[#F8FAFF] px-3 py-1.5 rounded-lg border border-[#EEF2FF]">
                              {ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </span>
                            <span className="text-xs font-bold text-[#8A97B0]">{new Date(ts).toLocaleDateString()}</span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status.cls}`}>{status.label}</span>
                            {v.source && <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md">{v.source}</span>}
                          </div>
                          {/* Primary vitals row */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {v.systolicBP != null && v.diastolicBP != null && (
                              <span className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border ${(v.systolicBP > 140 || v.systolicBP < 90 || v.diastolicBP > 90 || v.diastolicBP < 60) ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-[#F0F4FC] text-[#0F1A3A] border-[#DDE3F0]'}`}>
                                <span className="text-[10px] font-black text-[#8A97B0] uppercase">Blood Pressure</span>
                                <span className="text-sm">{v.systolicBP}/{v.diastolicBP}</span>
                                <span className="text-[10px] text-[#A0AECB] ml-0.5">mmHg</span>
                              </span>
                            )}
                            {vitalPill(v.heartRate, 'heartRate')}
                            {vitalPill(v.oxygenSaturation, 'oxygenSaturation')}
                            {vitalPill(v.respiratoryRate, 'respiratoryRate')}
                            {vitalPill(v.temperature, 'temperature')}
                          </div>
                          {/* Secondary vitals row */}
                          <div className="flex flex-wrap gap-2">
                            {vitalPill(v.glasgowComaScale, 'glasgowComaScale')}
                            {vitalPill(v.bloodGlucose, 'bloodGlucose')}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onView?.(v, 'VITAL')}
                            className="w-10 h-10 rounded-xl bg-white border border-[#DDE3F0] flex items-center justify-center text-[#8A97B0] hover:bg-[#F8FAFF] hover:text-brand-red transition-all"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── Trend Chart ── */
              <div className="bg-white rounded-3xl border border-[#DDE3F0] p-8 shadow-sm">
                {/* Chart controls */}
                <div className="flex flex-wrap items-end gap-6 mb-8">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-3 block">Primary Metric</label>
                    <div className="flex flex-wrap gap-2">
                      {VITAL_METRICS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPrimaryMetric(m.key)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${primaryMetric === m.key ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-blue-900/20' : 'bg-white text-[#4B5A7A] border-[#DDE3F0] hover:border-brand-blue/30'}`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCompare(!showCompare)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all border ${showCompare ? 'bg-[#0F1A3A] text-white border-[#0F1A3A]' : 'bg-white text-[#4B5A7A] border-[#DDE3F0]'}`}
                    >
                      <TrendingUp size={14} /> {showCompare ? 'Hide Comparison' : 'Compare Metrics'}
                    </button>
                  </div>
                </div>

                {showCompare && (
                  <div className="mb-8 p-6 bg-[#F8FAFF] rounded-2xl border border-[#EEF2FF] animate-in zoom-in-95 duration-200">
                    <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-4">Select up to 2 metrics to compare</p>
                    <div className="flex flex-wrap gap-3">
                      {VITAL_METRICS.filter((m) => m.key !== primaryMetric).map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => toggleCompare(m.key)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${compareMetrics.includes(m.key) ? 'bg-white border-brand-blue text-brand-blue shadow-sm' : 'bg-white border-[#DDE3F0] text-[#8A97B0] hover:border-brand-blue/30'}`}
                        >
                          {compareMetrics.includes(m.key) && <Check size={12} className="inline mr-1" />}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main trend chart */}
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        {activeChartMetrics.map((m) => (
                          <linearGradient key={`grad-${m.key}`} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={m.color} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A0AECB' }} height={50} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A0AECB' }} />
                      <Tooltip content={<VitalTooltip />} />
                      {activeChartMetrics.map((m) => (
                        <Area
                          key={m.key}
                          type="monotone"
                          dataKey={m.key}
                          name={m.label}
                          stroke={m.color}
                          strokeWidth={3}
                          fill={`url(#grad-${m.key})`}
                          dot={{ r: 4, fill: m.color, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                          connectNulls
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const formatLabel = key => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());


const isEmptyValue = value => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const displayValue = value => {
  if (isEmptyValue(value)) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString();
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? Object.values(item).filter(Boolean).join(' - ') : String(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value).filter(([, v]) => !isEmptyValue(v)).map(([k, v]) => `${formatLabel(k)}: ${displayValue(v)}`).join(', ') || 'N/A';
  return String(value);
};

const getPathValue = (data, path) => path.split('.').reduce((value, part) => value?.[part], data);

const fieldConfig = field => typeof field === 'string' ? { path: field, label: formatLabel(field) } : field;

const topLevelField = field => fieldConfig(field).path.split('.')[0];

const CardField = ({ label, value }) => (
  <div className="min-w-0 rounded-lg border border-[#DDE3F0] bg-[#F8FAFF] p-3">
    <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-sm font-bold break-words ${isEmptyValue(value) ? 'text-[#A0AECB] italic' : 'text-[#0F1A3A]'}`}>
      {displayValue(value)}
    </p>
  </div>
);

const ActivityHistoryField = ({ value }) => (
  <div className="min-w-0 rounded-lg border border-[#DDE3F0] bg-[#F8FAFF] p-3 sm:col-span-2">
    <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider mb-2">Activity History</p>
    {Array.isArray(value) && value.length > 0 ? (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={`${item?.timestamp || index}-${item?.action || 'activity'}`} className="flex items-start gap-2 text-sm font-bold text-[#0F1A3A]">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-blue shrink-0" />
            <div>
              <p>{item?.action ? formatLabel(String(item.action).toLowerCase()) : 'Updated'}{item?.notes ? ` - ${item.notes}` : ''}</p>
              <p className="text-xs text-[#8A97B0] font-semibold mt-0.5">
                {[item?.performedByName || 'Clinical team', item?.timestamp ? new Date(item.timestamp).toLocaleString() : null].filter(Boolean).join(' • ')}
              </p>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm font-bold text-[#A0AECB] italic">No activity recorded</p>
    )}
  </div>
);

const DetailMetricCard = ({ icon: Icon, label, value, unit, color, bgColor, children }) => (
  <div className="card p-4 border border-[#DDE3F0] space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: bgColor, color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider truncate">{label}</p>
        <p className="text-lg font-black text-[#0F1A3A] tabular-nums truncate">
          {value ?? 'N/A'} <span className="text-xs text-[#8A97B0]">{unit}</span>
        </p>
      </div>
    </div>
    {children && <div className="h-16">{children}</div>}
  </div>
);

const RECORD_CARD_SECTIONS = [
  {
    title: 'Patient Info',
    icon: User,
    color: '#1A3C8F',
    bgColor: '#DBEAFE',
    fields: ['patientName', 'patientId', 'patientDateOfBirth', 'patientGender', 'age', 'email', 'patientPhone', 'patientSsnLast4', 'patientSSNLast4', 'patientAddress'],
  },
  {
    title: 'Medical History',
    icon: FileText,
    color: '#7C3AED',
    bgColor: '#F3E8FF',
    fields: [
      'comorbidity', { path: 'medicalHistory.pastConditions', label: 'Past Conditions' },
      'currentMedicines', { path: 'medicalHistory.currentMedications', label: 'Current Medications' },
      'allergy', { path: 'medicalHistory.allergies', label: 'Allergies' },
      'doctor', 'surgicalHistory', { path: 'medicalHistory.surgicalHistory', label: 'Surgical History' },
      'primaryPhysicianName', { path: 'medicalHistory.primaryPhysicianName', label: 'Primary Physician' },
      'primaryPhysicianContact', { path: 'medicalHistory.primaryPhysicianContact', label: 'Physician Contact' },
      'primaryPhysicianFacility', { path: 'medicalHistory.primaryPhysicianFacility', label: 'Physician Facility' },
      'dnrOnFile', { path: 'medicalHistory.dnrOnFile', label: 'DNR On File' },
      'advanceDirective', { path: 'medicalHistory.advanceDirective', label: 'Advance Directive' },
      'advanceDirectiveType', { path: 'medicalHistory.advanceDirectiveType', label: 'Directive Type' },
      'smoker', { path: 'medicalHistory.smoker', label: 'Smoker' },
      'alcoholUse', { path: 'medicalHistory.alcoholUse', label: 'Alcohol Use' },
      'substanceUse', { path: 'medicalHistory.substanceUse', label: 'Substance Use' },
      'substanceUseDetails', { path: 'medicalHistory.substanceUseDetails', label: 'Substance Details' },
      'pregnant', { path: 'medicalHistory.pregnant', label: 'Pregnant' },
      'gestationalWeekIfPregnant', { path: 'medicalHistory.gestationalWeekIfPregnant', label: 'Gestational Week' },
      'lastKnownWellDateTime', { path: 'medicalHistory.lastKnownWellDateTime', label: 'Last Known Well' },
      'lastOralIntake', { path: 'medicalHistory.lastOralIntake', label: 'Last Oral Intake' },
    ],
  },

  {
    title: 'Assessment',
    icon: ClipboardCheck,
    color: '#059669',
    bgColor: '#D1FAE5',
    fields: [
      'complaints', 'structuredComplaints', 'structuredVitals', 'vitals', 'diastolicBp', 'systolicBp', 'hemoglobin',
      'treatmentProvided', 'treatmentPlan', 'icd10Code', 'primaryImpression', 'secondaryImpression',
      'mentalStatus', 'diagnosticFindings', 'proceduresPerformed', 'structuredProcedures',
      'medicationsAdministered', 'treatmentOutcome', 'careLevelProvided',
      'structuredMedications', 'fluidsAdministered', 'airwayManaged', 'clinicalData', 'assessmentType', 'physicalExam', 'diagnosis',
    ],
  },
  {
    title: 'Care',
    icon: ShieldCheck,
    color: '#EA580C',
    bgColor: '#FFEDD5',
    fields: [
      'destinationFacility', 'destination', 'transportDestination', 'transportMode',
      { path: 'transport.transportMode', label: 'Transport Mode' },
      { path: 'transport.destinationName', label: 'Destination' },
      { path: 'transport.careLevel', label: 'Care Level' },
      { path: 'transport.hospitalNotified', label: 'Hospital Notified' },
      { path: 'transport.handoffReport', label: 'Handoff Report' },
      'triageCategory', 'careLevel', 'treatmentProvider', 'status',
    ],
  },
  {
    title: 'Timeline',
    icon: Clock,
    color: '#475569',
    bgColor: '#E2E8F0',
    fields: [
      'callReceivedAt', { path: 'timeline.callReceivedAt', label: 'Call Received' },
      { path: 'timeline.dispatchedAt', label: 'Dispatched' },
      { path: 'timeline.enRouteAt', label: 'En Route' },
      'arrivedSceneAt', { path: 'timeline.arrivedSceneAt', label: 'Arrived Scene' },
      { path: 'timeline.patientContactAt', label: 'Patient Contact' },
      'departedSceneAt', { path: 'timeline.departedSceneAt', label: 'Departed Scene' },
      'arrivedDestinationAt', { path: 'timeline.arrivedDestinationAt', label: 'Arrived Destination' },
      'transferOfCareAt', { path: 'timeline.transferOfCareAt', label: 'Transfer Of Care' },
      { path: 'timeline.responseTimeMinutes', label: 'Response Time' },
      { path: 'timeline.sceneTimeMinutes', label: 'Scene Time' },
      { path: 'timeline.transportTimeMinutes', label: 'Transport Time' },
    ],
  },
  {
    title: 'Consent',
    icon: Shield,
    color: '#0891B2',
    bgColor: '#CFFAFE',
    fields: [
      { path: 'consent.patientConsentObtained', label: 'Patient Consent' },
      { path: 'consent.consentType', label: 'Consent Type' },
      { path: 'consent.refusalOfCare', label: 'Refusal Of Care' },
      { path: 'consent.refusalReason', label: 'Refusal Reason' },
      { path: 'consent.patientInformedOfRisks', label: 'Informed Of Risks' },
      { path: 'consent.patientHasDecisionCapacity', label: 'Decision Capacity' },
      { path: 'consent.guardianConsentObtained', label: 'Guardian Consent' },
      { path: 'consent.guardianName', label: 'Guardian Name' },
      { path: 'consent.guardianRelationship', label: 'Guardian Relationship' },
      { path: 'consent.guardianPhone', label: 'Guardian Phone' },
    ],
  },
  {
    title: 'Record Admin',
    icon: Fingerprint,
    color: '#475569',
    bgColor: '#E2E8F0',
    fields: [
      'createdAt', 'updatedAt', 'submittedAt',
      'submittedByName', 'submittedBy',
      'qaApproved', 'qaApprovedAt', 'qaApprovedBy',
      'organizationId',
      { path: 'dynamicFormResponses.organizationName', label: 'Organization' },
      { path: 'dynamicFormResponses.submittedByName', label: 'Submitted By Name' },
      { path: 'dynamicFormResponses.qaApprovedByName', label: 'Approved By Name' },
      { path: 'dynamicFormResponses.paramedicsName', label: 'Paramedic Name' },
      'feedback',
      { path: 'auditTrail', label: 'Activity History', type: 'activity' },
    ],
  },
];

const VITAL_PRESENTED_FIELDS = [
  'bloodPressure', 'heartRate', 'pulseRate', 'pulse', 'respiratoryRate', 'respirationRate',
  'temperature', 'bodyTemperature', 'temp', 'spo2', 'spO2', 'oxygenSaturation', 'o2Saturation',
  'bloodGroup', 'height', 'weight', 'vitalsSystolic', 'vitalsDiastolic', 'vitalsPulse',
  'vitalsRespiratory', 'vitalsSpo2', 'vitalsTemp', 'vitalsEtco2', 'vitalsBloodSugar',
  'vitalsGcs', 'bloodSugar', 'glucose', 'bloodGlucose', 'etco2', 'gcs', 'ecgRhythm',
  'pupilsResponse', 'skinCondition', 'oxygenFlowRate', 'ivAccessSite', 'vitals',
  'diastolicBp', 'systolicBp', 'hemoglobin', 'structuredVitals',
];

const PRESENTED_RECORD_FIELDS = new Set([
  ...VITAL_PRESENTED_FIELDS,
  ...RECORD_CARD_SECTIONS.flatMap(section => section.fields.map(topLevelField)),
  'medicalHistory', 'sceneAssessment', 'timeline', 'transport', 'consent', 'dynamicFormResponses', 'auditTrail',
  'crew', 'attachmentIds', 'patientId',
]);

/* ── Crew Member Card ── */
const CrewMemberCard = ({ member }) => {
  if (!member || typeof member !== 'object') return null;
  const name = member.name || member.paramedicsName || 'Unknown';
  const role = member.role || 'Crew Member';
  const level = member.certificationLevel || '';
  const certNum = member.certificationNumber || '';
  const expiry = member.certificationExpiryDate || '';
  const isPrimary = member.primaryClinician;

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${isPrimary ? 'border-brand-blue/40 bg-blue-50/50' : 'border-[#DDE3F0] bg-[#F8FAFF]'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isPrimary ? 'bg-brand-blue text-white' : 'bg-[#E2E8F0] text-[#475569]'}`}>
            <Stethoscope size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-[#0F1A3A] truncate">{name}</p>
            <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider">{role}</p>
          </div>
        </div>
        {isPrimary && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider bg-brand-blue text-white px-2 py-1 rounded-lg">Primary</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-1">
        {level && <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-[#DDE3F0] rounded text-[#4B5A7A]">{level}</span>}
        {certNum && <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-[#DDE3F0] rounded text-[#4B5A7A] font-mono">{certNum}</span>}
        {expiry && <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-[#DDE3F0] rounded text-[#8A97B0]">Exp: {new Date(expiry).toLocaleDateString()}</span>}
      </div>
    </div>
  );
};

/* ── Crew Section ── */
const CrewSection = ({ data }) => {
  const crew = data?.crew;
  if (!Array.isArray(crew) || crew.length === 0) return null;

  return (
    <div className="card p-5 border border-[#DDE3F0] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#F3E8FF] text-[#7C3AED]">
            <Stethoscope size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider">Crew</h3>
            <p className="text-xs text-[#8A97B0] mt-0.5">{crew.length} member{crew.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <span className="badge badge-blue">Card</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {crew.map((member, i) => <CrewMemberCard key={member.paramedicsId || i} member={member} />)}
      </div>
    </div>
  );
};

/* ── Attachment IDs Badge List ── */
/* ── Attachment IDs & Images Section ── */
const AttachmentsSection = ({ data, onView }) => {
  const ids = data?.attachmentIds || [];
  const photo = data?.patientPhotoUrl;
  const xray = data?.xrayUrl;
  if (ids.length === 0 && !photo && !xray) return null;

  return (
    <div className="card p-5 border border-[#DDE3F0] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#DBEAFE] text-[#1A3C8F]">
            <Paperclip size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider">Clinical Attachments & Scans</h3>
            <p className="text-xs text-[#8A97B0] mt-0.5">{ids.length + (photo ? 1 : 0) + (xray ? 1 : 0)} items linked</p>
          </div>
        </div>
        <span className="badge badge-blue font-bold">Media</span>
      </div>

      {(photo || xray) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {photo && (
            <div className="rounded-2xl border border-[#DDE3F0] p-3 bg-[#F8FAFF] flex items-center gap-3">
              <img src={photo} alt="Patient Clinical Recognition" className="w-14 h-14 rounded-xl object-cover border border-[#DDE3F0] bg-white shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-brand-blue uppercase tracking-wider block">📷 Patient Photo</span>
                <p className="text-xs font-bold text-[#0F1A3A] truncate">Clinical Recognition Image</p>
              </div>
            </div>
          )}
          {xray && (
            <div className="rounded-2xl border border-[#DDE3F0] p-3 bg-[#F8FAFF] flex items-center gap-3">
              <img src={xray} alt="X-Ray Scan" className="w-14 h-14 rounded-xl object-cover border border-[#DDE3F0] bg-slate-900 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider block">🩻 X-Ray Scan</span>
                <p className="text-xs font-bold text-[#0F1A3A] truncate">Radiological Imaging</p>
              </div>
            </div>
          )}
        </div>
      )}

      {ids.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {ids.map((id, i) => (
            <button 
              key={i} 
              type="button"
              onClick={() => onView && onView(data?.patientId || data?.patient?.id, id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F8FAFF] border border-[#DDE3F0] px-3 py-1.5 text-xs font-bold text-[#4B5A7A] font-mono hover:text-brand-blue hover:border-brand-blue transition-colors shadow-sm cursor-pointer"
            >
              <FileText size={12} className="text-[#A0AECB]" />
              {String(id)}
              <ExternalLink size={12} className="ml-1 opacity-50" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Medical Documents & Radiology / X-Ray Gallery Component ── */
const PatientDocumentGallery = ({ documents = [], records = [], patientId, onViewDocument }) => {
  const [filter, setFilter] = useState('ALL');
  const [activeLightbox, setActiveLightbox] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [contrastInverted, setContrastInverted] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [failedImageIds, setFailedImageIds] = useState(new Set());

  const handleImageError = useCallback((id) => {
    setFailedImageIds(prev => new Set(prev).add(id));
  }, []);

  const isValidPublicUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/') || url.startsWith('/api/');
  }, []);

  const isImageFile = useCallback((media) => {
    if (!media) return false;
    if (media.isImage) return true;
    const str = `${media.url || ''} ${media.title || ''} ${media.docId || ''}`.toLowerCase();
    return str.includes('.jpg') || str.includes('.jpeg') || str.includes('.png') || str.includes('.webp') || str.includes('.gif') || str.includes('.svg') || str.includes('data:image/');
  }, []);

  // Consolidate documents from history documents + ePCR attachment records
  const allMedia = useMemo(() => {
    const list = [];
    const seenIds = new Set();

    // 1. Add records' patientPhotoUrl and xrayUrl
    (records || []).forEach(r => {
      if (r.patientPhotoUrl) {
        const id = `photo-${r.id}`;
        seenIds.add(id);
        list.push({
          id,
          title: `Clinical Recognition Photo`,
          subtitle: `Incident #${safeUpperId(r.incidentNumber || r.id, 10)}`,
          url: r.patientPhotoUrl,
          type: 'CLINICAL_PHOTO',
          category: 'PHOTO',
          date: r.incidentDateTime || r.createdAt,
          facility: r.incidentLocation || 'Clinical Facility',
          isImage: true
        });
      }
      if (r.xrayUrl) {
        const id = `xray-${r.id}`;
        seenIds.add(id);
        list.push({
          id,
          title: `X-Ray / Radiological Scan`,
          subtitle: `Incident #${safeUpperId(r.incidentNumber || r.id, 10)}`,
          url: r.xrayUrl,
          type: 'X_RAY',
          category: 'XRAY',
          date: r.incidentDateTime || r.createdAt,
          facility: r.incidentLocation || 'Radiology Department',
          isImage: true
        });
      }
      if (Array.isArray(r.attachmentIds)) {
        r.attachmentIds.forEach((attId, idx) => {
          const attStr = String(attId);
          const id = `att-${r.id}-${idx}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            const isImg = attStr.match(/\.(png|jpe?g|webp|gif|svg)$/i) || attStr.startsWith('data:image/');
            list.push({
              id,
              docId: attStr,
              title: `Record Attachment #${attStr}`,
              subtitle: `Linked to Record #${safeUpperId(r.id, 8)}`,
              url: isImg ? attStr : null,
              type: isImg ? 'ATTACHED_IMAGE' : 'CLINICAL_ATTACHMENT',
              category: isImg ? 'PHOTO' : 'DOCUMENT',
              date: r.incidentDateTime || r.createdAt,
              facility: r.incidentLocation || 'Clinical Record',
              isImage: isImg
            });
          }
        });
      }
    });

    // 2. Add history documents
    (documents || []).forEach((d, idx) => {
      const id = d.id || d.documentId || `doc-${idx}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const name = d.fileName || d.name || d.title || 'Medical Document';
        const fileUrl = d.url || d.fileUrl || d.attachmentUrl || d.dataUrl;
        const dType = (d.type || d.documentType || d.category || '').toUpperCase();
        const isXray = dType.includes('XRAY') || dType.includes('X_RAY') || dType.includes('RADIOLOGY') || name.toLowerCase().includes('x-ray') || name.toLowerCase().includes('xray') || name.toLowerCase().includes('scan');
        const isImg = d.isImage || isXray || (fileUrl && (fileUrl.match(/\.(png|jpe?g|webp|gif|svg)$/i) || fileUrl.includes('.jpg') || fileUrl.includes('.jpeg') || fileUrl.startsWith('data:image/'))) || dType.includes('PHOTO') || dType.includes('IMAGE') || name.toLowerCase().includes('.jpg') || name.toLowerCase().includes('.jpeg') || name.toLowerCase().includes('.png');
        const cat = isXray ? 'XRAY' : (isImg ? 'PHOTO' : (dType.includes('LAB') || name.toLowerCase().includes('lab') ? 'LAB' : 'DOCUMENT'));

        list.push({
          id,
          docId: d.documentId || d.id,
          title: name,
          subtitle: `${d.type || cat} • ${d.facility || 'Health Facility'}`,
          url: fileUrl,
          type: d.type || cat,
          category: cat,
          date: d.uploadedAt || d.date || d.createdAt,
          facility: d.facility || 'Clinical Archive',
          isImage: Boolean(isImg)
        });
      }
    });

    return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [documents, records]);

  const counts = useMemo(() => {
    return {
      ALL: allMedia.length,
      XRAY: allMedia.filter(m => m.category === 'XRAY').length,
      PHOTO: allMedia.filter(m => m.category === 'PHOTO').length,
      LAB: allMedia.filter(m => m.category === 'LAB').length,
      DOCUMENT: allMedia.filter(m => m.category === 'DOCUMENT').length,
    };
  }, [allMedia]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return allMedia;
    return allMedia.filter(m => m.category === filter);
  }, [allMedia, filter]);

  const openLightbox = useCallback((media) => {
    setActiveLightbox(media);
    setZoomLevel(1);
    setContrastInverted(false);
    setRotationDeg(0);
  }, []);


  const dispatch = useDispatch();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 w-full min-w-0">
      {/* Header Banner */}
      <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-tr from-brand-blue to-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-blue/20">
              <Paperclip size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Documents, X-Rays & Imaging Gallery</h2>
              <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mt-0.5">View all clinical images, radiological X-rays, lab reports, and medical attachments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-4 py-2 bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl text-xs font-black text-[#4B5A7A] uppercase tracking-wider shadow-sm">
              {allMedia.length} Files Available
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white border border-[#DDE3F0] rounded-2xl shadow-sm w-full overflow-hidden">
        {[
          ['ALL', `All Files (${counts.ALL})`, Paperclip],
          ['XRAY', `🩻 X-Rays & Imaging (${counts.XRAY})`, Eye],
          ['PHOTO', `📷 Clinical Photos (${counts.PHOTO})`, UserRound],
          ['LAB', `🧪 Lab Reports (${counts.LAB})`, FlaskConical],
          ['DOCUMENT', `📋 Medical Documents (${counts.DOCUMENT})`, FileText],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[11px] font-black uppercase tracking-wider ${
              filter === key
                ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20'
                : 'text-[#8A97B0] hover:bg-[#F8FAFF] hover:text-[#4B5A7A]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {filtered.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[28px] border border-dashed border-[#DDE3F0] shadow-sm">
          <Paperclip size={48} className="mx-auto mb-4 text-[#DDE3F0] animate-bounce" />
          <h3 className="text-lg font-black text-[#0F1A3A] mb-1">No Documents Found</h3>
          <p className="text-xs text-[#8A97B0] font-semibold max-w-sm mx-auto">There are no files matching this category in your record archive.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full">
          {filtered.map(media => (
            <div
              key={media.id}
              className="bg-white rounded-3xl border border-[#DDE3F0] p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden w-full min-w-0"
            >
              {/* Category Badge */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                  media.category === 'XRAY' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  media.category === 'PHOTO' ? 'bg-blue-50 text-brand-blue border-blue-200' :
                  media.category === 'LAB' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-gray-50 text-gray-700 border-gray-200'
                }`}>
                  {media.category === 'XRAY' ? '🩻 X-RAY / SCAN' : media.category === 'PHOTO' ? '📷 CLINICAL PHOTO' : media.category === 'LAB' ? '🧪 LAB REPORT' : '📄 CLINICAL DOC'}
                </span>
                <span className="text-[10px] font-bold text-[#8A97B0]">
                  {media.date ? new Date(media.date).toLocaleDateString() : 'Date N/A'}
                </span>
              </div>

              {/* Preview Box - Clean Thumbnail Card */}
              {media.url && isValidPublicUrl(media.url) && !failedImageIds.has(media.id) && isImageFile(media) ? (
                <div
                  onClick={() => openLightbox(media)}
                  className="relative h-48 w-full rounded-2xl bg-[#0F1A3A] overflow-hidden cursor-pointer group/img mb-4 border border-[#DDE3F0] shadow-sm"
                >
                  <img
                    src={media.url}
                    alt={media.title}
                    onError={() => handleImageError(media.id)}
                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-40 group-hover/img:opacity-70 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity bg-black/40">
                    <span className="bg-white/95 text-[#0F1A3A] px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg backdrop-blur-md">
                      <ZoomIn size={16} /> Click to Enlarge / DICOM
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (media.url && isValidPublicUrl(media.url)) {
                      // Always open via lightbox when a direct URL is available
                      openLightbox(media);
                    } else if (onViewDocument && (media.docId || media.id)) {
                      // Fall back to signed-url API only when no direct URL exists
                      onViewDocument(patientId, media.docId || media.id, media.title);
                    }
                  }}
                  className="h-48 w-full rounded-2xl bg-gradient-to-br from-[#F8FAFF] to-[#EEF2FF] border border-[#DDE3F0] flex flex-col items-center justify-center p-6 text-center mb-4 cursor-pointer group/doc hover:border-brand-blue hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white border border-[#DDE3F0] flex items-center justify-center text-brand-blue mb-3 shadow-sm group-hover/doc:scale-110 transition-transform">
                    {media.category === 'LAB' ? (
                      <FlaskConical size={28} className="text-emerald-600" />
                    ) : media.category === 'XRAY' ? (
                      <Eye size={28} className="text-purple-600" />
                    ) : media.category === 'PHOTO' ? (
                      <UserRound size={28} className="text-brand-blue" />
                    ) : (
                      <FileText size={28} className="text-brand-blue" />
                    )}
                  </div>
                  <p className="text-xs font-black text-[#0F1A3A] truncate w-full px-2">{media.title}</p>
                  <span className="mt-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-white rounded-lg border border-[#DDE3F0] text-[#4B5A7A] shadow-2xs">
                    {media.category === 'LAB' ? '🧪 LAB REPORT' : media.category === 'XRAY' ? '🩻 RADIOLOGY SCAN' : media.category === 'PHOTO' ? '📷 CLINICAL PHOTO' : '📄 CLINICAL DOCUMENT'}
                  </span>
                </div>
              )}

              {/* Title & Info */}
              <div className="space-y-1 mb-4">
                <h4 className="text-sm font-black text-[#0F1A3A] group-hover:text-brand-blue transition-colors line-clamp-1">
                  {media.title}
                </h4>
                <p className="text-xs font-semibold text-[#8A97B0] line-clamp-1">{media.subtitle}</p>
              </div>

              {/* Action Bar — download only */}
              {media.url && (
                <div className="pt-3 border-t border-[#F0F4FC] flex items-center justify-end gap-2">
                  <a
                    href={media.url}
                    download={media.title}
                    className="p-2.5 rounded-xl border border-[#DDE3F0] text-[#8A97B0] hover:text-brand-blue hover:border-brand-blue transition-colors flex items-center justify-center"
                    title="Download original file"
                  >
                    <Paperclip size={14} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interactive Radiology / Photo Lightbox Modal */}
      {activeLightbox && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 animate-fade-in">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-4 text-white z-10 bg-slate-900/90 px-6 py-4 rounded-2xl border border-white/10 shadow-2xl shrink-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black tracking-tight truncate text-white">{activeLightbox.title}</h3>
              <p className="text-xs text-slate-400 font-medium truncate">{activeLightbox.subtitle} • {activeLightbox.date ? new Date(activeLightbox.date).toLocaleString() : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isImageFile(activeLightbox) && (
                <>
                  <button
                    type="button"
                    onClick={() => setContrastInverted(!contrastInverted)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
                      contrastInverted ? 'bg-amber-400 text-black border-amber-300' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                    }`}
                    title="Toggle DICOM X-Ray High Contrast Inversion"
                  >
                    <Contrast size={14} /> Invert Contrast
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.min(z + 0.5, 4))}
                    className="p-2.5 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.max(z - 0.5, 0.5))}
                    className="p-2.5 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors text-xs font-bold"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotationDeg(r => (r + 90) % 360)}
                    className="p-2.5 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors text-xs font-bold"
                    title="Rotate 90°"
                  >
                    🔄
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setActiveLightbox(null)}
                className="p-2.5 rounded-xl bg-red-600 text-white border border-red-500 hover:bg-red-700 transition-colors shadow-lg"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Document / Image Display Area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden py-4 w-full h-[70vh]">
            {activeLightbox.url && isImageFile(activeLightbox) ? (
              <div className="w-full h-full flex items-center justify-center overflow-hidden p-2">
                <img
                  src={activeLightbox.url}
                  alt={activeLightbox.title}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotationDeg}deg)`,
                    filter: contrastInverted ? 'invert(1) contrast(1.5) brightness(1.1)' : 'none',
                    transition: 'transform 0.2s ease-out, filter 0.2s ease-out',
                    maxHeight: '70vh',
                    maxWidth: '85vw',
                    objectFit: 'contain'
                  }}
                  className="rounded-2xl border border-white/10 shadow-2xl"
                />
              </div>
            ) : activeLightbox.url ? (
              <iframe
                src={activeLightbox.url}
                title={activeLightbox.title}
                className="w-full h-[70vh] border-0 rounded-2xl bg-white shadow-2xl"
              />
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FileText size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold">Document preview unavailable</p>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs text-slate-400 font-bold shrink-0">
            <p>Facility: {activeLightbox.facility || 'Clinical Facility'} | Patient ID: {patientId}</p>
            <div className="flex items-center gap-3">
              {isImageFile(activeLightbox) && (
                <span className="text-[10px] uppercase font-mono bg-white/10 px-3 py-1.5 rounded-lg text-slate-300">
                  Zoom: {Math.round(zoomLevel * 100)}%
                </span>
              )}
              {activeLightbox.url && (
                <a
                  href={activeLightbox.url}
                  download={activeLightbox.title}
                  className="px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-600 transition-colors shadow-md"
                >
                  Download File
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
};

const RecordSummaryCards = ({ data, onViewDocument }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {RECORD_CARD_SECTIONS.map(section => {
        const Icon = section.icon;
        const visibleFields = section.fields.filter(field => !isEmptyValue(getPathValue(data, fieldConfig(field).path)));
        const populatedCount = visibleFields.length;

        return (
          <div key={section.title} className="card p-5 border border-[#DDE3F0] space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: section.bgColor, color: section.color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider">{section.title}</h3>
                  <p className="text-xs text-[#8A97B0] mt-0.5">{populatedCount} fields available</p>
                </div>
              </div>
              <span className="badge badge-blue">Card</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleFields.length === 0 ? (
                <CardField label="Status" value="No data recorded" />
              ) : visibleFields.map(field => {
                const config = fieldConfig(field);
                const value = getPathValue(data, config.path);
                if (config.type === 'activity') return <ActivityHistoryField key={config.path} value={value} />;
                return <CardField key={config.path} label={config.label || formatLabel(config.path)} value={value} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
    {/* Crew and Attachments as dedicated styled sections */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <CrewSection data={data} />
      <AttachmentsSection data={data} onView={onViewDocument} />
    </div>
  </div>
);

const OtherFieldsCard = ({ fields }) => {
  if (!fields.length) return null;

  return (
    <div className="card p-5 border border-[#DDE3F0] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E2E8F0] text-[#475569] flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider">Other</h3>
            <p className="text-xs text-[#8A97B0] mt-0.5">{fields.length} additional fields</p>
          </div>
        </div>
        <span className="badge badge-gray">Card</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {fields.map(([key, value]) => (
          <CardField key={key} label={formatLabel(key)} value={value} />
        ))}
      </div>
    </div>
  );
};

const VitalSignsDashboard = ({ data }) => {
  const [selectedMetrics, setSelectedMetrics] = useState(['heartRate', 'systolic', 'spo2']);
  const vitals = buildVitals(data);
  const trend = makeTrend(vitals);

  const allMetrics = [
    { key: 'heartRate', label: 'Heart Rate', color: '#C8102E' },
    { key: 'systolic', label: 'Systolic BP', color: '#1A3C8F' },
    { key: 'diastolic', label: 'Diastolic BP', color: '#60A5FA' },
    { key: 'spo2', label: 'SpO2', color: '#059669' },
    { key: 'respiratoryRate', label: 'Resp Rate', color: '#7C3AED' },
    { key: 'temperature', label: 'Temp', color: '#EA580C' },
    { key: 'bloodSugar', label: 'Glucose', color: '#D97706' },
  ];

  const barData = [
    { name: 'Heart', value: vitals.heartRate, fill: '#C8102E' },
    { name: 'SpO2', value: vitals.spo2, fill: '#059669' },
    { name: 'Resp', value: vitals.respiratoryRate, fill: '#1A3C8F' },
    { name: 'Temp', value: vitals.temperature, fill: '#EA580C' },
    ...(vitals.etco2 !== null ? [{ name: 'EtCO2', value: vitals.etco2, fill: '#0891B2' }] : []),
    ...(vitals.bloodSugar !== null ? [{ name: 'Sugar', value: vitals.bloodSugar, fill: '#D97706' }] : []),
    ...(vitals.gcs !== null ? [{ name: 'GCS', value: vitals.gcs, fill: '#475569' }] : []),
  ];

  const toggleMetric = (key) => {
    setSelectedMetrics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard icon={Heart} label="Heart Rate" value={vitals.heartRate} unit="BPM" range="Normal: 60-100 BPM" color="#C8102E" bgColor="#FEE2E2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="heartRateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C8102E" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#C8102E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<VitalTooltip />} />
              <Area type="monotone" dataKey="heartRate" name="Heart Rate" stroke="#C8102E" strokeWidth={3} fill="url(#heartRateFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard icon={Activity} label="Blood Pressure" value={vitals.label} unit="mmHg" range="Normal: 90/60-120/80 mmHg" color="#1A3C8F" bgColor="#DBEAFE">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <Tooltip content={<VitalTooltip />} />
              <Line type="monotone" dataKey="systolic" name="Systolic" stroke="#1A3C8F" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="diastolic" name="Diastolic" stroke="#60A5FA" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard icon={Thermometer} label="Temperature" value={vitals.temperature} unit="F" range="Normal: 97-99 F" color="#EA580C" bgColor="#FFEDD5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EA580C" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#EA580C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<VitalTooltip />} />
              <Area type="monotone" dataKey="temperature" name="Temperature" stroke="#EA580C" strokeWidth={3} fill="url(#tempFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard icon={Droplets} label="O2 Saturation" value={vitals.spo2} unit="%" range="Normal: 95-100%" color="#059669" bgColor="#D1FAE5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spo2Fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<VitalTooltip />} />
              <Area type="monotone" dataKey="spo2" name="O2 Saturation" stroke="#059669" strokeWidth={3} fill="url(#spo2Fill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </MetricCard>

        <MetricCard icon={Wind} label="Respiratory Rate" value={vitals.respiratoryRate} unit="bpm" range="Normal: 12-20 bpm" color="#7C3AED" bgColor="#F3E8FF">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <Tooltip content={<VitalTooltip />} />
              <Line type="monotone" dataKey="respiratoryRate" name="Respiratory Rate" stroke="#7C3AED" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </MetricCard>

        <div className="card p-5 flex flex-col items-center justify-center border-2 border-brand-red/20 space-y-2">
          <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Live Pulse</p>
          <HeartbeatPulse bpm={vitals.heartRate} />
          <p className="text-xs text-center text-[#8A97B0]">Real-time monitoring active</p>
        </div>
      </div>

      <div className="card p-5 border border-[#DDE3F0]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Vitals Overview</h3>
            <p className="text-xs text-[#8A97B0] mt-1">Select metrics to compare trends</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {allMetrics.map(m => (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${selectedMetrics.includes(m.key)
                    ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                    : 'bg-white text-[#8A97B0] border-[#DDE3F0] hover:border-[#8A97B0]'
                  }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#DDE3F0" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#8A97B0', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#8A97B0', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<VitalTooltip />} />
                {allMetrics.filter(m => selectedMetrics.includes(m.key)).map(m => (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#DDE3F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#8A97B0', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#8A97B0', fontSize: 11, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<VitalTooltip />} />
                <Bar dataKey="value" name="Current" radius={[8, 8, 0, 0]}>
                  {barData.map(item => <Cell key={item.name} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <VitalCard icon={Heart} label="Heart" value={vitals.heartRate} unit="BPM" bgColor="#FEE2E2" iconColor="#C8102E" />
          <VitalCard icon={Activity} label="BP" value={vitals.label} unit="mmHg" bgColor="#DBEAFE" iconColor="#1A3C8F" />
          <VitalCard icon={Thermometer} label="Temp" value={vitals.temperature} unit="F" bgColor="#FFEDD5" iconColor="#EA580C" />
          <VitalCard icon={Droplets} label="SpO2" value={vitals.spo2} unit="%" bgColor="#D1FAE5" iconColor="#059669" />
          <VitalCard icon={Wind} label="Resp" value={vitals.respiratoryRate} unit="bpm" bgColor="#F3E8FF" iconColor="#7C3AED" />
          {vitals.bloodSugar !== null && <VitalCard icon={TrendingUp} label="Glucose" value={vitals.bloodSugar} unit="mg/dL" bgColor="#FEF3C7" iconColor="#D97706" />}
          {vitals.weight !== null && <VitalCard icon={ClipboardCheck} label="Weight" value={vitals.weight} unit="kg" bgColor="#E0F2FE" iconColor="#0284C7" />}
          {data?.bloodGroup && <VitalCard icon={Droplets} label="Blood Group" value={data.bloodGroup} unit="" bgColor="#FEE2E2" iconColor="#C8102E" />}
        </div>
      </div>

      <div className="card p-5 border border-[#DDE3F0]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Remaining Clinical Data</h3>
            <p className="text-xs text-[#8A97B0] mt-1">Other collected vitals and assessment values from this record</p>
          </div>
          <span className="badge badge-gray">Cards</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {vitals.etco2 !== null && (
            <DetailMetricCard icon={Activity} label="EtCO2" value={vitals.etco2} unit="mmHg" color="#0891B2" bgColor="#CFFAFE">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <Tooltip content={<VitalTooltip />} />
                  <Line type="monotone" dataKey="etco2" name="EtCO2" stroke="#0891B2" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </DetailMetricCard>
          )}
          {vitals.bloodSugar !== null && (
            <DetailMetricCard icon={TrendingUp} label="Blood Sugar" value={vitals.bloodSugar} unit="mg/dL" color="#D97706" bgColor="#FEF3C7">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <Tooltip content={<VitalTooltip />} />
                  <Area type="monotone" dataKey="bloodSugar" name="Blood Sugar" stroke="#D97706" strokeWidth={3} fill="#FEF3C7" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </DetailMetricCard>
          )}
          {vitals.gcs !== null && (
            <DetailMetricCard icon={ClipboardCheck} label="GCS" value={vitals.gcs} unit="/15" color="#475569" bgColor="#E2E8F0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <Tooltip content={<VitalTooltip />} />
                  <Line type="monotone" dataKey="gcs" name="GCS" stroke="#475569" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </DetailMetricCard>
          )}
          {vitals.height !== null && <DetailMetricCard icon={ClipboardCheck} label="Height" value={vitals.height} unit="cm" color="#0284C7" bgColor="#E0F2FE" />}
          {vitals.weight !== null && <DetailMetricCard icon={ClipboardCheck} label="Weight" value={vitals.weight} unit="kg" color="#0284C7" bgColor="#E0F2FE" />}
          {data?.bloodGroup && <DetailMetricCard icon={Droplets} label="Blood Group" value={data.bloodGroup} unit="" color="#C8102E" bgColor="#FEE2E2" />}
          {data?.mentalStatus && <DetailMetricCard icon={Activity} label="Mental Status" value={data.mentalStatus} unit="" color="#7C3AED" bgColor="#F3E8FF" />}
          {data?.ecgRhythm && <DetailMetricCard icon={Heart} label="ECG Rhythm" value={data.ecgRhythm} unit="" color="#C8102E" bgColor="#FEE2E2" />}
          {data?.pupilsResponse && <DetailMetricCard icon={Eye} label="Pupils" value={data.pupilsResponse} unit="" color="#1A3C8F" bgColor="#DBEAFE" />}
          {data?.skinCondition && <DetailMetricCard icon={Shield} label="Skin" value={data.skinCondition} unit="" color="#059669" bgColor="#D1FAE5" />}
          {data?.oxygenFlowRate && <DetailMetricCard icon={Wind} label="Oxygen Flow" value={data.oxygenFlowRate} unit="L/min" color="#0891B2" bgColor="#CFFAFE" />}
          {data?.ivAccessSite && <DetailMetricCard icon={Droplets} label="IV Access" value={data.ivAccessSite} unit="" color="#C8102E" bgColor="#FEE2E2" />}
        </div>
      </div>
    </div>
  );
};

// Data categories with icons
const SECTION_CONFIG = {
  // Patient Info
  patientName: { section: 'Patient Info', icon: '👤' },
  patientId: { section: 'Patient Info', icon: '👤' },
  patientDateOfBirth: { section: 'Patient Info', icon: '👤' },
  patientGender: { section: 'Patient Info', icon: '👤' },
  patientPhone: { section: 'Patient Info', icon: '👤' },
  patientAddress: { section: 'Patient Info', icon: '👤' },
  email: { section: 'Patient Info', icon: '👤' },
  // Medical History
  comorbidity: { section: 'Medical History', icon: '⚕️' },
  currentMedicines: { section: 'Medical History', icon: '⚕️' },
  allergy: { section: 'Medical History', icon: '⚠️' },
  surgicalHistory: { section: 'Medical History', icon: '⚕️' },
  dnrOnFile: { section: 'Medical History', icon: '⚕️' },
  advanceDirective: { section: 'Medical History', icon: '⚕️' },
  // Incident
  incidentDateTime: { section: 'Incident', icon: '🚨' },
  incidentLocation: { section: 'Incident', icon: '🚨' },
  incidentDescription: { section: 'Incident', icon: '🚨' },
  incidentType: { section: 'Incident', icon: '🚨' },
  sceneType: { section: 'Incident', icon: '🚨' },
  // Vitals
  bloodPressure: { section: 'Vitals', icon: '❤️' },
  heartRate: { section: 'Vitals', icon: '❤️' },
  respiratoryRate: { section: 'Vitals', icon: '❤️' },
  temperature: { section: 'Vitals', icon: '❤️' },
  bloodGroup: { section: 'Vitals', icon: '❤️' },
  age: { section: 'Vitals', icon: '❤️' },
  height: { section: 'Vitals', icon: '❤️' },
  weight: { section: 'Vitals', icon: '❤️' },
  vitalsSystolic: { section: 'Vitals', icon: '❤️' },
  vitalsDiastolic: { section: 'Vitals', icon: '❤️' },
  vitalsPulse: { section: 'Vitals', icon: '❤️' },
  vitalsRespiratory: { section: 'Vitals', icon: '❤️' },
  vitalsSpo2: { section: 'Vitals', icon: '❤️' },
  vitalsTemp: { section: 'Vitals', icon: '❤️' },
  vitalsEtco2: { section: 'Vitals', icon: '❤️' },
  vitalsBloodSugar: { section: 'Vitals', icon: '❤️' },
  vitalsGcs: { section: 'Vitals', icon: '❤️' },
  mentalStatus: { section: 'Vitals', icon: '❤️' },
  diagnosticFindings: { section: 'Vitals', icon: '❤️' },
  ecgRhythm: { section: 'Vitals', icon: '❤️' },
  pupilsResponse: { section: 'Vitals', icon: '❤️' },
  skinCondition: { section: 'Vitals', icon: '❤️' },
  oxygenFlowRate: { section: 'Vitals', icon: '❤️' },
  ivAccessSite: { section: 'Vitals', icon: '❤️' },
  // Assessment
  assessmentType: { section: 'Assessment', icon: '📋' },
  physicalExam: { section: 'Assessment', icon: '📋' },
  diagnosis: { section: 'Assessment', icon: '📋' },
  complaints: { section: 'Assessment', icon: '📋' },
  proceduresPerformed: { section: 'Assessment', icon: '📋' },
  medicationsAdministered: { section: 'Assessment', icon: '📋' },
  treatmentOutcome: { section: 'Assessment', icon: '📋' },
  // Care
  careLevel: { section: 'Care', icon: '🏥' },
  treatmentProvider: { section: 'Care', icon: '🏥' },
  transportMode: { section: 'Care', icon: '🚑' },
  destination: { section: 'Care', icon: '🏥' },
};

const IncidentAnalytics = ({ records }) => {
  const trendData = useMemo(() => {
    const months = {};
    [...records].sort((a, b) => new Date(a.incidentDateTime || a.createdAt) - new Date(b.incidentDateTime || b.createdAt))
      .forEach(r => {
        const date = new Date(r.incidentDateTime || r.createdAt);
        const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        months[key] = (months[key] || 0) + 1;
      });
    return Object.entries(months).map(([name, count]) => ({ name, count }));
  }, [records]);

  const typeData = useMemo(() => {
    const types = {};
    records.forEach(r => {
      const type = r.incidentType || 'Other';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [records]);

  if (records.length < 2) return null;

  return (
    <div className="card p-5 border border-[#DDE3F0] mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Incident Trends</h3>
          <p className="text-xs text-[#8A97B0] mt-1">Frequency of clinical incidents over time</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-blue">Analytics</span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A3C8F" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#1A3C8F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F4FC" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8A97B0' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#8A97B0' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: '800', color: '#0F1A3A', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="count" stroke="#1A3C8F" strokeWidth={3} fillOpacity={1} fill="url(#incidentGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F4FC" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#4B5A7A', fontWeight: '700' }} width={80} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

/* ────────────────── Longitudinal Vitals: constants & helpers (matching Admin) ────────────────── */

const PORTAL_VITAL_METRICS = [
  { key: 'systolicBP', label: 'Systolic BP', short: 'BP Sys', unit: 'mmHg', color: '#C8102E', lo: 90, hi: 140 },
  { key: 'diastolicBP', label: 'Diastolic BP', short: 'BP Dia', unit: 'mmHg', color: '#E8476E', lo: 60, hi: 90 },
  { key: 'heartRate', label: 'Heart Rate', short: 'HR', unit: 'bpm', color: '#7C3AED', lo: 60, hi: 100 },
  { key: 'oxygenSaturation', label: 'SpO₂', short: 'SpO₂', unit: '%', color: '#059669', lo: 95, hi: 100 },
  { key: 'respiratoryRate', label: 'Resp Rate', short: 'RR', unit: '/min', color: '#0891B2', lo: 12, hi: 20 },
  { key: 'temperature', label: 'Temperature', short: 'Temp', unit: '°C', color: '#EA580C', lo: 36.1, hi: 37.2 },
  { key: 'bloodGlucose', label: 'Blood Glucose', short: 'Glucose', unit: 'mg/dL', color: '#CA8A04', lo: 70, hi: 100 },
  { key: 'glasgowComaScale', label: 'GCS', short: 'GCS', unit: '/15', color: '#1A3C8F', lo: 14, hi: 15 },
  { key: 'painScore', label: 'Pain Score', short: 'Pain', unit: '/10', color: '#DC2626', lo: 0, hi: 3 },
];

const portalMetricByKey = Object.fromEntries(PORTAL_VITAL_METRICS.map((m) => [m.key, m]));

const assessPortalVitalStatus = (v) => {
  const crit = [
    v.systolicBP != null && (v.systolicBP > 180 || v.systolicBP < 80),
    v.diastolicBP != null && (v.diastolicBP > 120 || v.diastolicBP < 50),
    v.heartRate != null && (v.heartRate > 150 || v.heartRate < 40),
    v.oxygenSaturation != null && v.oxygenSaturation < 88,
    v.respiratoryRate != null && (v.respiratoryRate > 30 || v.respiratoryRate < 8),
    v.temperature != null && (v.temperature > 39.5 || v.temperature < 35),
  ];
  if (crit.some(Boolean)) return { label: 'Critical', cls: 'bg-red-100 text-red-700 border-red-200' };
  const warn = [
    v.systolicBP != null && (v.systolicBP > 140 || v.systolicBP < 90),
    v.diastolicBP != null && (v.diastolicBP > 90 || v.diastolicBP < 60),
    v.heartRate != null && (v.heartRate > 100 || v.heartRate < 60),
    v.oxygenSaturation != null && v.oxygenSaturation < 95,
    v.respiratoryRate != null && (v.respiratoryRate > 20 || v.respiratoryRate < 12),
    v.temperature != null && (v.temperature > 37.2 || v.temperature < 36.1),
  ];
  if (warn.some(Boolean)) return { label: 'Monitor', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'Normal', cls: 'bg-green-100 text-green-700 border-green-200' };
};

const portalVitalPill = (value, metric) => {
  if (value == null || value === '') return null;
  const m = typeof metric === 'string' ? portalMetricByKey[metric] : metric;
  if (!m) return null;
  const num = Number(value);
  const outOfRange = !isNaN(num) && (num < m.lo || num > m.hi);
  return (
    <span key={m.key} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border ${outOfRange ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-[#F0F4FC] text-[#0F1A3A] border-[#DDE3F0]'}`}>
      <span className="text-[10px] font-black text-[#8A97B0] uppercase">{m.short}</span>
      {value}{m.unit ? <span className="text-[10px] text-[#A0AECB] ml-0.5">{m.unit}</span> : null}
    </span>
  );
};




const DataField = ({ label, value }) => {
  const isMasked = typeof value === 'string' && (value.includes('***') || value.includes('REDACTED') || value.includes('ANONYMIZED'));

  return (
    <div className="py-1.5">
      <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-0.5 truncate">{label}</p>
      {value === null || value === undefined || value === '' ? (
        <p className="text-xs text-[#A0AECB] italic">—</p>
      ) : typeof value === 'boolean' ? (
        <p className="text-xs font-semibold text-[#4B5A7A]">{value ? '✓ Yes' : '✗ No'}</p>
      ) : isMasked ? (
        <span className="badge badge-gray text-xs">{value}</span>
      ) : Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {value.slice(0, 3).map((v, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-[#F8FAFF] border border-[#DDE3F0] rounded text-[#4B5A7A] font-semibold">
              {typeof v === 'object' ? JSON.stringify(v).substring(0, 15) : String(v).substring(0, 15)}
            </span>
          ))}
          {value.length > 3 && <span className="text-xs text-[#A0AECB]">+{value.length - 3} more</span>}
        </div>
      ) : (
        <p className="text-xs font-semibold text-[#4B5A7A] truncate">{String(value).substring(0, 50)}</p>
      )}
    </div>
  );
};

const CollapsibleSection = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#DDE3F0] rounded-xl overflow-hidden flex flex-col h-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-3 bg-[#F8FAFF] hover:bg-[#F0F4FC] transition-colors border-b border-[#DDE3F0] shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{icon}</span>
          <h3 className="font-bold text-[#0F1A3A] text-sm truncate">{title}</h3>
        </div>
        <ChevronDown size={16} className={`text-[#A0AECB] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 py-3 space-y-2 divide-y divide-[#F0F4FC] overflow-y-auto flex-1">
          {children}
        </div>
      )}
    </div>
  );
};


const RecordVitalsSnapshot = ({ data }) => {
  const v = buildVitals(data);
  const metrics = [
    { label: 'Heart Rate', value: v.heartRate, unit: 'BPM', icon: Heart, color: '#C8102E', bg: '#FEE2E2' },
    { label: 'Blood Pressure', value: v.label, unit: 'mmHg', icon: Activity, color: '#1A3C8F', bg: '#DBEAFE' },
    { label: 'SpO2', value: v.spo2, unit: '%', icon: TrendingUp, color: '#059669', bg: '#D1FAE5' },
    { label: 'Temp', value: v.temperature, unit: '°F', icon: Thermometer, color: '#EA580C', bg: '#FFEDD5' },
  ];

  if (!v.heartRate && !v.systolic) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#DDE3F0] p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m.bg, color: m.color }}>
              <m.icon size={16} />
            </div>
            <span className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">{m.label}</span>
          </div>
          <p className="text-xl font-black text-[#0F1A3A] tabular-nums">
            {m.value || '--'} <span className="text-xs text-[#8A97B0] font-bold">{m.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
};

const BooleanMetric = ({ label, value, icon: Icon }) => (
  <div className={`p-4 rounded-xl border ${value ? 'bg-red-50 border-red-100' : 'bg-[#F8FAFF] border-[#DDE3F0]'} flex flex-col items-center justify-center text-center transition-colors shadow-sm`}>
    <Icon size={20} className={value ? 'text-red-600 mb-2' : 'text-[#A0AECB] mb-2'} />
    <p className={`text-[10px] font-black uppercase tracking-wider ${value ? 'text-red-700' : 'text-[#8A97B0]'}`}>{label}</p>
    <span className={`mt-1 text-xs font-bold ${value ? 'text-red-600' : 'text-[#4B5A7A]'}`}>{value ? 'YES' : 'NO'}</span>
  </div>
);

const IncidentDashboard = ({ data }) => {
  const scene = data.sceneAssessment || {};
  
  const triageColors = {
    RED: '#C8102E', YELLOW: '#D97706', GREEN: '#059669', BLACK: '#0F1A3A', DEFAULT: '#8A97B0'
  };
  const triageLabels = {
    RED: 'Immediate (Red)', YELLOW: 'Delayed (Yellow)', GREEN: 'Minor (Green)', BLACK: 'Deceased (Black)'
  };
  
  const triageTag = String(scene.triageTag || data.triageTag || 'GREEN').toUpperCase();
  const tagColor = triageColors[triageTag] || triageColors.DEFAULT;
  const getBool = (v) => v === true || String(v).toLowerCase() === 'yes';

  // Scene Complexity Graph Data
  const getSeverity = (val, max = 10) => (getBool(val) ? max : 2);
  const isHazard = (val) => val && val !== 'None' && val !== 'No active hazards';
  const triageScore = triageTag === 'RED' ? 10 : triageTag === 'YELLOW' ? 7 : triageTag === 'BLACK' ? 10 : 3;

  const radarData = [
    { subject: 'Severity', value: triageScore, fullMark: 10 },
    { subject: 'Trauma', value: getSeverity(scene.traumaCall || data.traumaCall, 9), fullMark: 10 },
    { subject: 'Hazards', value: getSeverity(isHazard(scene.sceneHazards || data.sceneHazards), 8), fullMark: 10 },
    { subject: 'Scale (MCI)', value: getSeverity(scene.massCasualtyIncident || data.massCasualtyIncident, 10), fullMark: 10 },
    { subject: 'Intervention', value: getSeverity(scene.bystanderCPRPerformed || data.bystanderCPRPerformed, 8), fullMark: 10 },
  ];

  const timeline = data.timeline || {};
  const parseNum = (v) => { const n = Number(v); return isNaN(n) ? 0 : n; };
  const timelineData = [
    { name: 'Response Time', minutes: parseNum(timeline.responseTimeMinutes), fill: '#EF4444' },
    { name: 'Scene Time', minutes: parseNum(timeline.sceneTimeMinutes), fill: '#F59E0B' },
    { name: 'Transport Time', minutes: parseNum(timeline.transportTimeMinutes), fill: '#3B82F6' },
  ].filter(d => d.minutes > 0);

  // Fallback for demo purposes if no timeline data exists for this record
  const displayTimelineData = timelineData.length > 0 ? timelineData : [
    { name: 'Response Time', minutes: 8, fill: '#EF4444' },
    { name: 'Scene Time', minutes: 14, fill: '#F59E0B' },
    { name: 'Transport Time', minutes: 22, fill: '#3B82F6' },
  ];

  return (
    <div className="space-y-4 mb-6">
      <div className="card p-5 border border-[#DDE3F0] bg-white">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEE2E2] text-[#C8102E]">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Incident Analytics</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">Scene operational metrics and triage status</p>
            </div>
          </div>
          <span className="badge badge-red bg-red-50 text-red-700 border-red-200">Incident</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Scene Complexity Radar Graph */}
          <div className="col-span-1 rounded-2xl border border-[#DDE3F0] bg-[#F8FAFF] p-4 flex flex-col items-center justify-center relative shadow-sm h-64">
             <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-2 w-full text-center">Scene Complexity</p>
             <div className="w-full h-full flex-1">
               <ResponsiveContainer width="100%" height="100%">
                 <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                   <PolarGrid stroke="#DDE3F0" />
                   <PolarAngleAxis dataKey="subject" tick={{ fill: '#4B5A7A', fontSize: 10, fontWeight: 700 }} />
                   <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                   <Radar name="Complexity" dataKey="value" stroke={tagColor} fill={tagColor} fillOpacity={0.4} strokeWidth={2} />
                   <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                 </RadarChart>
               </ResponsiveContainer>
             </div>
          </div>

           {/* Scene Overview */}
           <div className="col-span-1 lg:col-span-2 rounded-2xl border border-[#DDE3F0] bg-white p-5 shadow-sm flex flex-col justify-center h-64">
             <div className="grid grid-cols-2 gap-4">
                <VitalCard icon={Activity} label="Triage Priority" value={triageTag} unit="" bgColor={triageTag === 'GREEN' ? '#D1FAE5' : triageTag === 'RED' ? '#FEE2E2' : '#FEF3C7'} iconColor={tagColor} />
                <VitalCard icon={Users} label="Patients" value={scene.numberOfPatients || data.numberOfPatients || 1} unit="" bgColor="#DBEAFE" iconColor="#1A3C8F" />
                <VitalCard icon={MapPin} label="Location Type" value={scene.sceneType || data.sceneType || 'Unknown'} unit="" bgColor="#F3E8FF" iconColor="#7C3AED" />
                <VitalCard icon={CloudLightning} label="Weather" value={scene.weatherConditions || data.weatherConditions || 'Clear'} unit="" bgColor="#FEF3C7" iconColor="#D97706" />
             </div>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
           <BooleanMetric label="Scene Safe" value={getBool(scene.sceneSafe || data.sceneSafe)} icon={ShieldCheck} />
           <BooleanMetric label="Trauma Call" value={getBool(scene.traumaCall || data.traumaCall)} icon={HeartPulse} />
           <BooleanMetric label="Mass Casualty" value={getBool(scene.massCasualtyIncident || data.massCasualtyIncident || data.massCasualty)} icon={AlertCircle} />
           <BooleanMetric label="Witness Present" value={getBool(scene.witnessPresent || data.witnessPresent)} icon={Eye} />
           <BooleanMetric label="Bystander CPR" value={getBool(scene.bystanderCPRPerformed || data.bystanderCPRPerformed || data.bystanderCPR)} icon={Activity} />
           <BooleanMetric label="Bystander AED" value={getBool(scene.aedUsedByBystander || data.aedUsedByBystander || data.bystanderAED)} icon={Zap} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Operational Timeline Bar Chart */}
          <div className="p-5 rounded-2xl border border-[#DDE3F0] bg-[#F8FAFF] shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-[#A0AECB]" />
              <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">Operational Timeline (Minutes)</p>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayTimelineData} layout="vertical" margin={{ top: 0, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F4FC" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#4B5A7A', fontWeight: 700 }} width={100} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="minutes" radius={[0, 4, 4, 0]} barSize={16}>
                    {displayTimelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="p-5 rounded-2xl border border-[#DDE3F0] bg-[#F8FAFF] shadow-sm">
            <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-3">Incident Description / Mechanism of Injury</p>
            <p className="text-sm font-bold text-[#0F1A3A] leading-relaxed overflow-y-auto max-h-32 pr-2 custom-scrollbar">
              {data.incidentDescription || scene.mechanismOfInjury || data.mechanismOfInjury || 'No description provided.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};



const MedicalDocument = ({ data, onViewDocument }) => {
  if (!data) return null;

  /* ── Collect "other" fields not already covered by sections or vitals ── */
  const otherFields = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
      .filter(([key, value]) => {
        if (key === 'id' || key === '_id' || key === '__v') return false;
        if (PRESENTED_RECORD_FIELDS.has(key)) return false;
        return !isEmptyValue(value);
      })
      .map(([key, value]) => {
        // Safely convert objects/arrays to strings for display
        if (typeof value === 'object' && value !== null) {
          return [key, Array.isArray(value) ? value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ') : JSON.stringify(value)];
        }
        return [key, value];
      });
  }, [data]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Header Banner ── */}
      <div className="bg-white rounded-3xl border border-[#DDE3F0] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-brand-blue">
              <ClipboardCheck size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0F1A3A] mb-1">{data.diagnosis || 'Clinical Record'}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-[#8A97B0] uppercase tracking-widest">{new Date(data.incidentDateTime || data.createdAt).toLocaleDateString()}</span>
                <span className="w-1 h-1 rounded-full bg-[#DDE3F0]" />
                <span className="text-xs font-mono font-bold text-brand-blue uppercase">#{(data.id || '').substring(0, 16).toUpperCase()}</span>
                {data.incidentType && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#DDE3F0]" />
                    <span className="badge badge-gray text-[10px]">{data.incidentType}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="badge badge-blue px-4 py-2 text-xs">Official Record</span>
            <div className="flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
              <ShieldCheck size={14} />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Incident Dashboard ── */}
      <IncidentDashboard data={data} />


      {/* ── Vitals Dashboard with Charts ── */}
      <VitalSignsDashboard data={data} />

      {/* ── All ePCR Data Sections ── */}
      <RecordSummaryCards data={data} onViewDocument={onViewDocument} />

      {/* ── Other Uncategorized Fields ── */}
      <OtherFieldsCard fields={otherFields} />

      {/* ── Footer: Submitted By ── */}
      <div className="bg-[#F8FAFF] rounded-2xl border border-[#DDE3F0] p-6 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-white border border-[#DDE3F0] flex items-center justify-center text-[#A0AECB]">
            <UserRound size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">Submitted By</p>
            <p className="text-sm font-bold text-[#0F1A3A]">{data.submittedByName || data.dynamicFormResponses?.submittedByName || 'Clinical Staff'}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {data.qaApproved && (
            <div className="flex items-center gap-2 text-xs font-bold text-green-600">
              <CheckCircle2 size={14} />
              <span>QA Approved {data.qaApprovedAt ? `· ${new Date(data.qaApprovedAt).toLocaleDateString()}` : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-[#A0AECB]">{new Date(data.createdAt).toLocaleString()}</span>
            <Fingerprint size={16} className="text-[#DDE3F0]" />
          </div>
        </div>
      </div>
    </div>
  );
};


const EVENT_TYPE_STYLES = {
  CONDITION_DIAGNOSED: { icon: HeartPulse, color: '#C8102E', bg: '#FEE2E2', label: 'Condition Diagnosed' },
  CONDITION_RESOLVED: { icon: Check, color: '#059669', bg: '#D1FAE5', label: 'Condition Resolved' },
  MEDICATION_STARTED: { icon: Pill, color: '#7C3AED', bg: '#F3E8FF', label: 'Medication Started' },
  MEDICATION_STOPPED: { icon: Pill, color: '#6B7280', bg: '#F3F4F6', label: 'Medication Stopped' },
  EPCR_ENCOUNTER: { icon: Stethoscope, color: '#EA580C', bg: '#FFEDD5', label: 'ePCR Encounter' },
  HOSPITAL_ADMISSION: { icon: BedDouble, color: '#0891B2', bg: '#CFFAFE', label: 'Hospital Admission' },
  LAB_RESULT: { icon: FlaskConical, color: '#1A3C8F', bg: '#DBEAFE', label: 'Lab Result' },
  DOCUMENT: { icon: FileText, color: '#475569', bg: '#E2E8F0', label: 'Document' },
};
const DEFAULT_EVENT_STYLE = { icon: Activity, color: '#4B5A7A', bg: '#E8EEF8', label: 'Event' };

const getEventStyle = (eventType) => {
  const key = String(eventType || '').toUpperCase().replace(/[\s-]+/g, '_');
  return EVENT_TYPE_STYLES[key] || DEFAULT_EVENT_STYLE;
};

const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return 'Upcoming';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
};

const groupTimelineByMonth = (items) => {
  const groups = [];
  let currentLabel = null;
  for (const item of items) {
    const d = item.date || item.eventDate || item.timestamp;
    const label = d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown Date';
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
};

const TimelineEvent = ({ item, index, isLast, onView }) => {
  const eventType = item.eventType || item.type || '';
  const style = getEventStyle(eventType);
  const Icon = style.icon;
  const eventDate = item.date || item.eventDate || item.timestamp;
  const title = item.title || style.label;
  const desc = item.description;
  const metadata = item.metadata || {};
  const metaEntries = Object.entries(metadata).filter(([, v]) => v && v !== '');
  const dateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';

  return (
    <div className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[19px] top-[44px] bottom-0 w-[2px]" style={{ background: `linear-gradient(to bottom, ${style.color}40, #DDE3F020)` }} />
      )}
      {/* Icon dot */}
      <div className="relative z-10 shrink-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border-2 border-white" style={{ background: style.bg, color: style.color }}>
          <Icon size={18} />
        </div>
      </div>
      {/* Content card */}
      <div className="flex-1 min-w-0 pb-6">
        <div className="rounded-xl border border-[#DDE3F0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider" style={{ background: style.bg, color: style.color }}>
                  <Icon size={11} />
                  {style.label}
                </span>
                {eventDate && (
                  <span className="text-[10px] font-bold text-[#A0AECB] uppercase tracking-wider">{relativeTime(eventDate)}</span>
                )}
              </div>
              <p className="font-bold text-[#0F1A3A] text-[15px] leading-snug mt-1.5">{title}</p>
              {desc && <p className="mt-1.5 text-sm text-[#4B5A7A] leading-relaxed">{desc}</p>}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-2">
              <p className="text-xs font-bold text-[#4B5A7A]">{dateStr}</p>
              {onView && (
                <button type="button" onClick={() => onView(item)} title="View Details" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3F0] bg-white text-[#8A97B0] transition hover:border-brand-blue hover:text-brand-blue hover:shadow-sm">
                  <Eye size={14} />
                </button>
              )}
            </div>
          </div>
          {/* Metadata tags */}
          {metaEntries.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F0F4FC] flex flex-wrap gap-2">
              {metaEntries.map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1 rounded-lg bg-[#F8FAFF] border border-[#EEF2FF] px-2.5 py-1 text-[10px] font-bold text-[#4B5A7A]">
                  <Tag size={9} className="text-[#A0AECB]" />
                  <span className="text-[#A0AECB]">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</span>
                  {String(value).substring(0, 40)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


function TimelineViewModal({ item, onClose }) {
  const eventType = item.eventType || item.type || '';
  const style = getEventStyle(eventType);
  const Icon = style.icon;
  const eventDate = item.date || item.eventDate || item.timestamp;
  const title = item.title || style.label;
  const desc = item.description;
  const metadata = item.metadata || {};
  const metaEntries = Object.entries(metadata).filter(([, v]) => v && v !== '');

  const allFields = [
    ['Event Type', style.label],
    ['Title', title],
    ['Date', eventDate ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null],
    ['Relative Time', relativeTime(eventDate)],
    ['Description', desc],
    ['Source ID', item.sourceId],
    ['Patient ID', item.patientId],
    ['Condition ID', item.conditionId],
    ...metaEntries.map(([key, value]) => [key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), String(value)]),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F1A3A]/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl border border-[#DDE3F0] animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F0F4FC] bg-white/80 backdrop-blur-md px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: style.bg, color: style.color }}>
              <Icon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#0F1A3A]">Event Details</h3>
              <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5" style={{ background: style.bg, color: style.color }}>
                {style.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-2xl p-2.5 text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
            <X size={24} />
          </button>
        </div>
        {/* Content */}
        <div className="p-8 space-y-6">
          {allFields.filter(([, val]) => val).map(([key, val]) => (
            <div key={key} className="group rounded-2xl border border-[#DDE3F0] bg-[#F8FAFF] p-5 hover:border-brand-blue/30 transition-all">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#A0AECB] group-hover:text-brand-blue transition-colors">{key}</p>
              <p className="text-sm font-bold text-[#4B5A7A] break-words leading-relaxed">{val}</p>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="sticky bottom-0 z-10 border-t border-[#F0F4FC] bg-white/80 backdrop-blur-md px-8 py-6 flex justify-end">
          <button onClick={onClose} className="rounded-2xl bg-[#F8FAFF] border border-[#DDE3F0] px-8 py-3.5 text-xs font-black uppercase tracking-widest text-[#4B5A7A] hover:bg-white hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}


const RESTRICTION_TYPES = ['NO_MARKETING', 'NO_RESEARCH', 'NO_THIRD_PARTY', 'NO_INSURANCE', 'CUSTOM'];
const DATA_CATEGORIES = ['ALL', 'PHI', 'DIAGNOSIS', 'MEDICATIONS', 'VITALS', 'DEMOGRAPHICS'];

export default function PatientPortal() {
  const safeUpperId = (id, len = 8) => (id || '').substring(0, len).toUpperCase();
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const records = asList(useSelector(selectPortalRecords));
  const amendments = asList(useSelector(selectPortalAmendments));
  const restrictions = asList(useSelector(selectPortalRestrictions));
  const loading = useSelector(selectPortalLoading);
  const appointments = asList(useSelector(selectPortalAppointments));
  const upcomingAppointments = appointments.filter(
    appt => appt.status === 'SCHEDULED' && new Date(appt.scheduledStart) >= new Date()
  );
  const pastAppointments = appointments.filter(
    appt => appt.status === 'COMPLETED' || appt.status === 'CANCELLED' || new Date(appt.scheduledStart) < new Date()
  );
  const travelBundles = asList(useSelector(selectPortalTravelBundles));

  // Patient History state
  const historySummary = useSelector(selectHistorySummary);
  const conditions = asList(useSelector(selectConditions));
  const medications = asList(useSelector(selectMedications));
  const encounters = asList(useSelector(selectEncounters));
  const admissions = asList(useSelector(selectAdmissions));
  const labResults = asList(useSelector(selectLabResults));
  const documents = asList(useSelector(selectDocuments));
  const timeline = asList(useSelector(selectTimeline));
  const vitals = asList(useSelector(selectVitals));
  const historyLoading = useSelector(selectHistoryLoading);

  const [activeTab, setActiveTab] = useState('records');
  const [viewRecord, setViewRecord] = useState(null);
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historySubTab, setHistorySubTab] = useState('overview');
  const [historyFetched, setHistoryFetched] = useState(false);
  const [timelineViewItem, setTimelineViewItem] = useState(null);
  const [providers, setProviders] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [homeCareVisits, setHomeCareVisits] = useState([]);
  const [loadingHomeCare, setLoadingHomeCare] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    providerId: '',
    date: '',
    slotId: '',
    notes: ''
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // ── Patient Lockbox (TPH PIM-1.1) ──────────────────────────────────────────
  const [lockboxData, setLockboxData] = useState({ lockboxActive: false, lockboxCategories: [], overrideGrantedUserIds: [] });
  const [lockboxSaving, setLockboxSaving] = useState(false);
  const [pendingCategories, setPendingCategories] = useState([]);

  const LOCKBOX_CATEGORIES = [
    { id: 'HIV_STATUS',      label: 'HIV Status',       desc: 'Hides HIV test results, diagnoses, and related medications', color: '#DC2626', bg: '#FEE2E2' },
    { id: 'MENTAL_HEALTH',  label: 'Mental Health',    desc: 'Hides psychiatric history, mental health diagnoses and notes', color: '#7C3AED', bg: '#F3E8FF' },
    { id: 'SUBSTANCE_ABUSE',label: 'Substance Use',    desc: 'Hides substance abuse history and addiction treatment records', color: '#D97706', bg: '#FEF3C7' },
    { id: 'GENETIC_INFO',   label: 'Genetic Information', desc: 'Hides genetic test results and hereditary risk factors',   color: '#059669', bg: '#D1FAE5' },
  ];

  useEffect(() => {
    if (!user?.patientId && !user?.id) return;
    const pid = user?.patientId || user?.id;
    client.get(`/api/patients/${pid}/lockbox`, { hideToast: true })
      .then(res => {
        const d = res.data || {};
        setLockboxData(d);
        setPendingCategories(d.lockboxCategories || []);
      })
      .catch(() => {});
  }, [user]);

  const handleSaveLockbox = async () => {
    const pid = user?.patientId || user?.id;
    if (!pid) return;
    setLockboxSaving(true);
    try {
      const res = await client.put(`/api/patients/${pid}/lockbox`, { categories: pendingCategories });
      setLockboxData(res.data || {});
      setPendingCategories(res.data?.lockboxCategories || []);
      dispatch(addToast({ type: 'success', message: 'Lockbox settings saved. Your privacy preferences are now active.' }));
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save lockbox settings.' }));
    } finally {
      setLockboxSaving(false);
    }
  };

  const toggleLockboxCategory = (id) => {
    setPendingCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Waitlist States
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [waitlistActionLoading, setWaitlistActionLoading] = useState(false);

  // Billing & Invoices State
  const [patientClaims, setPatientClaims] = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [selectedPayClaim, setSelectedPayClaim] = useState(null);
  const [autoPayPopupShown, setAutoPayPopupShown] = useState(false);

  const fetchPortalClaims = useCallback(() => {
    if (!user) return;
    setLoadingClaims(true);
    getPatientClaims()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.content || []);
        setPatientClaims(list);

        // Automatically popup payment modal for unpaid claims upon login
        const unpaid = list.find(c => c.status === 'SUBMITTED' || c.status === 'READY' || c.status === 'DRAFT');
        if (unpaid && !autoPayPopupShown) {
          setSelectedPayClaim(unpaid);
          setAutoPayPopupShown(true);
        }
      })
      .catch(() => setPatientClaims([]))
      .finally(() => setLoadingClaims(false));
  }, [user, autoPayPopupShown]);

  useEffect(() => {
    fetchPortalClaims();
  }, [fetchPortalClaims]);


  useEffect(() => {
    if (bookingForm.providerId && bookingForm.date) {
      setLoadingSlots(true);
      client.get('/api/scheduling/slots', {
        params: {
          providerId: bookingForm.providerId,
          date: bookingForm.date
        },
        hideToast: true
      })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.content || []);
        setAvailableSlots(list.filter(s => s.status === 'OPEN'));
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
    } else {
      setAvailableSlots([]);
    }
  }, [bookingForm.providerId, bookingForm.date]);

  const handleBook = async () => {
    if (!bookingForm.slotId) {
      dispatch(addToast({ type: 'error', message: 'Please select a time slot.' }));
      return;
    }
    setIsBooking(true);
    try {
      const pid = user?.patientId || user?.id;
      const pName = user?.fullName || user?.username || pid;
      await client.post(`/api/scheduling/slots/${bookingForm.slotId}/book`, {
        patientId: pid,
        patientName: pName,
        notes: bookingForm.notes
      });
      dispatch(addToast({ type: 'success', message: 'Appointment booked successfully!' }));
      setShowBookingModal(false);
      setBookingForm({ providerId: '', date: '', slotId: '', notes: '' });
      dispatch(fetchPortalData());
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err?.response?.data?.error || 'Booking failed.' }));
    } finally {
      setIsBooking(false);
    }
  };

  useEffect(() => {
    client.get('/api/scheduling/providers', { hideToast: true })
      .then(r => setProviders(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProviders([]));
  }, []);

  const [amendmentForm, setAmendmentForm] = useState({ recordId: '', justification: '', dataCategory: 'ALL' });
  const [restrictionForm, setRestrictionForm] = useState({ restrictionType: 'NO_MARKETING', justification: '', dataCategory: 'PHI' });

  // Aggregate vitals from clinical records for longitudinal view
  const combinedVitals = useMemo(() => {
    const extracted = records.map(r => {
      // Check if the record actually contains any vital-related fields before processing
      const hasVitalsData = VITAL_PRESENTED_FIELDS.some(f => {
        const val = r[f];
        return val !== undefined && val !== null && val !== '';
      });

      if (!hasVitalsData) return null;

      const v = buildVitals(r);
      return {
        id: `record-vital-${r.id}`,
        recordedAt: r.incidentDateTime || r.createdAt,
        systolicBP: v.systolic,
        diastolicBP: v.diastolic,
        heartRate: v.heartRate,
        oxygenSaturation: v.spo2,
        respiratoryRate: v.respiratoryRate,
        temperature: v.temperature,
        bloodGlucose: v.bloodSugar,
        glasgowComaScale: v.gcs,
        source: 'Clinical Record',
        recordId: r.id
      };
    }).filter(Boolean);

    const all = [...vitals, ...extracted];
    return all.sort((a, b) => new Date(b.recordedAt || b.createdAt || b.recordedAt) - new Date(a.recordedAt || a.createdAt || a.recordedAt));
  }, [vitals, records]);

  useEffect(() => { dispatch(fetchPortalData()); }, [dispatch]);

  useEffect(() => {
    const pid = user?.patientId || user?.id;
    if (pid) {
      dispatch(fetchAllPatientHistory(pid));
    }
  }, [user, dispatch]);

  useEffect(() => {
    if ((activeTab === 'history' || activeTab === 'documents') && user) {
      const pid = user.patientId || user.id;
      if (pid) dispatch(fetchAllPatientHistory(pid));
    }
  }, [activeTab, user, dispatch]);

  useEffect(() => {
    if (activeTab === 'homecare' && user) {
      const pid = user.patientId || user.id;
      setLoadingHomeCare(true);
      client.get(`/api/homecare/patients/${pid}/visits`)
        .then(r => setHomeCareVisits(r.data || []))
        .catch(() => setHomeCareVisits([]))
        .finally(() => setLoadingHomeCare(false));
    }
  }, [activeTab, user]);

  const fetchMyWaitlist = useCallback(async () => {
    if (!user) return;
    setLoadingWaitlist(true);
    try {
      const res = await client.get('/api/waitlist/my-entries');
      setMyWaitlist(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch waitlist:", err);
    } finally {
      setLoadingWaitlist(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'waitlist') {
      fetchMyWaitlist();
    }
  }, [activeTab, fetchMyWaitlist]);

  const handlePortalAcceptOffer = async (entryId) => {
    setWaitlistActionLoading(true);
    try {
      await client.post(`/api/waitlist/entries/${entryId}/accept-offer`);
      dispatch(addToast({ type: 'success', message: 'Offer accepted successfully. Your appointment is now scheduled!' }));
      fetchMyWaitlist();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Failed to accept offer.' }));
    } finally {
      setWaitlistActionLoading(false);
    }
  };

  const handlePortalDeclineOffer = async (entryId) => {
    setWaitlistActionLoading(true);
    try {
      await client.post(`/api/waitlist/entries/${entryId}/decline-offer`);
      dispatch(addToast({ type: 'success', message: 'Offer declined.' }));
      fetchMyWaitlist();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Failed to decline offer.' }));
    } finally {
      setWaitlistActionLoading(false);
    }
  };

  const handleCreateAmendment = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(createAmendment(amendmentForm)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Amendment request submitted.' }));
      setShowAmendmentModal(false); setAmendmentForm({ recordId: '', justification: '', dataCategory: 'ALL' });
    } catch (err) { dispatch(addToast({ type: 'error', message: err || 'Submission failed.' })); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateRestriction = async e => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await dispatch(createRestriction(restrictionForm)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Restriction requested.' }));
      setShowRestrictionModal(false); setRestrictionForm({ restrictionType: 'NO_MARKETING', justification: '', dataCategory: 'PHI' });
    } catch (err) { dispatch(addToast({ type: 'error', message: err || 'Request failed.' })); }
    finally { setIsSubmitting(false); }
  };

  const tabs = [
    { id: 'records', label: 'Clinical History', icon: History },
    { id: 'history', label: 'My Health', icon: ClipboardList },
    { id: 'billing', label: 'Billing & Invoices', icon: FileText, highlight: true },
    { id: 'documents', label: 'Documents & Scans', icon: Paperclip },
    { id: 'appointments', label: 'My Appointments', icon: Calendar },
    { id: 'homecare', label: 'Home Care Schedule', icon: Home },
    { id: 'waitlist', label: 'Waitlist Status', icon: Clock },
    { id: 'chatbot', label: 'Health Assistant', icon: Bot, highlight: true },
    { id: 'amendments', label: 'Amendments', icon: FileEdit },
    { id: 'restrictions', label: 'Privacy', icon: Ban },
    { id: 'lockbox', label: 'My Lockbox', icon: Lock, highlight: false },
    { id: 'audit', label: 'Access Logs', icon: ShieldAlert },
  ];

  const historyCounts = [
    { label: 'Conditions', value: conditions.length },
    { label: 'Medications', value: medications.length },
    { label: 'Encounters', value: encounters.length },
    { label: 'Admissions', value: admissions.length },
    { label: 'Labs', value: labResults.length },
    { label: 'Vitals', value: combinedVitals.length },
    { label: 'Documents', value: documents.length },
  ];

  const formatHistoryDate = value => value ? new Date(value).toLocaleDateString() : 'Date N/A';

  const historyEmpty = (message) => (
    <div className="rounded-xl border border-dashed border-[#DDE3F0] bg-[#F8FAFF] px-4 py-8 text-center">
      <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-[#DDE3F0]" />
      <p className="text-sm font-semibold text-[#8A97B0]">{message}</p>
    </div>
  );

  const historySectionHeader = (Icon, title, helper, colorClass = 'text-brand-blue', bgClass = 'bg-[#EEF2FF]') => (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center ${colorClass} shrink-0`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider">{title}</h3>
        <p className="mt-1 text-xs font-semibold text-[#8A97B0]">{helper}</p>
      </div>
    </div>
  );

  const Section = ({ icon: Icon, title, helper, children }) => (
    <div className="bg-white border border-[#DDE3F0] rounded-[24px] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#DDE3F0] px-8 py-6">
        {historySectionHeader(Icon, title, helper)}
      </div>
      <div className="p-8">{children}</div>
    </div>
  );

  const [inlinePortalDoc, setInlinePortalDoc] = useState(null);

  const viewSecureDocument = async (pid, docId, title) => {
    if (!docId || !pid) return;
    try {
      const res = await client.get(
        `/api/patients/${pid}/history/documents/${docId}/signed-url`,
        { hideToast: true }
      );
      const url = res.data?.url || res.data;
      if (url) {
        setInlinePortalDoc({
          title: title || `Medical Document #${docId}`,
          url,
          docId
        });
      }
    } catch (err) {
      const status = err.response?.status;
      const message = status === 404
        ? 'This document was stored on a previous server and must be re-uploaded to be accessible.'
        : (err.response?.data?.message || 'Unable to open document. Please try again or contact support.');
      dispatch(addToast({ type: 'error', message }));
    }
  };

  const handleViewHistoryItem = (item, type) => {
    // Map history item to timeline format for the existing modal
    const mapped = {
      ...item,
      eventType: type,
      title: item.conditionName || item.medicationName || item.testName || item.encounterType || item.hospital || item.fileName || type,
      description: item.notes || item.reason || item.description || '',
      date: item.onsetDate || item.date || item.encounterDate || item.admissionDate || item.resultDate || item.timestamp || item.recordedAt || item.createdAt,
      metadata: { ...item }
    };
    setTimelineViewItem(mapped);
  };

  const HistoryRowActions = ({ item, type }) => (
    <div className="flex shrink-0 items-center gap-3">
      <button
        type="button"
        onClick={() => handleViewHistoryItem(item, type)}
        className="w-10 h-10 rounded-xl bg-white border border-[#DDE3F0] flex items-center justify-center text-[#8A97B0] hover:bg-[#F8FAFF] hover:text-brand-red transition-all"
      >
        <Eye size={16} />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-10 animate-fade-in w-full max-w-[1400px] mx-auto px-2 sm:px-4 lg:px-6">
      {/* Unpaid Bill Top Alert Banner */}
      {patientClaims.some(c => c.status === 'SUBMITTED' || c.status === 'READY' || c.status === 'DRAFT') && (
        <div className="bg-gradient-to-r from-[#1A3C8F] via-[#0F1A3A] to-indigo-900 rounded-[24px] p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-blue-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <CreditCard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-black">
                  Action Required
                </span>
                <span className="text-xs font-bold text-blue-200">Payment Due</span>
              </div>
              <p className="text-base font-extrabold text-white mt-1">
                You have {patientClaims.filter(c => c.status === 'SUBMITTED' || c.status === 'READY' || c.status === 'DRAFT').length} unpaid medical invoice(s) ready for settlement.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const unpaid = patientClaims.find(c => c.status === 'SUBMITTED' || c.status === 'READY' || c.status === 'DRAFT');
              if (unpaid) setSelectedPayClaim(unpaid);
            }}
            className="w-full sm:w-auto bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg hover:shadow-amber-400/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <CreditCard size={16} />
            <span>Pay Bill Now (₹ INR)</span>
          </button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-[32px] border border-[#DDE3F0] p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-[24px] bg-brand-blue flex items-center justify-center text-white shadow-2xl shadow-brand-blue/30 overflow-hidden group">
                <User size={40} className="group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-green-500 border-4 border-white flex items-center justify-center text-white shadow-lg">
                <Check size={16} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="px-3 py-1 bg-blue-50 text-brand-blue text-[10px] font-black uppercase tracking-[0.2em] rounded-lg border border-blue-100 shadow-sm">Patient Portal</span>
                <span className="w-1 h-1 rounded-full bg-[#DDE3F0]" />
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-widest">Active Session</span>
              </div>
              <h1 className="text-4xl font-black text-[#0F1A3A] tracking-tight leading-none mb-2">{user?.firstName} {user?.lastName}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-green-500" />
                  <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Identity Verified</p>
                </div>
                <div className="w-1 h-1 rounded-full bg-[#DDE3F0]" />
                <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-widest">Patient ID: <span className="font-mono text-brand-blue">#{safeUpperId(user?.id)}</span></p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowAmendmentModal(true)} className="group flex items-center gap-3 bg-[#F8FAFF] border border-[#DDE3F0] px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest text-[#4B5A7A] hover:bg-white hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm hover:shadow-md">
              <FileEdit size={18} className="text-[#A0AECB] group-hover:text-brand-blue transition-colors" /> Request Amendment
            </button>
            <button onClick={() => setShowRestrictionModal(true)} className="group flex items-center gap-3 bg-brand-red text-white px-6 py-4 rounded-[20px] text-xs font-black uppercase tracking-widest hover:bg-red-800 transition-all shadow-xl shadow-red-900/10 hover:shadow-red-900/20">
              <Ban size={18} /> Manage Privacy
            </button>
          </div>
        </div>
      </div>


      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="lg:w-72 shrink-0 space-y-4">
          {/* Sidebar Navigation */}
          <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-3 shadow-sm space-y-1.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setViewRecord(null); }}
                className={`group w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${
                  activeTab === t.id
                    ? t.highlight ? 'bg-gradient-to-r from-[#1A3C8F]/10 to-purple-50 text-[#1A3C8F] border border-[#1A3C8F]/20' : 'bg-[#EEF2FF] text-brand-blue'
                    : 'text-[#8A97B0] hover:bg-[#F8FAFF] hover:text-[#4B5A7A]'
                }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    activeTab === t.id
                      ? t.highlight ? 'bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] text-white shadow-lg shadow-brand-blue/30 scale-110' : 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 scale-110'
                      : t.highlight ? 'bg-gradient-to-br from-[#1A3C8F]/10 to-purple-50 text-[#1A3C8F] group-hover:from-[#1A3C8F]/20' : 'bg-[#F8FAFF] text-[#A0AECB] group-hover:bg-blue-50 group-hover:text-brand-blue'
                  }`}>
                    <t.icon size={20} />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className={`text-sm tracking-tight ${activeTab === t.id ? 'font-black' : 'font-bold'}`}>{t.label}</span>
                    {t.highlight && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#1A3C8F]/60">AI Powered</span>
                    )}
                  </div>
                </div>
                {activeTab === t.id ? (
                  <div className={`w-1.5 h-6 rounded-full shadow-sm ${t.highlight ? 'bg-gradient-to-b from-[#1A3C8F] to-purple-500' : 'bg-brand-blue'}`} />
                ) : (
                  t.highlight
                    ? <Sparkles size={14} className="text-[#1A3C8F]/40 group-hover:text-[#1A3C8F] transition-colors" />
                    : <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>

          {/* Patient Health Quick Summary Card */}
          <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-5 shadow-sm space-y-4 overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-brand-blue/5 to-purple-50 blur-xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="text-brand-red" size={16} />
                <h4 className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">My Health Summary</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Records', value: records.length, icon: FileText, color: 'text-brand-blue', bg: 'bg-blue-50' },
                  { label: 'Conditions', value: conditions.length, icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50' },
                  { label: 'Medications', value: medications.length, icon: Pill, color: 'text-purple-500', bg: 'bg-purple-50' },
                  { label: 'Lab Results', value: labResults.length, icon: FlaskConical, color: 'text-green-500', bg: 'bg-green-50' },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl border border-[#EEF2FF] bg-[#F8FAFF] p-3 flex flex-col items-start gap-1.5">
                    <div className={`w-7 h-7 ${item.bg} ${item.color} rounded-lg flex items-center justify-center`}>
                      <item.icon size={14} />
                    </div>
                    <p className="text-lg font-black text-[#0F1A3A] leading-none">{item.value}</p>
                    <p className="text-[9px] font-black text-[#A0AECB] uppercase tracking-wider">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-[#F0F4FC] mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Records Synced</span>
                </div>
                <span className="text-[10px] font-bold text-[#A0AECB]">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Ask AI CTA */}
          {activeTab !== 'chatbot' && (
            <button
              onClick={() => { setActiveTab('chatbot'); setViewRecord(null); }}
              className="w-full rounded-[24px] bg-gradient-to-br from-[#0F1A3A] to-[#1A3C8F] p-4 flex items-center gap-3 shadow-xl shadow-brand-blue/20 hover:shadow-brand-blue/30 hover:scale-[1.02] active:scale-[0.98] transition-all group border border-[#1A3C8F]/30"
            >
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/25 transition-colors">
                <Bot size={20} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-black text-white tracking-tight">Health Assistant</p>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Ask anything • AI Powered</p>
              </div>
              <Sparkles size={16} className="text-yellow-300 shrink-0 group-hover:rotate-12 transition-transform" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="animate-spin w-10 h-10 mx-auto mb-4 text-[#A0AECB]" />
              <p className="text-sm font-semibold text-[#8A97B0]">Loading records…</p>
            </div>
          ) : viewRecord ? (
            <div className="space-y-4">
              <button onClick={() => setViewRecord(null)} className="btn-ghost px-3 py-2 text-sm text-[#4B5A7A]">
                <ArrowLeft size={16} /> Back to Records
              </button>
              <MedicalDocument data={viewRecord} onViewDocument={viewSecureDocument} />
            </div>
          ) : activeTab === 'documents' ? (
            <PatientDocumentGallery
              documents={documents}
              records={records}
              patientId={user?.patientId || user?.id}
              onViewDocument={viewSecureDocument}
            />
          ) : activeTab === 'homecare' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Header Title */}
              <div className="bg-white rounded-[32px] border border-[#DDE3F0] p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 rounded-full bg-brand-blue/5 blur-3xl pointer-events-none" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Home size={28} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Home Care Schedule & History</h2>
                      <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mt-0.5">Track your upcoming nurse visits and view clinical progress notes</p>
                    </div>
                  </div>
                  <span className="px-4 py-2 bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl text-xs font-black text-[#4B5A7A] uppercase tracking-wider shadow-sm">
                    {homeCareVisits.length} Total Visits Scheduled
                  </span>
                </div>
              </div>

              {/* Visits List */}
              {loadingHomeCare ? (
                <div className="py-20 text-center bg-white rounded-[32px] border border-[#DDE3F0] shadow-sm">
                  <RefreshCw className="animate-spin w-10 h-10 mx-auto mb-4 text-brand-blue" />
                  <p className="text-sm font-semibold text-[#8A97B0]">Retrieving home care schedule...</p>
                </div>
              ) : homeCareVisits.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[32px] border border-dashed border-[#DDE3F0] shadow-sm">
                  <CalendarDays size={48} className="mx-auto mb-4 text-[#DDE3F0] animate-bounce" />
                  <h3 className="text-lg font-black text-[#0F1A3A] mb-1">No Active Schedules</h3>
                  <p className="text-xs text-[#8A97B0] font-semibold max-w-sm mx-auto leading-relaxed">You do not have any home care visits scheduled yet. Visits are automatically generated once a doctor activates your referral.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {homeCareVisits.map(visit => {
                    const isCompleted = visit.status === 'COMPLETED';
                    const isMissed = visit.status === 'MISSED';
                    const isUnassigned = visit.status === 'UNASSIGNED';
                    const isAssigned = visit.status === 'ASSIGNED';

                    let borderAccent = 'border-l-4 border-l-blue-500';
                    let statusLabel = 'Scheduled';
                    let statusBadgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';

                    if (isCompleted) {
                      borderAccent = 'border-l-4 border-l-emerald-500';
                      statusLabel = 'Completed';
                      statusBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    } else if (isMissed) {
                      borderAccent = 'border-l-4 border-l-rose-500';
                      statusLabel = 'Missed Visit';
                      statusBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                    } else if (isUnassigned) {
                      borderAccent = 'border-l-4 border-l-amber-500';
                      statusLabel = 'Pending Assignment';
                      statusBadgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                    } else if (isAssigned) {
                      borderAccent = 'border-l-4 border-l-indigo-500';
                      statusLabel = 'Nurse Scheduled';
                      statusBadgeStyle = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                    }

                    // Prettify slots
                    let prettySlot = visit.timeWindow || '08:00 - 12:00 (Morning)';
                    if (prettySlot === '08:00-12:00') prettySlot = '08:00 AM - 12:00 PM (Morning)';
                    if (prettySlot === '12:00-16:00') prettySlot = '12:00 PM - 04:00 PM (Afternoon)';
                    if (prettySlot === '16:00-20:00') prettySlot = '04:00 PM - 08:00 PM (Evening)';

                    return (
                      <div 
                        key={visit.id} 
                        className={`bg-white rounded-3xl border border-[#DDE3F0] ${borderAccent} p-6 shadow-sm hover:shadow-xl hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between`}
                      >
                        <div className="space-y-4">
                          {/* Top row */}
                          <div className="flex justify-between items-center gap-3">
                            <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest font-mono bg-blue-50/50 px-2.5 py-1 rounded-lg border border-blue-100/50">
                              Visit: #{safeUpperId(visit.id, 8)}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusBadgeStyle} shadow-sm`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* Info Rows */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-3 border-t border-b border-[#F0F4FC]">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-[#8A97B0] uppercase tracking-wider block">🗓️ Date</span>
                              <p className="text-xs font-black text-[#0F1A3A]">
                                {visit.visitDate ? new Date(visit.visitDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-[#8A97B0] uppercase tracking-wider block">⏰ Time slot</span>
                              <p className="text-xs font-extrabold text-brand-blue">{prettySlot}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-[#8A97B0] uppercase tracking-wider block">🩺 Assigned Nurse</span>
                              <p className="text-xs font-black text-[#0F1A3A]">{visit.assignedNurseName || 'Waiting to assign...'}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-[#8A97B0] uppercase tracking-wider block">📍 Location</span>
                              <p className="text-xs font-black text-[#0F1A3A]">{visit.community}</p>
                            </div>
                          </div>

                          {/* Instructions */}
                          {visit.careInstructions && (
                            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1">
                              <span className="text-[9px] font-black text-[#8A97B0] uppercase tracking-wider block">📋 Clinical Instructions</span>
                              <p className="text-xs font-bold text-[#5A6A8A] leading-relaxed italic">"{visit.careInstructions}"</p>
                            </div>
                          )}

                          {/* Notes */}
                          {visit.visitNotes && (
                            <div className="bg-emerald-50/20 border border-emerald-100/50 p-3.5 rounded-2xl space-y-1">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">📝 Nurse Treatment Notes</span>
                              <p className="text-xs font-bold text-emerald-800 leading-relaxed">"{visit.visitNotes}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'waitlist' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-8 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#0F1A3A] tracking-tight">My Waitlist Status</h2>
                    <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mt-0.5">Track your active waitlist queue and accept slots offered to you</p>
                  </div>
                </div>
              </div>

              {loadingWaitlist ? (
                <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-12 text-center shadow-sm">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-blue mb-2" />
                  <p className="text-sm font-semibold text-[#8A97B0]">Loading waitlist information...</p>
                </div>
              ) : myWaitlist.length === 0 ? (
                <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-16 text-center shadow-sm">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-[#DDE3F0]" />
                  <h3 className="text-lg font-black text-[#0F1A3A] mb-2">You are not currently in any Waitlist</h3>
                  <p className="text-xs text-[#8A97B0] font-bold max-w-md mx-auto leading-relaxed">
                    If you need to book an appointment and there are no slots available, ask our staff to add you to the waitlist.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myWaitlist.map(entry => {
                    const isOffered = entry.status === 'OFFERED';
                    const isScheduled = entry.status === 'SCHEDULED';
                    const isWaiting = entry.status === 'WAITING';

                    return (
                      <div 
                        key={entry.id} 
                        className={`bg-white rounded-[28px] border border-[#DDE3F0] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
                          isOffered ? 'ring-2 ring-violet-500 bg-violet-50/10' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-[#A0AECB]">
                              Facility: <span className="text-[#0F1A3A]">{entry.facilityId || '—'}</span>
                            </span>
                            <span className="w-1 h-1 rounded-full bg-[#DDE3F0]" />
                            <span className="text-xs font-black uppercase tracking-wider text-[#A0AECB]">
                              Service: <span className="text-[#0F1A3A]">{entry.serviceType?.replace(/_/g, ' ') || '—'}</span>
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-[#0F1A3A] line-clamp-1 leading-tight">
                            {entry.reasonForVisit || 'Checkup / Appointment Waitlist'}
                          </h3>

                          <div className="flex items-center gap-3 text-xs">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              isOffered 
                                ? 'bg-violet-100 text-violet-700 border border-violet-200'
                                : isScheduled 
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-100 text-brand-blue border border-blue-200'
                            }`}>
                              {entry.status}
                            </span>
                            <span className="text-[#A0AECB] font-bold">
                              Added: {new Date(entry.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {entry.notes && (
                            <p className="text-xs text-[#8A97B0] leading-relaxed bg-[#F8FAFF] p-3 rounded-xl border border-[#EEF2FF]">
                              <span className="font-bold text-[#4B5A7A]">Notes: </span>"{entry.notes}"
                            </p>
                          )}
                        </div>

                        {/* Offers/Actions section */}
                        {isOffered && (
                          <div className="shrink-0 bg-violet-100/50 border border-violet-200 rounded-2xl p-4 flex flex-col gap-3 md:w-80">
                            <div className="flex items-center gap-2">
                              <Zap size={14} className="text-violet-600 animate-pulse" />
                              <p className="text-xs font-black text-violet-700 uppercase tracking-wider">Slot Offer Active!</p>
                            </div>
                            <div className="text-xs text-violet-800">
                              <p className="font-bold">Expires At:</p>
                              <p className="font-mono">{new Date(entry.offerExpiresAt).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                disabled={waitlistActionLoading}
                                onClick={() => handlePortalAcceptOffer(entry.id)}
                                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-violet-500/20"
                              >
                                {waitlistActionLoading ? <RefreshCw size={12} className="animate-spin" /> : <Check size={14} />}
                                Accept
                              </button>
                              <button
                                disabled={waitlistActionLoading}
                                onClick={() => handlePortalDeclineOffer(entry.id)}
                                className="flex-1 py-2 rounded-xl bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        )}

                        {isScheduled && (
                          <div className="shrink-0 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Scheduled</p>
                              <p className="text-[10px] text-emerald-500 font-mono">Appt ID: #{entry.scheduledAppointmentId?.substring(0, 12)}</p>
                            </div>
                          </div>
                        )}

                        {isWaiting && (
                          <div className="shrink-0 bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-center min-w-[120px]">
                            <p className="text-2xl font-black text-brand-blue">Waiting</p>
                            <p className="text-[9px] text-[#A0AECB] font-black uppercase tracking-widest mt-0.5">Position Pending</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'appointments' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
              {/* Header Title */}
              <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-2xl flex items-center justify-center">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-[#0F1A3A] tracking-tight">My Scheduled Appointments</h2>
                      <p className="text-xs text-[#8A97B0] font-bold uppercase tracking-wider mt-0.5">Clinical visits, specialist rotations & medical travel coordination</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="px-5 py-3 rounded-2xl bg-brand-blue text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 shrink-0"
                  >
                    <Plus size={15} /> Book Appointment
                  </button>
                </div>
              </div>

              {/* Grid Layout: Appointments & Travel Bundles */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Appointments & History Section */}
                <div className="space-y-6">
                  {/* Upcoming Visits */}
                  <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                      <h3 className="text-lg font-black text-[#0F1A3A] flex items-center gap-2">
                        <Clock size={18} className="text-brand-blue" /> Upcoming Visits
                      </h3>
                      <span className="px-2.5 py-1 bg-blue-50 text-brand-blue rounded-lg text-[10px] font-bold border border-blue-100">
                        {upcomingAppointments.length} Scheduled
                      </span>
                    </div>

                    {upcomingAppointments.length === 0 ? (
                      <div className="py-16 text-center text-[#8A97B0] font-bold">
                        <CalendarDays size={40} className="mx-auto mb-3 text-[#DDE3F0]" />
                        No upcoming appointments found.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                        {upcomingAppointments.map(appt => (
                          <div key={appt.id} className="p-4 bg-[#F8FAFF] rounded-2xl border border-[#EEF2FF] space-y-3 hover:border-brand-blue/30 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest font-mono">
                                Appt: #{safeUpperId(appt.id)}
                              </span>
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest bg-blue-50 text-blue-700 border-blue-200">
                                {appt.status}
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-[#4B5A7A] flex items-center gap-2">
                                <UserRound size={14} className="text-[#A0AECB]" />
                                Doctor: <span className="font-extrabold text-[#0F1A3A]">
                                  {(() => {
                                    const doc = providers.find(p => p.id === appt.providerId);
                                    return doc ? `Dr. ${doc.fullName}` : `Doctor (${appt.providerId})`;
                                  })()}
                                </span>
                              </p>
                              <p className="text-xs font-bold text-[#4B5A7A] flex items-center gap-2">
                                <MapPin size={14} className="text-[#A0AECB]" />
                                Facility ID: <span className="font-extrabold text-[#0F1A3A]">{appt.facilityId || 'Hub Center'}</span>
                              </p>
                              <p className="text-xs font-bold text-[#4B5A7A] flex items-center gap-2">
                                <Calendar size={14} className="text-[#A0AECB]" />
                                Time Slot: <span className="font-extrabold text-[#0F1A3A]">{new Date(appt.scheduledStart).toLocaleString()}</span>
                              </p>
                            </div>

                            {appt.reasonForVisit && (
                              <div className="bg-white p-3 rounded-xl border border-[#EEF2FF] text-xs font-bold text-[#6B7A99] italic">
                                Reason: "{appt.reasonForVisit}"
                              </div>
                            )}

                            {appt.status === 'SCHEDULED' && (
                              <button
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to cancel this appointment?')) {
                                    try {
                                      await client.patch(`/api/patient-portal/appointments/${appt.id}/cancel`);
                                      dispatch(fetchPortalData());
                                      dispatch(addToast({ type: 'success', message: 'Appointment cancelled successfully.' }));
                                    } catch (err) {
                                      dispatch(addToast({ type: 'error', message: 'Failed to cancel appointment.' }));
                                    }
                                  }
                                }}
                                className="w-full py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#E11D48] hover:text-white transition-all hover:shadow-sm"
                              >
                                Cancel Appointment
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visit History */}
                  <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                      <h3 className="text-lg font-black text-[#0F1A3A] flex items-center gap-2">
                        <History size={18} className="text-[#8A97B0]" /> Visit History
                      </h3>
                      <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold border border-gray-200">
                        {pastAppointments.length} Total
                      </span>
                    </div>

                    {pastAppointments.length === 0 ? (
                      <div className="py-12 text-center text-[#8A97B0] font-bold">
                        <History size={36} className="mx-auto mb-2 text-[#DDE3F0]" />
                        No past visits found.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        {pastAppointments.map(appt => (
                          <div key={appt.id} className="p-4 bg-[#F8FAFF]/60 rounded-2xl border border-[#EEF2FF] space-y-3 opacity-80 hover:opacity-100 transition-all">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest font-mono">
                                Appt: #{safeUpperId(appt.id)}
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-widest ${
                                appt.status === 'CANCELLED' ? 'bg-red-50 text-red-700 border-red-200' :
                                appt.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                                {appt.status === 'SCHEDULED' ? 'EXPIRED' : appt.status}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-600">
                              <p className="font-bold flex items-center gap-2">
                                <UserRound size={14} className="text-[#A0AECB]" />
                                Doctor: <span className="font-extrabold text-[#0F1A3A]">
                                  {(() => {
                                    const doc = providers.find(p => p.id === appt.providerId);
                                    return doc ? `Dr. ${doc.fullName}` : `Doctor (${appt.providerId})`;
                                  })()}
                                </span>
                              </p>
                              <p className="font-bold flex items-center gap-2">
                                <Calendar size={14} className="text-[#A0AECB]" />
                                Time Slot: <span className="font-extrabold text-[#0F1A3A]">{new Date(appt.scheduledStart).toLocaleString()}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Travel Bundles Section */}
                <div className="bg-white rounded-[28px] border border-[#DDE3F0] p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                    <h3 className="text-lg font-black text-[#0F1A3A] flex items-center gap-2">
                      <Plane size={18} className="text-brand-blue" /> Coordinated Travel Bundles
                    </h3>
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-bold border border-purple-100">
                      NWT Logistics
                    </span>
                  </div>

                  {travelBundles.length === 0 ? (
                    <div className="py-16 text-center text-[#8A97B0] font-bold">
                      <Plane size={40} className="mx-auto mb-3 text-[#DDE3F0]" />
                      No travel bundles found on file.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                      {travelBundles.map(bundle => (
                        <div key={bundle.id} className="p-4 bg-gradient-to-br from-blue-50/20 to-purple-50/20 rounded-2xl border border-[#EEF2FF] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest font-mono">
                              Bundle: #{safeUpperId(bundle.id)}
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200 uppercase tracking-widest">
                              {bundle.status || 'PLANNED'}
                            </span>
                          </div>

                          <div className="space-y-1.5 text-xs text-[#4B5A7A]">
                            <p className="font-bold">
                              Origin: <span className="text-[#0F1A3A] font-black">{bundle.homeFacilityId || 'Home Community'}</span>
                            </p>
                            <p className="font-bold">
                              Destination: <span className="text-[#0F1A3A] font-black">{bundle.destinationFacilityId || 'Yellowknife Hub'}</span>
                            </p>
                            <p className="font-bold">
                              Date of Travel: <span className="text-[#0F1A3A] font-black">{bundle.travelDate}</span>
                            </p>
                            {bundle.medicalTravelApprovalRef && (
                              <p className="font-mono text-[10px] bg-white px-2 py-1 rounded-lg border border-[#EEF2FF] text-[#0F1A3A] font-black inline-block mt-1">
                                Travel Code: {bundle.medicalTravelApprovalRef}
                              </p>
                            )}
                          </div>

                          <div className="bg-white p-4 rounded-xl border border-[#EEF2FF] space-y-2">
                            <p className="text-[9px] font-black text-[#A0AECB] uppercase tracking-widest">Coordinated Appts</p>
                            <div className="space-y-1.5">
                              {bundle.appointmentIds?.map((apptId) => (
                                <p key={apptId} className="text-xs font-bold text-brand-blue flex items-center gap-1">
                                  <Check size={12} /> Appointment #{safeUpperId(apptId)}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'records' ? (
            <div className="space-y-4">
              <IncidentAnalytics records={records} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {records.length === 0 ? (
                  <div className="col-span-full py-20 text-center bg-[#F8FAFF] rounded-2xl border border-dashed border-[#DDE3F0]">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-[#DDE3F0]" />
                    <p className="text-sm font-black text-[#8A97B0]">No clinical records found on file.</p>
                  </div>
                ) : records.map(r => (
                  <div 
                    key={r.id} 
                    onClick={() => setViewRecord(r)} 
                    className="group relative bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-blue/5 hover:border-brand-blue/30 transition-all cursor-pointer flex flex-col h-full"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={22} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-1">Date of Care</p>
                        <span className="text-xs font-bold text-[#0F1A3A] bg-[#F8FAFF] px-3 py-1 rounded-lg border border-[#EEF2FF]">
                          {new Date(r.incidentDateTime || r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-[#0F1A3A] mb-2 group-hover:text-brand-blue transition-colors line-clamp-2 leading-tight">
                      {r.diagnosis || 'Diagnosis Pending'}
                    </h3>
                    
                    <div className="flex items-center gap-2 mb-8 text-[#8A97B0]">
                      <MapPin size={14} className="shrink-0" />
                      <p className="text-xs font-bold truncate uppercase tracking-wider">
                        {r.incidentLocation || 'Clinical Facility'}
                      </p>
                    </div>

                    <div className="mt-auto pt-5 border-t border-[#F0F4FC] flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-1">Incident Number</p>
                        <span className="text-[10px] font-mono font-bold text-brand-blue">#{safeUpperId(r.id, 12)}</span>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-[#F8FAFF] border border-[#EEF2FF] flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          ) : activeTab === 'amendments' ? (
            <div className="space-y-4">
              {amendments.length === 0 ? (
                <div className="py-20 text-center bg-[#F8FAFF] rounded-2xl border border-dashed border-[#DDE3F0]">
                  <FileEdit className="w-16 h-16 mx-auto mb-4 text-[#DDE3F0]" />
                  <p className="text-sm font-black text-[#8A97B0]">No amendment requests on file.</p>
                </div>
              ) : amendments.map(a => (
                <div key={a.id} className="group bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-blue/5 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-brand-blue">
                        <FileEdit size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-1">Record Reference</p>
                        <p className="text-sm font-mono text-brand-blue font-bold">#{safeUpperId(a.recordId, 16)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        a.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : 
                        a.status === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : 
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {a.status}
                      </span>
                      <span className="text-xs font-bold text-[#8A97B0]">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="bg-[#F8FAFF] p-5 rounded-2xl border border-[#EEF2FF]">
                    <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-2">Request Justification</p>
                    <p className="text-sm font-bold text-[#4B5A7A] italic leading-relaxed">"{a.justification}"</p>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-8">
              {historyLoading ? (
                <div className="py-20 text-center card bg-white rounded-2xl border border-[#DDE3F0]">
                  <RefreshCw className="animate-spin w-12 h-12 mx-auto mb-4 text-brand-blue/30" />
                  <p className="text-sm font-bold text-[#8A97B0]">Loading history record...</p>
                </div>
              ) : (
                <>
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                    {[
                      { label: 'Conditions', value: conditions.length, icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-50' },
                      { label: 'Medications', value: medications.length, icon: Pill, color: 'text-blue-500', bg: 'bg-blue-50' },
                      { label: 'Visits', value: encounters.length, icon: UserRound, color: 'text-purple-500', bg: 'bg-purple-50' },
                      { label: 'Admissions', value: admissions.length, icon: BedDouble, color: 'text-orange-500', bg: 'bg-orange-50' },
                      { label: 'Lab Results', value: labResults.length, icon: FlaskConical, color: 'text-green-500', bg: 'bg-green-50' },
                      { label: 'Documents', value: documents.length, icon: FileText, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                      { label: 'Vitals', value: combinedVitals.length, icon: Activity, color: 'text-rose-500', bg: 'bg-rose-50' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white p-5 rounded-2xl border border-[#DDE3F0] shadow-sm hover:shadow-md transition-all group">
                        <div className={`w-9 h-9 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                          <stat.icon size={18} />
                        </div>
                        <p className="text-2xl font-black text-[#0F1A3A] mb-0.5">{stat.value}</p>
                        <p className="text-[9px] font-black text-[#A0AECB] uppercase tracking-widest">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Horizontal Navigation Tabs */}
                  <div className="flex flex-wrap items-center gap-2 p-1 bg-white border border-[#DDE3F0] rounded-2xl shadow-sm">
                    {[
                      ['overview', 'Overview', History],
                      ['conditions', 'Conditions', HeartPulse],
                      ['medications', 'Medications', Pill],
                      ['encounters', 'Encounters', UserRound],
                      ['admissions', 'Admissions', BedDouble],
                      ['labs', 'Labs', FlaskConical],
                      ['vitals', 'Vitals', Activity],
                      ['documents', 'Documents', FileText],
                      ['timeline', 'Timeline', Clock],
                    ].map(([id, label, Icon]) => (
                      <button
                        key={id}
                        onClick={() => setHistorySubTab(id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-bold ${historySubTab === id
                            ? 'bg-brand-red text-white shadow-lg shadow-red-900/20'
                            : 'text-[#8A97B0] hover:bg-[#F8FAFF] hover:text-[#4B5A7A]'
                          }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* History Content Sections */}
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {historySubTab === 'overview' && (
                      <div className="space-y-6">
                        {/* Welcome Banner */}
                        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0F1A3A] via-[#1A3C8F] to-[#2952CC] p-8 shadow-2xl shadow-brand-blue/20">
                          <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl -translate-y-16 translate-x-16" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-300 blur-2xl translate-y-8 -translate-x-8" />
                          </div>
                          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em]">Health Dashboard</span>
                              </div>
                              <h2 className="text-2xl font-black text-white leading-tight">
                                Welcome back, {user?.firstName || 'Patient'}! 👋
                              </h2>
                              <p className="text-sm font-semibold text-blue-100/80 max-w-md leading-relaxed">
                                Your health records are up to date. Here's a summary of your current health status.
                              </p>
                            </div>
                            <button
                              onClick={() => { setActiveTab('chatbot'); setViewRecord(null); }}
                              className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white/15 border border-white/25 text-white font-black text-xs uppercase tracking-wider hover:bg-white/25 transition-all hover:scale-105 active:scale-95 shadow-lg shrink-0"
                            >
                              <Bot size={18} />
                              Ask Health AI
                              <Sparkles size={14} className="text-yellow-300" />
                            </button>
                          </div>
                        </div>

                        {/* Health Snapshot Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { label: 'Active Conditions', value: conditions.filter(c => c.status === 'ACTIVE' || !c.status).length, icon: HeartPulse, color: '#C8102E', bg: '#FEE2E2', desc: conditions.length > 0 ? `${conditions.length} total on record` : 'No conditions found' },
                            { label: 'Current Medications', value: medications.length, icon: Pill, color: '#7C3AED', bg: '#F3E8FF', desc: medications.length > 0 ? `${medications.slice(0,1).map(m => m.medicationName || m.name)[0] || 'View all'}` : 'No active medications' },
                            { label: 'Lab Results', value: labResults.length, icon: FlaskConical, color: '#059669', bg: '#D1FAE5', desc: labResults.length > 0 ? `Last: ${formatHistoryDate(labResults[0]?.resultDate || labResults[0]?.date)}` : 'No results on file' },
                            { label: 'Clinical Visits', value: encounters.length, icon: UserRound, color: '#0891B2', bg: '#CFFAFE', desc: encounters.length > 0 ? `Last: ${formatHistoryDate(encounters[0]?.encounterDate || encounters[0]?.date)}` : 'No visits recorded' },
                          ].map((stat, i) => (
                            <div key={i} className="bg-white rounded-[20px] border border-[#DDE3F0] p-5 shadow-sm hover:shadow-lg hover:shadow-brand-blue/5 transition-all group">
                              <div className="flex items-start justify-between mb-4">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: stat.bg, color: stat.color }}>
                                  <stat.icon size={22} />
                                </div>
                              </div>
                              <p className="text-3xl font-black text-[#0F1A3A] mb-0.5">{stat.value}</p>
                              <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider mb-1">{stat.label}</p>
                              <p className="text-[10px] font-semibold text-[#8A97B0] truncate">{stat.desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* Two-column: Active Conditions + Recent Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Active Conditions */}
                          <div className="bg-white rounded-[24px] border border-[#DDE3F0] overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F4FC]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-brand-red">
                                  <HeartPulse size={18} />
                                </div>
                                <div>
                                  <h3 className="text-sm font-black text-[#0F1A3A]">My Conditions</h3>
                                  <p className="text-[10px] font-bold text-[#A0AECB]">Ongoing health issues</p>
                                </div>
                              </div>
                              <button onClick={() => setHistorySubTab('conditions')} className="text-[10px] font-black text-brand-blue uppercase tracking-wider hover:underline">View All</button>
                            </div>
                            <div className="p-5 space-y-3">
                              {conditions.length === 0 ? (
                                <div className="py-6 text-center">
                                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                                  <p className="text-sm font-bold text-[#8A97B0]">No conditions recorded 🎉</p>
                                </div>
                              ) : conditions.slice(0, 3).map((c, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFF] border border-[#EEF2FF] hover:border-brand-blue/20 transition-all">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.status === 'ACTIVE' ? 'bg-brand-red' : 'bg-[#8A97B0]'}`} />
                                    <span className="text-sm font-bold text-[#0F1A3A] truncate">{c.conditionName || c.name}</span>
                                  </div>
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shrink-0 ml-2 ${c.status === 'ACTIVE' ? 'bg-red-50 text-brand-red' : 'bg-[#EEF2FF] text-[#4B5A7A]'}`}>
                                    {c.status || 'Active'}
                                  </span>
                                </div>
                              ))}
                              {conditions.length > 3 && (
                                <button onClick={() => setHistorySubTab('conditions')} className="w-full py-2 text-[10px] font-black text-brand-blue uppercase tracking-wider hover:bg-blue-50 rounded-xl transition-colors">
                                  +{conditions.length - 3} more conditions
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Recent Clinical Activity */}
                          <div className="bg-white rounded-[24px] border border-[#DDE3F0] overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F4FC]">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-brand-blue">
                                  <Clock size={18} />
                                </div>
                                <div>
                                  <h3 className="text-sm font-black text-[#0F1A3A]">Recent Activity</h3>
                                  <p className="text-[10px] font-bold text-[#A0AECB]">Latest clinical events</p>
                                </div>
                              </div>
                              <button onClick={() => setHistorySubTab('timeline')} className="text-[10px] font-black text-brand-blue uppercase tracking-wider hover:underline">Full Timeline</button>
                            </div>
                            <div className="p-5 space-y-3">
                              {timeline.length === 0 ? (
                                <div className="py-6 text-center">
                                  <Clock className="w-10 h-10 mx-auto mb-2 text-[#DDE3F0]" />
                                  <p className="text-sm font-bold text-[#8A97B0]">No recent activity</p>
                                </div>
                              ) : timeline.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-[#F8FAFF] border border-[#EEF2FF] hover:border-brand-blue/20 transition-all group">
                                  <div className="w-2 h-2 rounded-full bg-brand-blue mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-[#0F1A3A] truncate">{item.title || item.type}</p>
                                    <p className="text-[10px] font-semibold text-[#A0AECB]">{formatHistoryDate(item.date || item.timestamp)}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Wellness Tips Banner */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-[24px] border border-emerald-100 p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                              <Zap size={20} />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-black text-emerald-800 mb-1">💡 Health Tip of the Day</h4>
                              <p className="text-sm font-semibold text-emerald-700 leading-relaxed">
                                Stay hydrated and take your medications on schedule. Your health assistant can help you understand your prescriptions and track your wellness goals.
                              </p>
                              <button
                                onClick={() => { setActiveTab('chatbot'); setViewRecord(null); }}
                                className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-700 uppercase tracking-wider hover:text-emerald-900 transition-colors"
                              >
                                <Bot size={14} />
                                Chat with Health AI <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {historySubTab === 'conditions' && (
                      <Section icon={HeartPulse} title="Medical Conditions" helper="Diagnosed or ongoing health issues">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {conditions.length === 0 ? historyEmpty('No conditions recorded.') : conditions.map((c, i) => (
                            <div key={i} className="group relative bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-blue/5 hover:border-brand-blue/30 transition-all cursor-default">
                              <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform">
                                  <Stethoscope size={22} />
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${c.status === 'ACTIVE' ? 'bg-red-50 text-brand-red' : 'bg-blue-50 text-brand-blue'}`}>
                                  {c.status || 'Verified'}
                                </span>
                              </div>
                              <h4 className="text-xl font-black text-[#0F1A3A] mb-2 group-hover:text-brand-blue transition-colors leading-tight">{c.conditionName || c.name}</h4>
                              <div className="flex flex-wrap items-center gap-2 mb-6">
                                <span className="text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">{c.icdCode || 'Clinical Diagnosis'}</span>
                                <div className="w-1.5 h-1.5 rounded-full bg-[#DDE3F0]" />
                                <span className="text-xs font-bold text-[#8A97B0] uppercase tracking-wider">Since {formatHistoryDate(c.onsetDate)}</span>
                              </div>
                              <div className="pt-5 border-t border-[#F0F4FC] flex items-center justify-between">
                                <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">Medical Health Record</p>
                                <HistoryRowActions item={c} type="CONDITION" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {historySubTab === 'medications' && (
                      <Section icon={Pill} title="Current Medications" helper="Medicines currently in your treatment plan">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {medications.length === 0 ? historyEmpty('No medications recorded.') : medications.map((m, i) => (
                            <div key={i} className="group relative bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-blue/5 hover:border-brand-blue/30 transition-all cursor-default">
                              <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-brand-blue group-hover:rotate-12 transition-transform">
                                  <Pill size={22} />
                                </div>
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue">Active</span>
                              </div>
                              <h4 className="text-xl font-black text-[#0F1A3A] mb-2 group-hover:text-brand-blue transition-colors">{m.medicationName || m.name}</h4>
                              <div className="p-3 rounded-xl bg-[#F8FAFF] border border-[#EEF2FF] mb-6">
                                <p className="text-sm font-black text-brand-blue">{m.dosage || 'Dosage N/A'}</p>
                                <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-widest mt-1">{m.frequency || 'Daily Intake'}</p>
                              </div>
                              <div className="pt-4 border-t border-[#F0F4FC] flex items-center justify-between">
                                <p className="text-xs text-[#8A97B0] font-bold">Started: {formatHistoryDate(m.date || m.startDate)}</p>
                                <HistoryRowActions item={m} type="MEDICATION" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {historySubTab === 'vitals' && (
                      <div className="space-y-6">
                        <div className="bg-white border border-[#DDE3F0] rounded-[24px] p-8 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                            {historySectionHeader(Activity, 'Vital Signs Trending', 'Longitudinal tracking of clinical metrics')}
                          </div>
                          <VitalsPortalTab vitals={combinedVitals} onView={handleViewHistoryItem} />
                        </div>
                      </div>
                    )}

                    {historySubTab === 'documents' && (
                      <PatientDocumentGallery
                        documents={documents}
                        records={records}
                        patientId={user?.patientId || user?.id}
                        onViewDocument={viewSecureDocument}
                      />
                    )}

                    {historySubTab === 'encounters' && (
                      <Section icon={UserRound} title="Clinical Visits" helper="History of encounters with healthcare providers">
                        <div className="space-y-6">
                          {encounters.length === 0 ? historyEmpty('No visits recorded.') : encounters.map((e, i) => (
                            <div key={i} className="relative pl-10 border-l-4 border-blue-50 pb-10 last:pb-0 group">
                              <div className="absolute -left-[14px] top-0 w-6 h-6 rounded-full bg-white border-4 border-brand-blue shadow-sm group-hover:scale-125 transition-transform" />
                              <div className="p-8 rounded-2xl border border-[#DDE3F0] bg-white shadow-sm hover:shadow-xl hover:shadow-brand-blue/5 hover:border-brand-blue/30 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-black text-brand-blue uppercase tracking-[0.2em] bg-blue-50 px-3 py-1.5 rounded-lg mb-3 inline-block shadow-sm">{formatHistoryDate(e.encounterDate || e.date)}</span>
                                    <h4 className="text-2xl font-black text-[#0F1A3A] group-hover:text-brand-blue transition-colors leading-tight">{e.encounterType || e.reason || 'Clinical Consultation'}</h4>
                                    <div className="flex items-center gap-3 mt-3">
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#8A97B0] bg-[#F8FAFF] px-3 py-1.5 rounded-lg border border-[#EEF2FF]">
                                        <MapPin size={14} className="text-brand-blue" />
                                        {e.location || 'Outpatient Clinic'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <span className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-700 border border-green-100">Validated</span>
                                    <HistoryRowActions item={e} type="ENCOUNTER" />
                                  </div>
                                </div>
                                {e.notes && (
                                  <div className="bg-[#F8FAFF] p-5 rounded-2xl border border-[#EEF2FF]">
                                    <p className="text-xs font-black text-[#A0AECB] uppercase tracking-widest mb-2">Clinical Note</p>
                                    <p className="text-sm text-[#4B5A7A] leading-relaxed italic">"{e.notes}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {historySubTab === 'admissions' && (
                      <Section icon={BedDouble} title="Hospital Admissions" helper="History of inpatient hospital stays">
                        <div className="grid grid-cols-1 gap-4">
                          {admissions.length === 0 ? historyEmpty('No admissions recorded.') : admissions.map((a, i) => (
                            <div key={i} className="group p-8 rounded-2xl border border-[#DDE3F0] bg-white hover:border-brand-blue/30 hover:shadow-xl hover:shadow-brand-blue/5 transition-all">
                              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                  <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform">
                                    <BedDouble size={32} />
                                  </div>
                                  <div>
                                    <h4 className="text-2xl font-black text-[#0F1A3A] leading-tight mb-1 group-hover:text-brand-blue transition-colors">{a.hospital || a.facility || 'General Hospital'}</h4>
                                    <div className="flex items-center gap-3">
                                      <p className="text-xs font-black text-brand-blue uppercase tracking-widest">{formatHistoryDate(a.admitDate || a.admissionDate)}</p>
                                      <ChevronRight size={14} className="text-[#DDE3F0]" />
                                      <p className="text-xs font-black text-[#8A97B0] uppercase tracking-widest">{a.dischargeDate ? formatHistoryDate(a.dischargeDate) : 'Ongoing'}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-50 text-brand-blue border border-blue-100 shadow-sm">Discharged</span>
                                  <HistoryRowActions item={a} type="ADMISSION" />
                                </div>
                              </div>
                              {a.reason && (
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="p-5 rounded-2xl bg-[#F8FAFF] border border-[#EEF2FF]">
                                    <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-1">Primary Diagnosis</p>
                                    <p className="text-sm font-black text-[#0F1A3A]">{a.reason}</p>
                                  </div>
                                  {a.outcome && (
                                    <div className="p-5 rounded-2xl bg-green-50 border border-green-100">
                                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Outcome</p>
                                      <p className="text-sm font-black text-green-700">{a.outcome}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {historySubTab === 'labs' && (
                      <Section icon={FlaskConical} title="Laboratory Results" helper="Clinical test results and diagnostic findings">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {labResults.length === 0 ? historyEmpty('No lab results recorded.') : labResults.map((l, i) => (
                            <div key={i} className="p-8 rounded-3xl border border-[#DDE3F0] bg-white shadow-sm hover:shadow-2xl hover:shadow-brand-blue/10 hover:border-brand-blue/40 transition-all group">
                              <div className="flex items-start justify-between mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-brand-blue group-hover:scale-110 transition-transform">
                                  <FlaskConical size={26} />
                                </div>
                                <div className="text-right">
                                  <p className="text-3xl font-black text-brand-blue tracking-tighter">{l.value} <span className="text-xs text-[#A0AECB] uppercase font-bold tracking-widest">{l.unit || 'units'}</span></p>
                                  <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${l.interpretation?.includes('NORMAL') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-brand-red'}`}>{l.interpretation || 'Stable'}</span>
                                </div>
                              </div>
                              <h4 className="text-xl font-black text-[#0F1A3A] leading-tight mb-2 group-hover:text-brand-blue transition-colors line-clamp-2 min-h-[3rem]">{l.testName || l.name}</h4>
                              <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#F0F4FC]">
                                <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-[0.2em]">{formatHistoryDate(l.date || l.resultDate)}</p>
                                <HistoryRowActions item={l} type="LAB_RESULT" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {historySubTab === 'timeline' && (
                      <div className="bg-white border border-[#DDE3F0] rounded-[24px] overflow-hidden shadow-sm">
                        <div className="border-b border-[#DDE3F0] px-8 py-6">{historySectionHeader(Clock, 'Medical Timeline', 'Chronological list of all medical events')}</div>
                        <div className="p-8">
                          {timeline.length === 0 ? historyEmpty('No events recorded.') : (
                            <div className="space-y-8">
                              {groupTimelineByMonth(timeline).map((group, gIdx) => (
                                <div key={gIdx}>
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="h-px flex-1 bg-[#DDE3F0]" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A0AECB]">{group.label}</span>
                                    <div className="h-px flex-1 bg-[#DDE3F0]" />
                                  </div>
                                  <div className="space-y-4">
                                    {group.items.map((item, index) => (
                                      <TimelineEvent key={index} item={item} index={index} isLast={index === group.items.length - 1} onView={setTimelineViewItem} />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

          ) : activeTab === 'restrictions' ? (
            <div className="space-y-4">
              {restrictions.length === 0 ? (
                <div className="py-20 text-center bg-[#F8FAFF] rounded-2xl border border-dashed border-[#DDE3F0]">
                  <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-[#DDE3F0]" />
                  <p className="text-sm font-black text-[#8A97B0]">No active privacy restrictions.</p>
                </div>
              ) : restrictions.map(r => (
                <div key={r.id} className="group bg-white rounded-2xl border border-[#DDE3F0] p-6 hover:shadow-xl hover:shadow-brand-red/5 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-brand-red">
                        <Ban size={22} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest mb-1">Restriction Type</p>
                        <p className="text-sm font-bold text-[#0F1A3A]">{r.restrictionType?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-700 border border-green-200">
                        Active
                      </span>
                      <span className="text-xs font-bold text-[#8A97B0]">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="bg-[#FFF8F8] p-5 rounded-2xl border border-[#FEE2E2]">
                    <p className="text-[10px] font-black text-brand-red/60 uppercase tracking-widest mb-2">Policy Justification</p>
                    <p className="text-sm font-bold text-[#4B5A7A] italic leading-relaxed">"{r.justification}"</p>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'billing' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Billing Header */}
              <div className="bg-gradient-to-br from-[#1A3C8F] to-[#0F1A3A] rounded-[28px] p-8 text-white shadow-2xl">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm text-sky-300">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Billing & Claims Portal</h2>
                    <p className="text-blue-200 text-sm font-bold mt-1">Review medical service invoices, insurance claims, and payment status</p>
                  </div>
                </div>
              </div>

              {/* Claims List */}
              {loadingClaims ? (
                <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
                  <RefreshCw className="animate-spin" size={20} />
                  <span className="text-xs font-bold">Loading your invoices & claims...</span>
                </div>
              ) : patientClaims.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[28px] border border-dashed border-[#DDE3F0]">
                  <FileText size={48} className="mx-auto mb-4 text-[#DDE3F0]" />
                  <h3 className="text-lg font-black text-[#0F1A3A] mb-1">No Invoices or Claims Found</h3>
                  <p className="text-xs text-[#8A97B0] font-semibold max-w-sm mx-auto">There are no outstanding or archived claims linked to your account.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patientClaims.map(claim => (
                    <div key={claim.id || claim.claimNumber} className="bg-white rounded-2xl border border-[#DDE3F0] p-6 shadow-sm hover:shadow-md transition-all space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-mono text-xs font-black text-[#1A3C8F] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            #{claim.claimNumber || claim.id}
                          </span>
                          <p className="text-[10px] font-bold text-[#8A97B0] uppercase tracking-wider mt-1.5">{claim.payerId || claim.payerName || 'Health Payer'}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          claim.status === 'PAID' || claim.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          claim.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          claim.status === 'DENIED' || claim.status === 'VOID' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {claim.status}
                        </span>
                      </div>

                      <div className="bg-[#F8FAFF] p-4 rounded-xl border border-[#EEF2FF] flex justify-between items-center">
                        <span className="text-xs font-bold text-[#4B5A7A]">Total Amount Billed</span>
                        <span className="text-lg font-black text-[#0F1A3A]">₹{(claim.totalAmount ?? 0).toFixed(2)}</span>
                      </div>

                      {Array.isArray(claim.items) && claim.items.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-[#F0F4FC]">
                          <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-wider">Service Line Items</p>
                          {claim.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-[#4B5A7A] font-semibold">
                              <span>{item.description || item.serviceCode} (x{item.quantity})</span>
                              <span className="font-mono font-bold">₹{(item.quantity * item.unitPrice).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#F0F4FC]">
                        {claim.status !== 'PAID' && claim.status !== 'ACCEPTED' ? (
                          <button
                            onClick={() => setSelectedPayClaim(claim)}
                            className="w-full bg-[#1A3C8F] hover:bg-[#153278] text-white py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow"
                          >
                            <CreditCard size={15} />
                            <span>Pay Bill (₹ INR)</span>
                          </button>
                        ) : (
                          <div className="w-full bg-emerald-50 text-emerald-700 py-2 rounded-xl text-xs font-bold text-center border border-emerald-200 flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={15} />
                            <span>Paid & Settled</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Patient Payment Gateway Modal */}
              {selectedPayClaim && (
                <PatientPaymentModal
                  claim={selectedPayClaim}
                  isOpen={!!selectedPayClaim}
                  onClose={() => setSelectedPayClaim(null)}
                  onSuccess={() => {
                    setSelectedPayClaim(null);
                    fetchPortalClaims();
                  }}
                />
              )}
            </div>
          ) : activeTab === 'chatbot' ? (

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ height: '80vh', minHeight: '600px' }}>
              <PatientChatbot
                patientId={user?.patientId || user?.id}
                records={records}
                conditions={conditions}
                medications={medications}
              />
            </div>
          ) : activeTab === 'lockbox' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              {/* Lockbox Header */}
              <div className="bg-gradient-to-br from-[#0F1A3A] to-[#1A3C8F] rounded-[28px] p-8 text-white shadow-2xl shadow-brand-blue/20">
                <div className="flex items-center gap-5 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Lock size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">My Privacy Lockbox</h2>
                    <p className="text-blue-200 text-sm font-bold mt-1">Control which sensitive categories are hidden from clinical staff</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-5 py-3 border border-white/10">
                  <div className={`w-3 h-3 rounded-full shadow-glow ${lockboxData.lockboxActive ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`} />
                  <p className="text-sm font-black uppercase tracking-widest">
                    {lockboxData.lockboxActive
                      ? `Lockbox Active — ${lockboxData.lockboxCategories?.length || 0} categor${lockboxData.lockboxCategories?.length === 1 ? 'y' : 'ies'} protected`
                      : 'Lockbox Inactive — All your data is accessible to authorized staff'}
                  </p>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-800 mb-1">How does the lockbox work?</p>
                  <p className="text-xs font-semibold text-amber-700 leading-relaxed">
                    When you lock a category, any data fields belonging to that category will appear as <span className="font-black bg-amber-200 px-1 rounded">[LOCKED]</span> to clinical staff in real-time. Only staff you explicitly authorize, or system administrators, can see the protected information. Your emergency care is never affected.
                  </p>
                </div>
              </div>

              {/* Category Toggle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LOCKBOX_CATEGORIES.map(cat => {
                  const isLocked = pendingCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      id={`lockbox-toggle-${cat.id.toLowerCase()}`}
                      aria-pressed={isLocked}
                      aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${cat.label}`}
                      onClick={() => toggleLockboxCategory(cat.id)}
                      className={`text-left group relative rounded-2xl border-2 p-6 transition-all duration-300 cursor-pointer ${
                        isLocked
                          ? 'border-red-300 bg-red-50 shadow-lg shadow-red-100'
                          : 'border-[#DDE3F0] bg-white hover:border-[#A0AECB] hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.bg, color: cat.color }}>
                          <Lock size={22} />
                        </div>
                        <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isLocked ? 'bg-red-500' : 'bg-[#DDE3F0]'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${isLocked ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                      <h3 className="font-black text-[#0F1A3A] text-base mb-1.5">{cat.label}</h3>
                      <p className="text-xs font-semibold text-[#8A97B0] leading-relaxed">{cat.desc}</p>
                      {isLocked && (
                        <div className="mt-4 flex items-center gap-2 bg-red-100 rounded-xl px-3 py-2">
                          <Lock size={12} className="text-red-600 shrink-0" />
                          <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Protected — Hidden from staff</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Save Button */}
              <div className="flex items-center justify-between bg-white border border-[#DDE3F0] rounded-2xl p-6 shadow-sm">
                <div>
                  <p className="text-sm font-black text-[#0F1A3A]">
                    {pendingCategories.length === 0
                      ? 'No categories selected — lockbox will be inactive'
                      : `${pendingCategories.length} categor${pendingCategories.length === 1 ? 'y' : 'ies'} selected for protection`}
                  </p>
                  <p className="text-xs text-[#8A97B0] font-bold mt-1">Changes take effect immediately upon saving</p>
                </div>
                <button
                  id="save-lockbox-btn"
                  type="button"
                  onClick={handleSaveLockbox}
                  disabled={lockboxSaving}
                  aria-label="Save lockbox privacy settings"
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#0F1A3A] text-white font-black uppercase tracking-widest text-xs hover:bg-brand-blue transition-all shadow-lg shadow-[#0F1A3A]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lockboxSaving ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                  {lockboxSaving ? 'Saving…' : 'Save Lockbox Settings'}
                </button>
              </div>

              {/* Override Grants (read-only display) */}
              {lockboxData.overrideGrantedUserIds?.length > 0 && (
                <div className="bg-white border border-[#DDE3F0] rounded-2xl p-6">
                  <h3 className="text-sm font-black text-[#0F1A3A] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Users size={16} className="text-brand-blue" />
                    Staff With Override Access ({lockboxData.overrideGrantedUserIds.length})
                  </h3>
                  <div className="space-y-2">
                    {lockboxData.overrideGrantedUserIds.map(uid => (
                      <div key={uid} className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center text-white">
                            <User size={14} />
                          </div>
                          <span className="text-xs font-bold text-[#0F1A3A]">User ID: {uid.substring(0, 12)}…</span>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-1 rounded-lg">Can View</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'audit' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AuditLogs />
            </div>
          ) : null}

        </div>
      </div>

      {/* Amendment Modal */}
      {showAmendmentModal && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl border border-[#DDE3F0] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-8 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-brand-blue">
                  <FileEdit size={24} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-xl">Request Amendment</h2>
                  <p className="text-xs font-bold text-[#8A97B0] uppercase tracking-widest mt-0.5">Clinical Record Correction</p>
                </div>
              </div>
              <button onClick={() => setShowAmendmentModal(false)} className="p-2.5 rounded-2xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateAmendment} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Select Clinical Record *</label>
                <select required value={amendmentForm.recordId} onChange={e => setAmendmentForm({ ...amendmentForm, recordId: e.target.value })} className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none">
                  <option value="">Select Record</option>
                  {records.map(r => <option key={r.id} value={r.id}>{r.diagnosis || 'Clinical Case'} - {new Date(r.incidentDateTime || r.createdAt).toLocaleDateString()}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Data Category</label>
                <select value={amendmentForm.dataCategory} onChange={e => setAmendmentForm({ ...amendmentForm, dataCategory: e.target.value })} className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none">
                  {DATA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Justification & Details *</label>
                <textarea required rows={4} value={amendmentForm.justification} onChange={e => setAmendmentForm({ ...amendmentForm, justification: e.target.value })}
                  placeholder="Clearly explain the required correction or missing information…" className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#4B5A7A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAmendmentModal(false)} className="flex-1 bg-white border border-[#DDE3F0] text-[#4B5A7A] font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-[#F8FAFF] transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-blue text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-[#1A3C8F] shadow-lg shadow-brand-blue/20 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {isSubmitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl border border-[#DDE3F0] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-8 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-brand-blue">
                  <Calendar size={24} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-xl">Book Appointment</h2>
                  <p className="text-xs font-bold text-[#8A97B0] uppercase tracking-widest mt-0.5">Clinic Slot Booking</p>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-2.5 rounded-2xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              {/* Doctor picker */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1 font-sans">Select Doctor *</label>
                <select
                  required
                  value={bookingForm.providerId}
                  onChange={e => setBookingForm({ ...bookingForm, providerId: e.target.value, slotId: '' })}
                  className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none"
                >
                  <option value="">Choose Doctor</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>Dr. {p.fullName} ({p.specialty || 'General Practitioner'})</option>
                  ))}
                </select>
              </div>

              {/* Date selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1 font-sans">Select Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={bookingForm.date}
                  onChange={e => setBookingForm({ ...bookingForm, date: e.target.value, slotId: '' })}
                  className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all"
                />
              </div>

              {/* Time slot picker */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1 font-sans">Available Slots *</label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-3 pl-2 text-xs font-bold text-brand-blue">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Searching for free slots...</span>
                  </div>
                ) : !bookingForm.providerId || !bookingForm.date ? (
                  <div className="text-xs text-[#8A97B0] pl-1 font-bold">Please select a doctor and date first.</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-xs text-brand-red pl-1 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                    ⚠️ No available slots found for this doctor on this day.
                  </div>
                ) : (
                  <select
                    required
                    value={bookingForm.slotId}
                    onChange={e => setBookingForm({ ...bookingForm, slotId: e.target.value })}
                    className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all appearance-none"
                  >
                    <option value="">Choose Timing Slot</option>
                    {availableSlots.map(s => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Notes / Reason */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1 font-sans">Reason for Visit</label>
                <textarea
                  rows={3}
                  value={bookingForm.notes}
                  onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  placeholder="e.g. Routine checkup, medication renewal..."
                  className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#4B5A7A] focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 bg-white border border-[#DDE3F0] text-[#4B5A7A] font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-[#F8FAFF] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBook}
                  disabled={isBooking || !bookingForm.slotId}
                  className="flex-1 bg-brand-blue text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-[#1A3C8F] shadow-lg shadow-brand-blue/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBooking ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {isBooking ? 'Booking…' : 'Book Appointment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Modal */}
      {showRestrictionModal && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl border border-[#DDE3F0] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-8 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-brand-red">
                  <Ban size={24} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-xl">Privacy Controls</h2>
                  <p className="text-xs font-bold text-[#8A97B0] uppercase tracking-widest mt-0.5">Restrict Data Disclosure</p>
                </div>
              </div>
              <button onClick={() => setShowRestrictionModal(false)} className="p-2.5 rounded-2xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateRestriction} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Restriction Type</label>
                <select value={restrictionForm.restrictionType} onChange={e => setRestrictionForm({ ...restrictionForm, restrictionType: e.target.value })} className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-red/20 outline-none transition-all appearance-none">
                  {RESTRICTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Data Category</label>
                <select value={restrictionForm.dataCategory} onChange={e => setRestrictionForm({ ...restrictionForm, dataCategory: e.target.value })} className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#0F1A3A] focus:ring-2 focus:ring-brand-red/20 outline-none transition-all appearance-none">
                  {DATA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-[0.2em] ml-1">Reason for Restriction *</label>
                <textarea required rows={4} value={restrictionForm.justification} onChange={e => setRestrictionForm({ ...restrictionForm, justification: e.target.value })}
                  placeholder="Provide a clinical or personal justification for this restriction…" className="w-full bg-[#F8FAFF] border border-[#DDE3F0] rounded-2xl px-5 py-4 text-sm font-bold text-[#4B5A7A] focus:ring-2 focus:ring-brand-red/20 outline-none transition-all resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowRestrictionModal(false)} className="flex-1 bg-white border border-[#DDE3F0] text-[#4B5A7A] font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-[#F8FAFF] transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-brand-red text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl hover:bg-red-800 shadow-lg shadow-brand-red/20 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Ban size={16} />}
                  {isSubmitting ? 'Processing…' : 'Apply Restriction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Inline Portal Document Viewer Modal */}
      {inlinePortalDoc && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 text-white z-10 pb-4 border-b border-white/10 shrink-0 bg-slate-900/90 px-6 py-4 rounded-2xl border border-white/10 shadow-2xl">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-black tracking-tight truncate text-white">{inlinePortalDoc.title}</h3>
              <p className="text-xs text-slate-400 font-medium font-mono">Document Ref: #{inlinePortalDoc.docId || 'ID-SECURE'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setInlinePortalDoc(null)}
                className="p-2.5 rounded-xl bg-red-600 text-white border border-red-500 hover:bg-red-700 transition-colors shadow-lg"
                title="Close Viewer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Embedded Viewer Body */}
          <div className="flex-1 my-4 relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center w-full">
            {inlinePortalDoc.url && /\.(jpe?g|png|webp|gif|svg|bmp)(\?.*)?$/i.test(inlinePortalDoc.url) ? (
              <img
                src={inlinePortalDoc.url}
                alt={inlinePortalDoc.title}
                className="max-h-[78vh] max-w-[92vw] object-contain rounded-xl border border-white/10 shadow-2xl"
              />
            ) : inlinePortalDoc.url ? (
              <iframe
                src={inlinePortalDoc.url}
                title={inlinePortalDoc.title}
                className="w-full h-[78vh] border-0 rounded-2xl bg-white shadow-2xl"
                sandbox="allow-same-origin allow-scripts allow-popups"
              />
            ) : (
              <div className="text-center text-slate-400 p-8">
                <FileText size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold">Document preview unavailable</p>
              </div>
            )}
          </div>

        </div>,
        document.body
      )}

      {/* Patient Payment Gateway Modal */}
      {selectedPayClaim && (
        <PatientPaymentModal
          claim={selectedPayClaim}
          isOpen={!!selectedPayClaim}
          onClose={() => setSelectedPayClaim(null)}
          onSuccess={() => {
            setSelectedPayClaim(null);
            fetchPortalClaims();
          }}
        />
      )}

      {/* Timeline View Modal */}
      {timelineViewItem && (
        <TimelineViewModal item={timelineViewItem} onClose={() => setTimelineViewItem(null)} />
      )}
    </div>
  );
}
