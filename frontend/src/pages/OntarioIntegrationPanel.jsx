import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import api from '../api/client';
import { addToast } from '../store/slices/uiSlice';
import {
  Activity, Server, Database, FileCode, Send, RefreshCw, CheckCircle2,
  AlertTriangle, Shield, Eye, ArrowUpRight, Search, Zap, Layers, Cpu
} from 'lucide-react';

export default function OntarioIntegrationPanel() {
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [nodeStatus, setNodeStatus] = useState(null);
  const [tbCases, setTbCases] = useState([]);
  const [logs, setLogs] = useState([]);

  // Modal inspection
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Ingestion form modal
  const [olisModalOpen, setOlisModalOpen] = useState(false);
  const [olisTargetCase, setOlisTargetCase] = useState(null);
  const [olisForm, setOlisForm] = useState({ sampleNumber: '1', result: 'NEGATIVE', loincCode: '543-9' });
  const [submittingOlis, setSubmittingOlis] = useState(false);

  // Search filter
  const [logFilter, setLogFilter] = useState('');

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/ontario/status');
      setNodeStatus(res.data);
    } catch {
      // fail silently
    }
  }, []);

  const fetchTbCases = useCallback(async () => {
    try {
      const res = await api.get('/api/tb/cases?page=0&size=20');
      setTbCases(res.data?.content || []);
    } catch {
      // fail silently
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get('/api/ontario/logs?page=0&size=50');
      setLogs(res.data?.content || []);
    } catch {
      // fail silently
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchTbCases(), fetchLogs()]);
    setLoading(false);
  }, [fetchStatus, fetchTbCases, fetchLogs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSyncIphis = async (caseId, caseNumber) => {
    setSyncingId(`iphis-${caseId}`);
    try {
      const res = await api.post(`/api/ontario/sync/iphis/${caseId}`);
      dispatch(addToast({
        type: 'success',
        message: `TB Case ${caseNumber} successfully synchronized with Ontario iPHIS/CCM Gateway!`
      }));
      fetchLogs();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to sync with iPHIS gateway.' }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncPanorama = async (caseId, caseNumber) => {
    setSyncingId(`panorama-${caseId}`);
    try {
      await api.post(`/api/ontario/sync/panorama/${caseId}`);
      dispatch(addToast({
        type: 'success',
        message: `Immunization record for ${caseNumber} synced to Ontario Panorama Registry.`
      }));
      fetchLogs();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to sync with Panorama registry.' }));
    } finally {
      setSyncingId(null);
    }
  };

  const handleIngestOlis = async (e) => {
    e.preventDefault();
    if (!olisTargetCase) return;
    setSubmittingOlis(true);
    try {
      await api.post('/api/ontario/ingest/olis', {
        caseId: olisTargetCase.id,
        sampleNumber: olisForm.sampleNumber,
        result: olisForm.result,
        loincCode: olisForm.loincCode
      });
      dispatch(addToast({
        type: 'success',
        message: `OLIS Lab Feed ingested! Sputum Sample ${olisForm.sampleNumber} updated to ${olisForm.result}.`
      }));
      setOlisModalOpen(false);
      fetchTbCases();
      fetchLogs();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to ingest OLIS lab feed.' }));
    } finally {
      setSubmittingOlis(false);
    }
  };

  const fmtDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleString();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#F8FAFF]">
      
      {/* Top Header */}
      <div className="shrink-0 bg-white border-b border-[#EBEFF5] px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0D47A1] to-[#1A237E] flex items-center justify-center shadow-lg shadow-blue-900/10">
              <Activity size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#0F1A3A] tracking-tight">Ontario Health Integrations</h1>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                  HL7 v2.5.1 / FHIR CA-Profile
                </span>
              </div>
              <p className="text-xs text-[#8A97B0] font-semibold mt-0.5">
                Provincial health data exchange connectors for iPHIS/CCM Case Registry, OLIS Lab Feed, and Panorama Immunization Registry.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={loadAll} disabled={loading}
              className="btn-ghost bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 text-xs rounded-xl border border-[#DDE3F0] flex items-center gap-1.5 font-bold">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Gateways
            </button>
          </div>
        </div>
      </div>

      {/* Gateway Node Status Cards */}
      <div className="shrink-0 px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* iPHIS Card */}
          <div className="bg-white border border-[#EBEFF5] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center">
                  <Server size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0F1A3A]">iPHIS / CCM Registry</h3>
                  <p className="text-[10px] text-[#8A97B0] font-medium">Public Health Outbreaks</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 size={10} /> {nodeStatus?.iphis?.status || 'ONLINE'}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-[10px] text-[#5A6A8A] flex justify-between">
              <span>Protocol: {nodeStatus?.iphis?.protocol || 'HL7 v2.5.1 MLLP'}</span>
              <span className="font-bold text-emerald-600">{nodeStatus?.iphis?.latencyMs ? `${nodeStatus.iphis.latencyMs}ms` : '--'}</span>
            </div>
          </div>

          {/* OLIS Card */}
          <div className="bg-white border border-[#EBEFF5] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0F1A3A]">OLIS Lab Diagnostics</h3>
                  <p className="text-[10px] text-[#8A97B0] font-medium">LOINC Sputum Feeds</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 size={10} /> {nodeStatus?.olis?.status || 'ONLINE'}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-[10px] text-[#5A6A8A] flex justify-between">
              <span>Protocol: {nodeStatus?.olis?.protocol || 'HL7 ORU^R01'}</span>
              <span className="font-bold text-emerald-600">{nodeStatus?.olis?.latencyMs ? `${nodeStatus.olis.latencyMs}ms` : '--'}</span>
            </div>
          </div>

          {/* Panorama Card */}
          <div className="bg-white border border-[#EBEFF5] rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-50 text-cyan-700 rounded-xl flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#0F1A3A]">Panorama Immunization</h3>
                  <p className="text-[10px] text-[#8A97B0] font-medium">Vaccine & TST Registry</p>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 size={10} /> {nodeStatus?.panorama?.status || 'ONLINE'}
              </span>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-[10px] text-[#5A6A8A] flex justify-between">
              <span>Protocol: {nodeStatus?.panorama?.protocol || 'HL7 VXU^V04 FHIR'}</span>
              <span className="font-bold text-emerald-600">{nodeStatus?.panorama?.latencyMs ? `${nodeStatus.panorama.latencyMs}ms` : '--'}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8 space-y-6">
        
        {/* TB Case Provincial Gateway Controls */}
        <div className="bg-white border border-[#EBEFF5] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#0F1A3A]">Active TB Cases — Gateway Transmission Deck</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">Trigger manual case notifications or ingest provincial lab feeds directly into EMR cases.</p>
            </div>
            <span className="text-xs font-bold text-[#8A97B0]">{tbCases.length} cases available</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EBEFF5] text-[#8A97B0] text-[10px] font-black uppercase tracking-wider">
                  <th className="pb-3">Case Identifier</th>
                  <th className="pb-3">Patient Name</th>
                  <th className="pb-3">Status / Site</th>
                  <th className="pb-3">Sputum 1 / 2 / 3</th>
                  <th className="pb-3 text-right">Provincial Sync Actions</th>
                </tr>
              </thead>
              <tbody>
                {tbCases.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-[#F8FAFF] transition-colors">
                    <td className="py-3.5 font-mono font-bold text-[#0F1A3A]">{c.caseNumber}</td>
                    <td className="py-3.5 font-bold text-[#1A3C8F]">{c.patientName}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded border border-amber-200">
                          {c.status}
                        </span>
                        <span className="text-[10px] text-[#8A97B0] font-semibold">{c.tbSite || 'PULMONARY'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 font-mono text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${c.sputumSample1Result === 'POSITIVE' ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-500'}`}>
                        S1: {c.sputumSample1Result || 'PENDING'}
                      </span>{' '}
                      <span className={`px-1.5 py-0.5 rounded ${c.sputumSample2Result === 'POSITIVE' ? 'bg-red-50 text-red-600 font-bold' : 'text-slate-500'}`}>
                        S2: {c.sputumSample2Result || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSyncIphis(c.id, c.caseNumber)}
                          disabled={syncingId === `iphis-${c.id}`}
                          className="btn-outline text-[11px] px-3 py-1.5 rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold flex items-center gap-1"
                        >
                          <Send size={11} /> {syncingId === `iphis-${c.id}` ? 'Syncing...' : 'Sync iPHIS'}
                        </button>

                        <button
                          onClick={() => {
                            setOlisTargetCase(c);
                            setOlisModalOpen(true);
                          }}
                          className="btn-outline text-[11px] px-3 py-1.5 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 font-bold flex items-center gap-1"
                        >
                          <Database size={11} /> Ingest OLIS Lab
                        </button>

                        <button
                          onClick={() => handleSyncPanorama(c.id, c.caseNumber)}
                          disabled={syncingId === `panorama-${c.id}`}
                          className="btn-ghost text-[11px] px-3 py-1.5 rounded-lg border border-[#DDE3F0] text-cyan-800 hover:bg-cyan-50 font-bold flex items-center gap-1"
                        >
                          <Layers size={11} /> Panorama
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tbCases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#8A97B0]">
                      No active TB cases found. Register a case in Tuberculosis Case Management tab to test provincial gateway sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sync Transaction History & Inspection Stream */}
        <div className="bg-white border border-[#EBEFF5] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-black text-[#0F1A3A]">Ontario Provincial Sync Transaction Stream</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">Real-time telemetry log of outgoing HL7 V2 / FHIR payloads and incoming ACK packets.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-[#8A97B0]" size={14} />
              <input
                className="input text-xs py-1.5 pl-8 pr-4 w-48 bg-slate-50"
                placeholder="Filter logs (e.g. OLIS)..."
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EBEFF5] text-[#8A97B0] text-[10px] font-black uppercase tracking-wider">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Target Platform</th>
                  <th className="pb-3">Record Type</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Triggered By</th>
                  <th className="pb-3 text-right">Payload Inspection</th>
                </tr>
              </thead>
              <tbody>
                {logs
                  .filter(l => l.targetPlatform?.toLowerCase().includes(logFilter.toLowerCase()) || l.recordType?.toLowerCase().includes(logFilter.toLowerCase()))
                  .map(l => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-[#F8FAFF]">
                      <td className="py-3.5 font-mono text-[10px] text-[#8A97B0]">{fmtDate(l.timestamp)}</td>
                      <td className="py-3.5">
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded border ${
                          l.targetPlatform === 'IPHIS' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          l.targetPlatform === 'OLIS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-cyan-50 text-cyan-700 border-cyan-200'
                        }`}>
                          {l.targetPlatform}
                        </span>
                      </td>
                      <td className="py-3.5 font-bold text-[#0F1A3A]">{l.recordType}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[10px] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 size={10} /> {l.status}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-[10px] text-[#8A97B0]">{l.userDisplayName || l.triggeredBy}</td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedLog(l);
                            setInspectModalOpen(true);
                          }}
                          className="btn-ghost text-[11px] px-2.5 py-1 rounded-lg border border-[#DDE3F0] text-[#1A3C8F] font-bold inline-flex items-center gap-1"
                        >
                          <FileCode size={12} /> View Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#8A97B0]">
                      No transaction logs recorded yet. Use the buttons above to trigger a provincial sync.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* OLIS Ingest Modal */}
      {olisModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center">
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-[#0F1A3A]">Simulate OLIS Lab Feed Ingestion</h3>
                <p className="text-xs text-[#8A97B0]">Target Case: {olisTargetCase?.caseNumber}</p>
              </div>
            </div>

            <form onSubmit={handleIngestOlis} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-[#8A97B0] uppercase block mb-1">Target Sputum Sample</label>
                <select className="select-input text-sm"
                  value={olisForm.sampleNumber} onChange={e => setOlisForm(f => ({ ...f, sampleNumber: e.target.value }))}>
                  <option value="1">Sputum Sample #1</option>
                  <option value="2">Sputum Sample #2</option>
                  <option value="3">Sputum Sample #3</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#8A97B0] uppercase block mb-1">LOINC Diagnostic Test Code</label>
                <select className="select-input text-sm"
                  value={olisForm.loincCode} onChange={e => setOlisForm(f => ({ ...f, loincCode: e.target.value }))}>
                  <option value="543-9">543-9 (Acid Fast Stain - Sputum Smear)</option>
                  <option value="634-6">634-6 (Mycobacterium tuberculosis Culture)</option>
                  <option value="41852-5">41852-5 (Microbacterium DNA PCR)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#8A97B0] uppercase block mb-1">Laboratory Test Result</label>
                <select className="select-input text-sm"
                  value={olisForm.result} onChange={e => setOlisForm(f => ({ ...f, result: e.target.value }))}>
                  <option value="NEGATIVE">NEGATIVE (No Acid Fast Bacilli seen)</option>
                  <option value="POSITIVE">POSITIVE (M. Tuberculosis detected)</option>
                  <option value="INDETERMINATE">INDETERMINATE / INCONCLUSIVE</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOlisModalOpen(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submittingOlis} className="btn-primary flex-1">
                  {submittingOlis ? 'Processing...' : 'Ingest Lab Feed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payload Inspection Modal */}
      {inspectModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#EBEFF5] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-[#0F1A3A]">HL7 V2 / FHIR Payload Inspection</h3>
                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200">
                    {selectedLog.targetPlatform}
                  </span>
                </div>
                <p className="text-xs text-[#8A97B0] mt-0.5">Transaction ID: {selectedLog.id}</p>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="btn-ghost text-xs px-3 py-1.5 rounded-lg">
                Close
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="text-[10px] font-black text-[#8A97B0] uppercase block mb-1">Payload Sent (HL7 v2.5.1 / FHIR Payload)</label>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                  {selectedLog.payloadSent}
                </pre>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#8A97B0] uppercase block mb-1">Received ACK Response (Gateway Acknowledgment)</label>
                <pre className="bg-slate-900 text-cyan-300 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                  {selectedLog.payloadReceived}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
