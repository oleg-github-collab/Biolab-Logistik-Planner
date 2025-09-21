import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Planung',
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
    ),
    roles: ['admin']
  }
];

const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const availableNavItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 text-sm font-semibold uppercase text-white shadow-inner">
              BL
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Biolab Logistik</p>
              <p className="text-base font-semibold text-slate-900">Planner Suite</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {availableNavItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.icon(active)}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Angemeldet</span>
              <span className="text-sm font-medium text-slate-800">
                {user.name}
                <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                  {user.role === 'admin' ? 'Admin' : 'Team'}
                </span>
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full border border-red-500/40 bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-400"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-4 left-1/2 z-40 flex w-[92%] -translate-x-1/2 items-center justify-around rounded-[28px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-xl backdrop-blur">
        {availableNavItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 rounded-full px-3 py-1 transition ${
                active ? 'bg-blue-100/80' : ''
              }`}
            >
              {item.icon(active)}
              <span
                className={`text-[11px] font-medium ${
                  active ? 'text-blue-600' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Header;
