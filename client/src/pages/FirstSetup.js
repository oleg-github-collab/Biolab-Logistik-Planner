import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, checkFirstSetup } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const FirstSetup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState('checking');
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  // Check if first setup is really required
  useEffect(() => {
    const verifyFirstSetup = async () => {
      try {
        const response = await checkFirstSetup();
        if (!response.data.isFirstSetup) {
          // Redirect to login if first setup is not required
          navigate('/login');
        } else {
          setSetupStatus('ready');
        }
      } catch (err) {
        console.error('Error checking first setup:', err);
        setError('Verbindung zum Server konnte nicht hergestellt werden. Bitte versuchen Sie es später erneut.');
        setSetupStatus('error');
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
    setError('');
    setLoading(true);

    // Validate form
    if (!formData.name.trim()) {
      setError('Name ist erforderlich');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('E-Mail ist erforderlich');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      setLoading(false);
      return;
    }

    try {
      // Register the first admin user
      const response = await register(
        formData.name, 
        formData.email, 
        formData.password
      );

      const payload = response.data?.data || response.data;
      const token = payload?.token;
      const userData = payload?.user;

      if (token && userData) {
        localStorage.setItem('token', token);
        authLogin(token, userData);
      }

      setSuccess(true);

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Registration error:', err);
      if (err.response?.data?.firstSetupRequired) {
        // This means we need to force refresh
        setSetupStatus('ready');
      } else {
        const responseError = err.response?.data?.error;
        const message = typeof responseError === 'string'
          ? responseError
          : responseError?.message;
        setError(message || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (setupStatus === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Überprüfe Systemstatus...</p>
        </div>
      </div>
    );
  }

  if (setupStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-90 backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-md border border-white border-opacity-20 text-center">
          <div className="mb-4 p-3 bg-red-100 rounded-full inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fehler</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-biolab-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-90 backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-md border border-white border-opacity-20">
        <div className="text-center mb-8">
          <div className="mb-4 p-3 bg-blue-100 rounded-full inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-biolab-dark mb-2">Biolab Logistik Planner</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Ersteinrichtung</h2>
          <p className="text-gray-600">
            Erstelle deinen Admin-Account, um das System zu konfigurieren
          </p>
        </div>
        
        {success ? (
          <div className="text-center py-8">
            <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Erfolgreich eingerichtet!</h3>
            <p className="text-gray-600 mb-4">Du wirst automatisch weitergeleitet...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-biolab-blue mx-auto"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                placeholder="Dein Name"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-Mail-Adresse *
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
                Passwort *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                placeholder="Mindestens 6 Zeichen"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Passwort bestätigen *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
                placeholder="Passwort wiederholen"
              />
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-biolab-blue hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-biolab-blue"
              >
                {loading ? 'Erstelle Admin-Account...' : 'Admin-Account erstellen'}
              </button>
            </div>
          </form>
        )}
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Hinweis</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Dieser Account erhält automatisch Admin-Rechte</li>
              <li>• Du kannst später weitere Benutzer hinzufügen</li>
              <li>• Das Passwort muss mindestens 6 Zeichen lang sein</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstSetup;
