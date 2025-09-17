import React, { useState, useEffect } from 'react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { de } from 'date-fns/locale';

const EventDetailsPanel = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  mode = 'view', // 'view', 'edit', 'create'
  users = []
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    type: 'Termin',
    priority: 'medium',
    location: '',
    attendees: [],
    all_day: false,
    recurring: false,
    recurring_pattern: 'weekly',
    recurring_end: '',
    reminder: 15,
    status: 'confirmed',
    color: '#3b82f6',
    tags: []
  });

  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(mode === 'edit' || mode === 'create');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Event types with colors
  const eventTypes = [
    { value: 'Arbeit', label: 'Arbeit', color: '#10b981' },
    { value: 'Meeting', label: 'Meeting', color: '#3b82f6' },
    { value: 'Urlaub', label: 'Urlaub', color: '#8b5cf6' },
    { value: 'Krankheit', label: 'Krankheit', color: '#ef4444' },
    { value: 'Training', label: 'Training', color: '#f59e0b' },
    { value: 'Projekt', label: 'Projekt', color: '#f97316' },
    { value: 'Termin', label: 'Termin', color: '#06b6d4' },
    { value: 'Deadline', label: 'Deadline', color: '#dc2626' },
    { value: 'Personal', label: 'Personal', color: '#84cc16' }
  ];

  const priorityLevels = [
    { value: 'low', label: 'Niedrig', color: '#10b981' },
    { value: 'medium', label: 'Mittel', color: '#f59e0b' },
    { value: 'high', label: 'Hoch', color: '#ef4444' },
    { value: 'urgent', label: 'Dringend', color: '#dc2626' }
  ];

  const reminderOptions = [
    { value: 0, label: 'Keine Erinnerung' },
    { value: 5, label: '5 Minuten' },
    { value: 15, label: '15 Minuten' },
    { value: 30, label: '30 Minuten' },
    { value: 60, label: '1 Stunde' },
    { value: 120, label: '2 Stunden' },
    { value: 1440, label: '1 Tag' },
    { value: 2880, label: '2 Tage' }
  ];

  // Initialize form data when event changes
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        start_date: event.start_date || event.date || '',
        start_time: event.start_time || '09:00',
        end_date: event.end_date || event.date || '',
        end_time: event.end_time || '10:00',
        type: event.type || 'Termin',
        priority: event.priority || 'medium',
        location: event.location || '',
        attendees: event.attendees || [],
        all_day: event.all_day || false,
        recurring: event.recurring || false,
        recurring_pattern: event.recurring_pattern || 'weekly',
        recurring_end: event.recurring_end || '',
        reminder: event.reminder || 15,
        status: event.status || 'confirmed',
        color: event.color || getColorForType(event.type || 'Termin'),
        tags: event.tags || []
      });
    } else if (mode === 'create') {
      const now = new Date();
      setFormData(prev => ({
        ...prev,
        start_date: format(now, 'yyyy-MM-dd'),
        end_date: format(now, 'yyyy-MM-dd'),
        start_time: format(now, 'HH:mm'),
        end_time: format(addDays(now, 0), 'HH:mm')
      }));
    }
  }, [event, mode]);

  const getColorForType = (type) => {
    const eventType = eventTypes.find(t => t.value === type);
    return eventType ? eventType.color : '#3b82f6';
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear related errors
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Auto-update color when type changes
    if (field === 'type') {
      setFormData(prev => ({
        ...prev,
        color: getColorForType(value)
      }));
    }

    // Auto-update end time when start time changes
    if (field === 'start_time' && !formData.all_day) {
      const [hours, minutes] = value.split(':').map(Number);
      const endTime = new Date();
      endTime.setHours(hours + 1, minutes);
      setFormData(prev => ({
        ...prev,
        end_time: format(endTime, 'HH:mm')
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Titel ist erforderlich';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Startdatum ist erforderlich';
    }

    if (!formData.all_day) {
      if (!formData.start_time) {
        newErrors.start_time = 'Startzeit ist erforderlich';
      }
      if (!formData.end_time) {
        newErrors.end_time = 'Endzeit ist erforderlich';
      }

      if (formData.start_date === formData.end_date &&
          formData.start_time >= formData.end_time) {
        newErrors.end_time = 'Endzeit muss nach Startzeit liegen';
      }
    }

    if (formData.recurring && !formData.recurring_end) {
      newErrors.recurring_end = 'Wiederholung-Enddatum ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const eventData = {
      ...event,
      ...formData,
      id: event?.id || Date.now(),
      updated_at: new Date().toISOString()
    };

    onSave?.(eventData);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (event?.id) {
      onDelete?.(event.id);
      setShowDeleteConfirm(false);
    }
  };

  const handleDuplicate = () => {
    const duplicatedEvent = {
      ...formData,
      id: Date.now(),
      title: `${formData.title} (Kopie)`,
      start_date: format(addDays(parseISO(formData.start_date), 1), 'yyyy-MM-dd'),
      end_date: format(addDays(parseISO(formData.end_date), 1), 'yyyy-MM-dd')
    };
    onDuplicate?.(duplicatedEvent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Neuer Termin' :
             isEditing ? 'Termin bearbeiten' : 'Termin-Details'}
          </h2>

          <div className="flex items-center space-x-2">
            {!isEditing && event && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  title="Bearbeiten"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={handleDuplicate}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  title="Duplizieren"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  title="Löschen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel *
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Termintitel eingeben..."
              />
            ) : (
              <p className="text-lg font-medium text-gray-900">{formData.title}</p>
            )}
            {errors.title && (
              <p className="text-sm text-red-600 mt-1">{errors.title}</p>
            )}
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typ
              </label>
              {isEditing ? (
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {eventTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getColorForType(formData.type) }}
                  />
                  <span>{formData.type}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorität
              </label>
              {isEditing ? (
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {priorityLevels.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center space-x-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: priorityLevels.find(p => p.value === formData.priority)?.color }}
                  />
                  <span>{priorityLevels.find(p => p.value === formData.priority)?.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* All Day Toggle */}
          {isEditing && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="all_day"
                checked={formData.all_day}
                onChange={(e) => handleInputChange('all_day', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="all_day" className="ml-2 text-sm text-gray-700">
                Ganztägig
              </label>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Startdatum *
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange('start_date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              ) : (
                <p>{format(parseISO(formData.start_date), 'dd.MM.yyyy', { locale: de })}</p>
              )}
              {errors.start_date && (
                <p className="text-sm text-red-600 mt-1">{errors.start_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enddatum
              </label>
              {isEditing ? (
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p>{format(parseISO(formData.end_date), 'dd.MM.yyyy', { locale: de })}</p>
              )}
            </div>
          </div>

          {!formData.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Startzeit *
                </label>
                {isEditing ? (
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.start_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                ) : (
                  <p>{formData.start_time}</p>
                )}
                {errors.start_time && (
                  <p className="text-sm text-red-600 mt-1">{errors.start_time}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endzeit *
                </label>
                {isEditing ? (
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.end_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                ) : (
                  <p>{formData.end_time}</p>
                )}
                {errors.end_time && (
                  <p className="text-sm text-red-600 mt-1">{errors.end_time}</p>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            {isEditing ? (
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Zusätzliche Details..."
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">
                {formData.description || 'Keine Beschreibung vorhanden'}
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ort
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Veranstaltungsort..."
              />
            ) : (
              <p className="text-gray-700">{formData.location || 'Kein Ort angegeben'}</p>
            )}
          </div>

          {/* Reminder */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Erinnerung
              </label>
              <select
                value={formData.reminder}
                onChange={(e) => handleInputChange('reminder', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {reminderOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {isEditing ? 'Abbrechen' : 'Schließen'}
          </button>

          {isEditing && (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {mode === 'create' ? 'Erstellen' : 'Speichern'}
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Termin löschen?
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Sind Sie sicher, dass Sie diesen Termin löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetailsPanel;