import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../utils/api';

const FirstLoginFlow = ({ onComplete }) => {
  const { state = {}, dispatch } = useContext(AuthContext) || {};
  const { user } = state;

  const [weeklyHours, setWeeklyHours] = useState(
    user?.employment_type === 'Vollzeit' ? 40 : 20
  );

  // Don't render if no user context
  if (!state || !user) {
    return null;
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (weeklyHours < 1 || weeklyHours > 80) {
        setError('Please enter hours between 1 and 80');
        setLoading(false);
        return;
      }

      const response = await api.post('/auth/complete-first-login', {
        weekly_hours_quota: weeklyHours
      });

      // Update user in context
      dispatch({
        type: 'LOAD_USER',
        payload: response.data.user
      });

      if (onComplete) {
        onComplete();
      }

    } catch (err) {
      console.error('Error completing first login:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const presetHours = [
    { label: 'Werkstudent (20h)', value: 20 },
    { label: 'Teilzeit (30h)', value: 30 },
    { label: 'Vollzeit (40h)', value: 40 },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8">
          <h2 className="text-3xl font-bold mb-2">Welcome to Biolab Logistik Planner! 👋</h2>
          <p className="text-blue-100">Let's set up your weekly work schedule</p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">
              Set Your Weekly Hours Quota
            </h3>
            <p className="text-gray-600 mb-6">
              This helps us track your work hours and ensure you don't exceed your planned schedule.
              You can always change this later in your profile settings.
            </p>

            {/* Employment Type Info */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Employment Type:</span> {user?.employment_type || 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Quick Presets:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {presetHours.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setWeeklyHours(preset.value)}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      weeklyHours === preset.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-semibold">{preset.value}h</div>
                    <div className="text-xs text-gray-600">{preset.label.split('(')[0].trim()}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Hours Input */}
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="weeklyHours" className="block text-sm font-medium text-gray-700 mb-2">
                  Or enter custom hours per week:
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="weeklyHours"
                    min="1"
                    max="80"
                    step="0.5"
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(parseFloat(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                    required
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-lg">hours/week</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Allowed range: 1-80 hours per week
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Continue to Dashboard'
                )}
              </button>
            </form>
          </div>

          {/* Help Text */}
          <div className="bg-gray-50 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-gray-800 mb-2">Why do we need this?</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Track your scheduled vs. worked hours</li>
              <li>Prevent over-scheduling and burnout</li>
              <li>Help admins plan team capacity</li>
              <li>Ensure compliance with your employment contract</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginFlow;
