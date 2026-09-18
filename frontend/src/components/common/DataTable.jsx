import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

/**
 * DataTable — generic, sortable, searchable, paginated table.
 *
 * Props:
 *   columns  — [{ key, label, render?, sortable? }]
 *   data     — array of row objects
 *   loading  — bool
 *   error    — string | null
 *   emptyMsg — string shown when no data
 *   pageSize — default rows per page (default 10)
 *   searchable — bool (default true)
 *   onRowClick — (row) => void
 */
const DataTable = ({
  columns = [], data = [], loading = false, error = null,
  emptyMsg = 'No records found.', pageSize: defaultPageSize = 10,
  searchable = true, onRowClick, actions,
}) => {
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [sort, setSort]       = useState({ key: null, dir: 'asc' });
  const [pageSize] = useState(defaultPageSize);

  // Filter
  const filtered = data.filter(row =>
    !searchable || !search ||
    columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  // Sort
  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const av = a[sort.key] ?? ''; const bv = b[sort.key] ?? '';
        return sort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      })
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    setPage(1);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Toolbar */}
      {searchable && (
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50" />
          </div>
          <span className="text-xs text-slate-500 shrink-0">{filtered.length} results</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto min-h-[200px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider border-b border-[var(--border-color)]">
              {columns.map(c => (
                <th key={c.key} className="px-5 py-3 font-medium whitespace-nowrap">
                  {c.sortable !== false ? (
                    <button onClick={() => toggleSort(c.key)} className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                      {c.label}<ArrowUpDown size={12} className="opacity-50" />
                    </button>
                  ) : c.label}
                </th>
              ))}
              {actions && <th className="px-5 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map(c => (
                    <td key={c.key} className="px-5 py-4">
                      <div className="h-3 bg-slate-800 rounded w-24" />
                    </td>
                  ))}
                  {actions && <td className="px-5 py-4"><div className="h-3 bg-slate-800 rounded w-12 ml-auto" /></td>}
                </tr>
              ))
            ) : error ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-12 text-center text-rose-400 text-sm">{error}</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-5 py-12 text-center text-slate-500 text-sm">{emptyMsg}</td></tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-slate-800/30 transition-colors group ${onRowClick ? 'cursor-pointer' : ''}`}>
                  {columns.map(c => (
                    <td key={c.key} className="px-5 py-3.5 text-sm text-slate-300 whitespace-nowrap">
                      {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors text-slate-400">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-40 transition-colors text-slate-400">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
