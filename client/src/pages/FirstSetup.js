import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, checkFirstSetup } from '../utils/api';

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
  const navigate = useNavigate();

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
      setError('Name is required');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setError('Please enter a valid email');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Register the first admin user
      const response = await register(
        formData.name, 
        formData.email, 
        formData.password, 
        'admin'
      );
      
      if (response.data.token) {
        // Save token and user data to localStorage
        localStorage.setItem('token', response.data.token);
        setSuccess(true);
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-biolab-blue to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white bg-opacity-90 backdrop-blur-lg rounded-2xl shadow-xl p-8 w-full max-w-md border border-white border-opacity-20">
        <div className="text-center mb-8">
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
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Systemversion: 1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default FirstSetup;