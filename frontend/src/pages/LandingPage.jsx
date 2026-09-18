import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Heart, Shield, Phone, MapPin, ArrowRight,
  CheckCircle, Clock, FileText, Users, TrendingUp, Bell,
  ChevronRight, Star, Zap, Award, Menu, X
} from 'lucide-react';

/* ── Pulse SVG ── */
const PulseLine = () => (
  <svg viewBox="0 0 500 80" className="w-full" style={{ height: 80 }}>
    <path
      d="M0 40 L80 40 L110 10 L140 70 L170 40 L500 40"
      fill="none" stroke="white" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'pulse-draw 3s ease-in-out infinite' }}
    />
  </svg>
);

/* ── Stat Pill ── */
const StatPill = ({ value, label, color = 'blue' }) => (
  <div className={`rounded-2xl px-6 py-4 text-white ${color === 'red' ? 'bg-brand-red' : 'bg-brand-blue'}`}
    style={{ boxShadow: color === 'red' ? '0 8px 24px rgba(200,16,46,0.3)' : '0 8px 24px rgba(26,60,143,0.3)' }}>
    <p className="text-3xl font-black leading-none">{value}</p>
    <p className="text-xs font-semibold uppercase tracking-widest opacity-75 mt-1">{label}</p>
  </div>
);

/* ── Service Card ── */
const ServiceCard = ({ id, title, desc, icon: Icon }) => (
  <div className="bg-white rounded-2xl p-6 border border-[#DDE3F0] hover:border-brand-blue hover:shadow-[0_8px_32px_rgba(26,60,143,0.12)] transition-all duration-300 group cursor-default">
    <div className="flex items-start gap-4">
      <span className="text-4xl font-black text-[#DDE3F0] group-hover:text-brand-blue transition-colors leading-none">{id}</span>
      <div className="flex-1">
        <div className="w-8 h-8 bg-[#F0F4FC] rounded-lg flex items-center justify-center mb-3 group-hover:bg-brand-blue transition-colors">
          <Icon size={16} className="text-brand-blue group-hover:text-white transition-colors" />
        </div>
        <h3 className="text-sm font-bold text-[#0F1A3A] mb-1 leading-tight">{title}</h3>
        <p className="text-xs text-[#8A97B0] leading-relaxed">{desc}</p>
      </div>
    </div>
  </div>
);

/* ── Dashboard Preview Card ── */
const MiniStat = ({ label, value, accent }) => (
  <div className="bg-white rounded-xl p-4 border border-[#DDE3F0]">
    <p className="text-xs text-[#8A97B0] font-semibold uppercase tracking-wider">{label}</p>
    <p className={`text-2xl font-black mt-1 ${accent ? 'text-brand-red' : 'text-brand-blue'}`}>{value}</p>
  </div>
);

const DashboardPreview = () => (
  <div className="bg-[#F0F4FC] rounded-2xl p-5 border border-[#DDE3F0] shadow-[0_20px_60px_rgba(26,60,143,0.12)]">
    {/* mini header */}
    <div className="bg-brand-blue rounded-xl p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-red rounded-lg flex items-center justify-center">
          <Activity size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm">QA/QI Platform</p>
          <p className="text-white/50 text-xs">System Overview</p>
        </div>
      </div>
      <div className="flex gap-2">
        {['#ef4444','#f59e0b','#22c55e'].map(c => (
          <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />
        ))}
      </div>
    </div>
    {/* mini stats */}
    <div className="grid grid-cols-2 gap-3 mb-4">
      <MiniStat label="EPCR Records" value="1,284" />
      <MiniStat label="Pending QA" value="47" accent />
      <MiniStat label="Approved" value="98%" />
      <MiniStat label="Alerts" value="3" accent />
    </div>
    {/* mini chart bars */}
    <div className="bg-white rounded-xl p-4 border border-[#DDE3F0]">
      <p className="text-xs font-bold text-brand-blue uppercase tracking-wider mb-3">Weekly Activity</p>
      <div className="flex items-end gap-2 h-16">
        {[40,65,45,80,60,90,55].map((h,i) => (
          <div key={i} className="flex-1 rounded-t-md transition-all"
            style={{ height: `${h}%`, background: i === 5 ? '#C8102E' : '#1A3C8F', opacity: 0.15 + (i * 0.12) }} />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {['M','T','W','T','F','S','S'].map((d,i) => (
          <span key={i} className="text-[10px] font-bold text-[#A0AECB] flex-1 text-center">{d}</span>
        ))}
      </div>
    </div>
  </div>
);

/* ── Main Landing Page ── */
const LandingPage = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const services = [
    { id:'01', title:'Emergency Health Response', desc:'Protocols, equipment and training for rapid medical emergency response.', icon: Shield },
    { id:'02', title:'Telemedicine Follow Up',   desc:'Remote consultations for ENT, Dental, and Dermatology care.', icon: Heart },
    { id:'03', title:'Diabetes & Cholesterol',   desc:'Rapid diagnostic tests for chronic disease management.', icon: Activity },
    { id:'04', title:'At Home Relaxation',       desc:'Knee, back and neck massagers for home-based therapy.', icon: Star },
    { id:'05', title:'Continuous Monitoring',    desc:'Medical wearables for round-the-clock health monitoring.', icon: TrendingUp },
    { id:'06', title:'Retractable Medical Bed',  desc:'Automated retractable bed for in-home medical treatment.', icon: Award },
  ];

  return (
    <div className="min-h-screen font-sans bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-[0_2px_20px_rgba(26,60,143,0.12)]' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <p className="text-brand-blue font-black text-lg leading-none tracking-tight">Smart-eHR</p>
              <p className="text-brand-red font-bold text-xs tracking-widest">HEALTH PRODUCTS</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {[['#services','Services'],['#about','About'],['#contact','Contact']].map(([href,label]) => (
              <a key={href} href={href}
                className={`text-sm font-semibold transition-colors ${scrolled ? 'text-[#4B5A7A] hover:text-brand-blue' : 'text-brand-blue hover:text-brand-red'}`}>
                {label}
              </a>
            ))}
            <Link to="/login"
              className="btn-primary text-sm px-5 py-2.5">
              Staff Login <ArrowRight size={15} />
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden p-2 text-brand-blue" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-[#DDE3F0] px-6 py-4 space-y-3">
            {[['#services','Services'],['#about','About'],['#contact','Contact']].map(([href,label]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)}
                className="block text-sm font-semibold text-[#4B5A7A] hover:text-brand-blue py-2">{label}</a>
            ))}
            <Link to="/login" className="btn-primary w-full justify-center text-sm">
              Staff Login <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-gradient-to-br from-brand-blue via-[#1A3C8F] to-[#0F2660] min-h-screen flex items-center overflow-hidden pt-20">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        {/* Red accent blobs */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-red rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-brand-red rounded-full opacity-8 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-white/80 text-xs font-semibold tracking-wider border border-white/20">
              <div className="w-2 h-2 bg-brand-red rounded-full animate-pulse" />
              Health Monitoring & Telemedicine System
            </div>

            <div>
              <h1 className="text-6xl lg:text-7xl font-black text-white leading-[0.9] tracking-tight">
                AT HOME<br />
                <span className="text-brand-red">CARE</span>
              </h1>
              <div className="mt-4 h-1 w-24 bg-brand-red rounded-full" />
            </div>

            <p className="text-white/65 text-lg leading-relaxed max-w-lg">
              Advanced clinical quality assurance platform with real-time ePCR management, 
              telemedicine follow-up, and comprehensive health monitoring for at-home care.
            </p>

            {/* Pulse line graphic */}
            <div className="opacity-40">
              <PulseLine />
            </div>

            <div className="flex flex-wrap gap-4">
              <Link to="/login" className="btn-danger text-sm px-7 py-3.5">
                Enter Dashboard <ArrowRight size={16} />
              </Link>
              <a href="#services" className="btn-outline text-sm px-7 py-3.5 border-white/30 text-white hover:bg-white hover:text-brand-blue">
                Our Services
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 pt-4">
              <StatPill value="6+" label="Service Types" />
              <StatPill value="24/7" label="Monitoring" color="red" />
              <StatPill value="HIPAA" label="Compliant" />
            </div>
          </div>

          {/* Right: Dashboard Preview */}
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-brand-red/20 rounded-full blur-2xl" />
              <DashboardPreview />
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-[#DDE3F0]">
                <div className="w-10 h-10 bg-[#F0F4FC] rounded-xl flex items-center justify-center">
                  <CheckCircle size={20} className="text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F1A3A]">QA Approved</p>
                  <p className="text-xs text-[#8A97B0]">98.4% success rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-24 bg-[#F0F4FC]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="section-label mb-3">What We Offer</p>
            <h2 className="text-4xl font-black text-[#0F1A3A] tracking-tight">
              Health <span className="text-brand-red">Positive</span> Services
            </h2>
            <p className="text-[#8A97B0] mt-4 max-w-xl mx-auto">
              Comprehensive at-home medical care backed by cutting-edge technology and clinical expertise.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map(s => <ServiceCard key={s.id} {...s} />)}
          </div>
        </div>
      </section>

      {/* ── ABOUT / PLATFORM ── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: big heart card */}
          <div className="relative">
            <div className="bg-brand-blue rounded-3xl p-12 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red rounded-full opacity-10 -translate-y-1/3 translate-x-1/3" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center mb-6">
                  <Heart size={32} className="text-white" />
                </div>
                <h3 className="text-4xl font-black leading-tight mb-4">
                  HEALTH<br /><span className="text-brand-red">POSITIVE</span>
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-8">
                  Medical monitoring and telemedicine system designed for continuous, connected care.
                </p>
                {/* Pulse SVG */}
                <div className="opacity-50">
                  <PulseLine />
                </div>
                <p className="text-xs text-white/40 uppercase tracking-widest mt-4">Smart-eHR Protocol v2.0</p>
              </div>
            </div>
            {/* Floating pill */}
            <div className="absolute -bottom-5 right-8 bg-white rounded-2xl shadow-xl px-5 py-4 border border-[#DDE3F0] flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center">
                <Zap size={18} className="text-brand-red" />
              </div>
              <div>
                <p className="text-xs font-black text-[#0F1A3A]">Real-time Alerts</p>
                <p className="text-xs text-[#8A97B0]">Instant notifications</p>
              </div>
            </div>
          </div>

          {/* Right: text */}
          <div className="space-y-8">
            <p className="section-label">About the Platform</p>
            <h2 className="text-4xl font-black text-[#0F1A3A] tracking-tight leading-tight">
              Clinical Quality<br />Assurance Platform
            </h2>
            <p className="text-[#4B5A7A] leading-relaxed">
              The Smart-eHR QA/QI platform provides healthcare organizations with powerful tools 
              to manage electronic patient care records, conduct quality assurance reviews, 
              and ensure HIPAA compliance at every step.
            </p>
            <div className="space-y-4">
              {[
                'Electronic Patient Care Record (ePCR) Management',
                'Multi-tier QA Review Workflows',
                'HIPAA Consent & Disclosure Tracking',
                'Real-time Audit Logs & Reporting',
                'Role-based Access Control (RBAC)',
                'Secure Patient Portal',
              ].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-[#F0F4FC] rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle size={14} className="text-brand-blue" />
                  </div>
                  <p className="text-sm font-medium text-[#4B5A7A]">{item}</p>
                </div>
              ))}
            </div>
            <Link to="/login" className="btn-primary inline-flex text-sm px-6 py-3">
              Access Platform <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-24 bg-brand-blue relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }} />
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-red rounded-full opacity-10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-brand-red text-xs font-bold uppercase tracking-widest mb-3">Get In Touch</p>
            <h2 className="text-4xl font-black text-white tracking-tight">Contact Us</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Address */}
            <div className="bg-white/10 rounded-2xl p-8 border border-white/10">
              <div className="w-12 h-12 bg-brand-red rounded-xl flex items-center justify-center mb-5">
                <MapPin size={22} className="text-white" />
              </div>
              <h4 className="text-white font-bold mb-2">Smart-eHR Products</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                242 India Trade Center, Greater Noida<br />
                B129, Sector 6, Noida
              </p>
            </div>
            {/* Contacts */}
            <div className="bg-white/10 rounded-2xl p-8 border border-white/10">
              <div className="w-12 h-12 bg-brand-red rounded-xl flex items-center justify-center mb-5">
                <Phone size={22} className="text-white" />
              </div>
              <h4 className="text-white font-bold mb-4">Operational Specialists</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider">Dr. Swati</p>
                  <p className="text-white font-bold">+(91) 9560035488</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-wider">Abhinav</p>
                  <p className="text-white font-bold">+(91) 9560921633</p>
                </div>
              </div>
            </div>
            {/* Certification */}
            <div className="bg-brand-red rounded-2xl p-8">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                <Award size={22} className="text-white" />
              </div>
              <h4 className="text-white font-bold mb-2">Clinical Excellence</h4>
              <p className="text-white/70 text-sm mb-4">Protocol Secured & HIPAA Compliant</p>
              <div className="flex gap-1">
                {[...Array(5)].map((_,i) => (
                  <Star key={i} size={16} className="text-white fill-white" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0F2660] text-white/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-semibold uppercase tracking-widest">
          <p>© 2026 Smart-eHR Products</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">HIPAA</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse-draw {
          0%   { stroke-dasharray: 0 1000; opacity: 0; }
          15%  { opacity: 1; }
          80%  { stroke-dasharray: 1000 0; opacity: 1; }
          100% { stroke-dasharray: 1000 0; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
