import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { useLocale } from '../context/LocaleContext';
import NotificationDropdown from './NotificationDropdown';
import { getAssetUrl } from '../utils/media';
import { Search } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', labelKey: 'navigation.dashboard', icon: '📊', permission: 'schedule:read' },
  { to: '/messages', labelKey: 'navigation.messages', icon: '💬', permission: 'message:read' },
  { to: '/kanban', labelKey: 'navigation.tasks', icon: '✓', permission: 'task:read' },
  { to: '/kisten', labelKey: 'navigation.kisten', icon: '📦', permission: 'task:read' },
  { to: '/schedule', labelKey: 'navigation.schedule', icon: '⏰', permission: 'schedule:read' },
  { to: '/knowledge-base', labelKey: 'navigation.knowledge', icon: '📚', permission: 'schedule:read' },
  { to: '/users', labelKey: 'navigation.users', icon: '👥', permission: 'user:read' },
  { to: '/admin', labelKey: 'navigation.admin', icon: '⚙️', permission: 'system:settings' }
];

const MOBILE_HIGHLIGHTS = [
  { to: '/knowledge-base', label: 'Knowledge Base', emoji: '📚', description: 'Artikel & Medien', permission: 'schedule:read' },
  { to: '/schedule', label: 'Planung', emoji: '🗓', description: 'Arbeitszeiten & Stunden', permission: 'schedule:read' },
  { to: '/messages', label: 'Messenger', emoji: '💬', description: 'Direkte Chats', permission: 'message:read' },
  { to: '/kanban', label: 'Kanban', emoji: '🧩', description: 'Aufgaben & Projekte', permission: 'task:read' }
];

const PRIMARY_NAV_LIMIT = 4;

const Header = () => {
  const authContext = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [desktopOverflowOpen, setDesktopOverflowOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const searchInputRef = useRef(null);
  const overflowMenuRef = useRef(null);
  const overflowTriggerRef = useRef(null);
  const { t } = useLocale();

  const state = authContext?.state;
  const logout = authContext?.logout || (() => {});
  const { user } = state || {};
  const profilePhotoUrl = user?.profile_photo ? getAssetUrl(user.profile_photo) : null;
  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const getRoleLabel = (role) => t(`roles.${role}`) || role;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGlobalSearch = (event) => {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    navigate(`/knowledge-base?q=${encodeURIComponent(query)}`);
    setMobileMenuOpen(false);
    setDesktopOverflowOpen(false);
    setGlobalSearch('');
  };

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  const mobileHighlightItems = useMemo(
    () => MOBILE_HIGHLIGHTS.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  const { primaryNavItems, overflowNavItems } = useMemo(() => {
    return {
      primaryNavItems: visibleNavItems.slice(0, PRIMARY_NAV_LIMIT),
      overflowNavItems: visibleNavItems.slice(PRIMARY_NAV_LIMIT)
    };
  }, [visibleNavItems]);

  const searchPlaceholder = (() => {
    const raw = t('mobile.search.placeholder');
    return raw && raw !== 'mobile.search.placeholder' ? raw : 'Suche...';
  })();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setDesktopOverflowOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!desktopOverflowOpen) return undefined;

    const handleClickAway = (event) => {
      const menuEl = overflowMenuRef.current;
      const triggerEl = overflowTriggerRef.current;
      if (
        menuEl &&
        triggerEl &&
        !menuEl.contains(event.target) &&
        !triggerEl.contains(event.target)
      ) {
        setDesktopOverflowOpen(false);
      }
    };

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setDesktopOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('keydown', handleKey);
    };
  }, [desktopOverflowOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  if (!state || !user) return null;

  return (
    <header className="top-nav-mobile bg-white/95 backdrop-blur border-b border-slate-100 sticky top-0 z-50 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center py-3 min-h-[56px]">

          {/* Logo & Brand */}
          <Link to="/dashboard" className="flex items-center gap-3 flex-shrink-0 mobile-touch-feedback">
            <div className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-slate-700 tracking-tight">BL</span>
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-base font-semibold text-slate-900">Biolab</span>
              <span className="text-xs text-slate-500 uppercase tracking-[0.12em]">Planner</span>
            </div>
          </Link>

          {/* Desktop Navigation - Dropdown Style */}
          <nav className="hidden lg:flex items-center flex-1 justify-center max-w-4xl mx-4">
            <div className="flex items-center gap-1 bg-white/70 border border-slate-100 rounded-2xl p-1 shadow-sm">
              {primaryNavItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`
                      px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all whitespace-nowrap tracking-wide
                      ${isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                    `}
                  >
                    <span className="mr-1.5">{item.icon}</span>
                    <span className="hidden xl:inline">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
              {overflowNavItems.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setDesktopOverflowOpen((prev) => !prev)}
                    ref={overflowTriggerRef}
                    type="button"
                    className="px-3 py-2 rounded-xl text-xs xl:text-sm font-semibold transition-all text-slate-600 hover:bg-white hover:text-slate-900 flex items-center gap-1"
                    aria-haspopup="true"
                    aria-expanded={desktopOverflowOpen}
                  >
                    <span>Mehr</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {desktopOverflowOpen && (
                    <div
                      ref={overflowMenuRef}
                      className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50"
                      role="menu"
                    >
                      <div className="py-2">
                        {overflowNavItems.map((item) => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setDesktopOverflowOpen(false)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 ${
                              location.pathname === item.to ? 'text-blue-600 font-semibold' : ''
                            }`}
                          >
                            <span>{item.icon}</span>
                            {t(item.labelKey)}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Right Side - Notifications & User */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Global Search */}
            <form onSubmit={handleGlobalSearch} className="hidden lg:block">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Globale Suche (⌘K)"
                  className="pl-9 pr-3 py-2 bg-slate-100/70 border border-transparent rounded-xl text-sm text-slate-700 focus:bg-white focus:border-blue-400 focus:outline-none transition"
                  autoComplete="off"
                  aria-label="Globale Suche"
                />
              </div>
            </form>

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
              type="button"
              className="btn-icon-mobile bg-slate-100 hover:bg-slate-200 shadow-inner mobile-touch-feedback"
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

      {/* Compact mobile spacer */}
      {!mobileMenuOpen && <div className="lg:hidden border-b border-slate-100" />}

      {/* Enhanced Mobile Menu - Native-like Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 right-0 w-72 max-w-[90vw] bg-white text-slate-900 shadow-2xl z-[9999] animate-slideInRight safe-top safe-bottom border-l border-slate-200">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-800">Menü</h3>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  type="button"
                  className="p-2 rounded-full hover:bg-slate-100 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Info Card */}
              <div className="md:hidden m-4 mb-0 p-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center ring-2 ring-white shadow">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-slate-800">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{getRoleLabel(user.role)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to="/profile/me"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-white text-slate-800 text-center border border-slate-200 hover:bg-slate-100 transition"
                  >
                    Profil öffnen
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition"
                  >
                    Abmelden
                  </button>
                </div>
              </div>

              {/* Navigation Items - List Style */}
              <div className="flex-1 overflow-y-auto mobile-scroll-container">
                <div className="px-4 py-4 space-y-4">
                <form onSubmit={handleGlobalSearch}>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      placeholder={searchPlaceholder}
                      autoComplete="off"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition bg-white"
                    />
                  </div>
                </form>

                {mobileHighlightItems.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Schnellzugriffe</p>
                    <div className="grid grid-cols-2 gap-2">
                      {mobileHighlightItems.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm"
                        >
                          <span className="text-xl">{item.emoji}</span>
                          <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                          <span className="text-[11px] text-slate-500">{item.description}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {visibleNavItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
                          isActive
                            ? 'border-slate-900 text-slate-900 bg-slate-100'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-xl">{item.icon}</span>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold">{t(item.labelKey)}</p>
                          <p className="text-[11px] text-slate-400">
                            {isActive ? 'Aktive Ansicht' : 'Tippen zum Öffnen'}
                          </p>
                        </div>
                        {isActive && <div className="w-2 h-2 bg-slate-900 rounded-full" />}
                      </Link>
                    );
                  })}
                </div>
                </div>
              </div>

              <div className="px-4 pb-5 pt-4 border-t border-slate-200 bg-white">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/users');
                  }}
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 text-slate-800 font-semibold hover:bg-slate-50 transition"
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
