import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, User, Flag, Tag, Clock, Plus, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import TaskComments from './TaskComments';
import VoiceRecorder from './VoiceRecorder';
import TaskChecklist from './TaskChecklist';
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
    assigned_to: '',
    due_date: '',
    priority: 'medium',
    category: '',
    tags: [],
    checklist: []
  });

  const [tagInput, setTagInput] = useState('');
  const [voiceInstruction, setVoiceInstruction] = useState(null);

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
        assigned_to: task.assigned_to || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        priority: task.priority || 'medium',
        category: task.category || '',
        tags: Array.isArray(task.tags) ? task.tags : [],
        checklist: Array.isArray(task.checklist) ? task.checklist : []
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assigned_to: '',
        due_date: '',
        priority: 'medium',
        category: '',
        tags: [],
        checklist: []
      });
    }
  }, [task, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Titel ist erforderlich');
      return;
    }
    onSave({ ...formData, voiceInstruction });
  };

  const handleVoiceRecording = (audioBlob) => {
    setVoiceInstruction(audioBlob);
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

  const handleChecklistChange = (newChecklist) => {
    setFormData({ ...formData, checklist: newChecklist });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6 sm:px-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-[130] w-full max-w-4xl bg-white/95 backdrop-blur rounded-[28px] border border-slate-200/70 shadow-[0_32px_90px_rgba(15,23,42,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white px-5 sm:px-7 py-5 sm:py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-blue-100/80">
              {task ? 'Aktualisieren' : 'Neu anlegen'}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 mt-1">
              <Flag className="w-5 h-5 sm:w-6 sm:h-6" />
              {task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-mobile bg-white/15 hover:bg-white/25 text-white mobile-touch-feedback rounded-full px-3 py-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 sm:px-7 py-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Titel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="z.B. Backend API implementieren"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition shadow-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Beschreibung</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detaillierte Beschreibung der Aufgabe..."
                  rows="5"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition shadow-sm resize-none"
                />
              </div>

              {normalizedAttachments.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Anhänge
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {normalizedAttachments.map((attachment) => {
                      const key = attachment.id || attachment.url;
                      if (attachment.type === 'image') {
                        return (
                          <figure
                            key={key}
                            className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
                          >
                            <img
                              src={attachment.url}
                              alt={attachment.name || 'Anhang'}
                              className="h-32 w-full object-cover"
                            />
                            <figcaption className="px-3 py-2 text-xs text-slate-500 truncate bg-white/90">
                              {attachment.name || 'Bild'}
                            </figcaption>
                          </figure>
                        );
                      }
                      if (attachment.type === 'audio') {
                        return (
                          <div
                            key={key}
                            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-inner"
                          >
                            <p className="text-xs text-slate-500 mb-2 truncate">
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
                          className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-slate-200 bg-white shadow-sm text-xs text-slate-600 hover:bg-slate-50 transition"
                        >
                          📎 {attachment.name || attachment.url.split('/').pop()}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-blue-600" />
                  Priorität
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITIES.map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: priority.value })}
                      className={`px-3 py-2 rounded-xl border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 ${
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

              <div className="space-y-3">
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-800 transition"
                        aria-label="Tag entfernen"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Tag hinzufügen..."
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-200/70 transition"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Hinzufügen
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div>
                <TaskChecklist
                  checklist={formData.checklist}
                  onChange={handleChecklistChange}
                  readOnly={false}
                />
              </div>

              {/* Voice Instruction */}
              <div>
                <VoiceRecorder
                  onRecordingComplete={handleVoiceRecording}
                  existingAudioUrl={
                    normalizedAttachments.find(a => a.type === 'audio')?.url
                  }
                />
              </div>
            </div>
          </div>

          {task && task.id && (
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                Kommentare
              </h3>
              <TaskComments taskId={task.id} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:border-slate-300 hover:text-slate-800 transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Flag className="w-5 h-5" />
              {task ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KanbanTaskModal;
