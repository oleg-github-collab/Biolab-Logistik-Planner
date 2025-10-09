import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { format } from 'date-fns';

// ✅ OPTIMIZED: Main EventModal component wrapped with memo to prevent unnecessary re-renders
const EventModal = memo(({ isOpen, onClose, onSave, selectedDate, event = null, mode = 'create' }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    start_time: '08:00',
    end_time: '17:00',
    all_day: false,
    type: 'Arbeit',
    priority: 'medium',
    location: '',
    attendees: [],
    reminder: 15,
    status: 'confirmed',
    category: 'work',
    notes: '',
    recurring: false,
    recurring_pattern: 'weekly',
    recurring_end: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && event) {
        setFormData({
          title: event.title || '',
          description: event.description || '',
          start_date: event.start_date || format(selectedDate || new Date(), 'yyyy-MM-dd'),
          end_date: event.end_date || format(selectedDate || new Date(), 'yyyy-MM-dd'),
          start_time: event.start_time || '08:00',
          end_time: event.end_time || '17:00',
          all_day: Boolean(event.all_day),
          type: event.type || 'Arbeit',
          priority: event.priority || 'medium',
          location: event.location || '',
          attendees: Array.isArray(event.attendees) ? event.attendees : [],
          reminder: event.reminder ?? 15,
          status: event.status || 'confirmed',
          category: event.category || 'work',
          notes: event.notes || '',
          recurring: Boolean(event.recurring),
          recurring_pattern: event.recurring_pattern || 'weekly',
          recurring_end: event.recurring_end || ''
        });
      } else {
        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        setFormData({
          title: '',
          description: '',
          start_date: dateStr,
          end_date: dateStr,
          start_time: '08:00',
          end_time: '17:00',
          all_day: false,
          type: 'Arbeit',
          priority: 'medium',
          location: '',
          attendees: [],
          reminder: 15,
          status: 'confirmed',
          category: 'work',
          notes: '',
          recurring: false,
          recurring_pattern: 'weekly',
          recurring_end: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, selectedDate, event, mode]);

  // ✅ OPTIMIZED: useCallback to memoize input handlers
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleAttendeesChange = useCallback((e) => {
    const value = e.target.value;
    const attendees = value.split(',').map(email => email.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, attendees }));
  }, []);

  // ✅ OPTIMIZED: useCallback for validation and submit
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Titel ist erforderlich';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Startdatum ist erforderlich';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Enddatum ist erforderlich';
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'Enddatum muss nach Startdatum liegen';
    }

    if (!formData.all_day) {
      if (!formData.start_time) {
        newErrors.start_time = 'Startzeit ist erforderlich';
      }
      if (!formData.end_time) {
        newErrors.end_time = 'Endzeit ist erforderlich';
      }
      if (formData.start_date === formData.end_date && formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
        newErrors.end_time = 'Endzeit muss nach Startzeit liegen';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (validateForm()) {
      const eventData = {
        ...formData,
        id: event?.id
      };
      onSave(eventData);
    }
  }, [formData, event?.id, onSave, validateForm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'edit' ? 'Termin bearbeiten' : 'Neuen Termin erstellen'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titel *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Termin Titel eingeben..."
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Details..."
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Startdatum *
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.start_date && <p className="text-red-500 text-sm mt-1">{errors.start_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enddatum *
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.end_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.end_date && <p className="text-red-500 text-sm mt-1">{errors.end_date}</p>}
              </div>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="all_day"
                id="all_day"
                checked={formData.all_day}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="all_day" className="ml-2 text-sm font-medium text-gray-700">
                Ganztägig
              </label>
            </div>

            {/* Time Fields */}
            {!formData.all_day && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Startzeit *
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.start_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.start_time && <p className="text-red-500 text-sm mt-1">{errors.start_time}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endzeit *
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.end_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.end_time && <p className="text-red-500 text-sm mt-1">{errors.end_time}</p>}
                </div>
              </div>
            )}

            {/* Type and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Arbeit">Arbeit</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Urlaub">Urlaub</option>
                  <option value="Krankheit">Krankheit</option>
                  <option value="Training">Training</option>
                  <option value="Projekt">Projekt</option>
                  <option value="Termin">Termin</option>
                  <option value="Deadline">Deadline</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorität
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ort des Termins..."
              />
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teilnehmer (E-Mail Adressen, durch Komma getrennt)
              </label>
              <input
                type="text"
                value={formData.attendees.join(', ')}
                onChange={handleAttendeesChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="beispiel@email.com, andere@email.com"
              />
            </div>

            {/* Reminder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Erinnerung (Minuten vorher)
              </label>
              <select
                name="reminder"
                value={formData.reminder}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={0}>Keine</option>
                <option value={5}>5 Minuten</option>
                <option value={15}>15 Minuten</option>
                <option value={30}>30 Minuten</option>
                <option value={60}>1 Stunde</option>
                <option value={1440}>1 Tag</option>
              </select>
            </div>

            {/* Recurring Event */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  name="recurring"
                  id="recurring"
                  checked={formData.recurring}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="recurring" className="ml-2 text-sm font-medium text-gray-700">
                  Wiederholender Termin
                </label>
              </div>

              {formData.recurring && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wiederholungsmuster
                    </label>
                    <select
                      name="recurring_pattern"
                      value={formData.recurring_pattern}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="biweekly">Alle 2 Wochen</option>
                      <option value="monthly">Monatlich</option>
                      <option value="yearly">Jährlich</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wiederholung endet am (optional)
                    </label>
                    <input
                      type="date"
                      name="recurring_end"
                      value={formData.recurring_end}
                      onChange={handleInputChange}
                      min={formData.start_date}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leer lassen für unbegrenzte Wiederholung
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notizen
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Notizen..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {mode === 'edit' ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

EventModal.displayName = 'EventModal';

export default EventModal;