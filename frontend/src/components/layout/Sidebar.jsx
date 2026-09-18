import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { logoutUser, selectRole, selectUser } from '../../store/slices/authSlice';
import { selectUnreadCount } from '../../store/slices/notificationSlice';
import { ROLE_MENU, ROUTE_MAP } from '../../constants/permissions';
import { useLanguage } from '../../context/LanguageContext';
import {
  LayoutDashboard, FileText, CheckSquare, ClipboardList, GitBranch, Rocket,
  Building2, Users, PieChart, Server, Settings, Bell, MessageSquare, LogOut,
  Shield, ShieldCheck, BookOpen, Zap, Handshake, EyeOff, UserSquare, Code2,
  Activity, HeartPulse, Sliders, AlertTriangle, LifeBuoy, Pill, Plane, BedDouble, CalendarDays, Fingerprint,
  Home, MapPin, Scissors, FileSpreadsheet, Coins, ListOrdered, Microscope, Eye, Smile, Brain, HeartHandshake, Stethoscope, FlaskConical, Share2
} from 'lucide-react';

const MENU_ICONS = {
  Dashboard: LayoutDashboard,
  Organizations: Building2,
  Users: Users,
  Tickets: LifeBuoy,
  EPCR: FileText,
  'Record Shares': Share2,
  'QA Forms': ClipboardList,
  'QA Reviews': CheckSquare,
  'QA Rules': Shield,
  'Rules Engine': Sliders,
  'Form Templates': Code2,
  Workflows: GitBranch,
  Deployments: Rocket,
  Reports: PieChart,
  Feedback: MessageSquare,
  Notifications: Bell,
  'Audit Logs': Server,
  'System Settings': Settings,
  'HIPAA Consent': ShieldCheck,
  'HIPAA Disclosure': BookOpen,
  'Patient Portal': UserSquare,
  'Patient History': HeartPulse,
  'Break-Glass': Zap,
  'Business Associates': Handshake,
  'De-Identification': EyeOff,
  'Critical Follow-Ups': AlertTriangle,
  'User Guide': BookOpen,
  'Medications': Pill,
  'Medical Travel': Plane,
  'Bed Management': BedDouble,
  'Patient Scheduling': CalendarDays,
  'Waitlist Management': ListOrdered,
  'TB Case Management':  Microscope,
  'Retention & Archiving': ShieldCheck,
  'Ontario Health Integrations': Activity,
  'Healthcare Registration': Fingerprint,
  'Home Care Dispatch': Home,
  'My HC Schedule':    MapPin,
  'Surgical Care':     Scissors,
  'Ophthalmology':    Eye,
  'Dental Care':      Smile,
  'Long-Term Care':   Home,
  'Mental Health':    Brain,
  'Child & Family Services': HeartHandshake,
  'Rehabilitation Services': Activity,
  'Claims Management': FileSpreadsheet,
  'Provider Payments': Coins,
  'Quick Pay': Zap,
  'Ambulatory Referrals': Stethoscope,
  'Emergency Tracking': Activity,
  'Lab & Diagnostic Orders': FlaskConical,
  'Discharge Management': LogOut,
  'Non-Medication Orders': ClipboardList,
};

/* Group menu items by category */
const MENU_GROUPS = [
  { label: 'Overview', items: ['Dashboard', 'User Guide'] },
  { label: 'Records', items: ['EPCR', 'Record Shares', 'Emergency Tracking', 'QA Forms', 'QA Reviews', 'QA Rules', 'Rules Engine', 'Form Templates', 'Medications', 'Bed Management', 'Patient Scheduling', 'Waitlist Management', 'TB Case Management'] },
  { label: 'Community Care', items: ['Home Care Dispatch', 'My HC Schedule', 'Child & Family Services'] },
  { label: 'Clinical Services', items: ['Surgical Care', 'Ophthalmology', 'Dental Care', 'Long-Term Care', 'Mental Health', 'Rehabilitation Services', 'Ambulatory Referrals', 'Lab & Diagnostic Orders', 'Discharge Management', 'Non-Medication Orders'] },
  { label: 'Operations', items: ['Workflows', 'Deployments', 'Reports', 'Feedback', 'Notifications', 'Medical Travel', 'Quick Pay'] },
  { label: 'Admin', items: ['Organizations', 'Users', 'Tickets', 'Audit Logs', 'System Settings', 'Claims Management', 'Provider Payments'] },
  { label: 'Compliance', items: ['HIPAA Consent', 'HIPAA Disclosure', 'Business Associates', 'De-Identification', 'Patient Portal', 'Patient History', 'Healthcare Registration', 'Break-Glass', 'Critical Follow-Ups', 'Retention & Archiving', 'Ontario Health Integrations'] },
];

const MENU_TRANSLATION_KEYS = {
  Dashboard: 'menu_dashboard',
  'User Guide': 'menu_user_guide',
  EPCR: 'menu_epcr',
  'QA Forms': 'menu_qa_forms',
  'QA Reviews': 'menu_qa_reviews',
  'QA Rules': 'menu_qa_rules',
  'Rules Engine': 'menu_rules_engine',
  'Form Templates': 'menu_form_templates',
  Medications: 'menu_medications',
  'Bed Management': 'menu_bed_management',
  'Patient Scheduling': 'menu_patient_scheduling',
  'Waitlist Management': 'menu_waitlist_management',
  'TB Case Management': 'menu_tb_cases',
  'Home Care Dispatch': 'menu_homecare_dispatch',
  'My HC Schedule': 'menu_my_hc_schedule',
  'Child & Family Services': 'menu_cfs',
  'Surgical Care': 'menu_surgical',
  Ophthalmology: 'menu_ophthalmology',
  'Dental Care': 'menu_dental',
  'Long-Term Care': 'menu_ltc',
  'Mental Health': 'menu_mental_health',
  'Rehabilitation Services': 'menu_rehab',
  'Ambulatory Referrals': 'menu_ambulatory',
  'Lab & Diagnostic Orders': 'menu_labs',
  'Discharge Management': 'menu_discharge',
  'Non-Medication Orders': 'menu_non_med_orders',
  Workflows: 'menu_workflows',
  Deployments: 'menu_deployments',
  Reports: 'menu_reports',
  Feedback: 'menu_feedback',
  Notifications: 'notifications',
  'Medical Travel': 'menu_medical_travel',
  Organizations: 'menu_organizations',
  Users: 'menu_users',
  Tickets: 'menu_tickets',
  'Audit Logs': 'menu_audit_logs',
  'System Settings': 'menu_settings',
  'Claims Management': 'menu_claims',
  'Provider Payments': 'menu_payouts',
  'HIPAA Consent': 'menu_hipaa_consent',
  'HIPAA Disclosure': 'menu_hipaa_disclosure',
  'Business Associates': 'menu_baa',
  'De-Identification': 'menu_deid',
  'Patient Portal': 'menu_patient_portal',
  'Patient History': 'menu_patient_history',
  'Healthcare Registration': 'menu_registration',
  'Break-Glass': 'menu_break_glass',
  'Critical Follow-Ups': 'menu_critical_followups',
  'Retention & Archiving': 'menu_retention',
  'Ontario Health Integrations': 'menu_ontario_integration'
};

const CATEGORY_TRANSLATION_KEYS = {
  Overview: 'category_overview',
  Records: 'category_records',
  'Community Care': 'category_community_care',
  'Clinical Services': 'category_clinical_services',
  Operations: 'category_operations',
  Admin: 'category_admin',
  Compliance: 'category_compliance'
};

const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const role = useSelector(selectRole);
  const user = useSelector(selectUser);
  const unread = useSelector(selectUnreadCount);
  const { t } = useLanguage();
  const menuItems = ROLE_MENU[role] || [];

  const handleLogout = async () => {
    await dispatch(logoutUser());
    window.location.href = '/epcr/login';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed md:relative top-0 left-0 h-full w-48 flex flex-col shrink-0 z-50
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: '#1A3C8F' }}>

        {/* Logo */}
        <div className="h-10 flex items-center px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand-red rounded-lg flex items-center justify-center shadow-sm">
              <Activity size={12} className="text-white" />
            </div>
            <div>
              <p className="text-white font-black text-xs leading-none tracking-tight">Smart-eHR</p>
              <p className="text-white/40 font-semibold text-[8px] tracking-widest uppercase">Health Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {MENU_GROUPS.map(group => {
            const visible = group.items.filter(i => menuItems.includes(i));
            if (!visible.length) return null;
            const displayLabel = group.label === 'Admin' && role !== 'ADMIN' ? 'Support' : group.label;
            const translatedCategory = t(CATEGORY_TRANSLATION_KEYS[displayLabel] || displayLabel);
            return (
              <div key={group.label} className="mb-3">
                <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-white/25">
                  {translatedCategory}
                </p>
                {visible.map(item => {
                  const Icon = MENU_ICONS[item] || FileText;
                  const path = ROUTE_MAP[item];
                  if (!path) return null;
                  const itemLabel = t(MENU_TRANSLATION_KEYS[item] || item);
                  return (
                    <NavLink key={item} to={path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 group ${isActive
                          ? 'bg-brand-red text-white shadow-[0_2px_8px_rgba(200,16,46,0.35)]'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                        }`
                      }>
                      <Icon size={12} className="shrink-0" />
                      <span className="flex-1 text-[11px] font-semibold truncate">{itemLabel}</span>
                      {item === 'Notifications' && unread > 0 && (
                        <span className="bg-white text-brand-red text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                          {unread}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-2 border-t border-white/10 shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-6 h-6 bg-brand-red rounded-lg flex items-center justify-center text-white font-black text-[10px] shrink-0">
              {(user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-[11px] font-bold truncate leading-tight">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-white/40 text-[9px] font-semibold uppercase tracking-wider truncate">{role}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all text-[11px] font-semibold">
            <LogOut size={12} /> {t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
