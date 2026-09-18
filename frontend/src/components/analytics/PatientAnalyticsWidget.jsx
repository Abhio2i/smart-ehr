import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Users, UserCheck, Calendar, TrendingUp, RefreshCw, Filter, Building, PieChart as PieChartIcon, BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts';
import {
  fetchPatientAnalyticsSummary,
  selectPatientAnalyticsSummary,
  selectPatientAnalyticsSummaryLoading
} from '../../store/slices/patientAnalyticsSlice';

const COLORS = ['#1A3C8F', '#C8102E', '#059669', '#EA580C', '#7C3AED', '#0891B2', '#DB2777'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-[#DDE3F0] rounded-xl p-3 shadow-xl text-xs">
      <p className="font-bold text-[#0F1A3A] mb-1">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
          <span className="font-semibold text-[#4B5A7A]">
            {entry.name}: <span className="font-black text-[#1A3C8F]">{entry.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, loading, color = 'text-[#1A3C8F]', bg = 'bg-[#EEF2FF]' }) => (
  <div className="bg-white rounded-2xl p-5 border border-[#DDE3F0] hover:border-[#A0B0D0] hover:shadow-sm transition-all">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">{label}</span>
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
        <Icon size={18} className={color} />
      </div>
    </div>
    {loading ? (
      <div className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg my-1" />
    ) : (
      <p className={`text-3xl font-black ${color} tracking-tight`}>{value ?? 0}</p>
    )}
  </div>
);

export const PatientAnalyticsWidget = () => {
  const dispatch = useDispatch();
  const summary = useSelector(selectPatientAnalyticsSummary);
  const loading = useSelector(selectPatientAnalyticsSummaryLoading);
  const currentUser = useSelector((state) => state.auth.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  const [selectedOrg, setSelectedOrg] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback((refresh = false) => {
    dispatch(fetchPatientAnalyticsSummary({
      organizationId: selectedOrg || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      refresh
    }));
  }, [dispatch, selectedOrg, startDate, endDate]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Format Trend Data
  const trendData = useMemo(() => {
    if (!summary?.trend?.length) return [];
    return summary.trend.map((item) => ({
      date: item.date,
      Registrations: item.count
    }));
  }, [summary]);

  // Format Gender Data
  const genderData = useMemo(() => {
    if (!summary?.byGender) return [];
    return Object.entries(summary.byGender).map(([gender, count]) => ({
      name: gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase(),
      value: count
    }));
  }, [summary]);

  // Format Age Group Data
  const ageGroupData = useMemo(() => {
    if (!summary?.byAgeGroup) return [];
    return Object.entries(summary.byAgeGroup).map(([group, count]) => ({
      group,
      Count: count
    }));
  }, [summary]);

  // Format Org Data (Admin only)
  const orgData = useMemo(() => {
    if (!summary?.byOrganization) return [];
    return Object.entries(summary.byOrganization).map(([org, count]) => ({
      org: org.length > 15 ? org.substring(0, 12) + '...' : org,
      fullOrg: org,
      Count: count
    }));
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#DDE3F0]">
        <div>
          <h2 className="text-lg font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            <Users size={20} className="text-[#1A3C8F]" /> Patient Registration & Demographic Analytics
          </h2>
          <p className="text-xs text-[#8A97B0] mt-0.5">
            Real-time patient registrations, age & gender demographics, and trend insights
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date range pickers */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl px-2.5 py-1 text-xs">
            <Calendar size={13} className="text-[#8A97B0]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#0F1A3A] outline-none"
              title="Start Date"
            />
            <span className="text-[#8A97B0] font-bold">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#0F1A3A] outline-none"
              title="End Date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[10px] font-bold text-[#C8102E] hover:underline ml-1"
                title="Clear date range"
              >
                Clear
              </button>
            )}
          </div>

          {isAdmin && summary?.byOrganization && (
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-[#8A97B0]" />
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="bg-[#F8FAFF] border border-[#DDE3F0] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F1A3A] outline-none focus:border-[#1A3C8F]"
              >
                <option value="">All Organizations</option>
                {Object.keys(summary.byOrganization).map((org) => (
                  <option key={org} value={org}>
                    {org}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="btn-ghost border border-[#DDE3F0] p-2 rounded-xl text-[#1A3C8F] hover:bg-[#EEF2FF] transition-all"
            title="Refresh Analytics"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Unique Patients"
          value={summary?.totalPatients}
          loading={loading}
          color="text-[#1A3C8F]"
          bg="bg-[#EEF2FF]"
        />
        <StatCard
          icon={UserCheck}
          label="New Today"
          value={summary?.newPatientsToday}
          loading={loading}
          color="text-[#059669]"
          bg="bg-[#ECFDF5]"
        />
        <StatCard
          icon={Calendar}
          label="New This Week"
          value={summary?.newPatientsThisWeek}
          loading={loading}
          color="text-[#7C3AED]"
          bg="bg-[#F5F3FF]"
        />
        <StatCard
          icon={TrendingUp}
          label="New This Month"
          value={summary?.newPatientsThisMonth}
          loading={loading}
          color="text-[#EA580C]"
          bg="bg-[#FFF7ED]"
        />
      </div>

      {/* Registration Trend Chart */}
      <div className="bg-white rounded-2xl p-6 border border-[#DDE3F0]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#0F1A3A]">Patient Registration Trend</h3>
            <p className="text-xs text-[#8A97B0]">Daily unique patient additions over time</p>
          </div>
          <TrendingUp size={18} className="text-[#1A3C8F]" />
        </div>
        <div className="h-64">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1A3C8F" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#1A3C8F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FC" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8A97B0' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8A97B0' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Registrations"
                  stroke="#1A3C8F"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorReg)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#8A97B0]">
              No registration trend data recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Demographics Row (Gender & Age) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-[#DDE3F0]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F1A3A]">Gender Distribution</h3>
              <p className="text-xs text-[#8A97B0]">Patient breakdown by registered gender</p>
            </div>
            <PieChartIcon size={18} className="text-[#0891B2]" />
          </div>
          <div className="h-56">
            {genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={40}
                    paddingAngle={4}
                  >
                    {genderData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend tick={{ fontSize: 11, fill: '#4B5A7A' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8A97B0]">
                No gender demographic data
              </div>
            )}
          </div>
        </div>

        {/* Age Group Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-[#DDE3F0]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F1A3A]">Age Group Distribution</h3>
              <p className="text-xs text-[#8A97B0]">Patients grouped by clinical age brackets</p>
            </div>
            <BarChart2 size={18} className="text-[#7C3AED]" />
          </div>
          <div className="h-56">
            {ageGroupData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageGroupGroup(ageGroupData)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FC" />
                  <XAxis dataKey="group" tick={{ fontSize: 10, fill: '#8A97B0' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A97B0' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8A97B0]">
                No age distribution data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Organization Breakdown */}
      {isAdmin && orgData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-[#DDE3F0]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0F1A3A]">Patients by Organization</h3>
              <p className="text-xs text-[#8A97B0]">Patient volume distribution across health facilities</p>
            </div>
            <Building size={18} className="text-[#EA580C]" />
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FC" />
                <XAxis dataKey="org" tick={{ fontSize: 10, fill: '#8A97B0' }} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#8A97B0' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Count" fill="#EA580C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

function ageGroupGroup(data) {
  return data;
}

export default PatientAnalyticsWidget;
