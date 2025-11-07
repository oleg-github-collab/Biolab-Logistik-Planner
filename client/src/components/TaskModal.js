import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  User,
  Flag,
  Tag,
  Clock,
  Plus,
  Trash2,
  MessageCircle,
  Paperclip,
  FileText,
  Activity,
  Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import VoiceRecorder from './VoiceRecorder';
import TaskComments from './TaskComments';
import {
  updateTask,
  deleteTask,
  uploadAttachment,
  deleteAttachment,
  fetchActivityLog,
  getPriorityLabel,
  getPriorityColorClass,
} from '../utils/kanbanApi';
import { getAssetUrl } from '../utils/media';

const PRIORITIES = [
  { value: 'low', label: 'Niedrig', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'medium', label: 'Mittel', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'high', label: 'Dringend', color: 'bg-red-100 text-red-700 border-red-300' },
];

const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Erledigt' },
];

const TaskModal = ({ isOpen, onClose, task, users = [], onTaskUpdated, onTaskDeleted }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    estimated_hours: '',
    labels: [],
    checklist: [],
  });

  const [labelInput, setLabelInput] = useState('');
  const [checklistInput, setChecklistInput] = useState('');
  const [activityLog, setActivityLog] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, comments, activity

  // Load task data into form
  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        estimated_hours: task.estimated_hours || '',
        labels: task.labels || [],
        checklist: task.checklist || [],
      });

      // Load activity log
      if (task.id) {
        loadActivityLog(task.id);
      }
    }
  }, [task]);

  const loadActivityLog = async (taskId) => {
    try {
      const log = await fetchActivityLog(taskId);
      setActivityLog(log);
    } catch (error) {
      console.error('Failed to load activity log:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }

    try {
      setLoading(true);

      const updatedTask = await updateTask(task.id, {
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        labels: formData.labels,
        checklist: formData.checklist,
      });

      toast.success('Aufgabe aktualisiert');

      if (onTaskUpdated) {
        onTaskUpdated(updatedTask);
      }

      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Aktualisieren');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await deleteTask(task.id);
      toast.success('Aufgabe gelöscht');

      if (onTaskDeleted) {
        onTaskDeleted(task.id);
      }

      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Löschen');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleVoiceRecording = async (audioBlob) => {
    if (!task?.id) {
      toast.error('Bitte speichern Sie zuerst die Aufgabe');
      return;
    }

    try {
      setUploadingAudio(true);

      // Create a File from the Blob
      const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      await uploadAttachment(task.id, audioFile, 'audio');
      toast.success('Audio hochgeladen');

      // Refresh task data
      if (onTaskUpdated) {
        // Trigger a refresh in parent component
        onTaskUpdated({ ...task, _refresh: true });
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await deleteAttachment(attachmentId);
      toast.success('Anhang gelöscht');

      // Refresh task data
      if (onTaskUpdated) {
        onTaskUpdated({ ...task, _refresh: true });
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const addLabel = () => {
    if (labelInput.trim() && !formData.labels.includes(labelInput.trim())) {
      setFormData({ ...formData, labels: [...formData.labels, labelInput.trim()] });
      setLabelInput('');
    }
  };

  const removeLabel = (labelToRemove) => {
    setFormData({
      ...formData,
      labels: formData.labels.filter((label) => label !== labelToRemove),
    });
  };

  const addChecklistItem = () => {
    if (checklistInput.trim()) {
      const newItem = {
        id: Date.now(),
        text: checklistInput.trim(),
        completed: false,
      };
      setFormData({
        ...formData,
        checklist: [...formData.checklist, newItem],
      });
      setChecklistInput('');
    }
  };

  const toggleChecklistItem = (itemId) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    });
  };

  const removeChecklistItem = (itemId) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.filter((item) => item.id !== itemId),
    });
  };

  // Get audio attachment
  const audioAttachment = task?.attachments?.find(
    (att) => att.file_type === 'audio' || att.file_type === 'audio/webm'
  );

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6 sm:px-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-[130] w-full max-w-5xl bg-white/95 backdrop-blur rounded-[28px] border border-slate-200/70 shadow-[0_32px_90px_rgba(15,23,42,0.25)] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white px-5 sm:px-7 py-5 sm:py-6">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.25em] text-blue-100/80">
              Aufgabe #{task.id}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mt-1">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-mobile bg-white/15 hover:bg-white/25 text-white mobile-touch-feedback rounded-full px-3 py-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 sm:px-7">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Details
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'comments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 inline-block mr-2" />
            Kommentare
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-3 font-semibold text-sm transition-colors border-b-2 ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4 inline-block mr-2" />
            Aktivität
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="px-5 sm:px-7 py-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
                  {/* Left Column */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Titel <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Beschreibung
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detaillierte Beschreibung der Aufgabe..."
                        rows="5"
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition shadow-sm resize-none"
                      />
                    </div>

                    {/* Attachments */}
                    {task.attachments && task.attachments.length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-2">
                          <Paperclip className="w-4 h-4 inline-block mr-1" />
                          Anhänge ({task.attachments.length})
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {task.attachments.map((attachment) => {
                            const url = getAssetUrl(attachment.file_url);
                            const isImage = attachment.file_type === 'image';
                            const isAudio = attachment.file_type === 'audio';

                            return (
                              <div
                                key={attachment.id}
                                className="relative group rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                              >
                                {isImage && (
                                  <img
                                    src={url}
                                    alt={attachment.file_name}
                                    className="w-full h-32 object-cover"
                                  />
                                )}
                                {isAudio && (
                                  <div className="p-3 bg-purple-50">
                                    <p className="text-xs text-slate-600 mb-2 truncate flex items-center gap-1">
                                      <Mic className="w-3 h-3" />
                                      {attachment.file_name}
                                    </p>
                                    <audio controls src={url} className="w-full" />
                                  </div>
                                )}
                                {!isImage && !isAudio && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 hover:bg-slate-50 transition"
                                  >
                                    <p className="text-xs text-slate-600 truncate">
                                      📎 {attachment.file_name}
                                    </p>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(attachment.id)}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Checkliste
                      </label>
                      <div className="space-y-2 mb-3">
                        {formData.checklist.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => toggleChecklistItem(item.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span
                              className={`flex-1 text-sm ${
                                item.completed ? 'line-through text-slate-500' : 'text-slate-800'
                              }`}
                            >
                              {item.text}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(item.id)}
                              className="text-red-600 hover:text-red-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={checklistInput}
                          onChange={(e) => setChecklistInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addChecklistItem();
                            }
                          }}
                          placeholder="Neues Element hinzufügen..."
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                        />
                        <button
                          type="button"
                          onClick={addChecklistItem}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                      >
                        {STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Flag className="w-4 h-4 text-blue-600" />
                        Priorität
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {PRIORITIES.map((priority) => (
                          <button
                            key={priority.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, priority: priority.value })}
                            className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                              formData.priority === priority.value
                                ? `${priority.color} shadow-inner`
                                : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                            }`}
                          >
                            {priority.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        Zugewiesen an
                      </label>
                      <select
                        value={formData.assigned_to}
                        onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                      >
                        <option value="">Nicht zugewiesen</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Fälligkeitsdatum
                      </label>
                      <input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Geschätzte Stunden
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.estimated_hours}
                        onChange={(e) =>
                          setFormData({ ...formData, estimated_hours: e.target.value })
                        }
                        placeholder="z.B. 4"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-blue-600" />
                        Labels
                      </label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.labels.map((label) => (
                          <span
                            key={label}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm"
                          >
                            #{label}
                            <button
                              type="button"
                              onClick={() => removeLabel(label)}
                              className="hover:text-blue-800 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={labelInput}
                          onChange={(e) => setLabelInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addLabel();
                            }
                          }}
                          placeholder="Label hinzufügen..."
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                        />
                        <button
                          type="button"
                          onClick={addLabel}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Voice Recording */}
                    <div>
                      <VoiceRecorder
                        onRecordingComplete={handleVoiceRecording}
                        existingAudioUrl={audioAttachment ? getAssetUrl(audioAttachment.file_url) : null}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="py-2">
                <TaskComments taskId={task.id} />
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-3">
                {activityLog.length === 0 && (
                  <p className="text-center text-slate-500 py-8">Keine Aktivitäten</p>
                )}
                {activityLog.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {activity.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{activity.user_name}</p>
                      <p className="text-sm text-slate-600 mt-1">
                        {activity.action_type === 'created' && `Aufgabe erstellt`}
                        {activity.action_type === 'status_changed' &&
                          `Status geändert: ${activity.old_value} → ${activity.new_value}`}
                        {activity.action_type === 'attachment_added' &&
                          `Anhang hinzugefügt: ${activity.new_value}`}
                        {activity.action_type === 'comment_added' && `Kommentar hinzugefügt`}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(activity.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 px-5 sm:px-7 py-5 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-300 text-red-600 font-semibold hover:bg-red-50 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Löschen
          </button>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 hover:text-slate-800 transition"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || uploadingAudio}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag className="w-5 h-5" />
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative z-[150] bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aufgabe löschen?</h3>
            <p className="text-slate-600 mb-6">
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Anhänge und Kommentare werden
              ebenfalls gelöscht.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {loading ? 'Löschen...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskModal;
