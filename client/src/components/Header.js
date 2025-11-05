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
  { to: '/kisten', labelKey: 'navigation.kisten', icon: '📦', permission: 'task:read' },
  { to: '/schedule', labelKey: 'navigation.schedule', icon: '⏰', permission: 'schedule:read' },
  { to: '/knowledge-base', labelKey: 'navigation.knowledge', icon: '📚', permission: 'schedule:read' },
  { to: '/users', labelKey: 'navigation.users', icon: '👥', permission: 'user:read' },
  { to: '/admin', labelKey: 'navigation.admin', icon: '⚙️', permission: 'system:settings' }
];

const Header = () => {
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
    <header className="top-nav-mobile bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center" style={{ minHeight: '56px' }}>

          {/* Logo & Brand */}
          <Link to="/dashboard" className="flex items-center space-x-2 flex-shrink-0 mobile-touch-feedback">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">BL</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-gray-900 leading-tight tracking-tight">Biolab</h1>
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
            <NotificationDropdown />

            {/* User Menu - Desktop */}
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-300">
              <Link
                to="/profile/me"
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all"
                title="Profil anzeigen"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-right max-w-[120px]">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{getRoleLabel(user.role)}</p>
                </div>
              </Link>
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
              className="lg:hidden btn-icon-mobile bg-gray-50 hover:bg-gray-100 mobile-touch-feedback"
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

      {/* Enhanced Mobile Menu - Native-like Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 animate-slideInRight safe-top safe-bottom">
            <div className="h-full flex flex-col">
              {/* Menu Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Menu</h3>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-icon-mobile bg-gray-50 hover:bg-gray-100 mobile-touch-feedback"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info Card */}
              <div className="md:hidden card-elevated m-4 p-4 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold">{user.name}</p>
                    <p className="text-sm text-blue-100">{getRoleLabel(user.role)}</p>
                  </div>
                </div>
              </div>

              {/* Navigation Items - List Style */}
              <div className="flex-1 overflow-y-auto mobile-scroll-container px-2">
                <div className="list-mobile">
                  {visibleNavItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`list-item-mobile mobile-touch-feedback ${
                          isActive ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className={`flex-1 text-base font-medium ${
                          isActive ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {t(item.labelKey)}
                        </span>
                        {isActive && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-4">
                <h4 className="text-xs uppercase text-gray-400 font-semibold tracking-wider">
                  Schnellzugriffe
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Link
                    to="/kisten"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-semibold py-3 mobile-touch-feedback shadow-lg"
                  >
                    📦 Kisten
                  </Link>
                  <Link
                    to="/task-pool"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 text-slate-800 font-semibold py-3 mobile-touch-feedback border border-slate-200"
                  >
                    ➕ Aufgabe
                  </Link>
                </div>
              </div>

              {/* Logout Button */}
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="btn-mobile w-full bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg mobile-touch-feedback flex items-center justify-center gap-2"
                >
                  <span className="text-xl">🚪</span>
                  <span className="font-semibold">{t('navigation.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Header;
