import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Trash2, X, Save, FolderOpen, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Info, RefreshCw, Filter, Sparkles,
  Play, BookOpen, Tag
} from 'lucide-react';
import { safeUUID } from '../../utils/uuid';

/* ─────────────────────────────────────────────
   Field definitions available for conditions
───────────────────────────────────────────── */
const FIELDS = [
  { key: 'status',        label: 'Status',         type: 'select',
    options: ['DRAFT','PENDING','SUBMITTED','QA_PENDING','QA_APPROVED','APPROVED','REJECTED','ARCHIVED'] },
  { key: 'incidentType',  label: 'Incident Type',  type: 'select',
    options: ['GENERAL','EMERGENCY','TRAUMA','CARDIOLOGY','RESPIRATORY','NEUROLOGY','OBSTETRIC',
              'PEDIATRIC','BEHAVIORAL','DENTIST','ONCOLOGY','RADIOLOGY','ORTHOPEDIC','OTHER'] },
  { key: 'patientName',   label: 'Patient Name',   type: 'text' },
  { key: 'incidentLocation', label: 'Location',    type: 'text' },
  { key: 'incidentDateTime', label: 'Incident Date', type: 'date' },
  { key: 'age',           label: 'Patient Age',    type: 'number' },
  { key: 'chiefComplaint',label: 'Chief Complaint',type: 'text' },
];

const OPERATORS_BY_TYPE = {
  text:   ['contains','not_contains','equals','not_equals','starts_with','is_empty','is_not_empty'],
  select: ['equals','not_equals','in_list'],
  date:   ['before','after','between','equals'],
  number: ['equals','not_equals','greater_than','less_than','between'],
};

const OPERATOR_LABELS = {
  contains:     'contains',
  not_contains: 'does not contain',
  equals:       '=',
  not_equals:   '≠',
  starts_with:  'starts with',
  is_empty:     'is empty',
  is_not_empty: 'is not empty',
  before:       'before',
  after:        'after',
  between:      'between',
  greater_than: '>',
  less_than:    '<',
  in_list:      'is one of',
};

const SEVERITY_CONFIG = {
  INFO:     { label: 'Info',    color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200', icon: Info },
  WARNING:  { label: 'Warning', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  CRITICAL: { label: 'Critical',color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',  icon: AlertTriangle },
  SUCCESS:  { label: 'Pass',    color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200',icon: CheckCircle2 },
};

const STORAGE_KEY = 'epcr_smart_filter_presets';

const newCondition = () => ({
  id: safeUUID(),
  field: 'status',
  operator: 'equals',
  value: '',
  value2: '',   // for 'between'
});

const newRule = () => ({
  id: safeUUID(),
  name: 'New Rule',
  logic: 'AND',       // AND | OR
  conditions: [newCondition()],
  severity: 'WARNING',
  tag: '',
  active: true,
});

/* ─────────────────────────────────────────────
   Evaluate a single condition against a record
───────────────────────────────────────────── */
function evalCondition(record, cond) {
  const field = FIELDS.find(f => f.key === cond.field);
  if (!field) return false;

  const raw = record[cond.field];
  const val = String(raw ?? '').toLowerCase();
  const cv  = String(cond.value ?? '').toLowerCase();
  const cv2 = String(cond.value2 ?? '').toLowerCase();

  switch (cond.operator) {
    case 'equals':       return val === cv;
    case 'not_equals':   return val !== cv;
    case 'contains':     return val.includes(cv);
    case 'not_contains': return !val.includes(cv);
    case 'starts_with':  return val.startsWith(cv);
    case 'is_empty':     return !raw || val.trim() === '';
    case 'is_not_empty': return !!raw && val.trim() !== '';
    case 'in_list':      return cv.split(',').map(x => x.trim()).includes(val);
    case 'before':       return raw && new Date(raw) < new Date(cond.value);
    case 'after':        return raw && new Date(raw) > new Date(cond.value);
    case 'between':      return raw && new Date(raw) >= new Date(cond.value) && new Date(raw) <= new Date(cond.value2);
    case 'greater_than': return parseFloat(val) > parseFloat(cv);
    case 'less_than':    return parseFloat(val) < parseFloat(cv);
    default:             return false;
  }
}

/* Evaluate a rule against a record */
function evalRule(record, rule) {
  if (!rule.active || !rule.conditions?.length) return false;
  const results = rule.conditions.map(c => evalCondition(record, c));
  return rule.logic === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

/* ─────────────────────────────────────────────
   Condition Row Component
───────────────────────────────────────────── */
const ConditionRow = ({ cond, onChange, onRemove, isOnly }) => {
  const field = FIELDS.find(f => f.key === cond.field) || FIELDS[0];
  const operators = OPERATORS_BY_TYPE[field.type] || OPERATORS_BY_TYPE.text;
  const needsValue2 = cond.operator === 'between';
  const noValue = ['is_empty', 'is_not_empty'].includes(cond.operator);

  const inputCls = 'w-full bg-white border border-[#DDE3F0] rounded-lg px-3 py-1.5 text-xs text-[#0F1A3A] focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue/20 transition-all font-medium';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field */}
      <select
        value={cond.field}
        onChange={e => {
          const f = FIELDS.find(x => x.key === e.target.value);
          const ops = OPERATORS_BY_TYPE[f?.type || 'text'];
          onChange({ ...cond, field: e.target.value, operator: ops[0], value: '', value2: '' });
        }}
        className={inputCls + ' w-36 cursor-pointer'}
      >
        {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      {/* Operator */}
      <select
        value={cond.operator}
        onChange={e => onChange({ ...cond, operator: e.target.value, value: '', value2: '' })}
        className={inputCls + ' w-36 cursor-pointer'}
      >
        {operators.map(op => (
          <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
        ))}
      </select>

      {/* Value */}
      {!noValue && (
        field.type === 'select' && cond.operator !== 'in_list' ? (
          <select
            value={cond.value}
            onChange={e => onChange({ ...cond, value: e.target.value })}
            className={inputCls + ' w-36 cursor-pointer'}
          >
            <option value="">Choose...</option>
            {(field.options || []).map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
          </select>
        ) : (
          <input
            type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
            value={cond.value}
            onChange={e => onChange({ ...cond, value: e.target.value })}
            placeholder={field.type === 'select' ? 'val1,val2,...' : 'Value...'}
            className={inputCls + ' w-40'}
          />
        )
      )}

      {/* Value 2 (for between) */}
      {needsValue2 && (
        <>
          <span className="text-xs text-[#A0AECB] font-semibold">and</span>
          <input
            type={field.type === 'date' ? 'date' : 'number'}
            value={cond.value2}
            onChange={e => onChange({ ...cond, value2: e.target.value })}
            placeholder="End value..."
            className={inputCls + ' w-36'}
          />
        </>
      )}

      {!isOnly && (
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg text-[#A0AECB] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Single Rule Card
───────────────────────────────────────────── */
const RuleCard = ({ rule, onChange, onRemove }) => {
  const [expanded, setExpanded] = useState(true);
  const sev = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.WARNING;
  const SevIcon = sev.icon;

  const updateCondition = (id, updated) =>
    onChange({ ...rule, conditions: rule.conditions.map(c => c.id === id ? updated : c) });
  const removeCondition = id =>
    onChange({ ...rule, conditions: rule.conditions.filter(c => c.id !== id) });
  const addCondition = () =>
    onChange({ ...rule, conditions: [...rule.conditions, newCondition()] });

  return (
    <div className={`rounded-xl border-2 transition-all ${rule.active ? `${sev.border} ${sev.bg}` : 'border-[#DDE3F0] bg-[#F8FAFF] opacity-60'}`}>
      {/* Rule Header */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${rule.active ? sev.bg : 'bg-[#F0F4FC]'} shrink-0`}>
          <SevIcon size={14} className={rule.active ? sev.color : 'text-[#A0AECB]'} />
        </div>

        <input
          value={rule.name}
          onChange={e => onChange({ ...rule, name: e.target.value })}
          className="flex-1 bg-transparent text-sm font-bold text-[#0F1A3A] focus:outline-none placeholder-[#A0AECB] min-w-0"
          placeholder="Rule name..."
        />

        <select
          value={rule.severity}
          onChange={e => onChange({ ...rule, severity: e.target.value })}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${sev.bg} ${sev.color} ${sev.border}`}
        >
          {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        {/* Logic toggle */}
        <button
          onClick={() => onChange({ ...rule, logic: rule.logic === 'AND' ? 'OR' : 'AND' })}
          className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-white border border-[#DDE3F0] text-brand-blue hover:border-brand-blue transition-colors shrink-0"
        >
          {rule.logic}
        </button>

        {/* Active toggle */}
        <button
          onClick={() => onChange({ ...rule, active: !rule.active })}
          className={`w-8 h-4 rounded-full relative transition-all shrink-0 ${rule.active ? 'bg-brand-blue' : 'bg-[#DDE3F0]'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${rule.active ? 'left-4' : 'left-0.5'}`} />
        </button>

        <button onClick={() => setExpanded(x => !x)} className="text-[#A0AECB] hover:text-[#0F1A3A] transition-colors shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        <button onClick={onRemove} className="p-1 rounded-lg text-[#A0AECB] hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Conditions */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="text-[9px] font-black text-[#A0AECB] uppercase tracking-widest px-1 mb-1">
            Match <span className="text-brand-blue">{rule.logic}</span> of the following:
          </div>

          {rule.conditions.map((cond, i) => (
            <div key={cond.id} className="flex items-start gap-2">
              {i > 0 && (
                <span className="text-[9px] font-black text-[#8A97B0] uppercase mt-2.5 w-6 text-center shrink-0">
                  {rule.logic}
                </span>
              )}
              {i === 0 && <div className="w-6 shrink-0" />}
              <div className="flex-1">
                <ConditionRow
                  cond={cond}
                  onChange={updated => updateCondition(cond.id, updated)}
                  onRemove={() => removeCondition(cond.id)}
                  isOnly={rule.conditions.length === 1}
                />
              </div>
            </div>
          ))}

          <button
            onClick={addCondition}
            className="flex items-center gap-1.5 text-[10px] font-bold text-brand-blue hover:text-brand-blue/80 ml-8 mt-1"
          >
            <Plus size={11} /> Add Condition
          </button>

          {/* Optional tag */}
          <div className="flex items-center gap-2 ml-8 mt-2">
            <Tag size={11} className="text-[#A0AECB]" />
            <input
              value={rule.tag}
              onChange={e => onChange({ ...rule, tag: e.target.value })}
              placeholder="Label / tag (optional)..."
              className="text-[10px] bg-transparent border-b border-dashed border-[#DDE3F0] text-[#4B5A7A] focus:outline-none focus:border-brand-blue py-0.5 w-48 placeholder-[#C0CADF]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main SmartFilterEngine Component
───────────────────────────────────────────── */
const SmartFilterEngine = ({ records = [], onFilteredChange, onMatchMap }) => {
  const [rules, setRules] = useState([]);
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  });
  const [presetName, setPresetName] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [matchStats, setMatchStats] = useState({ total: 0, matched: 0 });

  /* Run rules against all records */
  const applyRules = useCallback(() => {
    if (!rules.some(r => r.active)) {
      onFilteredChange?.(records);
      onMatchMap?.({});
      setMatchStats({ total: records.length, matched: 0 });
      return;
    }

    const matchMap = {};
    let matched = 0;

    records.forEach(record => {
      const matchedRules = rules.filter(r => r.active && evalRule(record, r));
      if (matchedRules.length > 0) {
        matchMap[record.id] = matchedRules;
        matched++;
      }
    });

    onMatchMap?.(matchMap);
    setMatchStats({ total: records.length, matched });

    // Filtered records: those matching at least one active rule (OR between rules)
    const filtered = records.filter(r => matchMap[r.id]);
    onFilteredChange?.(filtered.length > 0 ? filtered : records);
  }, [rules, records, onFilteredChange, onMatchMap]);

  useEffect(() => { applyRules(); }, [applyRules]);

  const savePreset = () => {
    if (!presetName.trim()) return;
    const updated = [...presets.filter(p => p.name !== presetName.trim()), {
      name: presetName.trim(), rules, savedAt: new Date().toISOString(),
    }];
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPresetName('');
  };

  const loadPreset = (preset) => {
    setRules(preset.rules.map(r => ({ ...r, id: safeUUID(),
      conditions: r.conditions.map(c => ({ ...c, id: safeUUID() })) })));
    setShowPresets(false);
  };

  const deletePreset = (name) => {
    const updated = presets.filter(p => p.name !== name);
    setPresets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const activeRulesCount = rules.filter(r => r.active).length;

  return (
    <div className="space-y-3">
      {/* Toggle Header */}
      <button
        onClick={() => setIsOpen(x => !x)}
        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 transition-all text-left ${
          activeRulesCount > 0
            ? 'border-brand-blue bg-[#EEF2FF] text-brand-blue'
            : 'border-[#DDE3F0] bg-white text-[#4B5A7A] hover:border-brand-blue hover:bg-[#F8FAFF]'
        }`}
        id="smart-filter-toggle"
      >
        <Zap size={16} className={activeRulesCount > 0 ? 'text-brand-blue' : 'text-[#A0AECB]'} />
        <div className="flex-1">
          <span className="text-sm font-bold">Smart Filter Rules</span>
          {activeRulesCount > 0 && (
            <span className="ml-2 text-[10px] font-black bg-brand-blue text-white px-2 py-0.5 rounded-full">
              {activeRulesCount} active · {matchStats.matched} matched
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8A97B0]">
          {rules.length > 0 && <span>{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>}
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isOpen && (
        <div className="card p-4 space-y-4 border-2 border-[#EEF2FF]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#A0AECB] uppercase tracking-widest">
              <Sparkles size={12} /> Conditional Logic Engine
            </div>
            <div className="flex-1" />

            {/* Preset Save */}
            <div className="flex items-center gap-1.5">
              <input
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="text-xs border border-[#DDE3F0] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-brand-blue w-32"
                onKeyDown={e => e.key === 'Enter' && savePreset()}
              />
              <button
                onClick={savePreset}
                disabled={!presetName.trim() || !rules.length}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-[#EEF2FF] text-brand-blue hover:bg-brand-blue hover:text-white transition-colors disabled:opacity-40"
              >
                <Save size={12} /> Save
              </button>
            </div>

            {/* Load Presets */}
            {presets.length > 0 && (
              <button
                onClick={() => setShowPresets(x => !x)}
                className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-[#DDE3F0] text-[#4B5A7A] hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                <BookOpen size={12} /> Presets ({presets.length})
              </button>
            )}

            {/* Clear All */}
            {rules.length > 0 && (
              <button
                onClick={() => setRules([])}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}

            {/* Add Rule */}
            <button
              onClick={() => setRules(prev => [...prev, newRule()])}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors"
              id="add-smart-rule-btn"
            >
              <Plus size={12} /> Add Rule
            </button>
          </div>

          {/* Presets Panel */}
          {showPresets && (
            <div className="rounded-xl border border-[#DDE3F0] bg-[#F8FAFF] p-3 space-y-2">
              <p className="text-[10px] font-black text-[#A0AECB] uppercase tracking-widest">Saved Presets</p>
              {presets.map(p => (
                <div key={p.name} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#DDE3F0]">
                  <FolderOpen size={13} className="text-brand-blue shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#0F1A3A] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#A0AECB]">{p.rules?.length} rule{p.rules?.length !== 1 ? 's' : ''} · Saved {new Date(p.savedAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => loadPreset(p)} className="text-[10px] font-bold px-2 py-1 rounded bg-[#EEF2FF] text-brand-blue hover:bg-brand-blue hover:text-white transition-colors">Load</button>
                  <button onClick={() => deletePreset(p.name)} className="p-1 rounded text-[#A0AECB] hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="py-10 text-center">
              <Filter size={28} className="text-[#DDE3F0] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#A0AECB]">No rules yet</p>
              <p className="text-xs text-[#C0CADF] mt-1">Add a rule to automatically identify records that meet specific criteria</p>
              <button
                onClick={() => setRules([newRule()])}
                className="mt-4 flex items-center gap-2 mx-auto text-xs font-bold px-4 py-2 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors"
              >
                <Plus size={13} /> Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onChange={updated => setRules(prev => prev.map(r => r.id === updated.id ? updated : r))}
                  onRemove={() => setRules(prev => prev.filter(r => r.id !== rule.id))}
                />
              ))}
            </div>
          )}

          {/* Live Stats Bar */}
          {rules.some(r => r.active) && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-[#F0F7FF] rounded-xl border border-[#DDE8FF]">
              <Play size={13} className="text-brand-blue shrink-0" />
              <span className="text-xs font-semibold text-[#4B5A7A]">
                Rules matched <span className="font-black text-brand-blue">{matchStats.matched}</span> of{' '}
                <span className="font-black text-[#0F1A3A]">{matchStats.total}</span> records
              </span>
              {matchStats.matched === 0 && rules.some(r => r.active) && (
                <span className="text-[10px] text-[#A0AECB] ml-auto">No records match the current criteria</span>
              )}
              {matchStats.matched > 0 && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="h-1.5 w-24 bg-[#DDE3F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-blue rounded-full transition-all"
                      style={{ width: `${Math.min(100, (matchStats.matched / matchStats.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-brand-blue">
                    {Math.round((matchStats.matched / matchStats.total) * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { evalRule, SEVERITY_CONFIG };
export default SmartFilterEngine;
