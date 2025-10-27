import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const EventModal_ENHANCED = ({ isOpen, onClose, onSave, event = null, date = null }) => {
  const auth = useAuth(); const user = auth?.user;
  const [activeTab, setActiveTab] = useState('meeting');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    start_time: '',
    end_time: '',
    event_type: 'meeting',
    priority: 'medium',
    location: '',
    attendees: '',
    // Meeting specific
    room: '',
    // Task specific
    deadline: '',
    taskPriority: 'medium',
    // Waste specific
    wasteType: '',
    hazardLevel: 'low',
    // Absence specific
    absenceType: 'vacation',
    startDate: '',
    endDate: ''
  });

  // Duration presets in minutes
  const durationPresets = [
    { label: '15 Min', minutes: 15 },
    { label: '30 Min', minutes: 30 },
    { label: '1 Std', minutes: 60 },
    { label: '2 Std', minutes: 120 },
    { label: '4 Std', minutes: 240 },
    { label: 'Ganztägig', minutes: 480 }
  ];

  // Tab configuration with smart defaults
  const tabs = [
    { id: 'meeting', label: 'Besprechung', icon: '👥', defaultDuration: 60 },
    { id: 'task', label: 'Aufgabe', icon: '📋', defaultDuration: 120 },
    { id: 'waste', label: 'Entsorgung', icon: '♻️', defaultDuration: 30 },
    { id: 'absence', label: 'Abwesenheit', icon: '🏖️', defaultDuration: 480 },
    { id: 'other', label: 'Andere', icon: '📌', defaultDuration: 60 }
  ];

  useEffect(() => {
    if (event) {
      // Edit mode - populate form with existing event data
      setFormData({
        ...formData,
        title: event.title || '',
        description: event.description || '',
        event_date: event.event_date || '',
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        event_type: event.event_type || 'meeting',
        priority: event.priority || 'medium',
        location: event.location || '',
        attendees: event.attendees ? (typeof event.attendees === 'string' ? event.attendees : JSON.stringify(event.attendees)) : ''
      });
      setActiveTab(event.event_type || 'meeting');
    } else if (date) {
      // New event - set date
      setFormData({ ...formData, event_date: date });
    }
  }, [event, date]);

  useEffect(() => {
    // Update event_type when tab changes
    setFormData({ ...formData, event_type: activeTab });
  }, [activeTab]);

  const addMinutesToTime = (time, minutes) => {
    if (!time) return '';
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMins = totalMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
  };

  const handleDurationPreset = (minutes) => {
    if (!formData.start_time) {
      // If no start time, set default to 9:00
      setFormData({
        ...formData,
        start_time: '09:00',
        end_time: addMinutesToTime('09:00', minutes)
      });
    } else {
      setFormData({
        ...formData,
        end_time: addMinutesToTime(formData.start_time, minutes)
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title || formData.title.trim() === '') {
      newErrors.title = 'Titel ist erforderlich';
    } else if (formData.title.length > 200) {
      newErrors.title = 'Titel ist zu lang (max 200 Zeichen)';
    }

    if (!formData.event_date) {
      newErrors.event_date = 'Datum ist erforderlich';
    }

    if (formData.start_time && formData.end_time) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(formData.start_time)) {
        newErrors.start_time = 'Ungültiges Zeitformat (HH:MM)';
      }
      if (!timeRegex.test(formData.end_time)) {
        newErrors.end_time = 'Ungültiges Zeitformat (HH:MM)';
      }

      if (formData.start_time >= formData.end_time) {
        newErrors.end_time = 'Endzeit muss nach Startzeit liegen';
      }
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Beschreibung ist zu lang (max 1000 Zeichen)';
    }

    // Tab-specific validations
    if (activeTab === 'task' && !formData.deadline && formData.event_date) {
      // Set default deadline to event date
      setFormData({ ...formData, deadline: formData.event_date });
    }

    if (activeTab === 'absence') {
      if (!formData.startDate) {
        newErrors.startDate = 'Startdatum ist erforderlich';
      }
      if (!formData.endDate) {
        newErrors.endDate = 'Enddatum ist erforderlich';
      }
      if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
        newErrors.endDate = 'Enddatum muss nach Startdatum liegen';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Prepare data for submission
      const submitData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        event_type: activeTab,
        priority: formData.priority,
        location: formData.location.trim() || null,
        attendees: formData.attendees.trim() || null
      };

      await onSave(submitData);

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        handleClose();
      }, 1500);
    } catch (error) {
      setErrors({ submit: error.message || 'Fehler beim Speichern des Ereignisses' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      event_date: '',
      start_time: '',
      end_time: '',
      event_type: 'meeting',
      priority: 'medium',
      location: '',
      attendees: '',
      room: '',
      deadline: '',
      taskPriority: 'medium',
      wasteType: '',
      hazardLevel: 'low',
      absenceType: 'vacation',
      startDate: '',
      endDate: ''
    });
    setErrors({});
    setSuccess(false);
    setActiveTab('meeting');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          aria-hidden="true"
          onClick={handleClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white rounded-2xl shadow-xl modal-mobile">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {event ? 'Ereignis bearbeiten' : 'Neues Ereignis erstellen'}
              </h3>
              <button
                onClick={handleClose}
                className="text-white hover:text-gray-200 transition-colors btn-touch"
                aria-label="Schließen"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Success message */}
          {success && (
            <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-green-800 font-medium">Erfolgreich gespeichert!</span>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6 mt-4">
            <nav className="-mb-px flex space-x-4 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-all rounded-t-lg btn-touch`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="space-y-6">
              {/* Error message */}
              {errors.submit && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-800 text-sm">{errors.submit}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Titel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.title ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="z.B. Team Meeting, Laborarbeit, etc."
                  maxLength="200"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                )}
              </div>

              {/* Date and Time Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 form-row-mobile">
                <div>
                  <label htmlFor="event_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Datum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="event_date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.event_date ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {errors.event_date && (
                    <p className="mt-1 text-sm text-red-600">{errors.event_date}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    id="start_time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.start_time ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {errors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.start_time}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    id="end_time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.end_time ? 'border-red-500 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  {errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>
                  )}
                </div>
              </div>

              {/* Duration Presets - Only for meetings */}
              {activeTab === 'meeting' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schnellauswahl Dauer
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {durationPresets.map(preset => (
                      <button
                        key={preset.minutes}
                        type="button"
                        onClick={() => handleDurationPreset(preset.minutes)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm transition-colors btn-touch"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab-specific fields */}
              {activeTab === 'meeting' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 form-row-mobile">
                  <div>
                    <label htmlFor="room" className="block text-sm font-medium text-gray-700 mb-2">
                      Raum
                    </label>
                    <input
                      type="text"
                      id="room"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value, location: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="z.B. Konferenzraum A"
                    />
                  </div>
                  <div>
                    <label htmlFor="attendees" className="block text-sm font-medium text-gray-700 mb-2">
                      Teilnehmer
                    </label>
                    <input
                      type="text"
                      id="attendees"
                      value={formData.attendees}
                      onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Namen durch Komma getrennt"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'task' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 form-row-mobile">
                  <div>
                    <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
                      Deadline
                    </label>
                    <input
                      type="date"
                      id="deadline"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="taskPriority" className="block text-sm font-medium text-gray-700 mb-2">
                      Priorität
                    </label>
                    <select
                      id="taskPriority"
                      value={formData.taskPriority}
                      onChange={(e) => setFormData({ ...formData, taskPriority: e.target.value, priority: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                      <option value="urgent">Dringend</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'waste' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 form-row-mobile">
                  <div>
                    <label htmlFor="wasteType" className="block text-sm font-medium text-gray-700 mb-2">
                      Abfallart
                    </label>
                    <select
                      id="wasteType"
                      value={formData.wasteType}
                      onChange={(e) => setFormData({ ...formData, wasteType: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Bitte auswählen</option>
                      <option value="chemical">Chemisch</option>
                      <option value="biological">Biologisch</option>
                      <option value="radioactive">Radioaktiv</option>
                      <option value="general">Allgemein</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="hazardLevel" className="block text-sm font-medium text-gray-700 mb-2">
                      Gefahrenstufe
                    </label>
                    <select
                      id="hazardLevel"
                      value={formData.hazardLevel}
                      onChange={(e) => setFormData({ ...formData, hazardLevel: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                      <option value="critical">Kritisch</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'absence' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 form-row-mobile">
                  <div>
                    <label htmlFor="absenceType" className="block text-sm font-medium text-gray-700 mb-2">
                      Abwesenheitsart
                    </label>
                    <select
                      id="absenceType"
                      value={formData.absenceType}
                      onChange={(e) => setFormData({ ...formData, absenceType: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="vacation">Urlaub</option>
                      <option value="sick">Krank</option>
                      <option value="business">Geschäftsreise</option>
                      <option value="training">Schulung</option>
                      <option value="other">Sonstiges</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                      Priorität
                    </label>
                    <select
                      id="priority"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Mittel</option>
                      <option value="high">Hoch</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Beschreibung
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    errors.description ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Zusätzliche Details..."
                  maxLength="1000"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  {formData.description.length}/1000 Zeichen
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end safe-area-bottom">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors btn-touch"
                disabled={loading}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 btn-touch"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Speichern...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {event ? 'Aktualisieren' : 'Erstellen'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventModal_ENHANCED;
