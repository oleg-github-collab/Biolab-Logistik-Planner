import React, { useState, useEffect } from 'react';
import { Camera, Save, X, Bell, Eye, Clock, Globe } from 'lucide-react';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  updateUserPreferences
} from '../utils/apiEnhanced';

const UserProfile = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // profile, preferences, contact
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({});
  const [preferences, setPreferences] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await getUserProfile(userId);
      setProfile(response.data);
      setFormData({
        name: response.data.name || '',
        status: response.data.status || 'available',
        status_message: response.data.status_message || '',
        bio: response.data.bio || '',
        position_description: response.data.position_description || '',
        phone: response.data.phone || '',
        phone_mobile: response.data.phone_mobile || '',
        emergency_contact: response.data.emergency_contact || '',
        emergency_phone: response.data.emergency_phone || '',
        address: response.data.address || '',
        timezone: response.data.timezone || 'Europe/Berlin',
        language: response.data.language || 'de',
        theme: response.data.theme || 'light'
      });
      setPreferences({
        email_notifications: response.data.email_notifications ?? true,
        push_notifications: response.data.push_notifications ?? true,
        desktop_notifications: response.data.desktop_notifications ?? true,
        sound_enabled: response.data.sound_enabled ?? true,
        notify_messages: response.data.notify_messages ?? true,
        notify_tasks: response.data.notify_tasks ?? true,
        notify_mentions: response.data.notify_mentions ?? true,
        notify_reactions: response.data.notify_reactions ?? true,
        notify_calendar: response.data.notify_calendar ?? true,
        compact_view: response.data.compact_view ?? false,
        show_avatars: response.data.show_avatars ?? true,
        message_preview: response.data.message_preview ?? true,
        quiet_hours_enabled: response.data.quiet_hours_enabled ?? false,
        quiet_hours_start: response.data.quiet_hours_start || '22:00',
        quiet_hours_end: response.data.quiet_hours_end || '08:00'
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('photo', photoFile);

      const response = await uploadProfilePhoto(userId, formData);
      setProfile({ ...profile, profile_photo: response.data.photo_url });
      setPhotoFile(null);
      setPhotoPreview(null);
      alert('Foto erfolgreich hochgeladen!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Fehler beim Hochladen des Fotos');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateUserProfile(userId, formData);
      setProfile({ ...profile, ...formData });
      setEditing(false);
      alert('Profil aktualisiert!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Fehler beim Speichern des Profils');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      await updateUserPreferences(userId, preferences);
      alert('Einstellungen gespeichert!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Fehler beim Speichern der Einstellungen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Profil wird geladen...</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    away: 'bg-orange-500',
    offline: 'bg-gray-500'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-screen overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-6">
            {/* Profile Photo */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white overflow-hidden border-4 border-white shadow-lg">
                {photoPreview || profile?.profile_photo ? (
                  <img
                    src={photoPreview || profile.profile_photo}
                    alt={profile?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 bg-gray-200">
                    {profile?.name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              <label className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 rounded-full p-2 cursor-pointer shadow-lg transition">
                <Camera className="w-5 h-5 text-white" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Profile Info */}
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold">{profile?.name}</h2>
              <p className="text-blue-100 mt-1">{profile?.position_description || profile?.role}</p>
              <div className="flex items-center mt-2 space-x-2">
                <div className={`w-3 h-3 rounded-full ${statusColors[profile?.status || 'offline']}`}></div>
                <span className="text-sm">{profile?.status_message || profile?.status}</span>
              </div>
            </div>
          </div>

          {photoFile && (
            <div className="mt-4 flex space-x-2">
              <button
                onClick={handlePhotoUpload}
                disabled={saving}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition text-sm"
              >
                Foto speichern
              </button>
              <button
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {[
              { id: 'profile', label: 'Profil', icon: <Eye className="w-4 h-4" /> },
              { id: 'preferences', label: 'Einstellungen', icon: <Bell className="w-4 h-4" /> },
              { id: 'contact', label: 'Kontakte', icon: <Globe className="w-4 h-4" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 sm:px-6 py-3 border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span className="text-sm sm:text-base">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Profilinformationen</h3>
                <button
                  onClick={() => editing ? handleSaveProfile() : setEditing(true)}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  {editing ? (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Speichern</span>
                    </>
                  ) : (
                    <span>Bearbeiten</span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="available">Verfügbar</option>
                    <option value="busy">Beschäftigt</option>
                    <option value="away">Abwesend</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statusnachricht</label>
                  <input
                    type="text"
                    value={formData.status_message}
                    onChange={(e) => setFormData({ ...formData, status_message: e.target.value })}
                    disabled={!editing}
                    placeholder="Zum Beispiel: In Besprechung bis 14:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Biografie</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    disabled={!editing}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Positionsbeschreibung</label>
                  <textarea
                    value={formData.position_description}
                    onChange={(e) => setFormData({ ...formData, position_description: e.target.value })}
                    disabled={!editing}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobiltelefon</label>
                  <input
                    type="tel"
                    value={formData.phone_mobile}
                    onChange={(e) => setFormData({ ...formData, phone_mobile: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notfallkontakt</label>
                  <input
                    type="text"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notfalltelefon</label>
                  <input
                    type="tel"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zeitzone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="Europe/Berlin">Europe/Berlin</option>
                    <option value="Europe/Kiev">Europe/Kiev</option>
                    <option value="Europe/London">Europe/London</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sprache</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="de">Deutsch</option>
                    <option value="uk">Українська</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <select
                    value={formData.theme}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                    disabled={!editing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="light">Hell</option>
                    <option value="dark">Dunkel</option>
                    <option value="auto">Automatisch</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Benachrichtigungseinstellungen</h3>
                <button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Speichern</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Benachrichtigungstypen</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'email_notifications', label: 'E-Mail-Benachrichtigungen' },
                      { key: 'push_notifications', label: 'Push-Benachrichtigungen' },
                      { key: 'desktop_notifications', label: 'Desktop-Benachrichtigungen' },
                      { key: 'sound_enabled', label: 'Audiobenachrichtigungen' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences[item.key]}
                          onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Benachrichtigen über</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'notify_messages', label: 'Neue Nachrichten' },
                      { key: 'notify_tasks', label: 'Aufgaben' },
                      { key: 'notify_mentions', label: 'Erwähnungen (@)' },
                      { key: 'notify_reactions', label: 'Reaktionen' },
                      { key: 'notify_calendar', label: 'Kalendertermine' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences[item.key]}
                          onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Anzeige</h4>
                  <div className="space-y-2">
                    {[
                      { key: 'compact_view', label: 'Kompakte Ansicht' },
                      { key: 'show_avatars', label: 'Avatare anzeigen' },
                      { key: 'message_preview', label: 'Nachrichtenvorschau' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences[item.key]}
                          onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      checked={preferences.quiet_hours_enabled}
                      onChange={(e) => setPreferences({ ...preferences, quiet_hours_enabled: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <h4 className="font-medium">Ruhezeiten (Nicht stören)</h4>
                  </div>

                  {preferences.quiet_hours_enabled && (
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Beginn</label>
                        <input
                          type="time"
                          value={preferences.quiet_hours_start}
                          onChange={(e) => setPreferences({ ...preferences, quiet_hours_start: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Ende</label>
                        <input
                          type="time"
                          value={preferences.quiet_hours_end}
                          onChange={(e) => setPreferences({ ...preferences, quiet_hours_end: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Kontaktinformationen</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <span className="text-sm text-gray-600">E-Mail:</span>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Telefon:</span>
                  <p className="font-medium">{profile?.phone || 'Nicht angegeben'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Mobiltelefon:</span>
                  <p className="font-medium">{profile?.phone_mobile || 'Nicht angegeben'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Adresse:</span>
                  <p className="font-medium">{profile?.address || 'Nicht angegeben'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
