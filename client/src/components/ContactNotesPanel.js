import React, { useState, useEffect } from 'react';
import { FileText, Save, Trash2, Tag, X } from 'lucide-react';
import { getContactNote, saveContactNote, deleteContactNote } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const ContactNotesPanel = ({ contactId, contactName }) => {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadNote();
  }, [contactId]);

  const loadNote = async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const response = await getContactNote(contactId);
      if (response.data) {
        setNote(response.data.note || '');
        setTags(response.data.tags || []);
      } else {
        setNote('');
        setTags([]);
      }
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!note.trim()) {
      showError('Notiz darf nicht leer sein');
      return;
    }

    setSaving(true);
    try {
      await saveContactNote(contactId, { note, tags });
      showSuccess('Notiz gespeichert');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving note:', error);
      showError('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Notiz wirklich löschen?')) return;

    try {
      await deleteContactNote(contactId);
      setNote('');
      setTags([]);
      setHasChanges(false);
      showSuccess('Notiz gelöscht');
    } catch (error) {
      console.error('Error deleting note:', error);
      showError('Fehler beim Löschen');
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
      setHasChanges(true);
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
    setHasChanges(true);
  };

  if (!contactId) return null;

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">Notizen zu {contactName}</h3>
        </div>
        {hasChanges && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
            Nicht gespeichert
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Note Textarea */}
          <div>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Notizen über diesen Kontakt..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:bg-blue-200 rounded-full p-0.5 transition"
                  >
                    <X className="w-3 h-3" />
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
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
              >
                Hinzufügen
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || !note.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            {note && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
                title="Notiz löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactNotesPanel;
