import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import client from '../../api/client';
import { createShare, selectShareLoading, selectShareError, clearLatestCreatedShare } from '../../store/slices/shareSlice';
import { searchSpecialists } from '../../store/slices/userSlice';
import { Share2, Lock, Globe, Copy, Check, X, ShieldAlert, Clock, UserCheck, CheckCircle2, User, ChevronDown, Loader2, Search as SearchIcon } from 'lucide-react';

const SPECIALTIES = [
  'CARDIOLOGY', 'RADIOLOGY', 'NEUROLOGY', 'TRAUMA_EMERGENCY', 
  'ORTHOPEDICS', 'PEDIATRICS', 'INTENSIVE_CARE', 'PULMONOLOGY', 'GENERAL_SURGERY'
];

export const RecordShareModal = ({ isOpen, onClose, recordId, patientId, defaultClinicalQuestion = '' }) => {
  const dispatch = useDispatch();
  const loading = useSelector(selectShareLoading);
  const error = useSelector(selectShareError);

  const [shareType, setShareType] = useState('INTERNAL');
  
  // Internal share form & backend search
  const [specialistUserId, setSpecialistUserId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedUserObj, setSelectedUserObj] = useState(null);
  const dropdownRef = useRef(null);

  // Dynamic specialties state from backend GET /api/users/specialties
  const DEFAULT_SPECIALTIES = [
    'CARDIOLOGY', 'RADIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'OBSTETRIC_GYNECOLOGY',
    'SURGICAL_CARE', 'OPHTHALMOLOGY', 'DENTAL_CARE', 'LONG_TERM_CARE', 'MENTAL_HEALTH',
    'CHILD_FAMILY_SERVICES', 'REHABILITATION_SERVICES', 'TRAUMA_EMERGENCY', 'ORTHOPEDICS',
    'PEDIATRICS', 'INTENSIVE_CARE', 'PULMONOLOGY', 'GENERAL_SURGERY'
  ];

  const [specialtiesList, setSpecialtiesList] = useState(DEFAULT_SPECIALTIES);
  const [specialtyRequested, setSpecialtyRequested] = useState('CARDIOLOGY');

  // Fetch specialties from backend API on mount
  useEffect(() => {
    if (isOpen) {
      client.get('/api/users/specialties', { hideToast: true })
        .then((res) => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            setSpecialtiesList(res.data);
            if (!specialtyRequested) setSpecialtyRequested(res.data[0]);
          }
        })
        .catch((err) => {
          console.warn('Backend specialties endpoint unavailable, using default specialties:', err);
          setSpecialtiesList(DEFAULT_SPECIALTIES);
        });
    }
  }, [isOpen]);
  
  // External share form
  const [specialistEmail, setSpecialistEmail] = useState('');
  const [specialistName, setSpecialistName] = useState('');
  const [organizationsList, setOrganizationsList] = useState([]);
  const [selectedOrgOption, setSelectedOrgOption] = useState('');
  const [customOrgName, setCustomOrgName] = useState('');
  const [expiryHours, setExpiryHours] = useState(72);

  // Fetch active registered organizations on mount
  useEffect(() => {
    if (isOpen) {
      client.get('/api/organizations/active', { hideToast: true })
        .then((res) => {
          const list = res.data?.content || res.data || [];
          if (Array.isArray(list)) {
            setOrganizationsList(list);
          }
        })
        .catch((err) => {
          console.warn('Backend active organizations endpoint unavailable:', err);
        });
    }
  }, [isOpen]);

  // Common options
  const [includeFullEpcr, setIncludeFullEpcr] = useState(true);
  const [includeVitalsHistory, setIncludeVitalsHistory] = useState(true);
  const [clinicalQuestion, setClinicalQuestion] = useState(defaultClinicalQuestion);

  // Result state after creation
  const [createdShare, setCreatedShare] = useState(null);
  const [copied, setCopied] = useState(false);

  // Initial load of specialists from backend endpoint GET /api/users/specialists
  useEffect(() => {
    if (isOpen && shareType === 'INTERNAL') {
      setSearching(true);
      dispatch(searchSpecialists(''))
        .unwrap()
        .then((res) => setSearchResults(res || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }
  }, [isOpen, shareType, dispatch]);

  // Debounced search query to GET /api/users/specialists?query=...
  useEffect(() => {
    if (!isOpen || shareType !== 'INTERNAL') return;

    const timer = setTimeout(() => {
      setSearching(true);
      dispatch(searchSpecialists(userSearchTerm))
        .unwrap()
        .then((res) => setSearchResults(res || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchTerm, isOpen, shareType, dispatch]);

  // Click outside listener for user dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSelectUser = (user) => {
    const uId = user.id || user.userId || user.email;
    setSpecialistUserId(uId);
    setSelectedUserObj(user);
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || uId;
    setUserSearchTerm(fullName);
    setIsDropdownOpen(false);

    // Auto-select doctor/specialist specialty if assigned to their profile
    const rawSpecialty = user.specialty || user.department || user.specialization;
    if (rawSpecialty) {
      const normalizedSpecialty = rawSpecialty.toUpperCase().trim().replace(/\s+/g, '_');
      
      // Ensure the specialty exists in the list so the <select> option is selected
      setSpecialtiesList((prevList) => {
        if (prevList && !prevList.includes(normalizedSpecialty)) {
          return [...prevList, normalizedSpecialty];
        }
        return prevList || [normalizedSpecialty];
      });
      
      setSpecialtyRequested(normalizedSpecialty);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreatedShare(null);

    const shareData = {
      shareType,
      specialtyRequested,
      includeFullEpcr,
      includeVitalsHistory,
      clinicalQuestion: clinicalQuestion.trim() || undefined,
    };

    if (shareType === 'INTERNAL') {
      if (!specialistUserId.trim()) {
        alert('Please select or specify a specialist User ID or Email');
        return;
      }
      shareData.specialistUserId = specialistUserId.trim();
      const matchedDoc = selectedUserObj || (Array.isArray(searchResults) ? searchResults.find(u => (u.id === specialistUserId || u.userId === specialistUserId)) : null);
      if (matchedDoc) {
        shareData.specialistName = matchedDoc.firstName ? `${matchedDoc.firstName} ${matchedDoc.lastName || ''}`.trim() : (matchedDoc.name || matchedDoc.email);
      }
    } else {
      if (!specialistEmail.trim()) {
        alert('Specialist Email is required for external shares');
        return;
      }
      shareData.specialistEmail = specialistEmail.trim();
      shareData.specialistName = specialistName.trim() || undefined;
      
      let resolvedOrgName = undefined;
      if (selectedOrgOption === 'CUSTOM') {
        resolvedOrgName = customOrgName.trim() || undefined;
      } else if (selectedOrgOption) {
        resolvedOrgName = selectedOrgOption;
      }
      shareData.specialistOrganizationName = resolvedOrgName;
      shareData.expiryHours = parseInt(expiryHours, 10);
    }

    try {
      const res = await dispatch(createShare({ recordId, shareData })).unwrap();
      setCreatedShare(res);
    } catch (err) {
      console.error('Share creation failed:', err);
    }
  };

  const getBaseShareUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'https://ihp.ind.in/epcr';
    }
    const origin = window.location.origin;
    return origin.endsWith('/epcr') ? origin : `${origin}/epcr`;
  };

  const handleCopyLink = (token) => {
    const rawLink = `${getBaseShareUrl()}/shared/${createdShare.id}?token=${token || 'VALID_TOKEN'}`;
    navigator.clipboard.writeText(rawLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    dispatch(clearLatestCreatedShare());
    setCreatedShare(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-[#0F1A3A] border border-[#E2E8F0] rounded-2xl shadow-2xl max-w-xl w-full p-6 relative animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#EEF2FF] border border-[#C8D5F0] rounded-xl flex items-center justify-center text-brand-blue">
              <Share2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0F1A3A] tracking-tight">Share Medical Record</h2>
              <p className="text-xs text-[#8A97B0]">Record ID: <span className="font-mono text-brand-blue font-bold">{recordId}</span></p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="text-[#8A97B0] hover:text-[#0F1A3A] p-1.5 rounded-xl hover:bg-[#F8FAFC] transition"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <ShieldAlert size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Success View */}
        {createdShare ? (
          <div className="space-y-4 py-2">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-700">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="font-black text-emerald-800 text-base">Record Successfully Shared!</h3>
              <p className="text-xs text-emerald-700">
                Share status is currently <span className="font-bold uppercase">{createdShare.status}</span>.
              </p>
            </div>

            {createdShare.shareType === 'EXTERNAL' && (
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                <label className="text-xs font-bold text-[#0F1A3A] block">External Specialist Access Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${getBaseShareUrl()}/shared/${createdShare.id}`}
                    className="w-full text-xs bg-white border border-[#E2E8F0] rounded-lg p-2.5 text-[#0F1A3A] font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopyLink('')}
                    className="px-4 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-sm"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1 mt-1">
                  <Clock size={13} />
                  <span>Access link will expire at: {new Date(createdShare.expiresAt).toLocaleString()}</span>
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-brand-blue text-white text-xs font-bold rounded-xl hover:bg-brand-blue/90 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Share Type Selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShareType('INTERNAL')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  shareType === 'INTERNAL'
                    ? 'bg-[#EEF2FF] border-brand-blue text-brand-blue shadow-sm'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                <Lock size={15} />
                <span>Internal Specialist</span>
              </button>

              <button
                type="button"
                onClick={() => setShareType('EXTERNAL')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition ${
                  shareType === 'EXTERNAL'
                    ? 'bg-[#EEF2FF] border-brand-blue text-brand-blue shadow-sm'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                <Globe size={15} />
                <span>External Link (Token)</span>
              </button>
            </div>

            {/* Internal Recipient Inputs (Backend Search Endpoint GET /api/users/specialists) */}
            {shareType === 'INTERNAL' && (
              <div className="space-y-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl relative" ref={dropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#0F1A3A] block">
                    Select Specialist / Doctor *
                  </label>
                </div>
                
                <div className="relative">
                  <SearchIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                  <input
                    type="text"
                    required
                    placeholder="Type name, email, or specialty to search..."
                    value={userSearchTerm}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setUserSearchTerm(e.target.value);
                      setSpecialistUserId(e.target.value);
                      setSelectedUserObj(null);
                      setIsDropdownOpen(true);
                    }}
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-9 py-2.5 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none font-medium"
                  />
                  {searching ? (
                    <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-blue animate-spin" />
                  ) : (
                    <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB] pointer-events-none" />
                  )}
                </div>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-[#F0F4FC]">
                    {searching ? (
                      <div className="p-3 text-xs text-[#8A97B0] text-center flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-brand-blue" />
                        <span>Searching backend database...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-xs text-[#8A97B0] text-center">
                        No specialists found for "{userSearchTerm}".
                      </div>
                    ) : (
                      searchResults.map((u) => {
                        const uId = u.id || u.userId || u.email;
                        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || uId;
                        return (
                          <div
                            key={uId}
                            onClick={() => handleSelectUser(u)}
                            className="p-3 hover:bg-[#EEF2FF] cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 bg-[#EEF2FF] text-brand-blue rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                                <User size={13} />
                              </div>
                              <div>
                                <p className="font-bold text-[#0F1A3A]">{fullName}</p>
                                <p className="text-[11px] text-[#8A97B0] font-mono">{u.email || uId}</p>
                              </div>
                            </div>

                            {u.role && (
                              <span className="px-2 py-0.5 bg-[#F0F4FC] text-[#4B5A7A] rounded text-[10px] font-bold uppercase shrink-0">
                                {u.role.replace('ROLE_', '')}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected User Indicator */}
                {selectedUserObj && (
                  <div className="flex items-center justify-between p-2.5 bg-[#EEF2FF] border border-[#C8D5F0] rounded-xl text-xs text-brand-blue font-semibold">
                    <div className="flex items-center gap-2">
                      <UserCheck size={14} className="shrink-0" />
                      <span>Selected: {selectedUserObj.firstName} {selectedUserObj.lastName} ({selectedUserObj.email})</span>
                    </div>
                    {selectedUserObj.specialty && (
                      <span className="px-2 py-0.5 bg-brand-blue text-white rounded text-[10px] font-bold tracking-wide uppercase shrink-0">
                        {selectedUserObj.specialty.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* External Recipient Inputs */}
            {shareType === 'EXTERNAL' && (
              <div className="space-y-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#0F1A3A] block mb-1">Specialist Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="specialist@hospital.org"
                      value={specialistEmail}
                      onChange={(e) => setSpecialistEmail(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#0F1A3A] block mb-1">Specialist Full Name</label>
                    <input
                      type="text"
                      placeholder="Dr. Sarah Jenkins"
                      value={specialistName}
                      onChange={(e) => setSpecialistName(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-[#0F1A3A] block">Organization / Hospital</label>
                      <span className="text-[10px] font-semibold text-[#8A97B0] bg-[#EEF2FF] px-1.5 py-0.5 rounded">Optional</span>
                    </div>
                    <select
                      value={selectedOrgOption}
                      onChange={(e) => setSelectedOrgOption(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] focus:border-brand-blue focus:outline-none font-medium mb-2"
                    >
                      <option value="">-- Select Registered Facility --</option>
                      {organizationsList.map((org) => (
                        <option key={org.id || org.code} value={org.name}>
                          {org.name} {org.code ? `(${org.code})` : ''}
                        </option>
                      ))}
                      <option value="CUSTOM">+ Enter Custom Organization...</option>
                    </select>

                    {selectedOrgOption === 'CUSTOM' && (
                      <input
                        type="text"
                        placeholder="e.g. Metro General Hospital"
                        value={customOrgName}
                        onChange={(e) => setCustomOrgName(e.target.value)}
                        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none animate-fade-in"
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#0F1A3A] block mb-1">Link Expiry Duration</label>
                    <select
                      value={expiryHours}
                      onChange={(e) => setExpiryHours(e.target.value)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] focus:border-brand-blue focus:outline-none font-medium"
                    >
                      <option value="24">24 Hours (1 Day)</option>
                      <option value="48">48 Hours (2 Days)</option>
                      <option value="72">72 Hours (3 Days - Default)</option>
                      <option value="168">168 Hours (7 Days)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Specialty Selection */}
            <div>
              <label className="text-xs font-bold text-[#0F1A3A] block mb-1">Requested Specialty Opinion *</label>
              <select
                value={specialtyRequested}
                onChange={(e) => setSpecialtyRequested(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] focus:border-brand-blue focus:outline-none font-semibold"
              >
                {(specialtiesList.length > 0 ? specialtiesList : [
                  'CARDIOLOGY', 'RADIOLOGY', 'NEUROLOGY', 'TRAUMA_EMERGENCY', 
                  'ORTHOPEDICS', 'PEDIATRICS', 'INTENSIVE_CARE', 'PULMONOLOGY', 'GENERAL_SURGERY'
                ]).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Scope Checkboxes */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
              <span className="text-xs font-bold text-[#0F1A3A] block">Scope of Documentation Access</span>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#4B5A7A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFullEpcr}
                    onChange={(e) => setIncludeFullEpcr(e.target.checked)}
                    className="rounded border-[#E2E8F0] text-brand-blue focus:ring-0"
                  />
                  <span>Include Full ePCR Record</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#4B5A7A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeVitalsHistory}
                    onChange={(e) => setIncludeVitalsHistory(e.target.checked)}
                    className="rounded border-[#E2E8F0] text-brand-blue focus:ring-0"
                  />
                  <span>Include Vitals History</span>
                </label>
              </div>
            </div>

            {/* Clinical Question */}
            <div>
              <label className="text-xs font-bold text-[#0F1A3A] block mb-1">Clinical Question / Referral Note (PHI Encrypted)</label>
              <textarea
                rows="3"
                placeholder="Describe the clinical question, relevant findings, or specific opinion requested..."
                value={clinicalQuestion}
                onChange={(e) => setClinicalQuestion(e.target.value)}
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F0F4FC]">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#4B5A7A] text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50 shadow-md active:scale-95"
              >
                {loading ? (
                  <span>Sharing...</span>
                ) : (
                  <>
                    <Share2 size={15} />
                    <span>Confirm & Share</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

export default RecordShareModal;
