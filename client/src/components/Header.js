import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import { showSuccess, showError } from '../utils/toast';
import useWebSocket from '../hooks/useWebSocket';
import NotificationCenter from './NotificationCenter';
import io from 'socket.io-client';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Planung',
    permission: 'schedule:read',
    icon: (active) => (
      <svg
        className={active ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-slate-400'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="4" ry="4" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  },
  {
    to: '/messages',
    label: 'Nachrichten',
    permission: 'message:read',
    icon: (active) => (
      <svg
        className={active ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-slate-400'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2v10z" />
      </svg>
    )
  },
  {
    to: '/waste',
    label: 'Abfall',
    permission: 'waste:read',
    icon: (active) => (
      <svg
        className={active ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-slate-400'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M8 6v13a2 2 0 002 2h4a2 2 0 002-2V6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    )
  },
  {
    to: '/users',
    label: 'Benutzer',
    permission: 'user:read',
    icon: (active) => (
      <svg
        className={active ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-slate-400'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    )
  },
  {
    to: '/admin',
    label: 'Admin',
    permission: 'user:read',
    icon: (active) => (
      <svg
        className={active ? 'h-5 w-5 text-blue-600' : 'h-5 w-5 text-slate-400'}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v6M12 17v6M4.22 4.22l4.25 4.25M15.53 15.53l4.25 4.25M1 12h6M17 12h6M4.22 19.78l4.25-4.25M15.53 8.47l4.25-4.25" />
      </svg>
    )
  }
];

// ✅ OPTIMIZED: Memoized NavItem component to prevent unnecessary re-renders
const NavItem = memo(({ item, isActive }) => (
  <Link
    to={item.to}
    className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md scale-105'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 hover:scale-105'
    }`}
  >
    {item.icon(isActive)}
    <span>{item.label}</span>
  </Link>
));

NavItem.displayName = 'NavItem';

// ✅ OPTIMIZED: Memoized MobileNavItem component
const MobileNavItem = memo(({ item, isActive, onClick }) => (
  <Link
    to={item.to}
    onClick={onClick}
    className={`group flex items-center gap-3 rounded-xl px-4 py-3 sm:py-3.5 text-sm sm:text-base font-medium transition-all duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md scale-105'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95'
    }`}
  >
    {item.icon(isActive)}
    <span className="flex-1">{item.label}</span>
    {isActive && (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    )}
  </Link>
));

MobileNavItem.displayName = 'MobileNavItem';

// ✅ OPTIMIZED: Memoized BottomNavItem component
const BottomNavItem = memo(({ item, isActive }) => (
  <Link
    to={item.to}
    className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition-all duration-200 ${
      isActive ? 'bg-blue-100/80 scale-105' : 'active:scale-95'
    }`}
  >
    {item.icon(isActive)}
    <span
      className={`text-[10px] sm:text-[11px] font-medium ${
        isActive ? 'text-blue-600' : 'text-slate-500'
      }`}
    >
      {item.label}
    </span>
  </Link>
));

BottomNavItem.displayName = 'BottomNavItem';

const Header = () => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize WebSocket for notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    const wsUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:5000'
      : window.location.origin;

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected for notifications');
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // ✅ OPTIMIZED: useCallback for path checking and logout - MUST be before early return
  const isActive = useCallback((path) => location.pathname === path || location.pathname.startsWith(`${path}/`), [location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      logout();
      showSuccess('Erfolgreich abgemeldet');
      navigate('/login');
    } catch (error) {
      showError('Fehler beim Abmelden', error);
    }
  }, [logout, navigate]);

  // ✅ OPTIMIZED: useMemo to cache filtered navigation items
  const availableNavItems = useMemo(() => NAV_ITEMS.filter((item) => hasPermission(item.permission)), [hasPermission]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Early return AFTER all hooks
  if (!user) return null;

  return (
    <>
      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Logo Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 text-xs sm:text-sm font-semibold uppercase text-white shadow-inner">
              BL
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Biolab Logistik</p>
              <p className="text-sm sm:text-base font-semibold text-slate-900">Planner Suite</p>
            </div>
          </div>

          {/* Desktop Navigation - Hidden on mobile and tablet */}
          <nav className="hidden lg:flex items-center gap-1">
            {availableNavItems.map((item) => (
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} />
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification Center */}
            <NotificationCenter socket={socket} userId={user?.id} />

            {/* User Info - Hidden on small screens */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Angemeldet</span>
              <span className="text-sm font-medium text-slate-800">
                {user.name}
                <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Admin' : 'Team'}
                </span>
              </span>
            </div>

            {/* Logout Button - Responsive sizing */}
            <button
              onClick={handleLogout}
              className="rounded-full border border-red-500/40 bg-red-500 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-400 hover:scale-105 active:scale-95"
            >
              <span className="hidden sm:inline">Abmelden</span>
              <span className="sm:hidden">
                {/* Logout icon for mobile */}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
            </button>

            {/* Hamburger Menu Button - Only on tablet and below */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 hover:bg-slate-200 transition-all duration-200 active:scale-95"
              aria-label="Toggle menu"
            >
              <div className="flex flex-col gap-1.5 w-5">
                <span
                  className={`h-0.5 w-full bg-slate-700 rounded-full transition-all duration-300 ${
                    isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                  }`}
                />
                <span
                  className={`h-0.5 w-full bg-slate-700 rounded-full transition-all duration-300 ${
                    isMobileMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`h-0.5 w-full bg-slate-700 rounded-full transition-all duration-300 ${
                    isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet Drawer Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile/Tablet Drawer Menu */}
      <div
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-[280px] sm:w-[320px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 text-sm font-semibold uppercase text-white shadow-inner">
              BL
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Biolab Logistik</p>
              <p className="text-sm font-semibold text-slate-900">Planner Suite</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* User Info Section */}
        <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Angemeldet als</p>
          <p className="text-base sm:text-lg font-semibold text-slate-900 mb-2">{user.name}</p>
          <span className="inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            {user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Admin' : 'Team'}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col p-4 sm:p-6 gap-2">
          {availableNavItems.map((item) => (
            <MobileNavItem
              key={item.to}
              item={item}
              isActive={isActive(item.to)}
              onClick={() => setIsMobileMenuOpen(false)}
            />
          ))}
        </nav>

        {/* Drawer Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 border-t border-slate-200">
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm sm:text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-red-400 active:scale-95"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Abmelden</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation - Only for very small screens */}
      <nav className="md:hidden fixed bottom-4 left-1/2 z-40 flex w-[92%] max-w-md -translate-x-1/2 items-center justify-around rounded-[28px] border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-xl backdrop-blur">
        {availableNavItems.slice(0, 4).map((item) => (
          <BottomNavItem key={item.to} item={item} isActive={isActive(item.to)} />
        ))}
      </nav>
    </>
  );
};

export default Header;
