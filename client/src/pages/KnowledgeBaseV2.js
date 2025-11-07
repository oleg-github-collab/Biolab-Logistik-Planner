import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Plus, Book, ThumbsUp, ThumbsDown, MessageCircle, Eye, X,
  ArrowLeft, Filter, TrendingUp, Clock, Sparkles, FileText,
  Grid, List, Save, Send, Tag, History, RotateCcw, ChevronDown,
  ChevronUp, Calendar, User, CheckCircle, XCircle
} from 'lucide-react';
import {
  getKBCategories, getKBArticles, searchKB, getKBArticle,
  createKBArticle, voteKBArticle, updateKBArticle
} from '../utils/apiEnhanced';
import toast from 'react-hot-toast';
import axios from 'axios';

// Markdown Editor Component (SimpleMDE integration)
// Note: Install with: npm install react-simplemde-editor easymde
import SimpleMDE from 'react-simplemde-editor';
import 'easymde/dist/easymde.min.css';

// Markdown Renderer Component
// Note: Install with: npm install react-markdown remark-gfm rehype-highlight
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

const KnowledgeBaseV2 = () => {
  // State Management
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const articlesPerPage = 10;

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showVersionsModal, setShowVersionsModal] = useState(false);

  // Article Editor States
  const [newArticle, setNewArticle] = useState({
    title: '',
    content: '',
    summary: '',
    category_id: null,
    tags: [],
    status: 'draft',
    thumbnail: ''
  });

  // Tags State
  const [availableTags, setAvailableTags] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Versions State
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Mobile Filter State
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // SimpleMDE Configuration
  const mdeOptions = useMemo(() => ({
    spellChecker: false,
    placeholder: 'Schreiben Sie Ihren Artikel hier mit Markdown...',
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'code', 'unordered-list', 'ordered-list', '|',
      'link', 'image', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    sideBySideFullscreen: false,
    status: ['lines', 'words', 'cursor'],
    autosave: {
      enabled: true,
      uniqueId: 'kb-article-draft',
      delay: 3000,
    },
    renderingConfig: {
      singleLineBreaks: false,
      codeSyntaxHighlighting: true,
    }
  }), []);

  // Load Categories
  const loadCategories = useCallback(async () => {
    try {
      const response = await getKBCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Fehler beim Laden der Kategorien');
    }
  }, []);

  // Load Tags
  const loadTags = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/kb/tags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableTags(response.data.all_tags || []);
      setPopularTags(response.data.popular_tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);

  // Load Articles with Filtering and Sorting
  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;

      // Apply sorting
      switch (sortBy) {
        case 'newest':
          params.sort = 'recent';
          break;
        case 'oldest':
          params.sort = 'oldest';
          break;
        case 'popular':
          params.sort = 'popular';
          break;
        default:
          params.sort = 'recent';
      }

      const response = await getKBArticles(params);
      setArticles(response.data);
    } catch (error) {
      console.error('Error loading articles:', error);
      toast.error('Fehler beim Laden der Artikel');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy]);

  // Debounced Search Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search Articles
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        loadArticles();
        return;
      }

      try {
        setLoading(true);
        const response = await searchKB(debouncedSearchQuery, {
          category_id: selectedCategory
        });
        setArticles(response.data);
        setCurrentPage(1); // Reset to first page on search
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Suchfehler');
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, selectedCategory, loadArticles]);

  // Initial Load
  useEffect(() => {
    loadCategories();
    loadTags();
  }, [loadCategories, loadTags]);

  useEffect(() => {
    if (!debouncedSearchQuery) {
      loadArticles();
    }
  }, [loadArticles, debouncedSearchQuery]);

  // Handle Article Click
  const handleArticleClick = async (articleId) => {
    try {
      const response = await getKBArticle(articleId);
      setSelectedArticle(response.data);
    } catch (error) {
      toast.error('Fehler beim Laden des Artikels');
    }
  };

  // Handle Vote
  const handleVote = async (articleId, isHelpful) => {
    try {
      await voteKBArticle(articleId, isHelpful);
      toast.success(isHelpful ? 'Als hilfreich markiert' : 'Feedback gespeichert');
      handleArticleClick(articleId); // Reload
    } catch (error) {
      toast.error('Fehler beim Speichern der Bewertung');
    }
  };

  // Tag Management
  const handleAddTag = (tag) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !newArticle.tags.includes(trimmedTag)) {
      setNewArticle({
        ...newArticle,
        tags: [...newArticle.tags, trimmedTag]
      });
      setTagInput('');
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setNewArticle({
      ...newArticle,
      tags: newArticle.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleTagInputChange = (e) => {
    const value = e.target.value;
    setTagInput(value);
    setShowTagSuggestions(value.length > 0);
  };

  const handleTagInputKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  // Filter tag suggestions
  const filteredTagSuggestions = useMemo(() => {
    if (!tagInput) return popularTags.slice(0, 10);

    const searchTerm = tagInput.toLowerCase();
    return availableTags
      .filter(tag =>
        tag.toLowerCase().includes(searchTerm) &&
        !newArticle.tags.includes(tag.toLowerCase())
      )
      .slice(0, 10);
  }, [tagInput, availableTags, popularTags, newArticle.tags]);

  // Create or Update Article
  const handleSaveArticle = async (status = 'draft') => {
    if (!newArticle.title || !newArticle.content) {
      return toast.error('Titel und Inhalt erforderlich');
    }

    try {
      const articleData = {
        ...newArticle,
        status,
        tags: newArticle.tags.join(',')
      };

      await createKBArticle(articleData);

      toast.success(status === 'published'
        ? 'Artikel erfolgreich veröffentlicht!'
        : 'Entwurf gespeichert!');

      setShowCreateModal(false);
      setShowPreviewModal(false);
      resetArticleForm();
      loadArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  const resetArticleForm = () => {
    setNewArticle({
      title: '',
      content: '',
      summary: '',
      category_id: null,
      tags: [],
      status: 'draft',
      thumbnail: ''
    });
    setTagInput('');
  };

  // Load Article Versions
  const loadVersions = async (articleId) => {
    try {
      setLoadingVersions(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/kb/articles/${articleId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(response.data);
      setShowVersionsModal(true);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Fehler beim Laden der Versionen');
    } finally {
      setLoadingVersions(false);
    }
  };

  // Restore Article Version
  const handleRestoreVersion = async (versionId) => {
    if (!window.confirm('Möchten Sie diese Version wirklich wiederherstellen?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/kb/articles/${selectedArticle.id}/versions/${versionId}/restore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Version erfolgreich wiederhergestellt!');
      setShowVersionsModal(false);
      handleArticleClick(selectedArticle.id); // Reload article
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Fehler beim Wiederherstellen');
    }
  };

  // Pagination
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    return articles.slice(startIndex, endIndex);
  }, [articles, currentPage]);

  const totalPages = Math.ceil(articles.length / articlesPerPage);

  // Highlight Search Terms
  const highlightText = (text, query) => {
    if (!query || !text) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={index} className="bg-yellow-200 px-1">{part}</mark>
        : part
    );
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  // Article Detail View
  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20 lg:pb-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <button
            onClick={() => setSelectedArticle(null)}
            className="flex items-center gap-2 mb-6 text-blue-600 hover:text-blue-700 font-medium transition-colors group">
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Zurück zur Übersicht</span>
          </button>

          <article className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-medium">
                  {selectedArticle.category_name || 'Allgemein'}
                </span>
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <Eye className="w-4 h-4" />
                  <span>{selectedArticle.views_count || 0} Aufrufe</span>
                </div>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold leading-tight mb-4">
                {selectedArticle.title}
              </h1>

              {/* Tags */}
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedArticle.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content Section */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between pb-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedArticle.author_photo || '/default-avatar.png'}
                    alt={selectedArticle.author_name}
                    className="w-12 h-12 rounded-full border-2 border-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">{selectedArticle.author_name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(selectedArticle.created_at).toLocaleDateString('de-DE', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Last Modified & Versions Button */}
                <div className="text-right">
                  {selectedArticle.updated_at && selectedArticle.updated_at !== selectedArticle.created_at && (
                    <p className="text-xs text-gray-500 mb-2">
                      Letzte Änderung: {new Date(selectedArticle.updated_at).toLocaleDateString('de-DE')}
                      {selectedArticle.last_editor_name && (
                        <span> von {selectedArticle.last_editor_name}</span>
                      )}
                    </p>
                  )}
                  <button
                    onClick={() => loadVersions(selectedArticle.id)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <History className="w-4 h-4" />
                    Versionen anzeigen
                  </button>
                </div>
              </div>

              {/* Markdown Content */}
              <div className="prose prose-lg max-w-none mt-8">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  className="markdown-content">
                  {selectedArticle.content}
                </ReactMarkdown>
              </div>

              {/* Feedback Section */}
              <div className="mt-10 pt-8 border-t border-gray-200">
                <p className="text-lg font-semibold text-gray-900 mb-4">War dieser Artikel hilfreich?</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleVote(selectedArticle.id, true)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all font-medium">
                    <ThumbsUp className="w-5 h-5" />
                    Ja, hilfreich ({selectedArticle.helpful_count || 0})
                  </button>
                  <button
                    onClick={() => handleVote(selectedArticle.id, false)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:shadow-lg hover:scale-105 transition-all font-medium">
                    <ThumbsDown className="w-5 h-5" />
                    Nicht hilfreich ({selectedArticle.not_helpful_count || 0})
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* Versions Modal */}
        {showVersionsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-6 h-6" />
                  <h2 className="text-2xl font-bold">Versionshistorie</h2>
                </div>
                <button
                  onClick={() => setShowVersionsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
                {loadingVersions ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600">Versionen werden geladen...</p>
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Keine früheren Versionen verfügbar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {versions.map((version, index) => (
                      <div
                        key={version.id}
                        className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              index === 0 ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              {index === 0 ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <History className="w-5 h-5 text-gray-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  Version {versions.length - index}
                                </p>
                                {index === 0 && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    Aktuell
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                <User className="w-3 h-3" />
                                <span>{version.author_name || 'Unbekannt'}</span>
                                <span>•</span>
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {new Date(version.created_at).toLocaleDateString('de-DE', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {index !== 0 && (
                            <button
                              onClick={() => handleRestoreVersion(version.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                              <RotateCcw className="w-4 h-4" />
                              Wiederherstellen
                            </button>
                          )}
                        </div>

                        {/* Version Preview */}
                        <div className="bg-gray-50 rounded-lg p-4 mt-3">
                          <h4 className="font-semibold text-gray-900 mb-2">{version.title}</h4>
                          <div className="prose prose-sm max-w-none line-clamp-3">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {version.content?.substring(0, 200) + '...'}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Article List View
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20 lg:pb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 sm:px-6 lg:px-8 py-6 sm:py-10 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Book className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold">Wissensdatenbank V2</h1>
                <p className="text-sm sm:text-base text-white/80 mt-1">
                  Erweiterte Markdown-Unterstützung & Versionsverwaltung
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 hover:shadow-lg transition-all font-semibold">
              <Plus className="w-5 h-5" />
              <span>Neuer Artikel</span>
            </button>
          </div>

          {/* Search Bar with Clear Button */}
          <div className="flex gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Durchsuchen nach Titel, Inhalt oder Tags..."
                className="w-full pl-12 pr-12 py-3.5 rounded-xl text-gray-900 shadow-lg focus:ring-4 focus:ring-blue-300 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Results Info */}
          {debouncedSearchQuery && (
            <div className="mt-3 text-sm text-white/80">
              {articles.length} Ergebnis{articles.length !== 1 ? 'se' : ''} für "{debouncedSearchQuery}"
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Mobile Filter Button */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-2 w-full px-4 py-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all">
            <Filter className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Filter & Sortierung</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className={`
            lg:block lg:w-72 lg:flex-shrink-0
            ${showMobileFilters ? 'block' : 'hidden'}
          `}>
            <div className="bg-white rounded-2xl shadow-xl p-5 lg:sticky lg:top-6">
              {/* View Mode Toggle */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Ansicht
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                      viewMode === 'grid'
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}>
                    <Grid className="w-4 h-4" />
                    <span>Karten</span>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                      viewMode === 'list'
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}>
                    <List className="w-4 h-4" />
                    <span>Liste</span>
                  </button>
                </div>
              </div>

              {/* Sort Options */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Sortierung
                </h2>
                <div className="space-y-2">
                  <button
                    onClick={() => { setSortBy('newest'); setCurrentPage(1); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                      sortBy === 'newest' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                    }`}>
                    <Clock className="w-4 h-4 inline mr-2" />
                    Neueste zuerst
                  </button>
                  <button
                    onClick={() => { setSortBy('oldest'); setCurrentPage(1); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                      sortBy === 'oldest' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                    }`}>
                    <History className="w-4 h-4 inline mr-2" />
                    Älteste zuerst
                  </button>
                  <button
                    onClick={() => { setSortBy('popular'); setCurrentPage(1); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                      sortBy === 'popular' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                    }`}>
                    <TrendingUp className="w-4 h-4 inline mr-2" />
                    Beliebteste
                  </button>
                </div>
              </div>

              {/* Categories */}
              <h2 className="font-bold text-gray-900 mb-3">Kategorien</h2>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowMobileFilters(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                    !selectedCategory ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                  }`}>
                  Alle Artikel
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setShowMobileFilters(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center justify-between transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'hover:bg-gray-100'
                    }`}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                      {cat.articles_count || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Popular Tags */}
              {popularTags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" />
                    Beliebte Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.slice(0, 10).map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSearchQuery(tag)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-full text-sm transition-colors">
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Articles Display */}
          <main className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">Artikel werden geladen...</p>
              </div>
            ) : paginatedArticles.length === 0 ? (
              <div className="text-center py-20">
                <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Keine Artikel gefunden</p>
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                    }}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
                    Filter zurücksetzen
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Grid View */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {paginatedArticles.map(article => (
                      <div
                        key={article.id}
                        onClick={() => handleArticleClick(article.id)}
                        className="bg-white rounded-2xl shadow-md hover:shadow-2xl p-5 cursor-pointer transition-all hover:scale-[1.02] border border-gray-100 flex flex-col">

                        {/* Thumbnail */}
                        {article.thumbnail && (
                          <div className="mb-4 -mx-5 -mt-5">
                            <img
                              src={article.thumbnail}
                              alt={article.title}
                              className="w-full h-48 object-cover rounded-t-2xl"
                            />
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="text-lg font-bold text-gray-900 leading-tight flex-1">
                            {highlightText(article.title, debouncedSearchQuery)}
                          </h3>
                          {article.category_name && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{
                              backgroundColor: (article.category_color || '#3B82F6') + '20',
                              color: article.category_color || '#3B82F6'
                            }}>
                              {article.category_name}
                            </span>
                          )}
                        </div>

                        {article.summary && (
                          <p className="text-gray-600 mb-4 line-clamp-2">
                            {highlightText(article.summary, debouncedSearchQuery)}
                          </p>
                        )}

                        {/* Tags */}
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {article.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                                #{tag}
                              </span>
                            ))}
                            {article.tags.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">
                                +{article.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-auto pt-4 border-t border-gray-100">
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4" />
                            {article.views_count || 0}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <ThumbsUp className="w-4 h-4" />
                            {article.helpful_count || 0}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4" />
                            {article.comments_count || 0}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-medium text-gray-700">{article.author_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* List View */}
                {viewMode === 'list' && (
                  <div className="space-y-4">
                    {paginatedArticles.map(article => (
                      <div
                        key={article.id}
                        onClick={() => handleArticleClick(article.id)}
                        className="bg-white rounded-xl shadow-md hover:shadow-xl p-5 cursor-pointer transition-all border border-gray-100 flex gap-4">

                        {/* Thumbnail */}
                        {article.thumbnail && (
                          <div className="flex-shrink-0">
                            <img
                              src={article.thumbnail}
                              alt={article.title}
                              className="w-32 h-32 object-cover rounded-lg"
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900 leading-tight">
                              {highlightText(article.title, debouncedSearchQuery)}
                            </h3>
                            {article.category_name && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{
                                backgroundColor: (article.category_color || '#3B82F6') + '20',
                                color: article.category_color || '#3B82F6'
                              }}>
                                {article.category_name}
                              </span>
                            )}
                          </div>

                          {article.summary && (
                            <p className="text-gray-600 mb-3 line-clamp-2">
                              {highlightText(article.summary, debouncedSearchQuery)}
                            </p>
                          )}

                          {/* Tags */}
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {article.tags.slice(0, 5).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                                  #{tag}
                                </span>
                              ))}
                              {article.tags.length > 5 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">
                                  +{article.tags.length - 5}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <Eye className="w-4 h-4" />
                              {article.views_count || 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <ThumbsUp className="w-4 h-4" />
                              {article.helpful_count || 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MessageCircle className="w-4 h-4" />
                              {article.comments_count || 0}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-gray-700">{article.author_name}</span>
                            <span>•</span>
                            <span>
                              {new Date(article.created_at).toLocaleDateString('de-DE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Zurück
                    </button>

                    <div className="flex gap-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}>
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                      Weiter
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Create/Edit Article Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full my-8 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Neuen Artikel erstellen</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetArticleForm();
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Titel <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                  placeholder="Geben Sie einen aussagekräftigen Titel ein..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Zusammenfassung
                </label>
                <input
                  type="text"
                  value={newArticle.summary}
                  onChange={(e) => setNewArticle({...newArticle, summary: e.target.value})}
                  placeholder="Kurze Zusammenfassung für die Artikelvorschau..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                />
              </div>

              {/* Category and Thumbnail Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Kategorie</label>
                  <select
                    value={newArticle.category_id || ''}
                    onChange={(e) => setNewArticle({...newArticle, category_id: e.target.value})}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all">
                    <option value="">Wählen Sie eine Kategorie...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Thumbnail URL (optional)
                  </label>
                  <input
                    type="text"
                    value={newArticle.thumbnail}
                    onChange={(e) => setNewArticle({...newArticle, thumbnail: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  Tags
                </label>

                {/* Selected Tags */}
                {newArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {newArticle.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                        #{tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:bg-blue-200 rounded-full p-0.5 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Tag Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagInputKeyDown}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                    placeholder="Tag hinzufügen und Enter drücken..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all"
                  />

                  {/* Tag Suggestions */}
                  {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20">
                      <div className="p-2">
                        <p className="text-xs text-gray-500 px-3 py-2 font-semibold">
                          {tagInput ? 'Vorschläge' : 'Beliebte Tags'}
                        </p>
                        {filteredTagSuggestions.map((tag, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleAddTag(tag)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors text-sm">
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Markdown Editor */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Inhalt (Markdown) <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-gray-300 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-200 transition-all">
                  <SimpleMDE
                    value={newArticle.content}
                    onChange={(value) => setNewArticle({...newArticle, content: value})}
                    options={mdeOptions}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Tipp: Verwenden Sie Markdown-Syntax für Formatierung.
                  Nutzen Sie die Vorschau-Funktion in der Toolbar.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetArticleForm();
                  }}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                  Abbrechen
                </button>
                <button
                  onClick={() => handleSaveArticle('draft')}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 hover:shadow-lg transition-all">
                  <Save className="w-5 h-5" />
                  Als Entwurf speichern
                </button>
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all">
                  <Eye className="w-5 h-5" />
                  Vorschau & Veröffentlichen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Eye className="w-6 h-6" />
                <h2 className="text-2xl font-bold">Vorschau</h2>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Preview Header */}
              <div className="mb-6 pb-6 border-b-2 border-gray-200">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-3xl font-bold text-gray-900">{newArticle.title || 'Kein Titel'}</h1>
                  {newArticle.category_id && (
                    <span className="px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                      {categories.find(c => c.id === parseInt(newArticle.category_id))?.name}
                    </span>
                  )}
                </div>

                {newArticle.summary && (
                  <p className="text-lg text-gray-600 mb-4">{newArticle.summary}</p>
                )}

                {newArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newArticle.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Rendered Markdown Content */}
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  className="markdown-content">
                  {newArticle.content || '*Kein Inhalt*'}
                </ReactMarkdown>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 justify-end pt-6 mt-6 border-t-2 border-gray-200">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                  Zurück zur Bearbeitung
                </button>
                <button
                  onClick={() => handleSaveArticle('draft')}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all">
                  <Save className="w-5 h-5" />
                  Als Entwurf speichern
                </button>
                <button
                  onClick={() => handleSaveArticle('published')}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all">
                  <Send className="w-5 h-5" />
                  Jetzt veröffentlichen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseV2;
