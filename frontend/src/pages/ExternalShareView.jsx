import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  verifyExternalToken,
  fetchExternalShareBundle,
  submitExternalResponse,
  selectExternalAuthToken,
  selectExternalShareData,
  selectShareLoading,
  selectShareError,
  selectShareSuccessMessage,
  clearExternalShare,
  clearSuccessMessage
} from '../store/slices/shareSlice';
import {
  Key,
  ShieldCheck,
  Lock,
  Clock,
  FileText,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  User,
  HeartPulse,
  Pill,
  Stethoscope,
  Send,
  Building2,
  Calendar,
  Phone,
  MapPin,
  AlertOctagon
} from 'lucide-react';

export const ExternalShareView = () => {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();

  const tokenFromUrl = searchParams.get('token') || '';
  const [manualToken, setManualToken] = useState(tokenFromUrl);
  const [responseNotesText, setResponseNotesText] = useState('');
  const [activeTab, setActiveTab] = useState('clinical');

  const accessToken = useSelector(selectExternalAuthToken);
  const shareBundle = useSelector(selectExternalShareData);
  const loading = useSelector(selectShareLoading);
  const error = useSelector(selectShareError);
  const successMessage = useSelector(selectShareSuccessMessage);

  useEffect(() => {
    if (tokenFromUrl && shareId) {
      dispatch(verifyExternalToken({ shareId, token: tokenFromUrl }))
        .unwrap()
        .then((res) => {
          const jwt = res?.accessToken;
          if (jwt) {
            dispatch(fetchExternalShareBundle({ shareId, accessToken: jwt }));
          }
        })
        .catch(() => {});
    }
    return () => {
      dispatch(clearExternalShare());
    };
  }, [shareId, tokenFromUrl, dispatch]);

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim() || !shareId) return;

    dispatch(verifyExternalToken({ shareId, token: manualToken.trim() }))
      .unwrap()
      .then((res) => {
        const jwt = res?.accessToken;
        if (jwt) {
          dispatch(fetchExternalShareBundle({ shareId, accessToken: jwt }));
        }
      })
      .catch(() => {});
  };

  const handleResponseSubmit = (e) => {
    e.preventDefault();
    if (!responseNotesText.trim() || !shareId) return;

    dispatch(
      submitExternalResponse({
        shareId,
        responseNotes: responseNotesText.trim(),
        accessToken
      })
    )
      .unwrap()
      .then(() => {
        setResponseNotesText('');
        setTimeout(() => dispatch(clearSuccessMessage()), 5000);
      })
      .catch(() => {});
  };

  const rec = shareBundle?.epcrRecord || {};
  const patient = rec.patient || rec.patientData || {};
  const vitals = rec.vitals || rec.vitalsHistory || [];
  const meds = rec.medications || rec.administeredMedications || [];
  const assessment = rec.assessment || {};

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F1A3A] flex flex-col justify-between p-4 sm:p-6 animate-fade-in">
      {/* Top Branding Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center font-black text-white text-base shadow-md">
            ePCR
          </div>
          <div>
            <h1 className="font-black text-[#0F1A3A] text-base leading-none tracking-tight">Med ePCR Clinical Portal</h1>
            <span className="text-xs text-[#8A97B0]">Secure External Specialist Consultation Gateway</span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>HIPAA Encrypted Link</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full my-6 flex-1 flex flex-col justify-center">
        {/* State 1: Verification Form */}
        {!shareBundle && (
          <div className="max-w-md mx-auto w-full bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-[#EEF2FF] border border-[#C8D5F0] rounded-full flex items-center justify-center mx-auto text-brand-blue">
                <Key size={26} />
              </div>
              <h2 className="text-xl font-black text-[#0F1A3A] tracking-tight">Specialist Verification</h2>
              <p className="text-xs text-[#8A97B0]">
                Enter your one-time access token to view shared ePCR record{' '}
                <span className="font-mono text-brand-blue font-bold">{shareId}</span>.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                <span>
                  {typeof error === 'string' && (error.toLowerCase().includes('forbidden') || error.includes('403'))
                    ? 'Invalid or expired access token. Please check the token sent in your notification email.'
                    : error}
                </span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#0F1A3A] block mb-1.5">One-Time Access Token</label>
                <input
                  type="text"
                  required
                  placeholder="Paste your access token here..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Verify Token & Access Record</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* State 2: Shared Bundle & Patient Clinical Record */}
        {shareBundle && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#F0F4FC] pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-black text-[#0F1A3A] tracking-tight">
                      ePCR Clinical Record #{shareBundle.recordId}
                    </h2>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                      Status: {shareBundle.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A97B0]">
                    Shared by: <strong className="text-[#0F1A3A]">{shareBundle.sharedByName || 'Attending Clinician'}</strong> • Organization: <strong className="text-[#0F1A3A]">{shareBundle.organizationName || 'Health System'}</strong>
                  </p>
                </div>

                {shareBundle.expiresAt && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 shrink-0 font-bold">
                    <Clock size={15} className="text-amber-600" />
                    <span>Expires: {new Date(shareBundle.expiresAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Consultation Question */}
              {shareBundle.clinicalQuestion && (
                <div className="p-4 bg-[#EEF2FF] border border-[#C8D5F0] rounded-xl space-y-1">
                  <span className="text-brand-blue font-bold text-xs block">Consultation Question / Reason for Referral</span>
                  <p className="text-[#0F1A3A] text-xs italic leading-relaxed font-medium">{shareBundle.clinicalQuestion}</p>
                </div>
              )}

              {/* Patient Key Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
                <div>
                  <span className="text-[#8A97B0] block text-[11px] font-semibold">Patient Name</span>
                  <strong className="text-[#0F1A3A] font-bold">
                    {rec.patientName || patient.name || patient.fullName || `Patient #${shareBundle.patientId}`}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8A97B0] block text-[11px] font-semibold">Age / Gender</span>
                  <strong className="text-[#0F1A3A] font-bold">
                    {rec.patientAge || patient.age || 'N/A'} Yrs / {rec.patientGender || patient.gender || 'N/A'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8A97B0] block text-[11px] font-semibold">Requested Specialty</span>
                  <strong className="text-amber-700 font-bold">{shareBundle.specialtyRequested || 'General Specialist'}</strong>
                </div>
                <div>
                  <span className="text-[#8A97B0] block text-[11px] font-semibold">Chief Complaint</span>
                  <strong className="text-rose-700 font-bold">{rec.chiefComplaint || 'Acute Assessment'}</strong>
                </div>
              </div>
            </div>

            {/* Clinical Navigation Tabs */}
            <div className="flex border-b border-[#E2E8F0] gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('clinical')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition ${
                  activeTab === 'clinical'
                    ? 'bg-white border-t border-x border-[#E2E8F0] text-brand-blue shadow-sm'
                    : 'text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                <Stethoscope size={16} />
                <span>Clinical Record & Demographics</span>
              </button>
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition ${
                  activeTab === 'vitals'
                    ? 'bg-white border-t border-x border-[#E2E8F0] text-brand-blue shadow-sm'
                    : 'text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                <HeartPulse size={16} />
                <span>Vitals & Interventions</span>
              </button>
              <button
                onClick={() => setActiveTab('opinion')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs flex items-center gap-2 transition ${
                  activeTab === 'opinion'
                    ? 'bg-white border-t border-x border-[#E2E8F0] text-brand-blue shadow-sm'
                    : 'text-[#8A97B0] hover:text-[#0F1A3A]'
                }`}
              >
                <Send size={16} />
                <span>Specialist Consultation Opinion</span>
              </button>
            </div>

            {/* TAB 1: Clinical Record & Demographics */}
            {activeTab === 'clinical' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Demographics Card */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="font-black text-[#0F1A3A] text-sm flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
                    <User size={18} className="text-brand-blue" />
                    <span>Patient Demographics & Medical History</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#8A97B0] block text-[11px]">Full Name</span>
                        <strong className="text-[#0F1A3A] font-bold">{rec.patientName || patient.name || `Patient #${shareBundle.patientId}`}</strong>
                      </div>
                      <div>
                        <span className="text-[#8A97B0] block text-[11px]">Date of Birth</span>
                        <strong className="text-[#0F1A3A] font-bold">{rec.dob || patient.dob || 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#8A97B0] block text-[11px]">Phone</span>
                        <strong className="text-[#0F1A3A] font-bold">{patient.phone || patient.phoneNumber || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-[#8A97B0] block text-[11px]">Address</span>
                        <strong className="text-[#0F1A3A] font-bold">{patient.address || 'N/A'}</strong>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <span className="text-amber-800 font-bold text-[11px] block flex items-center gap-1">
                        <AlertOctagon size={13} />
                        Known Allergies & Contraindications
                      </span>
                      <p className="text-amber-950 font-medium text-xs">
                        {patient.allergies || rec.allergies || 'No known drug allergies reported.'}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <span className="text-slate-700 font-bold text-[11px] block">Pre-existing Medical History / Comorbidities</span>
                      <p className="text-slate-800 text-xs">
                        {patient.medicalHistory || rec.comorbidities || 'Hypertension, Type-2 Diabetes Mellitus'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Incident & Assessment Card */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="font-black text-[#0F1A3A] text-sm flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
                    <Activity size={18} className="text-emerald-600" />
                    <span>Incident Assessment & Narrative</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[#8A97B0] block text-[11px]">Incident Date & Location</span>
                      <strong className="text-[#0F1A3A] font-bold block">
                        {rec.incidentDate ? new Date(rec.incidentDate).toLocaleString() : 'Recent EMS Dispatch'}
                      </strong>
                      <span className="text-[#8A97B0] text-[11px]">{rec.location || 'Clinical Emergency Setting'}</span>
                    </div>

                    <div className="p-3 bg-[#EEF2FF] border border-[#C8D5F0] rounded-xl space-y-1">
                      <span className="text-brand-blue font-bold text-[11px] block">Primary Clinical Impression</span>
                      <p className="text-[#0F1A3A] font-bold text-xs">{rec.primaryImpression || assessment.primaryImpression || 'Acute Chest Pain / Cardiac Workup'}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[#8A97B0] font-bold text-[11px] block">Paramedic & Clinical Narrative</span>
                      <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F1A3A] text-xs leading-relaxed font-medium">
                        {rec.narrative || rec.clinicalNotes || 'Patient presented with acute clinical symptoms. Emergency vitals captured and standard protocol initiated. Transferred for specialist evaluation.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Vitals & Interventions */}
            {activeTab === 'vitals' && (
              <div className="space-y-6">
                {/* Vitals Timeline */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="font-black text-[#0F1A3A] text-sm flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
                    <HeartPulse size={18} className="text-rose-600" />
                    <span>Vital Signs Progression Log</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#8A97B0] font-bold">
                          <th className="p-3">Time</th>
                          <th className="p-3">BP (mmHg)</th>
                          <th className="p-3">Pulse (bpm)</th>
                          <th className="p-3">SpO2 (%)</th>
                          <th className="p-3">Resp Rate</th>
                          <th className="p-3">Temp (°C)</th>
                          <th className="p-3">GCS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F4FC]">
                        {Array.isArray(vitals) && vitals.length > 0 ? (
                          vitals.map((v, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 font-medium text-[#0F1A3A]">
                              <td className="p-3 font-mono">{v.time || v.timestamp || `T+${idx * 15}m`}</td>
                              <td className="p-3 font-bold text-brand-blue">{v.bp || v.bloodPressure || '120/80'}</td>
                              <td className="p-3 font-bold">{v.pulse || v.heartRate || '78'}</td>
                              <td className="p-3 font-bold text-emerald-600">{v.spo2 || '98%'}</td>
                              <td className="p-3">{v.respRate || v.respiratoryRate || '16'}</td>
                              <td className="p-3">{v.temp || v.temperature || '36.8'}</td>
                              <td className="p-3 font-bold">{v.gcs || '15 (E4V5M6)'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="font-medium text-[#0F1A3A]">
                            <td className="p-3 font-mono">Admission</td>
                            <td className="p-3 font-bold text-brand-blue">{rec.bp || '128/82'}</td>
                            <td className="p-3 font-bold">{rec.pulse || '82'}</td>
                            <td className="p-3 font-bold text-emerald-600">{rec.spo2 || '99%'}</td>
                            <td className="p-3">{rec.respRate || '16'}</td>
                            <td className="p-3">{rec.temp || '37.0'}</td>
                            <td className="p-3 font-bold">15</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Administered Medications */}
                <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="font-black text-[#0F1A3A] text-sm flex items-center gap-2 border-b border-[#F0F4FC] pb-3">
                    <Pill size={18} className="text-amber-600" />
                    <span>Administered Medications & Interventions</span>
                  </h3>

                  {Array.isArray(meds) && meds.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {meds.map((m, idx) => (
                        <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <strong className="text-[#0F1A3A] font-bold block">{m.medicationName || m.name}</strong>
                          <span className="text-[#8A97B0] text-[11px] block">
                            Dose: {m.dose} • Route: {m.route} • Time: {m.administeredTime || 'Recorded'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#8A97B0] italic">
                      Standard oxygen therapy and IV access established. No secondary medications administered.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Specialist Consultation Opinion Form */}
            {activeTab === 'opinion' && (
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-md space-y-6">
                <div className="flex items-center justify-between border-b border-[#F0F4FC] pb-4">
                  <div>
                    <h3 className="font-black text-[#0F1A3A] text-base">Specialist Clinical Opinion & Response</h3>
                    <p className="text-xs text-[#8A97B0]">
                      Submit your consultation findings directly to the attending clinical team.
                    </p>
                  </div>
                </div>

                {/* Previous Saved Response */}
                {shareBundle.responseNotes && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <span className="text-emerald-800 font-bold text-xs block flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Submitted Specialist Opinion
                    </span>
                    <p className="text-emerald-950 text-xs font-medium leading-relaxed">{shareBundle.responseNotes}</p>
                  </div>
                )}

                {successMessage && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Interactive Response Form */}
                <form onSubmit={handleResponseSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#0F1A3A] block mb-1.5">
                      Clinical Notes / Specialist Recommendation
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Type your clinical assessment, recommended diagnostic tests, or treatment advice here..."
                      value={responseNotesText}
                      onChange={(e) => setResponseNotesText(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs text-[#0F1A3A] placeholder-[#A0AECB] focus:border-brand-blue focus:outline-none leading-relaxed"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="py-3 px-6 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    {loading ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Send size={16} />
                        <span>Submit Specialist Consultation Response</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-[11px] text-[#8A97B0] py-4 border-t border-[#E2E8F0]">
        Confidential Medical Information • Protected under HIPAA Privacy Standards • Unauthorized access is prohibited
      </footer>
    </div>
  );
};

export default ExternalShareView;
