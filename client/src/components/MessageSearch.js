import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Filter, Calendar, User } from 'lucide-react';
import { searchMessages } from '../utils/apiEnhanced';
import { showError } from '../utils/toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const MessageSearch = ({ onClose, onMessageSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from: '',
    date: '',
    type: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);

  const performSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = { q: searchQuery, ...filters };
      const response = await searchMessages(params);
      setResults(response.data.results || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Search error:', error);
      showError('Suchfehler');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, performSearch]);

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-slate-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">Nachrichten durchsuchen</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nachricht suchen..."
              className="w-full pl-10 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="relative">
                <User className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Von Benutzer-ID"
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle Typen</option>
                <option value="text">Text</option>
                <option value="image">Bild</option>
                <option value="audio">Audio</option>
                <option value="gif">GIF</option>
              </select>
            </div>
          )}

          {/* Result count */}
          {searchQuery.length >= 2 && (
            <p className="mt-2 text-sm text-slate-500">
              {loading ? 'Suche...' : `${total} Ergebnis${total !== 1 ? 'se' : ''} gefunden`}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && searchQuery.length < 2 && (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Gib mindestens 2 Zeichen ein, um zu suchen</p>
            </div>
          )}

          {!loading && searchQuery.length >= 2 && results.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Keine Ergebnisse gefunden</p>
            </div>
          )}

          {!loading && results.map((message) => (
            <button
              key={message.id}
              onClick={() => onMessageSelect(message)}
              className="w-full text-left p-4 bg-slate-50 hover:bg-blue-50 rounded-xl transition border border-slate-200 hover:border-blue-300"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {message.sender_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{message.sender_name}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(message.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>
                {message.message_type !== 'text' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {message.message_type}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 line-clamp-2">
                {highlightText(message.message, searchQuery)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;
