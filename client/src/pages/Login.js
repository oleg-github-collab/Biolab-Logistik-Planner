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
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  // Check if first setup is required
  useEffect(() => {
    const verifyFirstSetup = async () => {
      try {
        const response = await checkFirstSetup();
        const payload = response?.data?.data ?? response?.data ?? {};

        setCheckingSetup(false);

        if (payload.isFirstSetup) {
          navigate('/first-setup');
        }
      } catch (err) {
        console.error('Error checking first setup:', err);
        setError('Could not connect to server. Please try again later.');
        setCheckingSetup(false);
      }
    };

    verifyFirstSetup();
  }, [navigate]);

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
      const payload = response?.data?.data ?? response?.data ?? {};
      const { token, user } = payload;

      if (token && user) {
        authLogin(token, user);
        navigate('/dashboard');
      } else {
        setError('Login erfolgreich, aber keine gültigen Anmeldedaten erhalten. Bitte versuche es erneut.');
      }
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);

      const firstSetupRequired = err.response?.data?.firstSetupRequired
        ?? err.response?.data?.error?.details?.firstSetupRequired;

      if (firstSetupRequired) {
        // Redirect to first setup if required
        navigate('/first-setup');
      } else {
        const apiError = err.response?.data?.error?.message
          ?? err.response?.data?.error
          ?? err.message
          ?? 'Ungültige Anmeldeinformationen. Bitte versuche es erneut.';

        setError(typeof apiError === 'string' ? apiError : 'Ungültige Anmeldeinformationen. Bitte versuche es erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">System wird überprüft...</p>
        </div>
      </div>
    );
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
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Brauchst du Hilfe?</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Wenn du noch keinen Account hast, kontaktiere deinen Administrator</li>
              <li>• Wenn du der erste Benutzer bist, warte auf die Ersteinrichtung</li>
              <li>• Bei technischen Problemen: Seite neu laden</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;