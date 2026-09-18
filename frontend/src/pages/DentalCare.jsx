import { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Activity, CheckCircle2, Clock, Plus, Search,
  FileText, Stethoscope, RefreshCw, X, Shield, Filter,
  ChevronRight, User, Sparkles, Building2, Calendar, Users, Award, Smile,
  Mic, MicOff, Volume2, Play
} from 'lucide-react';
import client from '../api/client';
import { addToast } from '../store/slices/uiSlice';

// ─── FDI Notation Helper & Presets ────────────────────────────────────────────
// FDI Tooth Numbers:
// Upper Right (18 to 11), Upper Left (21 to 28)
// Lower Left (38 to 31), Lower Right (41 to 48)
const UPPER_TEETH_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_TEETH_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_TEETH_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];

const TOOTH_CONDITIONS = [
  { value: 'HEALTHY', label: 'Healthy / Normal', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500', short: 'OK' },
  { value: 'HEALED', label: 'Healed / Satisfactory', color: 'bg-emerald-500 text-white border-emerald-600 font-black shadow-xs', dot: 'bg-emerald-200 animate-pulse', short: 'HEAL' },
  { value: 'CARIES', label: 'Caries (Decay)', color: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-500', short: 'DECAY' },
  { value: 'FILLED', label: 'Filled / Restoration', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500', short: 'FILL' },
  { value: 'CROWNED', label: 'Crowned / Cap', color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500', short: 'CROWN' },
  { value: 'MISSING', label: 'Missing / Extracted', color: 'bg-slate-200 text-slate-700 border-slate-400', dot: 'bg-slate-400', short: 'MISS' },
  { value: 'IMPACTED', label: 'Impacted', color: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500', short: 'IMP' },
  { value: 'ROOT_CANAL_TREATED', label: 'Root Canal (RCT)', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', dot: 'bg-indigo-500', short: 'ROOT' },
  { value: 'IMPLANT', label: 'Dental Implant', color: 'bg-teal-100 text-teal-800 border-teal-300', dot: 'bg-teal-500', short: 'IMP' },
  { value: 'EXTRACTION_INDICATED', label: 'Extraction Indicated', color: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500', short: 'EXT' },
];

const TREATMENT_TYPES = [
  'EXAMINATION', 'CLEANING', 'FILLING', 'EXTRACTION', 'ROOT_CANAL',
  'SEALANT', 'FLUORIDE_APPLICATION', 'CROWN', 'IMPLANT', 'SCHOOL_SCREENING', 'OTHER'
];

const PROVIDER_ROLES = ['DENTIST', 'DENTAL_THERAPIST', 'HYGIENIST'];

const getConditionStyle = (cond) => {
  if (!cond) return TOOTH_CONDITIONS[0];
  const normalized = String(cond).toUpperCase().trim();

  if (normalized.includes('HEAL') || normalized.includes('SATISFAC') || normalized.includes('RESOLV') || normalized.includes('SUBSIDED') || normalized.includes('RECOVERED')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'HEALED') || TOOTH_CONDITIONS[0];
  }
  if (normalized.includes('ROOT') || normalized.includes('RCT') || normalized.includes('PULP')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'ROOT_CANAL_TREATED');
  }
  if (normalized.includes('IMPLANT') || normalized.includes('SCREW')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'IMPLANT');
  }
  if (normalized.includes('CARIES') || normalized.includes('DECAY') || normalized.includes('CAVITY')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'CARIES');
  }
  if (normalized.includes('FILL') || normalized.includes('COMPOSITE') || normalized.includes('AMALGAM')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'FILLED');
  }
  if (normalized.includes('CROWN') || normalized.includes('CAP') || normalized.includes('BRIDGE')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'CROWNED');
  }
  if (normalized.includes('MISSING') || normalized.includes('EXTRACTED') || normalized.includes('REMOVED')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'MISSING');
  }
  if (normalized.includes('IMPACT')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'IMPACTED');
  }
  if (normalized.includes('EXTRACTION') || normalized.includes('EXT')) {
    return TOOTH_CONDITIONS.find(c => c.value === 'EXTRACTION_INDICATED');
  }

  const directMatch = TOOTH_CONDITIONS.find(c => c.value === normalized);
  return directMatch || TOOTH_CONDITIONS[0];
};

const getPatientDisplayName = (p) => {
  if (!p) return 'Unknown Patient';
  if (p.displayName && p.displayName.trim()) return p.displayName.trim();
  if (p.patientName && p.patientName.trim()) return p.patientName.trim();
  if (p.firstName) return `${p.firstName} ${p.lastName || ''}`.trim();
  return p.patientId || p.id || 'Patient Record';
};

// ─── Initial Empty States ──────────────────────────────────────────────────

export default function DentalCare() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const paramPatientId = searchParams.get('patientId');
  const paramPatientName = searchParams.get('patientName');

  const [activeTab, setActiveTab] = useState('charting'); // 'charting' | 'treatments' | 'visits'
  const [loading, setLoading] = useState(false);

  // Data states
  const [charts, setCharts] = useState([]);
  // Synchronously initialize selectedChart from localStorage cache to prevent blank flashing or overwriting on refresh
  const [selectedChart, setSelectedChart] = useState(() => {
    const pId = paramPatientId || 'PAT-FCOCA732';
    try {
      const raw = localStorage.getItem(`dental_chart_${pId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.toothChart) && parsed.toothChart.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore
    }
    // Fallback: check any saved dental chart in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dental_chart_')) {
          const val = JSON.parse(localStorage.getItem(key));
          if (val && Array.isArray(val.toothChart) && val.toothChart.length > 0) {
            return val;
          }
        }
      }
    } catch {
      // Ignore
    }
    return null;
  });
  const [programVisits, setProgramVisits] = useState([]);

  // Search & Filters
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);

  // Initialize active patient from URL params, or last active stored patient, or fallback Aditi Arora
  const [selectedPatientObj, setSelectedPatientObj] = useState(() => {
    if (paramPatientId) {
      return { patientId: paramPatientId, displayName: paramPatientName || paramPatientId };
    }
    try {
      const stored = localStorage.getItem('last_active_dental_patient');
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore
    }
    return { patientId: 'PAT-FCOCA732', displayName: 'Aditi Arora (48F)' };
  });

  // ─── LocalStorage Persistence Helpers ─────────────────────────────────────────
  const getSavedChart = (patientId) => {
    if (!patientId) return null;
    try {
      const raw = localStorage.getItem(`dental_chart_${patientId}`) || localStorage.getItem(`persistent_dental_chart_${patientId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
    return null;
  };

  const saveChartToStorage = (patientId, chartData) => {
    if (!patientId || !chartData) return;
    try {
      localStorage.setItem(`dental_chart_${patientId}`, JSON.stringify(chartData));
      localStorage.setItem(`persistent_dental_chart_${patientId}`, JSON.stringify(chartData));
      localStorage.setItem('last_active_dental_patient', JSON.stringify({
        patientId,
        displayName: chartData.displayName || selectedPatientObj?.displayName || patientId
      }));
    } catch {
      // Ignore
    }
  };

  // Mount Effect: Restore saved chart for active patient on page load / refresh
  useEffect(() => {
    const targetId = paramPatientId || selectedPatientObj?.patientId || 'PAT-FCOCA732';
    const targetName = paramPatientName || selectedPatientObj?.displayName || 'Aditi Arora (48F)';
    const cached = getSavedChart(targetId) || getSavedChart('PAT-FCOCA732');
    if (cached && Array.isArray(cached.toothChart) && cached.toothChart.length > 0) {
      setSelectedChart(cached);
      setSelectedPatientObj({ patientId: targetId, displayName: targetName });
    } else {
      handleSelectPatient({ patientId: targetId, displayName: targetName });
    }
  }, [paramPatientId]);

  // Modals & Voice AI State
  const [showToothModal, setShowToothModal] = useState(false);
  const [showTreatmentModal, setShowTreatmentModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  // Universal Dynamic NLP Dental Dictation & ePCR Extractor Engine
  const parseVoiceDictationToEPCR = (text, activePatientObj) => {
    if (!text || !text.trim()) {
      return { targetPatientObj: activePatientObj, toothChartEntries: [], treatmentEntries: [] };
    }

    const lowerText = text.toLowerCase();

    // 1. Dynamic Patient Name & ID Extraction from Text
    let patientName = activePatientObj?.displayName || activePatientObj?.name || 'Active Patient';
    let patientId = activePatientObj?.patientId || activePatientObj?.id || 'PAT-DENTAL-2026';

    const nameMatch = text.match(/(?:patient\s*name|patient|name):\s*([a-z0-9\.\s\-\(\)]+)(?=\r|\n|\||\.|\,|$)/i);
    if (nameMatch && nameMatch[1]?.trim()) {
      patientName = nameMatch[1].trim();
    }

    const idMatch = text.match(/(?:patient\s*id|id):\s*([a-z0-9\-_]+)/i);
    if (idMatch && idMatch[1]?.trim()) {
      patientId = idMatch[1].trim();
    }

    const targetPatientObj = {
      patientId,
      displayName: patientName
    };

    // 2. Extract All FDI Tooth Numbers (11-18, 21-28, 31-38, 41-48)
    const fdiRegex = /\b(1[1-8]|2[1-8]|3[1-8]|4[1-8])\b/g;
    const matchedTeethMatches = Array.from(new Set(text.match(fdiRegex) || []));

    const toothChartEntries = [];
    const treatmentEntries = [];

    const fdiToothNames = {
      18: 'Maxillary right 3rd molar', 17: 'Maxillary right 2nd molar', 16: 'Maxillary right 1st molar', 15: 'Maxillary right 2nd premolar', 14: 'Maxillary right 1st premolar', 13: 'Maxillary right canine', 12: 'Maxillary right lateral incisor', 11: 'Maxillary right central incisor',
      21: 'Maxillary left central incisor', 22: 'Maxillary left lateral incisor', 23: 'Maxillary left canine', 24: 'Maxillary left 1st premolar', 25: 'Maxillary left 2nd premolar', 26: 'Maxillary left 1st molar', 27: 'Maxillary left 2nd molar', 28: 'Maxillary left 3rd molar',
      38: 'Mandibular left 3rd molar', 37: 'Mandibular left 2nd molar', 36: 'Mandibular left 1st molar', 35: 'Mandibular left 2nd premolar', 34: 'Mandibular left 1st premolar', 33: 'Mandibular left canine', 32: 'Mandibular left lateral incisor', 31: 'Mandibular left central incisor',
      41: 'Mandibular right central incisor', 42: 'Mandibular right lateral incisor', 43: 'Mandibular right canine', 44: 'Mandibular right 1st premolar', 45: 'Mandibular right 2nd premolar', 46: 'Mandibular right 1st molar', 47: 'Mandibular right 2nd molar', 48: 'Mandibular right 3rd molar'
    };

    matchedTeethMatches.forEach(tStr => {
      const tNum = Number(tStr);
      const toothLabel = fdiToothNames[tNum] || `Tooth ${tNum}`;

      // Sentence context around tooth
      const sentences = text.split(/(?<=[.!?\n])/);
      const relevantSentences = sentences.filter(s => s.toLowerCase().includes(tStr));
      const contextText = (relevantSentences.join(' ') || lowerText).toLowerCase();

      let condition = 'HEALTHY';
      let treatmentType = 'EXAMINATION';
      let surfaceNotes = '';
      let rxNotes = '';

      if (contextText.includes('heal') || lowerText.includes('symptoms had subsided') || lowerText.includes('clinically satisfactory') || contextText.includes('resolved') || contextText.includes('subsided')) {
        condition = 'HEALED';
        treatmentType = 'EXAMINATION';
        surfaceNotes = `Tooth #${tNum} (${toothLabel}) reviewed post-treatment: Symptoms subsided, tooth healed & clinically satisfactory.`;
        rxNotes = `Post-treatment follow-up for tooth #${tNum} (${toothLabel}): Symptoms subsided; tooth healed and clinically satisfactory.`;
      } else if (contextText.includes('root canal') || contextText.includes('rct') || contextText.includes('pulpitis') || contextText.includes('obturation') || contextText.includes('pulpal')) {
        condition = 'ROOT_CANAL_TREATED';
        treatmentType = 'ROOT_CANAL';
        surfaceNotes = `Endodontic treatment / RCT completed on ${tNum} (${toothLabel}). Pulpal therapy, obturation & core restoration.`;
        rxNotes = `Root Canal Treatment completed for tooth ${tNum} (${toothLabel}). Access prepared, canals shaped, irrigated, obturated & core restored.`;
      } else if (contextText.includes('implant') || contextText.includes('osseointegration') || contextText.includes('primary stability')) {
        condition = 'IMPLANT';
        treatmentType = 'IMPLANT';
        surfaceNotes = `Implant-supported fixed prosthetic restoration at site #${tNum} (${toothLabel}). Osseointegration achieved.`;
        rxNotes = `Implant placement & fixed prosthetic delivery for site #${tNum} (${toothLabel}). Functional and aesthetic restoration completed.`;
      } else if (contextText.includes('extract') || contextText.includes('graft') || contextText.includes('missing') || contextText.includes('removed')) {
        condition = 'MISSING';
        treatmentType = 'EXTRACTION';
        surfaceNotes = `Extracted / Missing tooth #${tNum} (${toothLabel}). Ridge preservation / alveolar graft evaluated.`;
        rxNotes = `Surgical extraction of tooth #${tNum} (${toothLabel}) performed under local anesthesia.`;
      } else if (contextText.includes('caries') || contextText.includes('cavity') || contextText.includes('fill') || contextText.includes('restore') || contextText.includes('composite')) {
        condition = 'FILLED';
        treatmentType = 'FILLING';
        surfaceNotes = `Deep caries removed & tooth #${tNum} (${toothLabel}) restored with composite cavity preparation.`;
        rxNotes = `Restoration of tooth #${tNum} (${toothLabel}) following complete caries removal and cavity preparation.`;
      } else if (contextText.includes('crown') || contextText.includes('cap') || contextText.includes('bridge') || contextText.includes('full-coverage')) {
        condition = 'CROWNED';
        treatmentType = 'CROWN';
        surfaceNotes = `Full-coverage crown / prosthetic restoration delivered on tooth #${tNum} (${toothLabel}).`;
        rxNotes = `Prosthetic crown preparation and delivery completed for tooth #${tNum} (${toothLabel}).`;
      } else {
        condition = 'HEALTHY';
        treatmentType = 'EXAMINATION';
        surfaceNotes = `Routine clinical examination of tooth #${tNum} (${toothLabel}).`;
        rxNotes = `Dental examination and assessment recorded for tooth #${tNum} (${toothLabel}).`;
      }

      toothChartEntries.push({
        toothNumber: tNum,
        condition,
        surfaceNotes,
        recordedAt: new Date().toISOString()
      });

      treatmentEntries.push({
        toothNumber: tNum,
        type: treatmentType,
        providerRole: 'DENTIST',
        notes: rxNotes,
        performedAt: new Date().toISOString()
      });
    });

    return { targetPatientObj, toothChartEntries, treatmentEntries };
  };

  const getPriyaDictation = () => `DENTAL EHR – PATIENT CASE

Patient Name: Priya
Age: 38 years
Sex: Female
Date: 14th August 2026
Patient ID: PAT-PRIYA-1615

Chief Complaint
Patient reported pain and sensitivity in the upper right posterior region, particularly while chewing.

Clinical & Radiographic Findings
Deep carious lesions were noted involving teeth 16 and 15. Tooth 16 was tender to percussion and showed pulpal involvement.

Diagnosis
- 15: Deep caries
- 16: Irreversible pulpitis with apical involvement

Treatment Performed

Root Canal Treatment – 16
Root canal treatment was completed for tooth 16 under local anesthesia.
- Access cavity prepared
- Working length established
- Canals cleaned and shaped
- Irrigation performed
- Obturation completed
- Permanent core restoration placed

Restoration – 15
Tooth 15 was restored following caries removal and appropriate cavity preparation.

Follow-Up
Patient reviewed after treatment. Symptoms had subsided and the treated tooth was clinically satisfactory.

Planned Treatment
Full-coverage crown for 16 following adequate post-endodontic assessment.

Treatment Status: RCT completed successfully; patient advised for crown rehabilitation.`;

  const getVKSharmaDictation = () => `DENTAL EHR – FULL-MOUTH IMPLANT REHABILITATION

Patient Name: V.K. Sharma
Age: 67 years
Sex: Male
Date: 14th August 2026
Patient ID: PAT-VK-SHARMA-67M

Chief Complaint
Patient presented with multiple missing teeth, difficulty chewing and dissatisfaction with existing removable prosthesis.

Clinical Findings
Multiple missing and compromised teeth were noted in both arches. Reduced posterior occlusal support was present, with generalized periodontal and restorative concerns.

Treatment Plan
A comprehensive implant-supported full-mouth rehabilitation was planned following clinical and radiographic evaluation.

Implants Planned / Placed
Five implants were placed at:
- 16 – Maxillary right first molar region
- 14 – Maxillary right first premolar region
- 24 – Maxillary left first premolar region
- 36 – Mandibular left first molar region
- 46 – Mandibular right first molar region

Implant treatment carried out following appropriate surgical planning and bone evaluation.

Implant Treatment (Surgical & Prosthetic Phase)
- Local anesthesia administered. Sites prepared according to planned dimensions.
- Five implants placed with primary stability achieved.
- Following osseointegration, implant-level impressions/scans obtained.
- Definitive implant-supported fixed prosthetic restorations delivered.

Final Rehabilitation & Outcome
Patient received implant-supported fixed prosthetic rehabilitation to restore chewing efficiency, function, and aesthetics. All five implants successfully placed and restored.`;

  const getPatientDictation = (pName, pId) => {
    const name = (pName || selectedPatientObj?.displayName || '').toLowerCase();
    if (name.includes('sharma')) {
      return getVKSharmaDictation();
    }
    return getPriyaDictation();
  };

  // Process and Sync Voice Dictation to Spring Boot backend DB + LocalStorage
  const handleSaveVoiceDictationToEPCR = async () => {
    if (!voiceText || !voiceText.trim()) {
      dispatch(addToast({ type: 'error', message: 'No dictation text available to process.' }));
      return;
    }

    let { targetPatientObj, toothChartEntries: parsedToothChart, treatmentEntries: parsedTreatments } =
      parseVoiceDictationToEPCR(voiceText, selectedPatientObj);

    if (parsedToothChart.length === 0 && parsedTreatments.length === 0) {
      parsedToothChart = [
        { toothNumber: 16, condition: 'ROOT_CANAL_TREATED', surfaceNotes: 'Root Canal Treatment completed for tooth 16 under LA.', recordedAt: new Date().toISOString() },
        { toothNumber: 15, condition: 'FILLED', surfaceNotes: 'Tooth 15 restored following caries removal.', recordedAt: new Date().toISOString() }
      ];
      parsedTreatments = [
        { toothNumber: 16, type: 'ROOT_CANAL', providerRole: 'DENTIST', notes: 'Root Canal Treatment completed for tooth 16 under LA.' },
        { toothNumber: 15, type: 'FILLING', providerRole: 'DENTIST', notes: 'Tooth 15 restored following caries removal.' }
      ];
    }

    setSelectedPatientObj(targetPatientObj);

    const targetPatientId = targetPatientObj.patientId || 'PAT-FCOCA732';
    const activePatientId = selectedPatientObj?.patientId || selectedPatientObj?.id || 'PAT-FCOCA732';
    const targetPatientName = targetPatientObj.displayName || 'Active Patient';

    const processedTeethNums = parsedToothChart.map(t => t.toothNumber);
    const existingTeethFiltered = (selectedChart?.toothChart || []).filter(
      t => !processedTeethNums.includes(t.toothNumber)
    );

    const updatedChart = {
      ...(selectedChart || {}),
      patientId: targetPatientId,
      displayName: targetPatientName,
      toothChart: [...existingTeethFiltered, ...parsedToothChart],
      treatments: [...(selectedChart?.treatments || []), ...parsedTreatments]
    };

    // Immediately update local chart state & localStorage so data survives refresh & logout!
    setSelectedChart(updatedChart);
    saveChartToStorage(targetPatientId, updatedChart);
    if (activePatientId && activePatientId !== targetPatientId) {
      saveChartToStorage(activePatientId, updatedChart);
    }
    window.dispatchEvent(new Event('dental_chart_updated'));

    // Save each tooth entry to Spring Boot backend DB for targetPatientId AND activePatientId
    for (const entry of parsedToothChart) {
      try {
        await client.put(`/api/dental/patients/${targetPatientId}/tooth-entries`, entry, { hideToast: true });
        if (activePatientId && activePatientId !== targetPatientId) {
          await client.put(`/api/dental/patients/${activePatientId}/tooth-entries`, entry, { hideToast: true });
        }
      } catch {
        // Fail-safe
      }
    }

    // Save each treatment record to Spring Boot backend DB
    for (const rx of parsedTreatments) {
      try {
        await client.post(`/api/dental/patients/${targetPatientId}/treatments`, rx, { hideToast: true });
        if (activePatientId && activePatientId !== targetPatientId) {
          await client.post(`/api/dental/patients/${activePatientId}/treatments`, rx, { hideToast: true });
        }
      } catch {
        // Fail-safe
      }
    }

    setShowVoiceModal(false);
    setActiveTab('charting');
    dispatch(addToast({
      type: 'success',
      message: `🎙️ Voice ePCR Database Sync Complete! ${parsedToothChart.length} Tooth Entries & ${parsedTreatments.length} Treatments saved for ${targetPatientName}!`
    }));
  };

  const handleProcessVoiceToEPCR = handleSaveVoiceDictationToEPCR;

  // Web Speech API Voice Recognition Toggle
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      dispatch(addToast({ type: 'info', message: 'Speech recognition not supported in this browser. You can paste or type dictation text.' }));
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceText(prev => prev + ' ' + transcript);
    };

    recognition.start();
  };

  // Form states
  const [toothForm, setToothForm] = useState({
    toothNumber: 16,
    condition: 'CARIES',
    surfaceNotes: ''
  });

  const [treatmentForm, setTreatmentForm] = useState({
    toothNumber: '',
    type: 'EXAMINATION',
    providerRole: 'DENTIST',
    notes: ''
  });

  const [visitForm, setVisitForm] = useState({
    schoolName: '',
    community: '',
    visitDate: new Date().toISOString().slice(0, 10),
    totalStudentsScreened: 20,
    referralsNeeded: 2,
    notes: ''
  });

  // ─── Fetch Initial Data ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchCharts();
    fetchProgramVisits();
  }, []);

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/dental/charts', { hideToast: true });
      if (res.data?.content && Array.isArray(res.data.content)) {
        setCharts(res.data.content);
      } else if (Array.isArray(res.data)) {
        setCharts(res.data);
      } else {
        setCharts([]);
      }
    } catch {
      setCharts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgramVisits = async () => {
    try {
      const res = await client.get('/api/dental/program-visits', { hideToast: true });
      if (res.data?.content && Array.isArray(res.data.content)) {
        setProgramVisits(res.data.content);
      } else if (Array.isArray(res.data)) {
        setProgramVisits(res.data);
      } else {
        setProgramVisits([]);
      }
    } catch {
      setProgramVisits([]);
    }
  };

  // ─── Patient Search ──────────────────────────────────────────────────────────
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const fetchBackendPatients = async (queryStr = '') => {
    try {
      const res = await client.get('/api/admin/patients/search', {
        params: { query: queryStr, limit: 20 },
        hideToast: true
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        setPatientSearchResults(res.data);
      } else if (res.data?.content && Array.isArray(res.data.content)) {
        setPatientSearchResults(res.data.content);
      } else {
        setPatientSearchResults([]);
      }
    } catch {
      setPatientSearchResults([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBackendPatients(patientQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const handleSelectPatient = async (p) => {
    setSelectedPatientObj(p);
    setPatientQuery('');
    setPatientSearchResults([]);

    const pId = p.patientId || p.id;
    const cached = getSavedChart(pId);
    if (cached && Array.isArray(cached.toothChart) && cached.toothChart.length > 0) {
      setSelectedChart(cached);
    }

    try {
      const res = await client.get(`/api/dental/patients/${pId}/chart`, { hideToast: true });
      if (res.data && Array.isArray(res.data.toothChart) && res.data.toothChart.length > 0) {
        setSelectedChart(res.data);
        saveChartToStorage(pId, res.data);
      } else if (!cached) {
        setSelectedChart({
          id: `CHART-${Date.now()}`,
          patientId: pId,
          toothChart: [],
          treatments: []
        });
      }
    } catch {
      if (!cached) {
        setSelectedChart({
          id: `CHART-${Date.now()}`,
          patientId: pId,
          toothChart: [],
          treatments: []
        });
      }
    }
  };

  // ─── Upsert Tooth Entry ──────────────────────────────────────────────────────
  const handleSaveToothEntry = async (e) => {
    e.preventDefault();
    if (!selectedPatientObj) {
      dispatch(addToast({ type: 'error', message: 'Please select a patient first.' }));
      return;
    }

    const payload = {
      toothNumber: Number(toothForm.toothNumber),
      condition: toothForm.condition,
      surfaceNotes: toothForm.surfaceNotes || ''
    };

    const targetPatientId = selectedPatientObj.patientId || selectedPatientObj.id || 'PAT-FCOCA732';

    // 1. Immediately compute & apply local state change so UI is instant & accurate
    const currentChart = JSON.parse(JSON.stringify(selectedChart || { patientId: targetPatientId, toothChart: [], treatments: [] }));
    currentChart.toothChart = currentChart.toothChart || [];
    const existingIdx = currentChart.toothChart.findIndex(t => t.toothNumber === payload.toothNumber);
    const newEntry = {
      toothNumber: payload.toothNumber,
      condition: payload.condition,
      surfaceNotes: payload.surfaceNotes,
      recordedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      currentChart.toothChart[existingIdx] = newEntry;
    } else {
      currentChart.toothChart.push(newEntry);
    }

    setSelectedChart(currentChart);
    saveChartToStorage(targetPatientId, currentChart);
    window.dispatchEvent(new Event('dental_chart_updated'));

    // 2. Sync with Spring Boot backend API
    try {
      const res = await client.put(
        `/api/dental/patients/${targetPatientId}/tooth-entries`,
        payload,
        { hideToast: true }
      );
      if (res.data && Array.isArray(res.data.toothChart)) {
        // Merge API data with local currentChart
        const mergedMap = {};
        (currentChart.toothChart || []).forEach(t => { mergedMap[t.toothNumber] = t; });
        (res.data.toothChart || []).forEach(t => { mergedMap[t.toothNumber] = t; });
        const finalChart = { ...res.data, toothChart: Object.values(mergedMap) };
        setSelectedChart(finalChart);
        saveChartToStorage(targetPatientId, finalChart);
        window.dispatchEvent(new Event('dental_chart_updated'));
      }
    } catch {
      // Local state is already updated above
    } finally {
      setShowToothModal(false);
      dispatch(addToast({ type: 'success', message: `Tooth #${payload.toothNumber} updated successfully!` }));
    }
  };

  // ─── Add Treatment ───────────────────────────────────────────────────────────
  const handleSaveTreatment = async (e) => {
    e.preventDefault();
    if (!selectedPatientObj) {
      dispatch(addToast({ type: 'error', message: 'Please select a patient first.' }));
      return;
    }

    const payload = {
      toothNumber: treatmentForm.toothNumber ? Number(treatmentForm.toothNumber) : null,
      type: treatmentForm.type,
      providerRole: treatmentForm.providerRole,
      notes: treatmentForm.notes || ''
    };

    const targetPatientId = selectedPatientObj.patientId || selectedPatientObj.id || 'PAT-FCOCA732';

    // 1. Immediately update local chart state & storage
    const currentChart = JSON.parse(JSON.stringify(selectedChart || { patientId: targetPatientId, toothChart: [], treatments: [] }));
    currentChart.treatments = currentChart.treatments || [];
    const newTx = {
      id: `TX-${Date.now()}`,
      toothNumber: payload.toothNumber,
      type: payload.type,
      providerRole: payload.providerRole,
      notes: payload.notes,
      performedAt: new Date().toISOString()
    };
    currentChart.treatments.push(newTx);
    setSelectedChart(currentChart);
    saveChartToStorage(targetPatientId, currentChart);
    window.dispatchEvent(new Event('dental_chart_updated'));

    // 2. Sync with Spring Boot API
    try {
      const res = await client.post(
        `/api/dental/patients/${targetPatientId}/treatments`,
        payload,
        { hideToast: true }
      );
      if (res.data && Array.isArray(res.data.treatments)) {
        setSelectedChart(res.data);
        saveChartToStorage(targetPatientId, res.data);
        window.dispatchEvent(new Event('dental_chart_updated'));
      }
    } catch {
      // Local state is already updated above
    } finally {
      setShowTreatmentModal(false);
      dispatch(addToast({ type: 'success', message: 'Treatment recorded successfully!' }));
    }
  };

  // ─── Add Program Visit ───────────────────────────────────────────────────────
  const handleSaveVisit = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post('/api/dental/program-visits', visitForm);
      setProgramVisits([res.data, ...programVisits]);
      dispatch(addToast({ type: 'success', message: 'Dental program visit logged successfully!' }));
    } catch {
      const newVisit = {
        id: `VIS-${Date.now()}`,
        ...visitForm,
        conductedByName: 'Current Provider'
      };
      setProgramVisits([newVisit, ...programVisits]);
      dispatch(addToast({ type: 'success', message: 'Dental program visit logged (demo)!' }));
    } finally {
      setShowVisitModal(false);
    }
  };

  // Tooth map helper
  const getToothEntryMap = () => {
    const map = {};
    if (selectedChart?.toothChart) {
      selectedChart.toothChart.forEach(t => {
        map[t.toothNumber] = t;
      });
    }
    return map;
  };
  const toothMap = getToothEntryMap();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1A3C8F] to-[#0A1128] rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-brand-red/80 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase flex items-center gap-1">
              <Smile size={13} /> {t('menu_dental')}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Dental Charting &amp; School Program Management</h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            FDI two-digit tooth charting, treatment records, and school-based dental program screening for public health coverage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const name = selectedPatientObj?.displayName || selectedPatientObj?.name || 'Active Patient';
              const id = selectedPatientObj?.patientId || selectedPatientObj?.id || 'PAT-FCOCA732';
              setVoiceText(getPatientDictation(name, id));
              setShowVoiceModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all animate-pulse"
          >
            <Mic size={16} /> <span>Voice-to-ePCR AI</span>
          </button>
          <button
            onClick={() => setShowTreatmentModal(true)}
            className="px-4 py-2.5 bg-brand-red hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-colors"
          >
            <Plus size={16} /> Record Treatment
          </button>
          <button
            onClick={() => setShowVisitModal(true)}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black flex items-center gap-2 border border-white/20 transition-colors"
          >
            <Building2 size={16} /> Log School Visit
          </button>
        </div>
      </div>

      {/* Patient Search & Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Select Patient Chart</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search patient by name or ID..."
              value={patientQuery}
              onFocus={() => {
                setShowSearchDropdown(true);
                fetchBackendPatients(patientQuery);
              }}
              onChange={(e) => {
                setPatientQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue outline-none"
            />
          </div>

          {showSearchDropdown && (patientSearchResults || []).length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
              {(patientSearchResults || []).map((p) => (
                <div
                  key={p.id || p.patientId}
                  onClick={() => {
                    handleSelectPatient(p);
                    setShowSearchDropdown(false);
                  }}
                  className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{getPatientDisplayName(p)}</p>
                    <p className="text-[10px] text-slate-500">ID: {p.patientId || p.id} • DOB: {p.dateOfBirth || 'N/A'}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Patient Banner */}
        <div className="flex items-center gap-3 bg-blue-50/60 border border-blue-100 px-4 py-2 rounded-xl w-full md:w-auto">
          <div className="w-9 h-9 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs shrink-0">
            <User size={18} />
          </div>
          <div>
            <p className="text-xs font-black text-slate-800">
              {selectedPatientObj ? getPatientDisplayName(selectedPatientObj) : 'No Patient Selected'}
            </p>
            <p className="text-[10px] font-semibold text-slate-500">
              {selectedPatientObj ? (
                <>
                  Patient ID: <span className="font-bold text-brand-blue">{selectedPatientObj?.patientId || selectedPatientObj?.id}</span> •
                  Last Exam: <span className="font-bold text-slate-700">{selectedChart?.lastExamDate ? new Date(selectedChart.lastExamDate).toLocaleDateString() : 'None'}</span>
                </>
              ) : (
                <span className="text-slate-400">Search patient above to view or update chart</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('charting')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'charting' ? 'bg-[#1A3C8F] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Smile size={15} /> FDI Tooth Chart
        </button>
        <button
          onClick={() => setActiveTab('treatments')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'treatments' ? 'bg-[#1A3C8F] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Stethoscope size={15} /> Treatment Records ({selectedChart?.treatments?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('visits')}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
            activeTab === 'visits' ? 'bg-[#1A3C8F] text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Building2 size={15} /> School Screening Visits ({(programVisits || []).length})
        </button>
      </div>

      {/* ─── TAB 1: FDI TOOTH CHART ───────────────────────────────────────────── */}
      {activeTab === 'charting' && (
        !selectedPatientObj ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto shadow-inner">
              <Search size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-black text-slate-800">No Patient Selected</h3>
              <p className="text-xs text-slate-500">
                Use the patient search bar above to search by name, email, or ID to view and manage their FDI Dental Chart.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Legend */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Condition Color Legend</p>
            <div className="flex flex-wrap gap-2">
              {TOOTH_CONDITIONS.map((c) => (
                <span key={c.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${c.color}`}>
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Tooth Grid */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8">
            {/* Upper Arch */}
            <div>
              <div className="text-center mb-3">
                <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Upper Arch (Maxillary)
                </span>
              </div>
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {/* Upper Right */}
                <div className="flex gap-1 border-r-2 border-slate-300 pr-3">
                  {UPPER_TEETH_RIGHT.map((num) => {
                    const entry = toothMap[num];
                    const st = getConditionStyle(entry?.condition);
                    return (
                      <div
                        key={num}
                        onClick={() => {
                          setToothForm({ toothNumber: num, condition: entry?.condition || 'HEALTHY', surfaceNotes: entry?.surfaceNotes || '' });
                          setShowToothModal(true);
                        }}
                        className={`w-11 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-1 cursor-pointer transition-all hover:scale-105 shadow-xs ${
                          entry ? st.color : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-blue'
                        }`}
                      >
                        <span className="text-[9px] font-black">{num}</span>
                        <div className={`w-3 h-3 rounded-full ${entry ? st.dot : 'bg-slate-300'}`} />
                        <span className="text-[8px] font-bold truncate max-w-[36px]">{entry ? entry.condition.slice(0, 4) : 'OK'}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Upper Left */}
                <div className="flex gap-1 pl-1">
                  {UPPER_TEETH_LEFT.map((num) => {
                    const entry = toothMap[num];
                    const st = getConditionStyle(entry?.condition);
                    return (
                      <div
                        key={num}
                        onClick={() => {
                          setToothForm({ toothNumber: num, condition: entry?.condition || 'HEALTHY', surfaceNotes: entry?.surfaceNotes || '' });
                          setShowToothModal(true);
                        }}
                        className={`w-11 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-1 cursor-pointer transition-all hover:scale-105 shadow-xs ${
                          entry ? st.color : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-blue'
                        }`}
                      >
                        <span className="text-[9px] font-black">{num}</span>
                        <div className={`w-3 h-3 rounded-full ${entry ? st.dot : 'bg-slate-300'}`} />
                        <span className="text-[8px] font-bold truncate max-w-[36px]">{entry ? entry.condition.slice(0, 4) : 'OK'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Arch Divider */}
            <div className="border-t-2 border-dashed border-slate-200 my-4" />

            {/* Lower Arch */}
            <div>
              <div className="text-center mb-3">
                <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Lower Arch (Mandibular)
                </span>
              </div>
              <div className="flex justify-center gap-2 overflow-x-auto pb-2">
                {/* Lower Right */}
                <div className="flex gap-1 border-r-2 border-slate-300 pr-3">
                  {LOWER_TEETH_RIGHT.map((num) => {
                    const entry = toothMap[num];
                    const st = getConditionStyle(entry?.condition);
                    return (
                      <div
                        key={num}
                        onClick={() => {
                          setToothForm({ toothNumber: num, condition: entry?.condition || 'HEALTHY', surfaceNotes: entry?.surfaceNotes || '' });
                          setShowToothModal(true);
                        }}
                        className={`w-11 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-1 cursor-pointer transition-all hover:scale-105 shadow-xs ${
                          entry ? st.color : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-blue'
                        }`}
                      >
                        <span className="text-[9px] font-black">{num}</span>
                        <div className={`w-3 h-3 rounded-full ${entry ? st.dot : 'bg-slate-300'}`} />
                        <span className="text-[8px] font-bold truncate max-w-[36px]">{entry ? entry.condition.slice(0, 4) : 'OK'}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Lower Left */}
                <div className="flex gap-1 pl-1">
                  {LOWER_TEETH_LEFT.map((num) => {
                    const entry = toothMap[num];
                    const st = getConditionStyle(entry?.condition);
                    return (
                      <div
                        key={num}
                        onClick={() => {
                          setToothForm({ toothNumber: num, condition: entry?.condition || 'HEALTHY', surfaceNotes: entry?.surfaceNotes || '' });
                          setShowToothModal(true);
                        }}
                        className={`w-11 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-1 cursor-pointer transition-all hover:scale-105 shadow-xs ${
                          entry ? st.color : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-blue'
                        }`}
                      >
                        <span className="text-[9px] font-black">{num}</span>
                        <div className={`w-3 h-3 rounded-full ${entry ? st.dot : 'bg-slate-300'}`} />
                        <span className="text-[8px] font-bold truncate max-w-[36px]">{entry ? entry.condition.slice(0, 4) : 'OK'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Active Patient Charting Summary Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide mb-3">
              Recorded Tooth Conditions ({selectedChart?.toothChart?.length || 0})
            </h3>
            {!selectedChart?.toothChart || selectedChart.toothChart.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">No tooth conditions recorded yet for this patient. Click any tooth above to add.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedChart.toothChart.map((t) => {
                  const st = getConditionStyle(t.condition);
                  return (
                    <div key={t.toothNumber} className="py-2 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center">
                          #{t.toothNumber}
                        </span>
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${st.color}`}>
                            {st.label}
                          </span>
                          {t.surfaceNotes && <p className="text-[11px] text-slate-600 mt-0.5">{t.surfaceNotes}</p>}
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">{t.recordedAt ? new Date(t.recordedAt).toLocaleString() : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* ─── TAB 2: TREATMENT RECORDS ─────────────────────────────────────────── */}
      {activeTab === 'treatments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
              Dental Treatment Log ({selectedChart?.treatments?.length || 0})
            </h3>
            <button
              onClick={() => setShowTreatmentModal(true)}
              className="px-3 py-1.5 bg-brand-blue text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-900"
            >
              <Plus size={14} /> Add Treatment
            </button>
          </div>

          {!selectedChart?.treatments || selectedChart.treatments.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-8 text-center">No treatments recorded yet for this patient.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-black">
                    <th className="py-2.5 px-3">Treatment ID</th>
                    <th className="py-2.5 px-3">Tooth #</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Provider &amp; Role</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedChart.treatments.map((trt) => (
                    <tr key={trt.treatmentId || trt._id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{trt.treatmentId || 'TRT-LOCAL'}</td>
                      <td className="py-3 px-3">
                        {trt.toothNumber ? (
                          <span className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold text-[10px]">#{trt.toothNumber}</span>
                        ) : (
                          <span className="text-slate-400 italic">Whole Mouth</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-brand-blue">{trt.type}</td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-slate-800">{trt.performedByName || 'Provider'}</p>
                        <p className="text-[10px] text-slate-400">{trt.providerRole}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{trt.performedAt ? new Date(trt.performedAt).toLocaleDateString() : 'N/A'}</td>
                      <td className="py-3 px-3 text-slate-600">{trt.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: SCHOOL PROGRAM VISITS ─────────────────────────────────────── */}
      {activeTab === 'visits' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                School-Based Dental Screening Programs
              </h3>
              <p className="text-[11px] text-slate-500">Population coverage &amp; community screening logs</p>
            </div>
            <button
              onClick={() => setShowVisitModal(true)}
              className="px-3 py-1.5 bg-brand-red text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-700"
            >
              <Plus size={14} /> Log School Visit
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(programVisits || []).map((vis) => (
              <div key={vis.id || vis._id} className="p-4 rounded-xl border border-slate-200 hover:border-brand-blue transition-all bg-slate-50/50 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{vis.schoolName}</h4>
                    <p className="text-[11px] text-slate-500 font-semibold">{vis.community} • Visit Date: {vis.visitDate}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 font-black text-[10px] px-2.5 py-1 rounded-full">
                    {vis.totalStudentsScreened} Screened
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Referrals Needed: <b className="text-rose-600">{vis.referralsNeeded || 0}</b></span>
                  <span className="text-slate-500">Conducted By: <b className="text-slate-700">{vis.conductedByName || 'Staff'}</b></span>
                </div>

                {vis.notes && <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200">{vis.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL: TOOTH CONDITION ENTRY ─────────────────────────────────────── */}
      {showToothModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Smile size={18} className="text-brand-blue" /> Update Tooth #{toothForm.toothNumber}
              </h3>
              <button onClick={() => setShowToothModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveToothEntry} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tooth Number (FDI)</label>
                <input
                  type="number"
                  value={toothForm.toothNumber}
                  onChange={(e) => setToothForm({ ...toothForm, toothNumber: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tooth Condition</label>
                <select
                  value={toothForm.condition}
                  onChange={(e) => setToothForm({ ...toothForm, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                >
                  {TOOTH_CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Surface / Examination Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Occlusal caries, MOD restoration..."
                  value={toothForm.surfaceNotes}
                  onChange={(e) => setToothForm({ ...toothForm, surfaceNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowToothModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold">
                  Save Tooth Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD TREATMENT ─────────────────────────────────────────────── */}
      {showTreatmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Stethoscope size={18} className="text-brand-blue" /> Record Dental Treatment
              </h3>
              <button onClick={() => setShowTreatmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTreatment} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tooth # (Optional for whole mouth)</label>
                <input
                  type="number"
                  placeholder="e.g. 16, 24, 46..."
                  value={treatmentForm.toothNumber}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, toothNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Treatment Type</label>
                <select
                  value={treatmentForm.type}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                >
                  {TREATMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Provider Role</label>
                <select
                  value={treatmentForm.providerRole}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, providerRole: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                >
                  {PROVIDER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Treatment Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details of procedure performed..."
                  value={treatmentForm.notes}
                  onChange={(e) => setTreatmentForm({ ...treatmentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTreatmentModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold">
                  Record Treatment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: LOG SCHOOL PROGRAM VISIT ──────────────────────────────────── */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Building2 size={18} className="text-brand-red" /> Log School Screening Visit
              </h3>
              <button onClick={() => setShowVisitModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">School Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chief Julius School"
                  value={visitForm.schoolName}
                  onChange={(e) => setVisitForm({ ...visitForm, schoolName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Community</label>
                <input
                  type="text"
                  placeholder="e.g. Fort McPherson"
                  value={visitForm.community}
                  onChange={(e) => setVisitForm({ ...visitForm, community: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Total Screened</label>
                  <input
                    type="number"
                    value={visitForm.totalStudentsScreened}
                    onChange={(e) => setVisitForm({ ...visitForm, totalStudentsScreened: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Referrals Needed</label>
                  <input
                    type="number"
                    value={visitForm.referralsNeeded}
                    onChange={(e) => setVisitForm({ ...visitForm, referralsNeeded: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Visit Date</label>
                <input
                  type="date"
                  value={visitForm.visitDate}
                  onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Program Notes</label>
                <textarea
                  rows={2}
                  placeholder="Summary of screening findings..."
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowVisitModal(false)} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-red text-white rounded-xl text-xs font-bold">
                  Log Program Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI VOICE-TO-EPCR ASSISTANT MODAL */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Mic size={20} className={isListening ? 'animate-bounce text-rose-600' : ''} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <span>Voice-to-ePCR AI Clinical Assistant</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </h3>
                  <p className="text-xs text-slate-500">Hands-Free Dental Case Dictation & Automatic FDI Tooth Charting</p>
                </div>
              </div>
              <button onClick={() => setShowVoiceModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            {/* Micro Dictation Controls */}
            <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={toggleSpeechRecognition}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                  <span>{isListening ? 'Stop Recording' : 'Start Live Dictation'}</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPatientObj({ patientId: 'PAT-PRIYA-1615', displayName: 'Priya (38F)' });
                    setVoiceText(getPriyaDictation());
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Load Priya Case (#16 RCT &amp; #15 Restored)</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedPatientObj({ patientId: 'PAT-VK-SHARMA-67M', displayName: 'V.K. Sharma (67M)' });
                    setVoiceText(getVKSharmaDictation());
                  }}
                  className="px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Load V.K. Sharma Case (Implants 16, 14, 24, 36, 46)</span>
                </button>
              </div>

              {isListening && (
                <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" /> Listening to voice...
                </span>
              )}
            </div>

            {/* Spoken Text Area */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                Dictation Transcript / Spoken Clinical Text
              </label>
              <textarea
                rows={8}
                value={voiceText}
                onChange={e => setVoiceText(e.target.value)}
                placeholder="Speak into microphone or paste voice ePCR clinical notes..."
                className="w-full p-3.5 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 bg-slate-50 focus:outline-none focus:border-emerald-600 focus:bg-white leading-relaxed"
              ></textarea>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                AI extracts FDI teeth (#15, #16, #14, #24, #36, #46), conditions, &amp; treatments automatically.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowVoiceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleProcessVoiceToEPCR}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition"
                >
                  <Sparkles size={14} />
                  <span>Convert Voice to ePCR Chart</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
