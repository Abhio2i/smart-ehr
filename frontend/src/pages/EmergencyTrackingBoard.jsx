import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  LogOut,
  Bed,
  Heart,
  Thermometer,
  Wind,
  Search,
  CheckCircle2,
  FileText
} from 'lucide-react';
import client from '../api/client';

const CTAS_CONFIG = {
  1: { level: 1, name: 'Resuscitation', color: 'bg-[#C8102E] text-white border-[#9B0A21]', badge: 'bg-red-50 text-red-700 border-red-200' },
  2: { level: 2, name: 'Emergent', color: 'bg-amber-600 text-white border-amber-700', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  3: { level: 3, name: 'Urgent', color: 'bg-yellow-500 text-slate-900 border-yellow-600', badge: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  4: { level: 4, name: 'Less Urgent', color: 'bg-emerald-600 text-white border-emerald-700', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  5: { level: 5, name: 'Non-Urgent', color: 'bg-[#1A3C8F] text-white border-[#0F2660]', badge: 'bg-blue-50 text-blue-800 border-blue-200' }
};

const ZONES = ['All Zones', 'Resuscitation Bay', 'Trauma Bay', 'Acute Bay A', 'Fast Track', 'Waiting Room'];

export default function EmergencyTrackingBoard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [selectedCtas, setSelectedCtas] = useState('ALL');
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showDispositionModal, setShowDispositionModal] = useState(null);
  const [dispositionType, setDispositionType] = useState('DISCHARGE_HOME');
  const [dispositionNotes, setDispositionNotes] = useState('');

  // Triage Form State
  const [triageForm, setTriageForm] = useState({
    patientName: '',
    age: '',
    gender: 'MALE',
    chiefComplaint: '',
    ctasLevel: 3,
    edZone: 'Acute Bay A',
    bedNumber: 'ACUTE-A1',
    assignedDoctor: 'Dr. Sarah Jenkins',
    assignedNurse: 'RN Mark Vance',
    systolicBp: '120',
    diastolicBp: '80',
    pulseRate: '75',
    respirationRate: '18',
    temperature: '37.0',
    spo2: '98'
  });

  useEffect(() => {
    fetchTrackingBoard();
    const interval = setInterval(fetchTrackingBoard, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchTrackingBoard = async () => {
    try {
      const res = await client.get('/api/ed/tracking-board');
      setRecords(res.data || []);
    } catch (err) {
      console.error('Failed to fetch ED tracking board:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...triageForm,
        age: parseInt(triageForm.age) || 0,
        ctasLevel: parseInt(triageForm.ctasLevel) || 3,
        ctasName: CTAS_CONFIG[triageForm.ctasLevel]?.name || 'Urgent',
        systolicBp: parseInt(triageForm.systolicBp) || null,
        diastolicBp: parseInt(triageForm.diastolicBp) || null,
        pulseRate: parseInt(triageForm.pulseRate) || null,
        respirationRate: parseInt(triageForm.respirationRate) || null,
        temperature: parseFloat(triageForm.temperature) || null,
        spo2: parseFloat(triageForm.spo2) || null
      };

      await client.post('/api/ed/triage', payload);
      setShowTriageModal(false);
      fetchTrackingBoard();
    } catch (err) {
      alert('Failed to submit triage: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDispositionSubmit = async (e) => {
    e.preventDefault();
    if (!showDispositionModal) return;
    try {
      await client.put(`/api/ed/${showDispositionModal.id}/disposition`, {
        dispositionType,
        notes: dispositionNotes
      });
      setShowDispositionModal(null);
      setDispositionNotes('');
      fetchTrackingBoard();
    } catch (err) {
      alert('Failed to update disposition: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleMarkLwbs = async (recordId) => {
    if (!window.confirm('Mark this patient as Left Without Being Seen (LWBS)?')) return;
    try {
      await client.put(`/api/ed/${recordId}/lwbs`);
      fetchTrackingBoard();
    } catch (err) {
      alert('Failed to mark LWBS: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.patientName?.toLowerCase().includes(search.toLowerCase()) ||
                          r.bedNumber?.toLowerCase().includes(search.toLowerCase()) ||
                          r.chiefComplaint?.toLowerCase().includes(search.toLowerCase());
    const matchesZone = selectedZone === 'All Zones' || r.edZone === selectedZone;
    const matchesCtas = selectedCtas === 'ALL' || r.ctasLevel === parseInt(selectedCtas);
    return matchesSearch && matchesZone && matchesCtas;
  });

  const countByCtas = (level) => records.filter(r => r.ctasLevel === level && r.status !== 'DISCHARGED' && r.status !== 'TRANSFERRED').length;
  const countLwbs = records.filter(r => r.lwbs).length;

  return (
    <div className="p-6 space-y-6 bg-[#F0F4FC] min-h-screen">
      {/* Top Header Banner matching App Theme (#1A3C8F Brand Blue) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#1A3C8F] via-[#2A52AF] to-[#0F2660] text-white p-6 rounded-2xl shadow-xl border border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20">
            <Activity className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Emergency Department Live Tracking Board</h1>
            <p className="text-white/80 text-xs font-medium mt-0.5">Real-time CTAS Acuity Triage, ED Bed Tracking & Disposition Workflow</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTrackingBoard}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20 flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowTriageModal(true)}
            className="px-5 py-2.5 bg-[#C8102E] hover:bg-[#9B0A21] text-white font-bold rounded-xl transition shadow-lg shadow-[#C8102E]/30 flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            Triage New Patient
          </button>
        </div>
      </div>

      {/* CTAS Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5].map(lvl => {
          const cfg = CTAS_CONFIG[lvl];
          const isSelected = selectedCtas === String(lvl);
          return (
            <div
              key={lvl}
              onClick={() => setSelectedCtas(isSelected ? 'ALL' : String(lvl))}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-sm hover:shadow-md ${
                isSelected ? 'ring-2 ring-[#1A3C8F] bg-white border-[#1A3C8F]' : 'bg-white border-[#DDE3F0]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-lg border ${cfg.badge}`}>
                  CTAS {lvl}
                </span>
                <Clock className="w-4 h-4 text-[#8A97B0]" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-[#0F1A3A]">{countByCtas(lvl)}</div>
                <div className="text-xs font-medium text-[#4B5A7A] truncate">{cfg.name}</div>
              </div>
            </div>
          );
        })}

        <div
          onClick={() => setSelectedCtas(selectedCtas === 'LWBS' ? 'ALL' : 'LWBS')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-sm ${
            selectedCtas === 'LWBS' ? 'ring-2 ring-red-600 bg-red-50/80 border-red-500' : 'bg-white border-[#DDE3F0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-lg bg-red-100 text-red-800 border border-red-200">
              LWBS
            </span>
            <AlertTriangle className="w-4 h-4 text-[#C8102E]" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[#C8102E]">{countLwbs}</div>
            <div className="text-xs font-medium text-[#4B5A7A]">Left Without Seen</div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#DDE3F0] shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#8A97B0]" />
          <input
            type="text"
            placeholder="Search patient, bed, or complaint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A] focus:outline-none focus:ring-2 focus:ring-[#1A3C8F]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {ZONES.map(z => (
            <button
              key={z}
              onClick={() => setSelectedZone(z)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition ${
                selectedZone === z
                  ? 'bg-[#1A3C8F] text-white shadow-md shadow-[#1A3C8F]/20'
                  : 'bg-[#F0F4FC] text-[#4B5A7A] hover:bg-[#DDE3F0]'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* ED Patient Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecords.map(record => {
          const ctas = CTAS_CONFIG[record.ctasLevel] || CTAS_CONFIG[3];
          return (
            <div
              key={record.id}
              className="p-5 rounded-2xl bg-white border border-[#DDE3F0] shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-[#0F1A3A]">{record.patientName}</span>
                    <span className="text-xs font-semibold text-[#8A97B0]">({record.age}Y • {record.gender})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1A3C8F] bg-[#F0F4FC] px-2.5 py-1 rounded-lg border border-[#DDE3F0]">
                      <Bed className="w-3.5 h-3.5 text-[#1A3C8F]" />
                      {record.bedNumber} • <span className="text-[#4B5A7A]">{record.edZone}</span>
                    </span>
                  </div>
                </div>

                <span className={`px-2.5 py-1 text-xs font-black rounded-lg border shadow-xs ${ctas.badge}`}>
                  CTAS {record.ctasLevel}
                </span>
              </div>

              {/* Chief Complaint */}
              <div className="p-3 rounded-xl bg-[#F0F4FC] border border-[#DDE3F0] text-xs text-[#0F1A3A]">
                <span className="font-bold text-[#4B5A7A]">Chief Complaint:</span> {record.chiefComplaint}
              </div>

              {/* Vitals Ribbon */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs p-2.5 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0]">
                <div>
                  <div className="text-[10px] font-bold text-[#8A97B0]">BP</div>
                  <div className="font-black text-[#0F1A3A]">{record.systolicBp}/{record.diastolicBp}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#8A97B0] flex items-center justify-center gap-0.5">
                    <Heart className="w-3 h-3 text-[#C8102E]" /> HR
                  </div>
                  <div className="font-black text-[#0F1A3A]">{record.pulseRate}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#8A97B0] flex items-center justify-center gap-0.5">
                    <Wind className="w-3 h-3 text-[#1A3C8F]" /> SpO2
                  </div>
                  <div className="font-black text-[#0F1A3A]">{record.spo2}%</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#8A97B0] flex items-center justify-center gap-0.5">
                    <Thermometer className="w-3 h-3 text-amber-600" /> Temp
                  </div>
                  <div className="font-black text-[#0F1A3A]">{record.temperature}°</div>
                </div>
              </div>

              {/* Staff Assignments */}
              <div className="flex items-center justify-between text-xs text-[#4B5A7A] pt-1">
                <span>Doc: <strong className="text-[#0F1A3A] font-bold">{record.assignedDoctor || 'Unassigned'}</strong></span>
                <span>Nurse: <strong className="text-[#0F1A3A] font-bold">{record.assignedNurse || 'Unassigned'}</strong></span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-[#DDE3F0]">
                <button
                  onClick={() => setShowDispositionModal(record)}
                  className="flex-1 py-2.5 bg-[#1A3C8F] hover:bg-[#0F2660] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disposition
                </button>
                <button
                  onClick={() => handleMarkLwbs(record.id)}
                  className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-[#C8102E] border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  LWBS
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Triage New Patient Modal */}
      {showTriageModal && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#DDE3F0] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4 border-[#DDE3F0]">
              <h2 className="text-lg font-black text-[#0F1A3A] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#C8102E]" />
                Triage Emergency Patient & CTAS Scoring
              </h2>
              <button onClick={() => setShowTriageModal(false)} className="text-[#8A97B0] hover:text-[#0F1A3A] font-bold">✕</button>
            </div>

            <form onSubmit={handleTriageSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#4B5A7A] mb-1">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={triageForm.patientName}
                    onChange={(e) => setTriageForm({ ...triageForm, patientName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#4B5A7A] mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={triageForm.age}
                    onChange={(e) => setTriageForm({ ...triageForm, age: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                    placeholder="Age"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#4B5A7A] mb-1">Gender</label>
                  <select
                    value={triageForm.gender}
                    onChange={(e) => setTriageForm({ ...triageForm, gender: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* CTAS Level Selector */}
              <div>
                <label className="block font-bold text-[#4B5A7A] mb-1">CTAS Acuity Level (Canadian Triage Scale 1-5)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(level => {
                    const cfg = CTAS_CONFIG[level];
                    return (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setTriageForm({ ...triageForm, ctasLevel: level })}
                        className={`p-2.5 rounded-xl text-center border font-bold transition flex flex-col items-center gap-0.5 ${
                          triageForm.ctasLevel === level ? cfg.color + ' ring-2 ring-offset-1 ring-[#1A3C8F]' : 'bg-[#F0F4FC] text-[#4B5A7A] border-[#DDE3F0]'
                        }`}
                      >
                        <span className="text-xs">CTAS {level}</span>
                        <span className="text-[10px] truncate max-w-full font-medium">{cfg.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block font-bold text-[#4B5A7A] mb-1">Chief Complaint & Triage Notes</label>
                <textarea
                  rows={2}
                  required
                  value={triageForm.chiefComplaint}
                  onChange={(e) => setTriageForm({ ...triageForm, chiefComplaint: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                  placeholder="Describe patient's presentation..."
                />
              </div>

              {/* ED Zone & Bed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#4B5A7A] mb-1">ED Zone</label>
                  <select
                    value={triageForm.edZone}
                    onChange={(e) => setTriageForm({ ...triageForm, edZone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                  >
                    {ZONES.filter(z => z !== 'All Zones').map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#4B5A7A] mb-1">Bed / Bay ID</label>
                  <input
                    type="text"
                    required
                    value={triageForm.bedNumber}
                    onChange={(e) => setTriageForm({ ...triageForm, bedNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                    placeholder="e.g. BAY-01"
                  />
                </div>
              </div>

              {/* Initial Vitals */}
              <div className="p-3 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] space-y-2">
                <span className="font-extrabold text-[#0F1A3A]">Triage Vital Signs</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">Systolic BP</label>
                    <input
                      type="number"
                      value={triageForm.systolicBp}
                      onChange={(e) => setTriageForm({ ...triageForm, systolicBp: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">Diastolic BP</label>
                    <input
                      type="number"
                      value={triageForm.diastolicBp}
                      onChange={(e) => setTriageForm({ ...triageForm, diastolicBp: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">Pulse (HR)</label>
                    <input
                      type="number"
                      value={triageForm.pulseRate}
                      onChange={(e) => setTriageForm({ ...triageForm, pulseRate: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">Resp Rate</label>
                    <input
                      type="number"
                      value={triageForm.respirationRate}
                      onChange={(e) => setTriageForm({ ...triageForm, respirationRate: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={triageForm.temperature}
                      onChange={(e) => setTriageForm({ ...triageForm, temperature: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#8A97B0]">SpO2 (%)</label>
                    <input
                      type="number"
                      value={triageForm.spo2}
                      onChange={(e) => setTriageForm({ ...triageForm, spo2: e.target.value })}
                      className="w-full p-1.5 rounded-lg border border-[#DDE3F0] bg-white text-[#0F1A3A] font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#DDE3F0]">
                <button
                  type="button"
                  onClick={() => setShowTriageModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#F0F4FC] text-[#4B5A7A] hover:bg-[#DDE3F0] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#C8102E] hover:bg-[#9B0A21] text-white font-bold shadow-md shadow-[#C8102E]/30 uppercase tracking-wider"
                >
                  Confirm Triage & Assign Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disposition Modal */}
      {showDispositionModal && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#DDE3F0] w-full max-w-md p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3 border-[#DDE3F0]">
              <h3 className="text-base font-black text-[#0F1A3A] flex items-center gap-2">
                <LogOut className="w-5 h-5 text-[#C8102E]" />
                ED Patient Disposition
              </h3>
              <button onClick={() => setShowDispositionModal(null)} className="text-[#8A97B0] hover:text-[#0F1A3A] font-bold">✕</button>
            </div>

            <div>
              <p className="text-sm font-extrabold text-[#0F1A3A]">{showDispositionModal.patientName}</p>
              <p className="text-xs font-semibold text-[#4B5A7A]">Bed: {showDispositionModal.bedNumber} ({showDispositionModal.edZone})</p>
            </div>

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div>
                <label className="block font-bold text-[#4B5A7A] mb-1">Disposition Decision</label>
                <select
                  value={dispositionType}
                  onChange={(e) => setDispositionType(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A] font-bold"
                >
                  <option value="DISCHARGE_HOME">Discharge Home (with prescriptions & follow-up)</option>
                  <option value="ADMIT_WARD">Admit to Inpatient Ward</option>
                  <option value="ADMIT_ICU">Admit to Intensive Care Unit (ICU)</option>
                  <option value="TRANSFER_REGIONAL">Transfer to Regional Tertiary Hospital</option>
                  <option value="LWBS">Left Without Being Seen (LWBS)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#4B5A7A] mb-1">Disposition & Clinical Summary Notes</label>
                <textarea
                  rows={3}
                  required
                  value={dispositionNotes}
                  onChange={(e) => setDispositionNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DDE3F0] bg-[#F0F4FC] text-[#0F1A3A]"
                  placeholder="Enter disposition clinical rationale..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#DDE3F0]">
                <button
                  type="button"
                  onClick={() => setShowDispositionModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#F0F4FC] text-[#4B5A7A] hover:bg-[#DDE3F0] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#1A3C8F] hover:bg-[#0F2660] text-white font-bold shadow-md"
                >
                  Submit Disposition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
