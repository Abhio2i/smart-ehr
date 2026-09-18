import { Filter, X } from 'lucide-react';

const SELECT_CLS = 'bg-slate-900/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 appearance-none min-w-[140px]';

/**
 * FilterBar — horizontal filter row for any data page.
 *
 * Props:
 *   filters  — [{ key, label, options: [{ value, label }] }]
 *   values   — { [key]: value }
 *   onChange — (key, value) => void
 *   onReset  — () => void
 *   extra    — optional JSX rendered on the right
 */
const FilterBar = ({ filters = [], values = {}, onChange, onReset, extra }) => {
  const isDirty = filters.some(f => values[f.key] && values[f.key] !== '');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
        <Filter size={14} />FILTER
      </div>

      {filters.map(f => (
        <div key={f.key} className="relative">
          <select
            value={values[f.key] || ''}
            onChange={e => onChange?.(f.key, e.target.value)}
            className={SELECT_CLS}>
            <option value="">{f.label}</option>
            {f.options?.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}

      {isDirty && (
        <button onClick={onReset}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-500/10">
          <X size={12} />Reset
        </button>
      )}

      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
};

export default FilterBar;

// Pre-built option sets for common fields
export const STATUS_OPTIONS = [
  { value: 'DRAFT',       label: 'Draft' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED',   label: 'Completed' },
  { value: 'SUBMITTED',   label: 'Submitted' },
  { value: 'APPROVED',    label: 'Approved' },
  { value: 'REJECTED',    label: 'Rejected' },
  { value: 'ARCHIVED',    label: 'Archived' },
];

export const TRANSPORT_OPTIONS = [
  { value: 'GROUND',  label: 'Ground' },
  { value: 'AIR',     label: 'Air' },
  { value: 'WATER',   label: 'Water' },
  { value: 'WALK_IN', label: 'Walk In' },
];

export const CARE_LEVEL_OPTIONS = [
  { value: 'ALS',     label: 'ALS' },
  { value: 'BLS',     label: 'BLS' },
  { value: 'CRITICAL', label: 'Critical Care' },
];
