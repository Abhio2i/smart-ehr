import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCw, EyeOff, Shield, FileSearch, CheckCircle, AlertCircle, User, Activity, Stethoscope, Navigation, Lock, ClipboardCheck } from 'lucide-react';
import { addToast } from '../store/slices/uiSlice';
import { fetchRecords, selectRecords } from '../store/slices/epcrSlice';
import { fetchDeIdRecord, maskRecord, anonymizeRecord, clearResults, selectDeIdResult, selectMaskResult, selectAnonResult, selectDeIdLoading, selectDeIdError } from '../store/slices/deIdSlice';

const MASKING_STRATEGIES = [
  { value: 'FULL_HIPAA_18', label: 'Full HIPAA 18 (Remove all identifiers)' },
  { value: 'PARTIAL_MASKING', label: 'Partial Masking (Redact specific fields)' },
  { value: 'PSEUDO_ANONYMIZATION', label: 'Pseudo-Anonymization (Replace with tokens)' },
];
const ANON_METHODS = [
  { value: 'GENERALIZATION', label: 'Generalization (broaden specific values)' },
  { value: 'SUPPRESSION', label: 'Suppression (remove sensitive records)' },
  { value: 'DATA_SWAPPING', label: 'Data Swapping (permute values across records)' },
  { value: 'K_ANONYMITY', label: 'k-Anonymity (ensure indistinguishability)' },
];

const parseIfJson = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return val;
    }
  }
  return val;
};

const MedicalDocument = ({ data, isNested = false, rootData = null }) => {
  if (!data) return null;

  // Handle arrays by rendering a MedicalDocument for each item
  if (Array.isArray(data)) {
    return (
      <div className="space-y-6">
        {data.map((item, index) => (
          <MedicalDocument key={item?.id || index} data={item} isNested={isNested} rootData={rootData} />
        ))}
      </div>
    );
  }

  if (typeof data !== 'object') return null;

  const currentRoot = rootData || data;

  const sensitiveKeys = [
    'patientName', 'patientPhone', 'patientAddress', 'patientDateOfBirth', 'patientSSNLast4', 'email', 'medicalHistory',
    'incidentLocation', 'incidentDescription', 'diagnosis', 'treatmentProvided', 'treatmentPlan', 'age', 'height', 'weight',
    'bloodGroup', 'doctor', 'currentMedicines', 'comorbidity', 'allergy', 'spo2', 'heartRate', 'respirationRate',
    'bloodSugar', 'diastolicBp', 'systolicBp', 'pulseRate', 'temperature', 'hemoglobin', 'incidentNumber', 'sceneAssessment',
    'crew', 'timeline', 'structuredComplaints', 'structuredVitals', 'icd10Code', 'primaryImpression', 'secondaryImpression',
    'structuredMedications', 'structuredProcedures', 'transport', 'consent', 'clinicalData', 'attachmentIds', 'auditTrail',
    'feedback'
  ];

  const isDeId = currentRoot?.patientName === 'REDACTED' || currentRoot?.incidentLocation === 'REDACTED' || currentRoot?.patientId === 'REDACTED' || currentRoot?.diagnosis === 'REDACTED';

  const entries = Object.entries(data).filter(([k]) => {
    if (isNested && (k === 'paramedicsName' || k === 'organizationName' || k === 'submittedByName')) return false;
    return true;
  });

  const renderObjectValue = (obj) => {
    if (!obj || typeof obj !== 'object') return String(obj);
    const entries = Object.entries(obj);
    if (entries.length === 0) return <span className="text-[#A0AECB] italic uppercase text-[10px]">Empty</span>;

    return (
      <div className="mt-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 space-y-2 text-left w-full animate-fade-in">
        {entries.map(([k, v]) => {
          const formattedKey = k
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/B P/g, 'BP')
            .replace(/S S N/g, 'SSN');

          const parsedVal = parseIfJson(v);

          let formattedVal = String(parsedVal);
          if (parsedVal === null || parsedVal === undefined || parsedVal === '') {
            formattedVal = <span className="text-[#A0AECB] italic uppercase text-[10px]">Empty</span>;
          } else if (typeof parsedVal === 'boolean') {
            formattedVal = (
              <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${parsedVal ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                {parsedVal ? 'Yes' : 'No'}
              </span>
            );
          } else if (Array.isArray(parsedVal)) {
            formattedVal = (
              <div className="mt-1 space-y-2 max-h-48 overflow-y-auto pr-1">
                {parsedVal.map((item, i) => (
                  <div key={i} className="pl-2.5 border-l-2 border-[#1A3C8F] text-[10px] py-0.5 w-full">
                    {typeof item === 'object' ? (
                      renderObjectValue(item)
                    ) : (
                      <span className="text-[10px] font-bold text-[#4B5A7A]">{String(item)}</span>
                    )}
                  </div>
                ))}
              </div>
            );
          } else if (typeof parsedVal === 'object') {
            formattedVal = renderObjectValue(parsedVal);
          } else if (String(parsedVal) === 'REDACTED') {
            formattedVal = <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse uppercase">REDACTED</span>;
          }

          return (
            <div key={k} className="flex justify-between items-start gap-4 py-1 border-b border-dashed border-slate-100 last:border-0 text-xs">
              <span className="font-semibold text-slate-500">{formattedKey}</span>
              <span className="font-bold text-slate-700 text-right">{formattedVal}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderField = (label, val, keyName) => {
    const parsedVal = parseIfJson(val);
    const isValEmpty = parsedVal === null || parsedVal === undefined || parsedVal === '' || parsedVal === 'N/A' || (Array.isArray(parsedVal) && parsedVal.length === 0);

    if (isValEmpty) {
      if (isDeId && keyName && sensitiveKeys.includes(keyName)) {
        return (
          <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-xs">
            <span className="text-[11px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</span>
            <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-rose-50 text-rose-600 border border-rose-100 animate-pulse uppercase">REDACTED</span>
          </div>
        );
      }
      return (
        <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-xs">
          <span className="text-[11px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</span>
          <span className="text-[10px] font-bold text-[#A0AECB] italic uppercase">Empty</span>
        </div>
      );
    }
    
    let rendered = parsedVal;
    if (parsedVal === 'REDACTED') {
      rendered = <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-rose-50 text-rose-600 border border-rose-100 animate-pulse uppercase">REDACTED</span>;
    } else if (typeof parsedVal === 'boolean') {
      rendered = <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${parsedVal ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>{parsedVal ? 'Yes' : 'No'}</span>;
    } else if (typeof parsedVal === 'string' && (parsedVal.includes('***') || parsedVal.includes('ANONYMIZED'))) {
      rendered = <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider bg-slate-50 text-slate-600 border border-slate-200 uppercase">{parsedVal}</span>;
    } else if (Array.isArray(parsedVal)) {
      rendered = (
        <div className="mt-1 space-y-2 max-h-48 overflow-y-auto pr-1">
          {parsedVal.map((item, i) => (
            <div key={i} className="pl-3 border-l-2 border-[#1A3C8F] text-xs py-0.5 w-full">
              {typeof item === 'object' ? (
                renderObjectValue(item)
              ) : (
                <span className="text-xs font-bold text-[#4B5A7A]">{String(item)}</span>
              )}
            </div>
          ))}
        </div>
      );
    } else if (typeof parsedVal === 'object') {
      rendered = renderObjectValue(parsedVal);
    } else {
      rendered = <span className="text-xs font-bold text-[#4B5A7A]">{String(parsedVal)}</span>;
    }

    const isBlock = Array.isArray(val) || (typeof val === 'object' && val !== null);
    
    if (isBlock) {
      return (
        <div className="py-2.5 border-b border-gray-100 last:border-0 flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</span>
          <div className="w-full text-left">{rendered}</div>
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 gap-4">
        <span className="text-[11px] font-bold text-[#8A97B0] uppercase tracking-wider">{label}</span>
        <div className="text-right shrink-0">{rendered}</div>
      </div>
    );
  };

  const formatValue = (k, v) => {
    if (v === null || v === undefined || v === '' || v === 'N/A' || (Array.isArray(v) && v.length === 0)) {
      if (isDeId && sensitiveKeys.includes(k)) return <span className="badge badge-red animate-pulse">REDACTED</span>;
      return <span className="text-[#A0AECB] italic text-xs font-bold uppercase tracking-wider">Empty</span>;
    }
    
    if (typeof v === 'boolean') return <span className={v ? 'badge badge-green' : 'badge badge-red'}>{v ? 'True' : 'False'}</span>;
    if (typeof v === 'string') {
      const isMasked = v.includes('***') || v.includes('REDACTED') || v.includes('ANONYMIZED');
      if (isMasked) return <span className="badge badge-gray">{v}</span>;
      
      if (k === 'paramedicsId' && currentRoot?.paramedicsName) return <div><p className="font-bold text-[#0F1A3A]">{currentRoot.paramedicsName}</p><p className="text-xs text-[#8A97B0]">ID: {v}</p></div>;
      if (k === 'organizationId' && currentRoot?.organizationName) return <div><p className="font-bold text-[#0F1A3A]">{currentRoot.organizationName}</p><p className="text-xs text-[#8A97B0]">ID: {v}</p></div>;
      if (k === 'submittedBy' && currentRoot?.submittedByName) return <div><p className="font-bold text-[#0F1A3A]">{currentRoot.submittedByName}</p><p className="text-xs text-[#8A97B0]">ID: {v}</p></div>;
      if (k === 'qaApprovedBy' && currentRoot?.qaApprovedByName) return <div><p className="font-bold text-[#0F1A3A]">{currentRoot.qaApprovedByName}</p><p className="text-xs text-[#8A97B0]">ID: {v}</p></div>;
      
      return <span className="text-[#4B5A7A] font-medium text-sm">{v}</span>;
    }
    if (Array.isArray(v)) {
      return (
        <ul className="space-y-2 mt-2">
          {v.map((item, i) => (
            <li key={i} className="pl-4 border-l-2 border-[#1A3C8F]">
              {typeof item === 'object' ? <div className="bg-[#F8FAFF] p-4 rounded-xl border border-[#DDE3F0]"><MedicalDocument data={item} isNested={true} rootData={currentRoot} /></div> : <span className="text-[#4B5A7A] text-sm">{String(item)}</span>}
            </li>
          ))}
        </ul>
      );
    }
    if (typeof v === 'object') return <div className="mt-2"><MedicalDocument data={v} isNested={true} rootData={currentRoot} /></div>;
    return <span className="text-[#4B5A7A] text-sm">{String(v)}</span>;
  };

  if (isNested) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {entries.map(([k, v]) => {
          const titleKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          return (
            <div key={k} className="flex flex-col gap-1 border-b border-[#F0F4FC] pb-2 last:border-0">
              <span className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">{titleKey}</span>
              <div className="text-left">{formatValue(k, v)}</div>
            </div>
          );
        })}
      </div>
    );
  }

  const standardKeys = [
    'id', 'recordId', 'patientName', 'patientId', 'patientGender', 'patientDateOfBirth', 'patientPhone', 'patientAddress', 'email',
    'incidentDateTime', 'incidentLocation', 'incidentDescription', 'incidentType', 'incidentNumber',
    'spo2', 'heartRate', 'respirationRate', 'bloodSugar', 'diastolicBp', 'systolicBp', 'pulseRate', 'temperature', 'hemoglobin',
    'bloodGroup', 'height', 'weight', 'doctor', 'currentMedicines', 'comorbidity', 'allergy',
    'diagnosis', 'treatmentProvided', 'treatmentPlan',
    'transportDestination', 'transportMode', 'careLevel',
    'organizationId', 'submittedBy', 'submittedAt', 'qaApproved', 'qaApprovedAt', 'qaApprovedBy', 'createdAt', 'updatedAt',
    'paramedicsId', 'paramedicsName', 'organizationName', 'submittedByName', 'qaApprovedByName'
  ];

  const extraEntries = entries.filter(([k]) => !standardKeys.includes(k));

  return (
    <div className="space-y-6">
      
      {/* Document Header */}
      <div className="card p-6 border-l-4 border-l-[#1A3C8F] bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a3c8f]/10 text-[#1a3c8f] flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-black text-[#0F1A3A] text-base leading-tight">De-identified Clinical Record</h3>
            <p className="text-[10px] text-[#8A97B0] uppercase font-bold tracking-wider mt-0.5">HIPAA Safe Harbor Compliance Mode</p>
          </div>
        </div>
        <div className="bg-[#F8FAFF] px-4 py-1.5 rounded-xl border border-[#DDE3F0] text-left sm:text-right shrink-0">
          <span className="text-[9px] font-bold text-[#A0AECB] uppercase tracking-wider block leading-none">Record ID</span>
          <span className="text-xs font-mono font-bold text-[#1A3C8F] mt-0.5 block">{data.id || data.recordId || 'N/A'}</span>
        </div>
      </div>

      {/* Grid of Structured Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Card 1: Patient Profile */}
        <div className="card p-5 border-t-2 border-t-[#1A3C8F] bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <User size={15} className="text-[#1A3C8F]" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Patient Profile</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Patient Name', data.patientName, 'patientName')}
            {renderField('Patient ID', data.patientId, 'patientId')}
            {renderField('Gender', data.patientGender, 'patientGender')}
            {renderField('Date of Birth', data.patientDateOfBirth, 'patientDateOfBirth')}
            {renderField('Contact Phone', data.patientPhone, 'patientPhone')}
            {renderField('Home Address', data.patientAddress, 'patientAddress')}
            {renderField('Email Address', data.email, 'email')}
          </div>
        </div>

        {/* Card 2: Dispatch & Incident */}
        <div className="card p-5 border-t-2 border-t-orange-500 bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <Navigation size={15} className="text-orange-500" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Incident & Dispatch</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Incident Number', data.incidentNumber, 'incidentNumber')}
            {renderField('Incident Type', data.incidentType, 'incidentType')}
            {renderField('Date & Time', data.incidentDateTime, 'incidentDateTime')}
            {renderField('Incident Location', data.incidentLocation, 'incidentLocation')}
            {renderField('Description', data.incidentDescription, 'incidentDescription')}
            {renderField('Timeline', data.timeline, 'timeline')}
            {renderField('Crew List', data.crew, 'crew')}
            {renderField('Scene Assessment', data.sceneAssessment, 'sceneAssessment')}
          </div>
        </div>

        {/* Card 3: Clinical Vitals */}
        <div className="card p-5 border-t-2 border-t-rose-500 bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <Activity size={15} className="text-rose-500" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Clinical Vitals</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Blood Group', data.bloodGroup, 'bloodGroup')}
            {renderField('Height', data.height, 'height')}
            {renderField('Weight', data.weight, 'weight')}
            {renderField('Oxygen saturation (SpO2)', data.spo2, 'spo2')}
            {renderField('Heart Rate', data.heartRate, 'heartRate')}
            {renderField('Pulse Rate', data.pulseRate, 'pulseRate')}
            {renderField('Respiration Rate', data.respirationRate, 'respirationRate')}
            {renderField('Systolic BP', data.systolicBp, 'systolicBp')}
            {renderField('Diastolic BP', data.diastolicBp, 'diastolicBp')}
            {renderField('Temperature', data.temperature, 'temperature')}
            {renderField('Blood Sugar', data.bloodSugar, 'bloodSugar')}
            {renderField('Hemoglobin', data.hemoglobin, 'hemoglobin')}
            {renderField('Clinical Data', data.clinicalData, 'clinicalData')}
            {renderField('Structured Vitals', data.structuredVitals, 'structuredVitals')}
          </div>
        </div>

        {/* Card 4: Diagnostics & Treatment */}
        <div className="card p-5 border-t-2 border-t-emerald-500 bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <Stethoscope size={15} className="text-emerald-500" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Diagnostics & Treatment</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Attending Doctor', data.doctor, 'doctor')}
            {renderField('Diagnosis', data.diagnosis, 'diagnosis')}
            {renderField('Treatment Provided', data.treatmentProvided, 'treatmentProvided')}
            {renderField('Treatment Plan', data.treatmentPlan, 'treatmentPlan')}
            {renderField('Current Medications', data.currentMedicines, 'currentMedicines')}
            {renderField('Comorbidities', data.comorbidity, 'comorbidity')}
            {renderField('Allergy', data.allergy, 'allergy')}
            {renderField('Medical History', data.medicalHistory, 'medicalHistory')}
            {renderField('Medications Administered', data.medicationsAdministered, 'medicationsAdministered')}
            {renderField('Procedures Performed', data.proceduresPerformed, 'proceduresPerformed')}
            {renderField('Structured Complaints', data.structuredComplaints, 'structuredComplaints')}
          </div>
        </div>

        {/* Card 5: Transport & Consent */}
        <div className="card p-5 border-t-2 border-t-slate-500 bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <ClipboardCheck size={15} className="text-slate-500" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Transport & Consent</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Transport Destination', data.transportDestination, 'transportDestination')}
            {renderField('Transport Mode', data.transportMode, 'transportMode')}
            {renderField('Care Level Required', data.careLevel, 'careLevel')}
            {renderField('Detailed Transport Info', data.transport, 'transport')}
            {renderField('Patient Consent Info', data.consent, 'consent')}
          </div>
        </div>

        {/* Card 6: Access & Governance Metadata */}
        <div className="card p-5 border-t-2 border-t-indigo-500 bg-white space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <Lock size={15} className="text-indigo-500" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Access & Governance</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {renderField('Organization ID', data.organizationId, 'organizationId')}
            {renderField('Submitted By', data.submittedBy, 'submittedBy')}
            {renderField('Submitted At', data.submittedAt, 'submittedAt')}
            {renderField('QA Approved', data.qaApproved, 'qaApproved')}
            {renderField('QA Approved By', data.qaApprovedBy, 'qaApprovedBy')}
            {renderField('QA Approved At', data.qaApprovedAt, 'qaApprovedAt')}
            {renderField('Created At', data.createdAt, 'createdAt')}
            {renderField('Updated At', data.updatedAt, 'updatedAt')}
          </div>
        </div>

      </div>

      {/* Extra/Dynamic Fields (Fallback) */}
      {extraEntries.length > 0 && (
        <div className="card p-5 border-t-2 border-t-purple-400 bg-white space-y-3.5 shadow-sm text-left">
          <div className="flex items-center gap-2 pb-2.5 border-b border-gray-100">
            <Activity size={15} className="text-purple-400" />
            <h4 className="font-black text-[#0F1A3A] text-xs uppercase tracking-wider">Additional Attributes</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 divide-gray-50">
            {extraEntries.map(([k, v]) => {
              const titleKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return (
                <div key={k} className="border-b border-gray-50 md:last:border-0">
                  {renderField(titleKey, v, k)}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );

};

const ResultBlock = ({ title, data }) => (
  <div className="mt-8 animate-fade-in">
    <div className="flex items-center justify-between mb-4 px-2">
       <h3 className="font-black text-[#0F1A3A] text-lg flex items-center gap-2"><CheckCircle size={20} className="text-green-500" /> {title}</h3>
    </div>
    <MedicalDocument data={data} />
  </div>
);

export default function DeIdentification() {
  const dispatch = useDispatch();
  const records = useSelector(selectRecords);
  const deidResult = useSelector(selectDeIdResult);
  const maskResult = useSelector(selectMaskResult);
  const anonResult = useSelector(selectAnonResult);
  const loading = useSelector(selectDeIdLoading);
  const error = useSelector(selectDeIdError);

  const [recordId, setRecordId] = useState('');
  const [maskStrategy, setMaskStrategy] = useState('FULL_HIPAA_18');
  const [anonMethod, setAnonMethod] = useState('GENERALIZATION');

  useEffect(() => { dispatch(fetchRecords({ page: 0, size: 20 })); return () => { dispatch(clearResults()); }; }, [dispatch]);

  const handleAction = (actionFn, params) => {
    if (!recordId.trim()) { dispatch(addToast({ type: 'error', message: 'Select a record first.' })); return; }
    dispatch(actionFn(params));
  };

  const hasResults = deidResult || maskResult || anonResult;

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Compliance & Privacy</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">Data <span className="text-brand-blue">Governance</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">De-identification and anonymization engine</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl border border-green-100 font-bold text-sm">
           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Core Active
        </div>
      </div>

      <div className="card p-6">
         <h2 className="text-lg font-black text-[#0F1A3A] mb-4">Select Source Record</h2>
         <div className="max-w-md space-y-2">
            <select value={recordId} onChange={e => setRecordId(e.target.value)} className="input py-2.5 text-sm">
               <option value="">-- Choose Patient Record --</option>
               {records.map(r => <option key={r.id} value={r.id}>{r.patientName || 'Unknown'} (ID: {r.id.substring(0,8)})</option>)}
            </select>
         </div>
         {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
               <AlertCircle size={16} /> <span className="font-bold">{error}</span>
            </div>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex flex-col hover:-translate-y-1 transition-transform">
           <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-brand-blue flex items-center justify-center mb-4">
              <FileSearch size={20} />
           </div>
           <h3 className="font-black text-[#0F1A3A] mb-2">De-identify</h3>
           <p className="text-sm text-[#8A97B0] mb-6 flex-1">Remove all 18 HIPAA identifiers while preserving clinical schema.</p>
           <button onClick={() => handleAction(fetchDeIdRecord, recordId.trim())} disabled={loading.deid || !recordId} className="btn-primary w-full justify-center py-2.5 text-sm">
              {loading.deid ? <RefreshCw className="animate-spin" size={16} /> : <FileSearch size={16} />} 
              {loading.deid ? 'Processing...' : 'Run De-identification'}
           </button>
        </div>

        <div className="card p-6 flex flex-col hover:-translate-y-1 transition-transform">
           <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <EyeOff size={20} />
           </div>
           <h3 className="font-black text-[#0F1A3A] mb-2">Mask Data</h3>
           <p className="text-sm text-[#8A97B0] mb-4">Targeted PHI redaction strategies.</p>
           <div className="mb-6 flex-1 space-y-1">
              <label className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Strategy</label>
              <select value={maskStrategy} onChange={e => setMaskStrategy(e.target.value)} className="input py-2 text-sm">
                 {MASKING_STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
           </div>
           <button onClick={() => handleAction(maskRecord, { recordId: recordId.trim(), maskingStrategy: maskStrategy })} disabled={loading.mask || !recordId} className="btn-primary bg-orange-500 hover:bg-orange-600 text-white w-full justify-center py-2.5 text-sm border-none shadow-orange-500/20">
              {loading.mask ? <RefreshCw className="animate-spin" size={16} /> : <EyeOff size={16} />} 
              {loading.mask ? 'Masking...' : 'Apply Mask'}
           </button>
        </div>

        <div className="card p-6 flex flex-col hover:-translate-y-1 transition-transform">
           <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
              <Shield size={20} />
           </div>
           <h3 className="font-black text-[#0F1A3A] mb-2">Anonymize</h3>
           <p className="text-sm text-[#8A97B0] mb-4">Statistical anonymization for research.</p>
           <div className="mb-6 flex-1 space-y-1">
              <label className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Method</label>
              <select value={anonMethod} onChange={e => setAnonMethod(e.target.value)} className="input py-2 text-sm">
                 {ANON_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
           </div>
           <button onClick={() => handleAction(anonymizeRecord, { recordId: recordId.trim(), anonymizationMethod: anonMethod })} disabled={loading.anonymize || !recordId} className="btn-primary bg-green-600 hover:bg-green-700 text-white w-full justify-center py-2.5 text-sm border-none shadow-green-600/20">
              {loading.anonymize ? <RefreshCw className="animate-spin" size={16} /> : <Shield size={16} />} 
              {loading.anonymize ? 'Synthesizing...' : 'Apply Anonymity'}
           </button>
        </div>
      </div>

      {hasResults && (
        <div className="pt-6 border-t border-[#F0F4FC]">
          {deidResult && <ResultBlock title="De-identified Record" data={deidResult} />}
          {maskResult && <ResultBlock title="Masked Record" data={maskResult} />}
          {anonResult && <ResultBlock title="Anonymized Record" data={anonResult} />}
        </div>
      )}
    </div>
  );
}
