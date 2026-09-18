import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
   ArrowLeft, ArrowRight, Save, ChevronRight, User, Activity, FilePlus2,
   CheckCircle2, Layers, AlertTriangle, Pill, ClipboardList,
   FlaskConical, Clock, Shield, Zap, Heart, Thermometer,
   Stethoscope, Syringe, Building, ChevronLeft, Fingerprint, Lock,
   RefreshCw, Search, Check, Mic, MicOff, Sparkles, Trash2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { createRecord, updateRecord, fetchIncidentTypes, selectIncidentTypes } from '../store/slices/epcrSlice';
import { fetchAllPatientHistory } from '../store/slices/patientHistorySlice';
import { fetchWorkflows, selectWorkflows } from '../store/slices/workflowSlice';
import DynamicFormRenderer from '../components/forms/DynamicFormRenderer';
import client from '../api/client';

const INCIDENT_TYPES = [
  'GENERAL',
  'EMERGENCY',
  'TRAUMA',
  'CARDIOLOGY',
  'RESPIRATORY',
  'NEUROLOGY',
  'OBSTETRIC',
  'PEDIATRIC',
  'BEHAVIORAL',
  'DENTIST',
  'ONCOLOGY',
  'RADIOLOGY',
  'ORTHOPEDIC',
  'DERMATOLOGY',
  'OPHTHALMOLOGY',
  'ENT',
  'GASTROENTEROLOGY',
  'UROLOGY',
  'NEPHROLOGY',
  'ENDOCRINOLOGY',
  'PSYCHIATRY',
  'GERIATRIC',
  'ALLERGY',
  'INFECTIOUS_DISEASE',
  'OTHER',
];
const TRANSPORT_MODES = ['ALS', 'BLS', 'CRITICAL_CARE', 'AIR', 'WATER', 'WHEELCHAIR', 'WALK_IN'];
const CARE_LEVELS = ['ALS', 'BLS', 'CCT', 'SCT', 'MFR', 'EMT', 'PARAMEDIC'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TRIAGE_TAGS = ['RED', 'YELLOW', 'GREEN', 'BLACK'];

const inputCls = 'w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all';
const inputReqCls = 'w-full bg-white border border-brand-blue/40 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all';
const labelCls = 'text-xs font-semibold text-slate-600 leading-none';
const labelReqCls = 'text-xs font-semibold text-slate-800 leading-none after:content-["*"] after:ml-0.5 after:text-brand-red';

const setNestedValue = (obj, path, value) => {
   const keys = path.split('.');
   let last = obj;
   for (let i = 0; i < keys.length - 1; i++) {
      last[keys[i]] = { ...last[keys[i]] };
      last = last[keys[i]];
   }
   last[keys[keys.length - 1]] = value;
};

const EXTRACTION_FIELD_MAPPINGS = {
   patientName: 'patientName',
   patientDateOfBirth: 'patientDateOfBirth',
   patientGender: 'patientGender',
   patientPhone: 'patientPhone',
   email: 'email',
   age: 'age',
   height: 'height',
   weight: 'weight',
   bloodGroup: 'bloodGroup',
   patientAddress: 'patientAddress',
   patientSSNLast4: 'patientSSNLast4',
   
   comorbidity: 'medicalHistory.comorbidity',
   currentMedicines: 'medicalHistory.currentMedicines',
   allergy: 'medicalHistory.allergy',
   doctor: 'medicalHistory.doctor',
   surgicalHistoryString: 'medicalHistory.surgicalHistoryString',
   primaryPhysicianName: 'medicalHistory.primaryPhysicianName',
   primaryPhysicianContact: 'medicalHistory.primaryPhysicianContact',
   primaryPhysicianFacility: 'medicalHistory.primaryPhysicianFacility',
   advanceDirectiveType: 'medicalHistory.advanceDirectiveType',
   pregnant: 'medicalHistory.pregnant',
   gestationalWeekIfPregnant: 'medicalHistory.gestationalWeekIfPregnant',
   dnrOnFile: 'medicalHistory.dnrOnFile',
   advanceDirective: 'medicalHistory.advanceDirective',
   smoker: 'medicalHistory.smoker',
   alcoholUse: 'medicalHistory.alcoholUse',
   substanceUse: 'medicalHistory.substanceUse',
   substanceUseDetails: 'medicalHistory.substanceUseDetails',
   lastKnownWellDateTime: 'medicalHistory.lastKnownWellDateTime',
   lastOralIntake: 'medicalHistory.lastOralIntake',

   incidentDateTime: 'incidentDateTime',
   incidentLocation: 'incidentLocation',
   incidentType: 'incidentType',
   incidentDescription: 'incidentDescription',

   sceneType: 'sceneAssessment.sceneType',
   numberOfPatients: 'sceneAssessment.numberOfPatients',
   mechanismOfInjury: 'sceneAssessment.mechanismOfInjury',
   injuryLocation: 'sceneAssessment.injuryLocation',
   sceneHazards: 'sceneAssessment.sceneHazards',
   weatherConditions: 'sceneAssessment.weatherConditions',
   lightingConditions: 'sceneAssessment.lightingConditions',
   patientAccessDifficulty: 'sceneAssessment.patientAccessDifficulty',
   triageTag: 'sceneAssessment.triageTag',
   sceneLatitude: 'sceneAssessment.geoLocation.latitude',
   sceneLongitude: 'sceneAssessment.geoLocation.longitude',
   sceneAltitude: 'sceneAssessment.geoLocation.altitude',
   sceneGeohash: 'sceneAssessment.geoLocation.geohash',
   sceneSafe: 'sceneAssessment.sceneSafe',
   traumaCall: 'sceneAssessment.traumaCall',
   massCasualtyIncident: 'sceneAssessment.massCasualtyIncident',
   witnessPresent: 'sceneAssessment.witnessPresent',
   witnessName: 'sceneAssessment.witnessName',
   witnessContact: 'sceneAssessment.witnessContact',
   bystanderCPRPerformed: 'sceneAssessment.bystanderCPRPerformed',
   aedUsedByBystander: 'sceneAssessment.aedUsedByBystander',

   callReceivedAt: 'timeline.callReceivedAt',
   dispatchedAt: 'timeline.dispatchedAt',
   enRouteAt: 'timeline.enRouteAt',
   arrivedSceneAt: 'timeline.arrivedSceneAt',
   patientContactAt: 'timeline.patientContactAt',
   departedSceneAt: 'timeline.departedSceneAt',
   arrivedDestinationAt: 'timeline.arrivedDestinationAt',
   transferOfCareAt: 'timeline.transferOfCareAt',
   unitAvailableAt: 'timeline.unitAvailableAt',

   systolicBp: 'systolicBp',
   diastolicBp: 'diastolicBp',
   pulseRate: 'pulseRate',
   heartRate: 'heartRate',
   respirationRate: 'respirationRate',
   spo2: 'spo2',
   temperature: 'temperature',
   bloodSugar: 'bloodSugar',
   glasgowComaScale: 'glasgowComaScale',
   hemoglobin: 'hemoglobin',
   complaints: 'complaints',

   mentalStatus: 'mentalStatus',
   ecgRhythm: 'ecgRhythm',
   pupilsResponse: 'pupilsResponse',
   skinCondition: 'skinCondition',
   primaryImpression: 'primaryImpression',
   secondaryImpression: 'secondaryImpression',
   diagnosis: 'diagnosis',
   treatmentProvided: 'treatmentProvided',
   treatmentPlan: 'treatmentPlan',
   clinicalTag: 'clinicalTag',
   airwayManaged: 'airwayManaged',
   diagnosticFindings: 'diagnosticFindings',
   proceduresPerformed: 'proceduresPerformed',
   medicationsAdministered: 'medicationsAdministered',

   destinationName: 'transport.destinationName',
   transportMode: 'transport.transportMode',
   careLevel: 'transport.careLevel',
   status: 'status',
   transportReason: 'transport.transportReason',
   refusalOfTransportReason: 'transport.refusalOfTransportReason',
   destinationFacilityId: 'transport.destinationFacilityId',
   destinationAddress: 'transport.destinationAddress',
   destinationType: 'transport.destinationType',
   receivingPhysicianName: 'transport.receivingPhysicianName',
   receivingNurseName: 'transport.receivingNurseName',
   patientConditionOnDeparture: 'transport.patientConditionOnDeparture',
   hospitalNotifiedAt: 'transport.hospitalNotifiedAt',
   hospitalNotified: 'transport.hospitalNotified',
   continuedCPRDuringTransport: 'transport.continuedCPRDuringTransport',
   aedUsedDuringTransport: 'transport.aedUsedDuringTransport',
   destLatitude: 'transport.destinationGeoLocation.latitude',
   destLongitude: 'transport.destinationGeoLocation.longitude',
   destAltitude: 'transport.destinationGeoLocation.altitude',
   destGeohash: 'transport.destinationGeoLocation.geohash',
   handoffReport: 'transport.handoffReport',
   patientConditionOnArrival: 'transport.patientConditionOnArrival',

   consentType: 'consent.consentType',
   patientConsentObtained: 'consent.patientConsentObtained',
   patientInformedOfRisks: 'consent.patientInformedOfRisks',
   patientHasDecisionCapacity: 'consent.patientHasDecisionCapacity',
   refusalOfCare: 'consent.refusalOfCare',
   refusalReason: 'consent.refusalReason',
   refusalWitnessed: 'consent.refusalWitnessed',
   witnessName: 'consent.witnessName',
   witnessContact: 'consent.witnessContact',
   capacityAssessmentNotes: 'consent.capacityAssessmentNotes',
   guardianConsentObtained: 'consent.guardianConsentObtained',
   guardianName: 'consent.guardianName',
   guardianRelationship: 'consent.guardianRelationship',
   guardianPhone: 'consent.guardianPhone',
   patientSignatureAttachmentId: 'consent.patientSignatureAttachmentId',
   guardianSignatureAttachmentId: 'consent.guardianSignatureAttachmentId',
   crewSignatureAttachmentId: 'consent.crewSignatureAttachmentId'
};

const CreateRecord = ({ isEditMode = false, existingData = null }) => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const { t, lang } = useLanguage();
   const [searchParams] = useSearchParams();
   const recordId = searchParams.get('id');
   const prefilledPatientId = searchParams.get('patientId');
   const user = useSelector(selectUser);
   const [currentStep, setCurrentStep] = useState(1);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState('');
   const [fieldErrors, setFieldErrors] = useState({});
   const [idempotencyKey, setIdempotencyKey] = useState(() => {
      return self.crypto?.randomUUID ? self.crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36));
   });

   const workflows = useSelector(selectWorkflows);
   const [selectedWorkflow, setSelectedWorkflow] = useState(null);
   const [dynamicFormResponses, setDynamicFormResponses] = useState({});
   const backendIncidentTypes = useSelector(selectIncidentTypes);
   const incidentTypesOptions = backendIncidentTypes && backendIncidentTypes.length > 0
      ? backendIncidentTypes
      : INCIDENT_TYPES;

   const [patientMode, setPatientMode] = useState(prefilledPatientId ? 'existing' : 'new');
   const [searchPhone, setSearchPhone] = useState('');
   const [searchResults, setSearchResults] = useState([]);
   const [isSearching, setIsSearching] = useState(false);

   // Voice filling states
   const [isListening, setIsListening] = useState(false);
   const [recognition, setRecognition] = useState(null);
   const [voiceTranscript, setVoiceTranscript] = useState('');
   const [isProcessingVoice, setIsProcessingVoice] = useState(false);
   const [aiMetadata, setAiMetadata] = useState({}); // { [fieldName]: { type: 'filled' | 'suggestion', value, confidence } }
   const [voiceFilledFields, setVoiceFilledFields] = useState([]);
   const [showVoicePanel, setShowVoicePanel] = useState(false);
   const [voiceTranscriptId, setVoiceTranscriptId] = useState(null);
   const voiceBaseTextRef = useRef('');

   const [formData, setFormData] = useState({
      // Patient
      patientId: prefilledPatientId || '',
      patientName: '',
      patientPhotoUrl: '',
      patientDateOfBirth: '',
      patientGender: '',
      patientPhone: '',
      patientAddress: '',
      patientSSNLast4: '',
      email: '',
      age: '',
      height: '',
      weight: '',
      bloodGroup: '',
      // Medical History (Nested)
      medicalHistory: {
         pastConditions: [],
         currentMedications: [],
         allergies: [],
         surgicalHistory: [],
         comorbidity: '',
         currentMedicines: '',
         allergy: '',
         doctor: '',
         surgicalHistoryString: '',
         dnrOnFile: false,
         advanceDirective: false,
         advanceDirectiveType: '',
         primaryPhysicianName: '',
         primaryPhysicianContact: '',
         primaryPhysicianFacility: '',
         smoker: false,
         alcoholUse: false,
         substanceUse: false,
         substanceUseDetails: '',
         pregnant: false,
         gestationalWeekIfPregnant: null,
         lastKnownWellDateTime: null,
         lastOralIntake: null,
         notes: [],
      },
      // Incident
      incidentDateTime: '',
      incidentLocation: '',
      incidentDescription: '',
      incidentType: '',
      incidentNumber: '',
      // Scene Assessment (Nested)
      sceneAssessment: {
         sceneType: '',
         sceneSafe: true,
         sceneHazards: '',
         traumaCall: false,
         mechanismOfInjury: '',
         injuryLocation: '',
         numberOfPatients: 1,
         massCasualtyIncident: false,
         triageTag: '',
         weatherConditions: '',
         lightingConditions: '',
         witnessPresent: false,
         witnessName: '',
         witnessContact: '',
         bystanderCPRPerformed: false,
         aedUsedByBystander: false,
         patientAccessDifficulty: '',
         geoLocation: {
            latitude: null,
            longitude: null,
            altitude: null,
            geohash: ''
         }
      },
      // Timeline (Nested)
      timeline: {
         callReceivedAt: null,
         dispatchedAt: null,
         enRouteAt: null,
         arrivedSceneAt: null,
         patientContactAt: null,
         departedSceneAt: null,
         arrivedDestinationAt: null,
         transferOfCareAt: null,
         unitAvailableAt: null,
      },
      // Vitals & Clinical
      systolicBp: '',
      diastolicBp: '',
      pulseRate: '',
      respirationRate: '',
      spo2: '',
      temperature: '',
      bloodSugar: '',
      hemoglobin: '',
      heartRate: '',
      glasgowComaScale: '',
      mentalStatus: '',
      primaryImpression: '',
      secondaryImpression: '',
      diagnosis: '',
      treatmentProvided: '',
      treatmentPlan: '',
      dietAdvice: [],
      notes: [],
      // Complaints
      complaints: [],
      structuredComplaints: [],
      // Arrays
      crew: [],
      vitals: [],
      structuredVitals: [],
      medicationsAdministered: [],
      proceduresPerformed: [],
      structuredMedications: [],
      structuredProcedures: [],
      // Transport (Nested)
      transport: {
         transportMode: '',
         transportReason: '',
         refusalOfTransportReason: '',
         destinationFacilityId: '',
         destinationName: '',
         destinationAddress: '',
         destinationType: 'HOSPITAL',
         destinationGeoLocation: {
            latitude: null,
            longitude: null,
            altitude: null,
            geohash: ''
         },
         receivingPhysicianName: '',
         receivingNurseName: '',
         handoffReport: '',
         hospitalNotified: false,
         hospitalNotifiedAt: null,
         patientConditionOnDeparture: 'STABLE',
         patientConditionOnArrival: 'STABLE',
         careLevel: 'STABLE',
         continuedCPRDuringTransport: false,
         aedUsedDuringTransport: false
      },
      // Consent (Nested)
      consent: {
         patientConsentObtained: true,
         consentType: 'VERBAL',
         refusalOfCare: false,
         refusalReason: '',
         refusalWitnessed: false,
         witnessName: '',
         witnessContact: '',
         patientInformedOfRisks: true,
         patientHasDecisionCapacity: true,
         capacityAssessmentNotes: '',
         guardianConsentObtained: false,
         guardianName: '',
         guardianRelationship: '',
         guardianPhone: '',
         patientSignatureAttachmentId: '',
         guardianSignatureAttachmentId: '',
         crewSignatureAttachmentId: '',
      },
      // Meta
      status: 'PENDING',
      paramedicsId: user?.id || '',
      organizationId: user?.organizationId || '',
      clinicalTag: '',
   });

   const [doctorsList, setDoctorsList] = useState([]);

   useEffect(() => {
      dispatch(fetchWorkflows());
      dispatch(fetchIncidentTypes());

      const parseUsers = (res) => {
         if (!res) return [];
         let d = res.data !== undefined ? res.data : res;
         if (Array.isArray(d)) return d;
         if (d?.content && Array.isArray(d.content)) return d.content;
         if (d?.data && Array.isArray(d.data)) return d.data;
         if (d?.items && Array.isArray(d.items)) return d.items;
         return [];
      };

      const filterDocs = (list, userOrg) => {
         if (!Array.isArray(list) || list.length === 0) return [];
         
         // 1. Identify all physicians / doctors / admins across all returned users
         const allPhysicians = list.filter(u => {
            const roleStr = (String(u.role || '') + ' ' + JSON.stringify(u.role || '') + ' ' + String(u.roles || '')).toUpperCase();
            const nameStr = (String(u.firstName || '') + ' ' + String(u.lastName || '')).toLowerCase();
            return roleStr.includes('PHYSICIAN') || roleStr.includes('DOCTOR') || roleStr.includes('ADMIN') || nameStr.startsWith('dr') || nameStr.includes('doctor');
         });

         const pool = allPhysicians.length > 0 ? allPhysicians : list;

         // 2. Try matching dynamically by active organization
         const userOrgClean = String(userOrg || '').trim().toLowerCase();
         if (userOrgClean) {
            const orgMatched = pool.filter(u => {
               const uOrg = String(u.organizationId || u.orgId || u.organization?.id || u.organization || u.organizationName || '').trim().toLowerCase();
               return !uOrg || uOrg === userOrgClean || userOrgClean.includes(uOrg) || uOrg.includes(userOrgClean);
            });
            if (orgMatched.length > 0) return orgMatched;
         }

         // 3. Always fallback to all available doctors so dropdown is never empty
         return pool;
      };

      const loadDoctors = async () => {
         const userOrg = user?.organizationId || user?.orgId || user?.organization?.id || user?.organization;
         
         try {
            const [resGeneral, resOrg] = await Promise.all([
               client.get('/api/users?size=500', { hideToast: true }).catch(() => null),
               userOrg ? client.get(`/api/users/organization/${userOrg}?size=500`, { hideToast: true }).catch(() => null) : Promise.resolve(null)
            ]);

            const listGen = parseUsers(resGeneral);
            const listOrg = parseUsers(resOrg);
            const combined = [...listGen, ...listOrg];

            const mergedMap = new Map();
            combined.forEach(u => {
               if (u) {
                  const key = u.id || u._id || u.email || u.phone || (u.firstName + '_' + u.lastName);
                  if (key) mergedMap.set(key, u);
               }
            });

            const uniqueList = Array.from(mergedMap.values());
            setDoctorsList(filterDocs(uniqueList, userOrg));
         } catch (e) {
            console.error('Failed to load doctors list:', e);
         }
      };

      loadDoctors();
   }, [dispatch, user?.organizationId, user?.id]);

   // Initialize Web Speech API
   useEffect(() => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
         const rec = new SpeechRecognition();
         rec.continuous = true;
         rec.interimResults = true;
         rec.lang = navigator.language || 'en-US';

         rec.onresult = (event) => {
            const currentText = Array.from(event.results)
               .map(r => r[0].transcript)
               .join(' ');
            const baseText = voiceBaseTextRef.current ? voiceBaseTextRef.current.trim() : '';
            setVoiceTranscript(baseText ? `${baseText} ${currentText}` : currentText);
         };

         rec.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
               dispatch(addToast({ type: 'error', message: 'Microphone permission denied.' }));
               setIsListening(false);
            }
         };

         rec.onend = () => {
            setIsListening(false);
         };

         setRecognition(rec);
      }
   }, [dispatch]);

   const toggleListening = () => {
      if (!recognition) {
         dispatch(addToast({ type: 'error', message: 'Web Speech API is not supported in this browser. Please use Chrome or Edge.' }));
         return;
      }

      if (isListening) {
         recognition.stop();
         setIsListening(false);
      } else {
         voiceBaseTextRef.current = voiceTranscript;
         try {
            recognition.start();
            setIsListening(true);
            setShowVoicePanel(true);
         } catch (e) {
            console.error('Failed to start recognition', e);
         }
      }
   };

    const processVoiceTranscript = async () => {
       if (!voiceTranscript.trim()) {
          dispatch(addToast({ type: 'warning', message: 'Please speak or record some text first.' }));
          return;
       }
 
       setIsProcessingVoice(true);
       if (isListening && recognition) {
          recognition.stop();
          setIsListening(false);
       }
 
       try {
          const { data } = await client.post('/api/ai/voice/extract-epcr-fields', {
             transcript: voiceTranscript,
             recordId: recordId || null
          });
 
          const CONFIDENCE_THRESHOLD = 0.80;
          const updatedFields = [];
          const newAiMetadata = { ...aiMetadata };
          const nextFormData = { ...formData };
 
          if (data.voiceTranscriptId) {
             setVoiceTranscriptId(data.voiceTranscriptId);
          }
 
          Object.keys(EXTRACTION_FIELD_MAPPINGS).forEach(apiKey => {
             const extraction = data[apiKey];
             if (!extraction || extraction.value === null || extraction.value === undefined) return;
 
             const { value, confidence } = extraction;
             const targetPath = EXTRACTION_FIELD_MAPPINGS[apiKey];
 
             const applyToField = (fieldPath, val, conf) => {
                if (conf >= CONFIDENCE_THRESHOLD) {
                   let mappedVal = val;
                   if (fieldPath === 'complaints' || fieldPath === 'medicationsAdministered' || fieldPath === 'proceduresPerformed') {
                      mappedVal = Array.isArray(val) ? val.join('\n') : String(val);
                   }
                   setNestedValue(nextFormData, fieldPath, mappedVal);
                   newAiMetadata[fieldPath] = {
                      status: 'filled',
                      value: mappedVal,
                      confidence: conf
                   };
                   updatedFields.push(fieldPath);
                } else {
                   newAiMetadata[fieldPath] = {
                      status: 'suggestion',
                      value: val,
                      confidence: conf
                   };
                }
             };
 
             applyToField(targetPath, value, confidence);
             if (apiKey === 'heartRate') {
                applyToField('pulseRate', value, confidence);
             }
          });
 
          setFormData(nextFormData);
          setAiMetadata(newAiMetadata);
          setVoiceFilledFields(prev => Array.from(new Set([...prev, ...updatedFields])));
          dispatch(addToast({ type: 'success', message: `Voice extraction completed. Auto-filled ${updatedFields.length} fields.` }));
       } catch (err) {
          console.error('Error extracting fields from voice transcript', err);
          dispatch(addToast({ type: 'error', message: 'Failed to analyze transcript.' }));
       } finally {
          setIsProcessingVoice(false);
       }
    };
 
    const acceptAiSuggestion = (fieldName) => {
       const fieldInfo = aiMetadata[fieldName];
       if (!fieldInfo) return;
 
       setFormData(prev => {
          const next = { ...prev };
          let val = fieldInfo.value;
          if (fieldName === 'complaints' || fieldName === 'medicationsAdministered' || fieldName === 'proceduresPerformed') {
             val = Array.isArray(fieldInfo.value) ? fieldInfo.value.join('\n') : String(fieldInfo.value);
          }
          setNestedValue(next, fieldName, val);
          return next;
       });
 
       setAiMetadata(prev => {
          const next = { ...prev };
          next[fieldName] = {
             ...fieldInfo,
             status: 'filled'
          };
          return next;
       });
 
       setVoiceFilledFields(prev => Array.from(new Set([...prev, fieldName])));
       dispatch(addToast({ type: 'success', message: `Accepted suggestion for ${fieldName}.` }));
    };

   const dismissAiInfo = (fieldName) => {
      setAiMetadata(prev => {
         const next = { ...prev };
         delete next[fieldName];
         return next;
      });
      setVoiceFilledFields(prev => prev.filter(f => f !== fieldName));
   };

   const clearAllAiFlags = () => {
      setAiMetadata({});
      setVoiceFilledFields([]);
      setVoiceTranscriptId(null);
      dispatch(addToast({ type: 'info', message: 'All AI highlights cleared.' }));
   };

   useEffect(() => {
      const fetchRecord = async () => {
         if (!recordId) return;
         if (recordId.startsWith('temp-')) {
            try {
               const { getOfflineDrafts } = await import('../utils/offlineEpcr');
               const offlineDraftsMap = getOfflineDrafts();
               const data = offlineDraftsMap[recordId];
               if (data) {
                  setFormData(prev => ({
                     ...prev,
                     ...data,
                     medicalHistory: { ...prev.medicalHistory, ...(data.medicalHistory || {}) },
                     sceneAssessment: { ...prev.sceneAssessment, ...(data.sceneAssessment || {}) },
                     timeline: { ...prev.timeline, ...(data.timeline || {}) },
                     transport: { ...prev.transport, ...(data.transport || {}) },
                     consent: { ...prev.consent, ...(data.consent || {}) },
                     complaints: Array.isArray(data.complaints) ? data.complaints.join('\n') : (data.complaints || ''),
                     vitals: Array.isArray(data.vitals) ? data.vitals.join('\n') : (data.vitals || ''),
                     proceduresPerformed: Array.isArray(data.proceduresPerformed) ? data.proceduresPerformed.join('\n') : (data.proceduresPerformed || ''),
                     medicationsAdministered: Array.isArray(data.medicationsAdministered) ? data.medicationsAdministered.join('\n') : (data.medicationsAdministered || ''),
                     dietAdvice: Array.isArray(data.dietAdvice) ? data.dietAdvice : [],
                     notes: Array.isArray(data.notes) ? data.notes : [],
                  }));
                  if (data.dynamicFormResponses) {
                     setDynamicFormResponses(data.dynamicFormResponses);
                  }
               }
            } catch (err) {
               console.error('Failed to load local offline draft', err);
            }
            return;
         }
         try {
            const { data } = await client.get(`/api/epcr/records/${recordId}`);
            setFormData(prev => ({
               ...prev,
               ...data,
               medicalHistory: { ...prev.medicalHistory, ...(data.medicalHistory || {}) },
               sceneAssessment: { ...prev.sceneAssessment, ...(data.sceneAssessment || {}) },
               timeline: { ...prev.timeline, ...(data.timeline || {}) },
               transport: { ...prev.transport, ...(data.transport || {}) },
               consent: { ...prev.consent, ...(data.consent || {}) },
               complaints: data.complaints?.length ? data.complaints.join('\n') : '',
               vitals: data.vitals?.length ? data.vitals.join('\n') : '',
               proceduresPerformed: data.proceduresPerformed?.length ? data.proceduresPerformed.join('\n') : '',
               medicationsAdministered: data.medicationsAdministered?.length ? data.medicationsAdministered.join('\n') : '',
               dietAdvice: Array.isArray(data.dietAdvice) ? data.dietAdvice : [],
               notes: Array.isArray(data.notes) ? data.notes : [],
            }));
            if (data.dynamicFormResponses) {
               setDynamicFormResponses(data.dynamicFormResponses);
            }
         } catch (err) {
            dispatch(addToast({ type: 'error', message: 'Failed to load record details' }));
         }
      };
      fetchRecord();
   }, [recordId, dispatch]);

   const handlePatientSearch = async () => {
      if (!searchPhone) return;
      setIsSearching(true);
      try {
         const { data } = await client.get("/api/admin/patients/search", { params: { phone: searchPhone } });
         setSearchResults(Array.isArray(data) ? data : (data.content || []));
         if ((!data || data.length === 0) && !data.content?.length) {
            dispatch(addToast({ type: 'info', message: 'No patient found with that phone number.' }));
         }
      } catch (err) {
         dispatch(addToast({ type: 'error', message: 'Failed to search patients.' }));
      } finally {
         setIsSearching(false);
      }
   };

   const selectExistingPatient = (pat) => {
      const patMh = pat.medicalHistory || {};
      setFormData(prev => ({
         ...prev,
         patientId: pat.patientId || pat.id,
         patientName: pat.patientName ?? pat.displayName ?? pat.name ?? `${pat.firstName || ''} ${pat.lastName || ''}`.trim(),
         patientDateOfBirth: pat.patientDateOfBirth ?? pat.dateOfBirth ?? pat.dob ?? '',
         patientGender: pat.patientGender ?? pat.gender ?? '',
         patientPhone: pat.patientPhone ?? pat.phone ?? pat.phoneNumber ?? searchPhone,
         email: pat.patientEmail ?? pat.email ?? '',
         age: pat.patientAge ?? pat.age ?? '',
         bloodGroup: pat.patientBloodGroup ?? pat.bloodGroup ?? '',
         height: pat.patientHeight ?? pat.height ?? '',
         weight: pat.patientWeight ?? pat.weight ?? '',
         patientAddress: pat.patientAddress ?? pat.address ?? '',
         patientSSNLast4: pat.patientSSNLast4 ?? pat.ssnLast4 ?? '',
         spo2: pat.patientSpo2 ?? pat.spo2 ?? '',
         respirationRate: pat.patientRespirationRate ?? pat.respirationRate ?? '',
         bloodSugar: pat.patientBloodSugar ?? pat.bloodSugar ?? '',
         heartRate: pat.patientHeartRate ?? pat.heartRate ?? '',
         diastolicBp: pat.patientDiastolicBp ?? pat.diastolicBp ?? '',
         systolicBp: pat.patientSystolicBp ?? pat.systolicBp ?? '',
         pulseRate: pat.patientPulseRate ?? pat.pulseRate ?? '',
         temperature: pat.patientTemperature ?? pat.temperature ?? pat.temperaturehemoglobin ?? '',
         hemoglobin: pat.patientHemoglobin ?? pat.hemoglobin ?? '',
         medicalHistory: {
            ...prev.medicalHistory,
            ...patMh,
            comorbidity: pat.patientComorbidity ?? pat.comorbidity ?? patMh.comorbidity ?? prev.medicalHistory.comorbidity ?? '',
            allergy: pat.patientAllergy ?? pat.allergy ?? patMh.allergy ?? prev.medicalHistory.allergy ?? '',
            doctor: pat.patientDoctor ?? pat.doctor ?? patMh.doctor ?? prev.medicalHistory.doctor ?? '',
            currentMedicines: pat.patientCurrentMedicines ?? pat.currentMedicines ?? patMh.currentMedicines ?? prev.medicalHistory.currentMedicines ?? '',
            notes: Array.isArray(patMh.notes) ? patMh.notes : prev.medicalHistory.notes,
         }
      }));
      setSearchResults([]);
      dispatch(addToast({ type: 'success', message: 'Patient linked successfully.' }));
   };

   const handleUnlinkPatient = () => {
      setFormData(prev => ({
         ...prev,
         patientId: '',
         patientName: '',
         patientDateOfBirth: '',
         patientGender: '',
         patientPhone: '',
         email: '',
         age: '',
         bloodGroup: '',
         height: '',
         weight: '',
         patientAddress: '',
         patientSSNLast4: '',
         spo2: '',
         respirationRate: '',
         bloodSugar: '',
         heartRate: '',
         diastolicBp: '',
         systolicBp: '',
         pulseRate: '',
         temperature: '',
         hemoglobin: '',
         medicalHistory: {
            ...prev.medicalHistory,
            pastConditions: [],
            currentMedications: [],
            allergies: [],
            surgicalHistory: [],
            comorbidity: '',
            currentMedicines: '',
            allergy: '',
            doctor: '',
            surgicalHistoryString: '',
            dnrOnFile: false,
            advanceDirective: false,
            advanceDirectiveType: '',
            primaryPhysicianName: '',
            primaryPhysicianContact: '',
            primaryPhysicianFacility: '',
            smoker: false,
            alcoholUse: false,
            substanceUse: false,
            substanceUseDetails: '',
            pregnant: false,
            gestationalWeekIfPregnant: null,
            lastKnownWellDateTime: null,
            lastOralIntake: null,
            notes: [],
         }
      }));
      setSearchPhone('');
   };

   const updateField = (path, value) => {
      setFormData(prev => {
         const newFormData = { ...prev };
         const keys = path.split('.');
         let last = newFormData;
         for (let i = 0; i < keys.length - 1; i++) {
            last[keys[i]] = { ...last[keys[i]] };
            last = last[keys[i]];
         }
         last[keys[keys.length - 1]] = value;
         return newFormData;
      });

      if (fieldErrors[path]) {
         const newErrors = { ...fieldErrors };
         delete newErrors[path];
         setFieldErrors(newErrors);
      }
   };

   const validateStep = (step) => {
      const errors = {};
      if (step === 1) {
         if (!formData.patientId) {
            if (!formData.patientName) errors.patientName = 'Name Required';
            if (!formData.patientDateOfBirth) errors.patientDateOfBirth = 'DOB Required';
            if (!formData.patientGender) errors.patientGender = 'Gender Required';
         }
      }
      if (step === 2) {
         if (!formData.incidentDateTime) errors.incidentDateTime = 'Timestamp Required';
         if (!formData.incidentLocation) errors.incidentLocation = 'Location Required';
         if (!formData.incidentType) errors.incidentType = 'Classification Required';
      }
      if (step === 4) {
         if (!formData.transport.destinationName) errors['transport.destinationName'] = 'Target Required';
         if (!formData.transport.transportMode) errors['transport.transportMode'] = 'Mode Required';
      }

      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
   };

   const handleNext = () => {
      if (validateStep(currentStep)) {
         setCurrentStep(s => s + 1);
         window.scrollTo(0, 0);
      } else {
         dispatch(addToast({ type: 'error', message: 'Please fulfill all required parameters.' }));
      }
   };

   const handleWorkflowChange = (wfId) => {
      const wf = workflows.find(w => w.id === wfId);
      setSelectedWorkflow(wf);
   };

   const buildApiPayload = (data, dynamicData) => {
      const toArr = (v) => {
         if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && x !== '');
         if (typeof v === 'string' && v.trim()) return [v.trim()];
         return [];
      };
      const toIso = (v) => {
         if (!v) return null;
         const s = String(v).trim();
         return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00` : (s || null);
      };
      const cv = (v) => (v === '' || v === null || v === undefined) ? null : (typeof v === 'string' ? v.trim() || null : v);
      const toNum = (v) => (v !== '' && v !== null && v !== undefined) ? (Number(v) || null) : null;

      const mh = data.medicalHistory || {};
      const { comorbidity = '', currentMedicines = '', allergy = '', doctor = '',
         surgicalHistoryString = '', pastConditions = [], currentMedications = [],
         allergies = [], surgicalHistory = [], dnrOnFile, advanceDirective,
         advanceDirectiveType, primaryPhysicianName, primaryPhysicianContact,
         primaryPhysicianFacility, smoker, alcoholUse, substanceUse, substanceUseDetails,
         pregnant, gestationalWeekIfPregnant, lastKnownWellDateTime, lastOralIntake } = mh;

      const sa = data.sceneAssessment || {};
      const tl = data.timeline || {};
      const tr = data.transport || {};
      const cn = data.consent || {};
      const clinicalVitals = {
         treatmentPhase: 'PRE',
         vitalPhase: 'PRE',
         recordedAt: toIso(data.incidentDateTime) || new Date().toISOString(),
         systolicBP: toNum(data.systolicBp),
         diastolicBP: toNum(data.diastolicBp),
         heartRate: toNum(data.heartRate) || toNum(data.pulseRate),
         pulseRate: toNum(data.pulseRate),
         respiratoryRate: toNum(data.respirationRate),
         oxygenSaturation: toNum(data.spo2),
         temperature: toNum(data.temperature),
         bloodGlucose: toNum(data.bloodSugar),
         hemoglobin: toNum(data.hemoglobin),
         glasgowComaScale: toNum(data.glasgowComaScale),
         mentalStatus: cv(data.mentalStatus) || '',
      };
      const hasClinicalVitals = Object.entries(clinicalVitals).some(([key, value]) => !['treatmentPhase', 'vitalPhase', 'recordedAt'].includes(key) && value !== null && value !== '');

      return {
         patientId: cv(data.patientId) || '',
         patientName: cv(data.patientName) || '',
         patientPhotoUrl: data.patientPhotoUrl || '',
         patientDateOfBirth: data.patientDateOfBirth || null,
         patientGender: cv(data.patientGender) || '',
         patientPhone: data.patientPhone ? String(data.patientPhone).replace(/[^\d+]/g, '') : '',
         patientAddress: cv(data.patientAddress) || '',
         patientSSNLast4: data.patientSSNLast4 || '',
         email: cv(data.email) || '',
         age: toNum(data.age),
         height: toNum(data.height),
         weight: toNum(data.weight),
         bloodGroup: cv(data.bloodGroup) || '',
         // Top-level legacy fields
         comorbidity: cv(comorbidity) || '',
         allergy: cv(allergy) || '',
         doctor: cv(doctor) || '',
         currentMedicines: cv(currentMedicines) || '',
         // Vitals
         systolicBp: toNum(data.systolicBp),
         diastolicBp: toNum(data.diastolicBp),
         pulseRate: toNum(data.pulseRate),
         heartRate: toNum(data.heartRate),
         respirationRate: toNum(data.respirationRate),
         spo2: toNum(data.spo2),
         temperature: toNum(data.temperature),
         bloodSugar: toNum(data.bloodSugar),
         hemoglobin: toNum(data.hemoglobin),
         // Patient-history friendly aliases
         systolicBP: clinicalVitals.systolicBP,
         diastolicBP: clinicalVitals.diastolicBP,
         respiratoryRate: clinicalVitals.respiratoryRate,
         oxygenSaturation: clinicalVitals.oxygenSaturation,
         bloodGlucose: clinicalVitals.bloodGlucose,
         glasgowComaScale: clinicalVitals.glasgowComaScale,
         // Clinical
         primaryImpression: cv(data.primaryImpression) || '',
         secondaryImpression: cv(data.secondaryImpression) || '',
         diagnosis: cv(data.diagnosis) || '',
         treatmentProvided: cv(data.treatmentProvided) || '',
         treatmentPlan: cv(data.treatmentPlan) || '',
         mentalStatus: cv(data.mentalStatus) || '',
         ecgRhythm: cv(data.ecgRhythm) || '',
         pupilsResponse: cv(data.pupilsResponse) || '',
         skinCondition: cv(data.skinCondition) || '',
         airwayManaged: data.airwayManaged ?? false,
         diagnosticFindings: cv(data.diagnosticFindings) || '',
         // Incident
         incidentDateTime: toIso(data.incidentDateTime),
         incidentLocation: cv(data.incidentLocation) || '',
         incidentDescription: cv(data.incidentDescription) || '',
         incidentType: cv(data.incidentType) || '',
         // Arrays (textarea → array)
         complaints: toArr(data.complaints),
         vitals: toArr(data.vitals),
         medicationsAdministered: toArr(data.medicationsAdministered),
         proceduresPerformed: toArr(data.proceduresPerformed),
         crew: data.crew || [],
         structuredComplaints: (data.structuredComplaints || []).map(sc => ({
            ...sc,
            onsetTime: toIso(sc.onsetTime),
            severity: toNum(sc.severity)
         })),
         structuredVitals: data.structuredVitals?.length ? data.structuredVitals.map(sv => ({
            ...sv,
            recordedAt: toIso(sv.recordedAt),
            heartRate: toNum(sv.heartRate),
            systolicBP: toNum(sv.systolicBP),
            diastolicBP: toNum(sv.diastolicBP),
            respiratoryRate: toNum(sv.respiratoryRate),
            oxygenSaturation: toNum(sv.oxygenSaturation),
            temperature: toNum(sv.temperature),
            glasgowComaScale: toNum(sv.glasgowComaScale),
            gcEye: toNum(sv.gcEye),
            gcVerbal: toNum(sv.gcVerbal),
            gcMotor: toNum(sv.gcMotor),
            painScore: toNum(sv.painScore),
            bloodGlucose: toNum(sv.bloodGlucose)
         })) : (hasClinicalVitals ? [clinicalVitals] : []),
         structuredMedications: (data.structuredMedications || []).map(sm => ({
            ...sm,
            dosage: toNum(sm.dosage),
            administrationAttempts: toNum(sm.administrationAttempts),
            administeredAt: toIso(sm.administeredAt)
         })),
         structuredProcedures: (data.structuredProcedures || []).map(sp => ({
            ...sp,
            attempts: toNum(sp.attempts),
            performedAt: toIso(sp.performedAt)
         })),
         // Transport-derived top-level
         transportMode: cv(tr.transportMode) || '',
         transportDestination: cv(tr.destinationName) || '',
         careLevel: cv(tr.careLevel) || '',
         // Nested: medicalHistory (API-clean, no frontend-only fields)
         medicalHistory: {
            pastConditions: pastConditions.length ? pastConditions : (comorbidity ? [comorbidity] : []),
            currentMedications: currentMedications.length ? currentMedications : (currentMedicines ? [currentMedicines] : []),
            allergies: allergies.length ? allergies : (allergy ? [allergy] : []),
            surgicalHistory: surgicalHistory.length ? surgicalHistory : (surgicalHistoryString ? [surgicalHistoryString] : []),
            dnrOnFile: dnrOnFile ?? false,
            advanceDirective: advanceDirective ?? false,
            advanceDirectiveType: cv(advanceDirectiveType) || '',
            primaryPhysicianName: cv(primaryPhysicianName) || '',
            primaryPhysicianContact: primaryPhysicianContact || '',
            primaryPhysicianFacility: cv(primaryPhysicianFacility) || '',
            smoker: smoker ?? false,
            alcoholUse: alcoholUse ?? false,
            substanceUse: substanceUse ?? false,
            substanceUseDetails: cv(substanceUseDetails) || '',
            pregnant: pregnant ?? false,
            gestationalWeekIfPregnant: gestationalWeekIfPregnant ? Number(gestationalWeekIfPregnant) : null,
            lastKnownWellDateTime: toIso(lastKnownWellDateTime),
            lastOralIntake: toIso(lastOralIntake),
            notes: toArr(mh.notes),
         },
         // Nested: sceneAssessment
         sceneAssessment: {
            sceneType: cv(sa.sceneType) || '',
            sceneSafe: sa.sceneSafe ?? true,
            sceneHazards: cv(sa.sceneHazards) || '',
            traumaCall: sa.traumaCall ?? false,
            mechanismOfInjury: cv(sa.mechanismOfInjury) || '',
            injuryLocation: cv(sa.injuryLocation) || '',
            numberOfPatients: toNum(sa.numberOfPatients) || 1,
            massCasualtyIncident: sa.massCasualtyIncident ?? false,
            triageTag: cv(sa.triageTag) || '',
            weatherConditions: cv(sa.weatherConditions) || '',
            lightingConditions: cv(sa.lightingConditions) || '',
            witnessPresent: sa.witnessPresent ?? false,
            witnessName: cv(sa.witnessName) || '',
            witnessContact: sa.witnessContact || '',
            bystanderCPRPerformed: sa.bystanderCPRPerformed ?? false,
            aedUsedByBystander: sa.aedUsedByBystander ?? false,
            patientAccessDifficulty: cv(sa.patientAccessDifficulty) || '',
            geoLocation: (sa.geoLocation?.latitude || sa.geoLocation?.longitude) ? {
               latitude: toNum(sa.geoLocation.latitude),
               longitude: toNum(sa.geoLocation.longitude),
               altitude: toNum(sa.geoLocation.altitude),
               geohash: cv(sa.geoLocation.geohash) || ''
            } : null,
         },
         // Nested: timeline
         timeline: {
            callReceivedAt: toIso(tl.callReceivedAt),
            dispatchedAt: toIso(tl.dispatchedAt),
            enRouteAt: toIso(tl.enRouteAt),
            arrivedSceneAt: toIso(tl.arrivedSceneAt),
            patientContactAt: toIso(tl.patientContactAt),
            departedSceneAt: toIso(tl.departedSceneAt),
            arrivedDestinationAt: toIso(tl.arrivedDestinationAt),
            transferOfCareAt: toIso(tl.transferOfCareAt),
            unitAvailableAt: toIso(tl.unitAvailableAt),
         },
         // Nested: transport
         transport: {
            transportMode: cv(tr.transportMode) || '',
            transportReason: cv(tr.transportReason) || '',
            refusalOfTransportReason: cv(tr.refusalOfTransportReason) || '',
            destinationFacilityId: cv(tr.destinationFacilityId) || '',
            destinationName: cv(tr.destinationName) || '',
            destinationAddress: cv(tr.destinationAddress) || '',
            destinationType: cv(tr.destinationType) || 'HOSPITAL',
            destinationGeoLocation: (tr.destinationGeoLocation?.latitude || tr.destinationGeoLocation?.longitude) ? {
               latitude: toNum(tr.destinationGeoLocation.latitude),
               longitude: toNum(tr.destinationGeoLocation.longitude),
               altitude: toNum(tr.destinationGeoLocation.altitude),
               geohash: cv(tr.destinationGeoLocation.geohash) || ''
            } : null,
            receivingPhysicianName: cv(tr.receivingPhysicianName) || '',
            receivingNurseName: cv(tr.receivingNurseName) || '',
            handoffReport: cv(tr.handoffReport) || '',
            hospitalNotified: tr.hospitalNotified ?? false,
            hospitalNotifiedAt: toIso(tr.hospitalNotifiedAt),
            patientConditionOnDeparture: cv(tr.patientConditionOnDeparture) || 'STABLE',
            patientConditionOnArrival: cv(tr.patientConditionOnArrival) || 'STABLE',
            careLevel: cv(tr.careLevel) || 'STABLE',
            continuedCPRDuringTransport: tr.continuedCPRDuringTransport ?? false,
            aedUsedDuringTransport: tr.aedUsedDuringTransport ?? false,
         },
         // Nested: consent
         consent: {
            patientConsentObtained: cn.patientConsentObtained ?? true,
            consentType: cn.consentType || 'VERBAL',
            refusalOfCare: cn.refusalOfCare ?? false,
            refusalReason: cv(cn.refusalReason) || '',
            refusalWitnessed: cn.refusalWitnessed ?? false,
            witnessName: cv(cn.witnessName) || '',
            witnessContact: cv(cn.witnessContact) || '',
            patientInformedOfRisks: cn.patientInformedOfRisks ?? true,
            patientHasDecisionCapacity: cn.patientHasDecisionCapacity ?? true,
            capacityAssessmentNotes: cv(cn.capacityAssessmentNotes) || '',
            guardianConsentObtained: cn.guardianConsentObtained ?? false,
            guardianName: cv(cn.guardianName) || '',
            guardianRelationship: cv(cn.guardianRelationship) || '',
            guardianPhone: cv(cn.guardianPhone) || '',
            patientSignatureAttachmentId: cv(cn.patientSignatureAttachmentId) || '',
            guardianSignatureAttachmentId: cv(cn.guardianSignatureAttachmentId) || '',
            crewSignatureAttachmentId: cv(cn.crewSignatureAttachmentId) || '',
         },
         // Meta
         paramedicsId: data.paramedicsId || '',
         organizationId: data.organizationId || '',
         status: data.status || 'PENDING',
         clinicalTag: cv(data.clinicalTag) || null,
         dietAdvice: toArr(data.dietAdvice),
         notes: toArr(data.notes),
         clinicalData: {
            vitals: hasClinicalVitals ? [clinicalVitals] : [],
            assessment: {
               diagnosis: cv(data.diagnosis) || '',
               primaryImpression: cv(data.primaryImpression) || '',
               secondaryImpression: cv(data.secondaryImpression) || '',
               treatmentProvided: cv(data.treatmentProvided) || '',
               treatmentPlan: cv(data.treatmentPlan) || '',
               mentalStatus: cv(data.mentalStatus) || '',
               ecgRhythm: cv(data.ecgRhythm) || '',
               pupilsResponse: cv(data.pupilsResponse) || '',
               skinCondition: cv(data.skinCondition) || '',
               airwayManaged: data.airwayManaged ?? false,
               diagnosticFindings: cv(data.diagnosticFindings) || '',
            },
            complaints: toArr(data.complaints),
            medicationsAdministered: toArr(data.medicationsAdministered),
            proceduresPerformed: toArr(data.proceduresPerformed),
            dietAdvice: toArr(data.dietAdvice),
            notes: toArr(data.notes),
            medicalHistoryNotes: toArr(mh.notes),
         },
          dynamicFormResponses: {
             ...(dynamicData || {}),
             voiceFilledFields: voiceFilledFields,
             voiceTranscriptId: voiceTranscriptId
          },
      };
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!validateStep(currentStep)) {
         dispatch(addToast({ type: 'error', message: 'Parameters incomplete for current sector.' }));
         return;
      }

      setIsSubmitting(true);
      setError('');
      setFieldErrors({});

      try {
         const payload = buildApiPayload(formData, dynamicFormResponses);
         if (selectedWorkflow?.id) payload.workflowId = selectedWorkflow.id;
         if (import.meta.env.DEV) console.log('[EPCR] Submitting payload:', JSON.stringify(payload, null, 2));
         
         let created;
         if (recordId) {
            created = await dispatch(updateRecord({ id: recordId, data: payload })).unwrap();
         } else {
            created = await dispatch(createRecord({ data: payload, idempotencyKey })).unwrap();
            // Clear / regenerate the key on success
            setIdempotencyKey(self.crypto?.randomUUID ? self.crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36)));
         }
         
         const generatedId = created?.incidentNumber || created?.patientId || created?.id;
         dispatch(addToast({ type: 'success', message: generatedId ? `Record ${recordId ? 'Updated' : 'Saved'}: ${generatedId}` : `Record ${recordId ? 'Updated' : 'Saved'}` }));
         
         const finalPatientId = formData.patientId || created?.patientId || created?.patient?.id;
         if (finalPatientId) {
            await dispatch(fetchAllPatientHistory(finalPatientId));
            navigate(`/patient-history/${finalPatientId}`);
         } else {
            navigate('/epcr');
         }
      } catch (err) {
         const msg = typeof err === 'string' ? err : (err?.message || 'Transmission Interrupted');
         setError(msg);
         dispatch(addToast({ type: 'error', message: msg || 'Protocol transmission failed.' }));
      } finally {
         setIsSubmitting(false);
      }
   };

   const StepIndicator = ({ step, label, icon }) => (
      <div className={`flex flex-col items-center gap-3 transition-all duration-300 relative group ${currentStep === step ? 'scale-105' : 'opacity-50 hover:opacity-100'}`}>
         <div className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all ${currentStep === step ? 'bg-brand-blue border-brand-blue text-white shadow-md' : 'bg-white border-slate-300 text-slate-400'}`}>
            {icon}
            {currentStep > step && <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full text-white p-0.5"><CheckCircle2 size={16} /></div>}
         </div>
         <span className={`text-xs font-bold text-center ${currentStep === step ? 'text-brand-blue' : 'text-slate-500'}`}>{label}</span>
      </div>
   );

   return (
      <div className="max-w-7xl mx-auto pb-24 space-y-12">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
               <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-brand-blue mb-6 transition-colors font-medium text-sm">
                  <ArrowLeft size={16} />
                  <span>Back to Records</span>
               </button>
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-brand-blue/10 rounded-xl flex items-center justify-center text-brand-blue">
                     <FilePlus2 size={28} />
                  </div>
                  <div>
                     <h1 className="text-3xl font-bold text-slate-800 leading-none">
                        {recordId ? 'Update' : 'New'} <span className="text-brand-blue">ePCR Record</span>
                     </h1>
                     <p className="text-sm font-medium text-slate-500 mt-2">Electronic Patient Care Reporting</p>
                  </div>
               </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
               <button type="button" onClick={toggleListening} className={`px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-md ${isListening ? 'bg-gradient-to-br from-brand-red to-brand-red-dark hover:from-red-500 hover:to-brand-red text-white animate-pulse' : 'bg-gradient-to-br from-brand-blue to-brand-blue-dark hover:from-brand-blue-light hover:to-brand-blue text-white'}`}>
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                  <span>{isListening ? 'Stop Mic' : 'Voice-to-ePCR'}</span>
               </button>
               {Object.keys(aiMetadata).length > 0 && (
                  <button type="button" onClick={clearAllAiFlags} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 border border-slate-200 transition-all">
                     <Trash2 size={16} />
                     <span>Clear AI Highlights</span>
                  </button>
               )}
               <button onClick={handleSubmit} disabled={isSubmitting} className="bg-brand-blue text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md">
                  {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>{isSubmitting ? 'Saving...' : (recordId ? 'Update Record' : 'Save Record')}</span>
               </button>
            </div>
         </div>

         {/* Workflow Selector */}
         <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">CLINICAL WORKFLOW</div>
            <div className="flex-1 flex flex-wrap gap-3">
               {workflows.map(wf => (
                  <button key={wf.id} onClick={() => handleWorkflowChange(wf.id)} className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest border-2 transition-all ${selectedWorkflow?.id === wf.id ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-400 border-slate-100 hover:border-brand-blue hover:text-brand-blue'}`}>
                     {wf.name}
                  </button>
               ))}
            </div>
         </div>

         {/* Step Indicators */}
         <div className="flex justify-between max-w-2xl mx-auto px-10 border-b-2 border-slate-100 pb-8">
            <StepIndicator step={1} label={t("Subject")} icon={<User size={24} />} />
            <StepIndicator step={2} label={t("Incident")} icon={<Activity size={24} />} />
            <StepIndicator step={3} label={t("Clinical")} icon={<Thermometer size={24} />} />
            <StepIndicator step={4} label={t("Disposition")} icon={<ArrowRight size={24} />} />
         </div>

         <div className="brochure-card p-12 md:p-20 relative">
            <form onSubmit={handleSubmit} className="space-y-12">
               {error && (
                  <div className="p-6 bg-brand-red text-white font-black uppercase tracking-widest flex items-center gap-4">
                     <AlertTriangle size={24} /> {error}
                  </div>
               )}

               {/* ── STEP 1: SUBJECT ── */}
               {currentStep === 1 && (
                  <div className="space-y-12">

                     {!recordId && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="flex items-center gap-4 mb-4">
                              <button type="button" onClick={() => setPatientMode('new')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${patientMode === 'new' ? 'bg-brand-blue text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>New Patient</button>
                              <button type="button" onClick={() => setPatientMode('existing')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${patientMode === 'existing' ? 'bg-brand-blue text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}>Existing Patient</button>
                           </div>

                           {patientMode === 'existing' && !formData.patientId && (
                              <div className="flex gap-2 items-end">
                                 <div className="flex-1 space-y-1.5">
                                    <label className={labelCls}>Search by Phone Number</label>
                                    <div className="relative">
                                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                       <input type="text" value={searchPhone} onChange={e => setSearchPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handlePatientSearch())} placeholder="e.g. 555-1234" className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none" />
                                    </div>
                                 </div>
                                 <button type="button" onClick={handlePatientSearch} disabled={isSearching} className="bg-brand-blue text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 h-[38px] flex items-center justify-center min-w-[100px]">
                                    {isSearching ? <RefreshCw className="animate-spin" size={16} /> : 'Search'}
                                 </button>
                              </div>
                           )}

                           {searchResults.length > 0 && (
                              <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                 <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 uppercase">Search Results</div>
                                 {searchResults.map(pat => (
                                    <div key={pat.id || pat.patientId} className="px-4 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                       <div>
                                          <p className="text-sm font-bold text-slate-800">{pat.name || `${pat.firstName || ''} ${pat.lastName || ''}`.trim()}</p>
                                          <p className="text-xs text-slate-500">ID: {pat.patientId || pat.id} | DOB: {pat.dateOfBirth || pat.dob || 'N/A'}</p>
                                       </div>
                                       <button type="button" onClick={() => selectExistingPatient(pat)} className="text-brand-blue bg-blue-50 px-3 py-1.5 rounded text-xs font-bold hover:bg-brand-blue hover:text-white transition-all">Select</button>
                                    </div>
                                 ))}
                              </div>
                           )}

                           {patientMode === 'existing' && formData.patientId && (
                              <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                                 <div className="flex items-center gap-2">
                                    <CheckCircle2 className="text-emerald-500" size={18} />
                                    <div>
                                       <p className="text-sm font-bold text-emerald-800">Linked to Existing Patient</p>
                                       <p className="text-xs text-emerald-600 font-medium">{formData.patientName} (ID: {formData.patientId})</p>
                                    </div>
                                 </div>
                                 <button type="button" onClick={handleUnlinkPatient} className="text-xs font-bold text-brand-red hover:underline">Unlink</button>
                              </div>
                           )}
                        </div>
                     )}

                     {/* Basic Info */}
                     <SectionTitle title="Patient Information" />

                     {/* Patient Photo Upload Card */}
                     <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative group shrink-0">
                           {formData.patientPhotoUrl ? (
                              <img
                                 src={formData.patientPhotoUrl}
                                 alt="Patient Preview"
                                 className="w-20 h-20 rounded-full object-cover border-2 border-brand-blue shadow-md"
                              />
                           ) : (
                              <div className="w-20 h-20 rounded-full bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-bold text-xs">
                                 No Photo
                              </div>
                           )}
                        </div>
                        <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                           <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Patient Photo / Image (Optional)</h4>
                           <p className="text-[11px] text-slate-500">Upload or capture a photo for visual reference in doctor alert emails and patient records.</p>
                           <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                              <label className="bg-brand-blue text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-sm">
                                 📷 Upload / Take Photo
                                 <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                       const file = e.target.files?.[0];
                                       if (file) {
                                          const reader = new FileReader();
                                          reader.onloadend = () => {
                                             updateField('patientPhotoUrl', reader.result);
                                          };
                                          reader.readAsDataURL(file);

                                          try {
                                             const uploadData = new FormData();
                                             uploadData.append('file', file);
                                             const { data } = await client.post('/api/epcr/records/upload-photo', uploadData, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                             });
                                             if (data && data.patientPhotoUrl) {
                                                updateField('patientPhotoUrl', data.patientPhotoUrl);
                                                dispatch(addToast({ type: 'success', message: 'Photo uploaded to Supabase Storage successfully!' }));
                                             }
                                          } catch (err) {
                                             console.warn('Supabase photo upload fallback to data URL:', err);
                                          }
                                       }
                                    }}
                                 />
                              </label>
                              {formData.patientPhotoUrl && (
                                 <button
                                    type="button"
                                    onClick={() => updateField('patientPhotoUrl', '')}
                                    className="text-xs font-bold text-brand-red bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all"
                                 >
                                    Remove Photo
                                 </button>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Field label="Patient Name" field="patientName" value={formData.patientName} update={updateField} error={fieldErrors.patientName} required={patientMode === 'new'} disabled={patientMode === 'existing' && !!formData.patientId} aiInfo={aiMetadata['patientName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Patient ID" field="patientId" value={formData.patientId} update={updateField} disabled placeholder="Auto-generated on save" />
                        <Field label="Date of Birth" field="patientDateOfBirth" value={formData.patientDateOfBirth} update={updateField} type="date" error={fieldErrors.patientDateOfBirth} required={patientMode === 'new'} disabled={patientMode === 'existing' && !!formData.patientId} aiInfo={aiMetadata['patientDateOfBirth']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={fieldErrors.patientGender ? 'text-xs font-semibold text-brand-red leading-none' : (patientMode === 'new' ? labelReqCls : labelCls)}>Gender</label>
                              {aiMetadata['patientGender'] && aiMetadata['patientGender'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                                    ✔ AI Filled ({Math.round(aiMetadata['patientGender'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('patientGender')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['patientGender'] && aiMetadata['patientGender'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                                    💡 Suggestion ({Math.round(aiMetadata['patientGender'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('patientGender')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.patientGender} 
                              onChange={e => {
                                 updateField('patientGender', e.target.value);
                                 if (aiMetadata['patientGender']) dismissAiInfo('patientGender');
                              }} 
                              disabled={patientMode === 'existing' && !!formData.patientId} 
                              className={(fieldErrors.patientGender ? 'w-full bg-white border border-brand-red rounded-lg px-4 py-3 text-sm text-brand-red focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all' : (patientMode === 'new' ? inputReqCls : inputCls)) + (aiMetadata['patientGender']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['patientGender']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Gender</option>
                              <option value="MALE">Male</option>
                              <option value="FEMALE">Female</option>
                              <option value="OTHER">Other</option>
                           </select>
                           {aiMetadata['patientGender'] && aiMetadata['patientGender'].status === 'suggestion' && (
                              <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['patientGender'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('patientGender')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                           {fieldErrors.patientGender && <p className="text-xs font-medium text-brand-red">{fieldErrors.patientGender}</p>}
                        </div>
                        <Field label="Age" field="age" value={formData.age} update={updateField} type="number" aiInfo={aiMetadata['age']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Patient Email Address" field="email" value={formData.email} update={updateField} type="email" placeholder="patient@example.com" aiInfo={aiMetadata['email']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Phone Number" field="patientPhone" value={formData.patientPhone} update={updateField} aiInfo={aiMetadata['patientPhone']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Select Attending Doctor</label>
                           </div>
                           <select
                              value={formData.medicalHistory.doctor || ''}
                              onChange={e => {
                                 const val = e.target.value;
                                 updateField('medicalHistory.doctor', val);
                                 const doc = doctorsList.find(d => d.email === val || d.id === val || d._id === val || d.phone === val);
                                 if (doc) {
                                    updateField('medicalHistory.primaryPhysicianName', `Dr. ${doc.firstName || ''} ${doc.lastName || ''}`.trim());
                                 }
                              }}
                              className={inputCls}
                           >
                              <option value="">-- Choose Doctor from Organization --</option>
                              {doctorsList.map(d => {
                                 const val = d.email || d.id || d.phone;
                                 const name = `Dr. ${d.firstName || ''} ${d.lastName || ''}`.trim();
                                 const contact = d.email ? `(${d.email})` : (d.phone ? `(${d.phone})` : '');
                                 return (
                                    <option key={d.id || val} value={val}>
                                       {name || 'Doctor'} {contact}
                                    </option>
                                 );
                              })}
                              {doctorsList.length === 0 && (
                                 <option value="" disabled>No doctors registered in your organization</option>
                              )}
                           </select>
                           <p className="text-[10px] text-slate-400 mt-0.5">Notification email will be sent automatically to the selected doctor upon ePCR creation.</p>
                        </div>
                        <Field label="SSN Last 4" field="patientSSNLast4" value={formData.patientSSNLast4} update={updateField} maxLength={4} aiInfo={aiMetadata['patientSSNLast4']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Blood Group</label>
                              {aiMetadata['bloodGroup'] && aiMetadata['bloodGroup'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                                    ✔ AI Filled ({Math.round(aiMetadata['bloodGroup'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('bloodGroup')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['bloodGroup'] && aiMetadata['bloodGroup'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                                    💡 Suggestion ({Math.round(aiMetadata['bloodGroup'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('bloodGroup')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.bloodGroup} 
                              onChange={e => {
                                 updateField('bloodGroup', e.target.value);
                                 if (aiMetadata['bloodGroup']) dismissAiInfo('bloodGroup');
                              }} 
                              className={inputCls + (aiMetadata['bloodGroup']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['bloodGroup']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Blood Group</option>
                              {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                           </select>
                           {aiMetadata['bloodGroup'] && aiMetadata['bloodGroup'].status === 'suggestion' && (
                              <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['bloodGroup'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('bloodGroup')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <Field label="Height (cm)" field="height" value={formData.height} update={updateField} type="number" aiInfo={aiMetadata['height']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Weight (kg)" field="weight" value={formData.weight} update={updateField} type="number" aiInfo={aiMetadata['weight']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                     <div className="mt-6">
                        <TextAreaField label="Address" field="patientAddress" value={formData.patientAddress} update={updateField} disabled={patientMode === 'existing' && !!formData.patientId} rows={2} aiInfo={aiMetadata['patientAddress']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                  

                     {/* Medical History */}
                     <SectionTitle title="Medical History" />
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Field label="Comorbidity" field="medicalHistory.comorbidity" value={formData.medicalHistory.comorbidity} update={updateField} aiInfo={aiMetadata['medicalHistory.comorbidity']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Current Medicines" field="medicalHistory.currentMedicines" value={formData.medicalHistory.currentMedicines} update={updateField} aiInfo={aiMetadata['medicalHistory.currentMedicines']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Allergy" field="medicalHistory.allergy" value={formData.medicalHistory.allergy} update={updateField} aiInfo={aiMetadata['medicalHistory.allergy']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Surgical History" field="medicalHistory.surgicalHistoryString" value={formData.medicalHistory.surgicalHistoryString} update={updateField} aiInfo={aiMetadata['medicalHistory.surgicalHistoryString']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Primary Physician" field="medicalHistory.primaryPhysicianName" value={formData.medicalHistory.primaryPhysicianName} update={updateField} placeholder="e.g. Dr. John Smith" aiInfo={aiMetadata['medicalHistory.primaryPhysicianName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Physician Email / Contact" field="medicalHistory.primaryPhysicianContact" value={formData.medicalHistory.primaryPhysicianContact} update={updateField} placeholder="e.g. physician@hospital.com" aiInfo={aiMetadata['medicalHistory.primaryPhysicianContact']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Physician Facility" field="medicalHistory.primaryPhysicianFacility" value={formData.medicalHistory.primaryPhysicianFacility} update={updateField} aiInfo={aiMetadata['medicalHistory.primaryPhysicianFacility']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Advance Directive Type" field="medicalHistory.advanceDirectiveType" value={formData.medicalHistory.advanceDirectiveType} update={updateField} aiInfo={aiMetadata['medicalHistory.advanceDirectiveType']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     {/* Pregnancy */}
                     {formData.patientGender === 'FEMALE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                           <ToggleField label="Pregnant" field="medicalHistory.pregnant" value={formData.medicalHistory.pregnant} update={updateField} aiInfo={aiMetadata['medicalHistory.pregnant']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           {formData.medicalHistory.pregnant && (
                              <Field label="Gestational Week" field="medicalHistory.gestationalWeekIfPregnant" value={formData.medicalHistory.gestationalWeekIfPregnant} update={updateField} type="number" aiInfo={aiMetadata['medicalHistory.gestationalWeekIfPregnant']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           )}
                        </div>
                     )}

                     {/* Substance Use */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <ToggleField label="DNR On File" field="medicalHistory.dnrOnFile" value={formData.medicalHistory.dnrOnFile} update={updateField} aiInfo={aiMetadata['medicalHistory.dnrOnFile']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Advance Directive" field="medicalHistory.advanceDirective" value={formData.medicalHistory.advanceDirective} update={updateField} aiInfo={aiMetadata['medicalHistory.advanceDirective']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Smoker" field="medicalHistory.smoker" value={formData.medicalHistory.smoker} update={updateField} aiInfo={aiMetadata['medicalHistory.smoker']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Alcohol Use" field="medicalHistory.alcoholUse" value={formData.medicalHistory.alcoholUse} update={updateField} aiInfo={aiMetadata['medicalHistory.alcoholUse']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Substance Use" field="medicalHistory.substanceUse" value={formData.medicalHistory.substanceUse} update={updateField} aiInfo={aiMetadata['medicalHistory.substanceUse']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                     {formData.medicalHistory.substanceUse && (
                        <Field label="Substance Use Details" field="medicalHistory.substanceUseDetails" value={formData.medicalHistory.substanceUseDetails} update={updateField} aiInfo={aiMetadata['medicalHistory.substanceUseDetails']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     )}

                     {/* Last Known */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <Field label="Last Known Well" field="medicalHistory.lastKnownWellDateTime" value={formData.medicalHistory.lastKnownWellDateTime} update={updateField} type="datetime-local" aiInfo={aiMetadata['medicalHistory.lastKnownWellDateTime']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Last Oral Intake" field="medicalHistory.lastOralIntake" value={formData.medicalHistory.lastOralIntake} update={updateField} type="datetime-local" aiInfo={aiMetadata['medicalHistory.lastOralIntake']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                     <BulletListField
                        label="Medical History Notes"
                        addLabel="Add note"
                        values={formData.medicalHistory.notes}
                        onChange={(next) => updateField('medicalHistory.notes', next)}
                        placeholder="Known diabetic"
                     />
                  </div>
               )}

               {/* ── STEP 2: INCIDENT ── */}
               {currentStep === 2 && (
                  <div className="space-y-12">

                     <SectionTitle title="Incident Details" />
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Field label="Incident Timestamp" field="incidentDateTime" value={formData.incidentDateTime} update={updateField} type="datetime-local" error={fieldErrors.incidentDateTime} required aiInfo={aiMetadata['incidentDateTime']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Incident Location" field="incidentLocation" value={formData.incidentLocation} update={updateField} error={fieldErrors.incidentLocation} required aiInfo={aiMetadata['incidentLocation']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={fieldErrors.incidentType ? 'text-xs font-semibold text-brand-red leading-none' : labelReqCls}>Incident Type</label>
                              {aiMetadata['incidentType'] && aiMetadata['incidentType'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                                    ✔ AI Filled ({Math.round(aiMetadata['incidentType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('incidentType')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['incidentType'] && aiMetadata['incidentType'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                                    💡 Suggestion ({Math.round(aiMetadata['incidentType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('incidentType')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.incidentType} 
                              onChange={e => {
                                 updateField('incidentType', e.target.value);
                                 if (aiMetadata['incidentType']) dismissAiInfo('incidentType');
                              }} 
                              className={(fieldErrors.incidentType ? 'w-full bg-white border border-brand-red rounded-lg px-4 py-3 text-sm text-brand-red focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all' : inputReqCls) + (aiMetadata['incidentType']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['incidentType']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Type</option>
                              {incidentTypesOptions.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                           </select>
                           {aiMetadata['incidentType'] && aiMetadata['incidentType'].status === 'suggestion' && (
                              <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['incidentType'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('incidentType')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                           {fieldErrors.incidentType && <p className="text-xs font-medium text-brand-red">{fieldErrors.incidentType}</p>}
                        </div>
                        <Field label="Incident Number" field="incidentNumber" value={formData.incidentNumber} update={updateField} disabled placeholder="Auto-generated on save" />
                        <Field label="Scene Type" field="sceneAssessment.sceneType" value={formData.sceneAssessment.sceneType} update={updateField} aiInfo={aiMetadata['sceneAssessment.sceneType']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Number of Patients" field="sceneAssessment.numberOfPatients" value={formData.sceneAssessment.numberOfPatients} update={updateField} type="number" aiInfo={aiMetadata['sceneAssessment.numberOfPatients']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Mechanism of Injury" field="sceneAssessment.mechanismOfInjury" value={formData.sceneAssessment.mechanismOfInjury} update={updateField} aiInfo={aiMetadata['sceneAssessment.mechanismOfInjury']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Injury Location" field="sceneAssessment.injuryLocation" value={formData.sceneAssessment.injuryLocation} update={updateField} aiInfo={aiMetadata['sceneAssessment.injuryLocation']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Scene Hazards" field="sceneAssessment.sceneHazards" value={formData.sceneAssessment.sceneHazards} update={updateField} aiInfo={aiMetadata['sceneAssessment.sceneHazards']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Weather Conditions" field="sceneAssessment.weatherConditions" value={formData.sceneAssessment.weatherConditions} update={updateField} aiInfo={aiMetadata['sceneAssessment.weatherConditions']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Lighting Conditions" field="sceneAssessment.lightingConditions" value={formData.sceneAssessment.lightingConditions} update={updateField} aiInfo={aiMetadata['sceneAssessment.lightingConditions']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Patient Access Difficulty" field="sceneAssessment.patientAccessDifficulty" value={formData.sceneAssessment.patientAccessDifficulty} update={updateField} aiInfo={aiMetadata['sceneAssessment.patientAccessDifficulty']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Triage Tag</label>
                              {aiMetadata['sceneAssessment.triageTag'] && aiMetadata['sceneAssessment.triageTag'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                                    ✔ AI Filled ({Math.round(aiMetadata['sceneAssessment.triageTag'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('sceneAssessment.triageTag')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['sceneAssessment.triageTag'] && aiMetadata['sceneAssessment.triageTag'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                                    💡 Suggestion ({Math.round(aiMetadata['sceneAssessment.triageTag'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('sceneAssessment.triageTag')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.sceneAssessment.triageTag} 
                              onChange={e => {
                                 updateField('sceneAssessment.triageTag', e.target.value);
                                 if (aiMetadata['sceneAssessment.triageTag']) dismissAiInfo('sceneAssessment.triageTag');
                              }} 
                              className={inputCls + (aiMetadata['sceneAssessment.triageTag']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['sceneAssessment.triageTag']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Triage Tag</option>
                              {TRIAGE_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                           </select>
                           {aiMetadata['sceneAssessment.triageTag'] && aiMetadata['sceneAssessment.triageTag'].status === 'suggestion' && (
                              <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['sceneAssessment.triageTag'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('sceneAssessment.triageTag')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>

                        {/* CTAS 1-5 Canadian Triage & Acuity Scale Selector */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 mt-2">
                           <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                 CTAS Canadian Triage & Acuity Scale (Level 1–5)
                              </label>
                              <span className="text-[10px] font-mono text-slate-500">Health Canada / NWT Standard</span>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                              {[
                                 { level: 1, name: 'L1 Resuscitation', bg: 'bg-red-600 text-white border-red-700', active: 'ring-2 ring-red-600 ring-offset-2 font-black scale-105 shadow-md' },
                                 { level: 2, name: 'L2 Emergent', bg: 'bg-orange-500 text-white border-orange-600', active: 'ring-2 ring-orange-500 ring-offset-2 font-black scale-105 shadow-md' },
                                 { level: 3, name: 'L3 Urgent', bg: 'bg-yellow-500 text-slate-900 border-yellow-600', active: 'ring-2 ring-yellow-500 ring-offset-2 font-black scale-105 shadow-md' },
                                 { level: 4, name: 'L4 Less Urgent', bg: 'bg-emerald-600 text-white border-emerald-700', active: 'ring-2 ring-emerald-600 ring-offset-2 font-black scale-105 shadow-md' },
                                 { level: 5, name: 'L5 Non-Urgent', bg: 'bg-blue-600 text-white border-blue-700', active: 'ring-2 ring-blue-600 ring-offset-2 font-black scale-105 shadow-md' },
                              ].map(ctas => (
                                 <button
                                    key={ctas.level}
                                    type="button"
                                    onClick={() => {
                                       updateField('sceneAssessment.ctasLevel', ctas.level);
                                       updateField('sceneAssessment.ctasName', ctas.name);
                                       updateField('sceneAssessment.ctasAssessedAt', new Date().toISOString());
                                    }}
                                    className={`p-3 rounded-xl border text-xs text-center transition-all cursor-pointer shadow-sm flex flex-col items-center justify-center gap-1 ${ctas.bg} ${formData.sceneAssessment?.ctasLevel === ctas.level ? ctas.active : 'opacity-75 hover:opacity-100'}`}
                                 >
                                    <span className="font-bold text-sm">CTAS {ctas.level}</span>
                                    <span className="text-[10px] truncate">{ctas.name}</span>
                                 </button>
                              ))}
                           </div>
                        </div>

                        <Field label="Latitude" field="sceneAssessment.geoLocation.latitude" value={formData.sceneAssessment.geoLocation?.latitude || ''} update={updateField} type="number" aiInfo={aiMetadata['sceneAssessment.geoLocation.latitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Longitude" field="sceneAssessment.geoLocation.longitude" value={formData.sceneAssessment.geoLocation?.longitude || ''} update={updateField} type="number" aiInfo={aiMetadata['sceneAssessment.geoLocation.longitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Altitude" field="sceneAssessment.geoLocation.altitude" value={formData.sceneAssessment.geoLocation?.altitude || ''} update={updateField} type="number" aiInfo={aiMetadata['sceneAssessment.geoLocation.altitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Geohash" field="sceneAssessment.geoLocation.geohash" value={formData.sceneAssessment.geoLocation?.geohash || ''} update={updateField} aiInfo={aiMetadata['sceneAssessment.geoLocation.geohash']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     {/* Scene Toggles */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                        <ToggleField label="Scene Safe" field="sceneAssessment.sceneSafe" value={formData.sceneAssessment.sceneSafe} update={updateField} aiInfo={aiMetadata['sceneAssessment.sceneSafe']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Trauma Call" field="sceneAssessment.traumaCall" value={formData.sceneAssessment.traumaCall} update={updateField} aiInfo={aiMetadata['sceneAssessment.traumaCall']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Mass Casualty" field="sceneAssessment.massCasualtyIncident" value={formData.sceneAssessment.massCasualtyIncident} update={updateField} aiInfo={aiMetadata['sceneAssessment.massCasualtyIncident']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Witness Present" field="sceneAssessment.witnessPresent" value={formData.sceneAssessment.witnessPresent} update={updateField} aiInfo={aiMetadata['sceneAssessment.witnessPresent']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Bystander CPR" field="sceneAssessment.bystanderCPRPerformed" value={formData.sceneAssessment.bystanderCPRPerformed} update={updateField} aiInfo={aiMetadata['sceneAssessment.bystanderCPRPerformed']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="AED By Bystander" field="sceneAssessment.aedUsedByBystander" value={formData.sceneAssessment.aedUsedByBystander} update={updateField} aiInfo={aiMetadata['sceneAssessment.aedUsedByBystander']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     {/* Witness Info */}
                     {formData.sceneAssessment.witnessPresent && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                           <Field label="Witness Name" field="sceneAssessment.witnessName" value={formData.sceneAssessment.witnessName} update={updateField} aiInfo={aiMetadata['sceneAssessment.witnessName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           <Field label="Witness Contact" field="sceneAssessment.witnessContact" value={formData.sceneAssessment.witnessContact} update={updateField} aiInfo={aiMetadata['sceneAssessment.witnessContact']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
                     )}

                     {/* Narrative */}
                     <div className="mt-6">
                        <TextAreaField label="Narrative Description" field="incidentDescription" value={formData.incidentDescription} update={updateField} rows={4} aiInfo={aiMetadata['incidentDescription']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     {/* Timeline */}
                     <SectionTitle title="Response Timeline" />
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Field label="Call Received At" field="timeline.callReceivedAt" value={formData.timeline.callReceivedAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.callReceivedAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Dispatched At" field="timeline.dispatchedAt" value={formData.timeline.dispatchedAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.dispatchedAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="En Route At" field="timeline.enRouteAt" value={formData.timeline.enRouteAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.enRouteAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Arrived Scene At" field="timeline.arrivedSceneAt" value={formData.timeline.arrivedSceneAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.arrivedSceneAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Patient Contact At" field="timeline.patientContactAt" value={formData.timeline.patientContactAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.patientContactAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Departed Scene At" field="timeline.departedSceneAt" value={formData.timeline.departedSceneAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.departedSceneAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Arrived Destination At" field="timeline.arrivedDestinationAt" value={formData.timeline.arrivedDestinationAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.arrivedDestinationAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Transfer of Care At" field="timeline.transferOfCareAt" value={formData.timeline.transferOfCareAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.transferOfCareAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Unit Available At" field="timeline.unitAvailableAt" value={formData.timeline.unitAvailableAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['timeline.unitAvailableAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     {/* Complaints */}
                     <SectionTitle title="Chief Complaints" />
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                           <TextAreaField label="Narrative Complaints (Legacy)" field="complaints" value={formData.complaints} update={updateField} rows={6} placeholder="Enter complaints narrative..." aiInfo={aiMetadata['complaints']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
                        <StructuredComplaintsListField
                           values={formData.structuredComplaints}
                           onChange={(next) => updateField('structuredComplaints', next)}
                        />
                     </div>
                  </div>
               )}

               {/* ── STEP 3: CLINICAL ── */}
               {currentStep === 3 && (
                  <div className="space-y-12">
                     <SectionTitle title="Clinical Vitals" />
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                        <Field label="BP Systolic" field="systolicBp" value={formData.systolicBp} update={updateField} type="number" aiInfo={aiMetadata['systolicBp']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="BP Diastolic" field="diastolicBp" value={formData.diastolicBp} update={updateField} type="number" aiInfo={aiMetadata['diastolicBp']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Pulse (BPM)" field="pulseRate" value={formData.pulseRate} update={updateField} type="number" aiInfo={aiMetadata['pulseRate']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Resp (RR)" field="respirationRate" value={formData.respirationRate} update={updateField} type="number" aiInfo={aiMetadata['respirationRate']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="SpO2 (%)" field="spo2" value={formData.spo2} update={updateField} type="number" aiInfo={aiMetadata['spo2']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Temp (°C)" field="temperature" value={formData.temperature} update={updateField} type="number" aiInfo={aiMetadata['temperature']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Blood Sugar" field="bloodSugar" value={formData.bloodSugar} update={updateField} type="number" aiInfo={aiMetadata['bloodSugar']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="GCS" field="glasgowComaScale" value={formData.glasgowComaScale} update={updateField} type="number" aiInfo={aiMetadata['glasgowComaScale']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Hemoglobin (g/dL)" field="hemoglobin" value={formData.hemoglobin} update={updateField} type="number" aiInfo={aiMetadata['hemoglobin']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                     <StructuredVitalsListField
                        values={formData.structuredVitals}
                        onChange={(next) => updateField('structuredVitals', next)}
                     />

                     {/* Clinical Assessment */}
                     <SectionTitle title="Clinical Assessment" />
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Field label="Mental Status" field="mentalStatus" value={formData.mentalStatus} update={updateField} aiInfo={aiMetadata['mentalStatus']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="ECG Rhythm" field="ecgRhythm" value={formData.ecgRhythm} update={updateField} aiInfo={aiMetadata['ecgRhythm']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Pupils Response" field="pupilsResponse" value={formData.pupilsResponse} update={updateField} aiInfo={aiMetadata['pupilsResponse']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Skin Condition" field="skinCondition" value={formData.skinCondition} update={updateField} aiInfo={aiMetadata['skinCondition']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Primary Impression" field="primaryImpression" value={formData.primaryImpression} update={updateField} aiInfo={aiMetadata['primaryImpression']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Secondary Impression" field="secondaryImpression" value={formData.secondaryImpression} update={updateField} aiInfo={aiMetadata['secondaryImpression']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Diagnosis" field="diagnosis" value={formData.diagnosis} update={updateField} aiInfo={aiMetadata['diagnosis']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Treatment Provided" field="treatmentProvided" value={formData.treatmentProvided} update={updateField} aiInfo={aiMetadata['treatmentProvided']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Treatment Plan" field="treatmentPlan" value={formData.treatmentPlan} update={updateField} aiInfo={aiMetadata['treatmentPlan']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Clinical Tag (Manual Override)" field="clinicalTag" value={formData.clinicalTag || ''} update={updateField} placeholder="e.g. Implant Case (Leave blank to auto-detect)" aiInfo={aiMetadata['clinicalTag']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ToggleField label="Airway Managed" field="airwayManaged" value={formData.airwayManaged} update={updateField} aiInfo={aiMetadata['airwayManaged']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>

                     <div className="mt-6">
                        <TextAreaField label="Diagnostic Findings" field="diagnosticFindings" value={formData.diagnosticFindings} update={updateField} rows={3} aiInfo={aiMetadata['diagnosticFindings']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <div>
                           <TextAreaField label="Procedures Performed (Legacy)" field="proceduresPerformed" value={formData.proceduresPerformed} update={updateField} rows={6} placeholder="Enter procedures narrative..." aiInfo={aiMetadata['proceduresPerformed']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
                        <StructuredProceduresListField
                           values={formData.structuredProcedures}
                           onChange={(next) => updateField('structuredProcedures', next)}
                        />
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                        <div>
                           <TextAreaField label="Medications Administered (Legacy)" field="medicationsAdministered" value={formData.medicationsAdministered} update={updateField} rows={6} placeholder="Enter medications narrative..." aiInfo={aiMetadata['medicationsAdministered']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
                        <StructuredMedicationsListField
                           values={formData.structuredMedications}
                           onChange={(next) => updateField('structuredMedications', next)}
                           allergy={formData.medicalHistory?.allergy}
                           currentMedicines={formData.medicalHistory?.currentMedicines}
                        />
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <BulletListField
                           label="EPCR Notes"
                           addLabel="Add note"
                           values={formData.notes}
                           onChange={(next) => updateField('notes', next)}
                           placeholder="Patient stable on arrival"
                        />
                        <BulletListField
                           label="Diet Advice"
                           addLabel="Add diet advice"
                           values={formData.dietAdvice}
                           onChange={(next) => updateField('dietAdvice', next)}
                           placeholder="Low salt diet"
                        />
                     </div>

                     {/* Dynamic Workflow */}
                     {selectedWorkflow && (
                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 space-y-6">
                           <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                              <Layers size={18} className="text-brand-blue" /> Workflow: {selectedWorkflow.name}
                           </h3>
                           <DynamicFormRenderer
                              schema={selectedWorkflow.schema || { fields: [] }}
                              onSubmit={() => { }}
                              onCancel={() => { }}
                              hideActions={true}
                              onChange={(data) => setDynamicFormResponses(data)}
                              initialData={dynamicFormResponses}
                              errors={fieldErrors}
                           />
                        </div>
                     )}
                  </div>
               )}

               {/* ── STEP 4: DISPOSITION ── */}
               {currentStep === 4 && (
                  <div className="space-y-12">
                     <SectionTitle title="Disposition & Transport" />
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Destination Facility" field="transport.destinationName" value={formData.transport.destinationName} update={updateField} error={fieldErrors['transport.destinationName']} required aiInfo={aiMetadata['transport.destinationName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={fieldErrors['transport.transportMode'] ? 'text-xs font-semibold text-brand-red leading-none' : labelReqCls}>Transport Mode</label>
                              {aiMetadata['transport.transportMode'] && aiMetadata['transport.transportMode'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['transport.transportMode'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.transportMode')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['transport.transportMode'] && aiMetadata['transport.transportMode'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['transport.transportMode'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.transportMode')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )} 
                           </div>
                           <select 
                              value={formData.transport.transportMode} 
                              onChange={e => {
                                 updateField('transport.transportMode', e.target.value);
                                 if (aiMetadata['transport.transportMode']) dismissAiInfo('transport.transportMode');
                              }} 
                              required 
                              className={(fieldErrors['transport.transportMode'] ? 'w-full bg-white border border-brand-red rounded-lg px-4 py-3 text-sm text-brand-red focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all' : inputReqCls) + (aiMetadata['transport.transportMode']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['transport.transportMode']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Transport Mode</option>
                              {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                           </select>
                           {aiMetadata['transport.transportMode'] && aiMetadata['transport.transportMode'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['transport.transportMode'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('transport.transportMode')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                           {fieldErrors['transport.transportMode'] && <p className="text-xs font-medium text-brand-red mt-1">{fieldErrors['transport.transportMode']}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Care Level</label>
                              {aiMetadata['transport.careLevel'] && aiMetadata['transport.careLevel'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['transport.careLevel'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.careLevel')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['transport.careLevel'] && aiMetadata['transport.careLevel'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['transport.careLevel'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.careLevel')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.transport.careLevel} 
                              onChange={e => {
                                 updateField('transport.careLevel', e.target.value);
                                 if (aiMetadata['transport.careLevel']) dismissAiInfo('transport.careLevel');
                              }} 
                              className={inputCls + (aiMetadata['transport.careLevel']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['transport.careLevel']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="">Select Care Level</option>
                              <option value="BASIC">Basic</option>
                              <option value="STABLE">Stable</option>
                              <option value="URGENT">Urgent</option>
                              <option value="CRITICAL">Critical</option>
                           </select>
                           {aiMetadata['transport.careLevel'] && aiMetadata['transport.careLevel'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['transport.careLevel'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('transport.careLevel')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Record Status</label>
                              {aiMetadata['status'] && aiMetadata['status'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['status'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('status')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['status'] && aiMetadata['status'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['status'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('status')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.status} 
                              onChange={e => {
                                 updateField('status', e.target.value);
                                 if (aiMetadata['status']) dismissAiInfo('status');
                              }} 
                              className={inputCls + (aiMetadata['status']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['status']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="PENDING">Pending</option>
                              <option value="ACTIVE">Active</option>
                              <option value="COMPLETED">Completed</option>
                              <option value="CANCELLED">Cancelled</option>
                           </select>
                           {aiMetadata['status'] && aiMetadata['status'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['status'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('status')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <Field label="Transport Reason" field="transport.transportReason" value={formData.transport.transportReason} update={updateField} aiInfo={aiMetadata['transport.transportReason']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Refusal of Transport Reason" field="transport.refusalOfTransportReason" value={formData.transport.refusalOfTransportReason} update={updateField} aiInfo={aiMetadata['transport.refusalOfTransportReason']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Destination Facility ID" field="transport.destinationFacilityId" value={formData.transport.destinationFacilityId} update={updateField} aiInfo={aiMetadata['transport.destinationFacilityId']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Destination Address" field="transport.destinationAddress" value={formData.transport.destinationAddress} update={updateField} aiInfo={aiMetadata['transport.destinationAddress']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Destination Type</label>
                              {aiMetadata['transport.destinationType'] && aiMetadata['transport.destinationType'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['transport.destinationType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.destinationType')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['transport.destinationType'] && aiMetadata['transport.destinationType'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['transport.destinationType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.destinationType')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.transport.destinationType} 
                              onChange={e => {
                                 updateField('transport.destinationType', e.target.value);
                                 if (aiMetadata['transport.destinationType']) dismissAiInfo('transport.destinationType');
                              }} 
                              className={inputCls + (aiMetadata['transport.destinationType']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['transport.destinationType']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="HOSPITAL">Hospital</option>
                              <option value="CLINIC">Clinic</option>
                              <option value="NURSING_HOME">Nursing Home</option>
                              <option value="RESIDENCE">Residence</option>
                              <option value="OTHER">Other</option>
                           </select>
                           {aiMetadata['transport.destinationType'] && aiMetadata['transport.destinationType'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['transport.destinationType'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('transport.destinationType')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <Field label="Receiving Physician Name" field="transport.receivingPhysicianName" value={formData.transport.receivingPhysicianName} update={updateField} aiInfo={aiMetadata['transport.receivingPhysicianName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <Field label="Receiving Nurse Name" field="transport.receivingNurseName" value={formData.transport.receivingNurseName} update={updateField} aiInfo={aiMetadata['transport.receivingNurseName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Patient Condition on Departure</label>
                              {aiMetadata['transport.patientConditionOnDeparture'] && aiMetadata['transport.patientConditionOnDeparture'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['transport.patientConditionOnDeparture'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.patientConditionOnDeparture')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['transport.patientConditionOnDeparture'] && aiMetadata['transport.patientConditionOnDeparture'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['transport.patientConditionOnDeparture'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('transport.patientConditionOnDeparture')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.transport.patientConditionOnDeparture} 
                              onChange={e => {
                                 updateField('transport.patientConditionOnDeparture', e.target.value);
                                 if (aiMetadata['transport.patientConditionOnDeparture']) dismissAiInfo('transport.patientConditionOnDeparture');
                              }} 
                              className={inputCls + (aiMetadata['transport.patientConditionOnDeparture']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['transport.patientConditionOnDeparture']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="STABLE">Stable</option>
                              <option value="URGENT">Urgent</option>
                              <option value="CRITICAL">Critical</option>
                           </select>
                           {aiMetadata['transport.patientConditionOnDeparture'] && aiMetadata['transport.patientConditionOnDeparture'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['transport.patientConditionOnDeparture'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('transport.patientConditionOnDeparture')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <Field label="Hospital Notified At" field="transport.hospitalNotifiedAt" value={formData.transport.hospitalNotifiedAt} update={updateField} type="datetime-local" aiInfo={aiMetadata['transport.hospitalNotifiedAt']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Hospital Notified" field="transport.hospitalNotified" value={formData.transport.hospitalNotified} update={updateField} aiInfo={aiMetadata['transport.hospitalNotified']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Continued CPR During Transport" field="transport.continuedCPRDuringTransport" value={formData.transport.continuedCPRDuringTransport} update={updateField} aiInfo={aiMetadata['transport.continuedCPRDuringTransport']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="AED Used During Transport" field="transport.aedUsedDuringTransport" value={formData.transport.aedUsedDuringTransport} update={updateField} aiInfo={aiMetadata['transport.aedUsedDuringTransport']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
 
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                           <div className="md:col-span-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Destination Geo-Coordinates</div>
                           <Field label="Destination Latitude" field="transport.destinationGeoLocation.latitude" value={formData.transport.destinationGeoLocation?.latitude || ''} update={updateField} type="number" aiInfo={aiMetadata['transport.destinationGeoLocation.latitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           <Field label="Destination Longitude" field="transport.destinationGeoLocation.longitude" value={formData.transport.destinationGeoLocation?.longitude || ''} update={updateField} type="number" aiInfo={aiMetadata['transport.destinationGeoLocation.longitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           <Field label="Destination Altitude" field="transport.destinationGeoLocation.altitude" value={formData.transport.destinationGeoLocation?.altitude || ''} update={updateField} type="number" aiInfo={aiMetadata['transport.destinationGeoLocation.altitude']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           <Field label="Destination Geohash" field="transport.destinationGeoLocation.geohash" value={formData.transport.destinationGeoLocation?.geohash || ''} update={updateField} aiInfo={aiMetadata['transport.destinationGeoLocation.geohash']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
 
                        <div className="md:col-span-2">
                           <TextAreaField label="Handoff Report" field="transport.handoffReport" value={formData.transport.handoffReport} update={updateField} rows={3} placeholder="Handoff report details..." aiInfo={aiMetadata['transport.handoffReport']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
 
                        <div className="flex flex-col gap-1.5 md:col-span-2 mt-6">
                           <label className={labelReqCls}>Patient Condition on Arrival</label>
                           <div className="flex gap-3">
                              {[
                                 { id: 'RED', label: 'CRITICAL', color: 'bg-brand-red', hover: 'hover:bg-brand-red/10 hover:border-brand-red' },
                                 { id: 'YELLOW', label: 'URGENT', color: 'bg-amber-500', hover: 'hover:bg-amber-500/10 hover:border-amber-500' },
                                 { id: 'GREEN', label: 'STABLE', color: 'bg-emerald-600', hover: 'hover:bg-emerald-600/10 hover:border-emerald-600' },
                              ].map(t => (
                                 <button key={t.id} type="button" onClick={() => updateField('transport.patientConditionOnArrival', t.id === 'RED' ? 'CRITICAL' : (t.id === 'YELLOW' ? 'URGENT' : 'STABLE'))} className={`flex-1 py-3 rounded-lg text-sm font-semibold border transition-all ${formData.transport.patientConditionOnArrival === (t.id === 'RED' ? 'CRITICAL' : (t.id === 'YELLOW' ? 'URGENT' : 'STABLE')) ? `${t.color} text-white border-transparent shadow-md` : `bg-white text-slate-600 border-slate-300 ${t.hover}`}`}>
                                    {t.label}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
 
                     <SectionTitle title="Incident Crew" />
                     <CrewMembersListField
                        values={formData.crew}
                        onChange={(next) => updateField('crew', next)}
                     />
 
                     <SectionTitle title="Patient Consent & Signatures" />
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-1.5 relative group">
                           <div className="flex justify-between items-center min-h-[18px]">
                              <label className={labelCls}>Consent Type</label>
                              {aiMetadata['consent.consentType'] && aiMetadata['consent.consentType'].status === 'filled' && (
                                 <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase">
                                    ✔ AI Filled ({Math.round(aiMetadata['consent.consentType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('consent.consentType')} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                              {aiMetadata['consent.consentType'] && aiMetadata['consent.consentType'].status === 'suggestion' && (
                                 <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse">
                                    💡 Suggestion ({Math.round(aiMetadata['consent.consentType'].confidence * 100)}%)
                                    <button type="button" onClick={() => dismissAiInfo('consent.consentType')} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
                                 </span>
                              )}
                           </div>
                           <select 
                              value={formData.consent.consentType} 
                              onChange={e => {
                                 updateField('consent.consentType', e.target.value);
                                 if (aiMetadata['consent.consentType']) dismissAiInfo('consent.consentType');
                              }} 
                              className={inputCls + (aiMetadata['consent.consentType']?.status === 'filled' ? ' border-emerald-500 ring-1 ring-emerald-500' : (aiMetadata['consent.consentType']?.status === 'suggestion' ? ' border-amber-500 ring-1 ring-amber-500' : ''))}>
                              <option value="VERBAL">Verbal</option>
                              <option value="WRITTEN">Written</option>
                              <option value="IMPLIED">Implied</option>
                              <option value="GUARDIAN">Guardian</option>
                              <option value="REFUSED">Refused</option>
                           </select>
                           {aiMetadata['consent.consentType'] && aiMetadata['consent.consentType'].status === 'suggestion' && (
                              <div className="mt-1 flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                 <span className="text-amber-800 font-medium truncate">AI: &quot;{aiMetadata['consent.consentType'].value}&quot;</span>
                                 <button type="button" onClick={() => acceptAiSuggestion('consent.consentType')} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                                    Accept
                                 </button>
                              </div>
                           )}
                        </div>
                        <ToggleField label="Patient Consent Obtained" field="consent.patientConsentObtained" value={formData.consent.patientConsentObtained} update={updateField} aiInfo={aiMetadata['consent.patientConsentObtained']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Patient Informed of Risks" field="consent.patientInformedOfRisks" value={formData.consent.patientInformedOfRisks} update={updateField} aiInfo={aiMetadata['consent.patientInformedOfRisks']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Patient Has Decision Capacity" field="consent.patientHasDecisionCapacity" value={formData.consent.patientHasDecisionCapacity} update={updateField} aiInfo={aiMetadata['consent.patientHasDecisionCapacity']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        <ToggleField label="Refusal of Care" field="consent.refusalOfCare" value={formData.consent.refusalOfCare} update={updateField} aiInfo={aiMetadata['consent.refusalOfCare']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        
                        {formData.consent.refusalOfCare && (
                           <>
                              <Field label="Refusal Reason" field="consent.refusalReason" value={formData.consent.refusalReason} update={updateField} aiInfo={aiMetadata['consent.refusalReason']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <ToggleField label="Refusal Witnessed" field="consent.refusalWitnessed" value={formData.consent.refusalWitnessed} update={updateField} aiInfo={aiMetadata['consent.refusalWitnessed']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Refusal Witness Name" field="consent.witnessName" value={formData.consent.witnessName} update={updateField} aiInfo={aiMetadata['consent.witnessName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Refusal Witness Contact" field="consent.witnessContact" value={formData.consent.witnessContact} update={updateField} aiInfo={aiMetadata['consent.witnessContact']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           </>
                        )}
 
                        <div className="md:col-span-2 lg:col-span-3">
                           <Field label="Decision Capacity Assessment Notes" field="consent.capacityAssessmentNotes" value={formData.consent.capacityAssessmentNotes} update={updateField} aiInfo={aiMetadata['consent.capacityAssessmentNotes']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        </div>
 
                        <ToggleField label="Guardian Consent Obtained" field="consent.guardianConsentObtained" value={formData.consent.guardianConsentObtained} update={updateField} aiInfo={aiMetadata['consent.guardianConsentObtained']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                        {formData.consent.guardianConsentObtained && (
                           <>
                              <Field label="Guardian Name" field="consent.guardianName" value={formData.consent.guardianName} update={updateField} aiInfo={aiMetadata['consent.guardianName']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Guardian Relationship" field="consent.guardianRelationship" value={formData.consent.guardianRelationship} update={updateField} aiInfo={aiMetadata['consent.guardianRelationship']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Guardian Phone" field="consent.guardianPhone" value={formData.consent.guardianPhone} update={updateField} aiInfo={aiMetadata['consent.guardianPhone']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           </>
                        )}
 
                        <div className="md:col-span-2 lg:col-span-3 border-t border-slate-100 pt-6 mt-6">
                           <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Signature Attachments</h4>
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <Field label="Patient Signature Attachment ID" field="consent.patientSignatureAttachmentId" value={formData.consent.patientSignatureAttachmentId} update={updateField} placeholder="att-patient-sig" aiInfo={aiMetadata['consent.patientSignatureAttachmentId']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Guardian Signature Attachment ID" field="consent.guardianSignatureAttachmentId" value={formData.consent.guardianSignatureAttachmentId} update={updateField} placeholder="att-guardian-sig" aiInfo={aiMetadata['consent.guardianSignatureAttachmentId']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                              <Field label="Crew Signature Attachment ID" field="consent.crewSignatureAttachmentId" value={formData.consent.crewSignatureAttachmentId} update={updateField} placeholder="att-crew-sig" aiInfo={aiMetadata['consent.crewSignatureAttachmentId']} onAcceptSuggestion={acceptAiSuggestion} onDismiss={dismissAiInfo} />
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {/* Navigation */}
               <div className="pt-8 border-t border-slate-200 flex justify-between items-center">
                  <button type="button" onClick={() => currentStep > 1 && setCurrentStep(s => s - 1)} disabled={currentStep === 1} className={`flex items-center gap-2 text-sm font-semibold transition-all ${currentStep === 1 ? 'opacity-0' : 'text-slate-500 hover:text-brand-blue'}`}>
                     <ChevronLeft size={18} /> Previous Step
                  </button>
                  {currentStep < 4 ? (
                     <button key="btn-next" type="button" onClick={handleNext} className="bg-brand-blue text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-md flex items-center gap-2">
                        Next Step <ChevronRight size={18} />
                     </button>
                  ) : (
                     <button key="btn-submit" type="submit" disabled={isSubmitting} className="bg-brand-blue text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-all shadow-md flex items-center gap-2">
                        {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        {recordId ? 'Update Record' : 'Save Record'}
                     </button>
                  )}
               </div>
            </form>
         </div>

         {/* Floating Voice Assistant Panel */}
         {showVoicePanel && (
            <div className="fixed bottom-6 right-6 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden z-50 text-white transition-all duration-300">
               <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-slate-500'}`} />
                     <span className="font-bold text-xs tracking-wider uppercase text-slate-300">ePCR Voice Assistant</span>
                  </div>
                  <button type="button" onClick={() => setShowVoicePanel(false)} className="text-slate-400 hover:text-white transition-colors text-sm font-bold font-sans">×</button>
               </div>
               
               <div className="p-5 space-y-4">
                  <textarea
                     value={voiceTranscript}
                     onChange={(e) => setVoiceTranscript(e.target.value)}
                     disabled={isListening || isProcessingVoice}
                     placeholder={isListening ? 'Listening for speech...' : 'Type or paste patient care details here, or click "Start Dictation" to speak...'}
                     className="w-full bg-slate-950/60 text-slate-200 rounded-xl p-3 border border-slate-800/80 h-36 outline-none resize-none scrollbar-thin text-xs focus:border-brand-blue/50 transition-colors"
                  />
                  
                  <div className="flex gap-2">
                     <button
                        type="button"
                        onClick={toggleListening}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-2 shadow ${
                           isListening 
                              ? 'bg-gradient-to-br from-brand-red to-brand-red-dark hover:from-red-500 hover:to-brand-red text-white animate-pulse' 
                              : 'bg-gradient-to-br from-brand-blue to-brand-blue-dark hover:from-brand-blue-light hover:to-brand-blue text-white'
                        }`}
                     >
                        {isListening ? (
                           <>
                              <MicOff size={14} />
                              <span>Stop Recording</span>
                           </>
                        ) : (
                           <>
                              <Mic size={14} />
                              <span>Start Dictation</span>
                           </>
                        )}
                     </button>
                     
                     <button
                        type="button"
                        onClick={processVoiceTranscript}
                        disabled={isProcessingVoice || !voiceTranscript.trim()}
                        className="flex-1 bg-brand-blue text-white py-2.5 rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow"
                     >
                        {isProcessingVoice ? (
                           <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Extracting...</span>
                           </>
                        ) : (
                           <>
                              <Sparkles size={14} />
                              <span>Fill Form</span>
                           </>
                        )}
                     </button>
                  </div>
                  
                  {voiceTranscript && (
                     <div className="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-800 pt-3">
                        <span>{voiceTranscript.split(' ').length} words captured</span>
                        <button 
                           type="button" 
                           onClick={() => setVoiceTranscript('')} 
                           className="text-slate-400 hover:text-red-400 font-bold transition-colors uppercase tracking-wider"
                        >
                           Clear Text
                        </button>
                     </div>
                  )}
               </div>
            </div>
         )}
         
         {/* Small restore button if panel is closed but mic is active */}
         {!showVoicePanel && isListening && (
            <button
               type="button"
               onClick={() => setShowVoicePanel(true)}
               className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-brand-red to-brand-red-dark hover:from-red-500 hover:to-brand-red text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce z-50 transition-all border border-red-500"
            >
               <Mic size={24} className="animate-pulse" />
            </button>
         )}
      </div>
   );
};

const SectionTitle = ({ title }) => (
   <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
      <div className="w-1 h-5 bg-brand-blue rounded-full" />
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
   </div>
);

const Field = ({ label, field, value, update, type = 'text', required = false, disabled = false, maxLength, error, placeholder = '', aiInfo, onAcceptSuggestion, onDismiss }) => {
   let borderStyle = '';
   if (aiInfo) {
      if (aiInfo.status === 'filled') {
         borderStyle = ' border-emerald-500 ring-1 ring-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';
      } else if (aiInfo.status === 'suggestion') {
         borderStyle = ' border-amber-500 ring-1 ring-amber-500 focus:border-amber-500 focus:ring-amber-500';
      }
   }

   return (
      <div className="flex flex-col gap-1.5 relative group">
         <div className="flex justify-between items-center min-h-[18px]">
            <label className={error ? 'text-xs font-semibold text-brand-red leading-none' : (required ? labelReqCls : labelCls)}>{label}</label>
            {aiInfo && aiInfo.status === 'filled' && (
               <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                  ✔ AI Filled ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
            {aiInfo && aiInfo.status === 'suggestion' && (
               <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                  💡 Suggestion ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
         </div>
         <input
            type={type} value={value ?? ''} onChange={e => {
               update(field, e.target.value);
               if (aiInfo) onDismiss(field);
            }} required={required} disabled={disabled} maxLength={maxLength} placeholder={placeholder}
            className={(error ? 'w-full bg-white border border-brand-red rounded-lg px-4 py-3 text-sm text-brand-red placeholder:text-red-300 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all' : (required ? inputReqCls : inputCls)) + (disabled ? ' opacity-60 bg-slate-100 cursor-not-allowed' : '') + borderStyle}
         />
         {aiInfo && aiInfo.status === 'suggestion' && (
            <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
               <span className="text-amber-800 font-medium truncate">AI: &quot;{aiInfo.value}&quot;</span>
               <button type="button" onClick={() => onAcceptSuggestion(field)} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                  Accept
               </button>
            </div>
         )}
         {error && <p className="text-xs font-medium text-brand-red">{error}</p>}
      </div>
   );
};

const TextAreaField = ({ label, field, value, update, rows = 3, required = false, disabled = false, placeholder = '', error, aiInfo, onAcceptSuggestion, onDismiss }) => {
   let borderStyle = '';
   if (aiInfo) {
      if (aiInfo.status === 'filled') {
         borderStyle = ' border-emerald-500 ring-1 ring-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';
      } else if (aiInfo.status === 'suggestion') {
         borderStyle = ' border-amber-500 ring-1 ring-amber-500 focus:border-amber-500 focus:ring-amber-500';
      }
   }

   return (
      <div className="flex flex-col gap-1.5 relative group w-full">
         <div className="flex justify-between items-center min-h-[18px]">
            <label className={required ? labelReqCls : labelCls}>{label}</label>
            {aiInfo && aiInfo.status === 'filled' && (
               <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                  ✔ AI Filled ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
            {aiInfo && aiInfo.status === 'suggestion' && (
               <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                  💡 Suggestion ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
         </div>
         <textarea
            rows={rows} value={value ?? ''} onChange={e => {
               update(field, e.target.value);
               if (aiInfo) onDismiss(field);
            }} required={required} disabled={disabled} placeholder={placeholder}
            className={(error ? 'w-full bg-white border border-brand-red rounded-lg px-4 py-3 text-sm text-brand-red placeholder:text-red-300 focus:border-brand-red focus:ring-1 focus:ring-brand-red outline-none transition-all' : inputCls) + (disabled ? ' opacity-60 bg-slate-100 cursor-not-allowed' : '') + ' resize-none ' + borderStyle}
         />
         {aiInfo && aiInfo.status === 'suggestion' && (
            <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
               <span className="text-amber-800 font-medium truncate">AI: &quot;{aiInfo.value}&quot;</span>
               <button type="button" onClick={() => onAcceptSuggestion(field)} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                  Accept
               </button>
            </div>
         )}
         {error && <p className="text-xs font-medium text-brand-red">{error}</p>}
      </div>
   );
};

const BulletListField = ({ label, addLabel, values = [], onChange, placeholder }) => {
   const list = Array.isArray(values) ? values : [];
   const updateItem = (index, value) => {
      const next = [...list];
      next[index] = value;
      onChange(next);
   };
   const removeItem = (index) => onChange(list.filter((_, i) => i !== index));
   const addItem = () => onChange([...list, '']);

   return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
         <div className="flex items-center justify-between gap-3">
            <label className={labelCls}>{label}</label>
            <button
               type="button"
               onClick={addItem}
               className="inline-flex items-center gap-1 rounded-lg bg-brand-blue px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-all"
            >
               <FilePlus2 size={14} /> {addLabel}
            </button>
         </div>
         <div className="space-y-2">
            {list.length === 0 ? (
               <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-400">No items added.</p>
            ) : list.map((item, index) => (
               <div key={index} className="flex items-center gap-2">
                  <span className="text-brand-blue font-black">•</span>
                  <input
                     type="text"
                     value={item}
                     onChange={(e) => updateItem(index, e.target.value)}
                     placeholder={placeholder}
                     className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                  />
                  <button type="button" onClick={() => removeItem(index)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:border-brand-red hover:text-brand-red transition-all">
                     Remove
                  </button>
               </div>
            ))}
         </div>
      </div>
   );
};

const ToggleField = ({ label, field, value, update, aiInfo, onAcceptSuggestion, onDismiss }) => {
   let borderStyle = '';
   if (aiInfo) {
      if (aiInfo.status === 'filled') {
         borderStyle = ' border-emerald-500 ring-1 ring-emerald-500';
      } else if (aiInfo.status === 'suggestion') {
         borderStyle = ' border-amber-500 ring-1 ring-amber-500';
      }
   }
   return (
      <div className="flex flex-col gap-1.5 relative group">
         <div className="flex justify-between items-center min-h-[18px]">
            <label className={labelCls}>{label}</label>
            {aiInfo && aiInfo.status === 'filled' && (
               <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 uppercase shrink-0">
                  ✔ AI Filled ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
            {aiInfo && aiInfo.status === 'suggestion' && (
               <span className="text-[10px] font-black tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 uppercase animate-pulse shrink-0">
                  💡 Suggestion ({Math.round(aiInfo.confidence * 100)}%)
                  <button type="button" onClick={() => onDismiss(field)} className="text-amber-500 hover:text-amber-800 font-bold ml-1 font-sans">×</button>
               </span>
            )}
         </div>
         <button
            type="button"
            onClick={() => {
               update(field, !value);
               if (aiInfo) onDismiss(field);
            }}
            className={`w-full py-3 rounded-lg text-sm font-semibold border transition-all ${value ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-600 border-slate-300 hover:border-brand-blue/50'} ${borderStyle}`}
         >
            {value ? 'Yes' : 'No'}
         </button>
         {aiInfo && aiInfo.status === 'suggestion' && (
            <div className="flex items-center justify-between text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100">
               <span className="text-amber-800 font-medium truncate">AI Suggestion: &quot;{aiInfo.value ? 'Yes' : 'No'}&quot;</span>
               <button type="button" onClick={() => onAcceptSuggestion(field)} className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded hover:bg-amber-600 transition-all shrink-0">
                  Accept
               </button>
            </div>
         )}
      </div>
   );
};

const CrewMembersListField = ({ values = [], onChange }) => {
   const list = Array.isArray(values) ? values : [];
   const [newCrew, setNewCrew] = useState({
      paramedicsId: '',
      name: '',
      role: 'Lead Paramedic',
      certificationLevel: 'ALS',
      certificationNumber: '',
      certificationExpiryDate: '',
      primaryClinician: false
   });

   const addCrew = () => {
      if (!newCrew.name) return;
      onChange([...list, { ...newCrew, paramedicsId: newCrew.paramedicsId || `paramedic-${Date.now()}` }]);
      setNewCrew({
         paramedicsId: '',
         name: '',
         role: 'Lead Paramedic',
         certificationLevel: 'ALS',
         certificationNumber: '',
         certificationExpiryDate: '',
         primaryClinician: false
      });
   };

   const removeCrew = (index) => {
      onChange(list.filter((_, i) => i !== index));
   };

   return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">Crew Members</h4>
            <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2.5 py-1 rounded-full">{list.length} Members</span>
         </div>
         {list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {list.map((c, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 relative shadow-sm hover:shadow transition-all">
                     <button type="button" onClick={() => removeCrew(index)} className="absolute top-3 right-3 text-slate-400 hover:text-brand-red text-xs font-bold transition-colors">
                        Remove
                     </button>
                     <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                     <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.role} | {c.certificationLevel}</p>
                     <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                        <div>Cert #: {c.certificationNumber || 'N/A'}</div>
                        <div>Expires: {c.certificationExpiryDate || 'N/A'}</div>
                     </div>
                     {c.primaryClinician && (
                        <span className="mt-2.5 inline-block text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded uppercase tracking-wider">Primary Clinician</span>
                     )}
                  </div>
               ))}
            </div>
         )}

         {/* Sub-form to add a new member */}
         <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Crew Member</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
                  <input type="text" value={newCrew.name} onChange={e => setNewCrew(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="Alex Carter" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Paramedic ID</label>
                  <input type="text" value={newCrew.paramedicsId} onChange={e => setNewCrew(prev => ({ ...prev, paramedicsId: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="ALS-1001" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Role</label>
                  <select value={newCrew.role} onChange={e => setNewCrew(prev => ({ ...prev, role: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none">
                     <option value="Lead Paramedic">Lead Paramedic</option>
                     <option value="Second Paramedic">Second Paramedic</option>
                     <option value="Driver">Driver</option>
                     <option value="Observer">Observer</option>
                     <option value="Attending Paramedic">Attending Paramedic</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cert Level</label>
                  <select value={newCrew.certificationLevel} onChange={e => setNewCrew(prev => ({ ...prev, certificationLevel: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none">
                     <option value="ALS">ALS (Advanced Life Support)</option>
                     <option value="BLS">BLS (Basic Life Support)</option>
                     <option value="CCT">Critical Care Transport</option>
                     <option value="EMT">EMT</option>
                     <option value="Paramedic">Paramedic</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cert #</label>
                  <input type="text" value={newCrew.certificationNumber} onChange={e => setNewCrew(prev => ({ ...prev, certificationNumber: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="ALS-1001" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Expiry Date</label>
                  <input type="date" value={newCrew.certificationExpiryDate} onChange={e => setNewCrew(prev => ({ ...prev, certificationExpiryDate: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
            </div>
            <div className="flex justify-between items-center pt-2">
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newCrew.primaryClinician} onChange={e => setNewCrew(prev => ({ ...prev, primaryClinician: e.target.checked }))} className="rounded text-brand-blue border-slate-300 focus:ring-brand-blue" />
                  Primary Clinician
               </label>
               <button type="button" onClick={addCrew} disabled={!newCrew.name} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                  + Add Member
               </button>
            </div>
         </div>
      </div>
   );
};

const StructuredComplaintsListField = ({ values = [], onChange }) => {
   const list = Array.isArray(values) ? values : [];
   const [newComp, setNewComp] = useState({
      complaint: '',
      onset: 'Sudden',
      onsetTime: '',
      provocation: '',
      quality: '',
      radiation: '',
      severity: 5,
      timing: 'Constant',
      associatedSymptoms: '',
      traumaRelated: false
   });

   const addComp = () => {
      if (!newComp.complaint) return;
      onChange([...list, { ...newComp, severity: Number(newComp.severity) }]);
      setNewComp({
         complaint: '',
         onset: 'Sudden',
         onsetTime: '',
         provocation: '',
         quality: '',
         radiation: '',
         severity: 5,
         timing: 'Constant',
         associatedSymptoms: '',
         traumaRelated: false
      });
   };

   const removeComp = (index) => {
      onChange(list.filter((_, i) => i !== index));
   };

   return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">Structured Complaints</h4>
            <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2.5 py-1 rounded-full">{list.length} Complaints</span>
         </div>
         {list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
               {list.map((c, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 relative shadow-sm hover:shadow transition-all">
                     <button type="button" onClick={() => removeComp(index)} className="absolute top-3 right-3 text-slate-400 hover:text-brand-red text-xs font-bold transition-colors">
                        Remove
                     </button>
                     <p className="font-bold text-slate-800 text-sm">{c.complaint} {c.traumaRelated && <span className="text-[9px] bg-brand-red/10 text-brand-red font-black px-1.5 py-0.5 rounded ml-1 uppercase">TRAUMA</span>}</p>
                     <p className="text-xs font-medium text-slate-500 mt-1">Onset: {c.onset} | Severity: <span className="font-bold text-brand-blue">{c.severity}/10</span></p>
                     <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                        {c.provocation && <div>Provoked by: {c.provocation}</div>}
                        {c.quality && <div>Quality: {c.quality}</div>}
                        {c.radiation && <div>Radiation: {c.radiation}</div>}
                        {c.timing && <div>Timing: {c.timing}</div>}
                        {c.associatedSymptoms && <div className="col-span-2">Symptoms: {c.associatedSymptoms}</div>}
                        {c.onsetTime && <div className="col-span-2">Onset Time: {c.onsetTime.replace('T', ' ')}</div>}
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Sub-form to add a new complaint */}
         <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Structured Complaint</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Complaint</label>
                  <input type="text" value={newComp.complaint} onChange={e => setNewComp(prev => ({ ...prev, complaint: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Chest pain" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Onset</label>
                  <select value={newComp.onset} onChange={e => setNewComp(prev => ({ ...prev, onset: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none">
                     <option value="Sudden">Sudden</option>
                     <option value="Gradual">Gradual</option>
                     <option value="N/A">N/A</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Onset Timestamp</label>
                  <input type="datetime-local" value={newComp.onsetTime} onChange={e => setNewComp(prev => ({ ...prev, onsetTime: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Provocation</label>
                  <input type="text" value={newComp.provocation} onChange={e => setNewComp(prev => ({ ...prev, provocation: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Exertion" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Quality</label>
                  <input type="text" value={newComp.quality} onChange={e => setNewComp(prev => ({ ...prev, quality: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Sharp / Pressure" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Radiation</label>
                  <input type="text" value={newComp.radiation} onChange={e => setNewComp(prev => ({ ...prev, radiation: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Left arm / Jaw" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Severity (0-10): <span className="font-extrabold text-brand-blue">{newComp.severity}</span></label>
                  <input type="range" min="0" max="10" value={newComp.severity} onChange={e => setNewComp(prev => ({ ...prev, severity: e.target.value }))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-blue focus:outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Timing</label>
                  <input type="text" value={newComp.timing} onChange={e => setNewComp(prev => ({ ...prev, timing: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Constant / Intermittent" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Associated Symptoms</label>
                  <input type="text" value={newComp.associatedSymptoms} onChange={e => setNewComp(prev => ({ ...prev, associatedSymptoms: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Sweating, nausea" />
               </div>
            </div>
            <div className="flex justify-between items-center pt-2">
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newComp.traumaRelated} onChange={e => setNewComp(prev => ({ ...prev, traumaRelated: e.target.checked }))} className="rounded text-brand-blue border-slate-300 focus:ring-brand-blue" />
                  Trauma Related
               </label>
               <button type="button" onClick={addComp} disabled={!newComp.complaint} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                  + Add Complaint
               </button>
            </div>
         </div>
      </div>
   );
};

const StructuredVitalsListField = ({ values = [], onChange }) => {
   const list = Array.isArray(values) ? values : [];
   const [newV, setNewV] = useState({
      recordedAt: '',
      heartRate: '',
      systolicBP: '',
      diastolicBP: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      oxygenDeliveryMethod: '',
      temperature: '',
      temperatureRoute: 'ORAL',
      glasgowComaScale: '',
      gcEye: '',
      gcVerbal: '',
      gcMotor: '',
      avpu: 'A',
      painScore: '',
      painLocation: '',
      bloodGlucose: '',
      skinColor: '',
      skinCondition: '',
      skinTemperature: '',
      pupilLeft: '',
      pupilRight: '',
      pupilsEqual: true,
      pupilsReactive: true
   });

   const addV = () => {
      const gcsVal = (Number(newV.gcEye) || 0) + (Number(newV.gcVerbal) || 0) + (Number(newV.gcMotor) || 0);
      onChange([...list, {
         ...newV,
         recordedAt: newV.recordedAt || new Date().toISOString().substring(0, 16),
         heartRate: newV.heartRate ? Number(newV.heartRate) : null,
         systolicBP: newV.systolicBP ? Number(newV.systolicBP) : null,
         diastolicBP: newV.diastolicBP ? Number(newV.diastolicBP) : null,
         respiratoryRate: newV.respiratoryRate ? Number(newV.respiratoryRate) : null,
         oxygenSaturation: newV.oxygenSaturation ? Number(newV.oxygenSaturation) : null,
         temperature: newV.temperature ? Number(newV.temperature) : null,
         glasgowComaScale: gcsVal || (newV.glasgowComaScale ? Number(newV.glasgowComaScale) : null),
         gcEye: newV.gcEye ? Number(newV.gcEye) : null,
         gcVerbal: newV.gcVerbal ? Number(newV.gcVerbal) : null,
         gcMotor: newV.gcMotor ? Number(newV.gcMotor) : null,
         painScore: newV.painScore ? Number(newV.painScore) : null,
         bloodGlucose: newV.bloodGlucose ? Number(newV.bloodGlucose) : null
      }]);
      setNewV({
         recordedAt: '',
         heartRate: '',
         systolicBP: '',
         diastolicBP: '',
         respiratoryRate: '',
         oxygenSaturation: '',
         oxygenDeliveryMethod: '',
         temperature: '',
         temperatureRoute: 'ORAL',
         glasgowComaScale: '',
         gcEye: '',
         gcVerbal: '',
         gcMotor: '',
         avpu: 'A',
         painScore: '',
         painLocation: '',
         bloodGlucose: '',
         skinColor: '',
         skinCondition: '',
         skinTemperature: '',
         pupilLeft: '',
         pupilRight: '',
         pupilsEqual: true,
         pupilsReactive: true
      });
   };

   const removeV = (index) => {
      onChange(list.filter((_, i) => i !== index));
   };

   return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">Structured Vitals Logs</h4>
            <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2.5 py-1 rounded-full">{list.length} Logs</span>
         </div>
         {list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
               {list.map((c, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 relative shadow-sm hover:shadow transition-all">
                     <button type="button" onClick={() => removeV(index)} className="absolute top-3 right-3 text-slate-400 hover:text-brand-red text-xs font-bold transition-colors">
                        Remove
                     </button>
                     <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">Log #{index+1} | {c.recordedAt.replace('T', ' ')}</p>
                     <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs font-semibold text-slate-800">
                        {c.systolicBP && c.diastolicBP && <div>BP: <span className="text-brand-blue">{c.systolicBP}/{c.diastolicBP}</span></div>}
                        {c.heartRate && <div>HR: <span className="text-brand-blue">{c.heartRate} bpm</span></div>}
                        {c.respiratoryRate && <div>RR: <span className="text-brand-blue">{c.respiratoryRate}/min</span></div>}
                        {c.oxygenSaturation && <div>SpO2: <span className="text-emerald-600">{c.oxygenSaturation}%</span></div>}
                        {c.temperature && <div>Temp: <span className="text-brand-blue">{c.temperature}°C ({c.temperatureRoute})</span></div>}
                        {c.bloodGlucose && <div>Glucose: <span className="text-brand-blue">{c.bloodGlucose} mg/dL</span></div>}
                     </div>
                     <div className="mt-3.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-medium">
                        {c.glasgowComaScale && <div>GCS: <span className="font-bold text-brand-blue">{c.glasgowComaScale}</span> (E{c.gcEye} V{c.gcVerbal} M{c.gcMotor})</div>}
                        {c.avpu && <div>AVPU: <span className="font-bold">{c.avpu}</span></div>}
                        {c.painScore !== null && c.painScore !== undefined && <div>Pain: <span className="font-bold text-brand-red">{c.painScore}/10</span> {c.painLocation ? `(${c.painLocation})` : ''}</div>}
                        {c.skinColor && <div>Skin: {c.skinColor}, {c.skinCondition}, {c.skinTemperature}</div>}
                        {(c.pupilLeft || c.pupilRight) && <div>Pupils: L{c.pupilLeft} R{c.pupilRight} {c.pupilsEqual ? '(Equal' : '(Unequal'} {c.pupilsReactive ? 'Reactive)' : 'Nonreactive)'}</div>}
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Sub-form to add a new vital */}
         <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Vitals Log</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Recorded At</label>
                  <input type="datetime-local" value={newV.recordedAt} onChange={e => setNewV(prev => ({ ...prev, recordedAt: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Heart Rate (BPM)</label>
                  <input type="number" value={newV.heartRate} onChange={e => setNewV(prev => ({ ...prev, heartRate: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="88" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">BP Systolic</label>
                  <input type="number" value={newV.systolicBP} onChange={e => setNewV(prev => ({ ...prev, systolicBP: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="120" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">BP Diastolic</label>
                  <input type="number" value={newV.diastolicBP} onChange={e => setNewV(prev => ({ ...prev, diastolicBP: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="80" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Resp Rate (RR)</label>
                  <input type="number" value={newV.respiratoryRate} onChange={e => setNewV(prev => ({ ...prev, respiratoryRate: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="18" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">SpO2 (%)</label>
                  <input type="number" value={newV.oxygenSaturation} onChange={e => setNewV(prev => ({ ...prev, oxygenSaturation: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="96" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">O2 Delivery Method</label>
                  <input type="text" value={newV.oxygenDeliveryMethod} onChange={e => setNewV(prev => ({ ...prev, oxygenDeliveryMethod: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="Nasal cannula" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Temp (°C)</label>
                  <input type="number" step="0.1" value={newV.temperature} onChange={e => setNewV(prev => ({ ...prev, temperature: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="37.1" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Temp Route</label>
                  <select value={newV.temperatureRoute} onChange={e => setNewV(prev => ({ ...prev, temperatureRoute: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none">
                     <option value="ORAL">Oral</option>
                     <option value="TYMPANIC">Tympanic</option>
                     <option value="RECTAL">Rectal</option>
                     <option value="AXILLARY">Axillary</option>
                     <option value="TEMPORAL">Temporal</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Blood Glucose</label>
                  <input type="number" value={newV.bloodGlucose} onChange={e => setNewV(prev => ({ ...prev, bloodGlucose: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="108" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">AVPU</label>
                  <select value={newV.avpu} onChange={e => setNewV(prev => ({ ...prev, avpu: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none">
                     <option value="A">Alert</option>
                     <option value="V">Verbal</option>
                     <option value="P">Pain</option>
                     <option value="U">Unresponsive</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pain Score (0-10)</label>
                  <input type="number" min="0" max="10" value={newV.painScore} onChange={e => setNewV(prev => ({ ...prev, painScore: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="7" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pain Location</label>
                  <input type="text" value={newV.painLocation} onChange={e => setNewV(prev => ({ ...prev, painLocation: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="Chest" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">GCS Eye (1-4)</label>
                  <input type="number" min="1" max="4" value={newV.gcEye} onChange={e => setNewV(prev => ({ ...prev, gcEye: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="4" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">GCS Verbal (1-5)</label>
                  <input type="number" min="1" max="5" value={newV.gcVerbal} onChange={e => setNewV(prev => ({ ...prev, gcVerbal: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="5" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">GCS Motor (1-6)</label>
                  <input type="number" min="1" max="6" value={newV.gcMotor} onChange={e => setNewV(prev => ({ ...prev, gcMotor: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="6" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Skin Color</label>
                  <input type="text" value={newV.skinColor} onChange={e => setNewV(prev => ({ ...prev, skinColor: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="Normal" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Skin Condition</label>
                  <input type="text" value={newV.skinCondition} onChange={e => setNewV(prev => ({ ...prev, skinCondition: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="Dry" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Skin Temp</label>
                  <input type="text" value={newV.skinTemperature} onChange={e => setNewV(prev => ({ ...prev, skinTemperature: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="Warm" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pupil Left</label>
                  <input type="text" value={newV.pupilLeft} onChange={e => setNewV(prev => ({ ...prev, pupilLeft: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="3mm" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pupil Right</label>
                  <input type="text" value={newV.pupilRight} onChange={e => setNewV(prev => ({ ...prev, pupilRight: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:border-brand-blue outline-none" placeholder="3mm" />
               </div>
            </div>
            <div className="flex flex-wrap gap-6 pt-2">
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newV.pupilsEqual} onChange={e => setNewV(prev => ({ ...prev, pupilsEqual: e.target.checked }))} className="rounded text-brand-blue border-slate-300 focus:ring-brand-blue" />
                  Pupils Equal
               </label>
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newV.pupilsReactive} onChange={e => setNewV(prev => ({ ...prev, pupilsReactive: e.target.checked }))} className="rounded text-brand-blue border-slate-300 focus:ring-brand-blue" />
                  Pupils Reactive
               </label>
               <div className="flex-1 flex justify-end">
                  <button type="button" onClick={addV} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                     + Add Vitals Log
                  </button>
               </div>
            </div>
         </div>
      </div>
   );
};
const StructuredMedicationsListField = ({ values = [], onChange, allergy, currentMedicines }) => {
   const list = Array.isArray(values) ? values : [];
   const [alertModal, setAlertModal] = useState({
      open: false,
      title: '',
      message: '',
      riskLevel: '',
      onConfirm: null
   });
   const [newM, setNewM] = useState({
      medicationName: '',
      brandName: '',
      dosage: '',
      unit: 'mg',
      route: 'IV',
      administeredAt: '',
      administeredBy: '',
      administrationAttempts: 1,
      patientResponse: '',
      adverseReactionDetails: 'None',
      rxNormCode: '',
      indication: '',
      contraindications: 'None known',
      notes: ''
   });

   const addToList = () => {
      onChange([...list, {
         ...newM,
         dosage: newM.dosage ? Number(newM.dosage) : null,
         administrationAttempts: Number(newM.administrationAttempts) || 1,
         administeredAt: newM.administeredAt || new Date().toISOString().substring(0, 16)
      }]);
      setNewM({
         medicationName: '',
         brandName: '',
         dosage: '',
         unit: 'mg',
         route: 'IV',
         administeredAt: '',
         administeredBy: '',
         administrationAttempts: 1,
         patientResponse: '',
         adverseReactionDetails: 'None',
         rxNormCode: '',
         indication: '',
         contraindications: 'None known',
         notes: ''
      });
   };

   const addM = async () => {
      if (!newM.medicationName) return;

      try {
         const response = await client.post(`/api/medications/check-safety?medName=${encodeURIComponent(newM.medicationName)}`, {
            allergy: allergy || '',
            currentMedicines: currentMedicines || '',
            structuredMedications: list
         });

         const alerts = response.data || [];
         const highAlerts = alerts.filter(a => a.riskLevel === 'HIGH');
         const mediumAlerts = alerts.filter(a => a.riskLevel === 'MEDIUM');

         if (highAlerts.length > 0) {
            const warningText = highAlerts.map(a => a.warningMessage).join('\n');
            setAlertModal({
               open: true,
               title: 'CRITICAL SAFETY ALERT',
               message: warningText,
               riskLevel: 'HIGH',
               onConfirm: () => {
                  addToList();
                  setAlertModal(prev => ({ ...prev, open: false }));
               }
            });
         } else if (mediumAlerts.length > 0) {
            const warningText = mediumAlerts.map(a => a.warningMessage).join('\n');
            setAlertModal({
               open: true,
               title: 'CLINICAL WARNING CAUTION',
               message: warningText,
               riskLevel: 'MEDIUM',
               onConfirm: () => {
                  addToList();
                  setAlertModal(prev => ({ ...prev, open: false }));
               }
            });
         } else {
            addToList();
         }
      } catch (err) {
         console.error("Failed to check medication safety", err);
         addToList();
      }
   };

   const removeM = (index) => {
      onChange(list.filter((_, i) => i !== index));
   };

   return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">Structured Medications Administered</h4>
            <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2.5 py-1 rounded-full">{list.length} Medications</span>
         </div>
         {list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
               {list.map((c, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 relative shadow-sm hover:shadow transition-all">
                     <button type="button" onClick={() => removeM(index)} className="absolute top-3 right-3 text-slate-400 hover:text-brand-red text-xs font-bold transition-colors">
                        Remove
                     </button>
                     <p className="font-bold text-slate-800 text-sm">{c.medicationName} {c.brandName ? `(${c.brandName})` : ''}</p>
                     <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.dosage} {c.unit} via {c.route}</p>
                     <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                        {c.administeredAt && <div>Time: {c.administeredAt.replace('T', ' ')}</div>}
                        {c.administeredBy && <div>By: {c.administeredBy}</div>}
                        <div>Attempts: {c.administrationAttempts}</div>
                        {c.patientResponse && <div>Response: {c.patientResponse}</div>}
                        {c.indication && <div className="col-span-2">Indication: {c.indication}</div>}
                        {c.adverseReactionDetails && <div className="col-span-2">Adverse Reaction: {c.adverseReactionDetails}</div>}
                        {c.notes && <div className="col-span-2 text-slate-400 italic">Notes: {c.notes}</div>}
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Sub-form to add a new medication */}
         <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Medication</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Medication Name</label>
                  <input type="text" value={newM.medicationName} onChange={e => setNewM(prev => ({ ...prev, medicationName: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Midazolam" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Brand Name</label>
                  <input type="text" value={newM.brandName} onChange={e => setNewM(prev => ({ ...prev, brandName: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Versed" />
               </div>
               <div className="flex gap-2">
                  <div className="flex-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Dosage</label>
                     <input type="number" step="0.01" value={newM.dosage} onChange={e => setNewM(prev => ({ ...prev, dosage: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="2.0" />
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Unit</label>
                     <input type="text" value={newM.unit} onChange={e => setNewM(prev => ({ ...prev, unit: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="mg" />
                  </div>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Route</label>
                  <select value={newM.route} onChange={e => setNewM(prev => ({ ...prev, route: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none">
                     <option value="IV">IV</option>
                     <option value="IM">IM</option>
                     <option value="IN">IN</option>
                     <option value="PO">PO</option>
                     <option value="PR">PR</option>
                     <option value="SubQ">SubQ</option>
                     <option value="IO">IO</option>
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Administered At</label>
                  <input type="datetime-local" value={newM.administeredAt} onChange={e => setNewM(prev => ({ ...prev, administeredAt: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Administered By</label>
                  <input type="text" value={newM.administeredBy} onChange={e => setNewM(prev => ({ ...prev, administeredBy: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="Clinician Name" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Attempts</label>
                  <input type="number" value={newM.administrationAttempts} onChange={e => setNewM(prev => ({ ...prev, administrationAttempts: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Patient Response</label>
                  <input type="text" value={newM.patientResponse} onChange={e => setNewM(prev => ({ ...prev, patientResponse: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Improved" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Indication</label>
                  <input type="text" value={newM.indication} onChange={e => setNewM(prev => ({ ...prev, indication: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Anxiety" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">RxNorm Code</label>
                  <input type="text" value={newM.rxNormCode} onChange={e => setNewM(prev => ({ ...prev, rxNormCode: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. 6960" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Adverse Reaction Details</label>
                  <input type="text" value={newM.adverseReactionDetails} onChange={e => setNewM(prev => ({ ...prev, adverseReactionDetails: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Contraindications</label>
                  <input type="text" value={newM.contraindications} onChange={e => setNewM(prev => ({ ...prev, contraindications: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Medication Notes</label>
               <textarea rows={2} value={newM.notes} onChange={e => setNewM(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none resize-none" placeholder="e.g. Monitor respiratory status" />
            </div>
            <div className="flex justify-end pt-2">
               <button type="button" onClick={addM} disabled={!newM.medicationName} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                  + Add Medication
               </button>
            </div>
         </div>

         {/* Custom Warning Modal Alert */}
         {alertModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
               <div className="w-full max-w-lg bg-white rounded-2xl border border-red-500 shadow-2xl overflow-hidden transform scale-100 transition-all">
                  <div className="px-6 py-4 text-white flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700">
                     <AlertTriangle size={20} className="shrink-0" />
                     <h3 className="font-extrabold text-sm tracking-wider uppercase">{alertModal.title}</h3>
                  </div>
                  <div className="p-6 space-y-4">
                     <p className="text-slate-700 font-medium text-xs leading-relaxed whitespace-pre-line">
                        {alertModal.message}
                     </p>
                     
                     {alertModal.riskLevel === 'HIGH' ? (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg font-semibold">
                           ⚠️ WARNING: Administering this medication poses severe clinical risk. Do you want to override and log this anyway?
                        </p>
                     ) : (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg font-semibold">
                           ⚠️ CAUTION: Verify clinical indication before proceeding.
                        </p>
                     )}
                  </div>
                  <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
                     <button
                        type="button"
                        onClick={() => setAlertModal(prev => ({ ...prev, open: false }))}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold text-[10px] text-slate-600 uppercase tracking-wider transition-colors"
                     >
                        Cancel / Dismiss
                     </button>
                     <button
                        type="button"
                        onClick={alertModal.onConfirm}
                        className="px-5 py-2 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider shadow-md transition-all bg-gradient-to-br from-red-600 to-red-700 hover:from-red-500 hover:to-red-600"
                     >
                        {alertModal.riskLevel === 'HIGH' ? 'Override & Administer' : 'Acknowledge & Add'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

const StructuredProceduresListField = ({ values = [], onChange }) => {
   const list = Array.isArray(values) ? values : [];
   const [newP, setNewP] = useState({
      procedureName: '',
      performedAt: '',
      performedBy: '',
      successful: true,
      attempts: 1,
      bodysite: '',
      complications: 'None',
      patientResponse: 'Stable',
      snomedCode: '',
      notes: ''
   });

   const addP = () => {
      if (!newP.procedureName) return;
      onChange([...list, {
         ...newP,
         attempts: Number(newP.attempts) || 1,
         performedAt: newP.performedAt || new Date().toISOString().substring(0, 16)
      }]);
      setNewP({
         procedureName: '',
         performedAt: '',
         performedBy: '',
         successful: true,
         attempts: 1,
         bodysite: '',
         complications: 'None',
         patientResponse: 'Stable',
         snomedCode: '',
         notes: ''
      });
   };

   const removeP = (index) => {
      onChange(list.filter((_, i) => i !== index));
   };

   return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-bold text-slate-800">Structured Procedures Performed</h4>
            <span className="text-xs bg-brand-blue/10 text-brand-blue font-bold px-2.5 py-1 rounded-full">{list.length} Procedures</span>
         </div>
         {list.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
               {list.map((c, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 relative shadow-sm hover:shadow transition-all">
                     <button type="button" onClick={() => removeP(index)} className="absolute top-3 right-3 text-slate-400 hover:text-brand-red text-xs font-bold transition-colors">
                        Remove
                     </button>
                     <p className="font-bold text-slate-800 text-sm">{c.procedureName} {c.successful ? <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded ml-1 uppercase">SUCCESSFUL</span> : <span className="text-[9px] bg-brand-red/10 text-brand-red font-black px-1.5 py-0.5 rounded ml-1 uppercase">FAILED</span>}</p>
                     <p className="text-xs font-semibold text-brand-blue mt-1 uppercase tracking-wider">{c.bodysite ? `Site: ${c.bodysite}` : 'Site: Unspecified'} | Attempts: {c.attempts}</p>
                     <div className="mt-2.5 pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500 font-medium">
                        {c.performedAt && <div>Time: {c.performedAt.replace('T', ' ')}</div>}
                        {c.performedBy && <div>By: {c.performedBy}</div>}
                        {c.patientResponse && <div>Response: {c.patientResponse}</div>}
                        {c.snomedCode && <div>SNOMED: {c.snomedCode}</div>}
                        {c.complications && <div className="col-span-2">Complications: {c.complications}</div>}
                        {c.notes && <div className="col-span-2 text-slate-400 italic">Notes: {c.notes}</div>}
                     </div>
                  </div>
               ))}
            </div>
         )}

         {/* Sub-form to add a new procedure */}
         <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-inner">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Procedure</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Procedure Name</label>
                  <input type="text" value={newP.procedureName} onChange={e => setNewP(prev => ({ ...prev, procedureName: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Mechanical ventilation" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Performed At</label>
                  <input type="datetime-local" value={newP.performedAt} onChange={e => setNewP(prev => ({ ...prev, performedAt: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Performed By</label>
                  <input type="text" value={newP.performedBy} onChange={e => setNewP(prev => ({ ...prev, performedBy: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="Clinician Name" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Attempts</label>
                  <input type="number" value={newP.attempts} onChange={e => setNewP(prev => ({ ...prev, attempts: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Body Site</label>
                  <input type="text" value={newP.bodysite} onChange={e => setNewP(prev => ({ ...prev, bodysite: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Airway" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">SNOMED Code</label>
                  <input type="text" value={newP.snomedCode} onChange={e => setNewP(prev => ({ ...prev, snomedCode: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. 40617009" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Complications</label>
                  <input type="text" value={newP.complications} onChange={e => setNewP(prev => ({ ...prev, complications: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" />
               </div>
               <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Patient Response</label>
                  <input type="text" value={newP.patientResponse} onChange={e => setNewP(prev => ({ ...prev, patientResponse: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none" placeholder="e.g. Stable" />
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Procedure Notes</label>
               <textarea rows={2} value={newP.notes} onChange={e => setNewP(prev => ({ ...prev, notes: e.target.value }))} className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none resize-none" placeholder="e.g. No complications" />
            </div>
            <div className="flex justify-between items-center pt-2">
               <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newP.successful} onChange={e => setNewP(prev => ({ ...prev, successful: e.target.checked }))} className="rounded text-brand-blue border-slate-300 focus:ring-brand-blue" />
                  Successful Procedure
               </label>
               <button type="button" onClick={addP} disabled={!newP.procedureName} className="bg-brand-blue text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:opacity-50">
                  + Add Procedure
               </button>
            </div>
         </div>
      </div>
   );
};

export default CreateRecord;
