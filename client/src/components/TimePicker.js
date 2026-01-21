import React, { useState, useRef, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { useMobile } from '../hooks/useMobile';

const TimePicker = ({ value, onChange, label, disabled = false }) => {
  const { isMobile } = useMobile();
  const [showPicker, setShowPicker] = useState(false);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const [pickerStyles, setPickerStyles] = useState(null);
  const scrollPositionRef = useRef(0);
  const bodyStyleRef = useRef({
    overflow: '',
    position: '',
    top: '',
    width: ''
  });

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

    scrollPositionRef.current = window.scrollY || window.pageYOffset || 0;
    bodyStyleRef.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width
    };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = bodyStyleRef.current.overflow;
      document.body.style.position = bodyStyleRef.current.position;
      document.body.style.top = bodyStyleRef.current.top;
      document.body.style.width = bodyStyleRef.current.width;
      window.scrollTo(0, scrollPositionRef.current);
    };
  }, [showPicker, isMobile]);

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
  const quickMinuteOptions = ['00', '15', '30', '45'];

  const formatTwoDigits = (value) => String(value).padStart(2, '0');

  const adjustHour = (delta) => {
    const current = parseInt(hour, 10) || 0;
    const next = (current + delta + 24) % 24;
    setHour(formatTwoDigits(next));
  };

  const adjustMinute = (delta) => {
    const current = parseInt(minute, 10) || 0;
    const next = (current + delta + 60) % 60;
    setMinute(formatTwoDigits(next));
  };

  const setMinuteDirect = (value) => {
    const next = Math.min(Math.max(parseInt(value, 10) || 0, 0), 59);
    setMinute(formatTwoDigits(next));
  };

  const setHourDirect = (value) => {
    const next = Math.min(Math.max(parseInt(value, 10) || 0, 0), 23);
    setHour(formatTwoDigits(next));
  };

  const updatePickerPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const minWidth = 280;
    const estimatedHeight = 360;
    const viewportPadding = 12;
    const width = Math.max(rect.width, minWidth);
    const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
    const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const top = spaceBelow < estimatedHeight && spaceAbove > spaceBelow
      ? Math.max(viewportPadding, rect.top - estimatedHeight - 8)
      : Math.min(rect.bottom + 8, window.innerHeight - estimatedHeight - viewportPadding);
    setPickerStyles({
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`
    });
  };

  useEffect(() => {
    if (!showPicker || isMobile) {
      return undefined;
    }

    updatePickerPosition();

    const handleScroll = () => updatePickerPosition();
    const handleResize = () => updatePickerPosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile, showPicker]);

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
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setShowPicker(false)}
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
              <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl pb-safe">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-red-600 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-red-50 transition"
                  >
                    Löschen
                  </button>
                  <h3 className="text-base font-semibold text-gray-900">Zeit wählen</h3>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="text-blue-600 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-blue-50 transition"
                  >
                    OK
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stunden</p>
                      <div className="rounded-2xl bg-slate-100 p-3 flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjustHour(1)}
                          className="w-12 h-12 rounded-full bg-white shadow hover:bg-slate-50 active:scale-95 text-2xl font-semibold text-slate-700"
                        >
                          +
                        </button>
                        <input
                          type="number"
                          value={hour}
                          onChange={(e) => setHourDirect(e.target.value)}
                          min="0"
                          max="23"
                          inputMode="numeric"
                          className="w-16 text-center text-4xl font-semibold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => adjustHour(-1)}
                          className="w-12 h-12 rounded-full bg-white shadow hover:bg-slate-50 active:scale-95 text-2xl font-semibold text-slate-700"
                        >
                          −
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-center">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Minuten</p>
                      <div className="rounded-2xl bg-slate-100 p-3 flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjustMinute(1)}
                          className="w-12 h-12 rounded-full bg-white shadow hover:bg-slate-50 active:scale-95 text-2xl font-semibold text-slate-700"
                        >
                          +
                        </button>
                        <input
                          type="number"
                          value={minute}
                          onChange={(e) => setMinuteDirect(e.target.value)}
                          min="0"
                          max="59"
                          inputMode="numeric"
                          className="w-16 text-center text-4xl font-semibold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => adjustMinute(-1)}
                          className="w-12 h-12 rounded-full bg-white shadow hover:bg-slate-50 active:scale-95 text-2xl font-semibold text-slate-700"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-center">
                    {quickMinuteOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMinuteDirect(value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                          minute === value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        :{value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
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
      <div className="relative" ref={inputRef}>
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
        <div
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border-2 border-gray-200 p-4 w-full sm:w-auto"
          style={pickerStyles || { visibility: 'hidden' }}
        >
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
