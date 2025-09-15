import React from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

const Calendar = ({ weekStart, selectedDay, onDaySelect, scheduleData }) => {
  const days = [];
  const startDate = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
  
  for (let i = 0; i < 7; i++) {
    const day = addDays(startDate, i);
    days.push(day);
  }

  const getDayStatus = (dayIndex) => {
    if (!scheduleData || !scheduleData[dayIndex]) return 'Arbeit';
    return scheduleData[dayIndex].status;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Arbeit':
        return 'bg-biolab-green';
      case 'Urlaub':
        return 'bg-biolab-purple';
      case 'Krankheit':
        return 'bg-biolab-orange';
      case 'Abwesend':
        return 'bg-gray-300';
      default:
        return 'bg-biolab-green';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((day, index) => (
          <div
            key={index}
            className={`p-4 border-r border-b border-gray-200 cursor-pointer transition-all hover:bg-gray-50 ${
              selectedDay?.getDay() === day.getDay() ? 'bg-blue-50 border-l-4 border-blue-500' : ''
            } ${isToday(day) ? 'bg-yellow-50' : ''}`}
            onClick={() => onDaySelect(day)}
          >
            <div className="text-center">
              <div className={`inline-block px-2 py-1 rounded-full text-xs font-bold text-white mb-1 ${getStatusColor(getDayStatus(index))}`}>
                {format(day, 'EEE', { locale: de }).substring(0, 2)}
              </div>
              <div className={`font-semibold ${isToday(day) ? 'text-blue-600' : ''}`}>
                {format(day, 'd.M.', { locale: de })}
              </div>
              {isToday(day) && (
                <div className="text-xs text-blue-600 mt-1">Heute</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Calendar;