import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, X, Filter, Calendar, User, Users } from 'lucide-react';
import { searchMessages } from '../utils/apiEnhanced';
import { showError } from '../utils/toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const MessageSearch = ({ onClose, onMessageSelect, contacts = [], threads = [], currentConversationId = null, currentUserId = null }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from: '',
    date: '',
    type: 'all',
    conversationId: currentConversationId || ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);

  const contactOptions = useMemo(() => {
    if (!Array.isArray(contacts)) return [];
    return contacts
      .filter((contact) => contact?.id)
      .map((contact) => ({
        id: contact.id,
        label: contact.name || contact.email || `Benutzer ${contact.id}`
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [contacts]);

  const threadOptions = useMemo(() => {
    if (!Array.isArray(threads)) return [];
    return threads.map((thread) => {
      const isGroup = thread?.type === 'group' || thread?.conversation_type === 'group';
      const memberName = Array.isArray(thread?.members) && thread.members.length > 0
        ? thread.members[0]?.name || thread.members[0]?.email
        : null;
      const label = thread?.name || memberName || (isGroup ? 'Gruppenchat' : 'Direktchat');
      return {
        id: thread?.id,
        label: isGroup ? `Gruppe: ${label}` : label
      };
    }).filter((thread) => thread.id);
  }, [threads]);

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
    if (currentConversationId && !filters.conversationId) {
      setFilters((prev) => ({ ...prev, conversationId: currentConversationId }));
    }
  }, [currentConversationId, filters.conversationId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, performSearch]);

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const rawTerms = query.trim().split(/\s+/).filter(Boolean);
    if (!rawTerms.length) return text;
    const escapedTerms = rawTerms.map(escapeRegExp);
    const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      rawTerms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
        <mark key={i} className="bg-yellow-200 text-slate-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const formatTypeLabel = (type) => {
    if (!type || type === 'text') return '';
    if (type === 'image') return 'Bild';
    if (type === 'audio') return 'Audio';
    if (type === 'gif') return 'GIF';
    return type.toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-4 md:pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">Nachrichten durchsuchen</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center hover:bg-slate-100 rounded-full transition flex-shrink-0"
              aria-label="Schließen"
            >
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
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <Users className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={filters.conversationId}
                  onChange={(e) => setFilters({ ...filters, conversationId: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Alle Chats</option>
                  {currentConversationId && (
                    <option value={currentConversationId}>Aktueller Chat</option>
                  )}
                  {threadOptions.map((option) => (
                    <option key={`thread-${option.id}`} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <User className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  value={filters.from}
                  onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Alle Absender</option>
                  {contactOptions.map((option) => (
                    <option key={`contact-${option.id}`} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
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

          {!loading && results.map((message) => {
            const typeLabel = formatTypeLabel(message.message_type);
            const directName = currentUserId
              ? (message.sender_id === currentUserId ? message.receiver_name : message.sender_name)
              : (message.receiver_name || message.sender_name);
            const conversationLabel = message.conversation_name
              ? (message.conversation_type === 'group'
                  ? `Gruppe · ${message.conversation_name}`
                  : `Chat · ${message.conversation_name}`)
              : directName
                ? `Direkt · ${directName}`
                : 'Direktnachricht';

            return (
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
                      <p className="text-xs text-slate-400">{conversationLabel}</p>
                    </div>
                  </div>
                  {typeLabel && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {typeLabel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 line-clamp-2">
                  {highlightText(message.message, searchQuery)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MessageSearch;
