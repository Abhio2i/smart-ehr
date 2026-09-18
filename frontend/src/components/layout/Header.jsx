import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { selectUser, selectRole } from '../../store/slices/authSlice';
import { selectUnreadCount, selectUnreadItems, fetchUnreadNotifications, markNotificationRead, markAllRead } from '../../store/slices/notificationSlice';
import { ROLE_MENU } from '../../constants/permissions';
import { addToast } from '../../store/slices/uiSlice';
import { useLanguage } from '../../context/LanguageContext';
import { Bell, Search, Menu, ChevronRight, CheckCircle, AlertTriangle, XCircle, Info, Clock, Check, CheckCheck, Globe } from 'lucide-react';

const BREADCRUMBS = {
  '/dashboard':          ['Dashboard'],
  '/epcr':               ['Records', 'EPCR Registry'],
  '/epcr/new':           ['Records', 'EPCR Registry', 'New Record'],
  '/qa/forms':           ['QA', 'Forms'],
  '/qa/reviews':         ['QA', 'Reviews'],
  '/qa/rules':           ['QA', 'Rules'],
  '/form-templates':     ['Configuration', 'Form Templates'],
  '/workflows':          ['Operations', 'Workflows'],
  '/deployments':        ['Operations', 'Deployments'],
  '/organizations':      ['Admin', 'Organizations'],
  '/users':              ['Admin', 'Users'],
  '/reports':            ['Analytics', 'Reports'],
  '/feedback':           ['Communications', 'Feedback'],
  '/notifications':      ['Alerts', 'Notifications'],
  '/audit-logs':         ['Admin', 'Audit Logs'],
  '/settings':           ['Admin', 'Settings'],
  '/medications':        ['Records', 'Medication Safety'],
  '/hipaa/consent':      ['Compliance', 'HIPAA Consent'],
  '/hipaa/disclosure':   ['Compliance', 'HIPAA Disclosure'],
  '/hipaa/baa':          ['Compliance', 'Business Associates'],
  '/hipaa/deid':         ['Compliance', 'De-Identification'],
  '/patient-portal':     ['Patient', 'Portal'],
  '/break-glass':        ['Security', 'Break-Glass'],
};

const TYPE_CONFIG = {
  INFO:    { icon: Info,          color: 'text-sky-600',    bg: 'bg-sky-50' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-600',  bg: 'bg-amber-50' },
  SUCCESS: { icon: CheckCircle,   color: 'text-emerald-600',bg: 'bg-emerald-50' },
  ERROR:   { icon: XCircle,       color: 'text-brand-red',  bg: 'bg-red-50' },
};
const getConfig = (type) => TYPE_CONFIG[type?.toUpperCase()] || TYPE_CONFIG.INFO;

const Header = ({ setIsMobileMenuOpen }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const user      = useSelector(selectUser);
  const role      = useSelector(selectRole);
  const { lang, setLang, toggleLanguage, t } = useLanguage();
  const unread    = useSelector(selectUnreadCount);
  const unreadItems = useSelector(selectUnreadItems) || [];

  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prevUnreadIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Fetch unread notifications on mount and poll every 10s with circuit breaker backoff
  useEffect(() => {
    if (!user || !role || !ROLE_MENU[role]?.includes('Notifications')) return;

    let failCount = 0;
    let intervalId = null;
    let backoffId = null;
    const MAX_FAILS = 3;
    const POLL_MS = 10_000;
    const BACKOFF_MS = 60_000;

    const poll = () => {
      dispatch(fetchUnreadNotifications())
        .unwrap()
        .then(() => { failCount = 0; })
        .catch(() => {
          failCount++;
          if (failCount >= MAX_FAILS) {
            // Stop polling, wait 60s, then restart
            clearInterval(intervalId);
            backoffId = setTimeout(() => {
              failCount = 0;
              intervalId = setInterval(poll, POLL_MS);
            }, BACKOFF_MS);
          }
        });
    };

    poll();
    intervalId = setInterval(poll, POLL_MS);

    return () => {
      clearInterval(intervalId);
      clearTimeout(backoffId);
    };
  }, [dispatch, user, role]);

  // Push floating Toast notification popups in bottom-right corner when new ones arrive
  useEffect(() => {
    if (!user || !unreadItems) {
      isFirstLoadRef.current = true;
      prevUnreadIdsRef.current = new Set();
      return;
    }

    const getDestinationUrl = (item) => {
      if (!item) return '/notifications';
      const type = (item.relatedEntityType || '').toLowerCase();
      if (type === 'feedbackthread') {
        return '/feedback';
      }
      if (type === 'patientcarerecord') {
        return '/epcr';
      }
      const message = (item.message || '').toLowerCase();
      if (message.includes('bed') || message.includes('room')) {
        return '/beds';
      }
      return '/notifications';
    };

    const currentIds = new Set(unreadItems.map(item => item.id));

    if (isFirstLoadRef.current) {
      prevUnreadIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }

    unreadItems.forEach(item => {
      if (!prevUnreadIdsRef.current.has(item.id)) {
        const toastType = (item.type || 'info').toLowerCase();
        dispatch(addToast({
          type: ['success', 'error', 'warning', 'info'].includes(toastType) ? toastType : 'info',
          message: item.title ? `${item.title}: ${item.message}` : item.message,
          onClickUrl: getDestinationUrl(item),
          duration: 6000
        }));
      }
    });

    prevUnreadIdsRef.current = currentIds;
  }, [unreadItems, dispatch, user]);

  const crumbs = BREADCRUMBS[location.pathname] || ['Platform'];
  const pageTitle = crumbs[crumbs.length - 1];

  return (
    <header className="h-10 bg-white border-b border-[#DDE3F0] flex items-center justify-between px-4 sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden p-1 rounded-md text-brand-blue hover:bg-[#F0F4FC] transition-colors">
          <Menu size={16} />
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={11} className="text-[#C8D5F0]" />}
              <span className={`text-[11px] font-semibold ${
                i === crumbs.length - 1 ? 'text-brand-blue' : 'text-[#A0AECB]'
              }`}>{t(c)}</span>
            </span>
          ))}
        </nav>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Production-Grade Segmented Language Switcher (EN | FR) */}
        <div className="flex items-center bg-[#F0F4FC] p-0.5 rounded-lg border border-[#DDE3F0] shadow-inner">
          <button
            onClick={() => setLang('en')}
            className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all flex items-center gap-1 ${
              lang === 'en'
                ? 'bg-white text-brand-blue shadow-sm border border-[#DDE3F0]'
                : 'text-[#5C6F99] hover:text-[#0F1A3A]'
            }`}
            title="English (Official)"
          >
            <span>EN</span>
          </button>
          <button
            onClick={() => setLang('fr')}
            className={`px-2 py-0.5 text-[10px] font-black rounded-md transition-all flex items-center gap-1 ${
              lang === 'fr'
                ? 'bg-white text-brand-blue shadow-sm border border-[#DDE3F0]'
                : 'text-[#5C6F99] hover:text-[#0F1A3A]'
            }`}
            title="Français (Officiel)"
          >
            <span>FR</span>
          </button>
        </div>

        {/* Search */}
        <div className="hidden lg:flex items-center gap-2 bg-[#F8FAFF] border border-[#DDE3F0] rounded-lg px-2.5 py-1 hover:border-brand-blue transition-colors">
          <Search size={12} className="text-[#A0AECB]" />
          <input type="text" placeholder={t('search_placeholder')}
            className="bg-transparent text-[11px] font-medium text-[#0F1A3A] placeholder-[#A0AECB] focus:outline-none w-36" />
        </div>

        {/* Notifications bell */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-1.5 rounded-lg transition-all ${showNotifications ? 'bg-brand-blue text-white' : 'text-[#4B5A7A] hover:text-brand-blue hover:bg-[#F0F4FC]'}`}>
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-brand-red text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Popover */}
          {showNotifications && (
            <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-[0_8px_40px_rgba(26,60,143,0.12)] border border-[#DDE3F0] overflow-hidden z-50 animate-fade-in origin-top-right">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#F0F4FC] bg-[#F8FAFF]">
                <h3 className="font-bold text-[#0F1A3A] text-xs">Notifications</h3>
                {unread > 0 && (
                  <button onClick={() => dispatch(markAllRead())} className="text-[10px] font-semibold text-brand-blue hover:text-brand-blue/80 flex items-center gap-1">
                    <CheckCheck size={11} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {unreadItems?.length === 0 ? (
                  <div className="p-6 text-center text-[#A0AECB]">
                    <Bell size={20} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium">You're all caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F0F4FC]">
                    {unreadItems.slice(0, 5).map((notif) => {
                      const cfg = getConfig(notif.type);
                      const Icon = cfg.icon;
                      return (
                        <div key={notif.id} className="px-3 py-2.5 hover:bg-[#F8FAFF] transition-colors flex gap-2.5 group relative">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                            <Icon size={12} />
                          </div>
                          <div className="flex-1 min-w-0 pr-5">
                            <p className="text-xs font-semibold text-[#0F1A3A] truncate">{notif.title || 'Alert'}</p>
                            <p className="text-[10px] text-[#8A97B0] line-clamp-2 mt-0.5">{notif.message}</p>
                            <div className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold text-[#A0AECB]">
                              <Clock size={9} />
                              {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </div>
                          </div>
                          <button onClick={() => dispatch(markNotificationRead(notif.id))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#A0AECB] hover:text-brand-blue hover:bg-[#EEF2FF] opacity-0 group-hover:opacity-100 transition-all"
                            title="Mark as read">
                            <Check size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-3 py-2 border-t border-[#F0F4FC] text-center bg-[#F8FAFF]">
                <button onClick={() => { setShowNotifications(false); navigate('/notifications'); }} className="text-[10px] font-bold text-brand-blue hover:text-brand-blue/80 w-full">
                  View all alerts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#DDE3F0]">
          <div className="hidden sm:block text-right">
            <p className="text-[11px] font-bold text-[#0F1A3A] leading-none">
              {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email?.split('@')[0]}
            </p>
            <p className="text-[9px] text-[#A0AECB] font-semibold mt-0.5">{role}</p>
          </div>
          <div className="w-7 h-7 bg-brand-blue rounded-lg flex items-center justify-center text-white font-black text-xs shadow-sm">
            {(user?.firstName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
