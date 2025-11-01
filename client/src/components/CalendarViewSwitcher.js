import React, { useState } from 'react';
import { Calendar, Clock, CalendarDays, CalendarRange } from 'lucide-react';

const VIEW_MODES = [
  { id: 'day', label: 'Tag', icon: Clock },
  { id: 'week', label: 'Woche', icon: CalendarDays },
  { id: 'month', label: 'Monat', icon: Calendar },
  { id: 'year', label: 'Jahr', icon: CalendarRange }
];

const CalendarViewSwitcher = ({ currentView, onViewChange }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
      {VIEW_MODES.map(mode => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.id}
            onClick={() => onViewChange(mode.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              currentView === mode.id
                ? 'bg-white text-blue-600 shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CalendarViewSwitcher;
