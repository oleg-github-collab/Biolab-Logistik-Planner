import React, { useState, useEffect } from 'react';
import { X, Save, Bell, Moon, Users, Volume2, Smartphone, TrendingUp, Star } from 'lucide-react';
import { getNotificationPreferences, updateNotificationPreferences } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const NotificationPreferencesModal = ({ onClose }) => {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await getNotificationPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      showError('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(preferences);
      showSuccess('Einstellungen gespeichert');
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      showError('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const updatePref = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const toggleDay = (day) => {
    const days = preferences.dnd_days || [];
    if (days.includes(day)) {
      updatePref('dnd_days', days.filter(d => d !== day));
    } else {
      updatePref('dnd_days', [...days, day].sort());
    }
  };

  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6" />
              <div>
                <h3 className="text-xl font-bold">Benachrichtigungseinstellungen</h3>
                <p className="text-sm text-blue-100">Personalisiere deine Benachrichtigungen</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Do Not Disturb */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Moon className="w-5 h-5 text-purple-600" />
              <h4 className="font-bold text-slate-900">Nicht stören (DND)</h4>
            </div>

            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                checked={preferences?.dnd_enabled || false}
                onChange={(e) => updatePref('dnd_enabled', e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Nicht stören aktivieren</span>
            </label>

            {preferences?.dnd_enabled && (
              <div className="space-y-4 pl-8">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Von</label>
                    <input
                      type="time"
                      value={preferences?.dnd_start_time || '22:00:00'}
                      onChange={(e) => updatePref('dnd_start_time', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Bis</label>
                    <input
                      type="time"
                      value={preferences?.dnd_end_time || '08:00:00'}
                      onChange={(e) => updatePref('dnd_end_time', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Tage</label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map(day => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          (preferences?.dnd_days || []).includes(day)
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {dayNames[day]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Auto Grouping */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-green-600" />
              <h4 className="font-bold text-slate-900">Automatische Gruppierung</h4>
            </div>

            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                checked={preferences?.auto_group_enabled || false}
                onChange={(e) => updatePref('auto_group_enabled', e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Ähnliche Benachrichtigungen gruppieren</span>
            </label>

            {preferences?.auto_group_enabled && (
              <div className="pl-8">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gruppierungszeitfenster (Minuten)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={preferences?.group_window_minutes || 30}
                  onChange={(e) => updatePref('group_window_minutes', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Benachrichtigungen innerhalb dieses Zeitraums werden gruppiert
                </p>
              </div>
            )}
          </div>

          {/* AI Priority Weights */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h4 className="font-bold text-slate-900">AI-Prioritätsgewichte</h4>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Passe an, wie AI die Priorität deiner Benachrichtigungen berechnet
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Dringlichkeit</label>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.round((preferences?.priority_weight_urgency || 0.4) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={preferences?.priority_weight_urgency || 0.4}
                  onChange={(e) => updatePref('priority_weight_urgency', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Absender</label>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.round((preferences?.priority_weight_sender || 0.3) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={preferences?.priority_weight_sender || 0.3}
                  onChange={(e) => updatePref('priority_weight_sender', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Inhalt</label>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.round((preferences?.priority_weight_content || 0.3) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={preferences?.priority_weight_content || 0.3}
                  onChange={(e) => updatePref('priority_weight_content', parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Notification Types */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-blue-600" />
              <h4 className="font-bold text-slate-900">Benachrichtigungstypen</h4>
            </div>

            <div className="space-y-3">
              {[
                { key: 'notify_messages', label: 'Nachrichten', icon: '💬' },
                { key: 'notify_tasks', label: 'Aufgaben', icon: '✓' },
                { key: 'notify_events', label: 'Termine', icon: '📅' },
                { key: 'notify_waste', label: 'Entsorgung', icon: '♻️' },
                { key: 'notify_system', label: 'System', icon: '⚙️' }
              ].map(({ key, label, icon }) => (
                <label key={key} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={preferences?.[key] !== false}
                    onChange={(e) => updatePref(key, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    {icon} {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery Settings */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <h4 className="font-bold text-slate-900">Zustellung</h4>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={preferences?.desktop_notifications !== false}
                  onChange={(e) => updatePref('desktop_notifications', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Desktop-Benachrichtigungen</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={preferences?.sound_enabled !== false}
                  onChange={(e) => updatePref('sound_enabled', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  <Volume2 className="w-4 h-4 inline mr-1" />
                  Ton
                </span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={preferences?.vibration_enabled !== false}
                  onChange={(e) => updatePref('vibration_enabled', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Vibration</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPreferencesModal;
