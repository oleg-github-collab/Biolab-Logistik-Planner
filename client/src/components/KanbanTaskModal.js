import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, Flag, Tag, Clock, Plus, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import TaskComments from './TaskComments';
import { getAssetUrl } from '../utils/media';

const PRIORITIES = [
  { value: 'low', label: 'Niedrig', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'medium', label: 'Mittel', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'high', label: 'Hoch', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'urgent', label: 'Dringend', color: 'bg-red-100 text-red-700 border-red-300' }
];

const KanbanTaskModal = ({ isOpen, onClose, onSave, task = null, users = [] }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee_id: '',
    due_date: '',
    priority: 'medium',
    tags: [],
    estimated_hours: ''
  });

  const [tagInput, setTagInput] = useState('');

  const normalizedAttachments = useMemo(() => {
    if (!task || !Array.isArray(task.attachments)) {
      return [];
    }

    return task.attachments.map((attachment) => {
      const mime = attachment.mimeType || attachment.mime_type || '';
      const derivedType = attachment.type || attachment.file_type || (
        mime.startsWith('image/') ? 'image' :
        mime.startsWith('audio/') ? 'audio' :
        mime.startsWith('video/') ? 'video' :
        'document'
      );

      const url = attachment.url || attachment.file_url || '';
      const resolvedUrl = getAssetUrl(url);
      const name = attachment.name || attachment.file_name || (url ? url.split('/').pop() : '');

      return {
        id: attachment.id,
        type: derivedType,
        url: resolvedUrl,
        name,
        mimeType: mime,
        raw: attachment
      };
    }).filter((attachment) => Boolean(attachment.url));
  }, [task]);

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        assignee_id: task.assignee_id || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        priority: task.priority || 'medium',
        tags: task.tags || [],
        estimated_hours: task.estimated_hours || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assignee_id: '',
        due_date: '',
        priority: 'medium',
        tags: [],
        estimated_hours: ''
      });
    }
  }, [task, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }
    onSave(formData);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-[101] flex flex-1 items-center justify-center p-0 sm:p-6">
        <div
          className="bg-white w-full h-full overflow-y-auto sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header-mobile bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 sm:p-6 sm:rounded-t-2xl flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
              {task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
            </h2>
            <button onClick={onClose} className="btn-icon-mobile bg-white/20 hover:bg-white/30 text-white mobile-touch-feedback">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="modal-body-mobile p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="sm:hidden h-1.5 w-12 bg-slate-300 rounded-full mx-auto mb-3" />

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Titel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Backend API implementieren"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Beschreibung</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detaillierte Beschreibung der Aufgabe..."
                rows="4"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all resize-none"
              />
            </div>

            {normalizedAttachments.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Anhänge
                </label>
                <div className="flex flex-wrap gap-3">
                  {normalizedAttachments.map((attachment) => {
                    const key = attachment.id || attachment.url;
                    if (attachment.type === 'image') {
                      return (
                        <img
                          key={key}
                          src={attachment.url}
                          alt={attachment.name || 'Anhang'}
                          className="h-24 w-24 object-cover rounded-lg border border-gray-200"
                        />
                      );
                    }
                    if (attachment.type === 'audio') {
                      return (
                        <div key={key} className="w-full max-w-xs border border-gray-200 rounded-lg p-2 bg-gray-50">
                          <p className="text-xs text-gray-500 mb-1 truncate">
                            {attachment.name || 'Audio'}
                          </p>
                          <audio controls src={attachment.url} className="w-full" />
                        </div>
                      );
                    }
                    return (
                      <a
                        key={key}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-xs text-gray-600 hover:bg-gray-200"
                      >
                        📎 {attachment.name || attachment.url.split('/').pop()}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-blue-600" />
                  Prioritat
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: priority.value })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                        formData.priority === priority.value
                          ? priority.color + ' ring-2 ring-offset-2 ring-blue-500'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {priority.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  Zugewiesen an
                </label>
                <select
                  value={formData.assignee_id}
                  onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                >
                  <option value="">Nicht zugewiesen</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Falligkeitsdatum
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Geschatzte Stunden
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                  placeholder="z.B. 4"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-600" />
                Tags
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Tag hinzufugen..."
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Section (only for existing tasks) */}
            {task && task.id && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Kommentare
                </h3>
                <TaskComments taskId={task.id} />
              </div>
            )}

            <div className="modal-footer-mobile flex flex-col-reverse sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="btn-mobile btn-secondary-mobile mobile-touch-feedback"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn-mobile btn-primary-mobile mobile-touch-feedback flex items-center justify-center gap-2"
              >
                <Flag className="w-5 h-5" />
                {task ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default KanbanTaskModal;
