import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  Mic,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TaskComments from './TaskComments';
import {
  updateTask,
  deleteTask,
  uploadAttachment,
  deleteAttachment,
  fetchTaskById,
} from '../utils/kanbanApi';
import { getAssetUrl } from '../utils/media';
import { useMobile } from '../hooks/useMobile';

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
  const { isMobile } = useMobile();
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details, comments
  const [fullTask, setFullTask] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const resolvedTask = fullTask || task;

  const loadTaskDetails = useCallback(async () => {
    if (!task?.id) return;
    try {
      setIsFetching(true);
      const data = await fetchTaskById(task.id);
      const taskPayload = data?.task || data?.data || data;
      setFullTask(taskPayload);
    } catch (error) {
      console.error('Error fetching task details:', error);
      toast.error('Details konnten nicht geladen werden');
    } finally {
      setIsFetching(false);
    }
  }, [task?.id]);

  useEffect(() => {
    if (isOpen && task?.id) {
      loadTaskDetails();
    }
  }, [isOpen, task?.id, loadTaskDetails]);

  useEffect(() => {
    if (!isOpen) {
      setFullTask(null);
      setImagePreview(null);
      setActiveTab('details');
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

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
    }
  }, [task, isOpen]);

  const normalizedAttachments = useMemo(() => {
    const rawAttachments =
      resolvedTask?.attachments || resolvedTask?.media || resolvedTask?.files || [];

    if (!Array.isArray(rawAttachments)) return [];

    return rawAttachments
      .map((attachment, index) => {
        const fileUrl =
          attachment?.file_url ||
          attachment?.url ||
          attachment?.path ||
          attachment?.filePath ||
          attachment?.file_path;
        if (!fileUrl) return null;

        const name =
          attachment?.file_name ||
          attachment?.name ||
          attachment?.filename ||
          (fileUrl ? fileUrl.split('/').pop() : 'Anhang');
        const mime =
          attachment?.mime_type || attachment?.mimeType || attachment?.mimetype || '';
        let type = (
          attachment?.file_type ||
          attachment?.type ||
          attachment?.media_type ||
          ''
        )
          .toString()
          .toLowerCase();

        if (type.includes('/')) {
          if (type.startsWith('image')) type = 'image';
          if (type.startsWith('audio')) type = 'audio';
          if (type.startsWith('video')) type = 'video';
        }

        if (!type) {
          if (mime.startsWith('image/')) type = 'image';
          if (mime.startsWith('audio/')) type = 'audio';
          if (mime.startsWith('video/')) type = 'video';
        }

        if (!type && name) {
          const extension = name.split('.').pop()?.toLowerCase();
          if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(extension)) {
            type = 'image';
          }
          if (['mp3', 'wav', 'webm', 'm4a', 'ogg', 'aac'].includes(extension)) {
            type = 'audio';
          }
          if (['mp4', 'mov', 'webm', 'mkv'].includes(extension)) {
            type = 'video';
          }
        }

        if (!['image', 'audio', 'video'].includes(type)) {
          type = 'document';
        }

        const resolvedUrl = getAssetUrl(fileUrl);

        return {
          id: attachment?.id || attachment?.attachment_id || `${name}-${index}`,
          name,
          type,
          url: resolvedUrl,
          raw: attachment,
        };
      })
      .filter(Boolean);
  }, [resolvedTask]);

  const audioAttachment = useMemo(
    () => normalizedAttachments.find((attachment) => attachment.type === 'audio'),
    [normalizedAttachments]
  );

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

  const handleDeleteAttachment = async (attachmentId) => {
    if (!attachmentId) return;
    try {
      await deleteAttachment(attachmentId);
      toast.success('Anhang gelöscht');
      await loadTaskDetails();

      if (onTaskUpdated) {
        onTaskUpdated({ ...task, _refresh: true });
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const addLabel = () => {
    const labels = Array.isArray(formData.labels) ? formData.labels : [];
    if (labelInput.trim() && !labels.includes(labelInput.trim())) {
      setFormData({ ...formData, labels: [...labels, labelInput.trim()] });
      setLabelInput('');
    }
  };

  const removeLabel = (labelToRemove) => {
    const labels = Array.isArray(formData.labels) ? formData.labels : [];
    setFormData({
      ...formData,
      labels: labels.filter((label) => label !== labelToRemove),
    });
  };

  const addChecklistItem = () => {
    if (checklistInput.trim()) {
      const checklist = Array.isArray(formData.checklist) ? formData.checklist : [];
      const newItem = {
        id: Date.now(),
        text: checklistInput.trim(),
        completed: false,
      };
      setFormData({
        ...formData,
        checklist: [...checklist, newItem],
      });
      setChecklistInput('');
    }
  };

  const toggleChecklistItem = (itemId) => {
    const checklist = Array.isArray(formData.checklist) ? formData.checklist : [];
    setFormData({
      ...formData,
      checklist: checklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ),
    });
  };

  const removeChecklistItem = (itemId) => {
    const checklist = Array.isArray(formData.checklist) ? formData.checklist : [];
    setFormData({
      ...formData,
      checklist: checklist.filter((item) => item.id !== itemId),
    });
  };

  if (!isOpen || !task) return null;

  const modalContent = (
    <div
      className={`modal-shell fixed inset-0 z-[120000] flex ${
        isMobile
          ? 'items-stretch justify-center p-0 kanban-task-modal__shell'
          : 'items-center justify-center px-3 py-6 sm:px-6'
      }`}
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-[1] w-full ${
          isMobile
            ? 'modal-card modal-card--fullscreen'
            : 'max-w-5xl max-h-[90vh] rounded-[28px]'
        } bg-white/95 backdrop-blur border border-slate-200/70 shadow-[0_32px_90px_rgba(15,23,42,0.25)] overflow-hidden flex flex-col kanban-task-modal`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="kanban-task-modal__header flex items-start justify-between gap-4 bg-slate-950 text-white px-5 sm:px-7 py-5 sm:py-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-slate-300">
              <span>Aufgabe #{resolvedTask?.id ?? task.id}</span>
              {isFetching && <span className="text-[10px] tracking-[0.3em]">Aktualisiert…</span>}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mt-2">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
              {formData.title || resolvedTask?.title}
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
                    {normalizedAttachments.length > 0 && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-2">
                          <Paperclip className="w-4 h-4 inline-block mr-1" />
                          Anhänge ({normalizedAttachments.length})
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {normalizedAttachments.map((attachment) => {
                            const deleteTargetId =
                              attachment.raw?.id ||
                              attachment.raw?.attachment_id ||
                              attachment.raw?.attachmentId ||
                              null;

                            return (
                            <div
                              key={attachment.id}
                              className="relative group rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white"
                            >
                              {attachment.type === 'image' && (
                                <button
                                  type="button"
                                  onClick={() => setImagePreview(attachment)}
                                  className="block w-full"
                                >
                                  <img
                                    src={attachment.url}
                                    alt={attachment.name}
                                    className="w-full h-32 object-cover"
                                  />
                                </button>
                              )}
                              {attachment.type === 'audio' && (
                                <div className="p-3 bg-purple-50">
                                  <p className="text-xs text-slate-600 mb-2 truncate flex items-center gap-1">
                                    <Mic className="w-3 h-3" />
                                    {attachment.name}
                                  </p>
                                  <audio controls src={attachment.url} className="w-full" />
                                </div>
                              )}
                              {attachment.type === 'video' && (
                                <div className="p-2 bg-slate-50">
                                  <video controls src={attachment.url} className="w-full rounded-lg" />
                                </div>
                              )}
                              {attachment.type === 'document' && (
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block p-3 hover:bg-slate-50 transition"
                                >
                                  <p className="text-xs text-slate-600 truncate">
                                    📎 {attachment.name}
                                  </p>
                                </a>
                              )}
                              {deleteTargetId && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(deleteTargetId)}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
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
                        {(Array.isArray(formData.checklist) ? formData.checklist : []).map((item) => (
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
                        {(Array.isArray(formData.labels) ? formData.labels : []).map((label) => (
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

                    {/* Voice Note Playback */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-blue-600" />
                        Sprachnotiz
                      </label>
                      {audioAttachment ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs text-slate-600 mb-2 truncate flex items-center gap-1">
                            <Mic className="w-3 h-3" />
                            {audioAttachment.name || 'Sprachnotiz'}
                          </p>
                          <audio controls src={audioAttachment.url} className="w-full" />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Keine Sprachnotiz vorhanden.</p>
                      )}
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
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag className="w-5 h-5" />
              {loading ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[120030] flex items-center justify-center bg-slate-900/80 px-4"
          onClick={() => setImagePreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImagePreview(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imagePreview.url}
              alt={imagePreview.name}
              className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <p className="mt-3 text-center text-sm text-slate-200 truncate">{imagePreview.name}</p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120020] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative z-[120030] bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
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

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default TaskModal;
