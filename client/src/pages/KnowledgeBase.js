import React, { useState, useEffect } from 'react';
import { Search, Plus, Book, ThumbsUp, ThumbsDown, MessageCircle, Eye } from 'lucide-react';
import { getKBCategories, getKBArticles, searchKB, getKBArticle, createKBArticle, voteKBArticle } from '../utils/apiEnhanced';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newArticle, setNewArticle] = useState({ title: '', content: '', category_id: null });

  useEffect(() => {
    loadCategories();
    loadArticles();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await getKBCategories();
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadArticles = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;
      const response = await getKBArticles(params);
      setArticles(response.data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCreateArticle = async () => {
    if (!newArticle.title || !newArticle.content) {
      return toast.error('Titel und Inhalt erforderlich');
    }

    try {
      await createKBArticle(newArticle);
      toast.success('Artikel erstellt!');
      setShowCreateModal(false);
      setNewArticle({ title: '', content: '', category_id: null });
      loadArticles();
    } catch (error) {
      toast.error('Fehler beim Erstellen');
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <button onClick={() => setSelectedArticle(null)} className="mb-4 text-blue-600 hover:underline">← Zurück</button>
          
          <article className="bg-white rounded-lg shadow-md p-8">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span className="px-3 py-1 rounded-full" style={{ backgroundColor: selectedArticle.category_color + '20', color: selectedArticle.category_color }}>
                {selectedArticle.category_name}
              </span>
              <span>•</span>
              <Eye className="w-4 h-4" />
              <span>{selectedArticle.views_count} Aufrufe</span>
            </div>

            <h1 className="text-3xl font-bold mb-4">{selectedArticle.title}</h1>
            
            <div className="flex items-center gap-3 text-sm text-gray-600 mb-6">
              <img src={selectedArticle.author_photo || '/default-avatar.png'} alt="" className="w-8 h-8 rounded-full" />
              <span>{selectedArticle.author_name}</span>
              <span>•</span>
              <span>{new Date(selectedArticle.created_at).toLocaleDateString('de-DE')}</span>
            </div>

            <div className="prose max-w-none mb-8" dangerouslySetInnerHTML={{ __html: selectedArticle.content.replace(/\n/g, '<br/>') }} />

            {selectedArticle.media && selectedArticle.media.length > 0 && (
              <div className="mb-8 space-y-4">
                <h3 className="font-semibold">Medien:</h3>
                {selectedArticle.media.map(media => (
                  <div key={media.id}>
                    {media.media_type === 'image' && <img src={media.file_url} alt={media.caption} className="rounded-lg max-w-full" />}
                    {media.media_type === 'audio' && <audio src={media.file_url} controls className="w-full" />}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-6">
              <p className="font-semibold mb-3">War dieser Artikel hilfreich?</p>
              <div className="flex gap-3">
                <button onClick={() => handleVote(selectedArticle.id, true)} 
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                  <ThumbsUp className="w-5 h-5" />
                  Ja ({selectedArticle.helpful_count || 0})
                </button>
                <button onClick={() => handleVote(selectedArticle.id, false)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                  <ThumbsDown className="w-5 h-5" />
                  Nein ({selectedArticle.not_helpful_count || 0})
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Book className="w-10 h-10" />
              <h1 className="text-4xl font-bold">Wissensdatenbank</h1>
            </div>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50">
              <Plus className="w-5 h-5" />
              Neuer Artikel
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche in der Wissensdatenbank..."
                className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900" />
            </div>
            <button type="submit" className="px-6 py-3 bg-blue-700 hover:bg-blue-900 rounded-lg font-semibold">
              Suchen
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4 sticky top-6">
              <h2 className="font-semibold mb-3">Kategorien</h2>
              <button onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded mb-1 ${!selectedCategory ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>
                Alle Artikel
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center justify-between ${selectedCategory === cat.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </span>
                  <span className="text-xs text-gray-500">{cat.articles_count}</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="grid gap-4">
                {articles.map(article => (
                  <div key={article.id} onClick={() => handleArticleClick(article.id)}
                    className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-semibold text-gray-900">{article.title}</h3>
                      {article.category_name && (
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: article.category_color + '20', color: article.category_color }}>
                          {article.category_name}
                        </span>
                      )}
                    </div>
                    {article.excerpt && <p className="text-gray-600 mb-3">{article.excerpt}</p>}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{article.views_count}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" />{article.helpful_count}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" />{article.comments_count}</span>
                      <span>•</span>
                      <span>{article.author_name}</span>
                    </div>
                  </div>
                ))}
                {articles.length === 0 && <p className="text-center text-gray-500 py-12">Keine Artikel gefunden</p>}
              </div>
            )}
          </main>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Neuer Artikel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Titel</label>
                <input type="text" value={newArticle.title} onChange={(e) => setNewArticle({...newArticle, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategorie</label>
                <select value={newArticle.category_id || ''} onChange={(e) => setNewArticle({...newArticle, category_id: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Wählen...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Inhalt</label>
                <textarea value={newArticle.content} onChange={(e) => setNewArticle({...newArticle, content: e.target.value})}
                  rows="10" className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg">Abbrechen</button>
                <button onClick={handleCreateArticle} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Erstellen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
