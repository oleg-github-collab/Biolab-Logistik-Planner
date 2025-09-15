import React, { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const QuickActionsModal = ({ isOpen, onClose, date, onQuickAdd }) => {
  const [selectedAction, setSelectedAction] = useState(null);
  const [customTitle, setCustomTitle] = useState('');

  if (!isOpen || !date) return null;

  const quickActions = [
    {
      id: 'work',
      title: 'Arbeitstag',
      icon: '💼',
      color: 'bg-green-100 text-green-800 border-green-200',
      defaultData: {
        title: 'Arbeitstag',
        type: 'Arbeit',
        startTime: '09:00',
        endTime: '17:00',
        description: 'Regulärer Arbeitstag'
      }
    },
    {
      id: 'vacation',
      title: 'Urlaub',
      icon: '🏖️',
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      defaultData: {
        title: 'Urlaub',
        type: 'Urlaub',
        isAllDay: true,
        description: 'Urlaubstag'
      }
    },
    {
      id: 'sick',
      title: 'Krankheitstag',
      icon: '🏥',
      color: 'bg-red-100 text-red-800 border-red-200',
      defaultData: {
        title: 'Krankheitstag',
        type: 'Krankheit',
        isAllDay: true,
        description: 'Krankheitsbedingte Abwesenheit'
      }
    },
    {
      id: 'meeting',
      title: 'Meeting',
      icon: '👥',
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      defaultData: {
        title: 'Meeting',
        type: 'Meeting',
        startTime: '10:00',
        endTime: '11:00',
        description: 'Besprechung'
      }
    },
    {
      id: 'training',
      title: 'Training/Schulung',
      icon: '📚',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      defaultData: {
        title: 'Training',
        type: 'Training',
        startTime: '09:00',
        endTime: '12:00',
        description: 'Weiterbildung/Schulung'
      }
    },
    {
      id: 'project',
      title: 'Projekt-Arbeit',
      icon: '📊',
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      defaultData: {
        title: 'Projekt-Arbeit',
        type: 'Projekt',
        startTime: '09:00',
        endTime: '17:00',
        description: 'Projektbezogene Tätigkeiten'
      }
    },
    {
      id: 'custom',
      title: 'Benutzerdefiniert',
      icon: '✨',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      defaultData: {
        title: '',
        type: 'Arbeit',
        startTime: '09:00',
        endTime: '17:00',
        description: ''
      }
    }
  ];

  const timeSlots = [
    { label: 'Früh (06:00-14:00)', start: '06:00', end: '14:00' },
    { label: 'Standard (09:00-17:00)', start: '09:00', end: '17:00' },
    { label: 'Spät (14:00-22:00)', start: '14:00', end: '22:00' },
    { label: 'Nachtschicht (22:00-06:00)', start: '22:00', end: '06:00' }
  ];

  const handleQuickAction = (action) => {
    if (action.id === 'custom') {
      setSelectedAction(action);
      return;
    }

    onQuickAdd({
      ...action.defaultData,
      date: date
    });
  };

  const handleCustomSubmit = () => {
    if (!customTitle.trim()) return;

    onQuickAdd({
      ...selectedAction.defaultData,
      title: customTitle,
      date: date
    });
  };

  const handleTimeSlotSelect = (timeSlot) => {
    onQuickAdd({
      title: 'Arbeitstag',
      type: 'Arbeit',
      startTime: timeSlot.start,
      endTime: timeSlot.end,
      description: `Arbeitszeit: ${timeSlot.label}`,
      date: date
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Schnell hinzufügen</h3>
              <p className="text-sm text-gray-600 mt-1">
                {format(date, 'EEEE, dd. MMMM yyyy', { locale: de })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!selectedAction ? (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Schnellaktionen</h4>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      className={`p-3 rounded-lg border text-left transition-all hover:shadow-md ${action.color}`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{action.icon}</span>
                        <span className="text-sm font-medium">{action.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Arbeitszeiten</h4>
                <div className="space-y-2">
                  {timeSlots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => handleTimeSlotSelect(slot)}
                      className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-800">{slot.label}</span>
                        <span className="text-xs text-gray-500">{slot.start} - {slot.end}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Form Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    onClose();
                    // This would typically trigger opening the full event modal
                  }}
                  className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                >
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm font-medium">Erweiterte Optionen</span>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            // Custom Event Form
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedAction(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h4 className="text-lg font-medium text-gray-800">Benutzerdefinierter Termin</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titel
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="z.B. Labortermin, Besprechung..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setSelectedAction(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zurück
                </button>
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customTitle.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hinzufügen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsModal;