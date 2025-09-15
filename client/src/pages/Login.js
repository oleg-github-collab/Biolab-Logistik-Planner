import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, checkFirstSetup } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstSetup, setIsFirstSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  // Check if this is the first setup
  useEffect(() => {
    const verifyFirstSetup = async () => {
      try {
        const response = await checkFirstSetup();
        setIsFirstSetup(response.data.isFirstSetup);
      } catch (err) {
        console.error('Error checking first setup:', err);
        setError('Could not connect to server. Please try again later.');
      } finally {
        setCheckingSetup(false);
      }
    };

    verifyFirstSetup();
  }, []);

  // Redirect if first setup
  useEffect(() => {
    if (!checkingSetup && isFirstSetup) {
      navigate('/first-setup');
    }
  }, [checkingSetup, isFirstSetup, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(formData.email, formData.password);
      const { token, user } = response.data;
      
      authLogin(token, user);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      setError('Ungültige Anmeldeinformationen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">System wird initialisiert...</p>
        </div>
      </div>
    );
  }

  if (isFirstSetup) {
    return null; // Will be redirected to first-setup
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-90 backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-md border border-white border-opacity-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-biolab-dark mb-2">Biolab Logistik Planner</h1>
          <p className="text-gray-600">Melde dich an, um fortzufahren</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
              placeholder="dein@email.de"
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Passwort
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-biolab-blue hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-biolab-blue"
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden'}
            </button>
          </div>
        </form>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Brauchst du Hilfe?</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Kontaktiere deinen Systemadministrator</li>
            <li>• Überprüfe deine Anmeldeinformationen</li>
            <li>• Stelle sicher, dass du das richtige System verwendest</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;