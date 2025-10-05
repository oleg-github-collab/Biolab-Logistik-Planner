import { useAuth } from '../context/AuthContext';

// Mirror of server-side ROLES
export const ROLES = {
  USER: 'user',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin'
};

// Mirror of server-side PERMISSIONS
export const PERMISSIONS = {
  // Schedule permissions
  'schedule:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'schedule:manage': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Message permissions
  'message:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'message:send': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'message:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Waste management permissions
  'waste:read': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'waste:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // Task permissions
  'task:read': [ROLES.USER, ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:create': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:update': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:delete': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'task:assign': [ROLES.ADMIN, ROLES.SUPERADMIN],

  // User management permissions
  'user:read': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:create': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:update': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'user:delete': [ROLES.SUPERADMIN],
  'user:role': [ROLES.SUPERADMIN],

  // Template permissions
  'template:read': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:create': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:update': [ROLES.ADMIN, ROLES.SUPERADMIN],
  'template:delete': [ROLES.SUPERADMIN],

  // System permissions
  'system:settings': [ROLES.SUPERADMIN],
  'system:logs': [ROLES.ADMIN, ROLES.SUPERADMIN],
};

/**
 * Custom hook for permission-based access control
 * @returns {Object} Permission checking utilities
 */
export const usePermissions = () => {
  const { user } = useAuth();

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission string (e.g., 'schedule:create')
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user || !user.role) return false;

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      console.warn(`Unknown permission: ${permission}`);
      return false;
    }

    return allowedRoles.includes(user.role);
  };

  /**
   * Check if user has all specified permissions
   * @param {...string} permissions - Permission strings
   * @returns {boolean}
   */
  const hasAllPermissions = (...permissions) => {
    return permissions.every(permission => hasPermission(permission));
  };

  /**
   * Check if user has any of the specified permissions
   * @param {...string} permissions - Permission strings
   * @returns {boolean}
   */
  const hasAnyPermission = (...permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  /**
   * Check if user has a specific role
   * @param {...string} roles - Role strings
   * @returns {boolean}
   */
  const hasRole = (...roles) => {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  };

  /**
   * Check if user is admin or superadmin
   * @returns {boolean}
   */
  const isAdmin = () => {
    return hasRole(ROLES.ADMIN, ROLES.SUPERADMIN);
  };

  /**
   * Check if user is superadmin
   * @returns {boolean}
   */
  const isSuperAdmin = () => {
    return hasRole(ROLES.SUPERADMIN);
  };

  /**
   * Check if user is employee, admin or superadmin
   * @returns {boolean}
   */
  const isEmployee = () => {
    return hasRole(ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.SUPERADMIN);
  };

  /**
   * Check if user owns a resource
   * @param {number} resourceUserId - ID of the resource owner
   * @returns {boolean}
   */
  const ownsResource = (resourceUserId) => {
    if (!user) return false;
    // Admins can access all resources
    if (isAdmin()) return true;
    // Regular users can only access their own resources
    return user.id === resourceUserId;
  };

  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    hasRole,
    isAdmin,
    isSuperAdmin,
    isEmployee,
    ownsResource,
    userRole: user?.role,
  };
};

/**
 * Component wrapper for permission-based rendering
 * @param {Object} props
 * @param {string|string[]} props.permission - Required permission(s)
 * @param {React.ReactNode} props.children - Content to render if permitted
 * @param {React.ReactNode} props.fallback - Content to render if not permitted
 */
export const PermissionGate = ({ permission, children, fallback = null }) => {
  const { hasPermission, hasAllPermissions } = usePermissions();

  const isAllowed = Array.isArray(permission)
    ? hasAllPermissions(...permission)
    : hasPermission(permission);

  return isAllowed ? children : fallback;
};

/**
 * Component wrapper for role-based rendering
 * @param {Object} props
 * @param {string|string[]} props.role - Required role(s)
 * @param {React.ReactNode} props.children - Content to render if role matches
 * @param {React.ReactNode} props.fallback - Content to render if role doesn't match
 */
export const RoleGate = ({ role, children, fallback = null }) => {
  const { hasRole } = usePermissions();

  const isAllowed = Array.isArray(role)
    ? hasRole(...role)
    : hasRole(role);

  return isAllowed ? children : fallback;
};

export default usePermissions;
