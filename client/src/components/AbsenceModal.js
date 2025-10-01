import React, { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';

const AbsenceModal = ({ isOpen, onClose, onSave, selectedDate }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    type: 'Urlaub',
    is_all_day: true
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
      setFormData({
        title: '',
        description: '',
        start_date: dateStr,
        end_date: dateStr,
        type: 'Urlaub',
        is_all_day: true
      });
      setErrors({});
    }
  }, [isOpen, selectedDate]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Auto-set title based on type
    if (name === 'type') {
      const titles = {
        'Urlaub': 'Urlaub',
        'Krankheit': 'Krankschreibung',
        'Überstundenabbau': 'Überstundenabbau'
      };
      setFormData(prev => ({
        ...prev,
        title: titles[value] || ''
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
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

    if (!formData.end_date) {
      newErrors.end_date = 'Enddatum ist erforderlich';
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'Enddatum muss nach oder gleich dem Startdatum sein';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving absence:', error);
      setErrors({ submit: 'Fehler beim Speichern der Abwesenheit' });
    } finally {
      setSaving(false);
    }
  };

  const getDaysCount = () => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const timeDiff = end.getTime() - start.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return daysDiff;
    }
    return 1;
  };

  if (!isOpen) return null;

  const absenceTypes = [
    {
      value: 'Urlaub',
      label: 'Urlaub',
      icon: '🏖️',
      color: 'text-blue-600',
      description: 'Geplanter Urlaub oder Freizeit'
    },
    {
      value: 'Krankheit',
      label: 'Krankschreibung',
      icon: '🏥',
      color: 'text-red-600',
      description: 'Krankheitsbedingte Abwesenheit'
    },
    {
      value: 'Überstundenabbau',
      label: 'Überstundenabbau',
      icon: '⏰',
      color: 'text-green-600',
      description: 'Abbau von angesammelten Überstunden'
    }
  ];

  const selectedType = absenceTypes.find(type => type.value === formData.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Abwesenheit melden
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
            {/* Absence Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Art der Abwesenheit
              </label>
              <div className="space-y-2">
                {absenceTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.type === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.value}
                      checked={formData.type === type.value}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <div className="flex items-center flex-1">
                      <span className="text-2xl mr-3">{type.icon}</span>
                      <div>
                        <div className={`font-medium ${type.color}`}>
                          {type.label}
                        </div>
                        <div className="text-sm text-gray-500">
                          {type.description}
                        </div>
                      </div>
                    </div>
                    {formData.type === type.value && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            </div>

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
                placeholder="z.B. Sommerurlaub, Krankmeldung..."
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Von *
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
                  Bis *
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

            {/* Duration Display */}
            {formData.start_date && formData.end_date && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <span className="text-blue-600 mr-2">📅</span>
                  <span className="text-blue-700 font-medium">
                    Dauer: {getDaysCount()} {getDaysCount() === 1 ? 'Tag' : 'Tage'}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung (optional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Informationen..."
              />
            </div>

            {/* Information Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Hinweis:</strong> Diese Abwesenheit überschreibt automatisch generierte Arbeitszeiten
                    für den gewählten Zeitraum.
                  </p>
                </div>
              </div>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{errors.submit}</p>
              </div>
            )}

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
                disabled={saving}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  selectedType
                    ? `bg-${selectedType.color.split('-')[1]}-600 hover:bg-${selectedType.color.split('-')[1]}-700`
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? 'Speichern...' : 'Abwesenheit melden'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AbsenceModal;