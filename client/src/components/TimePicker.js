import React, { useState, useRef, useEffect } from 'react';
import { Clock, X } from 'lucide-react';

const TimePicker = ({ value, onChange, label, disabled = false }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const pickerRef = useRef(null);

  useEffect(() => {
    if (value) {
      const parts = value.split(':');
      if (parts.length === 2) {
        setHour(parts[0].padStart(2, '0'));
        setMinute(parts[1].padStart(2, '0'));
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  const handleHourChange = (newHour) => {
    const h = String(newHour).padStart(2, '0');
    setHour(h);
    onChange(`${h}:${minute}`);
  };

  const handleMinuteChange = (newMinute) => {
    const m = String(newMinute).padStart(2, '0');
    setMinute(m);
    onChange(`${hour}:${m}`);
  };

  const handleClear = () => {
    setHour('08');
    setMinute('00');
    onChange('');
    setShowPicker(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="relative" ref={pickerRef}>
      <label className="block text-xs sm:text-sm text-gray-700 font-medium mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          readOnly
          onClick={() => !disabled && setShowPicker(!showPicker)}
          disabled={disabled}
          placeholder="--:--"
          className="w-full px-3 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed text-sm sm:text-base"
        />
        <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
      </div>

      {showPicker && (
        <div className="absolute z-50 mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-4 w-full sm:w-auto min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">Zeit auswählen</h3>
            <button
              onClick={() => setShowPicker(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Hours */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 text-center">Stunden</p>
              <div className="grid grid-cols-4 gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {hours.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHourChange(h)}
                    className={`px-2 py-1.5 rounded text-sm font-medium transition-all ${
                      String(h).padStart(2, '0') === hour
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-blue-100'
                    }`}>
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 text-center">Minuten</p>
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                {minutes.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMinuteChange(m)}
                    className={`px-2 py-1.5 rounded text-sm font-medium transition-all ${
                      String(m).padStart(2, '0') === minute
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-blue-100'
                    }`}>
                    {String(m).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm transition-all">
              Löschen
            </button>
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-all">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;
