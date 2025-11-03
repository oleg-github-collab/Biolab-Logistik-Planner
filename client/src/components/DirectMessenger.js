import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Send, Search, Menu, X, Paperclip, Mic, StopCircle, Smile,
  Image as ImageIcon, Trash2, Check, CheckCheck, Users, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useWebSocket from '../hooks/useWebSocket';
import {
  getAllContacts,
  getConversationMessages,
  sendConversationMessage,
  createConversationThread,
  getMessageThreads,
  uploadAttachment,
  deleteMessage
} from '../utils/apiEnhanced';
import GifPicker from './GifPicker';
import { showError, showSuccess } from '../utils/toast';

const DirectMessenger = () => {
  const { user } = useAuth();
  const { isConnected, onConversationEvent, joinConversationRoom } = useWebSocket();

  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load contacts and threads
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [contactsRes, threadsRes] = await Promise.all([
          getAllContacts(),
          getMessageThreads()
        ]);
        setContacts(contactsRes.data || []);
        setThreads(threadsRes.data || []);
      } catch (error) {
        console.error('Error loading data:', error);
        showError('Fehler beim Laden der Daten');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket listeners
  useEffect(() => {
    if (!selectedThreadId || !isConnected) return;

    joinConversationRoom(selectedThreadId);

    const handleNewMessage = (data) => {
      if (data.conversationId === selectedThreadId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    const unsubscribe = onConversationEvent('new_message', handleNewMessage);
    return unsubscribe;
  }, [selectedThreadId, isConnected, joinConversationRoom, onConversationEvent]);

  // Handle contact selection
  const handleContactClick = async (contact) => {
    try {
      setSelectedContact(contact);

      // Find existing direct thread with this contact
      const existingThread = threads.find(t =>
        t.type === 'direct' &&
        t.members?.some(m => m.user_id === contact.id)
      );

      if (existingThread) {
        setSelectedThreadId(existingThread.id);
        await loadMessages(existingThread.id);
      } else {
        // Create new direct thread
        const response = await createConversationThread({
          name: contact.name,
          type: 'direct',
          memberIds: [contact.id]
        });
        setSelectedThreadId(response.data.id);
        setMessages([]);
        setThreads(prev => [...prev, response.data]);
      }
    } catch (error) {
      console.error('Error selecting contact:', error);
      showError('Fehler beim Öffnen des Chats');
    }
  };

  // Load messages
  const loadMessages = async (threadId) => {
    try {
      const response = await getConversationMessages(threadId);
      const msgs = Array.isArray(response.data) ? response.data : [];
      setMessages(msgs.map(msg => ({
        ...msg,
        attachments: Array.isArray(msg.attachments)
          ? msg.attachments
          : typeof msg.attachments === 'string'
            ? JSON.parse(msg.attachments || '[]')
            : []
      })));
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Fehler beim Laden der Nachrichten');
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();

    const msg = messageInput.trim();
    if (!msg && pendingAttachments.length === 0) return;
    if (!selectedThreadId) {
      showError('Kein Chat ausgewählt');
      return;
    }

    // Clear input immediately for better UX
    const inputValue = messageInput;
    const attachments = [...pendingAttachments];
    setMessageInput('');
    setPendingAttachments([]);
    setSending(true);

    try {
      let attachmentsData = [];
      if (attachments.length > 0) {
        try {
          attachmentsData = await Promise.all(
            attachments.map(async (file) => {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('context', 'message');
              formData.append('conversationId', selectedThreadId);
              const res = await uploadAttachment(formData);
              return res.data;
            })
          );
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          showError('Fehler beim Hochladen der Dateien');
          setMessageInput(inputValue);
          setPendingAttachments(attachments);
          return;
        }
      }

      await sendConversationMessage(selectedThreadId, {
        message: msg,
        attachments: attachmentsData
      });

      // Reload messages after successful send
      await loadMessages(selectedThreadId);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Fehler beim Senden';
      showError(errorMsg);
      setMessageInput(inputValue);
      setPendingAttachments(attachments);
    } finally {
      setSending(false);
    }
  };

  // Send GIF
  const handleSelectGif = async (gifData) => {
    if (!selectedThreadId) return;

    try {
      setSending(true);
      await sendConversationMessage(selectedThreadId, {
        message: gifData.url || gifData,
        message_type: 'gif'
      });
      setShowGifPicker(false);
      showSuccess('GIF gesendet');
    } catch (error) {
      console.error('Error sending GIF:', error);
      showError('Fehler beim Senden des GIFs');
    } finally {
      setSending(false);
    }
  };

  // File upload
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingAttachments(prev => [...prev, ...files.slice(0, 5 - prev.length)]);
    }
  };

  const removeAttachment = (index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        setPendingAttachments(prev => [...prev, file]);

        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      showError('Mikrofon-Zugriff verweigert');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Nachricht wirklich löschen?')) return;

    try {
      await deleteMessage(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      showSuccess('Nachricht gelöscht');
    } catch (error) {
      console.error('Error deleting message:', error);
      showError('Fehler beim Löschen');
    }
  };

  // Filter contacts
  const filteredContacts = contacts.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 shadow-lg`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white">Kontakte</h2>
          </div>
          <button
            onClick={() => setShowSidebar(false)}
            className="md:hidden p-2 text-white hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Kontakte durchsuchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Users className="w-12 h-12 mb-2" />
              <p>Keine Kontakte gefunden</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className={`w-full px-4 py-4 flex items-center gap-3 hover:bg-slate-50 transition ${
                    selectedContact?.id === contact.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{contact.name}</p>
                    <p className="text-sm text-slate-500 truncate">{contact.email}</p>
                    {contact.status && (
                      <p className="text-xs text-slate-400 mt-0.5">{contact.status}</p>
                    )}
                  </div>
                  {contact.online && (
                    <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white shadow-sm">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                  {selectedContact.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedContact.name}</h3>
                  <p className="text-xs text-slate-500">
                    {isConnected ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <User className="w-16 h-16 mb-4" />
                  <p className="text-lg font-medium">Keine Nachrichten</p>
                  <p className="text-sm">Beginne die Konversation!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md md:max-w-lg rounded-2xl px-4 py-3 shadow-sm ${
                        isMine
                          ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
                          : 'bg-white text-slate-900 border border-slate-200'
                      }`}>
                        {!isMine && (
                          <p className="text-xs font-semibold text-blue-600 mb-1">
                            {msg.sender_name}
                          </p>
                        )}

                        {msg.message_type === 'gif' ? (
                          <img src={msg.message} alt="GIF" className="rounded-lg max-h-60" />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        )}

                        {msg.attachments?.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((att, idx) => {
                              if (att.type === 'image') {
                                return <img key={idx} src={att.url} alt="Anhang" className="rounded-lg max-h-48" />;
                              }
                              if (att.type === 'audio') {
                                return <audio key={idx} controls src={att.url} className="w-full mt-2" />;
                              }
                              return (
                                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                                  📎 {att.name || 'Datei'}
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2 text-xs opacity-75">
                          <span>{format(parseISO(msg.created_at), 'HH:mm', { locale: de })}</span>
                          {isMine && (
                            <div className="flex items-center gap-1">
                              {msg.read ? <CheckCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="ml-2 hover:text-red-300 transition"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 bg-white p-4">
              {pendingAttachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((file, idx) => (
                    <div key={idx} className="relative group">
                      <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        {file.name}
                      </div>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="Datei anhängen"
                  >
                    <Paperclip className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGifPicker(!showGifPicker)}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="GIF senden"
                  >
                    <ImageIcon className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-xl transition ${isRecording ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100'}`}
                    title={isRecording ? 'Aufnahme stoppen' : 'Sprachnachricht'}
                  >
                    {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5 text-slate-600" />}
                  </button>
                </div>

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Nachricht schreiben..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <button
                  type="submit"
                  disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
                >
                  <Send className="w-5 h-5" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </form>
            </div>

            {showGifPicker && (
              <GifPicker
                onSelectGif={handleSelectGif}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <Users className="w-24 h-24 mb-4" />
            <p className="text-xl font-medium">Wähle einen Kontakt</p>
            <p className="text-sm mt-2">Beginne eine Unterhaltung</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DirectMessenger;
