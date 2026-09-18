import { useState, useEffect } from 'react';
import { Rocket, RefreshCw, X, Eye, Download, Filter, Search } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { addToast } from '../store/slices/uiSlice';
import { fetchDeployments, selectDeployments, selectWorkflowLoading } from '../store/slices/workflowSlice';

const Deployments = () => {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  
  const deployments = useSelector(selectDeployments);
  const loading = useSelector(selectWorkflowLoading);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedDeploy, setSelectedDeploy] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => { dispatch(fetchDeployments()); }, [user, dispatch]);

  const getStatusBadge = status => {
    const b = {
      PENDING: 'badge badge-orange',
      IN_PROGRESS: 'badge badge-blue',
      SUCCESS: 'badge badge-green',
      APPLIED: 'badge badge-green',
      FAILED: 'badge badge-red',
      ROLLED_BACK: 'badge badge-gray'
    };
    return b[status] || 'badge badge-gray';
  };

  const formatDate = dateValue => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  const formatTime = dateValue => {
    if (!dateValue) return '—';
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDeploymentDate = dep => dep?.deployedAt || dep?.createdAt || dep?.timestamp || dep?.deploymentTime || null;

  const getConfigTypeIcon = type => {
    const icons = { WORKFLOW: '⚙️', FORM: '📋', TEMPLATE: '📄', CONFIG: '🔧' };
    return icons[type] || '📦';
  };

  const filteredDeployments = (Array.isArray(deployments) ? deployments : []).filter(dep => {
    const s = searchTerm.toLowerCase();
    const matchSearch = dep.configId?.toLowerCase().includes(s) ||
                        dep.deploymentId?.toLowerCase().includes(s) ||
                        dep.targetOrganizationNames?.some(n => n.toLowerCase().includes(s)) ||
                        (dep.initiatedByName || dep.deployedBy)?.toLowerCase().includes(s);
    return (filterStatus === 'ALL' || dep.status === filterStatus) && matchSearch;
  });

  return (
    <div className="space-y-6 pb-10 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="section-label mb-1">Infrastructure</p>
          <h1 className="text-2xl font-black text-[#0F1A3A] tracking-tight">System <span className="text-brand-blue">Deployments</span></h1>
          <p className="text-sm text-[#8A97B0] mt-0.5">Manage configuration rollouts across organizations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => dispatch(fetchDeployments())} disabled={loading} className="btn-ghost border border-[#DDE3F0] px-3 py-2.5 rounded-xl">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl border border-green-100 font-bold text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 border-b border-[#F0F4FC] bg-[#F8FAFF]">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A0AECB]" />
            <input type="text" placeholder="Search deployments..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="input pl-10 py-2.5 text-sm bg-white" />
          </div>
          <div className="flex items-center gap-3 sm:ml-auto">
             <Filter size={16} className="text-[#A0AECB]" />
             <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input py-2.5 text-sm bg-white w-40">
               <option value="ALL">All Status</option>
               <option value="PENDING">Pending</option>
               <option value="IN_PROGRESS">In Progress</option>
               <option value="SUCCESS">Success</option>
               <option value="FAILED">Failed</option>
             </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Resource Type</th>
                <th>Manifest ID</th>
                <th>Status</th>
                <th>Targets</th>
                <th>Initiated By</th>
                <th>Time</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan="7" className="py-3 px-5"><div className="h-10 bg-[#F0F4FC] rounded-xl animate-pulse" /></td></tr>
                ))
              ) : filteredDeployments.length === 0 ? (
                <tr><td colSpan="7" className="py-16 text-center">
                  <Rocket size={36} className="text-[#DDE3F0] mx-auto mb-3" />
                  <p className="text-sm text-[#A0AECB] font-medium">No deployments found</p>
                </td></tr>
              ) : filteredDeployments.map(dep => (
                <tr key={dep.deploymentId || dep.id}>
                  <td>
                    <div className="flex items-center gap-2">
                       <span>{getConfigTypeIcon(dep.configType)}</span>
                       <span className="font-bold text-[#4B5A7A] text-xs uppercase">{dep.configType}</span>
                    </div>
                  </td>
                  <td><span className="font-mono text-xs text-[#8A97B0]">{dep.configId?.substring(0,8)}</span></td>
                  <td><span className={getStatusBadge(dep.status)}>{dep.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                       <span className="font-black text-[#0F1A3A]">{(dep.targetOrganizationNames || []).length}</span>
                       <span className="text-xs text-[#A0AECB] uppercase font-bold tracking-wider">Nodes</span>
                    </div>
                  </td>
                  <td>
                    <div>
                       <p className="font-bold text-[#0F1A3A]">{dep.initiatedByName || dep.deployedBy || 'System'}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                       <p className="text-sm font-bold text-[#4B5A7A]">{formatDate(getDeploymentDate(dep))}</p>
                       <p className="text-xs text-[#8A97B0]">{formatTime(getDeploymentDate(dep))}</p>
                    </div>
                  </td>
                  <td className="text-right">
                    <button onClick={() => { setSelectedDeploy(dep); setIsDetailOpen(true); }} className="p-2 rounded-lg bg-[#F8FAFF] text-[#4B5A7A] hover:bg-brand-blue hover:text-white transition-all border border-[#DDE3F0] hover:border-transparent">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDetailOpen && selectedDeploy && (
        <div className="fixed inset-0 bg-[#0F1A3A]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-[#DDE3F0] flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-[#F0F4FC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EEF2FF] rounded-xl flex items-center justify-center text-brand-blue">
                   <Rocket size={20} />
                </div>
                <div>
                   <h2 className="font-black text-[#0F1A3A] text-lg">Deployment Details</h2>
                   <p className="text-xs text-[#8A97B0] font-mono">ID: {selectedDeploy.deploymentId || selectedDeploy.id}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="p-2 rounded-xl text-[#8A97B0] hover:bg-[#F0F4FC] hover:text-brand-red transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Type', value: selectedDeploy.configType },
                  { label: 'Version', value: `v${selectedDeploy.configVersion || 1}.0` },
                  { label: 'Status', value: selectedDeploy.status, badge: true },
                  { label: 'Targets', value: `${(selectedDeploy.targetOrganizationNames || []).length} Organizations` }
                ].map((item, i) => (
                  <div key={i} className="bg-[#F8FAFF] p-4 rounded-xl border border-[#DDE3F0]">
                     <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider mb-1">{item.label}</p>
                     {item.badge ? <span className={getStatusBadge(item.value)}>{item.value}</span> : <p className="font-bold text-[#0F1A3A]">{item.value}</p>}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <h3 className="text-sm font-black text-[#4B5A7A] uppercase tracking-wider mb-3">Timeline</h3>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center bg-white border border-[#DDE3F0] p-4 rounded-xl shadow-sm">
                          <div>
                             <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Initiated</p>
                             <p className="font-bold text-[#0F1A3A]">{selectedDeploy.initiatedByName || 'System'}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-bold text-[#4B5A7A]">{formatDate(getDeploymentDate(selectedDeploy))}</p>
                             <p className="text-xs text-[#8A97B0]">{formatTime(getDeploymentDate(selectedDeploy))}</p>
                          </div>
                       </div>
                       {selectedDeploy.approvedBy && (
                         <div className="flex justify-between items-center bg-white border border-[#DDE3F0] p-4 rounded-xl shadow-sm">
                            <div>
                               <p className="text-xs font-bold text-[#A0AECB] uppercase tracking-wider">Approved</p>
                               <p className="font-bold text-[#0F1A3A]">{selectedDeploy.approvedByName}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-sm font-bold text-[#4B5A7A]">{formatDate(selectedDeploy.approvedAt)}</p>
                               <p className="text-xs text-[#8A97B0]">{formatTime(selectedDeploy.approvedAt)}</p>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-[#4B5A7A] uppercase tracking-wider mb-3">Target Nodes</h3>
                    <div className="bg-white border border-[#DDE3F0] rounded-xl shadow-sm p-4 max-h-48 overflow-y-auto">
                       {(selectedDeploy.targetOrganizationNames || []).length > 0 ? (
                          <div className="space-y-2">
                             {selectedDeploy.targetOrganizationNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm font-bold text-[#4B5A7A]">
                                   <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                                   {name}
                                </div>
                             ))}
                          </div>
                       ) : <p className="text-sm text-[#A0AECB] italic">No targets specified.</p>}
                    </div>
                 </div>
              </div>

              {selectedDeploy.status === 'FAILED' && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                   <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">Error Message</p>
                   <p className="text-sm font-mono text-red-800">{selectedDeploy.errorMessage || selectedDeploy.failureReason || 'Unknown error'}</p>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-[#F0F4FC] flex justify-end">
               <button onClick={() => setIsDetailOpen(false)} className="btn-primary px-6 py-2.5 text-sm">Close Details</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Deployments;
