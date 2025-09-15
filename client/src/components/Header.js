import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path ? 'bg-biolab-blue text-white' : 'text-biolab-dark hover:bg-biolab-light';
  };

  if (!user) return null;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-biolab-dark">Biolab Logistik Planner</h1>
          </div>
          
          <nav className="hidden md:flex space-x-4">
            <Link 
              to="/dashboard" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/dashboard')}`}
            >
              Planung
            </Link>
            <Link 
              to="/messages" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/messages')}`}
            >
              Nachrichten
            </Link>
            <Link 
              to="/waste" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/waste')}`}
            >
              Abfallmanagement
            </Link>
            {user.role === 'admin' && (
              <Link 
                to="/users" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/users')}`}
              >
                Benutzer
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:block">
              <span className="text-sm text-gray-600">
                Angemeldet als:{' '}
                <span className="font-medium">
                  {user.name} ({user.role === 'admin' ? 'Admin' : 'Mitarbeiter'})
                </span>
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden bg-white border-t border-gray-200">
        <div className="flex flex-wrap justify-around py-2">
          <Link 
            to="/dashboard" 
            className={`px-2 py-1 text-xs font-medium transition-colors ${isActive('/dashboard')}`}
          >
            Planung
          </Link>
          <Link 
            to="/messages" 
            className={`px-2 py-1 text-xs font-medium transition-colors ${isActive('/messages')}`}
          >
            Nachrichten
          </Link>
          <Link 
            to="/waste" 
            className={`px-2 py-1 text-xs font-medium transition-colors ${isActive('/waste')}`}
          >
            Abfall
          </Link>
          {user.role === 'admin' && (
            <Link 
              to="/users" 
              className={`px-2 py-1 text-xs font-medium transition-colors ${isActive('/users')}`}
            >
              Benutzer
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;