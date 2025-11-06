import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Book, ThumbsUp, ThumbsDown, MessageCircle, Eye, X, Upload, Mic, ArrowLeft, Filter, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { getKBCategories, getKBArticles, searchKB, getKBArticle, createKBArticle, voteKBArticle, uploadKBMedia } from '../utils/apiEnhanced';
import toast from 'react-hot-toast';

const KnowledgeBase = () => {
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', content: '', category_id: null });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const response = await getKBCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;
      if (sortBy) params.sort = sortBy;
      const response = await getKBArticles(params);
      setArticles(response.data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, sortBy]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return loadArticles();
    
    try {
      setLoading(true);
      const response = await searchKB(searchQuery);
      setArticles(response.data);
    } catch (error) {
      toast.error('Suchfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = async (articleId) => {
    try {
      const response = await getKBArticle(articleId);
      setSelectedArticle(response.data);
    } catch (error) {
      toast.error('Fehler beim Laden des Artikels');
    }
  };

  const handleMediaUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setMediaFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
  };

  const removeMediaFile = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateArticle = async () => {
    if (!newArticle.title || !newArticle.content) {
      return toast.error('Titel und Inhalt erforderlich');
    }

    try {
      setUploadingMedia(true);
      const createdArticle = await createKBArticle({
        ...newArticle,
        status: 'published' // Auto-publish articles
      });
      const articleId = createdArticle.data.id;

      // Upload media files
      for (const mediaItem of mediaFiles) {
        const formData = new FormData();
        formData.append('file', mediaItem.file);
        formData.append('media_type', mediaItem.file.type.startsWith('image/') ? 'image' : 'audio');
        await uploadKBMedia(articleId, formData);
      }

      toast.success('Artikel erfolgreich erstellt!');
      setShowCreateModal(false);
      setNewArticle({ title: '', content: '', category_id: null });
      setMediaFiles([]);
      loadArticles();
    } catch (error) {
      toast.error('Fehler beim Erstellen');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleVote = async (articleId, isHelpful) => {
    try {
      await voteKBArticle(articleId, isHelpful);
      toast.success(isHelpful ? 'Als hilfreich markiert' : 'Feedback gespeichert');
      handleArticleClick(articleId); // Reload
    } catch (error) {
      toast.error('Fehler');
    }
  };

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
              <h1 className="text-2xl sm:text-4xl font-bold leading-tight">{selectedArticle.title}</h1>
            </div>

            {/* Content Section */}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 pb-6 border-b border-gray-200">
                <img
                  src={selectedArticle.author_photo || '/default-avatar.png'}
                  alt={selectedArticle.author_name}
                  className="w-12 h-12 rounded-full border-2 border-blue-500"
                />
                <div>
                  <p className="font-semibold text-gray-900">{selectedArticle.author_name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedArticle.created_at).toLocaleDateString('de-DE', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="prose prose-lg max-w-none mt-8 text-gray-700 leading-relaxed">
                {selectedArticle.content.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-4">{paragraph}</p>
                ))}
              </div>

              {selectedArticle.media && selectedArticle.media.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Medieninhalte
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedArticle.media.map(media => (
                      <div key={media.id} className="rounded-xl overflow-hidden shadow-md">
                        {media.media_type === 'image' && (
                          <img src={media.file_url} alt={media.caption || ''} className="w-full h-auto" />
                        )}
                        {media.media_type === 'audio' && (
                          <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-6">
                            <div className="flex items-center gap-3 mb-3">
                              <Mic className="w-6 h-6 text-purple-600" />
                              <span className="font-medium text-gray-900">Audio-Notiz</span>
                            </div>
                            <audio src={media.file_url} controls className="w-full" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 pb-20 lg:pb-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 sm:px-6 lg:px-8 py-6 sm:py-10 shadow-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                <Book className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold">Wissensdatenbank</h1>
                <p className="text-sm sm:text-base text-white/80 mt-1">Gemeinsam lernen und wachsen</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 hover:shadow-lg transition-all font-semibold">
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Neuer Artikel</span>
              <span className="sm:hidden">Erstellen</span>
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Artikel durchsuchen..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-gray-900 shadow-lg focus:ring-4 focus:ring-blue-300 transition-all"
              />
            </div>
            <button type="submit" className="px-6 sm:px-8 py-3.5 bg-blue-700 hover:bg-blue-800 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all">
              Suchen
            </button>
          </form>
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
            <span className="font-medium">Filter & Kategorien</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Desktop & Mobile Drawer */}
          <aside className={`
            lg:block lg:w-72 lg:flex-shrink-0
            ${showMobileFilters ? 'block' : 'hidden'}
          `}>
            <div className="bg-white rounded-2xl shadow-xl p-5 lg:sticky lg:top-6">
              {/* Sort Options */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Sortierung
                </h2>
                <div className="space-y-2">
                  <button
                    onClick={() => setSortBy('recent')}
                    className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                      sortBy === 'recent' ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                    }`}>
                    <Clock className="w-4 h-4 inline mr-2" />
                    Neueste zuerst
                  </button>
                  <button
                    onClick={() => setSortBy('popular')}
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
                  onClick={() => { setSelectedCategory(null); setShowMobileFilters(false); }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg transition-all ${
                    !selectedCategory ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
                  }`}>
                  Alle Artikel
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setShowMobileFilters(false); }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center justify-between transition-all ${
                      selectedCategory === cat.id ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-gray-100'
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
            </div>
          </aside>

          {/* Articles Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">Artikel werden geladen...</p>
              </div>
            ) : (
              <div className="grid gap-5">
                {articles.map(article => (
                  <div
                    key={article.id}
                    onClick={() => handleArticleClick(article.id)}
                    className="bg-white rounded-2xl shadow-md hover:shadow-2xl p-5 sm:p-6 cursor-pointer transition-all hover:scale-[1.02] border border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight flex-1">
                        {article.title}
                      </h3>
                      {article.category_name && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium w-fit" style={{
                          backgroundColor: (article.category_color || '#3B82F6') + '20',
                          color: article.category_color || '#3B82F6'
                        }}>
                          {article.category_name}
                        </span>
                      )}
                    </div>
                    {(article.summary || article.excerpt) && (
                      <p className="text-gray-600 mb-4 line-clamp-2">{article.summary || article.excerpt}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500">
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
                {articles.length === 0 && (
                  <div className="text-center py-20">
                    <Book className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Keine Artikel gefunden</p>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-2xl font-bold">Neuen Artikel erstellen</h2>
              <button
                onClick={() => { setShowCreateModal(false); setMediaFiles([]); }}
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

              {/* Category */}
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

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Inhalt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newArticle.content}
                  onChange={(e) => setNewArticle({...newArticle, content: e.target.value})}
                  rows="8"
                  placeholder="Beschreiben Sie das Thema detailliert..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 transition-all resize-none"
                />
              </div>

              {/* Media Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Medien hinzufügen (optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-500 transition-all">
                  <input
                    type="file"
                    id="media-upload"
                    multiple
                    accept="image/*,audio/*"
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="media-upload"
                    className="flex flex-col items-center gap-3 cursor-pointer">
                    <div className="p-4 bg-blue-100 rounded-full">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-gray-900">Bilder oder Audio hochladen</p>
                      <p className="text-sm text-gray-500 mt-1">PNG, JPG, MP3, WAV bis zu 10MB</p>
                    </div>
                  </label>
                </div>

                {/* Media Preview */}
                {mediaFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mediaFiles.map((media, idx) => (
                      <div key={idx} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                          {media.file.type.startsWith('image/') ? (
                            <img src={media.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                              <Mic className="w-12 h-12 text-purple-600 mb-2" />
                              <p className="text-xs text-gray-700 font-medium px-2 text-center truncate w-full">
                                {media.file.name}
                              </p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeMediaFile(idx)}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => { setShowCreateModal(false); setMediaFiles([]); }}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateArticle}
                  disabled={uploadingMedia}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {uploadingMedia ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Wird hochgeladen...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Artikel erstellen
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
