import React, { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const EventDetailsModal = ({ isOpen, onClose, event, onEdit, onDelete, onDuplicate }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !event) return null;

  const getTypeIcon = (type) => {
    const icons = {
      'Arbeit': '💼',
      'Urlaub': '🏖️',
      'Krankheit': '🏥',
      'Meeting': '👥',
      'Projekt': '📊',
      'Training': '📚',
      'Abwesend': '🚫'
    };
    return icons[type] || '📅';
  };

  const getTypeColor = (type) => {
    const colors = {
      'Arbeit': 'bg-green-100 text-green-800 border-green-200',
      'Urlaub': 'bg-purple-100 text-purple-800 border-purple-200',
      'Krankheit': 'bg-red-100 text-red-800 border-red-200',
      'Meeting': 'bg-blue-100 text-blue-800 border-blue-200',
      'Projekt': 'bg-orange-100 text-orange-800 border-orange-200',
      'Training': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Abwesend': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🔴'
    };
    return icons[priority] || '🟡';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      'low': 'Niedrig',
      'medium': 'Mittel',
      'high': 'Hoch'
    };
    return labels[priority] || 'Mittel';
  };

  const getRecurrenceLabel = (pattern) => {
    const labels = {
      'daily': 'Täglich',
      'weekly': 'Wöchentlich',
      'biweekly': 'Alle 2 Wochen',
      'monthly': 'Monatlich',
      'yearly': 'Jährlich'
    };
    return labels[pattern] || pattern;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(event.id);
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate({
        ...event,
        id: undefined,
        title: `${event.title} (Kopie)`
      });
    }
    onClose();
  };

  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-2xl">{getTypeIcon(event.type)}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getTypeColor(event.type)}`}>
                  {event.type}
                </span>
                {event.priority && (
                  <span className="flex items-center space-x-1 text-sm text-gray-600">
                    <span>{getPriorityIcon(event.priority)}</span>
                    <span>{getPriorityLabel(event.priority)}</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {event.title}
              </h2>
              <p className="text-sm text-gray-600">
                {format(eventDate, 'EEEE, dd. MMMM yyyy', { locale: de })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Time */}
          {!event.isAllDay && (event.startTime || event.endTime) && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {event.startTime} - {event.endTime}
                </p>
                <p className="text-sm text-gray-600">
                  {event.isAllDay ? 'Ganztägig' : 'Zeitraum'}
                </p>
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">{event.location}</p>
                <p className="text-sm text-gray-600">Ort</p>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">Teilnehmer</p>
                <div className="text-sm text-gray-600 mt-1">
                  {event.attendees.split(',').map((email, index) => (
                    <div key={index} className="mb-1">
                      <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">
                        {email.trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recurring Info */}
          {event.isRecurring && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {getRecurrenceLabel(event.recurrencePattern)}
                </p>
                <p className="text-sm text-gray-600">
                  Wiederholender Termin
                  {event.recurrenceEndDate && (
                    <span> bis {format(new Date(event.recurrenceEndDate), 'dd.MM.yyyy', { locale: de })}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Reminder */}
          {event.reminder && event.reminder !== '0' && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-12h0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {event.reminder < 60 ? `${event.reminder} Minuten` :
                   event.reminder < 1440 ? `${Math.floor(event.reminder / 60)} Stunden` :
                   `${Math.floor(event.reminder / 1440)} Tage`} vorher
                </p>
                <p className="text-sm text-gray-600">Erinnerung</p>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-800">Beschreibung</h4>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200">
          {!showDeleteConfirm ? (
            <div className="flex space-x-3">
              <button
                onClick={() => onEdit(event)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Bearbeiten</span>
              </button>

              <button
                onClick={handleDuplicate}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Duplizieren</span>
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Löschen</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">
                  Sind Sie sicher, dass Sie diesen Termin löschen möchten?
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Löschen...' : 'Bestätigen'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetailsModal;