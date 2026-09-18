import { useState } from 'react';
import { Plus, Trash2, GripVertical, Type, Hash, ToggleLeft, List, Calendar, AlignLeft, CheckSquare } from 'lucide-react';
import { safeUUID } from '../../utils/uuid';

const FIELD_TYPES = [
  { value: 'text',     label: 'Text Input',   icon: <Type size={14} /> },
  { value: 'number',   label: 'Number',        icon: <Hash size={14} /> },
  { value: 'boolean',  label: 'Yes / No',      icon: <ToggleLeft size={14} /> },
  { value: 'select',   label: 'Dropdown',      icon: <List size={14} /> },
  { value: 'date',     label: 'Date',          icon: <Calendar size={14} /> },
  { value: 'textarea', label: 'Long Text',     icon: <AlignLeft size={14} /> },
];

const inputCls = 'w-full bg-white border border-[#DDE3F0] rounded-xl px-4 py-2.5 text-sm text-[#0F1A3A] focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all placeholder-[#A0AECB]';
const labelCls = 'block text-xs font-semibold text-[#8A97B0] mb-1.5';

const placeholderTexts = {
  text: 'e.g. Patient Name',
  number: 'e.g. 42',
  boolean: 'Yes / No option',
  select: 'Select an option',
  date: 'Select a date',
  textarea: 'Enter detailed information...'
};

const emptyField = () => ({
  id: safeUUID(),
  label: '',
  key: '',
  type: 'text',
  required: false,
  placeholder: '',
  options: [],   // for select type
});

/**
 * FormBuilder — visual editor for workflow.formSchema
 * 
 * Props:
 *   schema: { fields: [] }   (current value)
 *   onChange: (newSchema) => void
 */
const FormBuilder = ({ schema, onChange }) => {
  const fields = schema?.fields || [];

  const updateFields = (newFields) => {
    onChange({ ...schema, fields: newFields });
  };

  const addField = () => {
    updateFields([...fields, emptyField()]);
  };

  const removeField = (id) => {
    updateFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id, patch) => {
    updateFields(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const autoKey = (label) =>
    label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className={`${labelCls} mb-0`}>
          Form Fields ({fields.length})
        </span>
        <button
          type="button"
          onClick={addField}
          className="text-xs text-brand-blue hover:text-brand-blue/80 flex items-center gap-1 font-semibold transition-colors"
        >
          <Plus size={14} /> Add Field
        </button>
      </div>

      {fields.length === 0 && (
        <div className="p-8 text-center border-2 border-dashed border-[#DDE3F0] rounded-2xl bg-[#F8FAFF]">
          <Type className="w-10 h-10 mx-auto mb-3 text-[#DDE3F0]" />
          <p className="text-sm font-semibold text-[#A0AECB]">No fields yet. Click "Add Field" to start building.</p>
        </div>
      )}

      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div key={field.id} className="p-5 bg-[#F8FAFF] rounded-2xl border border-[#DDE3F0] space-y-4 hover:border-brand-blue/30 transition-colors">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-[#DDE3F0] cursor-grab" />
                <span className="text-xs font-bold text-brand-blue">Field {idx + 1}</span>
              </div>
              <button
                type="button"
                onClick={() => removeField(field.id)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[#8A97B0] hover:text-brand-red hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Label + Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Label *</label>
                <input
                  value={field.label}
                  onChange={e => updateField(field.id, {
                    label: e.target.value,
                    key: field.key || autoKey(e.target.value),
                  })}
                  placeholder="e.g. Patient Weight"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Field Key (auto)</label>
                <input
                  value={field.key}
                  onChange={e => updateField(field.id, { key: e.target.value })}
                  placeholder="patient_weight"
                  className={inputCls + ' font-mono text-xs'}
                />
              </div>
            </div>

            {/* Type + Placeholder */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Field Type</label>
                <select
                  value={field.type}
                  onChange={e => updateField(field.id, { type: e.target.value })}
                  className={inputCls + ' appearance-none cursor-pointer bg-right bg-no-repeat'}
                  style={{backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238A97B0%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e")', paddingRight: '32px'}}
                >
                  {FIELD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Placeholder</label>
                <input
                  value={field.placeholder}
                  onChange={e => updateField(field.id, { placeholder: e.target.value })}
                  placeholder={placeholderTexts[field.type] || 'Enter value...'}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Options for select */}
            {field.type === 'select' && (
              <div>
                <label className={labelCls}>Options (comma-separated)</label>
                <input
                  value={field.options?.join(', ')}
                  onChange={e => updateField(field.id, {
                    options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="Option A, Option B, Option C"
                  className={inputCls}
                />
              </div>
            )}

            {/* Required toggle */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => updateField(field.id, { required: !field.required })}
                className="flex items-center gap-2 px-3 py-2 border border-[#DDE3F0] rounded-lg hover:border-brand-blue hover:bg-[#EEF2FF] transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${field.required ? 'bg-brand-blue border-brand-blue' : 'border-[#DDE3F0]'}`}>
                  {field.required && <CheckSquare size={10} className="text-white" />}
                </div>
                <span className="text-sm font-semibold text-[#4B5A7A]">Required Field</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {fields.length > 0 && (
        <div className="p-3 bg-[#EEF2FF] rounded-lg border border-[#DDE3F0] text-xs text-brand-blue">
          <span className="font-semibold">✓ {fields.length} field{fields.length !== 1 ? 's' : ''} configured</span>
        </div>
      )}
    </div>
  );
};

export default FormBuilder;
