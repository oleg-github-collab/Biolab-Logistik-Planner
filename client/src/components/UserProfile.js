import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Camera, Save, X, Bell, Eye, Globe, Shield, Key, LogOut, Image as ImageIcon, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfilePhoto,
  updateUserPreferences,
  getUserStories,
  uploadProfileStory,
  markStoryViewed
} from '../utils/apiEnhanced';
import { getAssetUrl } from '../utils/media';
import { useMobile } from '../hooks/useMobile';
import '../styles/user-profile-mobile.css';

const UserProfile = ({ userId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile'); // profile, preferences, contact, security
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({});
  const [preferences, setPreferences] = useState({});
  const [saving, setSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storyModal, setStoryModal] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);

  const { user: currentUser } = useAuth();
  const isOwnProfile = useMemo(() => currentUser?.id === parseInt(userId, 10), [currentUser, userId]);
  const storyInputRef = useRef(null);
  const { isMobile } = useMobile();

  const loadProfile = useCallback(async () => {
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
  }, [userId]);

  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      const response = await getUserStories(userId);
      setStories(response.data?.stories || []);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setStoriesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
    loadStories();
  }, [loadProfile, loadStories]);

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
      toast.success('Foto erfolgreich hochgeladen!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Fehler beim Hochladen des Fotos');
    } finally {
      setSaving(false);
    }
  };

  const handleStoryUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const caption = window.prompt('Story-Beschreibung (optional)') || '';

    const formData = new FormData();
    formData.append('storyMedia', file);
    formData.append('caption', caption);

    try {
      setUploadingStory(true);
      await uploadProfileStory(userId, formData);
      toast.success('Story veröffentlicht');
      await loadStories();
    } catch (error) {
      console.error('Error uploading story:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Hochladen der Story');
    } finally {
      setUploadingStory(false);
      if (storyInputRef.current) {
        storyInputRef.current.value = '';
      }
    }
  };

  const handleOpenStory = async (story) => {
    setStoryModal(story);
    try {
      await markStoryViewed(story.id);
      await loadStories();
    } catch (error) {
      console.error('Error marking story view:', error);
    }
  };

  const handleCloseStory = () => {
    setStoryModal(null);
  };

  const handleNextStory = () => {
    if (!storyModal) return;
    const currentIndex = stories.findIndex((story) => story.id === storyModal.id);
    if (currentIndex === -1) {
      setStoryModal(null);
      return;
    }
    const next = stories[(currentIndex + 1) % stories.length];
    handleOpenStory(next);
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await updateUserProfile(userId, formData);
      setProfile({ ...profile, ...formData });
      setEditing(false);
      toast.success('Profil aktualisiert!');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Fehler beim Speichern des Profils');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      await updateUserPreferences(userId, preferences);
      toast.success('Einstellungen gespeichert!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Fehler beim Speichern der Einstellungen');
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
    <div
      className={`user-profile-shell fixed inset-0 bg-black/60 backdrop-blur-sm z-50 ${
        isMobile ? 'p-0 flex items-stretch justify-center' : 'p-4 flex items-center justify-center'
      }`}
    >
      <div
        className={`bg-white shadow-2xl w-full flex flex-col ${
          isMobile ? 'h-full max-w-none rounded-none overflow-y-auto' : 'rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto'
        }`}
      >
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
                    src={photoPreview || getAssetUrl(profile.profile_photo)}
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

        {/* Stories */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Stories</h3>
            {isOwnProfile && (
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium cursor-pointer hover:bg-blue-100 transition">
                <ImageIcon className="w-4 h-4" />
                {uploadingStory ? 'Lädt...' : 'Story hinzufügen'}
                <input
                  ref={storyInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleStoryUpload}
                  disabled={uploadingStory}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {storiesLoading ? (
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Stories werden geladen ...
            </div>
          ) : stories.length === 0 ? (
            <div className="text-sm text-gray-500">
              Noch keine Stories vorhanden.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {stories.map((story) => {
                const isVideo = story.mediaType?.startsWith('video/');
                return (
                  <button
                    key={story.id}
                    onClick={() => handleOpenStory(story)}
                    className="flex-shrink-0 w-24 flex flex-col items-center gap-2"
                  >
                    <div
                      className={`w-20 h-20 rounded-3xl border-4 ${isVideo ? 'border-purple-400' : 'border-blue-400'} overflow-hidden bg-gray-200 flex items-center justify-center`}
                      style={
                        !isVideo && story.mediaUrl
                          ? {
                              backgroundImage: `url(${getAssetUrl(story.mediaUrl)})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }
                          : undefined
                      }
                    >
                      {isVideo && (
                        <span className="text-white text-xs bg-black/50 px-2 py-1 rounded-full">Video</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 text-center line-clamp-2">
                      {story.caption || 'Story'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      👀 {story.views}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {[
              { id: 'profile', label: 'Profil', icon: <Eye className="w-4 h-4" /> },
              { id: 'preferences', label: 'Einstellungen', icon: <Bell className="w-4 h-4" /> },
              { id: 'contact', label: 'Kontakte', icon: <Globe className="w-4 h-4" /> },
              { id: 'security', label: 'Sicherheit', icon: <Shield className="w-4 h-4" /> }
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

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Passwort ändern
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aktuelles Passwort
                    </label>
                    <input
                      type="password"
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Neues Passwort
                    </label>
                    <input
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Mindestens 8 Zeichen mit Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passwort bestätigen
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (passwordData.new_password !== passwordData.confirm_password) {
                        alert('Passwörter stimmen nicht überein');
                        return;
                      }
                      alert('Passwort-Änderung noch nicht implementiert');
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Passwort ändern
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <LogOut className="w-5 h-5" />
                  Aktive Sitzungen
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">Aktuelle Sitzung</p>
                        <p className="text-sm text-gray-500">Chrome auf Windows • {new Date().toLocaleDateString('de-DE')}</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Aktiv
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-4">
                      Keine weiteren aktiven Sitzungen gefunden.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {storyModal && (
        <div
          className={`fixed inset-0 z-[80] flex bg-black/70 ${
            isMobile ? 'items-stretch justify-center p-0' : 'items-center justify-center px-4 py-8'
          }`}
        >
          <div
            className="absolute inset-0"
            onClick={handleCloseStory}
          />
          <div
            className={`relative z-[81] w-full bg-white shadow-2xl ${
              isMobile ? 'h-full max-w-none rounded-none flex flex-col' : 'max-w-sm rounded-3xl overflow-hidden'
            }`}
          >
            <div className={`relative bg-black ${isMobile ? 'flex-1' : ''}`}>
              {storyModal.mediaType?.startsWith('video/') ? (
                <video
                  src={getAssetUrl(storyModal.mediaUrl)}
                  className={`w-full ${isMobile ? 'h-full object-contain' : 'h-[420px] object-contain'} bg-black`}
                  controls
                  autoPlay
                />
              ) : (
                <img
                  src={getAssetUrl(storyModal.mediaUrl)}
                  alt={storyModal.caption || 'Story'}
                  className={`w-full ${isMobile ? 'h-full object-contain' : 'h-[420px] object-cover'}`}
                />
              )}
              <button
                onClick={handleCloseStory}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{profile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(storyModal.createdAt), { addSuffix: true, locale: de })}
                  </p>
                </div>
                {stories.length > 1 && (
                  <button
                    onClick={handleNextStory}
                    className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                  >
                    Weiter
                    <Play className="w-4 h-4" />
                  </button>
                )}
              </div>
              {storyModal.caption && (
                <p className="text-sm text-gray-700">{storyModal.caption}</p>
              )}
              <div className="text-xs text-gray-500">👀 {storyModal.views} Aufrufe</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
