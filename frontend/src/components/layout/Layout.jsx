import { useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';
import VoiceCommandButton from '../common/VoiceCommandButton';
import SupportTicketButton from '../common/SupportTicketButton';
import { RefreshCw, Sliders, X } from 'lucide-react';

const PageLoader = () => (
  <div className="min-h-[400px] w-full flex flex-col items-center justify-center gap-3 text-[#A0AECB]">
    <RefreshCw className="animate-spin text-brand-blue w-6 h-6" />
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Loading view...</span>
  </div>
);

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showWidgets, setShowWidgets] = useState(() => {
    const saved = localStorage.getItem('show_floating_widgets');
    return saved !== 'false'; // default to true
  });

  const toggleWidgets = () => {
    setShowWidgets((prev) => {
      const next = !prev;
      localStorage.setItem('show_floating_widgets', String(next));
      return next;
    });
  };

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F4FC]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />

        <main className="flex-1 overflow-y-auto">
          <div className="w-full h-full">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Floating Buttons with visibility control */}
      <SupportTicketButton visible={showWidgets} />
      <VoiceCommandButton visible={showWidgets} />

      {/* Toggle Controls */}
      {showWidgets ? (
        <div 
          style={{ 
            position: 'fixed', 
            right: '2px', 
            width: '100px', 
            bottom: voiceSupported ? '184px' : '108px', 
            zIndex: 251, 
            display: 'flex', 
            justifyContent: 'center' 
          }}
        >
          <button
            onClick={toggleWidgets}
            className="w-7 h-7 bg-white text-[#8A97B0] hover:text-brand-red rounded-full flex items-center justify-center shadow-lg border border-[#DDE3F0] hover:scale-105 active:scale-95 transition-all duration-200"
            title="Hide Voice & Support shortcuts"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div 
          style={{ 
            position: 'fixed', 
            right: '16px', 
            bottom: '16px', 
            zIndex: 251 
          }}
        >
          <button
            onClick={toggleWidgets}
            className="w-10 h-10 bg-brand-blue text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-brand-blue-dark hover:scale-105 active:scale-95 transition-all duration-200 border border-white/10 group"
            title="Show Voice & Support shortcuts"
          >
            <Sliders className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
          </button>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default Layout;
