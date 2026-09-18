import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Cell, AreaChart, Area } from 'recharts';
import client from '../../api/client';
import { Clock, TrendingUp, BarChart3, Activity, AlertCircle, RefreshCw } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-main)]/90 backdrop-blur-xl border border-[var(--border-active)] p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
              {entry.name}: <span className="text-indigo-500">{entry.value}{entry.name === 'Pass Rate' ? '%' : ''}</span>
            </p>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const formatMonthData = (data) => {
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, val]) => ({ month: key, passRate: val }));
  }
  return [];
};

const cleanLocationName = (loc) => {
  if (!loc || loc === 'UNKNOWN') return 'Unknown Location';
  if (typeof loc === 'string' && loc.startsWith('enc::')) {
    const hash = Math.abs(loc.split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0));
    return `Zone #${(hash % 900) + 100}`;
  }
  return loc;
};

const formatLocationData = (data) => {
  if (Array.isArray(data)) {
    return data.map(item => ({
      ...item,
      location: cleanLocationName(item.location)
    }));
  }
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, val]) => ({
      location: cleanLocationName(key),
      count: val
    }));
  }
  return [];
};

const AnalyticsCharts = React.memo(() => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const theme = useSelector(state => state.ui.theme);

  const fetchMetrics = () => {
    setLoading(true);
    setError(false);
    // OPTIMIZATION: Override default 15s timeout to 35s to allow backend processing for cold caches
    client.get('/api/reports/dashboard-metrics', { timeout: 35000 })
      .then(res => {
        setMetrics(res.data);
      })
      .catch(err => {
        console.error("Failed to load metrics", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  // OPTIMIZATION: Memoize monthData to stabilize array reference across renders, declared before early returns
  const monthData = useMemo(() => {
    return formatMonthData(metrics?.monthWiseQaPassRate || []);
  }, [metrics?.monthWiseQaPassRate]);

  // OPTIMIZATION: Memoize locationData to stabilize array reference across renders, declared before early returns
  const locationData = useMemo(() => {
    return formatLocationData(metrics?.topIncidentLocations || []);
  }, [metrics?.topIncidentLocations]);

  if (loading) {
    return (
      <div className="glass-card p-20 rounded-[2.5rem] flex items-center justify-center min-h-[400px] mt-10 premium-border">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Processing Intelligence...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-12 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[300px] mt-10 premium-border text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/5 blur-[80px] -z-10" />
        <AlertCircle size={32} className="text-brand-red mb-3 group-hover:scale-110 transition-transform duration-500" />
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Analytics generation timed out</h3>
        <p className="text-xs text-[#8A97B0] font-semibold mt-2.5 max-w-sm leading-relaxed">Calculating clinical compliance indices took longer than 15 seconds. Please try again to trigger or consume the warmed cache.</p>
        <button onClick={fetchMetrics}
          className="btn-primary mt-5 text-[11px] font-black uppercase tracking-wider px-5 py-2.5 flex items-center gap-2">
          <RefreshCw size={13} /> Retry Report
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';

  return (
    <div className="space-y-8 mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Line Chart */}
        <div className="glass-card p-10 rounded-[3rem] premium-border hover:bg-white/[0.02] transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] -z-10" />
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight group-hover:text-indigo-500 transition-colors">QA Compliance Flux</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">6-Month historical pass rate indices</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-xl shadow-indigo-500/10"><TrendingUp size={24} /></div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={monthData}>
                <defs>
                  <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C8102E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#C8102E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="var(--text-secondary)" 
                  fontSize={10} 
                  fontWeight={900}
                  tickLine={false} 
                  axisLine={false} 
                  dy={15}
                  tickFormatter={(val) => val.substring(0, 3).toUpperCase()}
                />
                <YAxis 
                  stroke="var(--text-secondary)" 
                  fontSize={10} 
                  fontWeight={900}
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(tick) => `${tick}%`} 
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#C8102E', strokeWidth: 2, strokeDasharray: '4 4' }} />
                <Area 
                  type="monotone" 
                  dataKey="passRate" 
                  name="Pass Rate" 
                  stroke="#C8102E" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorPass)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="glass-card p-10 rounded-[3rem] premium-border hover:bg-white/[0.02] transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 blur-[80px] -z-10" />
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight group-hover:text-cyan-500 transition-colors">Incident Hotspots</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Top critical response environments</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 shadow-xl shadow-cyan-500/10"><BarChart3 size={24} /></div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={locationData} layout="vertical" margin={{ left: 20 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1A3C8F" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#C8102E" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={gridColor} horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="location" 
                  type="category" 
                  stroke="var(--text-secondary)" 
                  fontSize={10} 
                  fontWeight={900}
                  tickLine={false} 
                  axisLine={false} 
                  width={100}
                  tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar 
                  dataKey="count" 
                  name="Incidents" 
                  fill="url(#colorCount)" 
                  radius={[0, 12, 12, 0]} 
                  barSize={24} 
                  animationDuration={2000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hero Stat */}
      {metrics.averageReviewTimeHours != null && (
        <div className="glass-card p-12 rounded-[3rem] premium-border flex flex-col md:flex-row items-center justify-between gap-8 hover:bg-white/[0.02] transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-full bg-amber-500/5 blur-[120px] -z-10 group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center gap-8">
            <div className="w-20 h-20 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-2xl shadow-amber-500/10 group-hover:scale-110 transition-transform duration-500">
              <Clock size={40} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">Review Throughput</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 italic">Average QA turnaround temporal index</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-7xl font-black text-amber-500 tabular-nums tracking-tighter">{metrics.averageReviewTimeHours.toFixed(1)}</span>
            <span className="text-xl font-black text-slate-500 uppercase tracking-widest">Hours</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default AnalyticsCharts;
