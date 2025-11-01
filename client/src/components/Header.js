import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { useLocale } from '../context/LocaleContext';
import NotificationDropdown from './NotificationDropdown';

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'navigation.dashboard', icon: '📊', permission: 'schedule:read' },
  { to: '/messages', labelKey: 'navigation.messages', icon: '💬', permission: 'message:read' },
  { to: '/task-pool', labelKey: 'navigation.tasks', icon: '✓', permission: 'task:read' },
  { to: '/waste', labelKey: 'navigation.waste', icon: '♻️', permission: 'waste:read' },
  { to: '/schedule', labelKey: 'navigation.schedule', icon: '⏰', permission: 'schedule:read' },
  { to: '/knowledge-base', labelKey: 'navigation.knowledge', icon: '📚', permission: 'schedule:read' },
  { to: '/users', labelKey: 'navigation.users', icon: '👥', permission: 'user:read' },
  { to: '/admin', labelKey: 'navigation.admin', icon: '⚙️', permission: 'system:settings' }
];

const Header = ({ socket }) => {
  const authContext = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLocale();

  // Безпечна перевірка контексту
  if (!authContext || !authContext.state) {
    return null;
  }

  const { state, logout } = authContext;
  const { user } = state || {};

  const getRoleLabel = (role) => t(`roles.${role}`) || role;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const visibleNavItems = NAV_ITEMS.filter(item => hasPermission(item.permission));

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-md">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">

          {/* Logo & Brand */}
          <Link to="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-base">BL</span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-base font-bold text-gray-900 leading-tight">Biolab</h1>
              <p className="text-xs text-gray-500 leading-tight">Logistik Planner</p>
            </div>
          </Link>

          {/* Desktop Navigation - Dropdown Style */}
          <nav className="hidden lg:flex items-center flex-1 justify-center max-w-4xl mx-4">
            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`
                      px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all whitespace-nowrap
                      ${isActive
                        ? 'bg-white text-blue-700 shadow-md'
                        : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'}
                    `}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    <span className="hidden xl:inline">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right Side - Notifications & User */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Notifications */}
            <NotificationDropdown socket={socket} />

            {/* User Menu - Desktop */}
            <div className="hidden md:flex items-center gap-3 pl-3 border-l border-gray-300">
              <div className="text-right max-w-[120px]">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{getRoleLabel(user.role)}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 hover:shadow-md transition-all"
                title={t('navigation.logout')}
              >
                🚪
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={t('mobile.nav.toggle')}
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-gradient-to-b from-white to-gray-50 border-t border-gray-200 shadow-2xl">
          <div className="px-4 py-4 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {/* User Info Card */}
            <div className="md:hidden bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-4 mb-4 shadow-lg">
              <p className="text-base font-bold">{user.name}</p>
              <p className="text-sm text-blue-100">{getRoleLabel(user.role)}</p>
            </div>

            {/* Navigation Items */}
            <div className="space-y-1">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center px-4 py-3.5 rounded-xl text-sm font-semibold transition-all
                      ${isActive
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-white hover:shadow-md'}
                    `}
                  >
                    <span className="mr-3 text-xl">{item.icon}</span>
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center px-4 py-3.5 mt-4 text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-xl text-sm font-semibold hover:shadow-lg transition-all"
            >
              <span className="mr-3 text-xl">🚪</span>
              <span>{t('navigation.logout')}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
