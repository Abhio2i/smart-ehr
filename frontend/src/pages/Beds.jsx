import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch, useSelector } from 'react-redux';
import { addToast } from '../store/slices/uiSlice';
import client, { extractErrorMessage } from '../api/client';
import { selectUser } from '../store/slices/authSlice';
import { maskName, maskDob, maskPhone } from '../utils/phiMasking';
import {
  BedDouble, Plus, Search, CheckCircle2, AlertTriangle, X,
  RefreshCw, Users, ShieldAlert, Trash2, ChevronDown, Calendar,
  Building2, Layers, Hash, DoorOpen, Sparkles, Clock
} from 'lucide-react';

const WARD_OPTIONS = [
  'ICU',
  'Emergency Room',
  'General Ward',
  'Paediatrics',
  'Maternity',
  'Orthopaedics',
  'Cardiology',
  'Oncology',
  'Neurology',
  'Other',
];

const ROLES_CAN_MANAGE = ['ADMIN', 'MANAGER', 'PARAMEDIC'];

export default function Beds() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const currentUser = useSelector(selectUser);
  const userRole = (currentUser?.role || '').toUpperCase();
  const canManage = ROLES_CAN_MANAGE.includes(userRole);
  const isAdmin = userRole === 'ADMIN';

  // ── Data States ───────────────────────────────────────────────────────────
  const [beds, setBeds]   = useState([]);
  const [stats, setStats] = useState({
    totalBeds: 0, occupiedBeds: 0, availableBeds: 0, maintenanceBeds: 0, occupancyRate: 0
  });
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState([]); // for Admin dropdown

  // ── Filters & Search ──────────────────────────────────────────────────────
  const [selectedFacility, setSelectedFacility] = useState('All');
  const [selectedWard, setSelectedWard] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Create Bed Modal ──────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    bedNumber: '',
    roomNumber: '',
    wardName: '',
    facilityName: currentUser?.facilityName || currentUser?.organizationName || '',
    customWard: '',
  });

  // ── Manage Bed Modal (Assign / Vacate / Status) ───────────────────────────
  const [selectedBed, setSelectedBed] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [allotmentDays, setAllotmentDays] = useState('');

  // ── Delete Confirmation ───────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(null);

  // ── Fetch active organizations for Admin facility selector ────────────────
  useEffect(() => {
    if (isAdmin) {
      client.get('/api/organizations')
        .then(res => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.content || []);
          setOrganizations(list);
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  // Set default facility for addForm once organizations load
  useEffect(() => {
    if (showAddModal && organizations.length > 0 && !addForm.facilityName) {
      setAddForm(f => ({ ...f, facilityName: organizations[0].name }));
    }
  }, [showAddModal, organizations, addForm.facilityName]);

  // ── Load data from API ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedWard !== 'All') {
        params.ward = selectedWard;
      }
      if (selectedFacility !== 'All') {
        params.facility = selectedFacility;
      }
      const [bedsRes, statsRes] = await Promise.all([
        client.get('/api/beds', { params }),
        client.get('/api/beds/stats'),
      ]);
      setBeds(bedsRes.data || []);
      setStats(statsRes.data || { totalBeds: 0, occupiedBeds: 0, availableBeds: 0, maintenanceBeds: 0, occupancyRate: 0 });
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to load bed configurations.' }));
    } finally {
      setLoading(false);
    }
  }, [selectedWard, selectedFacility, dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derive ward tabs dynamically from actual bed data ─────────────────────
  const wardTabs = ['All', ...Array.from(new Set(beds.map(b => b.wardName))).sort()];

  // ── Search filtering ──────────────────────────────────────────────────────
  const filteredBeds = beds.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bedNumber?.toLowerCase().includes(q) ||
      b.roomNumber?.toLowerCase().includes(q) ||
      b.wardName?.toLowerCase().includes(q) ||
      b.facilityName?.toLowerCase().includes(q) ||
      b.occupiedByPatientName?.toLowerCase().includes(q)
    );
  });

  // ── Patient Autocomplete ──────────────────────────────────────────────────
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }
    const delay = setTimeout(async () => {
      try {
        const { data } = await client.get('/api/admin/patients/search', {
          params: { phone: patientSearch, limit: 5 }
        });
        setPatients(data || []);
      } catch { /* silent */ }
    }, 300);
    return () => clearTimeout(delay);
  }, [patientSearch]);

  // ── Format Helper ─────────────────────────────────────────────────────────
  const fmtDateTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const getRemainingTimeText = (releaseDateTimeStr) => {
    if (!releaseDateTimeStr) return '';
    const diff = new Date(releaseDateTimeStr) - new Date();
    if (diff <= 0) return 'Expired';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  };

  // ── Auto-generate Bed Number Helper ───────────────────────────────────────
  const autoGenerateBedNumber = () => {
    const ward = addForm.wardName === 'Other' ? addForm.customWard : addForm.wardName;
    const room = addForm.roomNumber;
    if (!ward || !room) {
      dispatch(addToast({ type: 'warning', message: 'Please select a ward and enter a room number first.' }));
      return;
    }

    // Standard clinical abbreviations lookup
    const abbreviations = {
      'ICU': 'ICU',
      'Emergency Room': 'ER',
      'General Ward': 'GW',
      'Paediatrics': 'PED',
      'Maternity': 'MAT',
      'Orthopaedics': 'ORTHO',
      'Cardiology': 'CARD',
      'Oncology': 'ONCO',
      'Neurology': 'NEURO',
    };

    let wardCode = abbreviations[ward];

    if (!wardCode) {
      // Fallback for custom wards entered in 'Other'
      const cleanWard = ward.trim();
      if (cleanWard.includes(' ')) {
        // e.g. "Dental Clinic" -> "DC"
        wardCode = cleanWard.split(' ').map(w => w[0]).join('').toUpperCase();
      } else {
        // e.g. "NICU" -> "NICU", "Urology" -> "UROL"
        wardCode = cleanWard === cleanWard.toUpperCase() 
          ? cleanWard 
          : cleanWard.substring(0, 4).toUpperCase();
      }
    }

    const roomClean = room.replace(/\D/g, ''); // e.g. "RM-101" -> "101"

    // Check if BED-[WARD]-[ROOM] already exists
    const baseName = `BED-${wardCode}-${roomClean || room.toUpperCase()}`;
    const duplicateExists = beds.some(b => b.bedNumber === baseName);

    if (duplicateExists) {
      // Find the next available count index
      let nextIndex = 2;
      while (beds.some(b => b.bedNumber === `${baseName}-${nextIndex}`)) {
        nextIndex++;
      }
      setAddForm(f => ({ ...f, bedNumber: `${baseName}-${nextIndex}` }));
    } else {
      setAddForm(f => ({ ...f, bedNumber: baseName }));
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAssign = async (patient) => {
    if (!selectedBed) return;
    if (!allotmentDays || parseInt(allotmentDays) <= 0) {
      dispatch(addToast({ type: 'warning', message: 'Please specify the allotment duration in days first!' }));
      return;
    }
    setAssignLoading(true);
    try {
      const targetPatientId = patient.patientId || patient.id || patient.phone;
      const targetPatientName = patient.displayName || patient.patientName || patient.name || 'Patient';
      await client.put(`/api/beds/${selectedBed.id}/assign`, null, {
        params: {
          patientId: targetPatientId,
          patientName: targetPatientName,
          allottedDays: allotmentDays ? parseInt(allotmentDays) : null
        }
      });
      dispatch(addToast({ type: 'success', message: `Patient assigned to Bed ${selectedBed.bedNumber} successfully!` }));
      setSelectedBed(null);
      setPatientSearch('');
      setPatients([]);
      setAllotmentDays('');
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) }));
    } finally {
      setAssignLoading(false);
    }
  };

  const handleVacate = async (bed) => {
    if (window.confirm(`Are you sure you want to vacate patient from Bed ${bed.bedNumber}?`)) {
      try {
        await client.put(`/api/beds/${bed.id}/vacate`);
        dispatch(addToast({ type: 'success', message: `Bed ${bed.bedNumber} is now vacated.` }));
        setSelectedBed(null);
        loadData();
      } catch {
        dispatch(addToast({ type: 'error', message: 'Failed to vacate bed.' }));
      }
    }
  };

  const handleTestExpire = async (bed) => {
    try {
      await client.put(`/api/beds/${bed.id}/test-expire`);
      dispatch(addToast({ 
        type: 'success', 
        message: 'Expiry simulated successfully! Bed will auto-vacate and notify within 5 minutes.' 
      }));
      setSelectedBed(null);
      loadData();
    } catch (err) {
      dispatch(addToast({ type: 'error', message: extractErrorMessage(err) }));
    }
  };

  const handleToggleMaintenance = async (bed, isToMaintenance) => {
    const nextStatus = isToMaintenance ? 'MAINTENANCE' : 'AVAILABLE';
    try {
      await client.put(`/api/beds/${bed.id}/status`, null, {
        params: { status: nextStatus }
      });
      dispatch(addToast({
        type: 'success',
        message: `Bed ${bed.bedNumber} marked as ${nextStatus === 'MAINTENANCE' ? 'Maintenance' : 'Available'}.`
      }));
      setSelectedBed(null);
      loadData();
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to update bed status.' }));
    }
  };

  const handleCreateBed = async (e) => {
    e.preventDefault();
    const wardName = addForm.wardName === 'Other' ? addForm.customWard : addForm.wardName;
    if (!wardName.trim()) {
      dispatch(addToast({ type: 'error', message: 'Ward name is required.' }));
      return;
    }
    setAddLoading(true);
    try {
      await client.post('/api/beds', {
        bedNumber: addForm.bedNumber.trim().toUpperCase(),
        roomNumber: addForm.roomNumber.trim(),
        wardName: wardName.trim(),
        facilityName: addForm.facilityName.trim(),
      });
      dispatch(addToast({ type: 'success', message: `Bed ${addForm.bedNumber.toUpperCase()} added successfully!` }));
      setShowAddModal(false);
      setAddForm(f => ({ ...f, bedNumber: '', roomNumber: '', wardName: '', customWard: '' }));
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create bed.';
      dispatch(addToast({ type: 'error', message: msg }));
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteBed = async () => {
    if (!confirmDelete) return;
    try {
      await client.delete(`/api/beds/${confirmDelete}`);
      dispatch(addToast({ type: 'success', message: 'Bed deleted successfully.' }));
      setConfirmDelete(null);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete bed.';
      dispatch(addToast({ type: 'error', message: msg }));
    }
  };

  // Group beds by room for map view
  const bedsByRoom = filteredBeds.reduce((acc, bed) => {
    const room = bed.roomNumber || 'Other';
    if (!acc[room]) acc[room] = [];
    acc[room].push(bed);
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2">
            <BedDouble className="text-brand-blue" />
            Bed & Capacity Management
          </h1>
          <p className="text-xs text-[#8A97B0] font-bold mt-1">
            Real-time patient bed allocation, ward layouts, and capacity metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-[#F0F4FC] hover:bg-[#E2EAFD] text-[#4B5A7A] text-[10px] font-black px-3.5 py-2 rounded-lg transition-all shadow-xs uppercase tracking-wider"
          >
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
            Sync State
          </button>
          {canManage && (
            <button
              onClick={() => {
                setAddForm(f => ({
                  ...f,
                  facilityName: user?.facilityName || user?.organizationName || ''
                }));
                setShowAddModal(true);
              }}
              className="btn-primary text-xs px-3.5 py-2 flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Bed
            </button>
          )}
        </div>
      </div>

      {/* Analytics widgets row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Capacity */}
        <div className="bg-gradient-to-br from-[#1E3A8A] to-[#3B82F6] rounded-2xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-85">Total Capacity</p>
            <p className="text-3xl font-black mt-1.5">{stats.totalBeds}</p>
            <p className="text-[10px] font-bold opacity-80 mt-1">Configured in system</p>
          </div>
          <div className="bg-white/10 p-3 rounded-xl">
            <BedDouble size={24} />
          </div>
        </div>

        {/* Occupied */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8EEFA] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">Occupied Beds</p>
            <p className="text-3xl font-black text-[#F43F5E] mt-1.5">{stats.occupiedBeds}</p>
            <p className="text-[10px] font-bold text-[#8A97B0] mt-1">Active patient charts</p>
          </div>
          <div className="bg-rose-50 text-[#F43F5E] p-3 rounded-xl">
            <Users size={24} />
          </div>
        </div>

        {/* Available */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8EEFA] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">Available Beds</p>
            <p className="text-3xl font-black text-[#10B981] mt-1.5">{stats.availableBeds}</p>
            <p className="text-[10px] font-bold text-[#8A97B0] mt-1">Ready for screening</p>
          </div>
          <div className="bg-emerald-50 text-[#10B981] p-3 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8EEFA] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">Maintenance</p>
            <p className="text-3xl font-black text-[#F59E0B] mt-1.5">{stats.maintenanceBeds}</p>
            <p className="text-[10px] font-bold text-[#8A97B0] mt-1">Blocked / Cleaning</p>
          </div>
          <div className="bg-amber-50 text-[#F59E0B] p-3 rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-white rounded-2xl p-4 border border-[#E8EEFA] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-[#8A97B0] uppercase tracking-wider">Occupancy Rate</p>
            <p className="text-3xl font-black text-[#0F1A3A] mt-1.5">{stats.occupancyRate}%</p>
            <div className="w-full bg-[#F0F4FC] h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[#3B82F6] h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.occupancyRate}%` }}
              />
            </div>
          </div>
          <div className="bg-blue-50 text-[#3B82F6] p-3 rounded-xl">
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* Ward Navigation & Search */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8EEFA] shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex items-center gap-4 flex-wrap">
          {/* Facility switcher for Admins */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#4B5A7A]">Facility:</span>
              <div className="relative">
                <select
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  className="form-input text-xs font-black text-[#0F1A3A] bg-[#F7F9FD] border-none rounded-lg py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-brand-blue cursor-pointer"
                >
                  <option value="All">All Facilities</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.name}>{org.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 pointer-events-none text-[#8A97B0]" />
              </div>
            </div>
          )}

          {/* Ward Tabs */}
          <div className="flex items-center gap-1.5 bg-[#F7F9FD] p-1 rounded-xl">
            {wardTabs.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedWard(t)}
                className={`text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-lg transition-all ${
                  selectedWard === t
                    ? 'bg-white text-brand-blue shadow-sm'
                    : 'text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-[#8A97B0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search beds, patients, rooms..."
            className="form-input text-xs pl-8 pr-3 py-1.5 w-60"
          />
        </div>
      </div>

      {/* Empty State */}
      {!loading && filteredBeds.length === 0 && (
        <div className="bg-white border border-[#E8EEFA] rounded-2xl p-16 text-center shadow-xs flex flex-col items-center justify-center">
          <BedDouble size={48} className="text-[#8A97B0] mb-3" />
          <h3 className="font-black text-sm text-[#0F1A3A] uppercase tracking-wider">No beds registered</h3>
          <p className="text-xs text-[#8A97B0] mt-1 max-w-sm">
            {beds.length === 0
              ? 'Start by adding your first hospital bed to begin tracking capacity.'
              : 'Try adjusting your filters or search term.'}
          </p>
          {canManage && beds.length === 0 && (
            <button
              onClick={() => {
                setAddForm(f => ({
                  ...f,
                  facilityName: user?.facilityName || user?.organizationName || ''
                }));
                setShowAddModal(true);
              }}
              className="btn-primary text-xs px-4 py-2 mt-4 flex items-center gap-1.5"
            >
              <Plus size={14} /> Add First Bed
            </button>
          )}
        </div>
      )}

      {/* Ward Map Grid */}
      {!loading && filteredBeds.length > 0 && (
        <div className="space-y-8">
          {Object.keys(bedsByRoom).sort().map((roomName) => (
            <div key={roomName} className="bg-white rounded-2xl border border-[#E8EEFA] shadow-xs overflow-hidden">
              {/* Room Header */}
              <div className="bg-[#F7F9FD] px-5 py-3 border-b border-[#E8EEFA] flex items-center justify-between">
                <span className="font-black text-xs text-[#0F1A3A] uppercase tracking-wider">
                  📍 Room {roomName}
                </span>
                <span className="text-[10px] font-bold text-[#8A97B0] uppercase">
                  {bedsByRoom[roomName].length} configured beds
                </span>
              </div>

              {/* Beds Inside Room */}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {bedsByRoom[roomName].map((bed) => {
                  let cardCls = '';
                  let dotCls = '';
                  let statusLabel = '';

                  if (bed.status === 'AVAILABLE') {
                    cardCls = 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/50 text-emerald-800';
                    dotCls = 'bg-emerald-500 animate-pulse';
                    statusLabel = 'Available';
                  } else if (bed.status === 'OCCUPIED') {
                    cardCls = 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/50 text-rose-800';
                    dotCls = 'bg-rose-500';
                    statusLabel = 'Occupied';
                  } else {
                    cardCls = 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/50 text-amber-800';
                    dotCls = 'bg-amber-500';
                    statusLabel = 'Maintenance';
                  }

                  return (
                    <div
                      key={bed.id}
                      onClick={() => setSelectedBed(bed)}
                      className={`border rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 relative group overflow-hidden shadow-xs hover:shadow-sm ${cardCls}`}
                    >
                      {/* Bed Top Row */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <BedDouble size={20} className="group-hover:scale-105 transition-transform duration-200" />
                          <div>
                            <p className="text-xs font-black text-[#0F1A3A]">{bed.bedNumber}</p>
                            <p className="text-[9px] font-black text-[#8A97B0] uppercase">{bed.wardName}</p>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white border rounded-full">
                          <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                          {statusLabel}
                        </span>
                      </div>

                      {/* Bed Bottom Info */}
                      <div className="mt-4 pt-2 border-t border-dashed border-[#E8EEFA] flex flex-col justify-end">
                        {bed.status === 'OCCUPIED' ? (
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-[#0F1A3A] truncate">{bed.occupiedByPatientName}</p>
                            <p className="text-[9px] font-bold text-[#8A97B0] flex items-center gap-1">
                              <Calendar size={9} /> {fmtDateTime(bed.assignedAt)}
                            </p>
                            {bed.releaseDateTime && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 mt-1 max-w-max">
                                <Clock size={8} /> {getRemainingTimeText(bed.releaseDateTime)}
                              </span>
                            )}
                          </div>
                        ) : bed.status === 'AVAILABLE' ? (
                          <p className="text-[9px] font-black uppercase tracking-wider text-[#8A97B0]">
                            + Click to assign
                          </p>
                        ) : (
                          <p className="text-[9px] font-black uppercase tracking-wider text-[#8A97B0] flex items-center gap-1">
                            <AlertTriangle size={10} className="text-amber-500" /> Blocked / Service
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Bed Modal (User Friendly Layout with Preview) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* Form Side */}
            <form onSubmit={handleCreateBed} className="p-6 flex-1 space-y-4 border-r border-[#F0F4FC]">
              <div className="flex items-center gap-2 pb-3 border-b border-[#F0F4FC] mb-2">
                <div className="w-7 h-7 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                  <Plus size={14} className="text-brand-blue" />
                </div>
                <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Register New Bed</h3>
              </div>

              {/* Ward & Room Inputs (Side-by-Side) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[#4B5A7A] uppercase tracking-wider mb-1">
                    <Layers size={11} className="inline mr-1" /> Ward *
                  </label>
                  <div className="relative">
                    <select
                      value={addForm.wardName}
                      onChange={e => setAddForm(f => ({ ...f, wardName: e.target.value, customWard: '' }))}
                      required
                      className="form-input text-xs w-full appearance-none pr-8 cursor-pointer"
                    >
                      <option value="">Select ward…</option>
                      {WARD_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-2.5 pointer-events-none text-[#8A97B0]" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">
                    <DoorOpen size={11} className="inline mr-1" /> Room Number *
                  </label>
                  <input
                    value={addForm.roomNumber}
                    onChange={e => setAddForm(f => ({ ...f, roomNumber: e.target.value }))}
                    placeholder="e.g. RM-101"
                    required
                    className="form-input text-xs w-full"
                  />
                </div>
              </div>

              {addForm.wardName === 'Other' && (
                <div>
                  <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">Custom Ward Name *</label>
                  <input
                    value={addForm.customWard}
                    onChange={e => setAddForm(f => ({ ...f, customWard: e.target.value }))}
                    placeholder="Enter custom ward name"
                    required
                    className="form-input text-xs w-full"
                  />
                </div>
              )}

              {/* Bed Number with Auto-generate wizard */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider">
                    <Hash size={11} className="inline mr-1" /> Bed Identification *
                  </label>
                  <button
                    type="button"
                    onClick={autoGenerateBedNumber}
                    className="text-[10px] font-black text-brand-blue hover:text-brand-blue/80 flex items-center gap-1 uppercase tracking-wider transition-all"
                  >
                    <Sparkles size={11} /> Auto-Generate
                  </button>
                </div>
                <input
                  value={addForm.bedNumber}
                  onChange={e => setAddForm(f => ({ ...f, bedNumber: e.target.value }))}
                  placeholder="e.g. BED-ICU-101-1"
                  required
                  className="form-input text-xs w-full font-mono font-bold"
                />
              </div>

              {/* Facility Selection */}
              <div>
                <label className="block text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider mb-1">
                  <Building2 size={11} className="inline mr-1" /> Hospital Facility *
                </label>
                {isAdmin ? (
                  <div className="relative">
                    <select
                      value={addForm.facilityName}
                      onChange={e => setAddForm(f => ({ ...f, facilityName: e.target.value }))}
                      required
                      className="form-input text-xs w-full appearance-none pr-8 cursor-pointer"
                    >
                      {organizations.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-2.5 pointer-events-none text-[#8A97B0]" />
                  </div>
                ) : (
                  <input
                    value={addForm.facilityName}
                    readOnly
                    className="form-input text-xs w-full bg-gray-50 border-gray-200 text-gray-500 cursor-not-allowed font-bold"
                  />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost text-xs px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={addLoading} className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5">
                  {addLoading ? 'Creating…' : <><Plus size={13} /> Add to Ward</>}
                </button>
              </div>
            </form>

            {/* Live Visual Preview Side */}
            <div className="w-full md:w-60 bg-[#F8FAFF] p-6 flex flex-col justify-center items-center gap-4">
              <span className="text-[10px] font-black text-[#8A97B0] uppercase tracking-widest mb-1">
                Live Card Preview
              </span>
              
              <div className="border border-emerald-200 bg-emerald-50/30 text-emerald-800 rounded-xl p-4 flex flex-col justify-between h-32 w-48 shadow-xs border-dashed">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BedDouble size={20} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-black text-[#0F1A3A] truncate w-24">
                        {addForm.bedNumber.toUpperCase() || 'BED-XXX'}
                      </p>
                      <p className="text-[9px] font-black text-[#8A97B0] uppercase truncate w-20">
                        {addForm.wardName === 'Other' ? addForm.customWard : addForm.wardName || 'Ward Name'}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 bg-white border border-emerald-200 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Ready
                  </span>
                </div>

                <div className="mt-4 pt-2 border-t border-dashed border-emerald-200 flex flex-col justify-end text-[9px] font-black uppercase tracking-wider text-[#8A97B0] truncate w-full">
                  Room: {addForm.roomNumber || 'RM-XX'}
                </div>
              </div>
              
              <p className="text-[10px] text-center text-[#8A97B0] leading-normal max-w-[180px] font-bold">
                As you type, this preview shows how the bed card will appear on the ward maps board.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ── Manage Bed Action Modal (Assign / Vacate / Status) ── */}
      {selectedBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F4FC] bg-[#F8FAFF]">
              <div>
                <h3 className="font-black text-sm text-[#0F1A3A] uppercase tracking-wider">
                  Manage Bed {selectedBed.bedNumber}
                </h3>
                <p className="text-[10px] text-[#8A97B0] font-bold mt-0.5">
                  {selectedBed.facilityName} • {selectedBed.wardName}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedBed(null);
                  setPatientSearch('');
                  setPatients([]);
                }}
                className="text-[#8A97B0] hover:text-[#0F1A3A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* If Bed is Occupied */}
              {selectedBed.status === 'OCCUPIED' && (
                <div className="space-y-4">
                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-[#F43F5E] uppercase tracking-wider">Occupying Patient</p>
                    <div>
                      <p className="text-sm font-black text-[#0F1A3A]">{selectedBed.occupiedByPatientName}</p>
                      <p className="text-xs font-bold text-[#8A97B0]">ID: {selectedBed.occupiedByPatientId}</p>
                    </div>
                    <div className="text-xs font-bold text-[#4B5A7A] flex items-center gap-1.5 pt-1">
                      <Calendar size={13} className="text-[#8A97B0]" />
                      Admitted: {fmtDateTime(selectedBed.assignedAt)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVacate(selectedBed)}
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black py-2.5 rounded-xl uppercase tracking-wider transition-all"
                      >
                        Vacate / Discharge
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleToggleMaintenance(selectedBed, true)}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-2.5 rounded-xl uppercase tracking-wider transition-all"
                        >
                          Under Service
                        </button>
                      )}
                    </div>
                    {selectedBed.releaseDateTime && (
                      <button
                        onClick={() => handleTestExpire(selectedBed)}
                        className="w-full bg-[#EEF2FF] hover:bg-[#E0E7FF] text-brand-blue border border-brand-blue/20 text-xs font-black py-2 rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                      >
                        <Clock size={13} /> Simulate Instant Expiry (Dev)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* If Bed is Available */}
              {selectedBed.status === 'AVAILABLE' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-[#4B5A7A] uppercase tracking-wider">
                      Lookup Patient (Search Registry)
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-[#8A97B0]" size={14} />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search by name, phone, or SSN..."
                        className="form-input text-xs w-full pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-black text-[#4B5A7A] uppercase tracking-wider">
                      Allotment Duration (Days) <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={allotmentDays}
                      onChange={(e) => setAllotmentDays(e.target.value)}
                      placeholder="Required (e.g., 3 days)"
                      className="form-input text-xs w-full border-rose-200 focus:border-rose-400 focus:ring-rose-400"
                      required
                    />
                  </div>

                  {/* Autocomplete Results list */}
                  {patients.length > 0 && (
                    <div className="border border-[#E8EEFA] rounded-xl overflow-hidden divide-y divide-[#F0F4FC] shadow-sm max-h-40 overflow-y-auto">
                      {patients.map((pat) => (
                        <div
                          key={pat.patientId || pat.id || pat.phone}
                          onClick={() => handleAssign(pat)}
                          className="px-4 py-2.5 hover:bg-[#F7F9FD] cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <p className="text-xs font-black text-[#0F1A3A]">{maskName(pat.displayName || pat.patientName || pat.name || 'Patient', userRole)}</p>
                            <p className="text-[9px] font-bold text-[#8A97B0] mt-0.5">
                              DOB: {maskDob(pat.dateOfBirth || pat.patientDateOfBirth, userRole) || '—'} • Phone: {maskPhone(pat.phone || pat.patientPhone, userRole) || '—'}
                            </p>
                          </div>
                          <span className="text-[8px] font-black uppercase bg-[#F0F4FC] text-brand-blue px-2 py-0.5 rounded-full">
                            Select
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {patientSearch.trim() && patients.length === 0 && (
                    <p className="text-[10px] text-[#8A97B0] font-bold italic text-center py-2">
                      No patients found matching query...
                    </p>
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleToggleMaintenance(selectedBed, true)}
                      className="w-full bg-[#F0F4FC] hover:bg-[#E2EAFD] text-[#4B5A7A] text-xs font-black py-2.5 rounded-xl uppercase tracking-wider transition-all"
                    >
                      Mark for Maintenance
                    </button>
                  )}
                </div>
              )}

              {/* If Bed is in Maintenance */}
              {selectedBed.status === 'MAINTENANCE' && (
                <div className="space-y-4">
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center">
                    <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-xs font-black text-[#78350F] uppercase">Maintenance Mode</p>
                    <p className="text-[11px] text-[#78350F] opacity-80 mt-1">
                      This bed is currently blocked for cleaning, telemetry checks, or clinical service.
                    </p>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleToggleMaintenance(selectedBed, false)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black py-2.5 rounded-xl uppercase tracking-wider transition-all"
                    >
                      Mark Ready (Available)
                    </button>
                  )}
                </div>
              )}

              {/* Delete Bed Option inside Action Modal if not Occupied */}
              {canManage && selectedBed.status !== 'OCCUPIED' && (
                <div className="pt-4 border-t border-[#F0F4FC] flex justify-end">
                  <button
                    onClick={() => {
                      setConfirmDelete(selectedBed.id);
                      setSelectedBed(null);
                    }}
                    className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1.5"
                  >
                    <Trash2 size={13} /> Delete Bed Config
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation dialog ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <AlertTriangle size={36} className="text-red-500 mx-auto mb-3 animate-bounce" />
            <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Delete Bed?</h3>
            <p className="text-xs text-[#8A97B0] mt-1">
              Are you sure you want to delete this bed config? This action is permanent.
            </p>
            <div className="flex gap-2 justify-center mt-5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBed}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
