import React, { useState, useEffect, useRef } from 'react';
import { format, startOfDay, endOfDay, addHours, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const SmartTimeEntry = ({ onSave, initialData = null }) => {
  const auth = useAuth(); const user = auth?.user;
  const [mode, setMode] = useState('quick'); // quick, detailed, voice
  const [timeData, setTimeData] = useState({
    type: 'work', // work, break, overtime
    startTime: format(new Date(), 'HH:mm'),
    endTime: format(addHours(new Date(), 8), 'HH:mm'),
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    project: '',
    quickDuration: 8
  });

  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      // Налаштування для максимальної надійності
      recognitionRef.current.continuous = true; // Постійне прослуховування
      recognitionRef.current.interimResults = true; // Проміжні результати
      recognitionRef.current.lang = ''; // Автоматичне розпізнавання будь-якої мови
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const text = finalTranscript.trim();
          setVoiceText(text);
          translateToGerman(text);
        } else if (interimTranscript) {
          setVoiceText(interimTranscript);
        }
      };

      recognitionRef.current.onend = () => {
        // Автоматичний перезапуск якщо ще слухаємо
        if (isListeningRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error('Restart error:', err);
              setIsListening(false);
              isListeningRef.current = false;
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        // Ігноруємо помилку "no-speech" і автоматично перезапускаємо
        if (event.error === 'no-speech' && isListeningRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error('Restart after no-speech error:', err);
            }
          }, 100);
        }
        // Для інших помилок теж пробуємо перезапустити
        else if (isListeningRef.current && event.error !== 'aborted') {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (err) {
              console.error('Restart after error:', err);
              setIsListening(false);
              isListeningRef.current = false;
            }
          }, 500);
        }
      };
    }

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  // Translate and improve text to German using OpenAI
  const translateToGerman = async (text) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/kb/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      const germanText = data.translated;
      setTranslatedText(germanText);
      parseVoiceInput(germanText);
    } catch (error) {
      console.error('Translation error:', error);
      // Якщо переклад не вдався, використовуємо оригінальний текст
      setTranslatedText(text);
      parseVoiceInput(text);
    }
  };

  // Parse voice input
  const parseVoiceInput = (text) => {
    const lowerText = text.toLowerCase();

    // Extract time duration
    const durationMatch = lowerText.match(/(\d+)\s*(stunde|stunden|std)/i);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      setTimeData(prev => ({
        ...prev,
        quickDuration: hours,
        endTime: format(addHours(parseISO(`${prev.date}T${prev.startTime}`), hours), 'HH:mm')
      }));
    }

    // Extract project/description
    const descMatch = lowerText.match(/(projekt|aufgabe|beschreibung)[\s:]+(.+)/i);
    if (descMatch) {
      setTimeData(prev => ({
        ...prev,
        description: descMatch[2]
      }));
    }

    // Detect type
    if (lowerText.includes('pause')) {
      setTimeData(prev => ({ ...prev, type: 'break' }));
    } else if (lowerText.includes('überstunden')) {
      setTimeData(prev => ({ ...prev, type: 'overtime' }));
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Spracheingabe wird auf diesem Gerät nicht unterstützt');
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Stop error:', err);
      }
      setIsListening(false);
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Start error:', err);
        // Якщо вже запущено, спочатку зупиняємо
        if (err.name === 'InvalidStateError') {
          try {
            recognitionRef.current.stop();
            setTimeout(() => {
              recognitionRef.current.start();
            }, 100);
          } catch (retryErr) {
            console.error('Retry start error:', retryErr);
            setIsListening(false);
            isListeningRef.current = false;
          }
        }
      }
    }
  };

  // Quick duration buttons
  const QUICK_DURATIONS = [
    { hours: 4, label: '4h' },
    { hours: 6, label: '6h' },
    { hours: 8, label: '8h' },
    { hours: 10, label: '10h' },
    { hours: 12, label: '12h' }
  ];

  const setQuickDuration = (hours) => {
    const start = parseISO(`${timeData.date}T${timeData.startTime}`);
    const end = addHours(start, hours);

    setTimeData({
      ...timeData,
      quickDuration: hours,
      endTime: format(end, 'HH:mm')
    });
  };

  // Time templates
  const TIME_TEMPLATES = [
    {
      id: 'morning-shift',
      name: 'Frühschicht',
      icon: '🌅',
      startTime: '06:00',
      endTime: '14:00',
      type: 'work'
    },
    {
      id: 'day-shift',
      name: 'Tagschicht',
      icon: '☀️',
      startTime: '08:00',
      endTime: '16:00',
      type: 'work'
    },
    {
      id: 'late-shift',
      name: 'Spätschicht',
      icon: '🌆',
      startTime: '14:00',
      endTime: '22:00',
      type: 'work'
    },
    {
      id: 'night-shift',
      name: 'Nachtschicht',
      icon: '🌙',
      startTime: '22:00',
      endTime: '06:00',
      type: 'work'
    }
  ];

  const applyTemplate = (template) => {
    setTimeData({
      ...timeData,
      startTime: template.startTime,
      endTime: template.endTime,
      type: template.type
    });
  };

  const handleSave = () => {
    const dataToSave = {
      ...timeData,
      userId: user.id,
      createdAt: new Date().toISOString()
    };

    onSave(dataToSave);
  };

  return (
    <div className="space-y-4">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('quick')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
            mode === 'quick'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ⚡ Schnell
        </button>
        <button
          onClick={() => setMode('detailed')}
          className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
            mode === 'detailed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📝 Detailliert
        </button>
        {recognitionRef.current && (
          <button
            onClick={() => setMode('voice')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
              mode === 'voice'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🎤 Sprache
          </button>
        )}
      </div>

      {/* Voice Mode */}
      {mode === 'voice' && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
          <div className="text-center mb-4">
            <button
              onClick={toggleVoiceInput}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all shadow-lg ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white text-blue-600 hover:scale-105'
              }`}
            >
              🎤
            </button>
            <p className="mt-3 text-sm font-medium text-gray-700">
              {isListening ? 'Höre zu...' : 'Tippen zum Sprechen'}
            </p>
          </div>

          {voiceText && (
            <div className="bg-white rounded-lg p-3 mb-3">
              <p className="text-sm text-gray-600 mb-1">Erkannt:</p>
              <p className="text-gray-900 font-medium">{voiceText}</p>
              {translatedText && translatedText !== voiceText && (
                <>
                  <p className="text-sm text-blue-600 mb-1 mt-2">Übersetzt:</p>
                  <p className="text-blue-900 font-medium">{translatedText}</p>
                </>
              )}
            </div>
          )}

          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-medium">💡 Sprechen Sie in beliebiger Sprache - automatische Übersetzung & Verbesserung:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>🇩🇪 "8 Stunden gearbeitet"</li>
              <li>🇺🇦 "8 годин працював"</li>
              <li>🇬🇧 "worked 8 hours"</li>
              <li>🇵🇱 "pracowałem 8 godzin"</li>
            </ul>
            <p className="mt-2 text-xs italic text-blue-600">Text wird automatisch korrigiert und professionell formuliert.</p>
          </div>
        </div>
      )}

      {/* Quick Mode */}
      {mode === 'quick' && (
        <div className="space-y-4">
          {/* Time Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schicht-Vorlage
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="bg-white border-2 border-gray-200 rounded-lg p-3 text-left hover:border-blue-500 transition-colors active:scale-95"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{template.icon}</span>
                    <span className="font-medium text-sm">{template.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {template.startTime} - {template.endTime}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dauer
            </label>
            <div className="flex gap-2">
              {QUICK_DURATIONS.map(({ hours, label }) => (
                <button
                  key={hours}
                  onClick={() => setQuickDuration(hours)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    timeData.quickDuration === hours
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'work', label: 'Arbeit', icon: '💼', color: 'blue' },
                { value: 'break', label: 'Pause', icon: '☕', color: 'yellow' },
                { value: 'overtime', label: 'Überstd.', icon: '⏱️', color: 'purple' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setTimeData({ ...timeData, type: type.value })}
                  className={`py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-1 transition-all ${
                    timeData.type === type.value
                      ? `bg-${type.color}-600 text-white shadow-lg`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Mode */}
      {mode === 'detailed' && (
        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Datum
            </label>
            <input
              type="date"
              value={timeData.date}
              onChange={(e) => setTimeData({ ...timeData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Startzeit
            </label>
            <input
              type="time"
              value={timeData.startTime}
              onChange={(e) => setTimeData({ ...timeData, startTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endzeit
            </label>
            <input
              type="time"
              value={timeData.endTime}
              onChange={(e) => setTimeData({ ...timeData, endTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Projekt/Aufgabe
            </label>
            <input
              type="text"
              value={timeData.project}
              onChange={(e) => setTimeData({ ...timeData, project: e.target.value })}
              placeholder="z.B. Labor Analyse, Qualitätskontrolle"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Beschreibung (optional)
            </label>
            <textarea
              value={timeData.description}
              onChange={(e) => setTimeData({ ...timeData, description: e.target.value })}
              placeholder="Zusätzliche Details..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-900">Zusammenfassung</span>
          <span className="text-2xl font-bold text-blue-600">
            {(() => {
              const start = parseISO(`${timeData.date}T${timeData.startTime}`);
              const end = parseISO(`${timeData.date}T${timeData.endTime}`);
              const hours = (end - start) / (1000 * 60 * 60);
              return `${hours.toFixed(1)}h`;
            })()}
          </span>
        </div>
        <div className="text-xs text-blue-700 space-y-1">
          <div className="flex justify-between">
            <span>Start:</span>
            <span className="font-medium">{timeData.startTime}</span>
          </div>
          <div className="flex justify-between">
            <span>Ende:</span>
            <span className="font-medium">{timeData.endTime}</span>
          </div>
          <div className="flex justify-between">
            <span>Typ:</span>
            <span className="font-medium capitalize">{timeData.type}</span>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Zeit erfassen
      </button>
    </div>
  );
};

export default SmartTimeEntry;
