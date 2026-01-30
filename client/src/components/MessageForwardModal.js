import React, { useState, useEffect } from 'react';
import { Forward, X, Search, Check, Users } from 'lucide-react';
import { getAllContacts, getThreads } from '../utils/apiEnhanced';
import { forwardMessage } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

const MessageForwardModal = ({ message, onClose, onSuccess }) => {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'contacts', 'groups'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsRes, threadsRes] = await Promise.all([
        getAllContacts(),
        getThreads()
      ]);
      setContacts(contactsRes.data || []);
      const groupThreads = (threadsRes.data || []).filter(t => t.type === 'group');
      setGroups(groupThreads);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (contactId) => {
    setSelectedIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) {
      showError('Wähle mindestens einen Empfänger');
      return;
    }

    setForwarding(true);
    try {
      await forwardMessage(message.id, selectedIds, comment);
      showSuccess(`Nachricht an ${selectedIds.length} Empfänger weitergeleitet`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error forwarding message:', error);
      showError('Fehler beim Weiterleiten');
    } finally {
      setForwarding(false);
    }
  };

  const filteredContacts = Array.isArray(contacts) ? contacts.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const filteredGroups = Array.isArray(groups) ? groups.filter(g =>
    g.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const displayItems = activeTab === 'contacts'
    ? filteredContacts
    : activeTab === 'groups'
      ? filteredGroups
      : [...filteredContacts, ...filteredGroups];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-green-600 to-green-700 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Forward className="w-6 h-6" />
              <h3 className="text-lg font-bold">Nachricht weiterleiten</h3>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Preview */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Weiterzuleitende Nachricht:</p>
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <p className="text-sm text-slate-700 line-clamp-3">{message.message}</p>
          </div>
        </div>

        {/* Comment Input */}
        <div className="p-4 border-b border-slate-200">
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Kommentar hinzufügen (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Füge einen Kommentar hinzu..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
            rows={2}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-4 border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'contacts'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Kontakte
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'groups'
                ? 'bg-green-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Gruppen
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
          {selectedIds.length > 0 && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              {selectedIds.length} Empfänger ausgewählt
            </p>
          )}
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
            </div>
          )}

          {!loading && displayItems.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <p>Keine Ergebnisse gefunden</p>
            </div>
          )}

          {!loading && displayItems.map((item) => {
            const isGroup = item.type === 'group';
            const itemId = item.id;
            const isSelected = selectedIds.includes(itemId);
            const displayName = item.name || item.email || 'Unbenannt';
            return (
              <button
                key={itemId}
                onClick={() => toggleSelection(itemId)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition border-2 ${
                  isSelected
                    ? 'bg-green-50 border-green-300'
                    : 'bg-slate-50 border-transparent hover:border-slate-200'
                }`}
              >
                {isGroup && (
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                  isSelected
                    ? 'bg-green-600 border-green-600'
                    : 'bg-white border-slate-300'
                }`}>
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </div>
                {!isGroup && (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                    {displayName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-900">{displayName}</p>
                  {isGroup && (
                    <p className="text-sm text-slate-500">{item.members?.length || 0} Mitglieder</p>
                  )}
                  {!isGroup && item.email && (
                    <p className="text-sm text-slate-500">{item.email}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-medium"
          >
            Abbrechen
          </button>
          <button
            onClick={handleForward}
            disabled={selectedIds.length === 0 || forwarding}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <Forward className="w-5 h-5" />
            {forwarding ? 'Wird weitergeleitet...' : 'Weiterleiten'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageForwardModal;
