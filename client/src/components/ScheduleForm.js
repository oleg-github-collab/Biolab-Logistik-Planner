import React, { useState, useEffect } from 'react';

const ScheduleForm = ({ dayData, onUpdate }) => {
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
    status: 'Arbeit'
  });

  useEffect(() => {
    if (dayData) {
      setFormData({
        startTime: dayData.startTime || '',
        endTime: dayData.endTime || '',
        status: dayData.status || 'Arbeit'
      });
    }
  }, [dayData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (dayData && dayData.dayOfWeek !== undefined) {
      onUpdate(dayData.dayOfWeek, formData.startTime, formData.endTime, formData.status);
    }
  };

  const timeOptions = [];
  for (let hour = 6; hour <= 20; hour++) {
    timeOptions.push(`${hour.toString().padStart(2, '0')}:00`);
  }

  const statusOptions = [
    { value: 'Arbeit', label: 'Arbeit', color: 'bg-biolab-green' },
    { value: 'Urlaub', label: 'Urlaub', color: 'bg-biolab-purple' },
    { value: 'Krankheit', label: 'Krankheit', color: 'bg-biolab-orange' },
    { value: 'Abwesend', label: 'Abwesend', color: 'bg-gray-300' }
  ];

  if (!dayData) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold mb-4 text-biolab-dark">
        {dayData.dayName}
      </h3>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Startzeit
            </label>
            <select
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
            >
              <option value="">-- Auswählen --</option>
              {timeOptions.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endzeit
            </label>
            <select
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
            >
              <option value="">-- Auswählen --</option>
              {timeOptions.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-biolab-blue hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Speichern
          </button>
        </div>
      </form>
      
      {/* Status legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Status Legende:</h4>
        <div className="flex flex-wrap gap-4">
          {statusOptions.map(option => (
            <div key={option.value} className="flex items-center">
              <div className={`w-4 h-4 rounded-full ${option.color} mr-2`}></div>
              <span className="text-sm">{option.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScheduleForm;