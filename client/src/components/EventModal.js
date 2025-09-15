import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const EventModal = ({ isOpen, onClose, event, onSave, onChange }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '09:00',
    endTime: '17:00',
    type: 'Arbeit',
    isAllDay: false,
    isRecurring: false,
    recurrencePattern: 'weekly',
    priority: 'medium',
    location: '',
    attendees: '',
    reminder: '15',
    category: 'work',
    ...event
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({ ...formData, ...event });
    }
  }, [event]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Titel ist erforderlich';
    }

    if (!formData.isAllDay && formData.startTime && formData.endTime) {
      const startHour = parseInt(formData.startTime.split(':')[0]);
      const endHour = parseInt(formData.endTime.split(':')[0]);
      const startMinute = parseInt(formData.startTime.split(':')[1]);
      const endMinute = parseInt(formData.endTime.split(':')[1]);

      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;

      if (startTotal >= endTotal) {
        newErrors.time = 'Endzeit muss nach der Startzeit liegen';
      }
    }

    if (formData.attendees) {
      const emails = formData.attendees.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const invalidEmails = emails.filter(email => email && !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        newErrors.attendees = `Ungültige E-Mail-Adressen: ${invalidEmails.join(', ')}`;
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

    setIsSubmitting(true);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      setErrors({ submit: 'Fehler beim Speichern des Termins' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    onChange(newFormData);

    // Clear related errors when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const typeOptions = [
    { value: 'Arbeit', label: 'Arbeit', color: 'bg-green-100 text-green-800', icon: '💼' },
    { value: 'Urlaub', label: 'Urlaub', color: 'bg-purple-100 text-purple-800', icon: '🏖️' },
    { value: 'Krankheit', label: 'Krankheit', color: 'bg-red-100 text-red-800', icon: '🏥' },
    { value: 'Meeting', label: 'Meeting', color: 'bg-blue-100 text-blue-800', icon: '👥' },
    { value: 'Projekt', label: 'Projekt', color: 'bg-orange-100 text-orange-800', icon: '📊' },
    { value: 'Training', label: 'Training', color: 'bg-yellow-100 text-yellow-800', icon: '📚' },
    { value: 'Abwesend', label: 'Abwesend', color: 'bg-gray-100 text-gray-800', icon: '🚫' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Niedrig', color: 'text-green-600' },
    { value: 'medium', label: 'Mittel', color: 'text-yellow-600' },
    { value: 'high', label: 'Hoch', color: 'text-red-600' }
  ];

  const reminderOptions = [
    { value: '0', label: 'Keine Erinnerung' },
    { value: '5', label: '5 Minuten vorher' },
    { value: '15', label: '15 Minuten vorher' },
    { value: '30', label: '30 Minuten vorher' },
    { value: '60', label: '1 Stunde vorher' },
    { value: '120', label: '2 Stunden vorher' },
    { value: '1440', label: '1 Tag vorher' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">
              {event?.id ? 'Termin bearbeiten' : 'Neuer Termin'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {formData.date && (
            <p className="text-sm text-gray-600 mt-1">
              {format(new Date(formData.date), 'EEEE, dd. MMMM yyyy', { locale: de })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="z.B. Labortermin, Meeting mit Team..."
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Typ
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {typeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorität
              </label>
              <select
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {priorityOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* All Day Toggle */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={formData.isAllDay}
                  onChange={(e) => handleChange('isAllDay', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="allDay" className="text-sm font-medium text-gray-700">
                  Ganztägiger Termin
                </label>
              </div>
            </div>

            {/* Time Fields */}
            {!formData.isAllDay && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleChange('startTime', e.target.value)}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.time ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleChange('endTime', e.target.value)}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.time ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors.time && (
                    <p className="text-red-600 text-sm mt-1">{errors.time}</p>
                  )}
                </div>
              </>
            )}

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="z.B. Labor 1, Konferenzraum A..."
              />
            </div>

            {/* Reminder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Erinnerung
              </label>
              <select
                value={formData.reminder}
                onChange={(e) => handleChange('reminder', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {reminderOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Attendees */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teilnehmer (E-Mail-Adressen, durch Komma getrennt)
              </label>
              <input
                type="text"
                value={formData.attendees}
                onChange={(e) => handleChange('attendees', e.target.value)}
                className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.attendees ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="max.mustermann@example.com, anna.schmidt@example.com"
              />
              {errors.attendees && (
                <p className="text-red-600 text-sm mt-1">{errors.attendees}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows="4"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Details zum Termin..."
              />
            </div>

            {/* Recurring Section */}
            <div className="md:col-span-2 border-t border-gray-200 pt-6">
              <div className="flex items-center space-x-3 mb-4">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.isRecurring}
                  onChange={(e) => handleChange('isRecurring', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                  Wiederholender Termin
                </label>
              </div>

              {formData.isRecurring && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wiederholungsmuster
                    </label>
                    <select
                      value={formData.recurrencePattern}
                      onChange={(e) => handleChange('recurrencePattern', e.target.value)}
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
                      Endet am (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.recurrenceEndDate || ''}
                      onChange={(e) => handleChange('recurrenceEndDate', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {errors.submit}
            </div>
          )}

          <div className="flex space-x-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;