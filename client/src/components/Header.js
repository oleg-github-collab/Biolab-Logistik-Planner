import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { useLocale } from '../context/LocaleContext';
import NotificationDropdown from './NotificationDropdown';
import { getAssetUrl } from '../utils/media';

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
  const profilePhotoUrl = user?.profile_photo ? getAssetUrl(user.profile_photo) : null;

  const getRoleLabel = (role) => t(`roles.${role}`) || role;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const visibleNavItems = NAV_ITEMS.filter(item => hasPermission(item.permission));

  return (
    <header className="top-nav-mobile bg-white/95 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center" style={{ minHeight: '60px' }}>

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
          <nav className="hidden lg:flex items-center flex-1 justify-center max-w-5xl mx-6">
            <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl p-1.5 shadow-inner backdrop-blur">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`
                      px-3.5 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all whitespace-nowrap tracking-wide
                      ${isActive
                        ? 'bg-white text-blue-700 shadow-lg ring-1 ring-blue-100'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900'}
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
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200">
              <Link
                to="/profile/me"
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
                title="Profil anzeigen"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shadow-lg ring-2 ring-white bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  {profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-right max-w-[120px]">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">{getRoleLabel(user.role)}</p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 hover:shadow-md transition-all"
                title={t('navigation.logout')}
              >
                🚪
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden btn-icon-mobile bg-slate-100 hover:bg-slate-200 shadow-inner mobile-touch-feedback"
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
            className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 right-0 w-80 max-w-[88vw] bg-gradient-to-br from-white/95 via-white to-slate-100/95 backdrop-blur-2xl text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.25)] z-50 animate-slideInRight safe-top safe-bottom rounded-l-3xl border-l border-slate-200/60">
            <div className="h-full flex flex-col">
              <div className="h-1.5 w-12 bg-slate-300 rounded-full mx-auto mt-4 mb-2" />
              {/* Menu Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200/60">
                <h3 className="text-lg font-bold text-slate-900">Menü</h3>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-icon-mobile bg-slate-100 hover:bg-slate-200 mobile-touch-feedback"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info Card */}
              <div className="md:hidden m-4 p-4 rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white/20 flex items-center justify-center ring-2 ring-white/30">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold">{user.name}</p>
                    <p className="text-sm text-blue-100/80">{getRoleLabel(user.role)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to="/profile/me"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/15 text-white text-center hover:bg-white/25 transition"
                  >
                    Profil öffnen
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-red-500/25 text-red-50 hover:bg-red-500/35 transition"
                  >
                    Abmelden
                  </button>
                </div>
              </div>

              {/* Navigation Items - List Style */}
              <div className="flex-1 overflow-y-auto mobile-scroll-container px-3 pb-6">
                <div className="space-y-2">
                  {visibleNavItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl mobile-touch-feedback border transition-all ${
                          isActive
                            ? 'bg-blue-100/70 border-blue-200 text-blue-700 shadow-inner'
                            : 'bg-white/70 border-slate-200/80 text-slate-900 hover:bg-white'
                        }`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold">{t(item.labelKey)}</p>
                          <p className="text-[11px] text-slate-400">
                            {isActive ? 'Aktive Ansicht' : 'Tippen zum Öffnen'}
                          </p>
                        </div>
                        {isActive && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-3">
                  <h4 className="text-xs uppercase text-slate-400 font-semibold tracking-wider px-1">
                    Schnellzugriffe
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { to: '/kisten', label: 'Kisten', emoji: '📦', className: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/20' },
                      { to: '/task-pool', label: 'Aufgabe', emoji: '➕', className: 'bg-slate-100 text-slate-800 border border-slate-200' },
                      { to: '/schedule', label: 'Planung', emoji: '⏱', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
                      { to: '/knowledge-base', label: 'Wissen', emoji: '📚', className: 'bg-amber-100 text-amber-700 border border-amber-200' }
                    ].map((entry) => (
                      <Link
                        key={entry.to}
                        to={entry.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold mobile-touch-feedback ${entry.className}`}
                      >
                        <span>{entry.emoji}</span>
                        <span>{entry.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 pb-5 pt-4 border-t border-slate-200/70 bg-white/70">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/users');
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition mobile-touch-feedback"
                >
                  <span>Team & Admin</span>
                  <span aria-hidden>→</span>
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
