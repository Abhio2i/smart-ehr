import { useState } from 'react';
import {
  Search, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Fingerprint,
  Calendar, Save, ShieldCheck, User, Phone, Mail, FileText, Check, Trash2,
  FileCheck, ShieldAlert, CreditCard, Building, Coins
} from 'lucide-react';
import client from '../api/client';
import { useDispatch, useSelector } from 'react-redux';
import { addToast } from '../store/slices/uiSlice';
import { selectUser } from '../store/slices/authSlice';
import { maskName, maskPhone, maskDob, isRoleMasked } from '../utils/phiMasking';

const HealthcareRegistration = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const userRole = currentUser?.role || '';
  const isMaskedRole = isRoleMasked(userRole);

  // Search & Patient selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Healthcare coverage states
  const [coverage, setCoverage] = useState(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form enrollment states
  const [coverageType, setCoverageType] = useState('NWT_HEALTH_CARE_PLAN');
  const [nwtPlanNumber, setNwtPlanNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [eligible, setEligible] = useState(true);

  // Real-world fields form states
  const [versionCode, setVersionCode] = useState('');
  const [cardExpiryDate, setCardExpiryDate] = useState('');
  const [residencyStatus, setResidencyStatus] = useState('PERMANENT_RESIDENT');
  const [planCode, setPlanCode] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  // Reciprocal Billing form states
  const [homeJurisdictionHealthCardNumber, setHomeJurisdictionHealthCardNumber] = useState('');
  const [reciprocalBillingCode, setReciprocalBillingCode] = useState('');
  const [homeJurisdictionContactInfo, setHomeJurisdictionContactInfo] = useState('');

  // NIHB form states
  const [nihbClientId, setNihbClientId] = useState('');
  const [nihbBenefitCategory, setNihbBenefitCategory] = useState('MEDICAL_TRANSPORTATION');
  const [bandAffiliation, setBandAffiliation] = useState('');

  // Billing Linkage form states
  const [payerId, setPayerId] = useState('NWT_GOVT');
  const [claimReferenceNumber, setClaimReferenceNumber] = useState('');
  const [estimatedCoveragePercentage, setEstimatedCoveragePercentage] = useState(100);

  // Handle patient lookup search
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter a search query' }));
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
        dispatch(addToast({ type: 'warning', message: 'No patients found matching query' }));
      }
    } catch (err) {
      console.error('Patient search failed:', err);
      dispatch(addToast({ type: 'error', message: 'Failed to search patients' }));
    } finally {
      setSearching(false);
    }
  };

  // Fetch coverage details once patient is selected
  const fetchCoverage = async (patientId) => {
    setLoadingCoverage(true);
    setCoverage(null);
    handleResetForm();

    try {
      const res = await client.get(`/api/patients/${patientId}/registration/coverage`);
      if (res.data) {
        setCoverage(res.data);
        
        // Populate form details
        setCoverageType(res.data.coverageType || 'NWT_HEALTH_CARE_PLAN');
        setNwtPlanNumber(res.data.nwtPlanNumber || '');
        setExpiryDate(res.data.expiryDate || '');
        setEligible(res.data.eligible ?? true);

        setVersionCode(res.data.versionCode || '');
        setCardExpiryDate(res.data.cardExpiryDate || '');
        setResidencyStatus(res.data.residencyStatus || 'PERMANENT_RESIDENT');
        setPlanCode(res.data.planCode || '');
        setEffectiveFrom(res.data.effectiveFrom || '');
        setEffectiveTo(res.data.effectiveTo || '');

        setHomeJurisdictionHealthCardNumber(res.data.homeJurisdictionHealthCardNumber || '');
        setReciprocalBillingCode(res.data.reciprocalBillingCode || '');
        setHomeJurisdictionContactInfo(res.data.homeJurisdictionContactInfo || '');

        setNihbClientId(res.data.nihbClientId || '');
        setNihbBenefitCategory(res.data.nihbBenefitCategory || 'MEDICAL_TRANSPORTATION');
        setBandAffiliation(res.data.bandAffiliation || '');

        setPayerId(res.data.payerId || 'NWT_GOVT');
        setClaimReferenceNumber(res.data.claimReferenceNumber || '');
        setEstimatedCoveragePercentage(res.data.estimatedCoveragePercentage ?? 100);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Failed to load coverage details:', err);
        dispatch(addToast({ type: 'error', message: 'Error retrieving patient coverage' }));
      }
    } finally {
      setLoadingCoverage(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    fetchCoverage(patient.patientId || patient.id);
  };

  // Save coverage enrollment details
  const handleSaveCoverage = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;

    // Custom validations based on selected type
    if (coverageType === 'RECIPROCAL' && !homeJurisdictionHealthCardNumber.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter the Home Jurisdiction Health Card Number' }));
      return;
    }
    if (coverageType === 'NIHB' && !nihbClientId.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter the NIHB Status / Client Number' }));
      return;
    }
    if (coverageType !== 'UNINSURED' && coverageType !== 'RECIPROCAL' && coverageType !== 'NIHB' && !nwtPlanNumber.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please enter the Plan Card Number' }));
      return;
    }

    setIsSaving(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;

    try {
      const payload = {
        coverageType,
        nwtPlanNumber: (coverageType === 'UNINSURED' || coverageType === 'NIHB' || coverageType === 'RECIPROCAL') ? 'UNINSURED' : nwtPlanNumber.trim(),
        expiryDate: expiryDate || null,
        eligible,

        versionCode: versionCode.trim() || null,
        cardExpiryDate: cardExpiryDate || null,
        residencyStatus,
        planCode: planCode.trim() || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,

        homeJurisdictionHealthCardNumber: coverageType === 'RECIPROCAL' ? homeJurisdictionHealthCardNumber.trim() : null,
        reciprocalBillingCode: coverageType === 'RECIPROCAL' ? reciprocalBillingCode.trim() : null,
        homeJurisdictionContactInfo: coverageType === 'RECIPROCAL' ? homeJurisdictionContactInfo.trim() : null,

        nihbClientId: coverageType === 'NIHB' ? nihbClientId.trim() : null,
        nihbBenefitCategory: coverageType === 'NIHB' ? nihbBenefitCategory : null,
        bandAffiliation: coverageType === 'NIHB' ? bandAffiliation.trim() : null,

        payerId,
        claimReferenceNumber: claimReferenceNumber.trim() || null,
        estimatedCoveragePercentage: estimatedCoveragePercentage !== '' ? parseFloat(estimatedCoveragePercentage) : null
      };

      const res = await client.post(`/api/patients/${patientId}/registration/coverage`, payload);
      setCoverage(res.data);
      dispatch(addToast({ type: 'success', message: 'Healthcare coverage saved successfully' }));
    } catch (err) {
      console.error('Failed to save coverage:', err);
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Failed to save coverage details' }));
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger territorial health service validation query check
  const handleVerifyCoverage = async () => {
    if (!selectedPatient || !coverage) return;
    setIsVerifying(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;

    try {
      const res = await client.post(`/api/patients/${patientId}/registration/coverage/verify`);
      setCoverage(res.data);
      if (res.data.verificationStatus === 'VERIFIED') {
        dispatch(addToast({ type: 'success', message: 'Healthcare plan eligibility VERIFIED!' }));
      } else {
        dispatch(addToast({ type: 'error', message: `Verification failed: ${res.data.verificationNotes || 'Invalid card details'}` }));
      }
    } catch (err) {
      console.error('Verification failed:', err);
      dispatch(addToast({ type: 'error', message: 'Simulated verification server error' }));
    } finally {
      setIsVerifying(false);
    }
  };

  // Delete card coverage details
  const handleDeleteCoverage = async () => {
    if (!selectedPatient || !coverage) return;
    if (!window.confirm('Are you sure you want to delete this healthcare coverage registration? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    const patientId = selectedPatient.patientId || selectedPatient.id;

    try {
      await client.delete(`/api/patients/${patientId}/registration/coverage`);
      setCoverage(null);
      handleResetForm();
      dispatch(addToast({ type: 'success', message: 'Healthcare coverage deleted successfully' }));
    } catch (err) {
      console.error('Failed to delete coverage:', err);
      dispatch(addToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete coverage registration' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetForm = () => {
    setCoverageType('NWT_HEALTH_CARE_PLAN');
    setNwtPlanNumber('');
    setExpiryDate('');
    setEligible(true);
    setVersionCode('');
    setCardExpiryDate('');
    setResidencyStatus('PERMANENT_RESIDENT');
    setPlanCode('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setHomeJurisdictionHealthCardNumber('');
    setReciprocalBillingCode('');
    setHomeJurisdictionContactInfo('');
    setNihbClientId('');
    setNihbBenefitCategory('MEDICAL_TRANSPORTATION');
    setBandAffiliation('');
    setPayerId('NWT_GOVT');
    setClaimReferenceNumber('');
    setEstimatedCoveragePercentage(100);
  };

  const handleResetSearch = () => {
    setSelectedPatient(null);
    setCoverage(null);
    setSearchQuery('');
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'VERIFIED':
        return <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={12} /> Verified</span>;
      case 'FAILED':
        return <span className="badge badge-red flex items-center gap-1"><XCircle size={12} /> Verification Failed</span>;
      case 'PENDING':
      default:
        return <span className="badge badge-yellow flex items-center gap-1 animate-pulse"><RefreshCw size={12} className="animate-spin" /> Verification Pending</span>;
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="section-label mb-1">Manage Patient Access</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">
            Healthcare <span className="text-brand-blue">Registration</span>
          </h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">
            Enroll and verify provincial, reciprocal, or federal NIHB health care plan coverage eligibility
          </p>
        </div>
        {selectedPatient && (
          <button onClick={handleResetSearch} className="btn-secondary text-xs px-3 py-2">
            Find Another Patient
          </button>
        )}
      </div>

      {!selectedPatient ? (
        /* Patient Search Panel */
        <div className="card p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="font-black text-[#0F1A3A] text-base">Find Patient Profile</h3>
            <p className="text-xs text-[#8A97B0] mt-0.5">Lookup patient record by name, contact phone, or email to manage registration</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
              />
            </div>
            <button type="submit" disabled={searching} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
              {searching ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
              Search
            </button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border border-[#F0F4FC] rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase">Matching Patients</div>
              <div className="divide-y divide-[#F0F4FC]">
                {searchResults.map(pat => (
                  <div key={pat.id || pat.patientId} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-slate-800">{pat.patientName ?? pat.displayName ?? pat.name ?? 'Unknown Patient'}</p>
                      <p className="text-xs text-slate-500">ID: {pat.patientId || pat.id} | DOB: {pat.dateOfBirth || pat.dob || 'N/A'}</p>
                    </div>
                    <button onClick={() => handleSelectPatient(pat)} className="text-brand-blue bg-blue-50 hover:bg-brand-blue hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                      Select Patient
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Registration Coverage Management Panel */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Patient Demographic Card */}
          <div className="card p-6 space-y-4 h-fit">
            <div className="flex items-center gap-3 border-b border-[#F0F4FC] pb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-brand-blue">
                <User size={20} />
              </div>
              <div>
                <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Patient Demographics</h3>
                <p className="text-xs text-[#8A97B0]">Registered profile details</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {isMaskedRole && (
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200/60 rounded-lg text-[10px] font-bold text-amber-700 flex items-center gap-1.5">
                  <ShieldAlert size={12} className="shrink-0" />
                  <span>PHI Masking Active ({userRole} Role)</span>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <User className="text-[#8A97B0] shrink-0 mt-0.5" size={15} />
                <div>
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Full Name</p>
                  <p className="text-sm font-bold text-[#0F1A3A] mt-0.5">
                    {maskName(selectedPatient.patientName || `${selectedPatient.firstName || ''} ${selectedPatient.lastName || ''}`.trim() || 'Unknown Patient', userRole)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FileText className="text-[#8A97B0] shrink-0 mt-0.5" size={15} />
                <div>
                  <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Patient System ID</p>
                  <p className="text-sm font-mono text-[#4B5A7A] mt-0.5">{selectedPatient.patientId || selectedPatient.id}</p>
                </div>
              </div>

              {selectedPatient.dateOfBirth && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="text-[#8A97B0] shrink-0 mt-0.5" size={15} />
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Date of Birth</p>
                    <p className="text-sm text-[#4B5A7A] mt-0.5">{maskDob(selectedPatient.dateOfBirth, userRole)}</p>
                  </div>
                </div>
              )}

              {selectedPatient.phone && (
                <div className="flex items-start gap-2.5">
                  <Phone className="text-[#8A97B0] shrink-0 mt-0.5" size={15} />
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Contact Phone</p>
                    <p className="text-sm text-[#4B5A7A] mt-0.5">{maskPhone(selectedPatient.phone, userRole)}</p>
                  </div>
                </div>
              )}

              {selectedPatient.email && (
                <div className="flex items-start gap-2.5">
                  <Mail className="text-[#8A97B0] shrink-0 mt-0.5" size={15} />
                  <div>
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Email Address</p>
                    <p className="text-sm text-[#4B5A7A] mt-0.5 truncate max-w-[200px]">{selectedPatient.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Healthcare Plan Eligibility Form & Verification */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Active Coverage Info Card */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Plan Eligibility Status</h3>
                    <p className="text-xs text-[#8A97B0]">Real-time provincial database verification details</p>
                  </div>
                </div>
                {coverage && getStatusBadge(coverage.verificationStatus)}
              </div>

              {loadingCoverage ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin text-brand-blue" size={24} />
                </div>
              ) : !coverage ? (
                <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-brand-blue text-xs font-semibold">
                  <AlertTriangle className="shrink-0" size={16} /> Patient has no active insurance enrollment card details. Enlist a policy or register uninsured status below.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  
                  {/* Standard details */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Coverage Type</p>
                    <p className="text-sm font-bold text-[#0F1A3A] mt-1">{coverage.coverageType}</p>
                  </div>

                  {coverage.coverageType !== 'UNINSURED' && coverage.coverageType !== 'NIHB' && coverage.coverageType !== 'RECIPROCAL' && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Health Plan Card Number</p>
                      <p className="text-sm font-mono font-bold text-[#0F1A3A] mt-1">{coverage.nwtPlanNumber || 'N/A'}</p>
                    </div>
                  )}

                  {/* Reciprocal Billing specific display details */}
                  {coverage.coverageType === 'RECIPROCAL' && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Home Region Card ID</p>
                        <p className="text-sm font-mono font-bold text-[#0F1A3A] mt-1">{coverage.homeJurisdictionHealthCardNumber || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Reciprocal Billing Code (RMB)</p>
                        <p className="text-sm font-mono font-bold text-[#0F1A3A] mt-1">{coverage.reciprocalBillingCode || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Home Ministry Billing Contact</p>
                        <p className="text-xs font-bold text-slate-700 mt-1">{coverage.homeJurisdictionContactInfo || 'N/A'}</p>
                      </div>
                    </>
                  )}

                  {/* NIHB specific display details */}
                  {coverage.coverageType === 'NIHB' && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">NIHB Client Status Number</p>
                        <p className="text-sm font-mono font-bold text-[#0F1A3A] mt-1">{coverage.nihbClientId || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">NIHB Benefit Category</p>
                        <p className="text-sm font-bold text-[#0F1A3A] mt-1">{coverage.nihbBenefitCategory || 'N/A'}</p>
                      </div>
                      {coverage.bandAffiliation && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">First Nations Band Affiliation</p>
                          <p className="text-sm font-bold text-[#0F1A3A] mt-1">{coverage.bandAffiliation}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Shared details */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Active / Eligible Status</p>
                    <p className="text-sm font-bold mt-1">
                      {coverage.eligible ? (
                        <span className="text-emerald-600 flex items-center gap-1 text-xs font-black uppercase"><Check size={14} /> Active / Eligible</span>
                      ) : (
                        <span className="text-brand-red flex items-center gap-1 text-xs font-black uppercase"><XCircle size={14} /> Ineligible</span>
                      )}
                    </p>
                  </div>

                  {coverage.residencyStatus && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Residency Classification</p>
                      <p className="text-sm font-bold text-[#0F1A3A] mt-1">{coverage.residencyStatus}</p>
                    </div>
                  )}

                  {(coverage.effectiveFrom || coverage.effectiveTo) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Coverage Validity Duration</p>
                      <p className="text-xs font-bold text-[#4B5A7A] mt-1">
                        {coverage.effectiveFrom || 'N/A'} to {coverage.effectiveTo || 'N/A'}
                      </p>
                    </div>
                  )}

                  {/* Payer Linkage details */}
                  {coverage.payerId && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#8A97B0] uppercase leading-none">Payer Assignment & Claim Ref</p>
                      <p className="text-xs font-bold text-[#4B5A7A] mt-1">
                        {coverage.payerId} ({coverage.claimReferenceNumber || 'No Claim ID'}) | {coverage.estimatedCoveragePercentage ?? 100}% Covered
                      </p>
                    </div>
                  )}

                  {/* Verification Notes */}
                  {coverage.verificationNotes && coverage.verificationStatus === 'FAILED' && (
                    <div className="md:col-span-2 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-brand-red text-xs font-semibold">
                      <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                      <div>
                        <p className="font-bold">Registry Verification Warning</p>
                        <p className="text-slate-500 font-medium mt-0.5">{coverage.verificationNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Audit footer */}
                  <div className="md:col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-[#8A97B0] font-semibold">
                    <div className="space-y-0.5">
                      <p>
                        Last Verified: {coverage.lastVerifiedAt ? new Date(coverage.lastVerifiedAt).toLocaleString() : 'Never'}
                        {coverage.lastVerifiedAt && coverage.lastVerifiedBy && ` by ${coverage.lastVerifiedBy}`}
                      </p>
                      {coverage.eligibilityCheckMethod && (
                        <p className="text-[10px] text-[#A0AECB]">Method: {coverage.eligibilityCheckMethod} | Result: {coverage.eligibilityCheckResult || 'N/A'}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyCoverage}
                        disabled={isVerifying || coverage.coverageType === 'UNINSURED'}
                        className="btn-primary text-[10px] px-3.5 py-1.5 flex items-center gap-1 disabled:opacity-50"
                      >
                        {isVerifying ? <RefreshCw className="animate-spin" size={10} /> : <Check size={10} />}
                        {isVerifying ? 'Verifying…' : 'Query Registry'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteCoverage}
                        disabled={isDeleting}
                        className="bg-red-50 hover:bg-brand-red text-brand-red hover:text-white border border-red-100 hover:border-brand-red text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                      >
                        {isDeleting ? <RefreshCw className="animate-spin" size={10} /> : <Trash2 size={10} />}
                        {isDeleting ? 'Deleting…' : 'Delete Card'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Coverage Enrollment Form */}
            <div className="card p-6 space-y-5">
              <div className="border-b border-[#F0F4FC] pb-4 flex items-center gap-2">
                <CreditCard className="text-brand-blue" size={18} />
                <div>
                  <h3 className="font-black text-[#0F1A3A] text-sm uppercase tracking-wider">Plan Coverage Enrollment Form</h3>
                  <p className="text-xs text-[#8A97B0]">Set provincial card details or register self-pay status</p>
                </div>
              </div>

              <form onSubmit={handleSaveCoverage} className="space-y-5">
                
                {/* Coverage Plan Type Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Coverage Plan Type</label>
                  <select
                    value={coverageType}
                    onChange={e => {
                      setCoverageType(e.target.value);
                      if (e.target.value === 'UNINSURED') {
                        setEligible(false);
                      } else {
                        setEligible(true);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="NWT_HEALTH_CARE_PLAN">NWT Health Care Plan</option>
                    <option value="RECIPROCAL">Visitor Reciprocal Billing (Nunavut / Others)</option>
                    <option value="NIHB">Non-Insured Health Benefits (NIHB Federal Indigenous)</option>
                    <option value="MSP_BRITISH_COLUMBIA">BC Health Services (MSP)</option>
                    <option value="OHIP_ONTARIO">Ontario Health Plan (OHIP)</option>
                    <option value="AHCIP_ALBERTA">Alberta Health Plan (AHCIP)</option>
                    <option value="RAMQ_QUEBEC">Quebec Health (RAMQ)</option>
                    <option value="PRIVATE_INSURANCE">Private Commercial Insurance</option>
                    <option value="UNINSURED">Direct Self-Pay / Uninsured Status</option>
                  </select>
                </div>

                {/* Self Pay / Uninsured View */}
                {coverageType === 'UNINSURED' ? (
                  <div className="flex items-start gap-3 p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 animate-fadeIn">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-sm font-bold">Direct Self-Pay Classification</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Card number validations and registry checks are bypassed. The patient will be billed directly under Self-Pay.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Category 1: Reciprocal Billing Forms ( Nunavut RMBA Billing ) */}
                    {coverageType === 'RECIPROCAL' && (
                      <div className="p-4 bg-slate-50 border border-[#F0F4FC] rounded-xl space-y-4">
                        <p className="text-xs font-bold text-brand-blue uppercase tracking-wider flex items-center gap-1">
                          <FileCheck size={14} /> Reciprocal Billing Details (Nunavut / Cross-Jurisdiction)
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Home Jurisdiction Card Number</label>
                            <input
                              type="text"
                              value={homeJurisdictionHealthCardNumber}
                              onChange={e => setHomeJurisdictionHealthCardNumber(e.target.value)}
                              placeholder="e.g. NU-987453-2"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Reciprocal Billing Code (RMB)</label>
                            <input
                              type="text"
                              value={reciprocalBillingCode}
                              onChange={e => setReciprocalBillingCode(e.target.value)}
                              placeholder="e.g. NU-RMB-01"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Home Jurisdiction Billing Office Contact Info</label>
                            <input
                              type="text"
                              value={homeJurisdictionContactInfo}
                              onChange={e => setHomeJurisdictionContactInfo(e.target.value)}
                              placeholder="e.g. Nunavut Health Board, billing@gov.nu.ca, Ph: 867-555-0199"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Category 2: Federal NIHB (Indigenous Non-Insured Health Benefits) */}
                    {coverageType === 'NIHB' && (
                      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-4">
                        <p className="text-xs font-bold text-[#1E3A8A] uppercase tracking-wider flex items-center gap-1">
                          <ShieldCheck size={14} /> NIHB Federal indigenous Coverage Details
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Status / Client ID Number</label>
                            <input
                              type="text"
                              value={nihbClientId}
                              onChange={e => setNihbClientId(e.target.value)}
                              placeholder="e.g. 104539827"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">NIHB Benefit Category</label>
                            <select
                              value={nihbBenefitCategory}
                              onChange={e => setNihbBenefitCategory(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            >
                              <option value="MEDICAL_TRANSPORTATION">Medical Transportation Support</option>
                              <option value="PHARMACY">Pharmacy / Medicines</option>
                              <option value="DENTAL">Dental Services</option>
                              <option value="VISION">Vision Care</option>
                              <option value="MEDICAL_EQUIPMENT">Medical Equipment & Supplies</option>
                            </select>
                          </div>
                          <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">First Nations Band Affiliation (Optional & Sensitive)</label>
                            <input
                              type="text"
                              value={bandAffiliation}
                              onChange={e => setBandAffiliation(e.target.value)}
                              placeholder="e.g. Yellowknives Dene First Nation (Band #346)"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Standard Provincial / NWT Cards details */}
                    {coverageType !== 'NIHB' && coverageType !== 'RECIPROCAL' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Health Card Number</label>
                          <input
                            type="text"
                            value={nwtPlanNumber}
                            onChange={e => setNwtPlanNumber(e.target.value)}
                            placeholder="e.g. 123456789"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Version Code</label>
                          <input
                            type="text"
                            value={versionCode}
                            onChange={e => setVersionCode(e.target.value)}
                            placeholder="e.g. AB (Ontario)"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Card Expiry Date</label>
                          <input
                            type="date"
                            value={cardExpiryDate}
                            onChange={e => setCardExpiryDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                      </div>
                    )}

                    {/* Shared Section A: Residency & Timelines */}
                    <div className="p-4 bg-slate-50 border border-[#F0F4FC] rounded-xl space-y-4">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Building size={14} /> Residency Details & Validity Timeline
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Residency Status</label>
                          <select
                            value={residencyStatus}
                            onChange={e => setResidencyStatus(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          >
                            <option value="PERMANENT_RESIDENT">Permanent Resident</option>
                            <option value="TEMPORARY">Temporary Resident</option>
                            <option value="NEW_RESIDENT">New Resident (Waiting Period)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Effective From</label>
                          <input
                            type="date"
                            value={effectiveFrom}
                            onChange={e => setEffectiveFrom(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Effective To / Expiry</label>
                          <input
                            type="date"
                            value={effectiveTo}
                            onChange={e => setEffectiveTo(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Shared Section B: Billing/Payment Linkages */}
                    <div className="p-4 bg-slate-50 border border-[#F0F4FC] rounded-xl space-y-4">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <Coins size={14} /> Billing, Payers, & Claims Linkage
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Payer Assignment ID</label>
                          <select
                            value={payerId}
                            onChange={e => setPayerId(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          >
                            <option value="NWT_GOVT">NWT Ministry of Health (HSS)</option>
                            <option value="NIHB_FEDERAL">Federal indigenous Services (NIHB)</option>
                            <option value="RECIPROCAL_RMB">Reciprocal Billing Board</option>
                            <option value="PRIVATE_INSURER">Private Underwriter</option>
                            <option value="PATIENT_SELF_PAY">Patient Self-Pay</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Claim Reference Number</label>
                          <input
                            type="text"
                            value={claimReferenceNumber}
                            onChange={e => setClaimReferenceNumber(e.target.value)}
                            placeholder="e.g. CLAIM-8734A"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Estimated Coverage (%)</label>
                          <input
                            type="number"
                            value={estimatedCoveragePercentage}
                            onChange={e => setEstimatedCoveragePercentage(e.target.value)}
                            placeholder="100"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Program Plan Code & Toggle */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[#4B5A7A] uppercase tracking-wider">Sub-Plan Program Code</label>
                        <input
                          type="text"
                          value={planCode}
                          onChange={e => setPlanCode(e.target.value)}
                          placeholder="e.g. NIHB-PHARMACY-COPAY"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                        />
                      </div>
                      
                      {/* Plan Eligibility Check Toggle */}
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2.5">
                        <div>
                          <p className="text-xs font-bold text-[#0F1A3A]">Plan Active Status</p>
                          <p className="text-[10px] text-[#8A97B0]">Set registration eligibility as active</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEligible(!eligible)}
                          className={`w-9 h-5 rounded-full relative transition-all ${eligible ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${eligible ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Form Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t border-[#F0F4FC]">
                  <button type="button" onClick={handleResetForm} className="btn-secondary text-xs px-4 py-2.5">
                    Clear Form
                  </button>
                  <button type="submit" disabled={isSaving} className="btn-primary text-xs px-5 py-2.5 flex items-center gap-1.5">
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    {isSaving ? 'Saving…' : 'Save Registration'}
                  </button>
                </div>

              </form>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

export default HealthcareRegistration;
