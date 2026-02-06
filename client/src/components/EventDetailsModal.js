import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Play, Pause, X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeParseDate, safeFormat } from '../utils/dateHelpers';
import BaseModal from './BaseModal';
import { useAuth } from '../context/AuthContext';

const EventDetailsModal = ({ isOpen, onClose, event, onEdit, onDelete, onDuplicate }) => {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteScope, setDeleteScope] = useState('series');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioRef, setAudioRef] = useState(null);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const safeEvent = event || {};

  // Normalize event data without mutation
  const normalizedEvent = {
    ...safeEvent,
    date: safeEvent.date || safeEvent.start_date || safeEvent.start || new Date(),
    startTime: safeEvent.startTime || safeEvent.start_time || '',
    endTime: safeEvent.endTime || safeEvent.end_time || '',
    isAllDay: safeEvent.isAllDay ?? safeEvent.all_day ?? false,
    isRecurring: safeEvent.isRecurring ?? safeEvent.is_recurring ?? safeEvent.recurring ?? false,
    is_occurrence: safeEvent.is_occurrence ?? safeEvent.isOccurrence ?? false,
    recurrencePattern: safeEvent.recurrencePattern || safeEvent.recurring_pattern || safeEvent.recurrence_pattern,
    recurrenceEndDate: safeEvent.recurrenceEndDate || safeEvent.recurring_end || safeEvent.recurrence_end_date,
    recurrenceInterval:
      safeEvent.recurrenceInterval ??
      safeEvent.recurrence_interval ??
      safeEvent.recurring_interval
  };

  const getTypeIcon = (type) => {
    const icons = {
      'Arbeit': '💼',
      'Urlaub': '🏖️',
      'Krankheit': '🏥',
      'Meeting': '👥',
      'Projekt': '📊',
      'Training': '📚',
      'Abwesend': '🚫'
    };
    return icons[type] || '📅';
  };

  const getTypeColor = (type) => {
    const colors = {
      'Arbeit': 'bg-green-100 text-green-800 border-green-200',
      'Urlaub': 'bg-purple-100 text-purple-800 border-purple-200',
      'Krankheit': 'bg-red-100 text-red-800 border-red-200',
      'Meeting': 'bg-blue-100 text-blue-800 border-blue-200',
      'Projekt': 'bg-orange-100 text-orange-800 border-orange-200',
      'Training': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Abwesend': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPriorityIcon = (priority) => {
    const icons = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🔴'
    };
    return icons[priority] || '🟡';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      'low': 'Niedrig',
      'medium': 'Mittel',
      'high': 'Hoch'
    };
    return labels[priority] || 'Mittel';
  };

  const getRecurrenceLabel = (pattern, interval = 1) => {
    const normalizedInterval = Number(interval) && Number(interval) > 0 ? Number(interval) : 1;
    const labels = {
      daily: normalizedInterval === 1 ? 'Täglich' : `Alle ${normalizedInterval} Tage`,
      weekly: normalizedInterval === 1 ? 'Wöchentlich' : `Alle ${normalizedInterval} Wochen`,
      biweekly: 'Alle 2 Wochen',
      monthly: normalizedInterval === 1 ? 'Monatlich' : `Alle ${normalizedInterval} Monate`,
      yearly: normalizedInterval === 1 ? 'Jährlich' : `Alle ${normalizedInterval} Jahre`
    };
    return labels[pattern] || pattern;
  };

  const eventDate = safeParseDate(normalizedEvent.date || normalizedEvent.start || normalizedEvent.start_date);
  const isRecurringEvent = Boolean(normalizedEvent.isRecurring);
  const occurrenceDate =
    normalizedEvent.start_date ||
    safeFormat(eventDate, 'yyyy-MM-dd', { fallback: '' });

  const handleDelete = async () => {
    if (!canManage) return;
    setIsDeleting(true);
    try {
      const targetId =
        normalizedEvent.recurrence_parent_id ||
        normalizedEvent.series_id ||
        normalizedEvent.id;
      const shouldDeleteSingle = isRecurringEvent && deleteScope === 'single' && occurrenceDate;
      const options = shouldDeleteSingle
        ? { scope: 'single', occurrenceDate }
        : { scope: 'series' };
      await onDelete(targetId, options);
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      onDuplicate({
        ...normalizedEvent,
        id: undefined,
        title: `${normalizedEvent.title} (Kopie)`
      });
    }
    onClose();
  };

  const handleShareInMessage = () => {
    // Navigate to messages page with event data
    navigate('/messages', {
      state: {
        shareEvent: {
          id: normalizedEvent.id,
          title: normalizedEvent.title,
          start_time: normalizedEvent.date?.toISOString?.() || new Date().toISOString(),
          end_time: normalizedEvent.endTime
            ? new Date(`${normalizedEvent.date} ${normalizedEvent.endTime}`).toISOString()
            : new Date().toISOString(),
          location: normalizedEvent.location || null
        }
      }
    });
    onClose();
  };

  const creatorId =
    normalizedEvent.created_by ??
    normalizedEvent.createdBy ??
    normalizedEvent.created_by_id ??
    normalizedEvent.createdById;
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);
  const isWorkHoursEvent = normalizedEvent.isWorkHours || normalizedEvent.read_only || normalizedEvent.raw?.source === 'work_hours';
  const canManage = Boolean(!isWorkHoursEvent && (isAdmin || (creatorId && user?.id && Number(creatorId) === Number(user.id))));
  const canEdit = canManage && typeof onEdit === 'function';
  const canDelete = canManage && typeof onDelete === 'function';
  const canDuplicate = canManage && typeof onDuplicate === 'function';
  const workHoursMeta = normalizedEvent.raw?.work_hours || normalizedEvent.work_hours;

  useEffect(() => {
    if (!showDeleteConfirm) return;
    if (isRecurringEvent) {
      setDeleteScope('single');
    } else {
      setDeleteScope('series');
    }
  }, [showDeleteConfirm, isRecurringEvent, normalizedEvent.id]);

  useEffect(() => {
    if (!canDelete) {
      setShowDeleteConfirm(false);
    }
  }, [canDelete, normalizedEvent.id]);

  // Handle audio playback
  const toggleAudioPlayback = () => {
    if (audioRef) {
      if (isPlayingAudio) {
        audioRef.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.play();
        setIsPlayingAudio(true);
      }
    }
  };

  // Get image attachments
  const imageAttachments = normalizedEvent.attachments
    ? (Array.isArray(normalizedEvent.attachments)
        ? normalizedEvent.attachments
        : []
      ).filter(att => att.type === 'image' || (att.url && att.url.match(/\.(jpg|jpeg|png|gif)$/i)))
    : [];

  // Navigate image gallery
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageAttachments.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageAttachments.length) % imageAttachments.length);
  };

  if (!isOpen) return null;

  if (!event) {
    console.error('EventDetailsModal: event is null or undefined');
    return null;
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName="modal-backdrop-mobile backdrop-blur-sm"
      dialogClassName="modal-bottom-sheet bg-white sm:modal sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl border border-slate-200"
    >
        {/* Mobile Handle */}
        <div className="modal-handle sm:hidden bg-slate-300" />

        {/* Header - Clean White Design */}
        <div className="modal-header-mobile relative border-b border-slate-200">
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                {/* Type and Priority Badges */}
                <div className="flex items-center flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-lg">{getTypeIcon(normalizedEvent.type)}</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {normalizedEvent.type}
                    </span>
                  </div>
                  {isWorkHoursEvent && (
                    <div className="flex items-center gap-1.5 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <span className="text-xs font-semibold text-emerald-700">Arbeitszeit (Auto)</span>
                    </div>
                  )}
                  {normalizedEvent.priority && (
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span className="text-base">{getPriorityIcon(normalizedEvent.priority)}</span>
                      <span className="text-xs font-semibold text-slate-700">{getPriorityLabel(normalizedEvent.priority)}</span>
                    </div>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 break-words">
                  {normalizedEvent.title}
                </h2>

                {/* Date */}
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-base sm:text-lg font-medium">
                    {safeFormat(eventDate, 'EEEE, dd. MMMM yyyy', { locale: de, fallback: '—' })}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="btn-icon-mobile flex-shrink-0 bg-slate-100 hover:bg-slate-200 border border-slate-200 mobile-touch-feedback transition-all"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="modal-body-mobile p-6 sm:p-8 space-y-4">
          {/* Time */}
          {!normalizedEvent.isAllDay && (normalizedEvent.startTime || normalizedEvent.endTime) && (
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base">
                  {normalizedEvent.startTime} - {normalizedEvent.endTime}
                </p>
                <p className="text-sm text-slate-600">
                  {normalizedEvent.isAllDay ? 'Ganztägig' : 'Zeitraum'}
                </p>
              </div>
            </div>
          )}

          {/* Work hours details */}
          {isWorkHoursEvent && workHoursMeta && (
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-emerald-900 text-base">
                  {workHoursMeta.user_name || normalizedEvent.created_by_name || 'Teammitglied'}
                </p>
                <p className="text-sm text-emerald-700">
                  {workHoursMeta.start_time} - {workHoursMeta.end_time}
                </p>
              </div>
            </div>
          )}

          {/* Created By */}
          {(normalizedEvent.created_by_name || normalizedEvent.createdByName) && (
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base">
                  {normalizedEvent.created_by_name || normalizedEvent.createdByName}
                </p>
                <p className="text-sm text-slate-600">Erstellt von</p>
              </div>
            </div>
          )}

          {/* Location */}
          {normalizedEvent.location && (
            <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base">{normalizedEvent.location}</p>
                <p className="text-sm text-slate-600">Ort</p>
              </div>
            </div>
          )}

          {/* Attendees */}
          {normalizedEvent.attendees && (
            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base mb-2">Teilnehmer</p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(normalizedEvent.attendees) ? normalizedEvent.attendees : normalizedEvent.attendees.split(',')).map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700"
                    >
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {email.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recurring Info */}
          {normalizedEvent.isRecurring && (
            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base">
                  {getRecurrenceLabel(normalizedEvent.recurrencePattern, normalizedEvent.recurrenceInterval)}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  Wiederholender Termin
                  {normalizedEvent.recurrenceEndDate && (
                    <span> bis {format(new Date(normalizedEvent.recurrenceEndDate), 'dd.MM.yyyy', { locale: de })}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Reminder */}
          {normalizedEvent.reminder && normalizedEvent.reminder !== '0' && (
            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-12h0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-base">
                  {normalizedEvent.reminder < 60 ? `${normalizedEvent.reminder} Minuten` :
                   normalizedEvent.reminder < 1440 ? `${Math.floor(normalizedEvent.reminder / 60)} Stunden` :
                   `${Math.floor(normalizedEvent.reminder / 1440)} Tage`} vorher
                </p>
                <p className="text-sm text-slate-600 mt-1">Erinnerung</p>
              </div>
            </div>
          )}

          {/* Description */}
          {normalizedEvent.description && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900">Beschreibung</h4>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {normalizedEvent.description}
                </p>
              </div>
            </div>
          )}

          {/* Audio Playback */}
          {normalizedEvent.audio_url && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Audio-Anweisung
              </h4>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <audio
                  ref={(ref) => setAudioRef(ref)}
                  src={normalizedEvent.audio_url}
                  onEnded={() => setIsPlayingAudio(false)}
                  onPlay={() => setIsPlayingAudio(true)}
                  onPause={() => setIsPlayingAudio(false)}
                  className="w-full mb-3"
                  controls
                />
                <button
                  onClick={toggleAudioPlayback}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="w-5 h-5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Abspielen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Photo Gallery Preview */}
          {imageAttachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Fotos ({imageAttachments.length})
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {imageAttachments.slice(0, 6).map((image, index) => (
                  <div
                    key={index}
                    className="relative cursor-pointer group aspect-square"
                    onClick={() => {
                      setCurrentImageIndex(index);
                      setShowImageGallery(true);
                    }}
                  >
                    <img
                      src={image.url}
                      alt={image.filename || `Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </div>
                  </div>
                ))}
                {imageAttachments.length > 6 && (
                  <div
                    className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200"
                    onClick={() => {
                      setCurrentImageIndex(6);
                      setShowImageGallery(true);
                    }}
                  >
                    <span className="text-sm font-semibold text-slate-700">
                      +{imageAttachments.length - 6} mehr
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-footer-mobile event-details-modal__footer p-4 sm:p-6 border-t border-slate-200">
          {!showDeleteConfirm || !canDelete ? (
            <div className="flex flex-col gap-3">
              {(canEdit || canDuplicate || canDelete) && (
                <div className="flex flex-col sm:flex-row gap-3">
                  {canEdit && (
                    <button
                      onClick={() => onEdit(normalizedEvent)}
                      className="btn-mobile btn-primary-mobile flex-1 mobile-touch-feedback flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Bearbeiten</span>
                    </button>
                  )}

                  {canDuplicate && (
                    <button
                      onClick={handleDuplicate}
                      className="btn-mobile btn-secondary-mobile mobile-touch-feedback flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Duplizieren</span>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="btn-mobile mobile-touch-feedback flex items-center justify-center gap-2 border-2 border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Löschen</span>
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleShareInMessage}
                className="btn-mobile w-full mobile-touch-feedback flex items-center justify-center gap-2 border-2 border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
              >
                <Share2 className="w-5 h-5" />
                <span>In Nachricht teilen</span>
              </button>

              {!canManage && (
                <p className="text-xs text-slate-500 text-center">
                  Nur der Ersteller oder ein Admin kann Termine bearbeiten.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 animate-spring">
              <div className="card-mobile bg-red-50 border-2 border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <p className="text-sm sm:text-base text-red-800 font-semibold">
                      Sind Sie sicher, dass Sie diesen Termin löschen möchten?
                    </p>
                    <p className="text-xs sm:text-sm text-red-600 mt-1">
                      Diese Aktion kann nicht rückgängig gemacht werden.
                    </p>
                  </div>
                </div>
              </div>

              {isRecurringEvent && (
                <div className="card-mobile bg-white border-2 border-slate-200 p-4">
                  <p className="text-sm sm:text-base text-slate-900 font-semibold">
                    Was möchten Sie löschen?
                  </p>
                  <div className="flex flex-col gap-2 mt-3">
                    <button
                      onClick={() => setDeleteScope('single')}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${
                        deleteScope === 'single'
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Nur diesen Termin
                    </button>
                    <button
                      onClick={() => setDeleteScope('series')}
                      className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition ${
                        deleteScope === 'series'
                          ? 'border-red-500 bg-red-100 text-red-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Gesamte Serie
                    </button>
                  </div>
                  {deleteScope === 'series' && (
                    <p className="text-xs text-red-600 mt-2">
                      Alle zukünftigen Termine dieser Serie werden entfernt.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-mobile btn-secondary-mobile flex-1 mobile-touch-feedback"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-mobile flex-1 bg-red-600 text-white hover:bg-red-700 mobile-touch-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="loading-spinner-mobile w-4 h-4 border-2" />
                      <span>Löschen...</span>
                    </div>
                  ) : (
                    'Bestätigen'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Full-Screen Image Gallery */}
      {showImageGallery && imageAttachments.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex items-center justify-center"
          onClick={() => setShowImageGallery(false)}
        >
          <button
            onClick={() => setShowImageGallery(false)}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors z-10"
            aria-label="Close gallery"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {imageAttachments.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          <div className="max-w-7xl max-h-[calc(100vh-4rem)] px-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageAttachments[currentImageIndex]?.url}
              alt={imageAttachments[currentImageIndex]?.filename || `Photo ${currentImageIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="text-center mt-4">
              <p className="text-white text-sm font-medium">
                {currentImageIndex + 1} / {imageAttachments.length}
              </p>
              {imageAttachments[currentImageIndex]?.filename && (
                <p className="text-white text-xs mt-1 opacity-75">
                  {imageAttachments[currentImageIndex].filename}
                </p>
              )}
            </div>
          </div>

          {/* Thumbnail Navigation */}
          {imageAttachments.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto px-4">
              {imageAttachments.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    index === currentImageIndex
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={image.url}
                    alt={image.filename || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BaseModal>
  );
};

export default EventDetailsModal;
