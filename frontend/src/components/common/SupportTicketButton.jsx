import { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  X, Upload, RefreshCw, Bug, Palette, Key, HelpCircle,
  AlertOctagon, AlertTriangle, Info, ShieldAlert
} from 'lucide-react';
import { createTicket } from '../../store/slices/ticketSlice';
import { selectRole } from '../../store/slices/authSlice';
import { addToast } from '../../store/slices/uiSlice';

const CATEGORIES = [
  { id: 'BUG', label: 'Application Bug', icon: Bug, desc: 'Functionality broken or errors', color: 'text-red-500 bg-red-50 border-red-100 hover:bg-red-100/50' },
  { id: 'USABILITY', label: 'Design Issue', icon: Palette, desc: 'Visual bugs or user interface flaws', color: 'text-amber-500 bg-amber-50 border-amber-100 hover:bg-amber-100/50' },
  { id: 'ACCESS', label: 'Access / Auth', icon: Key, desc: 'Login, permissions, or role issues', color: 'text-purple-500 bg-purple-50 border-purple-100 hover:bg-purple-100/50' },
  { id: 'OTHER', label: 'Other Support', icon: HelpCircle, desc: 'General queries or requests', color: 'text-blue-500 bg-blue-50 border-blue-100 hover:bg-blue-100/50' }
];

const PRIORITIES = [
  { id: 'LOW', label: 'Low', desc: 'Minor issue', color: 'border-slate-200 text-slate-700 bg-slate-50', activeColor: 'bg-slate-100 border-slate-400 text-slate-800 ring-2 ring-slate-100' },
  { id: 'MEDIUM', label: 'Medium', desc: 'Standard support', color: 'border-blue-100 text-blue-700 bg-blue-50/30', activeColor: 'bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-100' },
  { id: 'HIGH', label: 'High', desc: 'Urgent attention', color: 'border-orange-100 text-orange-700 bg-orange-50/30', activeColor: 'bg-orange-50 border-orange-400 text-orange-800 ring-2 ring-orange-100' },
  { id: 'URGENT', label: 'Urgent', desc: 'Blocks clinical work', color: 'border-red-100 text-red-700 bg-red-50/30', activeColor: 'bg-red-50 border-red-400 text-red-800 ring-2 ring-red-100' }
];

const SupportTicketButton = ({ visible = true }) => {
  const dispatch = useDispatch();
  const role = useSelector(selectRole);

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('BUG');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Exclude patients and guests from raising tickets
  if (!role || role === 'PATIENT') {
    return null;
  }

  const handleFile = (file) => {
    if (file) {
      if (!file.type.startsWith('image/')) {
        dispatch(addToast({ type: 'error', message: 'Only image files are allowed for screenshots' }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        dispatch(addToast({ type: 'error', message: 'Screenshot file size exceeds 10MB limit' }));
        return;
      }
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      dispatch(addToast({ type: 'error', message: 'Please fill in all required fields' }));
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('subject', subject.trim());
    formData.append('description', description.trim());
    formData.append('category', category);
    formData.append('priority', priority);
    if (screenshot) {
      formData.append('screenshot', screenshot);
    }

    try {
      await dispatch(createTicket(formData)).unwrap();
      dispatch(addToast({ type: 'success', message: 'Support ticket submitted successfully!' }));
      // Reset form
      setSubject('');
      setCategory('BUG');
      setPriority('MEDIUM');
      setDescription('');
      handleRemoveFile();
      setIsOpen(false);
    } catch (err) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to submit ticket. Please try again.' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const voiceSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <>
      <div 
        style={{ 
          position: 'fixed', 
          right: '2px', 
          width: '100px',
          bottom: voiceSupported ? '108px' : '24px', 
          zIndex: 250, 
          display: visible ? 'flex' : 'none', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '8px' 
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-brand-blue text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-brand-blue-dark hover:scale-105 active:scale-95 transition-all duration-200 border border-white/10 group"
          title="Report an Issue / Support"
        >
          <HelpCircle className="w-6 h-6 animate-pulse group-hover:rotate-45 transition-transform duration-500" />
        </button>
        <span 
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#A0AECB',
            transition: 'color 0.3s',
          }}
        >
          Support
        </span>
      </div>

      {/* Slide-over Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-[#0F1A3A]/70 backdrop-blur-md z-[500] flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-[#DDE3F0] overflow-hidden animate-fade-in flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC] bg-[#F8FAFF] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-blue text-white rounded-xl flex items-center justify-center shadow-md">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h2 className="font-black text-[#0F1A3A] text-lg leading-tight">Create Support Ticket</h2>
                  <p className="text-xs text-[#8A97B0]">Let us know if you hit a bug or need operational help.</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest flex items-center gap-1">
                  <span>Subject</span>
                  <span className="text-brand-red font-bold">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is the issue? (e.g., Patient records failing to load)"
                  className="input py-2.5 text-xs focus:ring-2 focus:ring-brand-blue/10 border-[#DDE3F0]"
                />
              </div>

              {/* Category Grid (No dropdowns) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Select Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-brand-blue ring-2 ring-brand-blue/10 bg-[#F5F8FF]'
                            : 'border-[#DDE3F0] hover:border-brand-blue/40 bg-white'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${cat.color}`}>
                          <CatIcon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black leading-tight ${isSelected ? 'text-brand-blue' : 'text-[#0F1A3A]'}`}>
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-[#8A97B0] leading-tight mt-0.5 truncate">{cat.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority Selector (Clickable pills) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITIES.map((prio) => {
                    const isSelected = priority === prio.id;
                    return (
                      <button
                        type="button"
                        key={prio.id}
                        onClick={() => setPriority(prio.id)}
                        className={`py-2 px-3 text-center rounded-xl border transition-all ${
                          isSelected ? prio.activeColor : `${prio.color} border-[#DDE3F0] hover:border-slate-300`
                        }`}
                      >
                        <p className="text-xs font-black">{prio.label}</p>
                        <p className="text-[9px] opacity-70 leading-none mt-0.5">{prio.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest flex items-center gap-1">
                  <span>Description Details</span>
                  <span className="text-brand-red font-bold">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain exactly what happened. If applicable, mention step-by-step how to reproduce the issue..."
                  className="input py-2.5 text-xs font-medium min-h-[100px] resize-y focus:ring-2 focus:ring-brand-blue/10 border-[#DDE3F0]"
                />
              </div>

              {/* Drag-and-drop screenshot uploader */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-[#4B5A7A] uppercase tracking-widest">Screenshot / Image Attachment</label>
                
                {screenshotPreview ? (
                  <div className="relative border border-[#DDE3F0] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-3 max-h-[180px] shadow-inner">
                    <img
                      src={screenshotPreview}
                      alt="Upload Preview"
                      className="max-h-[156px] max-w-full rounded-lg object-contain shadow-sm border border-white"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="absolute top-2.5 right-2.5 p-2 bg-[#FFECEF] text-brand-red rounded-lg hover:bg-brand-red hover:text-white transition-all shadow-md"
                      title="Remove attachment"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                      isDragging
                        ? 'border-brand-blue bg-[#F5F8FF] scale-[0.99]'
                        : 'border-[#DDE3F0] hover:border-brand-blue/40 bg-slate-50/50 hover:bg-[#F8FAFF]'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      <Upload className={`w-7 h-7 mb-2 transition-transform duration-200 ${
                        isDragging ? 'text-brand-blue translate-y-[-2px]' : 'text-[#A0AECB]'
                      }`} />
                      <p className="text-xs font-bold text-[#4B5A7A]">
                        Drag and drop image here, or <span className="text-brand-blue hover:underline">browse files</span>
                      </p>
                      <p className="text-[10px] text-[#A0AECB] mt-0.5">Supports PNG, JPG, or JPEG (Max 10MB)</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-4 pt-4 shrink-0 border-t border-[#F0F4FC]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-ghost flex-1 justify-center border border-[#DDE3F0] rounded-xl py-2.5 text-xs font-bold text-[#8A97B0] hover:text-[#4B5A7A] hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 justify-center py-2.5 text-xs font-black shadow-lg shadow-brand-blue/20"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : null}
                  {isSubmitting ? 'Submitting...' : 'Submit Support Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportTicketButton;
