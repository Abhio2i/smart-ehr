import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Save, RefreshCw, Plus, X, Pill, AlertTriangle, ShieldAlert,
  Search, User, Calendar, FileText, Check, Trash2, ShieldCheck, Activity, Info,
  Lock, CheckSquare, Square, MapPin, AlertCircle
} from 'lucide-react';
import client from '../api/client';
import { useDispatch } from 'react-redux';
import { addToast } from '../store/slices/uiSlice';

const MedicationSafety = () => {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'drugs' | 'interactions'

  // --- Patient Search & Lock States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // --- Patient Prescription Orders States ---
  const [patientOrders, setPatientOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [patientAllergies, setPatientAllergies] = useState('No known drug allergies');
  
  // --- New Prescription Order Entry Form States ---
  const [prescribeGeneric, setPrescribeGeneric] = useState('');
  const [prescribeBrand, setPrescribeBrand] = useState('');
  const [prescribeDosage, setPrescribeDosage] = useState('');
  const [prescribeRoute, setPrescribeRoute] = useState('Oral');
  const [prescribeFrequency, setPrescribeFrequency] = useState('QD');
  const [prescribeStartDate, setPrescribeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [prescribeEndDate, setPrescribeEndDate] = useState('');
  const [prescribeRefills, setPrescribeRefills] = useState(0);
  const [prescribeInstructions, setPrescribeInstructions] = useState('');
  const [prescribeIndication, setPrescribeIndication] = useState('');
  const [prescribePharmacy, setPrescribePharmacy] = useState('STH_IN_HOUSE');
  const [esignaturePin, setEsignaturePin] = useState('');
  const [isSignedCheck, setIsSignedCheck] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // --- Search Autocomplete Suggester ---
  const [genericSearchTerm, setGenericSearchTerm] = useState('');
  const [showDrugSuggestions, setShowDrugSuggestions] = useState(false);
  const suggestionRef = useRef(null);

  // --- Safety Interceptor Warnings ---
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [duplicationWarning, setDuplicationWarning] = useState(null);

  // --- Drug Discontinue Dialog State ---
  const [discontinueOrderId, setDiscontinueOrderId] = useState(null);
  const [discontinueReason, setDiscontinueReason] = useState('');
  const [submittingDiscontinue, setSubmittingDiscontinue] = useState(false);

  // --- Reset PIN Modal States ---
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinResetPassword, setPinResetPassword] = useState('');
  const [pinResetNewPin, setPinResetNewPin] = useState('');
  const [submittingPinReset, setSubmittingPinReset] = useState(false);
  const [pinResetError, setPinResetError] = useState('');

  // --- Drug Master Database States ---
  const [drugs, setDrugs] = useState([]);
  const [drugsLoading, setDrugsLoading] = useState(false);
  const [isDrugModalOpen, setIsDrugModalOpen] = useState(false);
  const [drugGenericName, setDrugGenericName] = useState('');
  const [drugBrandNames, setDrugBrandNames] = useState('');
  const [drugClass, setDrugClass] = useState('');
  const [drugAllergyKeywords, setDrugAllergyKeywords] = useState('');
  const [drugError, setDrugError] = useState('');
  const [drugSubmitting, setDrugSubmitting] = useState(false);

  // --- Drug Interaction Rules States ---
  const [interactions, setInteractions] = useState([]);
  const [interLoading, setInterLoading] = useState(false);
  const [isInterModalOpen, setIsInterModalOpen] = useState(false);
  const [interTriggerA, setInterTriggerA] = useState('');
  const [interTriggerB, setInterTriggerB] = useState('');
  const [interRiskLevel, setInterRiskLevel] = useState('MEDIUM');
  const [interWarningMsg, setInterWarningMsg] = useState('');
  const [interError, setInterError] = useState('');
  const [interSubmitting, setInterSubmitting] = useState(false);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowDrugSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // --- Core Data Loaders ---
  const fetchDrugs = async () => {
    setDrugsLoading(true);
    try {
      const res = await client.get('/api/drug-master');
      setDrugs(res.data || []);
    } catch (err) {
      console.error('Failed to load drugs:', err);
    } finally {
      setDrugsLoading(false);
    }
  };

  const fetchInteractions = async () => {
    setInterLoading(true);
    try {
      const res = await client.get('/api/drug-interactions');
      setInteractions(res.data || []);
    } catch (err) {
      console.error('Failed to load interactions:', err);
    } finally {
      setInterLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'drugs') fetchDrugs();
    if (activeTab === 'interactions') fetchInteractions();
  }, [activeTab]);

  useEffect(() => {
    fetchDrugs();
  }, []);

  // --- Patient Lookup Actions ---
  const handlePatientSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter a patient name or ID' }));
      return;
    }
    setSearching(true);
    try {
      const res = await client.get('/api/admin/patients/search', {
        params: { query: searchQuery.trim(), limit: 10 }
      });
      const list = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.content || res.data?.data || []);
      setSearchResults(list);
      if (list.length === 0) {
        dispatch(addToast({ type: 'warning', message: 'No patient profiles match that query' }));
      }
    } catch (err) {
      console.error('Failed to search patients:', err);
      dispatch(addToast({ type: 'error', message: 'Error searching patient records' }));
    } finally {
      setSearching(false);
    }
  };

  const fetchPatientOrdersAndAllergies = async (pat) => {
    setLoadingOrders(true);
    setPatientOrders([]);
    setSafetyAlerts([]);
    const patientId = pat.patientId || pat.id;
    setPatientAllergies(pat.allergy || 'No known drug allergies');

    try {
      const res = await client.get(`/api/patients/${patientId}/medication-orders`);
      setPatientOrders(res.data || []);
    } catch (err) {
      console.error('Failed to load patient prescriptions:', err);
      dispatch(addToast({ type: 'error', message: 'Error retrieving active prescriptions' }));
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSelectPatient = (pat) => {
    setSelectedPatient(pat);
    setSearchResults([]);
    fetchPatientOrdersAndAllergies(pat);
  };

  // --- Therapeutic Duplication Safety Check ---
  const checkTherapeuticDuplication = (genericName) => {
    if (!genericName) {
      setDuplicationWarning(null);
      return;
    }
    const selectedDrugInfo = drugs.find(d => d.genericName.toLowerCase() === genericName.toLowerCase());
    if (!selectedDrugInfo || !selectedDrugInfo.drugClass) {
      setDuplicationWarning(null);
      return;
    }
    
    const duplicate = patientOrders.find(order => 
      order.orderStatus === 'ACTIVE' && 
      order.drugGenericName.toLowerCase() !== genericName.toLowerCase() &&
      drugs.find(d => d.genericName.toLowerCase() === order.drugGenericName.toLowerCase())?.drugClass === selectedDrugInfo.drugClass
    );
    
    if (duplicate) {
      setDuplicationWarning({
        message: `Therapeutic Duplication Warning: Patient is already prescribed an active drug in class "${selectedDrugInfo.drugClass}" (${duplicate.drugGenericName.toUpperCase()}).`,
        riskLevel: 'MEDIUM'
      });
    } else {
      setDuplicationWarning(null);
    }
  };

  // --- Real-Time Safety Interception Check ---
  const runSafetyCheck = async (genericName) => {
    if (!selectedPatient || !genericName.trim()) {
      setSafetyAlerts([]);
      return;
    }
    setCheckingSafety(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;
    try {
      const res = await client.get(`/api/patients/${patientId}/medication-orders/check-safety`, {
        params: { genericName: genericName.trim().toLowerCase() }
      });
      setSafetyAlerts(res.data || []);
      checkTherapeuticDuplication(genericName);
    } catch (err) {
      console.error('Safety check failure:', err);
    } finally {
      setCheckingSafety(false);
    }
  };

  const handleGenericDrugChange = (generic) => {
    setPrescribeGeneric(generic);
    setGenericSearchTerm(generic);
    
    const matchedDrug = drugs.find(d => d.genericName.toLowerCase() === generic.toLowerCase());
    if (matchedDrug && matchedDrug.brandNames?.length > 0) {
      setPrescribeBrand(matchedDrug.brandNames[0]);
    } else {
      setPrescribeBrand('');
    }

    if (generic) {
      runSafetyCheck(generic);
    } else {
      setSafetyAlerts([]);
      setDuplicationWarning(null);
    }
  };

  const handleSelectDrugSuggestion = (drug) => {
    handleGenericDrugChange(drug.genericName);
    setShowDrugSuggestions(false);
  };

  // --- Sign & Submit New Prescription Order ---
  const handlePrescribeMedication = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!prescribeGeneric.trim() || !prescribeDosage.trim()) {
      dispatch(addToast({ type: 'error', message: 'Generic name and dosage strength are required' }));
      return;
    }
    if (!isSignedCheck) {
      dispatch(addToast({ type: 'error', message: 'You must confirm the electronic prescription signature' }));
      return;
    }
    if (!esignaturePin.trim() || esignaturePin.length < 4) {
      dispatch(addToast({ type: 'error', message: 'Please enter a valid 4-digit signature verification PIN' }));
      return;
    }

    setSubmittingOrder(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;

    try {
      const payload = {
        drugGenericName: prescribeGeneric.trim().toLowerCase(),
        drugBrandName: prescribeBrand.trim(),
        dosageStrength: prescribeDosage.trim(),
        route: prescribeRoute,
        frequency: prescribeFrequency,
        startDate: prescribeStartDate || null,
        endDate: prescribeEndDate || null,
        refillsAuthorized: parseInt(prescribeRefills) || 0,
        instructions: prescribeInstructions.trim(),
        clinicalIndication: prescribeIndication.trim(),
        pharmacyRouting: prescribePharmacy,
        esignaturePin: esignaturePin.trim()
      };

      await client.post(`/api/patients/${patientId}/medication-orders`, payload);
      dispatch(addToast({ type: 'success', message: 'Prescription signed and transmitted to Pharmacy!' }));
      
      setPrescribeGeneric('');
      setGenericSearchTerm('');
      setPrescribeBrand('');
      setPrescribeDosage('');
      setPrescribeRoute('Oral');
      setPrescribeFrequency('QD');
      setPrescribeEndDate('');
      setPrescribeRefills(0);
      setPrescribeInstructions('');
      setPrescribeIndication('');
      setPrescribePharmacy('STH_IN_HOUSE');
      setEsignaturePin('');
      setIsSignedCheck(false);
      setSafetyAlerts([]);
      setDuplicationWarning(null);

      fetchPatientOrdersAndAllergies(selectedPatient);
    } catch (err) {
      console.error('Failed to create medication order:', err);
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Error signing prescription order' }));
    } finally {
      setSubmittingOrder(false);
    }
  };

  // --- Discontinue Prescription Trigger ---
  const handleDiscontinueOrder = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !discontinueOrderId) return;
    if (!discontinueReason.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please specify the discontinuation clinical rationale' }));
      return;
    }

    setSubmittingDiscontinue(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;

    try {
      await client.post(`/api/patients/${patientId}/medication-orders/${discontinueOrderId}/discontinue`, null, {
        params: { reason: discontinueReason.trim() }
      });
      dispatch(addToast({ type: 'success', message: 'Prescription discontinued successfully' }));
      setDiscontinueOrderId(null);
      setDiscontinueReason('');
      fetchPatientOrdersAndAllergies(selectedPatient);
    } catch (err) {
      console.error('Failed to stop medication order:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to discontinue medication' }));
    } finally {
      setSubmittingDiscontinue(false);
    }
  };

  const handleResetPinSubmit = async (e) => {
    e.preventDefault();
    if (!pinResetPassword.trim() || !pinResetNewPin.trim()) {
      setPinResetError('Both password and new PIN are required');
      return;
    }
    if (pinResetNewPin.length < 4 || !/^\d{4}$/.test(pinResetNewPin)) {
      setPinResetError('New PIN must be exactly 4 numeric digits');
      return;
    }

    setSubmittingPinReset(true);
    setPinResetError('');
    try {
      await client.post('/api/users/profile/signature-pin', {
        currentPassword: pinResetPassword,
        newPin: pinResetNewPin
      });
      dispatch(addToast({ type: 'success', message: 'E-signature PIN updated successfully!' }));
      setIsPinModalOpen(false);
      setPinResetPassword('');
      setPinResetNewPin('');
    } catch (err) {
      console.error('Failed to reset signature PIN:', err);
      const errMsg = err.response?.data?.message || 'Verification failed. Please check your password.';
      setPinResetError(errMsg);
    } finally {
      setSubmittingPinReset(false);
    }
  };

  // --- Drug Master Actions ---
  const openAddDrug = () => {
    setDrugGenericName('');
    setDrugBrandNames('');
    setDrugClass('');
    setDrugAllergyKeywords('');
    setDrugError('');
    setIsDrugModalOpen(true);
  };

  const handleSaveDrug = async (e) => {
    e.preventDefault();
    if (!drugGenericName.trim() || !drugClass.trim()) {
      setDrugError('Generic Name and Drug Class are required');
      return;
    }

    setDrugSubmitting(true);
    setDrugError('');
    try {
      const brandList = drugBrandNames.split(',')
        .map(b => b.trim())
        .filter(b => b.length > 0);
      const keywordList = drugAllergyKeywords.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      const payload = {
        genericName: drugGenericName.trim().toLowerCase(),
        brandNames: brandList,
        drugClass: drugClass.trim().toUpperCase(),
        allergyClassKeywords: keywordList
      };

      await client.post('/api/drug-master', payload);
      setIsDrugModalOpen(false);
      fetchDrugs();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save drug master entry';
      setDrugError(errMsg);
    } finally {
      setDrugSubmitting(false);
    }
  };

  // --- Drug Interaction Actions ---
  const openAddInteraction = () => {
    setInterTriggerA('');
    setInterTriggerB('');
    setInterRiskLevel('MEDIUM');
    setInterWarningMsg('');
    setInterError('');
    setIsInterModalOpen(true);
  };

  const handleSaveInteraction = async (e) => {
    e.preventDefault();
    if (!interTriggerA.trim() || !interTriggerB.trim() || !interWarningMsg.trim()) {
      setInterError('All fields are required');
      return;
    }

    setInterSubmitting(true);
    setInterError('');
    try {
      const payload = {
        triggerDrugOrClassA: interTriggerA.trim().toLowerCase(),
        triggerDrugOrClassB: interTriggerB.trim().toLowerCase(),
        riskLevel: interRiskLevel,
        warningMessage: interWarningMsg.trim()
      };

      await client.post('/api/drug-interactions', payload);
      setIsInterModalOpen(false);
      fetchInteractions();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to save interaction rule';
      setInterError(errMsg);
    } finally {
      setInterSubmitting(false);
    }
  };

  const handleResetSearch = () => {
    setSelectedPatient(null);
    setPatientOrders([]);
    setSearchQuery('');
    setSafetyAlerts([]);
    setDuplicationWarning(null);
  };

  const filteredDrugs = drugs.filter(d => 
    d.genericName.toLowerCase().includes(genericSearchTerm.toLowerCase()) ||
    d.brandNames?.some(b => b.toLowerCase().includes(genericSearchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Manage Order Entry</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Clinical Medication <span className="text-brand-blue">& Prescriptions</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            Prescribe medications, view active logs, and intercept patient allergy or drug conflicts.
          </p>
        </div>
        {selectedPatient && activeTab === 'orders' && (
          <button onClick={handleResetSearch} className="btn-secondary text-xs px-3.5 py-2">
            Change Patient
          </button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-[#F0F4FC] gap-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2.5 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <FileText size={16} /> Physician Prescription Orders (CPOE)
        </button>
        <button
          onClick={() => setActiveTab('drugs')}
          className={`pb-2.5 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'drugs'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <Pill size={16} /> Drug Master Registry
        </button>
        <button
          onClick={() => setActiveTab('interactions')}
          className={`pb-2.5 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'interactions'
              ? 'border-brand-blue text-brand-blue'
              : 'border-transparent text-[#8A97B0] hover:text-[#0F1A3A]'
          }`}
        >
          <AlertTriangle size={16} /> Drug Interaction Rules
        </button>
      </div>

      {/* --- TAB 0: Physician Prescription Entry (CPOE) --- */}
      {activeTab === 'orders' && (
        !selectedPatient ? (
          /* Search Patient Panel */
          <div className="card p-6 space-y-6 max-w-2xl">
            <div>
              <h3 className="font-black text-[#0F1A3A] text-base">Select Patient Profile</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">Find patient to create, discontinue, or review prescriptions</p>
            </div>

            <form onSubmit={handlePatientSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Enter patient name..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none"
                />
              </div>
              <button type="submit" disabled={searching} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
                {searching ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                Search
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="border border-[#F0F4FC] rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase">Matching Patients</div>
                <div className="divide-y divide-[#F0F4FC]">
                  {searchResults.map(pat => (
                    <div key={pat.id || pat.patientId} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{pat.patientName ?? pat.displayName ?? pat.name}</p>
                        <p className="text-xs text-slate-500">ID: {pat.patientId || pat.id} | DOB: {pat.dateOfBirth || pat.dob || 'N/A'}</p>
                      </div>
                      <button onClick={() => handleSelectPatient(pat)} className="text-brand-blue bg-blue-50 hover:bg-brand-blue hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                        Open Prescription Workspace
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* CPOE Prescribing Workspace Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Demographics & Allergies */}
            <div className="space-y-6 h-fit">
              
              {/* Demographics Card */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-3 border-b border-[#F0F4FC] pb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Patient Profile</h3>
                    <p className="text-xs text-[#8A97B0]">Prescription recipient details</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase">Full Name</p>
                    <p className="text-sm font-bold text-[#0F1A3A] mt-0.5">{selectedPatient.patientName ?? selectedPatient.displayName ?? selectedPatient.name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase">System Patient ID</p>
                    <p className="text-xs font-mono text-[#4B5A7A] mt-0.5">{selectedPatient.patientId || selectedPatient.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase">Allergies Profile</p>
                    <div className={`mt-1 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                      patientAllergies.toLowerCase().includes('no known') 
                        ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                        : 'bg-red-50 text-brand-red border border-red-100 animate-pulse'
                    }`}>
                      <ShieldAlert size={14} className="shrink-0" />
                      <span className="truncate">{patientAllergies}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Safety Interceptor Warnings Panel */}
              {(prescribeGeneric.trim() || duplicationWarning) && (
                <div className="card p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
                    <Activity className="text-brand-blue" size={16} />
                    <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Safety Interceptor Logs</h4>
                  </div>
                  
                  {checkingSafety ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#8A97B0]">
                      <RefreshCw className="animate-spin text-brand-blue" size={14} /> Cross-referencing database rules...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      
                      {/* Class-based therapeutic duplication warning */}
                      {duplicationWarning && (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-700">
                            <AlertCircle size={12} />
                            <span>Therapeutic Duplication</span>
                            <span className="ml-auto font-black">{duplicationWarning.riskLevel} RISK</span>
                          </div>
                          <p className="text-xs font-semibold leading-relaxed">{duplicationWarning.message}</p>
                        </div>
                      )}

                      {/* Direct safety rules / allergy warnings */}
                      {safetyAlerts.length === 0 && !duplicationWarning && (
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100 text-emerald-600 rounded-lg text-xs font-bold flex items-center gap-2">
                          <ShieldCheck size={14} /> Safety Clearance: No interaction or allergy conflicts detected for "{prescribeGeneric}".
                        </div>
                      )}

                      {safetyAlerts.map((alert, i) => (
                        <div key={i} className={`p-3 border rounded-xl space-y-1.5 ${
                          alert.riskLevel === 'HIGH' 
                            ? 'bg-red-50 border-red-200 text-brand-red animate-bounce' 
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                            <AlertTriangle size={12} />
                            <span>{alert.triggerField || 'Conflict'} Alert</span>
                            <span className="ml-auto font-black">{alert.riskLevel} RISK</span>
                          </div>
                          <p className="text-xs font-semibold leading-relaxed">{alert.warningMessage}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Active Prescriptions & Order Forms */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Active Prescriptions Table */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Active Medication Orders</h3>
                      <p className="text-xs text-[#8A97B0]">Current active physician prescription logs</p>
                    </div>
                  </div>
                </div>

                {loadingOrders ? (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="animate-spin text-brand-blue" size={24} />
                  </div>
                ) : patientOrders.length === 0 ? (
                  <div className="p-4 bg-slate-50 text-center rounded-xl text-xs font-bold text-slate-500">
                    No active medication prescriptions orders recorded for this patient.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#F0F4FC] rounded-xl">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Medication (Generic/Brand)</th>
                          <th>Dose/Route</th>
                          <th>Frequency</th>
                          <th>Clinical Indication</th>
                          <th>Validity</th>
                          <th>Signed By</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientOrders.map(order => (
                          <tr key={order.id} className={order.orderStatus === 'DISCONTINUED' ? 'opacity-50 line-through bg-slate-50/55' : ''}>
                            <td>
                              <p className="font-bold text-slate-800 capitalize">{order.drugGenericName}</p>
                              {order.drugBrandName && <p className="text-[10px] text-slate-400 italic">Brand: {order.drugBrandName}</p>}
                            </td>
                            <td>
                              <p className="text-xs font-bold text-slate-700">{order.dosageStrength}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{order.route}</p>
                            </td>
                            <td className="text-xs font-bold text-brand-blue">{order.frequency}</td>
                            <td>
                              <p className="text-xs font-semibold text-slate-600">{order.clinicalIndication || 'No Indication Mapped'}</p>
                              {order.pharmacyRouting && (
                                <span className="inline-flex items-center gap-0.5 text-[8px] bg-blue-50 text-brand-blue border border-blue-100 font-bold px-1 py-0.5 rounded uppercase mt-0.5">
                                  <MapPin size={8} /> {order.pharmacyRouting.replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td>
                              <p className="text-[10px] font-bold text-slate-500">Start: {order.startDate}</p>
                              {order.endDate && <p className="text-[10px] text-slate-400">End: {order.endDate}</p>}
                              {order.refillsAuthorized > 0 && <p className="text-[9px] font-bold text-purple-600">Refills: {order.refillsAuthorized}</p>}
                            </td>
                            <td>
                              <p className="text-[10px] font-bold text-slate-700 truncate max-w-[90px]">{order.prescribingDoctorName}</p>
                              {order.signedAt && <p className="text-[8px] text-slate-400">{new Date(order.signedAt).toLocaleDateString()}</p>}
                            </td>
                            <td>
                              {order.orderStatus === 'ACTIVE' ? (
                                <button
                                  onClick={() => setDiscontinueOrderId(order.id)}
                                  className="text-brand-red bg-red-50 hover:bg-brand-red hover:text-white px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1"
                                >
                                  <X size={10} /> Discontinue
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                  Stopped
                                  {order.discontinueReason && (
                                    <span className="block text-[8px] italic text-slate-400 line-clamp-1" title={order.discontinueReason}>
                                      ({order.discontinueReason})
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Order Entry Form */}
              <div className="card p-6 space-y-5 border border-slate-200">
                <div className="flex items-center gap-2 border-b border-[#F0F4FC] pb-4">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue">
                    <Pill size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">CPOE Order Entry Form</h3>
                    <p className="text-xs text-[#8A97B0]">Electronically configure and sign patient prescriptions</p>
                  </div>
                </div>

                <form onSubmit={handlePrescribeMedication} className="space-y-6">
                  
                  {/* STEP 1: Drug Selection with search-as-you-type Autocomplete */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Step 1: Select Medication
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Search Autocomplete */}
                      <div className="space-y-1.5 relative" ref={suggestionRef}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Search Drug (Generic/Brand) <span className="text-brand-red">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            value={genericSearchTerm}
                            onChange={e => {
                              setGenericSearchTerm(e.target.value);
                              setShowDrugSuggestions(true);
                              if (!e.target.value) {
                                setPrescribeGeneric('');
                                setSafetyAlerts([]);
                                setDuplicationWarning(null);
                              }
                            }}
                            onFocus={() => setShowDrugSuggestions(true)}
                            placeholder="Type generic or brand name..."
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
                          />
                          {prescribeGeneric && (
                            <button
                              type="button"
                              onClick={() => {
                                setPrescribeGeneric('');
                                setGenericSearchTerm('');
                                setPrescribeBrand('');
                                setSafetyAlerts([]);
                                setDuplicationWarning(null);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Autocomplete Droplist */}
                        {showDrugSuggestions && genericSearchTerm.trim() && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                            {filteredDrugs.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500">No matching generic drugs in master index.</div>
                            ) : (
                              filteredDrugs.map(drug => (
                                <div
                                  key={drug.id}
                                  onClick={() => handleSelectDrugSuggestion(drug)}
                                  className="p-3 hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center transition-colors"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 capitalize">{drug.genericName}</span>
                                    {drug.brandNames?.length > 0 && <span className="text-slate-400 italic ml-1">({drug.brandNames.join(', ')})</span>}
                                  </div>
                                  <span className="text-[9px] bg-blue-50 text-brand-blue border border-blue-100 font-bold px-1.5 py-0.5 rounded">{drug.drugClass}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Brand Name Autofill */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Selected Brand Name Suggestion</label>
                        <input
                          type="text"
                          readOnly
                          value={prescribeBrand}
                          placeholder="Select a drug above to autofill brand name"
                          className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-3 py-2.5 text-xs outline-none cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 2: Dosing & Administration */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Step 2: Dosing & Administration
                    </p>
                    
                    <div className="space-y-4">
                      {/* Dosage Strength with Quick Presets */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Dosage Strength / Amount <span className="text-brand-red">*</span></label>
                        <input
                          type="text"
                          value={prescribeDosage}
                          onChange={e => setPrescribeDosage(e.target.value)}
                          placeholder="e.g. 500 mg, 1 tablet, 10 ml"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-all"
                        />
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {['500 mg', '250 mg', '1 tablet', '10 ml', '5 ml', '1 puff'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPrescribeDosage(preset)}
                              className="bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded text-[10px] font-bold transition-all"
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Route of Administration Selection Grid */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Route of Administration</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { value: 'Oral', label: 'Oral (PO)' },
                            { value: 'IV', label: 'Intravenous (IV)' },
                            { value: 'IM', label: 'Intramuscular (IM)' },
                            { value: 'Subcutaneous', label: 'Subcut (SC)' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPrescribeRoute(opt.value)}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                                prescribeRoute === opt.value
                                  ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Frequency Schedule Selection Grid */}
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Frequency Schedule</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { value: 'QD', label: 'QD (Once Daily)' },
                            { value: 'BID', label: 'BID (2x Daily)' },
                            { value: 'TID', label: 'TID (3x Daily)' },
                            { value: 'PRN', label: 'PRN (As Needed)' }
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPrescribeFrequency(opt.value)}
                              className={`px-3 py-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                                prescribeFrequency === opt.value
                                  ? 'bg-blue-50 border-brand-blue text-brand-blue ring-1 ring-brand-blue'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Refills numeric */}
                      <div className="space-y-1.5 w-full md:w-1/3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Refills Authorized</label>
                        <input
                          type="number"
                          min="0"
                          value={prescribeRefills}
                          onChange={e => setPrescribeRefills(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STEP 3: Indication & Routing */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Step 3: Clinical Reason & Pharmacy Route
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Clinical Indication */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Clinical Indication / Diagnosis Mappings</label>
                        <input
                          type="text"
                          value={prescribeIndication}
                          onChange={e => setPrescribeIndication(e.target.value)}
                          placeholder="e.g., Hypertension management, Acute knee swelling"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-brand-blue transition-all"
                        />
                      </div>

                      {/* Pharmacy eRx routing */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Target Pharmacy Route (eRx)</label>
                        <select
                          value={prescribePharmacy}
                          onChange={e => setPrescribePharmacy(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-xs outline-none focus:border-brand-blue transition-all"
                        >
                          <option value="STH_IN_HOUSE">Stanton Hospital Pharmacy (STH-IN)</option>
                          <option value="INUVIK_REGIONAL">Inuvik Regional Hospital Pharmacy (IRH-DISP)</option>
                          <option value="HAY_RIVER_COMMUNITY">Hay River Health Centre Dispensary</option>
                          <option value="YELLOWKNIFE_COMMUNITY">Yellowknife Community Shoppers eRx</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* STEP 4: Timeline & Instructions */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Step 4: Validity & Instructions
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Validity Start Date</label>
                        <input
                          type="date"
                          value={prescribeStartDate}
                          onChange={e => setPrescribeStartDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Validity End Date (Optional)</label>
                        <input
                          type="date"
                          value={prescribeEndDate}
                          onChange={e => setPrescribeEndDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Directions for Use / Prescription Instructions</label>
                      <textarea
                        rows={2}
                        value={prescribeInstructions}
                        onChange={e => setPrescribeInstructions(e.target.value)}
                        placeholder="e.g. Take with food. Avoid alcohol. Monitor blood sugar daily."
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue transition-all"
                      />
                    </div>
                  </div>

                  {/* STEP 5: Electronic Signature Verification */}
                  <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                    <p className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={14} /> Step 5: Secure Physician e-Signature
                    </p>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Signature Checkbox */}
                      <button
                        type="button"
                        onClick={() => setIsSignedCheck(!isSignedCheck)}
                        className="flex items-start gap-2.5 text-left text-xs font-bold text-[#4B5A7A] hover:text-slate-800 transition-colors"
                      >
                        {isSignedCheck ? (
                          <CheckSquare className="text-brand-blue shrink-0 mt-0.5" size={16} />
                        ) : (
                          <Square className="text-slate-400 shrink-0 mt-0.5" size={16} />
                        )}
                        <div>
                          <span>Authorize Clinical Prescription Sign-off</span>
                          <span className="block text-[10px] text-slate-400 font-medium mt-0.5">I certify that I am the prescribing physician logged in.</span>
                        </div>
                      </button>

                      {/* eSign PIN Code */}
                      <div className="space-y-1 w-full md:w-44">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase">e-Signature PIN (4-digit)</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={esignaturePin}
                          onChange={e => setEsignaturePin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold tracking-widest text-center outline-none focus:border-brand-blue transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPinResetError('');
                            setPinResetPassword('');
                            setPinResetNewPin('');
                            setIsPinModalOpen(true);
                          }}
                          className="text-[10px] text-brand-blue hover:underline block text-right mt-1 font-bold"
                        >
                          Forgot / Reset PIN?
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit actions */}
                  <div className="flex gap-2 justify-end pt-3 border-t border-[#F0F4FC]">
                    <button
                      type="submit"
                      disabled={submittingOrder || (safetyAlerts.length > 0 && safetyAlerts.some(a => a.riskLevel === 'HIGH'))}
                      className="btn-primary text-xs px-6 py-3 flex items-center gap-1.5 disabled:opacity-40 transition-all shadow-sm"
                    >
                      {submittingOrder ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                      Sign & Transmit Prescription
                    </button>
                  </div>
                </form>
              </div>

            </div>

          </div>
        )
      )}

      {/* --- TAB 1: Drug Master Database Registry --- */}
      {activeTab === 'drugs' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
            <div>
              <h3 className="font-black text-[#0F1A3A] text-base">Drug Master Registry</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">View and register generic medicines, brand names, and drug classes</p>
            </div>
            <button onClick={openAddDrug} className="btn-primary text-xs px-3.5 py-2">
              <Plus size={14} /> Add Medicine
            </button>
          </div>

          {drugsLoading && drugs.length === 0 ? (
            <div className="space-y-3 py-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-[#F0F4FC] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : drugs.length === 0 ? (
            <div className="text-center py-12">
              <Pill size={36} className="text-[#DDE3F0] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#4B5A7A]">No Medicines Registered</p>
              <p className="text-xs text-[#8A97B0] mt-1">Register drugs to enable allergy and interaction checking</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#F0F4FC] rounded-xl">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Generic Name</th>
                    <th>Brand Names</th>
                    <th>Drug Class</th>
                    <th>Allergy Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {drugs.map((d, index) => (
                    <tr key={d.id || index}>
                      <td className="font-bold text-[#0F1A3A] capitalize">{d.genericName}</td>
                      <td className="text-sm text-[#4B5A7A]">{d.brandNames?.join(', ') || '-'}</td>
                      <td className="text-sm font-bold text-brand-blue tracking-wide">{d.drugClass}</td>
                      <td className="text-xs font-mono text-[#8A97B0]">{d.allergyClassKeywords?.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: Drug Interaction Rules --- */}
      {activeTab === 'interactions' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-3">
            <div>
              <h3 className="font-black text-[#0F1A3A] text-base">Drug Interaction Safety Rules</h3>
              <p className="text-xs text-[#8A97B0] mt-0.5">Define warning and risk alerts for concurrent medications</p>
            </div>
            <button onClick={openAddInteraction} className="btn-primary text-xs px-3.5 py-2">
              <Plus size={14} /> Add Safety Rule
            </button>
          </div>

          {interLoading && interactions.length === 0 ? (
            <div className="space-y-3 py-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-[#F0F4FC] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : interactions.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle size={36} className="text-[#DDE3F0] mx-auto mb-3" />
              <p className="text-sm font-bold text-[#4B5A7A]">No Interaction Rules Defined</p>
              <p className="text-xs text-[#8A97B0] mt-1">Add rules to alert clinicians when drug combinations conflict</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#F0F4FC] rounded-xl">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trigger A (Drug/Class)</th>
                    <th>Trigger B (Drug/Class)</th>
                    <th>Risk Level</th>
                    <th>Warning Message</th>
                  </tr>
                </thead>
                <tbody>
                  {interactions.map((i, index) => (
                    <tr key={i.id || index}>
                      <td className="font-bold text-[#0F1A3A] capitalize">{i.triggerDrugOrClassA}</td>
                      <td className="font-bold text-[#0F1A3A] capitalize">{i.triggerDrugOrClassB}</td>
                      <td>
                        <span className={`badge ${i.riskLevel === 'HIGH' ? 'badge-red' : 'badge-yellow'}`}>
                          {i.riskLevel}
                        </span>
                      </td>
                      <td className="text-xs text-[#4B5A7A] max-w-sm whitespace-normal leading-relaxed">{i.warningMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- Dialog Modal: Discontinue Order --- */}
      {discontinueOrderId && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleDiscontinueOrder} className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0] p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-brand-red border-b border-[#F0F4FC] pb-3">
              <Trash2 size={20} />
              <h4 className="font-black text-sm uppercase tracking-wider text-[#0F1A3A]">Discontinue Medication Order</h4>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">Reason for Discontinuing Medication</label>
              <textarea
                required
                rows={3}
                value={discontinueReason}
                onChange={e => setDiscontinueReason(e.target.value)}
                placeholder="e.g., Target treatment course complete, patient reported stomach discomfort, changed to alternative therapy."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDiscontinueOrderId(null)} className="btn-secondary text-xs px-3.5 py-2">
                Cancel
              </button>
              <button type="submit" disabled={submittingDiscontinue} className="bg-brand-red hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1">
                {submittingDiscontinue ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                Confirm Stop Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- Drug Modal (Master Registry) --- */}
      {isDrugModalOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0] my-4 animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                  <Pill size={18} />
                </div>
                <div>
                  <h4 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Add New Generic Medicine</h4>
                  <p className="text-[10px] text-[#8A97B0]">Register drug details into the master index</p>
                </div>
              </div>
              <button onClick={() => setIsDrugModalOpen(false)} className="text-[#8A97B0] hover:text-[#0F1A3A] transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveDrug} className="p-5 space-y-4">
              {drugError && (
                <div className="p-3 bg-red-50 border border-red-200 text-brand-red text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} /> {drugError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Generic Drug Name (Required)</label>
                <input
                  type="text"
                  required
                  value={drugGenericName}
                  onChange={e => setDrugGenericName(e.target.value)}
                  placeholder="e.g. ibuprofen"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Brand Names (Comma-separated)</label>
                <input
                  type="text"
                  value={drugBrandNames}
                  onChange={e => setDrugBrandNames(e.target.value)}
                  placeholder="e.g. Advil, Motrin"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Drug Class Classification (Required)</label>
                <input
                  type="text"
                  required
                  value={drugClass}
                  onChange={e => setDrugClass(e.target.value)}
                  placeholder="e.g. NSAID, BETA_BLOCKER"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Allergy Class Keywords (Comma-separated)</label>
                <input
                  type="text"
                  value={drugAllergyKeywords}
                  onChange={e => setDrugAllergyKeywords(e.target.value)}
                  placeholder="e.g. ibuprofen, nsaid, aspirin"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => setIsDrugModalOpen(false)} className="btn-secondary text-xs px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={drugSubmitting} className="btn-primary text-xs px-4 py-2 flex items-center gap-1">
                  {drugSubmitting ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Drug Interaction Modal (Master Rules) --- */}
      {isInterModalOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0] my-4 animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Add Interaction Safety Rule</h4>
                  <p className="text-[10px] text-[#8A97B0]">Set up warnings for conflicting drug pairs</p>
                </div>
              </div>
              <button onClick={() => setIsInterModalOpen(false)} className="text-[#8A97B0] hover:text-[#0F1A3A] transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInteraction} className="p-5 space-y-4">
              {interError && (
                <div className="p-3 bg-red-50 border border-red-200 text-brand-red text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={14} /> {interError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Trigger Drug or Class A</label>
                <input
                  type="text"
                  required
                  value={interTriggerA}
                  onChange={e => setInterTriggerA(e.target.value)}
                  placeholder="e.g. aspirin (or class: NSAID)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Trigger Drug or Class B</label>
                <input
                  type="text"
                  required
                  value={interTriggerB}
                  onChange={e => setInterTriggerB(e.target.value)}
                  placeholder="e.g. warfarin (or class: ANTICOAGULANT)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Interaction Severity / Risk Level</label>
                <select
                  value={interRiskLevel}
                  onChange={e => setInterRiskLevel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                >
                  <option value="MEDIUM">MEDIUM RISK</option>
                  <option value="HIGH">HIGH RISK (CRITICAL)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Safety Warning Message</label>
                <textarea
                  required
                  rows={3}
                  value={interWarningMsg}
                  onChange={e => setInterWarningMsg(e.target.value)}
                  placeholder="e.g. Concomitant use increases severe gastrointestinal bleeding risk."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F0F4FC]">
                <button type="button" onClick={() => setIsInterModalOpen(false)} className="btn-secondary text-xs px-4 py-2">
                  Cancel
                </button>
                <button type="submit" disabled={interSubmitting} className="btn-primary text-xs px-4 py-2 flex items-center gap-1">
                  {interSubmitting ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Dialog Modal: Reset E-Signature PIN --- */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleResetPinSubmit} className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DDE3F0] p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-brand-blue border-b border-[#F0F4FC] pb-3">
              <Lock size={20} />
              <h4 className="font-black text-sm uppercase tracking-wider text-[#0F1A3A]">Reset E-Signature PIN</h4>
            </div>

            {pinResetError && (
              <div className="p-3 bg-red-50 border border-red-200 text-brand-red text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} /> {pinResetError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">Verify Login Password</label>
              <input
                type="password"
                required
                value={pinResetPassword}
                onChange={e => setPinResetPassword(e.target.value)}
                placeholder="Enter current password..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase">New 4-digit Signature PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={pinResetNewPin}
                onChange={e => setPinResetNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold tracking-widest text-center outline-none focus:border-brand-blue"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F0F4FC]">
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="btn-secondary text-xs px-3.5 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingPinReset}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1"
              >
                {submittingPinReset ? <RefreshCw className="animate-spin" size={12} /> : <Check size={12} />}
                Confirm Update
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default MedicationSafety;
