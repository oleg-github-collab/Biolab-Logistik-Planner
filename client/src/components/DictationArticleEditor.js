import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Mic, Tag as TagIcon, Save, Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import VoiceRecorder from './VoiceRecorder';

const DictationArticleEditor = ({
  isOpen,
  onClose,
  articleData,
  onSave,
  categories = [],
  onArticleDataChange,
  isProcessing = false,
  processingMessage = 'Verarbeitung läuft...'
}) => {
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = useCallback((field, value) => {
    onArticleDataChange({ ...articleData, [field]: value });
  }, [articleData, onArticleDataChange]);

  const handleAddTag = useCallback(() => {
    if (!tagInput.trim()) return;
    const newTag = tagInput.trim().toLowerCase();
    if (!articleData.tags.includes(newTag)) {
      handleChange('tags', [...articleData.tags, newTag]);
    }
    setTagInput('');
  }, [tagInput, articleData.tags, handleChange]);

  const handleRemoveTag = useCallback((tagToRemove) => {
    handleChange('tags', articleData.tags.filter(tag => tag !== tagToRemove));
  }, [articleData.tags, handleChange]);

  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadingMedia(true);
    try {
      // Preview files locally
      const newMedia = await Promise.all(
        files.map(file => new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              id: `temp-${Date.now()}-${Math.random()}`,
              file: file,
              preview: reader.result,
              type: file.type.startsWith('image/') ? 'image' : 'file',
              name: file.name,
              size: file.size
            });
          };
          reader.readAsDataURL(file);
        }))
      );

      handleChange('media', [...articleData.media, ...newMedia]);
      toast.success(`${files.length} Datei(en) hinzugefügt`);
    } catch (error) {
      toast.error('Fehler beim Hochladen der Dateien');
      console.error(error);
    } finally {
      setUploadingMedia(false);
    }
  }, [articleData.media, handleChange]);

  const handleRemoveMedia = useCallback((mediaId) => {
    handleChange('media', articleData.media.filter(m => m.id !== mediaId));
  }, [articleData.media, handleChange]);

  const handleAudioCommentComplete = useCallback((audioBlob) => {
    if (!audioBlob) return;

    const newComment = {
      id: `audio-${Date.now()}`,
      blob: audioBlob,
      url: URL.createObjectURL(audioBlob),
      timestamp: new Date().toISOString(),
      duration: 0 // Will be set by audio player
    };

    handleChange('audioComments', [...articleData.audioComments, newComment]);
    toast.success('Audiokommentar hinzugefügt');
  }, [articleData.audioComments, handleChange]);

  const handleRemoveAudioComment = useCallback((commentId) => {
    handleChange('audioComments', articleData.audioComments.filter(c => c.id !== commentId));
  }, [articleData.audioComments, handleChange]);

  const handleSave = useCallback(() => {
    // Validation
    if (!articleData.title?.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }
    if (!articleData.category_id) {
      toast.error('Bitte wählen Sie eine Kategorie');
      return;
    }
    if (!articleData.content?.trim()) {
      toast.error('Bitte geben Sie Inhalt ein');
      return;
    }

    onSave(articleData);
  }, [articleData, onSave]);

  if (!isOpen) return null;

  const modalMarkup = (
    <div className="modal-shell fixed inset-0 bg-black/50 flex items-stretch sm:items-center justify-center z-[10050] p-0 sm:p-4 overflow-y-auto">
      <div className="modal-card modal-card--fullscreen bg-white rounded-2xl shadow-2xl max-w-4xl w-full sm:my-8 flex flex-col max-h-[100dvh] sm:max-h-[calc(100vh-4rem)] overflow-hidden relative">
        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-center px-4">
              <p className="text-lg font-semibold text-gray-900">{processingMessage}</p>
              <p className="text-sm text-gray-600 mt-2">Bitte warten Sie einen Moment...</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:pt-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">📝 Artikel bearbeiten</h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] space-y-4 modal-scroll">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={articleData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Artikeltitel..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kategorie *
            </label>
            <select
              value={articleData.category_id}
              onChange={(e) => handleChange('category_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Kategorie wählen...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zusammenfassung
            </label>
            <textarea
              value={articleData.summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y min-h-[50px] text-sm"
              placeholder="Kurze Zusammenfassung..."
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inhalt *
            </label>
            <textarea
              value={articleData.content}
              onChange={(e) => handleChange('content', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y min-h-[120px]"
              placeholder="Artikelinhalt (Markdown)..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <TagIcon size={16} className="inline mr-1" />
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tag hinzufügen..."
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Hinzufügen
              </button>
            </div>
            {articleData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {articleData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ImageIcon size={16} className="inline mr-1" />
              Fotos & Dateien
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia}
              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-gray-600 hover:text-blue-600 disabled:opacity-50"
            >
              <Upload size={20} className="inline mr-2" />
              {uploadingMedia ? 'Hochladen...' : 'Dateien hochladen'}
            </button>

            {articleData.media.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                {articleData.media.map((media) => (
                  <div key={media.id} className="relative group">
                    {media.type === 'image' ? (
                      <img
                        src={media.preview}
                        alt={media.name}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                        <div className="text-center">
                          <Upload size={24} className="mx-auto text-gray-400" />
                          <p className="text-xs text-gray-600 mt-1">{media.name}</p>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveMedia(media.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audio Comments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mic size={16} className="inline mr-1" />
              Audiokommentare
            </label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <VoiceRecorder
                onRecordingComplete={handleAudioCommentComplete}
                existingAudioUrl={null}
              />

              {articleData.audioComments.length > 0 && (
                <div className="mt-4 space-y-2">
                  {articleData.audioComments.map((comment) => (
                    <div key={comment.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                      <audio src={comment.url} controls className="flex-1 h-10" />
                      <button
                        onClick={() => handleRemoveAudioComment(comment.id)}
                        className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-full transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            Speichern
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalMarkup, document.body);
  }

  return modalMarkup;
};

export default DictationArticleEditor;
