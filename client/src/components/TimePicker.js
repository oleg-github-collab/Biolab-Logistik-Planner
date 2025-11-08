import React, { useState, useRef, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

const TimePicker = ({ value, onChange, label, disabled = false }) => {
  const { isMobile } = useMobile();
  const [showPicker, setShowPicker] = useState(false);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const pickerRef = useRef(null);
  const hourScrollRef = useRef(null);
  const minuteScrollRef = useRef(null);

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
    if (!isMobile || !showPicker) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      if (hourScrollRef.current) {
        const hourIndex = parseInt(hour, 10);
        hourScrollRef.current.scrollTop = Number.isNaN(hourIndex) ? 0 : hourIndex * 56;
      }
      if (minuteScrollRef.current) {
        const parsedMinute = parseInt(minute, 10);
        const minuteIndex = Number.isNaN(parsedMinute) ? 0 : parsedMinute;
        minuteScrollRef.current.scrollTop = minuteIndex * 56;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, [showPicker, isMobile, hour, minute]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    };

    if (showPicker && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker, isMobile]);

  const handleHourChange = (newHour) => {
    const h = String(newHour).padStart(2, '0');
    setHour(h);
    if (!isMobile) {
      onChange(`${h}:${minute}`);
    }
  };

  const handleMinuteChange = (newMinute) => {
    const m = String(newMinute).padStart(2, '0');
    setMinute(m);
    if (!isMobile) {
      onChange(`${hour}:${m}`);
    }
  };

  const handleConfirm = () => {
    onChange(`${hour}:${minute}`);
    setShowPicker(false);
  };

  const handleClear = () => {
    setHour('08');
    setMinute('00');
    onChange('');
    setShowPicker(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  if (isMobile) {
    return (
      <>
        <div className="relative">
          <label className="block text-xs sm:text-sm text-gray-700 font-medium mb-1">
            {label}
          </label>
          <div className="relative">
            <input
              type="text"
              value={value || ''}
              readOnly
              onClick={() => !disabled && setShowPicker(true)}
              disabled={disabled}
              placeholder="--:--"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 transition-all cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed text-base font-medium"
            />
            <Clock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {showPicker && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
              onClick={() => setShowPicker(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[70] pb-safe">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-red-600 font-semibold text-base px-3 py-2 rounded-lg active:bg-red-50 transition-colors"
                >
                  Loschen
                </button>
                <h3 className="text-lg font-bold text-gray-900">Zeit auswahlen</h3>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="text-blue-600 font-semibold text-base px-3 py-2 rounded-lg active:bg-blue-50 transition-colors"
                >
                  OK
                </button>
              </div>

              <div className="flex items-center justify-center p-6 gap-4">
                <div className="relative">
                  <div
                    ref={hourScrollRef}
                    className="h-56 w-20 overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        onClick={() => handleHourChange(h)}
                        className={`h-14 flex items-center justify-center text-2xl font-bold cursor-pointer snap-center transition-all ${
                          String(h).padStart(2, '0') === hour
                            ? 'text-blue-600 scale-125'
                            : 'text-gray-400'
                        }`}
                      >
                        {String(h).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-14 -translate-y-1/2 border-y-2 border-blue-300 pointer-events-none rounded-lg" />
                </div>

                <div className="text-3xl font-bold text-gray-600">:</div>

                <div className="relative">
                  <div
                    ref={minuteScrollRef}
                    className="h-56 w-20 overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
                  >
                    {minutes.map((m) => (
                      <div
                        key={m}
                        onClick={() => handleMinuteChange(m)}
                        className={`h-14 flex items-center justify-center text-2xl font-bold cursor-pointer snap-center transition-all ${
                          String(m).padStart(2, '0') === minute
                            ? 'text-blue-600 scale-125'
                            : 'text-gray-400'
                        }`}
                      >
                        {String(m).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-1/2 left-0 right-0 h-14 -translate-y-1/2 border-y-2 border-blue-300 pointer-events-none rounded-lg" />
                </div>
              </div>

              <div className="h-8" />
            </div>
          </>
        )}

        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .pb-safe {
            padding-bottom: env(safe-area-inset-bottom);
          }
        `}</style>
      </>
    );
  }

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
            <h3 className="font-bold text-gray-900">Zeit auswahlen</h3>
            <button
              onClick={() => setShowPicker(false)}
              className="p-1 hover:bg-gray-100 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
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
              Loschen
            </button>
            <button
              type="button"
              onClick={handleConfirm}
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
