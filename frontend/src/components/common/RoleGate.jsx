import { useSelector } from 'react-redux';
import { selectRole } from '../../store/slices/authSlice';
import { hasMenuAccess } from '../../constants/permissions';

/**
 * Conditionally renders children if the logged-in role has access to `menuItem`.
 * Falls back to `denied` node or null if not authorised.
 *
 * Usage:
 *   <RoleGate menuItem="Organizations">
 *     <OrganizationsPage />
 *   </RoleGate>
 *
 *   <RoleGate roles={['ADMIN','MANAGER']} denied={<AccessDenied />}>
 *     <AdminPanel />
 *   </RoleGate>
 */
const RoleGate = ({ menuItem, roles, children, denied = null }) => {
  const role = useSelector(selectRole);

  const allowed = roles
    ? roles.includes(role)
    : hasMenuAccess(role, menuItem);

  if (!allowed) {
    return denied ? (
      <>{denied}</>
    ) : (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-slate-400 text-sm">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGate;
