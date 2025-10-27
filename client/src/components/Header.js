import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import NotificationDropdown from './NotificationDropdown';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Übersicht', icon: '📊', permission: 'schedule:read' },
  { to: '/messages', label: 'Nachrichten', icon: '💬', permission: 'message:read' },
  { to: '/task-pool', label: 'Aufgaben', icon: '✓', permission: 'task:read' },
  { to: '/waste', label: 'Abfall', icon: '♻️', permission: 'waste:read' },
  { to: '/schedule', label: 'Stunden', icon: '⏰', permission: 'schedule:read' },
  { to: '/users', label: 'Benutzer', icon: '👥', permission: 'user:read' },
  { to: '/admin', label: 'Admin', icon: '⚙️', permission: 'admin:access' }
];

const Header = ({ socket }) => {
  const { state, logout } = useAuth();
  const { user } = state;
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleTranslations = {
    superadmin: 'Superadmin',
    admin: 'Administrator',
    employee: 'Mitarbeiter'
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const visibleNavItems = NAV_ITEMS.filter(item => hasPermission(item.permission));

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">

          {/* Logo & Brand */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">BL</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-gray-900 leading-tight">Biolab</h1>
              <p className="text-xs text-gray-500">Logistik Planner</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Side - Notifications & User */}
          <div className="flex items-center space-x-3">
            {/* Notifications */}
            <NotificationDropdown socket={socket} />

            {/* User Menu */}
            <div className="hidden sm:flex items-center space-x-3 pl-3 border-l border-gray-200">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{roleTranslations[user.role] || user.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                title="Abmelden"
              >
                🚪
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {/* User Info */}
            <div className="sm:hidden pb-3 mb-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>

            {/* Navigation Items */}
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'}
                  `}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}

            {/* Logout Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center px-4 py-3 mt-2 text-red-600 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <span className="mr-3 text-lg">🚪</span>
              Abmelden
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
