import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { format } from 'date-fns';
import { Paperclip, Mic, StopCircle, Trash2, Loader2 } from 'lucide-react';
import { uploadAttachment } from '../utils/apiEnhanced';
import { showError } from '../utils/toast';

const normalizeAttachmentList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};

// ✅ OPTIMIZED: Main EventModal component wrapped with memo to prevent unnecessary re-renders
const EventModal = memo(({ isOpen, onClose, onSave, selectedDate, event = null, mode = 'create' }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    start_time: '08:00',
    end_time: '17:00',
    all_day: false,
    type: 'Arbeit',
    priority: 'medium',
    location: '',
    attendees: [],
    reminder: 15,
    status: 'confirmed',
    category: 'work',
    notes: '',
    recurring: false,
    recurring_pattern: 'weekly',
    recurring_end: ''
  });

  const [errors, setErrors] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && event) {
        setFormData({
          title: event.title || '',
          description: event.description || '',
          start_date: event.start_date || format(selectedDate || new Date(), 'yyyy-MM-dd'),
          end_date: event.end_date || format(selectedDate || new Date(), 'yyyy-MM-dd'),
          start_time: event.start_time || '08:00',
          end_time: event.end_time || '17:00',
          all_day: Boolean(event.all_day),
          type: event.type || 'Arbeit',
          priority: event.priority || 'medium',
          location: event.location || '',
          attendees: Array.isArray(event.attendees) ? event.attendees : [],
          reminder: event.reminder ?? 15,
          status: event.status || 'confirmed',
          category: event.category || 'work',
          notes: event.notes || '',
          recurring: Boolean(event.recurring),
          recurring_pattern: event.recurring_pattern || 'weekly',
          recurring_end: event.recurring_end || ''
        });
      } else {
        const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        setFormData({
          title: '',
          description: '',
          start_date: dateStr,
          end_date: dateStr,
          start_time: '08:00',
          end_time: '17:00',
          all_day: false,
          type: 'Arbeit',
          priority: 'medium',
          location: '',
          attendees: [],
          reminder: 15,
          status: 'confirmed',
          category: 'work',
          notes: '',
          recurring: false,
          recurring_pattern: 'weekly',
          recurring_end: ''
        });
      }
      setErrors({});
      setAttachments(mode === 'edit' ? normalizeAttachmentList(event?.attachments) : []);
    } else {
      setAttachments([]);
      setErrors({});
    }
  }, [isOpen, selectedDate, event, mode]);

  // ✅ OPTIMIZED: useCallback to memoize input handlers
  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []);

  const handleAttendeesChange = useCallback((e) => {
    const value = e.target.value;
    const attendees = value.split(',').map(email => email.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, attendees }));
  }, []);

  const uploadEventAttachment = useCallback(async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'calendar');
    if (event?.id) {
      formData.append('eventId', String(event.id));
    }

    try {
      setUploadingAttachment(true);
      const response = await uploadAttachment(formData);
      return response.data;
    } catch (error) {
      console.error('Attachment upload failed', error);
      showError('Anhang konnte nicht hochgeladen werden.');
      return null;
    } finally {
      setUploadingAttachment(false);
    }
  }, [event?.id]);

  const handleAttachmentUpload = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    for (const file of files) {
      const metadata = await uploadEventAttachment(file);
      if (metadata) {
        setAttachments((prev) => [...prev, metadata]);
      }
    }
  }, [uploadEventAttachment]);

  const handleFileInputChange = useCallback((event) => {
    const files = event.target.files;
    if (files && files.length) {
      handleAttachmentUpload(files).catch(() => undefined);
    }
    event.target.value = '';
  }, [handleAttachmentUpload]);

  const removeAttachment = useCallback((attachmentKey) => {
    setAttachments((prev) => prev.filter((attachment) => (attachment.id ?? attachment.url) !== attachmentKey));
  }, []);

  const formattedRecordingTime = useMemo(() => {
    const minutes = String(Math.floor(recordingTime / 60)).padStart(2, '0');
    const seconds = String(recordingTime % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [recordingTime]);

  const resetRecordingState = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    recordingChunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      resetRecordingState();
    }
  }, [resetRecordingState]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Audio-Aufnahme wird von diesem Browser nicht unterstützt.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `event-voice-${Date.now()}.webm`, { type: 'audio/webm' });
          const metadata = await uploadEventAttachment(file);
          if (metadata) {
            setAttachments((prev) => [...prev, metadata]);
          }
        } catch (error) {
          console.error('Voice note upload failed', error);
          showError('Sprachaufnahme konnte nicht gespeichert werden.');
        } finally {
          resetRecordingState();
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Unable to start recording', error);
      showError('Aufnahme konnte nicht gestartet werden.');
      resetRecordingState();
    }
  }, [resetRecordingState, uploadEventAttachment]);

  useEffect(() => () => {
    resetRecordingState();
  }, [resetRecordingState]);

  // ✅ OPTIMIZED: useCallback for validation and submit
  const validateForm = useCallback(() => {
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
      newErrors.end_date = 'Enddatum muss nach Startdatum liegen';
    }

    if (!formData.all_day) {
      if (!formData.start_time) {
        newErrors.start_time = 'Startzeit ist erforderlich';
      }
      if (!formData.end_time) {
        newErrors.end_time = 'Endzeit ist erforderlich';
      }
      if (formData.start_date === formData.end_date && formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
        newErrors.end_time = 'Endzeit muss nach Startzeit liegen';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (validateForm()) {
      const eventData = {
        ...formData,
        id: event?.id,
        attachments
      };
      onSave(eventData);
    }
  }, [formData, event?.id, attachments, onSave, validateForm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex flex-1 items-center justify-center p-0 sm:p-6">
        <div className="bg-white w-full h-full overflow-y-auto sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 border-b border-slate-100">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {mode === 'edit' ? 'Termin bearbeiten' : 'Neuen Termin erstellen'}
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

          <form onSubmit={handleSubmit} className="px-4 py-6 sm:px-6 sm:py-6 space-y-6">
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
                placeholder="Termin Titel eingeben..."
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Beschreibung
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Details..."
              />
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Anhänge
                </label>
                {uploadingAttachment && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Wird hochgeladen...
                  </span>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id || attachment.url} className="relative">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name || 'Anhang'}
                          className="h-24 w-24 rounded-xl object-cover border border-gray-200"
                        />
                      ) : attachment.type === 'audio' ? (
                        <div className="flex w-60 flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          <span className="font-semibold text-gray-600">{attachment.name || 'Audio'}</span>
                          <audio controls src={attachment.url} className="w-full" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          <Paperclip className="w-3 h-3" />
                          <span>{attachment.name || 'Datei'}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id || attachment.url)}
                        className="absolute -top-2 -right-2 rounded-full bg-rose-600 p-1 text-white shadow hover:bg-rose-500"
                        aria-label="Anhang entfernen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {isRecording && (
                <div className="mb-2 flex items-center gap-2 text-sm text-rose-600">
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  <span>Aufnahme läuft · {formattedRecordingTime}</span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                  >
                    <StopCircle className="w-4 h-4" />
                    Aufnahme stoppen
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Paperclip className="w-4 h-4" />
                  Datei anhängen
                </button>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    isRecording ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isRecording ? 'Aufnahme stoppen' : 'Sprachmemo aufnehmen'}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,audio/*"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Startdatum *
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
                  Enddatum *
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

            {/* All Day Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="all_day"
                id="all_day"
                checked={formData.all_day}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="all_day" className="ml-2 text-sm font-medium text-gray-700">
                Ganztägig
              </label>
            </div>

            {/* Time Fields */}
            {!formData.all_day && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Startzeit *
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.start_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.start_time && <p className="text-red-500 text-sm mt-1">{errors.start_time}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endzeit *
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.end_time ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.end_time && <p className="text-red-500 text-sm mt-1">{errors.end_time}</p>}
                </div>
              </div>
            )}

            {/* Type and Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Typ
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Arbeit">Arbeit</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Urlaub">Urlaub</option>
                  <option value="Krankheit">Krankheit</option>
                  <option value="Training">Training</option>
                  <option value="Projekt">Projekt</option>
                  <option value="Termin">Termin</option>
                  <option value="Deadline">Deadline</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorität
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Normal</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ort
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ort des Termins..."
              />
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teilnehmer (E-Mail Adressen, durch Komma getrennt)
              </label>
              <input
                type="text"
                value={formData.attendees.join(', ')}
                onChange={handleAttendeesChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="beispiel@email.com, andere@email.com"
              />
            </div>

            {/* Reminder */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Erinnerung (Minuten vorher)
              </label>
              <select
                name="reminder"
                value={formData.reminder}
                onChange={handleInputChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={0}>Keine</option>
                <option value={5}>5 Minuten</option>
                <option value={15}>15 Minuten</option>
                <option value={30}>30 Minuten</option>
                <option value={60}>1 Stunde</option>
                <option value={1440}>1 Tag</option>
              </select>
            </div>

            {/* Recurring Event */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  name="recurring"
                  id="recurring"
                  checked={formData.recurring}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="recurring" className="ml-2 text-sm font-medium text-gray-700">
                  Wiederholender Termin
                </label>
              </div>

              {formData.recurring && (
                <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wiederholungsmuster
                    </label>
                    <select
                      name="recurring_pattern"
                      value={formData.recurring_pattern}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="daily">Täglich</option>
                      <option value="weekly">Wöchentlich</option>
                      <option value="biweekly">Alle 2 Wochen</option>
                      <option value="monthly">Monatlich</option>
                      <option value="yearly">Jährlich</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wiederholung endet am (optional)
                    </label>
                    <input
                      type="date"
                      name="recurring_end"
                      value={formData.recurring_end}
                      onChange={handleInputChange}
                      min={formData.start_date}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leer lassen für unbegrenzte Wiederholung
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notizen
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Zusätzliche Notizen..."
              />
            </div>

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
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {mode === 'edit' ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});

EventModal.displayName = 'EventModal';

export default EventModal;
