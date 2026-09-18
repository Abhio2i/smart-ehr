import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectToasts, removeToast } from '../../store/slices/uiSlice';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS = { 
  success: CheckCircle2, 
  error: XCircle, 
  info: Info, 
  warning: AlertTriangle 
};

const Toast = ({ toast }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const Icon = ICONS[toast.type] || Info;

  useEffect(() => {
    const t = setTimeout(() => dispatch(removeToast(toast.id)), toast.duration || 4000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, dispatch]);

  const config = {
    success: {
      title: 'Success',
      borderClass: 'border-l-[#10B981]',
      iconClass: 'text-[#10B981]',
      titleClass: 'text-[#047857]',
      bgClass: 'bg-white shadow-emerald-100/40',
      progressClass: 'bg-[#10B981]'
    },
    error: {
      title: 'Action Failed',
      borderClass: 'border-l-[#F43F5E]',
      iconClass: 'text-[#F43F5E]',
      titleClass: 'text-[#BE123C]',
      bgClass: 'bg-white shadow-rose-100/40',
      progressClass: 'bg-[#F43F5E]'
    },
    info: {
      title: 'Information',
      borderClass: 'border-l-[#0EA5E9]',
      iconClass: 'text-[#0EA5E9]',
      titleClass: 'text-[#0369A1]',
      bgClass: 'bg-white shadow-sky-100/40',
      progressClass: 'bg-[#0EA5E9]'
    },
    warning: {
      title: 'Warning',
      borderClass: 'border-l-[#F59E0B]',
      iconClass: 'text-[#F59E0B]',
      titleClass: 'text-[#B45309]',
      bgClass: 'bg-white shadow-amber-100/40',
      progressClass: 'bg-[#F59E0B]'
    }
  };

  const style = config[toast.type] || config.info;

  const handleToastClick = () => {
    if (toast.onClickUrl) {
      navigate(toast.onClickUrl);
    } else {
      navigate('/notifications');
    }
    dispatch(removeToast(toast.id));
  };

  return (
    <div 
      onClick={handleToastClick}
      className={`relative flex items-start gap-3.5 px-4 py-3.5 rounded-xl border border-y-[#E2E8F0] border-r-[#E2E8F0] border-l-4 shadow-xl min-w-[320px] max-w-sm overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-2xl animate-in slide-in-from-right-8 fade-in duration-300 cursor-pointer hover:bg-slate-50/50 ${style.borderClass} ${style.bgClass}`}
    >
      {/* Icon */}
      <div className={`shrink-0 mt-0.5 ${style.iconClass}`}>
        <Icon size={18} className="stroke-[2.5]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1 text-left">
        <h4 className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${style.titleClass}`}>
          {style.title}
        </h4>
        <p className="text-xs font-semibold text-[#334155] leading-relaxed break-words">
          {toast.message}
        </p>
      </div>

      {/* Close Button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          dispatch(removeToast(toast.id));
        }} 
        className="shrink-0 opacity-40 hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-100 rounded text-slate-500"
      >
        <X size={14} className="stroke-[2.5]" />
      </button>

      {/* Expiry Progress Bar */}
      <div 
        className={`absolute bottom-0 left-0 h-[3px] opacity-80 ${style.progressClass}`}
        style={{ 
          animation: `toastProgress ${toast.duration || 4000}ms linear forwards` 
        }} 
      />
    </div>
  );
};

const ToastContainer = () => {
  const toasts = useSelector(selectToasts);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5">
      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map(t => <Toast key={t.id} toast={t} />)}
    </div>
  );
};

export default ToastContainer;
