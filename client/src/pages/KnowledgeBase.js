import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import {
  BookOpen,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  User,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  Layers,
  Save,
  AlertCircle,
  ToggleLeft
} from 'lucide-react';
import api from '../utils/api';
import { uploadKBMedia, deleteKBMedia, getArticleVersions, restoreArticleVersion } from '../utils/apiEnhanced';
import { getAssetUrl } from '../utils/media';
import toast from 'react-hot-toast';
import { useMobile } from '../hooks/useMobile';

// Constants
const ITEMS_PER_PAGE = 12;
const SEARCH_DEBOUNCE_MS = 300;
const SORT_OPTIONS = [
  { value: 'recent', label: 'Neueste zuerst' },
  { value: 'popular', label: 'Meist angesehen' },
  { value: 'helpful', label: 'Hilfreichste' },
  { value: 'oldest', label: 'Älteste zuerst' }
];

const STATUS_TABS = [
  { id: 'published', label: 'Veröffentlicht' },
  { id: 'draft', label: 'Entwürfe' },
  { id: 'archived', label: 'Archiv' }
];

// Category Icon Component
const CategoryIcon = ({ icon, color }) => {
  const iconMap = {
    book: BookOpen,
    layers: Layers,
    'file-text': FileText,
    tag: Tag
  };

  const IconComponent = iconMap[icon] || BookOpen;
  return <IconComponent size={18} style={{ color }} />;
};

// Utility Functions
const truncateText = (text, maxLength = 150) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Empty State Component
const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <Icon size={64} className="text-gray-300 mb-4" />
    <h3 className="text-xl font-semibold text-gray-700 mb-2">{title}</h3>
    <p className="text-gray-500">{description}</p>
  </div>
);

// Article Card Component
const ArticleCard = ({ article, onClick, canManage, onEdit, onStatusChange }) => {
  const preview = article.summary || truncateText(article.content, 160);

  return (
    <div onClick={onClick} className="kb-article-card group cursor-pointer">
      <div className="kb-article-card__tag-row">
        <span className="kb-article-card__status">
          {article.status === 'published' ? 'Veröffentlicht' : 'Entwurf'}
        </span>
        {article.category_name && (
          <span
            className="kb-article-card__category"
            style={{ color: article.category_color || '#2563eb' }}
          >
            {article.category_name}
          </span>
        )}
      </div>

      <h3 className="kb-article-card__title">{article.title}</h3>

      {preview && <p className="kb-article-card__excerpt">{preview}</p>}

      <div className="kb-article-card__meta">
        <div className="kb-article-card__meta-group">
          <User size={14} />
          <span>{article.author_name || 'Unbekannt'}</span>
        </div>
        <div className="kb-article-card__meta-group">
          <Calendar size={14} />
          <span>{formatDate(article.created_at)}</span>
        </div>
        <div className="kb-article-card__meta-group">
          <Eye size={14} />
          <span>{article.views_count || 0}</span>
        </div>
      </div>

      {article.tags && article.tags.length > 0 && (
        <div className="kb-article-card__tags">
          {article.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="kb-article-card__tag">
              #{tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="kb-article-card__tag muted">
              +{article.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="kb-article-card__stats">
        <div>
          <ThumbsUp size={14} />
          <span>{article.helpful_count || 0}</span>
        </div>
        <div>
          <ThumbsDown size={14} />
          <span>{article.not_helpful_count || 0}</span>
        </div>
      </div>

      {canManage && (
        <div className="kb-article-card__actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(article);
            }}
          >
            <Edit2 size={12} />
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus =
                article.status === 'published' ? 'archived' : 'published';
              onStatusChange?.(article, nextStatus);
            }}
          >
            <ToggleLeft size={12} />
            {article.status === 'published' ? 'Archivieren' : 'Veröffentlichen'}
          </button>
        </div>
      )}
    </div>
  );
};

// Article View Modal Component
const ArticleViewModal = ({
  article,
  onClose,
  onEdit,
  onDelete,
  onVote,
  onArticleUpdated,
  currentUserId,
  currentUserRole
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const canEdit = article.author_id === currentUserId;
  const canDelete =
    canEdit || ['admin', 'superadmin'].includes(currentUserRole);
  const canRestore = ['admin', 'superadmin'].includes(currentUserRole);

  const handleVote = async (isHelpful) => {
    if (voting) return;
    setVoting(true);
    try {
      await onVote(article.id, isHelpful);
    } finally {
      setVoting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Möchten Sie diesen Artikel wirklich löschen?')) return;
    setIsDeleting(true);
    try {
      await onDelete(article.id);
      onClose();
    } catch (error) {
      setIsDeleting(false);
    }
  };

  const renderMediaPreview = (media) => {
    const url = getAssetUrl(media.file_url);
    if (media.media_type === 'image') {
      return (
        <img
          src={url}
          alt={media.caption || media.file_name}
          className="w-full h-40 object-cover rounded-lg"
        />
      );
    }
    if (media.media_type === 'audio') {
      return <audio controls className="w-full"><source src={url} /></audio>;
    }
    if (media.media_type === 'video') {
      return (
        <video controls className="w-full rounded-lg h-40 object-cover">
          <source src={url} />
        </video>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 underline"
      >
        Dokument öffnen
      </a>
    );
  };

  const toggleVersions = async () => {
    if (!showVersions && versions.length === 0) {
      setVersionsLoading(true);
      try {
        const response = await getArticleVersions(article.id);
        setVersions(response.data);
      } catch (error) {
        console.error('Error loading versions:', error);
        toast.error('Versionen konnten nicht geladen werden');
      } finally {
        setVersionsLoading(false);
      }
    }
    setShowVersions((prev) => !prev);
  };

  const handleRestoreVersion = async (versionNumber) => {
    if (!canRestore) return;
    if (!window.confirm(`Artikel auf Version ${versionNumber} zurücksetzen?`)) {
      return;
    }

    try {
      await restoreArticleVersion(article.id, versionNumber);
      toast.success(`Version ${versionNumber} wiederhergestellt`);
      setShowVersions(false);
      if (onArticleUpdated) {
        onArticleUpdated(article.id);
      }
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Version konnte nicht wiederhergestellt werden');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex-1 mr-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {article.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <User size={16} className="mr-1" />
                <span>{article.author_name || 'Unbekannt'}</span>
              </div>
              <div className="flex items-center">
                <Calendar size={16} className="mr-1" />
                <span>{formatDateTime(article.created_at)}</span>
              </div>
              <div className="flex items-center">
                <Eye size={16} className="mr-1" />
                <span>{article.views_count || 0} Aufrufe</span>
              </div>
              {article.category_name && (
                <span
                  className="px-2 py-1 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: article.category_color || '#6B7280' }}
                >
                  {article.category_name}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {article.summary && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900">
              {article.summary}
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {article.media && article.media.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Medien</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {article.media.map((media) => (
                  <div key={media.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                    {renderMediaPreview(media)}
                    {media.caption && (
                      <p className="text-xs text-gray-600">{media.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
              <Tag size={16} className="text-gray-500 mr-2" />
              {article.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={toggleVersions}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-2"
            >
              <Layers size={16} />
              {showVersions ? 'Versionen ausblenden' : 'Versionen anzeigen'}
            </button>

            {showVersions && (
              <div className="mt-4 space-y-3">
                {versionsLoading ? (
                  <LoadingSpinner />
                ) : versions.length === 0 ? (
                  <p className="text-sm text-gray-500">Keine Versionen verfügbar.</p>
                ) : (
                  versions.map((version) => (
                    <div
                      key={version.id || version.version_number}
                      className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-white"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Version {version.version_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(version.created_at)} · {version.author_name || 'Unbekannt'}
                        </p>
                      </div>
                      {canRestore && (
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(version.version_number)}
                          className="text-xs px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          Wiederherstellen
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">War dieser Artikel hilfreich?</span>
            <button
              onClick={() => handleVote(true)}
              disabled={voting || article.user_vote === true}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                article.user_vote === true
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 hover:bg-green-50 text-gray-700 hover:text-green-700'
              } disabled:opacity-50`}
            >
              <ThumbsUp size={16} />
              <span className="text-sm font-medium">{article.helpful_count || 0}</span>
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={voting || article.user_vote === false}
              className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                article.user_vote === false
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700'
              } disabled:opacity-50`}
            >
              <ThumbsDown size={16} />
              <span className="text-sm font-medium">{article.not_helpful_count || 0}</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {canEdit && (
              <button
                onClick={() => onEdit(article)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Edit2 size={16} />
                <span>Bearbeiten</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>{isDeleting ? 'Wird gelöscht...' : 'Löschen'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Article Editor Modal Component
const ArticleEditorModal = ({ article, categories, allTags, onSave, onClose }) => {
  const [title, setTitle] = useState(article?.title || '');
  const [content, setContent] = useState(article?.content || '');
  const [summary, setSummary] = useState(article?.summary || '');
  const [categoryId, setCategoryId] = useState(article?.category_id || '');
  const [tags, setTags] = useState(article?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [status, setStatus] = useState(article?.status || 'draft');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [existingMedia, setExistingMedia] = useState(article?.media || []);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const isEditing = !!article?.id;

  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return [];
    const input = tagInput.toLowerCase();
    return allTags
      .filter(tag =>
        tag.name.toLowerCase().includes(input) &&
        !tags.includes(tag.name)
      )
      .slice(0, 5);
  }, [tagInput, tags, allTags]);

  const handleAddTag = (tagName) => {
    if (tagName && !tags.includes(tagName) && tags.length < 10) {
      setTags([...tags, tagName]);
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleMediaSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (mediaFiles.length + files.length > 10) {
      toast.error('Maximal 10 Anhänge pro Speichervorgang erlaubt');
      event.target.value = '';
      return;
    }

    const mapped = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
      caption: ''
    }));

    setMediaFiles((prev) => [...prev, ...mapped]);
    event.target.value = '';
  };

  const handlePendingMediaCaption = (id, caption) => {
    setMediaFiles((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, caption } : entry
      )
    );
  };

  const removePendingMedia = (id) => {
    setMediaFiles((prev) => {
      const target = prev.find((entry) => entry.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((entry) => entry.id !== id);
    });
  };

  const handleDeleteExistingMedia = async (mediaId) => {
    try {
      await deleteKBMedia(mediaId);
      setExistingMedia((prev) => prev.filter((item) => item.id !== mediaId));
      toast.success('Anhang entfernt');
    } catch (error) {
      console.error('Error deleting media:', error);
      toast.error('Fehler beim Entfernen des Anhangs');
    }
  };

  const uploadPendingMedia = async (articleId) => {
    if (!mediaFiles.length) {
      return;
    }

    setUploadingMedia(true);
    try {
      for (const [index, media] of mediaFiles.entries()) {
        const formData = new FormData();
        formData.append('file', media.file);
        if (media.caption) {
          formData.append('caption', media.caption);
        }
        formData.append('display_order', index);
        await uploadKBMedia(articleId, formData);
      }
      mediaFiles.forEach((entry) => {
        if (entry.previewUrl) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
      setMediaFiles([]);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }

    if (!content.trim()) {
      toast.error('Bitte geben Sie Inhalt ein');
      return;
    }

    if (!categoryId) {
      toast.error('Bitte wählen Sie eine Kategorie aus');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim() || null,
        category_id: parseInt(categoryId, 10),
        tags: tags.map((tag) => tag.trim()).filter(Boolean),
        status
      };

      const savedArticle = await onSave(payload);

      if (savedArticle?.id) {
        await uploadPendingMedia(savedArticle.id);
      }

      onClose();
    } catch (error) {
      setIsSaving(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Artikel-Titel eingeben"
                maxLength={200}
                required
              />
            </div>

            {/* Category and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategorie *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Kategorie auswählen</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="draft">Entwurf</option>
                  <option value="published">Veröffentlicht</option>
                </select>
              </div>
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zusammenfassung (max. 200 Zeichen)
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value.slice(0, 200))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Kurze Beschreibung des Artikels"
                maxLength={200}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {summary.length}/200
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (max. 10)
              </label>
              <div className="relative">
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-blue-700 hover:text-blue-900"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      e.preventDefault();
                      handleAddTag(tagInput.trim());
                    }
                  }}
                  onFocus={() => setShowTagSuggestions(true)}
                  disabled={tags.length >= 10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                  placeholder={tags.length >= 10 ? 'Maximum erreicht' : 'Tag eingeben und Enter drücken'}
                />

                {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredTagSuggestions.map((tag, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAddTag(tag.name)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>{tag.name}</span>
                        <span className="text-xs text-gray-500">
                          {tag.usage_count} mal verwendet
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Existing media */}
            {isEditing && existingMedia?.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Bereits hochgeladene Medien
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {existingMedia.map((media) => (
                    <div
                      key={media.id}
                      className="flex items-center justify-between border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {media.media_type === 'image'
                            ? '🖼️'
                            : media.media_type === 'audio'
                            ? '🎧'
                            : media.media_type === 'video'
                            ? '🎬'
                            : '📄'}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {media.file_name || media.media_type}
                          </p>
                          {media.caption && (
                            <p className="text-xs text-gray-500">{media.caption}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingMedia(media.id)}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                      >
                        Entfernen
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Media uploader */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medien hinzufügen (Foto, Video, Audio, Dokument)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*,application/pdf"
                  id="kb-media-input"
                  className="hidden"
                  onChange={handleMediaSelect}
                />
                <label
                  htmlFor="kb-media-input"
                  className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                >
                  Dateien auswählen
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Unterstützt Bilder, Videos, Audio und PDFs. Max. 10 Dateien pro Speichervorgang.
                </p>
              </div>

              {mediaFiles.length > 0 && (
                <div className="mt-4 space-y-3">
                  {mediaFiles.map((media) => (
                    <div key={media.id} className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {media.file.type.startsWith('image/')
                              ? '🖼️'
                              : media.file.type.startsWith('audio/')
                              ? '🎧'
                              : media.file.type.startsWith('video/')
                              ? '🎬'
                              : '📄'}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{media.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(media.file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingMedia(media.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold"
                        >
                          Entfernen
                        </button>
                      </div>
                      <input
                        type="text"
                        value={media.caption}
                        onChange={(e) => handlePendingMediaCaption(media.id, e.target.value)}
                        placeholder="Kurzbeschreibung (optional)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Inhalt * (Markdown)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showPreview ? 'Editor anzeigen' : 'Vorschau anzeigen'}
                </button>
              </div>

              {showPreview ? (
                <div className="border border-gray-300 rounded-md p-4 min-h-[400px] prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {content || '*Kein Inhalt zum Anzeigen*'}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Artikel-Inhalt in Markdown schreiben..."
                  className="w-full h-96 p-4 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving || uploadingMedia}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving || uploadingMedia ? 'Wird gespeichert...' : 'Speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Knowledge Base Component
const KnowledgeBaseV3 = () => {
  const location = useLocation();
  const { isMobile } = useMobile();
  // State Management
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [statusFilter, setStatusFilter] = useState('published');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const isAdminUser = useMemo(
    () => ['admin', 'superadmin'].includes(currentUser?.role),
    [currentUser]
  );

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get('/auth/user');
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const queryParam = params.get('q');
    if (queryParam && queryParam !== searchQuery) {
      setSearchQuery(queryParam);
    }
  }, [location.search, searchQuery]);

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/kb/categories');
        setCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Fehler beim Laden der Kategorien');
      }
    };
    fetchCategories();
  }, []);

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/kb/tags');
        setAllTags(response.data.all || []);
      } catch (error) {
        console.error('Error fetching tags:', error);
      }
    };
    fetchTags();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: ITEMS_PER_PAGE * 100, // Fetch more for client-side pagination
        offset: 0,
        sort: sortBy
      });

      if (selectedCategory) {
        params.append('category_id', selectedCategory);
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await api.get(`/kb/articles?${params.toString()}`);
      setArticles(response.data);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Fehler beim Laden der Artikel');
      setArticles([]);
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [selectedCategory, debouncedSearch, sortBy, statusFilter]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Pagination
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return articles.slice(startIndex, endIndex);
  }, [articles, currentPage]);

  const totalPages = Math.ceil(articles.length / ITEMS_PER_PAGE);

  const articleStats = useMemo(() => {
    const total = articles.length;
    const media = articles.filter((article) => (article.media?.length || 0) > 0).length;
    const lastUpdatedRaw = articles
      .map((article) => article.updated_at || article.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    return {
      total,
      media,
      lastUpdated: lastUpdatedRaw ? formatDate(lastUpdatedRaw) : '—'
    };
  }, [articles]);

  // Handlers
  const handleArticleClick = async (article) => {
    try {
      const response = await api.get(`/kb/articles/${article.id}`);
      setSelectedArticle(response.data);
      setIsViewModalOpen(true);
    } catch (error) {
      console.error('Error fetching article:', error);
      toast.error('Fehler beim Laden des Artikels');
    }
  };

  const refreshSelectedArticle = useCallback(async (articleId) => {
    if (!articleId) return;
    try {
      const response = await api.get(`/kb/articles/${articleId}`);
      setSelectedArticle(response.data);
    } catch (error) {
      console.error('Error refreshing article:', error);
    }
  }, []);

  const handleCreateArticle = () => {
    setEditingArticle(null);
    setIsEditorModalOpen(true);
  };

  const handleEditArticle = (article) => {
    setEditingArticle(article);
    setIsViewModalOpen(false);
    setIsEditorModalOpen(true);
  };

  const handleSaveArticle = async (articleData) => {
    try {
      let response;
      const isEditingExisting = Boolean(editingArticle?.id);

      if (isEditingExisting) {
        response = await api.put(`/kb/articles/${editingArticle.id}`, articleData);
        toast.success('Artikel erfolgreich aktualisiert');
      } else {
        response = await api.post('/kb/articles', articleData);
        toast.success('Artikel erfolgreich erstellt');
      }

      const savedArticle = response?.data;
      fetchArticles();

      // Refresh tags after saving
      const tagsResponse = await api.get('/kb/tags');
      setAllTags(tagsResponse.data.all || []);

      if (savedArticle?.id && selectedArticle?.id === savedArticle.id) {
        const refreshed = await api.get(`/kb/articles/${savedArticle.id}`);
        setSelectedArticle(refreshed.data);
      }

      return savedArticle;
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Speichern des Artikels');
      throw error;
    }
  };

  const handleDeleteArticle = async (articleId) => {
    try {
      await api.delete(`/kb/articles/${articleId}`);
      toast.success('Artikel erfolgreich gelöscht');
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Löschen des Artikels');
      throw error;
    }
  };

  const handleChangeArticleStatus = async (article, nextStatus) => {
    try {
      await api.put(`/kb/articles/${article.id}`, { status: nextStatus });
      toast.success(
        nextStatus === 'published' ? 'Artikel veröffentlicht' : 'Artikel archiviert'
      );
      fetchArticles();
      if (selectedArticle?.id === article.id) {
        refreshSelectedArticle(article.id);
      }
    } catch (error) {
      console.error('Error updating article status:', error);
      toast.error(error.response?.data?.error || 'Status konnte nicht geändert werden');
    }
  };

  const handleVote = async (articleId, isHelpful) => {
    try {
      const response = await api.post(`/kb/articles/${articleId}/vote`, { is_helpful: isHelpful });

      // Update the selected article with new vote counts
      setSelectedArticle(prev => ({
        ...prev,
        helpful_count: response.data.helpful_count,
        not_helpful_count: response.data.not_helpful_count,
        user_vote: isHelpful
      }));

      // Update the article in the list
      setArticles(prev => prev.map(article =>
        article.id === articleId
          ? {
              ...article,
              helpful_count: response.data.helpful_count,
              not_helpful_count: response.data.not_helpful_count
            }
          : article
      ));

      toast.success(isHelpful ? 'Als hilfreich markiert' : 'Als nicht hilfreich markiert');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Abstimmen');
    }
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="kb-page">
      <div className="kb-layout">
      {/* Sidebar */}
      <div className="kb-sidebar hidden lg:flex lg:flex-col">
        <div className="kb-sidebar__header">
          <h2 className="kb-sidebar__title">
            <BookOpen className="mr-2" size={20} />
            Knowledge Base
          </h2>
        </div>

        <div className="kb-sidebar__content">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`kb-sidebar__item ${selectedCategory === null ? 'active' : ''}`}
          >
            <div className="kb-sidebar__item-label">
              <div className="flex items-center">
                <Layers size={18} className="mr-2" />
                <span>Alle Artikel</span>
              </div>
            </div>
            <span className="kb-sidebar__badge">{articles.length}</span>
          </button>

          {categories.length > 0 && (
            <>
              <div className="kb-sidebar__section">
                Kategorien
              </div>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`kb-sidebar__item ${selectedCategory === category.id ? 'active' : ''}`}
                >
                  <div className="kb-sidebar__item-label">
                    <CategoryIcon icon={category.icon} color={category.color} />
                    <span className="ml-2">{category.name}</span>
                  </div>
                  <span className="kb-sidebar__badge">
                    {category.articles_count || 0}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="kb-main flex-1 flex flex-col overflow-hidden">
        <div className="kb-hero">
          <div>
            <p className="kb-hero__eyebrow">Knowledge Hub</p>
            <h1>Alles, was dein Team wissen muss</h1>
            <p className="kb-hero__subtitle">
              Artikel, Medien und SOPs an einem Ort – optimiert für Desktop und Mobile.
            </p>
          </div>
          <div className="kb-hero__stats">
            <div>
              <span>Artikel</span>
              <strong>{articleStats.total}</strong>
            </div>
            <div>
              <span>Medien</span>
              <strong>{articleStats.media}</strong>
            </div>
            <div>
              <span>Letztes Update</span>
              <strong>{articleStats.lastUpdated}</strong>
            </div>
          </div>
        </div>
        {/* Header with Search and Filters */}
        <div className="kb-filters-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="kb-search relative">
                <Search className="kb-search__icon" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Artikel, Medien oder Tags suchen..."
                  className="kb-search__input"
                />
              </div>
            </div>

            {/* Sort and Create */}
            <div className="kb-controls">
              <div className="kb-sort">
                <Filter size={16} className="text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCreateArticle}
                className="kb-create-btn"
              >
                <Plus size={18} />
                <span>Artikel erstellen</span>
              </button>
            </div>
          </div>

          <div className="kb-status-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={statusFilter === tab.id ? 'active' : ''}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isMobile && categories.length > 0 && (
            <div className="kb-mobile-categories">
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`kb-mobile-category ${selectedCategory === category.id ? 'active' : ''}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          {/* Active Filters */}
          {(selectedCategory || debouncedSearch) && (
            <div className="kb-active-filters">
              {selectedCategory && (
                <span className="kb-chip kb-chip--blue">
                  {categories.find(c => c.id === selectedCategory)?.name}
                  <button type="button" onClick={() => setSelectedCategory(null)}>
                    <X size={14} />
                  </button>
                </span>
              )}
              {debouncedSearch && (
                <span className="kb-chip">
                  Suche: “{debouncedSearch}”
                  <button type="button" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Article Grid */}
        <div className="kb-grid-wrapper flex-1 overflow-y-auto p-6">
          {isInitialLoad ? (
            <LoadingSpinner />
          ) : articles.length === 0 ? (
            <EmptyState
              icon={debouncedSearch ? Search : FileText}
              title={debouncedSearch ? 'Keine Artikel gefunden' : 'Noch keine Artikel'}
              description={debouncedSearch ? 'Versuchen Sie es mit anderen Suchbegriffen' : 'Erstellen Sie Ihren ersten Artikel'}
            />
          ) : (
            <>
              <div className="kb-grid">
                {isLoading ? (
                  <div className="col-span-full">
                    <LoadingSpinner />
                  </div>
                ) : (
                  paginatedArticles.map(article => {
                    const canManage = isAdminUser || article.author_id === currentUser?.id;
                    return (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onClick={() => handleArticleClick(article)}
                        canManage={canManage}
                        onEdit={handleEditArticle}
                        onStatusChange={handleChangeArticleStatus}
                      />
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="kb-pagination">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="kb-pagination__pages">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="kb-pagination__ellipsis">…</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? 'active' : ''}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {isViewModalOpen && selectedArticle && (
        <ArticleViewModal
          article={selectedArticle}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedArticle(null);
          }}
          onEdit={handleEditArticle}
          onDelete={handleDeleteArticle}
          onVote={handleVote}
          onArticleUpdated={refreshSelectedArticle}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
        />
      )}

      {isEditorModalOpen && (
        <ArticleEditorModal
          article={editingArticle}
          categories={categories}
          allTags={allTags}
          onSave={handleSaveArticle}
          onClose={() => {
            setIsEditorModalOpen(false);
            setEditingArticle(null);
          }}
        />
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={handleCreateArticle}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-40"
      >
        <Plus size={24} />
      </button>
    </div>
  );
};

export default KnowledgeBaseV3;
