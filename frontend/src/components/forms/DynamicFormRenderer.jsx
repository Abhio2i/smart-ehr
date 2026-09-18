import { CheckCircle2, ChevronRight, Info } from 'lucide-react';

const inputCls = 'w-full bg-white border-2 border-[#DDE3F0] px-4 py-3 text-[#0F1A3A] focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all rounded-lg placeholder-[#A0AECB]';

const ToggleButton = ({ label, checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-lg transition-all duration-200 font-semibold text-sm ${
      checked
        ? 'bg-brand-blue border-brand-blue text-white shadow-md'
        : 'bg-white border-[#DDE3F0] text-[#8A97B0] hover:border-brand-blue hover:text-brand-blue'
    }`}
  >
    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${checked ? 'border-white bg-white' : 'border-[#DDE3F0]'}`} />
    <span className="text-xs font-bold uppercase">{label}</span>
  </button>
);

const getPlaceholder = (field) => {
  if (field.placeholder) return field.placeholder;
  
  switch (field.type) {
    case 'text':
      return `Enter ${field.label.toLowerCase()}...`;
    case 'number':
      return `Enter a number...`;
    case 'textarea':
      return `Enter detailed information...`;
    case 'date':
      return `Select a date...`;
    case 'select':
      return `Select an option...`;
    default:
      return `Enter value...`;
  }
};

const DynamicFormRenderer = ({ schema, values = {}, onChange, onSubmit, onCancel, errors = {} }) => {
  const fields = schema?.fields || [];

  if (fields.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-[#A0AECB] border-2 border-dashed border-[#DDE3F0] rounded-2xl bg-[#F8FAFF]">
      <Info size={28} className="mb-3 opacity-60" />
      <p className="text-sm font-semibold">No form fields defined</p>
    </div>
  );

  const renderField = (field) => {
    const val = values[field.key];
    const key = field.key;
    const error = errors[key];
    const fieldCls = error 
      ? 'w-full bg-white border-2 border-brand-red px-4 py-3 text-brand-red focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 transition-all rounded-lg placeholder-brand-red/50'
      : inputCls;

    switch (field.type) {
      case 'text':
        return <input 
          value={val || ''} 
          onChange={e => onChange(key, e.target.value)} 
          className={fieldCls} 
          placeholder={getPlaceholder(field)} 
        />;

      case 'number':
        return <input 
          type="number" 
          value={val || ''} 
          onChange={e => onChange(key, e.target.value)} 
          className={fieldCls}
          placeholder={getPlaceholder(field)}
        />;

      case 'textarea':
        return <textarea 
          value={val || ''} 
          onChange={e => onChange(key, e.target.value)} 
          rows={4} 
          className={fieldCls + ' resize-none'}
          placeholder={getPlaceholder(field)}
        />;

      case 'date':
        return <input 
          type="date" 
          value={val || ''} 
          onChange={e => onChange(key, e.target.value)} 
          className={fieldCls}
        />;

      case 'boolean':
        return (
          <div className="flex gap-3">
            <ToggleButton 
              label="Yes" 
              checked={val === 'Yes' || val === true} 
              onChange={(v) => onChange(key, v ? 'Yes' : 'No')} 
            />
            <ToggleButton 
              label="No" 
              checked={val === 'No' || val === false} 
              onChange={(v) => onChange(key, v ? 'No' : 'Yes')} 
            />
          </div>
        );

      case 'select':
        return (
          <select 
            value={val || ''} 
            onChange={e => onChange(key, e.target.value)} 
            className={fieldCls + ' appearance-none cursor-pointer bg-right bg-no-repeat'}
            style={{backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238A97B0%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e")', paddingRight: '32px'}}
          >
            <option value="">{getPlaceholder(field)}</option>
            {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );

      default:
        return <input 
          value={val || ''} 
          onChange={e => onChange(key, e.target.value)} 
          className={fieldCls}
          placeholder={getPlaceholder(field)}
        />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {fields.map(field => (
          <div key={field.id || field.key} className={`space-y-2 ${field.type === 'textarea' ? 'col-span-1 md:col-span-2' : ''}`}>
            <label className={`text-sm font-semibold flex items-center gap-2 ${errors[field.key] ? 'text-brand-red' : 'text-[#4B5A7A]'}`}>
              {field.label}
              {field.required && <span className="text-brand-red font-bold">*</span>}
            </label>
            {renderField(field)}
            {errors[field.key] && <p className="text-[10px] font-bold text-brand-red uppercase">{errors[field.key]}</p>}
          </div>
        ))}
      </div>
      
      {(onSubmit || onCancel) && (
        <div className="flex gap-3 pt-4 border-t border-[#DDE3F0]">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-sm font-semibold text-[#8A97B0] hover:text-[#0F1A3A] transition-colors"
            >
              Cancel
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              className="ml-auto px-6 py-2.5 bg-brand-blue text-white rounded-lg font-semibold text-sm hover:bg-brand-blue/90 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              Submit
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DynamicFormRenderer;
