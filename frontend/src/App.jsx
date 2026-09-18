import { useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsInitializing, checkAuth } from './store/slices/authSlice';
import { RefreshCw } from 'lucide-react';

// Layout
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleGate from './components/common/RoleGate';
import OfflineBanner from './components/common/OfflineBanner';
import SessionIdleTimer from './components/common/SessionIdleTimer';
import { LanguageProvider } from './context/LanguageContext';

// Pages - Static (Core Views)
import LandingPage   from './pages/LandingPage';
import Login         from './pages/Login';

// Helper for lazy loading components with auto-retry on new build deployments
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasBeenRefreshed = JSON.parse(
      window.sessionStorage.getItem('medepcr_chunk_refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('medepcr_chunk_refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasBeenRefreshed && typeof window !== 'undefined') {
        window.sessionStorage.setItem('medepcr_chunk_refreshed', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

// Pages - Lazily Loaded (Dynamic Chunking)
const Dashboard         = lazyWithRetry(() => import('./pages/Dashboard'));
const RecordsList       = lazyWithRetry(() => import('./pages/RecordsList'));
const CreateRecord      = lazyWithRetry(() => import('./pages/CreateRecord'));
const QaReviews         = lazyWithRetry(() => import('./pages/QaReviews'));
const QaForms           = lazyWithRetry(() => import('./pages/QaForms'));
const QaRules           = lazyWithRetry(() => import('./pages/QaRules'));
const RulesEngine       = lazyWithRetry(() => import('./pages/RulesEngine'));
const FormTemplates     = lazyWithRetry(() => import('./pages/FormTemplates'));
const Workflows         = lazyWithRetry(() => import('./pages/Workflows'));
const Deployments       = lazyWithRetry(() => import('./pages/Deployments'));
const Organizations     = lazyWithRetry(() => import('./pages/Organizations'));
const Users             = lazyWithRetry(() => import('./pages/Users'));
const Reports           = lazyWithRetry(() => import('./pages/Reports'));
const Notifications     = lazyWithRetry(() => import('./pages/Notifications'));
const FeedbackThreads   = lazyWithRetry(() => import('./pages/FeedbackThreads'));
const AuditLogs         = lazyWithRetry(() => import('./pages/AuditLogs'));
const Settings          = lazyWithRetry(() => import('./pages/Settings'));
const Medications       = lazyWithRetry(() => import('./pages/MedicationSafety'));
const Tickets           = lazyWithRetry(() => import('./pages/Tickets'));
const HipaaConsent      = lazyWithRetry(() => import('./pages/HipaaConsent'));
const HipaaDisclosure   = lazyWithRetry(() => import('./pages/HipaaDisclosure'));
const PatientPortal     = lazyWithRetry(() => import('./pages/PatientPortal'));
const BreakGlass        = lazyWithRetry(() => import('./pages/BreakGlass'));
const BusinessAssociate = lazyWithRetry(() => import('./pages/BusinessAssociate'));
const DeIdentification  = lazyWithRetry(() => import('./pages/DeIdentification'));
const PatientHistory    = lazyWithRetry(() => import('./pages/PatientHistory'));
const GeneralOverviewPage  = lazyWithRetry(() => import('./pages/overview/GeneralOverviewPage'));
const CriticalFollowUps    = lazyWithRetry(() => import('./pages/CriticalFollowUps'));
const CardiologyOverviewPage = lazyWithRetry(() => import('./pages/overview/CardiologyOverviewPage'));
const RadiologyOverviewPage = lazyWithRetry(() => import('./pages/overview/RadiologyOverviewPage'));
const OncologyOverviewPage  = lazyWithRetry(() => import('./pages/overview/OncologyOverviewPage'));
const ObstetricOverviewPage = lazyWithRetry(() => import('./pages/overview/ObstetricOverviewPage'));
const UserGuide             = lazyWithRetry(() => import('./pages/UserGuide'));
const MedicalTravel         = lazyWithRetry(() => import('./pages/MedicalTravel'));
const Beds                  = lazyWithRetry(() => import('./pages/Beds'));
const Scheduling            = lazyWithRetry(() => import('./pages/Scheduling'));
const RetentionManager      = lazyWithRetry(() => import('./pages/RetentionManager'));
const OntarioIntegrationPanel  = lazyWithRetry(() => import('./pages/OntarioIntegrationPanel'));
const HealthcareRegistration = lazyWithRetry(() => import('./pages/HealthcareRegistration'));
const HomeCareDispatchBoard = lazyWithRetry(() => import('./pages/HomeCareDispatchBoard'));
const NurseScheduleView     = lazyWithRetry(() => import('./pages/NurseScheduleView'));
const EmergencyTrackingBoard = lazyWithRetry(() => import('./pages/EmergencyTrackingBoard'));
const SurgicalCare          = lazyWithRetry(() => import('./pages/SurgicalCare'));
const Ophthalmology         = lazyWithRetry(() => import('./pages/Ophthalmology'));
const DentalCare            = lazyWithRetry(() => import('./pages/DentalCare'));
const LtcManagement         = lazyWithRetry(() => import('./pages/LtcManagement'));
const MentalHealth          = lazyWithRetry(() => import('./pages/MentalHealth'));
const ChildFamilyServices   = lazyWithRetry(() => import('./pages/ChildFamilyServices'));
const RehabilitationServices = lazyWithRetry(() => import('./pages/RehabilitationServices'));
const ClaimsManagement      = lazyWithRetry(() => import('./pages/ClaimsManagement'));
const ProviderPayoutLedger  = lazyWithRetry(() => import('./pages/ProviderPayoutLedger'));
const QuickPay              = lazyWithRetry(() => import('./pages/QuickPay'));
const WaitlistManagement    = lazyWithRetry(() => import('./pages/WaitlistManagement'));
const TbCaseManagement      = lazyWithRetry(() => import('./pages/TbCaseManagement'));
const AmbulatoryReferrals   = lazyWithRetry(() => import('./pages/AmbulatoryReferrals'));
const LabOrders             = lazyWithRetry(() => import('./pages/LabOrders'));
const DischargeManagement   = lazyWithRetry(() => import('./pages/DischargeManagement'));
const NonMedicationOrders   = lazyWithRetry(() => import('./pages/NonMedicationOrders'));
const RecordShares          = lazyWithRetry(() => import('./pages/RecordShares'));
const ExternalShareView     = lazyWithRetry(() => import('./pages/ExternalShareView'));

// Route guard: wraps ProtectedRoute + RoleGate
const GuardedRoute = ({ menuItem, roles, children }) => (
  <ProtectedRoute>
    <RoleGate menuItem={menuItem} roles={roles}>
      {children}
    </RoleGate>
  </ProtectedRoute>
);

const AppRoutes = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isInitializing = useSelector(selectIsInitializing);
  const role = useSelector(state => state.auth.user?.role);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  // Sync any pending offline audit logs once authentication is restored on startup
  useEffect(() => {
    if (isAuthenticated && navigator.onLine) {
      import('./utils/offlineAudit').then(({ syncOfflineAudits }) => {
        syncOfflineAudits().catch(() => {});
      });
      // Sync any pending offline home care check-in/checkout actions
      import('./utils/offlineHomecare').then(({ syncOfflineHomeCareActions }) => {
        syncOfflineHomeCareActions().catch(() => {});
      });
    }
  }, [isAuthenticated]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <RefreshCw className="animate-spin text-brand-blue w-8 h-8" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Redirect root and legacy login to /epcr/login */}
      <Route path="/" element={<Navigate to="/epcr/login" replace />} />
      <Route path="/login" element={<Navigate to="/epcr/login" replace />} />
      <Route path="/epcr/login" element={isAuthenticated ? <Navigate to={role === 'PATIENT' ? '/patient-portal' : '/dashboard'} replace /> : <Login />} />
      <Route path="/shared/:shareId" element={<ExternalShareView />} />
      <Route path="/epcr/shared/:shareId" element={<ExternalShareView />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="dashboard" element={role === 'PATIENT' ? <Navigate to="/patient-portal" replace /> : <Dashboard />} />
        <Route path="user-guide" element={<GuardedRoute menuItem="User Guide"><UserGuide /></GuardedRoute>} />
        <Route index element={<Navigate to="dashboard" replace />} />

        <Route path="epcr"       element={<GuardedRoute menuItem="EPCR"><RecordsList /></GuardedRoute>} />
        <Route path="epcr/new"   element={<GuardedRoute menuItem="EPCR"><CreateRecord /></GuardedRoute>} />
        <Route path="shares"     element={<GuardedRoute menuItem="Record Shares"><RecordShares /></GuardedRoute>} />

        <Route path="qa/forms"   element={<GuardedRoute menuItem="QA Forms"><QaForms /></GuardedRoute>} />
        <Route path="qa/reviews" element={<GuardedRoute menuItem="QA Reviews"><QaReviews /></GuardedRoute>} />
        <Route path="qa/rules"   element={<GuardedRoute menuItem="QA Rules"><QaRules /></GuardedRoute>} />
        <Route path="rules-engine" element={<GuardedRoute menuItem="Rules Engine"><RulesEngine /></GuardedRoute>} />

        <Route path="form-templates" element={<GuardedRoute menuItem="Form Templates"><FormTemplates /></GuardedRoute>} />

        <Route path="workflows"              element={<GuardedRoute menuItem="Workflows"><Workflows /></GuardedRoute>} />
        <Route path="deployments"            element={<GuardedRoute menuItem="Deployments" roles={['ADMIN']}><Deployments /></GuardedRoute>} />

        <Route path="organizations" element={<GuardedRoute menuItem="Organizations"><Organizations /></GuardedRoute>} />
        <Route path="users"         element={<GuardedRoute menuItem="Users"><Users /></GuardedRoute>} />
        <Route path="ed-tracking" element={<GuardedRoute menuItem="Emergency Tracking"><EmergencyTrackingBoard /></GuardedRoute>} />
        <Route path="beds"       element={<GuardedRoute menuItem="Beds"><Beds /></GuardedRoute>} />
        <Route path="tickets"       element={<GuardedRoute menuItem="Tickets"><Tickets /></GuardedRoute>} />
        <Route path="reports"       element={<GuardedRoute menuItem="Reports"><Reports /></GuardedRoute>} />
        <Route path="feedback"      element={<GuardedRoute menuItem="Feedback"><FeedbackThreads /></GuardedRoute>} />
        <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="audit-logs"    element={<GuardedRoute roles={['ADMIN']}><AuditLogs /></GuardedRoute>} />
        <Route path="settings"      element={<GuardedRoute roles={['ADMIN']}><Settings /></GuardedRoute>} />
        <Route path="medications"   element={<GuardedRoute menuItem="Medications"><Medications /></GuardedRoute>} />
        <Route path="medical-travel" element={<GuardedRoute menuItem="Medical Travel"><MedicalTravel /></GuardedRoute>} />
        <Route path="beds"           element={<GuardedRoute menuItem="Bed Management"><Beds /></GuardedRoute>} />
        <Route path="scheduling"     element={<GuardedRoute menuItem="Patient Scheduling"><Scheduling /></GuardedRoute>} />
        <Route path="waitlist"       element={<GuardedRoute menuItem="Waitlist Management"><WaitlistManagement /></GuardedRoute>} />
        <Route path="tb-cases"       element={<GuardedRoute menuItem="TB Case Management"><TbCaseManagement /></GuardedRoute>} />
        <Route path="retention"      element={<GuardedRoute menuItem="Retention & Archiving"><RetentionManager /></GuardedRoute>} />
        <Route path="ontario-integration" element={<GuardedRoute menuItem="Ontario Health Integrations"><OntarioIntegrationPanel /></GuardedRoute>} />
        <Route path="registration"   element={<GuardedRoute menuItem="Healthcare Registration"><HealthcareRegistration /></GuardedRoute>} />
        <Route path="homecare/dispatch"  element={<GuardedRoute menuItem="Home Care Dispatch"><HomeCareDispatchBoard /></GuardedRoute>} />
        <Route path="homecare/schedule"  element={<ProtectedRoute><NurseScheduleView /></ProtectedRoute>} />
        <Route path="surgical/or-board"  element={<GuardedRoute menuItem="Surgical Care"><SurgicalCare /></GuardedRoute>} />
        <Route path="ophthalmology"      element={<GuardedRoute menuItem="Ophthalmology"><Ophthalmology /></GuardedRoute>} />
        <Route path="dental"             element={<GuardedRoute menuItem="Dental Care"><DentalCare /></GuardedRoute>} />
        <Route path="ltc"                element={<GuardedRoute menuItem="Long-Term Care"><LtcManagement /></GuardedRoute>} />
        <Route path="mental-health"      element={<GuardedRoute menuItem="Mental Health"><MentalHealth /></GuardedRoute>} />
        <Route path="child-family-services" element={<GuardedRoute menuItem="Child & Family Services"><ChildFamilyServices /></GuardedRoute>} />
        <Route path="rehab"              element={<GuardedRoute menuItem="Rehabilitation Services"><RehabilitationServices /></GuardedRoute>} />
        <Route path="billing/claims"     element={<GuardedRoute menuItem="Claims Management"><ClaimsManagement /></GuardedRoute>} />
        <Route path="billing/payouts"    element={<GuardedRoute menuItem="Provider Payments"><ProviderPayoutLedger /></GuardedRoute>} />
        <Route path="billing/quick-pay"  element={<GuardedRoute menuItem="Quick Pay"><QuickPay /></GuardedRoute>} />
        <Route path="ambulatory"         element={<GuardedRoute menuItem="Ambulatory Referrals"><AmbulatoryReferrals /></GuardedRoute>} />
        <Route path="clinical/labs"      element={<GuardedRoute menuItem="Lab & Diagnostic Orders"><LabOrders /></GuardedRoute>} />
        <Route path="clinical/discharge" element={<GuardedRoute menuItem="Discharge Management"><DischargeManagement /></GuardedRoute>} />
        <Route path="clinical/non-med-orders" element={<GuardedRoute menuItem="Non-Medication Orders"><NonMedicationOrders /></GuardedRoute>} />

        {/* HIPAA & Patient Routes */}
        <Route path="hipaa/consent"   element={<GuardedRoute menuItem="HIPAA Consent"><HipaaConsent /></GuardedRoute>} />
        <Route path="hipaa/disclosure" element={<GuardedRoute menuItem="HIPAA Disclosure"><HipaaDisclosure /></GuardedRoute>} />
        <Route path="hipaa/baa"       element={<GuardedRoute menuItem="Business Associates"><BusinessAssociate /></GuardedRoute>} />
        <Route path="hipaa/deid"      element={<GuardedRoute menuItem="De-Identification"><DeIdentification /></GuardedRoute>} />
        <Route path="patient-portal"  element={<GuardedRoute menuItem="Patient Portal"><PatientPortal /></GuardedRoute>} />
        <Route path="patient-history/:patientId" element={<GuardedRoute menuItem="Patient History"><PatientHistory /></GuardedRoute>} />
        <Route path="patient-history" element={<GuardedRoute menuItem="Patient History"><PatientHistory /></GuardedRoute>} />

        <Route path="critical-follow-ups" element={<GuardedRoute menuItem="Critical Follow-Ups"><CriticalFollowUps /></GuardedRoute>} />
        
        {/* Dynamic Patient Specialty Overviews */}
        <Route path="patients/:patientId/overview/general" element={<ProtectedRoute><GeneralOverviewPage /></ProtectedRoute>} />
        <Route path="patients/:patientId/overview/cardiology" element={<ProtectedRoute><CardiologyOverviewPage /></ProtectedRoute>} />
        <Route path="patients/:patientId/overview/radiology" element={<ProtectedRoute><RadiologyOverviewPage /></ProtectedRoute>} />
        <Route path="patients/:patientId/overview/oncology" element={<ProtectedRoute><OncologyOverviewPage /></ProtectedRoute>} />
        <Route path="patients/:patientId/overview/obstetric" element={<ProtectedRoute><ObstetricOverviewPage /></ProtectedRoute>} />

        <Route path="break-glass"     element={<GuardedRoute menuItem="Break-Glass"><BreakGlass /></GuardedRoute>} />

        {/* Legacy redirect */}
        <Route path="records"     element={<Navigate to="/epcr" replace />} />
        <Route path="records/new" element={<Navigate to="/epcr/new" replace />} />

        <Route path="*" element={<Navigate to={role === 'PATIENT' ? '/patient-portal' : '/dashboard'} replace />} />
      </Route>
    </Routes>
  );
};

const App = () => (
  <LanguageProvider>
    <BrowserRouter basename="/epcr">
      {/* Global offline status banner & 15-min inactivity timer */}
      <OfflineBanner />
      <SessionIdleTimer />
      <AppRoutes />
    </BrowserRouter>
  </LanguageProvider>
);

export default App;
