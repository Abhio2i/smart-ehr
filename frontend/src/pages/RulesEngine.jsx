import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Search, RefreshCw, X, Play, Sparkles, Mail, CheckCircle2, 
  User, Sliders, Users, AlertCircle, Heart, Clock, ChevronRight, Send
} from 'lucide-react';
import { 
  fetchRules, createRule, runRules, runRulesForPatient, clearRunResults, fetchFields
} from '../store/slices/rulesEngineSlice';
import { fetchOrganizations } from '../store/slices/orgSlice';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import client from '../api/client';

const CLINICAL_FIELDS = [
  { value: 'spo2', label: 'Oxygen Level (SpO2)', defaultVal: '90', unit: '%' },
  { value: 'age', label: 'Patient Age', defaultVal: '65', unit: ' years' },
  { value: 'systolicBp', label: 'Systolic Blood Pressure', defaultVal: '140', unit: ' mmHg' },
  { value: 'diastolicBp', label: 'Diastolic Blood Pressure', defaultVal: '90', unit: ' mmHg' },
  { value: 'bloodSugar', label: 'Blood Sugar', defaultVal: '140', unit: ' mg/dL' },
  { value: 'heartRate', label: 'Heart Rate', defaultVal: '100', unit: ' bpm' },
  { value: 'pulseRate', label: 'Pulse Rate', defaultVal: '80', unit: ' bpm' },
  { value: 'respirationRate', label: 'Respiration Rate', defaultVal: '16', unit: ' breaths/min' },
  { value: 'temperature', label: 'Body Temperature', defaultVal: '99.5', unit: ' °F' },
  { value: 'hemoglobin', label: 'Hemoglobin Level', defaultVal: '12', unit: ' g/dL' },
  { value: 'weight', label: 'Weight', defaultVal: '70', unit: ' kg' },
  { value: 'height', label: 'Height', defaultVal: '170', unit: ' cm' },
  { value: 'location', label: 'Incident Location', defaultVal: 'Downtown Clinic', unit: '', type: 'string' },
];

const OPERATORS = [
  { value: 'EQ', symbol: '=', label: 'Equal To' },
  { value: 'NEQ', symbol: '≠', label: 'Not Equal To' },
  { value: 'LT', symbol: '<', label: 'Less Than' },
  { value: 'GT', symbol: '>', label: 'Greater Than' },
  { value: 'LTE', symbol: '≤', label: 'Less Than or Equal' },
  { value: 'GTE', symbol: '≥', label: 'Greater Than or Equal' },
  { value: 'BETWEEN', symbol: '↔', label: 'Between (Range)' },
];

const getOperatorDetails = (opValue) => {
  const normalized = opValue === '=' || opValue === '==' ? 'EQ' : (opValue === '!=' ? 'NEQ' : opValue);
  return OPERATORS.find(op => op.value === normalized) || { value: opValue, symbol: opValue, label: opValue };
};

const getFilteredOperators = (fieldObj) => {
  if (fieldObj?.type === 'string') {
    return OPERATORS.filter(op => op.value === 'EQ' || op.value === 'NEQ');
  }
  return OPERATORS;
};

const formatCamelCase = (str) => {
  if (!str) return '';
  if (str.startsWith('clinicalData.')) {
    const key = str.substring('clinicalData.'.length);
    return `Clinical Data: ${formatCamelCase(key)}`;
  }
  if (str.startsWith('dynamicFormResponses.')) {
    const key = str.substring('dynamicFormResponses.'.length);
    return `Form: ${formatCamelCase(key)}`;
  }
  const spaced = str.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).trim();
};

const DEFAULT_CONDITION = { field: 'spo2', operator: 'LT', threshold: '90', thresholdMax: '94', isCustom: false };

const RulesEngine = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { rules, loading, saving, running, runResults, fields } = useSelector(state => state.rulesEngine);
  const { organizations } = useSelector(state => state.org);

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const currentOrgId = user?.role === 'ADMIN' ? (selectedOrgId || user?.organizationId) : user?.organizationId;

  // Simplified Form State
  const [recipientType, setRecipientType] = useState('condition'); // 'condition' or 'patient'
  
  // Multi-condition Form State
  const [conditions, setConditions] = useState([{ ...DEFAULT_CONDITION }]);
  const [campaignName, setCampaignName] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (runResults?.matches) {
        const patientIds = Array.from(new Set(runResults.matches.map(m => m.patientId).filter(Boolean)));
        setSelectedPatientIds(patientIds);
      } else {
        setSelectedPatientIds([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [runResults]);

  const availableFields = useMemo(() => {
    // Use fields from backend if loaded, otherwise fallback to local defaults
    const rawValues = (fields && fields.length > 0)
      ? fields
      : CLINICAL_FIELDS.map(f => f.value);

    return rawValues.map(val => {
      const known = CLINICAL_FIELDS.find(f => f.value === val);
      if (known) return known;

      // Dynamic fallback for any new backend fields not explicitly defined in CLINICAL_FIELDS
      return {
        value: val,
        label: formatCamelCase(val),
        defaultVal: '',
        unit: '',
        type: 'string', // Assume string/text by default
      };
    }).filter(Boolean);
  }, [fields]);

  const getFieldDetails = (field) => {
    return availableFields.find(f => f.value === field) || {
      value: field,
      label: formatCamelCase(field),
      defaultVal: '0',
      unit: ''
    };
  };

  const addCondition = () => {
    if (conditions.length >= 5) return;
    setConditions(prev => [...prev, { field: 'age', operator: 'GT', threshold: '40', thresholdMax: '', isCustom: false }]);
  };

  const removeCondition = (idx) => {
    if (conditions.length === 1) return;
    setConditions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCondition = (idx, key, val) => {
    setConditions(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [key]: val };
      if (key === 'field') {
        const fieldObj = getFieldDetails(val);
        updated.threshold = fieldObj.defaultVal;
        updated.thresholdMax = '';
        if (fieldObj.type === 'string') {
          updated.operator = 'EQ';
        } else if (c.operator === 'EQ' || c.operator === 'NEQ') {
          updated.operator = 'GT';
        }
      }
      if (key === 'operator' && val !== 'BETWEEN') {
        updated.thresholdMax = '';
      }
      return updated;
    }));
  };


  // Single Patient Form State
  const [patientId, setPatientId] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Dynamic Email Composer State
  const [emailSubject, setEmailSubject] = useState('Medical Recommendation: Recommended Comprehensive Full Body Checkup');
  const [emailBody, setEmailBody] = useState(
    'Dear {patientName},\n\nBased on your recent vital records, our clinical team has detected that your {vitalsField} is {conditionOperator} {thresholdValue}.\n\nTo ensure your optimal health and safety, we strongly recommend scheduling a Comprehensive Full Body Checkup at your earliest convenience.\n\nPlease reply directly to this email or call Smart-eHR Care Services to coordinate your appointment.\n\nBest regards,\nSmart-eHR Care Team'
  );
  const [isDryRun, setIsDryRun] = useState(false); // default to false for real-life action
  const [logSearchQuery, setLogSearchQuery] = useState(''); // filter matched logs in real-time
  const [previewTab, setPreviewTab] = useState('edit'); // 'edit' or 'preview'
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    isLive: false,
    onConfirm: null,
  }); // custom premium dialog modal

  useEffect(() => {
    dispatch(fetchFields());
    if (user?.role === 'ADMIN') {
      dispatch(fetchOrganizations());
    }
    if (currentOrgId) {
      dispatch(fetchRules(currentOrgId));
    }
  }, [currentOrgId, user?.role, dispatch]);

  // Handle clinical field changes to pre-populate smart thresholds (legacy single-field handler kept for preview)
  const handleFieldChange = (val) => {
    updateCondition(0, 'field', val);
  };

  const handlePatientSearch = async () => {
    if (!phoneSearch.trim()) return;
    setSearchingPatients(true);
    setSearchResults([]);
    try {
      const response = await client.get(`/api/admin/patients/search?phone=${phoneSearch.trim()}&limit=5`);
      setSearchResults(response.data || []);
    } catch {
      dispatch(addToast({ type: 'error', message: 'Failed to look up patients' }));
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setPatientId(patient.patientId);
    setSearchResults([]);
    setPhoneSearch('');
    dispatch(addToast({ type: 'success', message: `Selected Patient: ${patient.patientName}` }));
  };

  const handleDeselectPatient = () => {
    setSelectedPatient(null);
    setPatientId('');
  };

  // Launch outreach campaign (for vital conditions)
  const handleDeployCampaign = (e) => {
    e.preventDefault();

    const firstCond = conditions[0];
    const firstFieldObj = getFieldDetails(firstCond?.field);
    const firstOpObj = getOperatorDetails(firstCond?.operator);
    const condSummary = conditions.length === 1
      ? `${firstFieldObj?.label} ${firstOpObj?.symbol} ${firstCond?.threshold}`
      : `${conditions.length}-condition rule`;
    const generatedName = campaignName.trim() || `${condSummary} Checkup Campaign`;

    const isLive = !isDryRun;

    setConfirmDialog({
      isOpen: true,
      isLive: isLive,
      title: isLive ? 'Confirm Live Campaign Dispatch' : 'Confirm Simulation Launch',
      message: isLive 
        ? `Are you sure you want to launch the outreach campaign "${generatedName}"? This will immediately send LIVE Full Body Checkup emails to ALL matching patients in your organization group.`
        : `Are you sure you want to initiate a simulation scan for the campaign "${generatedName}"? No live emails will be sent.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        // Build conditions payload — support BETWEEN as two conditions
        const conditionsPayload = conditions.map(c => {
          if (c.operator === 'BETWEEN' && c.thresholdMax) {
            return [
              { field: c.field, operator: 'GTE', threshold: c.threshold },
              { field: c.field, operator: 'LTE', threshold: c.thresholdMax },
            ];
          }
          return [{ field: c.field, operator: c.operator, threshold: c.threshold }];
        }).flat();

        const payload = {
          name: generatedName,
          conditions: conditionsPayload,
          // Keep legacy fields for backward compatibility
          field: firstCond?.field,
          operator: firstCond?.operator,
          threshold: firstCond?.threshold,
          action: {
            type: 'EMAIL',
            to: 'patient',
            subject: emailSubject,
            body: emailBody,
            severity: 'HIGH',
            recipientRoles: ['PHYSICIAN', 'ADMIN'],
          },
          active: true,
          organizationId: currentOrgId,
        };

        try {
          const ruleRes = await dispatch(createRule(payload)).unwrap();
          dispatch(addToast({ type: 'success', message: 'Outreach Campaign created & deployed!' }));
          
          await dispatch(runRules({ 
            organizationId: currentOrgId, 
            dryRun: isDryRun,
            ruleIds: ruleRes?.id ? [ruleRes.id] : undefined
          })).unwrap();
          dispatch(addToast({ type: 'success', message: 'Outreach scan and emails dispatched!' }));
          
          setCampaignName('');
          setConditions([{ ...DEFAULT_CONDITION }]);
        } catch (err) {
          dispatch(addToast({ type: 'error', message: err || 'Failed to deploy outreach' }));
        }
      }
    });
  };

  const handleSendToSelected = () => {
    if (selectedPatientIds.length === 0) {
      dispatch(addToast({ type: 'error', message: 'Please select at least one patient' }));
      return;
    }

    const uniqueRuleIds = Array.from(new Set(runResults.matches.map(m => m.ruleId).filter(Boolean)));

    setConfirmDialog({
      isOpen: true,
      isLive: true,
      title: 'Confirm Live Send to Selected Patients',
      message: `Are you sure you want to send LIVE outreach emails to the ${selectedPatientIds.length} selected patients? This will dispatch the emails immediately.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await dispatch(runRules({
            organizationId: currentOrgId,
            dryRun: false,
            ruleIds: uniqueRuleIds,
            patientIds: selectedPatientIds
          })).unwrap();
          dispatch(addToast({ type: 'success', message: 'Emails successfully sent to selected patients!' }));
        } catch (err) {
          dispatch(addToast({ type: 'error', message: err || 'Failed to dispatch emails' }));
        }
      }
    });
  };

  // Direct patient checkup dispatch
  const handleDirectPatientOutreach = () => {
    if (!patientId) {
      dispatch(addToast({ type: 'error', message: 'Please search and select a patient first' }));
      return;
    }

    const isLive = !isDryRun;
    const patientName = selectedPatient?.patientName || patientId;

    setConfirmDialog({
      isOpen: true,
      isLive: isLive,
      title: isLive ? 'Confirm Direct Live Outreach' : 'Confirm Evaluation Simulation',
      message: isLive 
        ? `Are you sure you want to send a LIVE Full Body Checkup email recommendation directly to the selected patient "${patientName}"?`
        : `Are you sure you want to run a checkup evaluation simulation for the patient "${patientName}"? No live emails will be sent.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          await dispatch(runRulesForPatient({ patientId, dryRun: isDryRun })).unwrap();
          dispatch(addToast({ type: 'success', message: 'Checkup outreach evaluated and sent!' }));
        } catch (err) {
          dispatch(addToast({ type: 'error', message: err || 'Outreach evaluation failed' }));
        }
      }
    });
  };

  const handleRunCampaignNow = (ruleId, ruleName) => {
    setConfirmDialog({
      isOpen: true,
      isLive: false,
      title: 'Confirm Group Evaluation',
      message: `Are you sure you want to trigger a simulation scan for the campaign "${ruleName}"? This will scan the group and show the matching patients checklist without sending live emails.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          await dispatch(runRules({ 
            organizationId: currentOrgId, 
            dryRun: true,
            ruleIds: [ruleId]
          })).unwrap();
          dispatch(addToast({ type: 'success', message: `Scan completed. Review matching patients below.` }));
        } catch (err) {
          dispatch(addToast({ type: 'error', message: err || 'Failed to trigger scan' }));
        }
      }
    });
  };

  // Click handler to insert dynamic templates into current cursor position
  const insertPlaceholder = (placeholder) => {
    const textarea = document.getElementById('email-body-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newText = before + placeholder + after;
    setEmailBody(newText);

    // Focus and reset selection position after React updates state
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  // Process placeholders inside composer template into standard readable strings for dynamic previews
  const getRenderedPreview = () => {
    const firstCond = conditions[0] || {};
    const fieldObj = getFieldDetails(firstCond.field);
    const opObj = getOperatorDetails(firstCond.operator);

    return emailBody
      .replace(/{patientName}/g, selectedPatient ? selectedPatient.patientName : 'John Doe')
      .replace(/{vitalsField}/g, fieldObj ? fieldObj.label : 'Oxygen Level (SpO2)')
      .replace(/{conditionOperator}/g, opObj ? opObj.label.toLowerCase() : 'less than')
      .replace(/{thresholdValue}/g, `${firstCond.threshold || '90'}${fieldObj?.unit || ''}`);
  };

  // Grouping logic helper for matched outcomes
  const getGroupedMatches = () => {
    if (!runResults || !runResults.matches) return [];
    
    // Group matches by patient identifier
    const groups = {};
    runResults.matches.forEach(match => {
      const patientKey = match.patientId || match.patientName || 'Unknown Patient';
      if (!groups[patientKey]) {
        groups[patientKey] = {
          patientName: match.patientName,
          patientId: match.patientId,
          dryRun: runResults.dryRun,
          ruleMatches: []
        };
      }
      groups[patientKey].ruleMatches.push(match);
    });

    // Convert to array and filter by search query
    return Object.values(groups).filter(group => 
      (group.patientName || '').toLowerCase().includes(logSearchQuery.toLowerCase()) ||
      (group.patientId || '').toLowerCase().includes(logSearchQuery.toLowerCase())
    );
  };

  const activeFieldObj = getFieldDetails(conditions[0]?.field || 'spo2');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in text-left">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#DDE3F0]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="pill bg-[#1A3C8F]/10 text-[#1A3C8F] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={10} className="text-[#1A3C8F]" /> Doctor Panel
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight flex items-center gap-2 mt-1">
            Clinical Checkup & Outreach Campaigns
          </h1>
          <p className="text-xs text-[#8A97B0] max-w-2xl">
            A simplified workspace for doctors to automatically recommend and send Full Body Checkup emails to patients matching vital criteria or target single patients directly.
          </p>
        </div>

        {user?.role === 'ADMIN' ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col text-left">
              <label className="text-[9px] font-bold text-[#8A97B0] uppercase mb-1">Active Clinic Group</label>
              <select 
                value={selectedOrgId} 
                onChange={e => setSelectedOrgId(e.target.value)} 
                className="text-xs font-bold bg-white border border-[#DDE3F0] rounded-xl px-3 py-2 text-[#4B5A7A] focus:outline-none focus:ring-2 focus:ring-[#1A3C8F]/15"
              >
                <option value="">Default Clinic Group</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-[#8A97B0] uppercase">Group Workspace:</span>
            <span className="text-xs font-black text-[#1A3C8F] bg-[#1A3C8F]/5 border border-[#1A3C8F]/10 px-2.5 py-1 rounded-xl">
              {user?.organizationId || 'Personal Workspace'}
            </span>
          </div>
        )}
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: SETUP CAMPAIGN (Width: 5/12) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card p-6 border border-[#EBEFF5]">
            <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[#F0F4FC]">
              <div className="p-2 bg-[#1A3C8F]/10 rounded-xl">
                <Send size={18} className="text-[#1A3C8F]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F1A3A] text-sm">Launch New Outreach</h3>
                <p className="text-[10px] text-[#8A97B0]">Set vital criteria or target a specific patient</p>
              </div>
            </div>

            {/* Recipient Audience Selector */}
            <div className="space-y-1.5 mb-5">
              <label className="text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider block">Target Audience</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRecipientType('condition')}
                  className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                    recipientType === 'condition'
                      ? 'border-[#1A3C8F] bg-[#1A3C8F]/5 shadow-sm'
                      : 'border-[#DDE3F0] hover:bg-gray-50'
                  }`}
                >
                  <Users size={16} className={recipientType === 'condition' ? 'text-[#1A3C8F]' : 'text-[#8A97B0]'} />
                  <span className="text-xs font-bold text-[#0F1A3A] mt-1">Vital Conditions</span>
                  <span className="text-[9px] text-[#8A97B0]">Target matching vital values</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientType('patient')}
                  className={`p-3 rounded-xl border transition-all text-left flex flex-col gap-1 cursor-pointer ${
                    recipientType === 'patient'
                      ? 'border-[#1A3C8F] bg-[#1A3C8F]/5 shadow-sm'
                      : 'border-[#DDE3F0] hover:bg-gray-50'
                  }`}
                >
                  <User size={16} className={recipientType === 'patient' ? 'text-[#1A3C8F]' : 'text-[#8A97B0]'} />
                  <span className="text-xs font-bold text-[#0F1A3A] mt-1">Specific Patient</span>
                  <span className="text-[9px] text-[#8A97B0]">Target a single record</span>
                </button>
              </div>
            </div>

            {/* CONDITION MATCH FORM */}
            {recipientType === 'condition' ? (
              <form onSubmit={handleDeployCampaign} className="space-y-4">
                
                {/* Multi-condition builder */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider">
                      Conditions (ALL must match)
                    </label>
                    {conditions.length < 5 && (
                      <button
                        type="button"
                        onClick={addCondition}
                        className="text-[9px] font-bold text-[#1A3C8F] bg-[#1A3C8F]/8 hover:bg-[#1A3C8F]/15 border border-[#1A3C8F]/20 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        + Add Condition
                      </button>
                    )}
                  </div>

                  {conditions.map((cond, idx) => {
                    const condField = getFieldDetails(cond.field);
                    return (
                      <div key={idx} className="relative bg-[#F8FAFF] border border-[#EBEFF5] rounded-xl p-3 space-y-2">
                        
                        {/* AND badge between conditions */}
                        {idx > 0 && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                            <span className="text-[8px] font-black text-white bg-[#1A3C8F] px-2 py-0.5 rounded-full shadow-sm">
                              AND
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-[#8A97B0] uppercase">Condition {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateCondition(idx, 'isCustom', !cond.isCustom)}
                              className="text-[8px] font-bold text-[#1A3C8F] hover:underline cursor-pointer"
                            >
                              {cond.isCustom ? 'Use Dropdown' : 'Enter Custom'}
                            </button>
                            {conditions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeCondition(idx)}
                                className="text-[#8A97B0] hover:text-red-500 transition-colors cursor-pointer p-0.5"
                                title="Remove this condition"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Field selector / custom text input */}
                        {cond.isCustom ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              required
                              value={cond.field}
                              onChange={e => updateCondition(idx, 'field', e.target.value)}
                              className="input bg-white py-1.5 text-xs w-full font-mono"
                              placeholder="e.g. diagnosis or clinicalData.riskScore"
                            />
                            <p className="text-[7.5px] text-[#A0AECB] leading-none">
                              Use root fields (e.g. <code>diagnosis</code>) or prefixes: <code>clinicalData.key</code> or <code>dynamicFormResponses.key</code>
                            </p>
                          </div>
                        ) : (
                          <select
                            value={cond.field}
                            onChange={e => updateCondition(idx, 'field', e.target.value)}
                            className="input bg-white py-1.5 text-xs w-full"
                          >
                            {availableFields.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        )}

                        {/* Operator + Threshold(s) */}
                        <div className={`grid gap-2 ${cond.operator === 'BETWEEN' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <select
                            value={cond.operator}
                            onChange={e => updateCondition(idx, 'operator', e.target.value)}
                            className="input bg-white py-1.5 text-xs"
                          >
                            {getFilteredOperators(condField).map(op => (
                              <option key={op.value} value={op.value}>{op.symbol} {op.label}</option>
                            ))}
                          </select>

                          <div className="relative">
                            <input
                              type={condField?.type === 'string' ? 'text' : 'number'}
                              required
                              value={cond.threshold}
                              onChange={e => updateCondition(idx, 'threshold', e.target.value)}
                              className="input bg-white py-1.5 pr-8 text-xs font-bold w-full"
                              placeholder={cond.operator === 'BETWEEN' ? 'Min' : 'Value'}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-[#A0AECB]">
                              {condField?.unit}
                            </span>
                          </div>

                          {cond.operator === 'BETWEEN' && (
                            <div className="relative">
                              <input
                                type="number"
                                required
                                value={cond.thresholdMax || ''}
                                onChange={e => updateCondition(idx, 'thresholdMax', e.target.value)}
                                className="input bg-white py-1.5 pr-8 text-xs font-bold w-full"
                                placeholder="Max"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-[#A0AECB]">
                                {condField?.unit}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Human-readable summary */}
                        <p className="text-[9px] text-[#8A97B0] font-medium">
                          IF <span className="text-[#1A3C8F] font-bold">{condField?.label}</span>{' '}
                          {cond.operator === 'BETWEEN'
                            ? <><span className="text-[#C8102E] font-bold">between {cond.threshold}{condField?.unit} – {cond.thresholdMax || '?'}{condField?.unit}</span></>  
                            : <><span className="text-[#C8102E] font-bold">{getOperatorDetails(cond.operator)?.symbol} {cond.threshold}{condField?.unit}</span></>  
                          }
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Campaign Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider">Campaign Name / Label (Optional)</label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder={`e.g. Recommended Full Body Checkup for ${activeFieldObj?.label}`}
                    className="input bg-[#F8FAFF] py-2 text-xs"
                  />
                </div>

                {/* 4. Subtle Simulation Mode Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#F8FAFF] rounded-xl border border-[#EBEFF5]">
                  <div>
                    <h5 className="text-[11px] font-bold text-[#0F1A3A] flex items-center gap-1">
                      <Sliders size={12} className="text-[#1A3C8F]" /> Simulation Mode Only
                    </h5>
                    <p className="text-[9px] text-[#8A97B0]">Test logic matching without sending emails</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDryRun(!isDryRun)}
                    className={`w-8 h-4.5 rounded-full relative transition-all cursor-pointer ${isDryRun ? 'bg-[#1A3C8F]' : 'bg-[#DDE3F0]'}`}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${isDryRun ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* 5. Deploy Button */}
                <button
                  type="submit"
                  disabled={saving || running}
                  className="btn-primary w-full justify-center text-xs py-2.5 cursor-pointer shadow-md"
                >
                  {saving || running ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Mail size={14} />
                  )}
                  {saving || running ? 'Deploying & Processing Vitals...' : 'Deploy Campaign & Dispatch Emails'}
                </button>
              </form>
            ) : (
              /* SPECIFIC PATIENT FORM */
              <div className="space-y-4">
                
                {/* Patient Search Input */}
                <div className="space-y-1.5 bg-[#F8FAFF] p-4 rounded-xl border border-[#EBEFF5]">
                  <label className="text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider block">Lookup Patient by Phone Number</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                      <input 
                        value={phoneSearch} 
                        onChange={e => setPhoneSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePatientSearch()}
                        placeholder="Enter doctor or patient phone suffix..." 
                        className="w-full bg-white border border-[#DDE3F0] rounded-xl pl-8 pr-3 py-1.5 text-xs focus:border-[#1A3C8F] focus:outline-none focus:ring-1 focus:ring-[#1A3C8F]" 
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handlePatientSearch} 
                      disabled={searchingPatients}
                      className="px-4 py-1.5 bg-[#1A3C8F] hover:bg-[#1A3C8F]/95 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {searchingPatients ? <RefreshCw size={12} className="animate-spin" /> : 'Search'}
                    </button>
                  </div>

                  {/* Dropdown Results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1.5 max-h-[140px] overflow-y-auto pt-2 border-t border-dashed border-[#DDE3F0]">
                      {searchResults.map(p => (
                        <div 
                          key={p.patientId} 
                          onClick={() => handleSelectPatient(p)}
                          className="p-2.5 bg-white hover:bg-indigo-50/50 border border-[#DDE3F0] hover:border-[#1A3C8F] rounded-lg cursor-pointer transition-all text-left flex justify-between items-center"
                        >
                          <div>
                            <span className="text-xs font-bold text-[#0F1A3A] block">{p.patientName}</span>
                            <span className="text-[10px] text-[#8A97B0] block mt-0.5">Phone: {p.phoneNumber || 'N/A'}</span>
                          </div>
                          <span className="text-[#1A3C8F] font-mono font-bold text-[9px] bg-[#1A3C8F]/5 border border-[#1A3C8F]/10 px-1.5 py-0.5 rounded">
                            {p.patientId}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Display Selected Patient Badge */}
                {selectedPatient ? (
                  <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl space-y-2 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-emerald-500/10 rounded-lg">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-emerald-800">Target Patient Selected</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleDeselectPatient} 
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-[#0F1A3A] space-y-1">
                      <p><strong>Name:</strong> {selectedPatient.patientName}</p>
                      <p><strong>Patient ID:</strong> {selectedPatient.patientId}</p>
                      <p><strong>Primary Contact:</strong> {selectedPatient.phoneNumber || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#F8FAFF] border border-dashed border-[#DDE3F0] rounded-xl text-center text-xs text-[#8A97B0]">
                    No patient selected. Look up a patient by phone above.
                  </div>
                )}

                {/* Subtle Simulation Mode Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#F8FAFF] rounded-xl border border-[#EBEFF5]">
                  <div>
                    <h5 className="text-[11px] font-bold text-[#0F1A3A] flex items-center gap-1">
                      <Sliders size={12} className="text-[#1A3C8F]" /> Simulation Mode Only
                    </h5>
                    <p className="text-[9px] text-[#8A97B0]">Test logic matching without sending emails</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsDryRun(!isDryRun)}
                    className={`w-8 h-4.5 rounded-full relative transition-all cursor-pointer ${isDryRun ? 'bg-[#1A3C8F]' : 'bg-[#DDE3F0]'}`}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${isDryRun ? 'left-4' : 'left-0.5'}`} stroke="none" />
                  </button>
                </div>

                {/* Direct Send button */}
                <button
                  type="button"
                  onClick={handleDirectPatientOutreach}
                  disabled={running || !selectedPatient}
                  className="btn-primary w-full justify-center text-xs py-2.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {running ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Mail size={14} />
                  )}
                  {running ? 'Evaluating Vitals...' : 'Send Checkup Outreach Email'}
                </button>

              </div>
            )}
          </div>

          {/* DYNAMIC EMAIL TEMPLATE COMPOSER & PREVIEW */}
          <div className="card p-6 border border-[#EBEFF5] bg-[#F8FAFF]/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1A3C8F] to-[#C8102E]" />
            
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[#1A3C8F]" />
                <span className="text-[10px] font-bold text-[#1A3C8F] uppercase tracking-wider">Dynamic Email Template</span>
              </div>

              {/* Composer / Preview Tabs */}
              <div className="flex bg-white border border-[#DDE3F0] rounded-lg p-0.5 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => setPreviewTab('edit')}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                    previewTab === 'edit' ? 'bg-[#1A3C8F] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Composer
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('preview')}
                  className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                    previewTab === 'preview' ? 'bg-[#1A3C8F] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#DDE3F0] rounded-xl overflow-hidden shadow-sm text-xs">
              {/* Header Box */}
              <div className="bg-[#0F1A3A] text-white p-3.5 space-y-1.5 text-left">
                <div className="flex items-center text-[9px] text-gray-300 font-mono">
                  <span className="w-12 font-black">From:</span>
                  <span>Smart-eHR Medical Care &lt;outreach@smart-ehr.com&gt;</span>
                </div>
                <div className="flex items-center text-[9px] text-gray-300 font-mono">
                  <span className="w-12 font-black">To:</span>
                  <span>{recipientType === 'patient' && selectedPatient ? `${selectedPatient.patientName.replace(/\s+/g, '').toLowerCase()}@example.com` : '{patientEmail}'}</span>
                </div>
                <div className="flex items-center text-[9px] text-gray-300 font-mono">
                  <span className="w-12 font-black">Subject:</span>
                  {previewTab === 'edit' ? (
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={e => setEmailSubject(e.target.value)}
                      className="flex-1 bg-[#1A3C8F]/25 text-white font-bold border-none focus:outline-none focus:bg-[#1A3C8F]/40 px-2 py-0.5 rounded text-[10px] placeholder-gray-400 focus:ring-1 focus:ring-[#1A3C8F]"
                      placeholder="Enter outreach subject..."
                    />
                  ) : (
                    <span className="font-bold text-white text-[10px]">{emailSubject}</span>
                  )}
                </div>
              </div>

              {/* Dynamic Composer Body */}
              {previewTab === 'edit' ? (
                <div className="p-3 bg-white space-y-3">
                  
                  {/* Dynamic Tool Bar for Quick Placeholders */}
                  <div className="flex items-center flex-wrap gap-1 pb-2 border-b border-[#F0F4FC] text-left">
                    <span className="text-[9px] font-black text-[#8A97B0] uppercase mr-1">Insert Value:</span>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{patientName}')}
                      className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[9px] rounded border border-gray-200 cursor-pointer transition-colors"
                      title="Insert patient's full name dynamically"
                    >
                      Patient Name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{vitalsField}')}
                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[9px] rounded border border-indigo-100 cursor-pointer transition-colors"
                      title="Insert selected vital name"
                    >
                      Vital Name
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholder('{thresholdValue}')}
                      className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[9px] rounded border border-indigo-100 cursor-pointer transition-colors"
                      title="Insert condition threshold"
                    >
                      Vital Value
                    </button>
                  </div>

                  <textarea
                    id="email-body-textarea"
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={8}
                    className="w-full border-none focus:outline-none resize-y text-[11px] leading-relaxed text-gray-700 font-sans p-1 focus:ring-0"
                    placeholder="Compose the outreach email template. Use placeholders like {patientName}, {vitalsField}, and {thresholdValue} to auto-populate."
                  />
                  
                  <div className="text-[8px] text-[#A0AECB] text-right font-medium">
                    Placeholders will automatically resolve during email checkup runs.
                  </div>
                </div>
              ) : (
                /* Live Preview Rendered Body */
                <div className="p-4 text-left text-gray-700 leading-relaxed font-sans text-[11px] max-h-[260px] overflow-y-auto bg-[#F8FAFF]">
                  {getRenderedPreview().split('\n').map((para, index) => (
                    <p key={index} className={para.trim() === '' ? 'h-3' : 'mb-3'}>
                      {para}
                    </p>
                  ))}
                  <div className="text-[10px] text-[#8A97B0] pt-2 border-t border-[#EBEFF5]">
                    <p>Sincerely,</p>
                    <p className="font-bold text-[#0F1A3A]">Smart-eHR Clinical Care Team</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: CAMPAIGNS & DISPATCH LOGS (Width: 7/12) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Active Outreach Rules / Campaigns */}
          <div className="card p-6 border border-[#EBEFF5]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1A3C8F]/10 rounded-xl">
                  <Sliders size={18} className="text-[#1A3C8F]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F1A3A] text-sm">Active Vitals Campaigns</h3>
                  <p className="text-[10px] text-[#8A97B0]">Clinical rule criteria that trigger auto-outreach</p>
                </div>
              </div>

              <span className="text-[10px] font-bold bg-[#1A3C8F]/5 text-[#1A3C8F] border border-[#1A3C8F]/10 px-2 py-0.5 rounded-lg">
                Total: {rules?.length || 0}
              </span>
            </div>

            {loading ? (
              <div className="py-10 text-center text-xs text-[#8A97B0] flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-[#1A3C8F]" />
                <span>Loading active campaigns...</span>
              </div>
            ) : !rules || rules.length === 0 ? (
              <div className="bg-[#F8FAFF] border border-dashed border-[#DDE3F0] rounded-2xl py-12 text-center space-y-2">
                <Sliders size={28} className="mx-auto text-[#DDE3F0]" />
                <p className="text-xs text-[#8A97B0] font-medium">No clinical outreach campaigns deployed yet.</p>
                <p className="text-[10px] text-[#A0AECB]">Configure and deploy a campaign from the left panel to begin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 max-h-[300px] overflow-y-auto pr-1">
                {rules.map(rule => {
                  return (
                    <div 
                      key={rule.id} 
                      className="bg-white border border-[#EBEFF5] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <h4 className="font-bold text-[#0F1A3A] text-xs leading-none">{rule.name}</h4>
                          <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                            {rule.action?.type || 'EMAIL'}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-[#4B5A7A]">
                          {(() => {
                            // Support both new conditions[] and legacy field/operator/threshold
                            const conds = rule.conditions?.length
                              ? rule.conditions
                              : [{ field: rule.field, operator: rule.operator, threshold: rule.threshold }];
                            return conds.map((c, i) => {
                              const fObj = getFieldDetails(c.field);
                              const oObj = getOperatorDetails(c.operator);
                              return (
                                <span key={i}>
                                  {i > 0 && <span className="font-black text-[#1A3C8F]"> AND </span>}
                                  <span className="font-bold text-gray-700">{fObj?.label || c.field}</span>{' '}
                                  <span className="font-bold text-[#1A3C8F]">{oObj?.symbol || c.operator} {c.threshold}</span>
                                </span>
                              );
                            });
                          })()}
                          {', THEN auto-dispatch checkup email.'}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRunCampaignNow(rule.id, rule.name)}
                          disabled={running}
                          className="px-2.5 py-1 bg-[#1A3C8F]/10 hover:bg-[#1A3C8F]/20 text-[#1A3C8F] rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Play size={10} fill="#1A3C8F" /> Scan Group
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Live Dispatched Outcomes & Logs */}
          <div className="card p-6 border border-[#EBEFF5] bg-white">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#C8102E]/10 rounded-xl">
                  <CheckCircle2 size={18} className="text-[#C8102E]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0F1A3A] text-sm">Dispatched Outreach Log</h3>
                  <p className="text-[10px] text-[#8A97B0]">History of patients matched and emailed</p>
                </div>
              </div>

              {runResults && (
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                  runResults.dryRun 
                    ? 'bg-amber-50 text-amber-600 border-amber-100' 
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {runResults.dryRun ? 'Simulated Campaign' : 'Live Campaign Dispatched'}
                </span>
              )}
            </div>

            {!runResults ? (
              <div className="bg-[#F8FAFF] border border-dashed border-[#DDE3F0] rounded-2xl py-16 text-center space-y-2">
                <Clock size={28} className="mx-auto text-[#DDE3F0]" />
                <p className="text-xs text-[#8A97B0] font-medium">No outreach execution logged yet.</p>
                <p className="text-[10px] text-[#A0AECB]">Deploy a new campaign or click "Scan Group" to view matching patient lists.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in text-left">
                
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 bg-[#F8FAFF] border border-[#EBEFF5] p-3.5 rounded-xl text-center">
                  {[
                    { label: 'Patients Scanned', value: runResults.evaluatedRecords },
                    { label: 'Outcomes Evaluated', value: runResults.evaluatedRules },
                    { 
                      label: 'Emails Dispatched', 
                      value: runResults.matchedRules, 
                      color: runResults.matchedRules > 0 ? 'text-[#C8102E]' : 'text-emerald-600' 
                    },
                  ].map((s, i) => (
                    <div key={i} className="space-y-1">
                      <p className={`text-xl font-black tracking-tight ${s.color || 'text-[#0F1A3A]'}`}>{s.value}</p>
                      <p className="text-[9px] text-[#8A97B0] uppercase font-bold tracking-wider leading-none">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Match checklist list */}
                <div className="border border-[#EBEFF5] rounded-xl overflow-hidden shadow-sm">
                  
                  {/* Dynamic Log Search & Header */}
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3 bg-gray-50/70 border-b border-[#F0F4FC]">
                    <div className="flex items-center gap-2">
                      {runResults?.dryRun && getGroupedMatches().length > 0 && (
                        <input
                          type="checkbox"
                          checked={getGroupedMatches().every(g => selectedPatientIds.includes(g.patientId))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPatientIds(getGroupedMatches().map(g => g.patientId).filter(Boolean));
                            } else {
                              setSelectedPatientIds([]);
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#1A3C8F] border-gray-300 rounded focus:ring-[#1A3C8F] cursor-pointer"
                        />
                      )}
                      <span className="text-[10px] font-bold text-[#4B5A7A] uppercase tracking-wider block">
                        Matched Outbox ({getGroupedMatches().length} unique patients)
                      </span>
                    </div>
                    {runResults.matches.length > 0 && (
                      <div className="relative w-full sm:w-44">
                        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
                        <input
                          type="text"
                          value={logSearchQuery}
                          onChange={e => setLogSearchQuery(e.target.value)}
                          placeholder="Search patient..."
                          className="w-full bg-white border border-[#DDE3F0] rounded-lg pl-6 pr-2.5 py-0.5 text-[9px] focus:outline-none focus:border-[#1A3C8F] focus:ring-1 focus:ring-[#1A3C8F]"
                        />
                      </div>
                    )}
                  </div>

                  {getGroupedMatches().length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      {runResults.matches.length === 0 
                        ? "All clinical criteria normal. No patients required checkup outreach in this run."
                        : "No matching patients found for your filter query."}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0F4FC] max-h-[340px] overflow-y-auto">
                      {getGroupedMatches().map((group) => (
                        <div 
                          key={group.patientId || group.patientName} 
                          className="p-3 hover:bg-[#F8FAFF]/40 transition-colors text-left space-y-2.5"
                        >
                          {/* Patient Header & Delivery Status */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                             <div className="flex items-center gap-3">
                               {runResults?.dryRun && (
                                 <input
                                   type="checkbox"
                                   checked={selectedPatientIds.includes(group.patientId)}
                                   onChange={(e) => {
                                     if (e.target.checked) {
                                       setSelectedPatientIds(prev => [...prev, group.patientId]);
                                     } else {
                                       setSelectedPatientIds(prev => prev.filter(id => id !== group.patientId));
                                     }
                                   }}
                                   className="w-3.5 h-3.5 text-[#1A3C8F] border-gray-300 rounded focus:ring-[#1A3C8F] cursor-pointer"
                                 />
                               )}
                               <div className="flex items-center gap-2">
                                 <div className="p-1 bg-[#1A3C8F]/10 rounded-lg text-[#1A3C8F]">
                                   <User size={11} className="font-bold" />
                                 </div>
                                 <div>
                                   <span className="text-[11px] font-black text-[#0F1A3A] block leading-none">{group.patientName || 'Unknown Patient'}</span>
                                   <span className="text-[8px] text-[#8A97B0] font-mono block mt-0.5">ID: {group.patientId}</span>
                                 </div>
                               </div>
                             </div>
                             
                             <div className="flex items-center gap-1.5">
                               <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${
                                 group.dryRun 
                                   ? 'bg-amber-50 text-amber-600 border-amber-100' 
                                   : (group.ruleMatches.some(m => m.status === 'MATCHED_NOT_SELECTED')
                                       ? 'bg-gray-50 text-gray-500 border-gray-200'
                                       : 'bg-emerald-50 text-emerald-600 border-emerald-100')
                               }`}>
                                 {group.dryRun 
                                   ? 'Simulated' 
                                   : (group.ruleMatches.some(m => m.status === 'MATCHED_NOT_SELECTED')
                                       ? 'Skipped (Not Selected)' 
                                       : 'Email Sent')}
                               </span>
                             </div>
                           </div>

                           {/* Matched Campaign Details Tags */}
                          <div className="flex flex-col gap-1.5 pl-6">
                            {group.ruleMatches.map((match, idx) => {
                              const fieldObj = getFieldDetails(match.field);
                              const isMultiCond = match.value && typeof match.value === 'object' && !Array.isArray(match.value);
                              return (
                                <div 
                                  key={idx} 
                                  className="bg-indigo-50/30 border border-indigo-100/50 p-2 rounded-lg text-[9px] text-left space-y-0.5"
                                >
                                  <div className="flex justify-between items-center text-[8px] font-black text-[#1A3C8F] uppercase">
                                    <span>{match.ruleName}</span>
                                    <span className="text-[#8A97B0] text-[7px] font-bold">({fieldObj?.label || match.field})</span>
                                  </div>
                                  {isMultiCond ? (
                                    <div className="space-y-1 mt-0.5">
                                      <p className="text-[9px] text-[#4B5A7A] leading-snug font-bold">
                                        Patient vital values met all conditions:
                                      </p>
                                      <ul className="list-disc pl-4 space-y-0.5">
                                        {Object.entries(match.value).map(([field, val]) => {
                                          const fObj = getFieldDetails(field);
                                          return (
                                            <li key={field} className="text-[8.5px] text-[#4B5A7A]">
                                              <strong>{fObj?.label || field}</strong>: {val}{fObj?.unit || ''}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <p className="text-[8px] text-[#8A97B0] italic border-t border-indigo-100/30 pt-1 mt-1 font-semibold">
                                        Rule Criteria: {match.threshold}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-[#4B5A7A] mt-0.5 leading-snug">
                                      Vital value <strong>{match.value}{fieldObj?.unit || ''}</strong> met campaign criteria (Threshold <strong>{match.operator} {match.threshold}{fieldObj?.unit || ''}</strong>).
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick stats clear button */}
                <div className="flex items-center justify-between gap-3 pt-2">
                   {runResults.dryRun && selectedPatientIds.length > 0 && (
                     <button
                       type="button"
                       onClick={handleSendToSelected}
                       disabled={running}
                       className="px-3.5 py-1.5 bg-[#C8102E] hover:bg-[#C8102E]/90 text-white rounded-xl text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-sm transition-all hover:shadow-[#C8102E]/10"
                     >
                       <Send size={10} className="text-white" />
                       Send Live Email to Selected ({selectedPatientIds.length})
                     </button>
                   )}
                   <button
                     type="button"
                     onClick={() => dispatch(clearRunResults())}
                     className="px-3 py-1.5 border border-[#DDE3F0] hover:bg-gray-50 rounded-lg text-[10px] text-gray-500 font-bold block ml-auto cursor-pointer"
                   >
                     Clear Log Results
                   </button>
                 </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* DYNAMIC CONFIRMATION MODAL DIALOG */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#DDE3F0] overflow-hidden flex flex-col p-6 space-y-4 animate-slide-up text-left">
            
            {/* Dialog Icon & Header */}
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${confirmDialog.isLive ? 'bg-rose-50 text-[#C8102E]' : 'bg-[#1A3C8F]/10 text-[#1A3C8F]'}`}>
                <AlertCircle size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-black text-[#0F1A3A] text-sm leading-tight">
                  {confirmDialog.title}
                </h4>
                <span className="text-[9px] font-bold text-[#8A97B0] uppercase tracking-wider block mt-0.5">
                  {confirmDialog.isLive ? 'Live Outreach Email Dispatch' : 'Testing Evaluation'}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <p className="text-xs text-[#4B5A7A] leading-relaxed font-medium">
              {confirmDialog.message}
            </p>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', isLive: false, onConfirm: null })}
                className="flex-1 border border-[#DDE3F0] hover:bg-gray-50 rounded-xl py-2 text-xs font-bold text-gray-500 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                }}
                className={`flex-1 text-white font-bold py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center ${
                  confirmDialog.isLive 
                    ? 'bg-gradient-to-r from-[#C8102E] to-[#9B0A21] hover:shadow-[#C8102E]/20 hover:brightness-110' 
                    : 'bg-gradient-to-r from-[#1A3C8F] to-[#0F2660] hover:shadow-[#1A3C8F]/20 hover:brightness-110'
                }`}
              >
                Yes, Confirm
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default RulesEngine;

