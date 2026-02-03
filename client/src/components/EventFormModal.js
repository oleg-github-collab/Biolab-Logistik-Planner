import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { X, Calendar, Clock, MapPin, Users, Image, Mic, AlertCircle, Repeat } from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';
import toast from 'react-hot-toast';
import { uploadAttachment } from '../utils/apiEnhanced';
import BaseModal from './BaseModal';

const EVENT_TYPES = [
  { value: 'Arbeit', label: 'Arbeit', color: '#0EA5E9' },
  { value: 'Meeting', label: 'Meeting', color: '#6366F1' },
  { value: 'Urlaub', label: 'Urlaub', color: '#F97316' },
  { value: 'Krankheit', label: 'Krankheit', color: '#EF4444' },
  { value: 'Training', label: 'Training', color: '#10B981' },
  { value: 'Projekt', label: 'Projekt', color: '#8B5CF6' },
  { value: 'Termin', label: 'Termin', color: '#06B6D4' },
  { value: 'Deadline', label: 'Deadline', color: '#DC2626' },
  { value: 'Personal', label: 'Personal', color: '#84CC16' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig', color: '#10B981', icon: '🟢' },
  { value: 'medium', label: 'Mittel', color: '#F59E0B', icon: '🟡' },
  { value: 'high', label: 'Hoch', color: '#EF4444', icon: '🔴' },
];

const RECURRENCE_PATTERNS = [
  { value: 'daily', label: 'Täglich' },
  { value: 'weekly', label: 'Wöchentlich' },
  { value: 'biweekly', label: 'Alle 2 Wochen' },
  { value: 'monthly', label: 'Monatlich' },
  { value: 'yearly', label: 'Jährlich' },
];

const toDateInstance = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatAsDateInput = (value) => {
  const date = toDateInstance(value);
  return date ? format(date, 'yyyy-MM-dd') : '';
};

const formatAsTimeInput = (value) => {
  const date = toDateInstance(value);
  return date ? format(date, 'HH:mm') : '';
};

const ensureTimeString = (value) => {
  if (!value) return '00:00';
  const [hour = '00', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
};

const combineDateAndTime = (dateValue, timeValue, allDay, fallbackDate = null) => {
  const dateString = dateValue || formatAsDateInput(fallbackDate);
  if (!dateString) return null;
  const normalizedDate = formatAsDateInput(dateString);
  const normalizedTime = allDay ? '00:00' : ensureTimeString(timeValue || formatAsTimeInput(fallbackDate));
  return toDateInstance(`${normalizedDate}T${normalizedTime}:00`);
};

/**
 * EventFormModal Component
 * A comprehensive form for creating and editing calendar events
 *
 * @param {Boolean} isOpen - Modal open state
 * @param {Function} onClose - Callback when modal closes
 * @param {Function} onSave - Callback when form is saved
 * @param {Object} event - Event data for editing (null for new event)
 * @param {Date} selectedDate - Pre-selected date for new events
 * @param {String} mode - Form mode: 'create' or 'edit'
 */
const EventFormModal = ({
  isOpen,
  onClose,
  onSave,
  event = null,
  selectedDate = new Date(),
  mode = 'create'
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: format(selectedDate, 'yyyy-MM-dd'),
    end_date: format(selectedDate, 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '17:00',
    start: toDateInstance(selectedDate),
    end: toDateInstance(selectedDate) ? new Date(new Date(selectedDate).getTime() + 60 * 60 * 1000) : null,
    all_day: false,
    type: 'Arbeit',
    priority: 'medium',
    location: '',
    attendees: [],
    reminder: 15,
    notes: '',
    recurring: false,
    recurring_pattern: 'weekly',
    recurring_end: '',
    audio_url: null,
    attachments: [],
  });

  const [errors, setErrors] = useState({});
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showRecurringOptions, setShowRecurringOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [imagePreview, setImagePreview] = useState([]);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [uploadQueue, setUploadQueue] = useState([]);

  const addUploadItem = useCallback((item) => {
    setUploadQueue((prev) => [...prev, item]);
  }, []);

  const updateUploadItem = useCallback((id, patch) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const removeUploadItem = useCallback((id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scheduleUploadCleanup = useCallback((id) => {
    setTimeout(() => removeUploadItem(id), 1400);
  }, [removeUploadItem]);

  // Initialize form data when event changes
  useEffect(() => {
    if (event && mode === 'edit') {
      const normalizedStart = event.start || event.start_date;
      const normalizedEnd = event.end || event.end_date;
      const normalizedStartDate = formatAsDateInput(normalizedStart);
      const normalizedEndDate = formatAsDateInput(normalizedEnd);
      const normalizedStartTime = event.all_day ? '' : formatAsTimeInput(normalizedStart);
      const normalizedEndTime = event.all_day ? '' : formatAsTimeInput(normalizedEnd);
      const normalizedRecurringEnd = formatAsDateInput(event.recurring_end);
      setFormData({
        ...event,
        start: toDateInstance(normalizedStart),
        end: toDateInstance(normalizedEnd),
        attendees: Array.isArray(event.attendees) ? event.attendees : [],
        attachments: Array.isArray(event.attachments) ? event.attachments : [],
        start_date: normalizedStartDate || '',
        end_date: normalizedEndDate || '',
        start_time: normalizedStartTime || '',
        end_time: normalizedEndTime || '',
        recurring_end: normalizedRecurringEnd || '',
      });
      setShowRecurringOptions(Boolean(event.recurring));
      setAudioPreviewUrl(null);
      setAudioError('');
      setIsUploadingAudio(false);

      // Load image previews
      if (event.attachments && Array.isArray(event.attachments)) {
        const images = event.attachments.filter(att =>
          att.type === 'image' || (att.url && att.url.match(/\.(jpg|jpeg|png|gif)$/i))
        );
        setImagePreview(images);
      }
    } else {
      // Reset form for new event
      const defaultStart = toDateInstance(selectedDate) || new Date();
      const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
      setFormData({
        title: '',
        description: '',
        start_date: formatAsDateInput(defaultStart) || format(selectedDate, 'yyyy-MM-dd'),
        end_date: formatAsDateInput(defaultEnd),
        start_time: formatAsTimeInput(defaultStart) || '09:00',
        end_time: formatAsTimeInput(defaultEnd) || '17:00',
        start: defaultStart,
        end: defaultEnd,
        all_day: false,
        type: 'Arbeit',
        priority: 'medium',
        location: '',
        attendees: [],
        reminder: 15,
        notes: '',
        recurring: false,
        recurring_pattern: 'weekly',
        recurring_end: '',
        audio_url: null,
        attachments: [],
      });
      setShowRecurringOptions(false);
      setImagePreview([]);
    }
  }, [event, mode, selectedDate]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  // Handle form field changes
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  }, [errors]);

  const appendAttachment = useCallback((attachment) => {
    setFormData((prevForm) => ({
      ...prevForm,
      attachments: [...(prevForm.attachments || []), attachment]
    }));
  }, []);

  const removeAttachmentByUrl = useCallback((url) => {
    if (!url) return;
    setFormData((prevForm) => ({
      ...prevForm,
      attachments: (prevForm.attachments || []).filter((item) => item.url !== url)
    }));
  }, []);

  // Add attendee
  const handleAddAttendee = useCallback(() => {
    const email = attendeeInput.trim();
    if (email && email.includes('@')) {
      if (!formData.attendees.includes(email)) {
        handleChange('attendees', [...formData.attendees, email]);
        setAttendeeInput('');
      }
    }
  }, [attendeeInput, formData.attendees, handleChange]);

  // Remove attendee
  const handleRemoveAttendee = useCallback((emailToRemove) => {
    handleChange('attendees', formData.attendees.filter(email => email !== emailToRemove));
  }, [formData.attendees, handleChange]);

  // Handle audio recording complete
  const handleAudioRecording = useCallback(async (audioBlob) => {
    if (!audioBlob) return;
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }

    const previewUrl = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(previewUrl);
    setShowAudioRecorder(false);
    setIsUploadingAudio(true);
    setAudioError('');

    const uploadForm = new FormData();
    uploadForm.append('file', audioBlob, `event-audio-${Date.now()}.webm`);
    uploadForm.append('context', 'calendar');
    const uploadId = `audio-${Date.now()}`;
    addUploadItem({ id: uploadId, name: 'Audioaufnahme', progress: 0, status: 'uploading' });

    try {
      const response = await uploadAttachment(uploadForm, {
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const progress = Math.min(
            100,
            Math.round((progressEvent.loaded / progressEvent.total) * 100)
          );
          updateUploadItem(uploadId, { progress });
        }
      });
      const uploaded = response.data;
      appendAttachment(uploaded);
      handleChange('audio_url', uploaded.url);
      toast.success('Audio-Anweisung hinzugefügt');
      updateUploadItem(uploadId, { progress: 100, status: 'done' });
      scheduleUploadCleanup(uploadId);
    } catch (error) {
      console.error('Error uploading audio attachment', error);
      setAudioError('Audio konnte nicht hochgeladen werden');
      toast.error('Audio konnte nicht hochgeladen werden');
      updateUploadItem(uploadId, { status: 'error' });
      scheduleUploadCleanup(uploadId);
    } finally {
      setIsUploadingAudio(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setAudioPreviewUrl(null);
    }
  }, [appendAttachment, audioPreviewUrl, handleChange, uploadAttachment]);

  // Handle photo upload
  const handlePhotoUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const previews = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        continue;
      }

      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('Bild zu groß (max. 20MB)');
        continue;
      }

      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('context', 'calendar');
      const uploadId = `photo-${file.name}-${file.lastModified}`;
      addUploadItem({ id: uploadId, name: file.name, progress: 0, status: 'uploading' });

      try {
        const response = await uploadAttachment(formDataUpload, {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            const progress = Math.min(
              100,
              Math.round((progressEvent.loaded / progressEvent.total) * 100)
            );
            updateUploadItem(uploadId, { progress });
          }
        });
        const uploaded = response.data;
        appendAttachment(uploaded);
        previews.push(uploaded);
        updateUploadItem(uploadId, { progress: 100, status: 'done' });
        scheduleUploadCleanup(uploadId);
      } catch (error) {
        console.error('Error uploading photo attachment', error);
        toast.error('Foto konnte nicht hochgeladen werden');
        updateUploadItem(uploadId, { status: 'error' });
        scheduleUploadCleanup(uploadId);
      }
    }

    if (previews.length) {
      setImagePreview((prev) => [...prev, ...previews]);
    }
    if (event.target) {
      event.target.value = '';
    }
  }, [appendAttachment]);

  // Remove photo
  const handleRemovePhoto = useCallback((index) => {
    setImagePreview((prev) => {
      const removed = prev[index];
      if (removed?.url) {
        removeAttachmentByUrl(removed.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, [removeAttachmentByUrl]);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.title || formData.title.trim() === '') {
      newErrors.title = 'Titel ist erforderlich';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Startdatum ist erforderlich';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Enddatum ist erforderlich';
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (endDate < startDate) {
        newErrors.end_date = 'Enddatum muss nach Startdatum liegen';
      }
    }

    if (!formData.all_day) {
      if (formData.start_date === formData.end_date) {
        const [startHour, startMin] = formData.start_time.split(':').map(Number);
        const [endHour, endMin] = formData.end_time.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          newErrors.end_time = 'Endzeit muss nach Startzeit liegen';
        }
      }
    }

    if (formData.recurring && !formData.recurring_end) {
      newErrors.recurring_end = 'Wiederholungsende ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const normalizedStart = combineDateAndTime(
      formData.start_date,
      formData.start_time,
      formData.all_day,
      formData.start
    );
    const normalizedEnd = combineDateAndTime(
      formData.end_date || formData.start_date,
      formData.end_time,
      formData.all_day,
      formData.end || normalizedStart
    ) || normalizedStart;

    setIsSubmitting(true);

    try {
      await onSave({
        ...formData,
        start: normalizedStart,
        end: normalizedEnd,
        start_date: formatAsDateInput(normalizedStart) || formData.start_date,
        end_date: formatAsDateInput(normalizedEnd) || formData.end_date || formData.start_date,
        start_time: formData.all_day ? '' : formatAsTimeInput(normalizedStart) || formData.start_time,
        end_time: formData.all_day ? '' : formatAsTimeInput(normalizedEnd) || formData.end_time,
      });
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
      setErrors({ submit: 'Fehler beim Speichern des Termins' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, onSave, onClose]);

  const playbackAudioUrl = formData.audio_url || audioPreviewUrl;

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="modal-backdrop-mobile backdrop-blur-sm"
      dialogClassName="modal-bottom-sheet bg-white sm:modal sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl border border-slate-200"
    >
      {/* Header */}
      <div className="modal-header-mobile sm:sticky sm:top-0 sm:bg-white sm:border-b sm:border-gray-200 sm:px-6 sm:py-4 sm:rounded-t-2xl flex items-center justify-between z-10 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'edit' ? 'Termin bearbeiten' : 'Neuer Termin'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Schließen"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

      {/* Form */}
      <form id="event-form" onSubmit={handleSubmit} className="modal-body-mobile sm:p-6 sm:space-y-6 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="z.B. Team Meeting"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Typ
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleChange('type', type.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.type === type.value
                      ? 'ring-2 ring-offset-2'
                      : 'hover:bg-gray-100'
                  }`}
                  style={{
                    backgroundColor: formData.type === type.value ? type.color : '#f3f4f6',
                    color: formData.type === type.value ? 'white' : '#374151',
                    ringColor: type.color
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Startdatum *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.start_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600">{errors.start_date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Enddatum *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.end_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.end_date && (
                <p className="mt-1 text-sm text-red-600">{errors.end_date}</p>
              )}
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="all_day"
              checked={formData.all_day}
              onChange={(e) => handleChange('all_day', e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="all_day" className="text-sm font-medium text-gray-700">
              Ganztägig
            </label>
          </div>

          {/* Time fields (only if not all day) */}
          {!formData.all_day && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Startzeit
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleChange('start_time', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Endzeit
                </label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleChange('end_time', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.end_time ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.end_time && (
                  <p className="mt-1 text-sm text-red-600">{errors.end_time}</p>
                )}
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priorität
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => handleChange('priority', priority.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    formData.priority === priority.value
                      ? 'ring-2 ring-offset-2'
                      : 'hover:bg-gray-100'
                  }`}
                  style={{
                    backgroundColor: formData.priority === priority.value ? priority.color + '20' : '#f3f4f6',
                    color: formData.priority === priority.value ? priority.color : '#374151',
                    ringColor: priority.color
                  }}
                >
                  <span>{priority.icon}</span>
                  <span>{priority.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ort
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="z.B. Konferenzraum A"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Teilnehmer
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttendee();
                  }
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="E-Mail-Adresse hinzufügen"
              />
              <button
                type="button"
                onClick={handleAddAttendee}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Hinzufügen
              </button>
            </div>

            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.attendees.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttendee(email)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Beschreibung
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[80px]"
              placeholder="Weitere Details zum Termin..."
            />
          </div>


          {/* Audio Recording */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Audio-Anweisung
            </label>

            {!showAudioRecorder && !playbackAudioUrl && !isUploadingAudio && (
              <button
                type="button"
                onClick={() => setShowAudioRecorder(true)}
                className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors w-full text-gray-600 hover:text-blue-600 font-medium flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                Audio aufnehmen
              </button>
            )}

            {showAudioRecorder && (
              <div>
                <VoiceRecorder
                  onRecordingComplete={handleAudioRecording}
                  existingAudioUrl={playbackAudioUrl}
                />
                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(false)}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Abbrechen
                </button>
              </div>
            )}

            {playbackAudioUrl && !showAudioRecorder && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex-1">
                  <audio controls src={playbackAudioUrl} className="w-full" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentUrl = formData.audio_url;
                    handleChange('audio_url', null);
                    removeAttachmentByUrl(currentUrl);
                    if (audioPreviewUrl) {
                      URL.revokeObjectURL(audioPreviewUrl);
                      setAudioPreviewUrl(null);
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                  title="Audio löschen"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {isUploadingAudio && (
              <p className="text-sm text-gray-500 mt-2">Audio wird hochgeladen...</p>
            )}

            {audioError && (
              <p className="text-sm text-red-600 mt-2">{audioError}</p>
            )}

            {uploadQueue.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Uploads
                </p>
                <div className="upload-progress">
                  {uploadQueue.map((item) => (
                    <div key={item.id} className={`upload-progress__item ${item.status || ''}`}>
                      <div className="upload-progress__meta">
                        <span className="upload-progress__name">{item.name}</span>
                        <span className="upload-progress__percent">{item.progress}%</span>
                      </div>
                      <div className="upload-progress__bar">
                        <span className="upload-progress__fill" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Fotos
            </label>

            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />

            <label
              htmlFor="photo-upload"
              className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors w-full text-gray-600 hover:text-blue-600 font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Image className="w-5 h-5" />
              Fotos hinzufügen
            </label>

            {imagePreview.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {imagePreview.map((image, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurring Options */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.recurring}
                onChange={(e) => {
                  handleChange('recurring', e.target.checked);
                  setShowRecurringOptions(e.target.checked);
                }}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="recurring" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Wiederholender Termin
              </label>
            </div>

            {showRecurringOptions && (
              <div className="ml-8 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wiederholung
                  </label>
                  <select
                    value={formData.recurring_pattern}
                    onChange={(e) => handleChange('recurring_pattern', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {RECURRENCE_PATTERNS.map((pattern) => (
                      <option key={pattern.value} value={pattern.value}>
                        {pattern.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endet am *
                  </label>
                  <input
                    type="date"
                    value={formData.recurring_end}
                    onChange={(e) => handleChange('recurring_end', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.recurring_end ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.recurring_end && (
                    <p className="mt-1 text-sm text-red-600">{errors.recurring_end}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Erinnerung
            </label>
            <select
              value={formData.reminder}
              onChange={(e) => handleChange('reminder', Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>Keine Erinnerung</option>
              <option value={5}>5 Minuten vorher</option>
              <option value={15}>15 Minuten vorher</option>
              <option value={30}>30 Minuten vorher</option>
              <option value={60}>1 Stunde vorher</option>
              <option value={120}>2 Stunden vorher</option>
              <option value={1440}>1 Tag vorher</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notizen
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[60px]"
              placeholder="Private Notizen..."
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                {errors.submit}
              </p>
            </div>
          )}

      </form>

      {/* Actions - Footer fixed at bottom */}
      <div className="modal-footer-mobile sm:flex sm:gap-3 sm:p-6 sm:border-t sm:border-gray-200 sm:bg-gray-50 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="btn-mobile btn-secondary sm:flex-1 sm:px-6 sm:py-3 sm:border-2 sm:border-gray-300 sm:text-gray-700 sm:rounded-xl sm:font-semibold sm:hover:bg-gray-50 transition-colors"
          disabled={isSubmitting}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          form="event-form"
          className="btn-mobile btn-primary sm:flex-1 sm:px-6 sm:py-3 sm:bg-blue-600 sm:text-white sm:rounded-xl sm:font-semibold sm:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Speichern...</span>
            </div>
          ) : (
            mode === 'edit' ? 'Aktualisieren' : 'Erstellen'
          )}
        </button>
      </div>
    </BaseModal>
  );
};

EventFormModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  event: PropTypes.object,
  selectedDate: PropTypes.instanceOf(Date),
  mode: PropTypes.oneOf(['create', 'edit']),
};

export default EventFormModal;
