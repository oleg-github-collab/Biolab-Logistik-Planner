import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';
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
  AlertCircle
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Constants
const ITEMS_PER_PAGE = 12;
const SEARCH_DEBOUNCE_MS = 300;
const SORT_OPTIONS = [
  { value: 'recent', label: 'Neueste zuerst' },
  { value: 'popular', label: 'Meist angesehen' },
  { value: 'helpful', label: 'Hilfreichste' },
  { value: 'oldest', label: 'Älteste zuerst' }
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
const ArticleCard = ({ article, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
          {article.title}
        </h3>
        {article.category_name && (
          <span
            className="ml-3 px-2 py-1 text-xs font-medium rounded-full text-white whitespace-nowrap"
            style={{ backgroundColor: article.category_color || '#6B7280' }}
          >
            {article.category_name}
          </span>
        )}
      </div>

      {article.summary && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {article.summary}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <User size={14} className="mr-1" />
            <span>{article.author_name || 'Unbekannt'}</span>
          </div>
          <div className="flex items-center">
            <Calendar size={14} className="mr-1" />
            <span>{formatDate(article.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <Eye size={14} className="mr-1" />
            <span>{article.views_count || 0}</span>
          </div>
          <div className="flex items-center">
            <ThumbsUp size={14} className="mr-1" />
            <span>{article.helpful_count || 0}</span>
          </div>
          <div className="flex items-center">
            <ThumbsDown size={14} className="mr-1" />
            <span>{article.not_helpful_count || 0}</span>
          </div>
        </div>
      </div>

      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {article.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
            >
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="px-2 py-1 text-xs text-gray-500">
              +{article.tags.length - 3} mehr
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Article View Modal Component
const ArticleViewModal = ({ article, onClose, onEdit, onDelete, onVote, currentUserId }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [voting, setVoting] = useState(false);

  const canEdit = article.author_id === currentUserId;
  const canDelete = article.author_id === currentUserId;

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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200">
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
      await onSave({
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim() || null,
        category_id: parseInt(categoryId),
        tags,
        status
      });
      onClose();
    } catch (error) {
      setIsSaving(false);
    }
  };

  const simpleMdeOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: 'Artikel-Inhalt in Markdown schreiben...',
    status: false,
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', '|',
      'code', 'table', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    minHeight: '400px'
  }), []);

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
                <SimpleMDE
                  value={content}
                  onChange={setContent}
                  options={simpleMdeOptions}
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
              disabled={isSaving}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              <span>{isSaving ? 'Wird gespeichert...' : 'Speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Knowledge Base Component
const KnowledgeBaseV3 = () => {
  // State Management
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

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
        status: 'published',
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
  }, [selectedCategory, debouncedSearch, sortBy]);

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
      if (editingArticle?.id) {
        await api.put(`/kb/articles/${editingArticle.id}`, articleData);
        toast.success('Artikel erfolgreich aktualisiert');
      } else {
        await api.post('/kb/articles', articleData);
        toast.success('Artikel erfolgreich erstellt');
      }
      fetchArticles();
      // Refresh tags after saving
      const tagsResponse = await api.get('/kb/tags');
      setAllTags(tagsResponse.data.all || []);
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <BookOpen className="mr-2" size={20} />
            Knowledge Base
          </h2>
        </div>

        <div className="p-4">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors mb-2 ${
              selectedCategory === null
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Layers size={18} className="mr-2" />
                <span>Alle Artikel</span>
              </div>
              <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
                {articles.length}
              </span>
            </div>
          </button>

          {categories.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">
                Kategorien
              </div>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`w-full text-left px-4 py-3 rounded-md transition-colors mb-1 ${
                    selectedCategory === category.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CategoryIcon icon={category.icon} color={category.color} />
                      <span className="ml-2">{category.name}</span>
                    </div>
                    <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">
                      {category.articles_count || 0}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Artikel durchsuchen..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Sort and Create */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter size={18} className="text-gray-500" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {SORT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCreateArticle}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                <span className="hidden md:inline">Artikel erstellen</span>
              </button>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedCategory || debouncedSearch) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedCategory && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {categories.find(c => c.id === selectedCategory)?.name}
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="ml-2 text-blue-700 hover:text-blue-900"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
              {debouncedSearch && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  Suche: "{debouncedSearch}"
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-2 text-blue-700 hover:text-blue-900"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Article Grid */}
        <div className="flex-1 overflow-y-auto p-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                  <div className="col-span-full">
                    <LoadingSpinner />
                  </div>
                ) : (
                  paginatedArticles.map(article => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onClick={() => handleArticleClick(article)}
                    />
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <React.Fragment key={page}>
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-2 text-gray-500">...</span>
                          )}
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`px-4 py-2 rounded-md ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
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
          currentUserId={currentUser?.id}
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
