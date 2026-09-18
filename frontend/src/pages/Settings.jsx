import { useState, useEffect } from 'react';
import {
  Save, RefreshCw, Plus, Trash2, Edit2, X, Network, ShieldAlert
} from 'lucide-react';
import client from '../api/client';

const Settings = () => {
  const [hospitals, setHospitals] = useState([]);
  const [hospLoading, setHospLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHosp, setEditingHosp] = useState(null);
  
  // Hospital form states
  const [hospName, setHospName] = useState('');
  const [hospIp, setHospIp] = useState('');
  const [hospPort, setHospPort] = useState('');
  const [hospActive, setHospActive] = useState(true);
  const [hospError, setHospError] = useState('');
  const [hospSubmitting, setHospSubmitting] = useState(false);

  const fetchHospitals = async () => {
    setHospLoading(true);
    try {
      const res = await client.get('/api/hl7/hospitals');
      setHospitals(res.data || []);
    } catch (err) {
      console.error('Failed to load hospitals:', err);
    } finally {
      setHospLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const openAddHospital = () => {
    setEditingHosp(null);
    setHospName('');
    setHospIp('');
    setHospPort('');
    setHospActive(true);
    setHospError('');
    setIsModalOpen(true);
  };

  const openEditHospital = (h) => {
    setEditingHosp(h);
    setHospName(h.name || '');
    setHospIp(h.hl7Ip || '');
    setHospPort(h.hl7Port != null ? h.hl7Port.toString() : '');
    setHospActive(h.active ?? true);
    setHospError('');
    setIsModalOpen(true);
  };

  const handleSaveHospital = async (e) => {
    e.preventDefault();
    if (!hospName.trim() || !hospIp.trim() || !hospPort.trim()) {
      setHospError('All fields are required');
      return;
    }
    const portNum = parseInt(hospPort, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      setHospError('Please enter a valid port number (1-65535)');
      return;
    }

    setHospSubmitting(true);
    setHospError('');
    try {
      const payload = {
        name: hospName.trim(),
        hl7Ip: hospIp.trim(),
        hl7Port: portNum,
        active: hospActive
      };

      if (editingHosp) {
        await client.put(`/api/hl7/hospitals/${editingHosp.id}`, payload);
      } else {
        await client.post('/api/hl7/hospitals', payload);
      }
      setIsModalOpen(false);
      fetchHospitals();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save hospital settings';
      setHospError(errMsg);
    } finally {
      setHospSubmitting(false);
    }
  };

  const handleDeleteHospital = async (id) => {
    if (!window.confirm('Are you sure you want to delete this hospital routing configuration?')) {
      return;
    }
    try {
      await client.delete(`/api/hl7/hospitals/${id}`);
      fetchHospitals();
    } catch (err) {
      console.error('Failed to delete hospital:', err);
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Configuration</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">System <span className="text-brand-blue">Settings</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Configure global legacy hospital MLLP destination receivers</p>
        </div>
      </div>

      {/* Main Content (HL7 routing configs only) */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
          <div>
            <h3 className="font-black text-[#0F1A3A] text-base">HL7 Routing Configurations</h3>
            <p className="text-xs text-[#8A97B0] mt-0.5">Manage target database IPs and TCP socket ports</p>
          </div>
          <button onClick={openAddHospital} className="btn-primary text-xs px-3.5 py-2">
            <Plus size={14} /> Add Target
          </button>
        </div>

        {hospLoading && hospitals.length === 0 ? (
          <div className="space-y-3 py-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-[#F0F4FC] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : hospitals.length === 0 ? (
          <div className="text-center py-12">
            <Network size={36} className="text-[#DDE3F0] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#4B5A7A]">No HL7 Hospital Targets Configured</p>
            <p className="text-xs text-[#8A97B0] mt-1">Configure targets to route patient run-sheets dynamically</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital Destination</th>
                  <th>HL7 Target IP</th>
                  <th>TCP Port</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map(h => (
                  <tr key={h.id}>
                    <td className="font-bold text-[#0F1A3A]">{h.name}</td>
                    <td className="font-mono text-sm text-[#4B5A7A]">{h.hl7Ip}</td>
                    <td className="font-mono text-sm text-[#4B5A7A]">{h.hl7Port}</td>
                    <td>
                      <span className={`badge ${h.active ? 'badge-green' : 'badge-gray'}`}>
                        {h.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditHospital(h)}
                          className="p-2 rounded-lg bg-[#F0F4FC] text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeleteHospital(h.id)}
                          className="p-2 rounded-lg bg-[#FFF0F3] text-brand-red hover:bg-brand-red hover:text-white transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hospital Routing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0] my-4 animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <Network size={18} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-base">{editingHosp ? 'Edit Hospital Target' : 'Add Hospital Target'}</h2>
                  <p className="text-xs text-[#8A97B0]">Set up MLLP dynamic TCP endpoints</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHospital} className="p-5 space-y-4">
              {hospError && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-brand-red text-xs font-semibold">
                  <ShieldAlert size={14} className="shrink-0" /> {hospError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Hospital Name</label>
                <input value={hospName} onChange={e => setHospName(e.target.value)}
                  placeholder="e.g. City General Hospital" className="input py-2 text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">HL7 Receiver IP</label>
                  <input value={hospIp} onChange={e => setHospIp(e.target.value)}
                    placeholder="e.g. 10.0.1.50" className="input py-2 text-sm font-mono" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">MLLP Port</label>
                  <input value={hospPort} onChange={e => setHospPort(e.target.value)}
                    placeholder="e.g. 5001" className="input py-2 text-sm font-mono" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-[#F8FAFF] rounded-xl border border-[#DDE3F0] mt-2">
                <div>
                  <p className="text-xs font-bold text-[#0F1A3A]">Active Routing Target</p>
                  <p className="text-[10px] text-[#8A97B0]">Enable message delivery for this target</p>
                </div>
                <button type="button" onClick={() => setHospActive(!hospActive)}
                  className={`w-9 h-5 rounded-full relative transition-all ${hospActive ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${hospActive ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={hospSubmitting} className="btn-primary text-xs px-4 py-2">
                  {hospSubmitting ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  {hospSubmitting ? 'Saving…' : 'Save Config'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
