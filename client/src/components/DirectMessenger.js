import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Send,
  Search,
  Menu,
  X,
  Paperclip,
  Mic,
  StopCircle,
  Image as ImageIcon,
  Trash2,
  Check,
  CheckCheck,
  Users,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useMobile } from '../hooks/useMobile';
import {
  getAllContacts,
  getConversationMessages,
  sendConversationMessage,
  createConversationThread,
  getMessageThreads,
  uploadAttachment,
  deleteMessage,
  getStoriesFeed,
  markStoryViewed
} from '../utils/apiEnhanced';
import GifPicker from './GifPicker';
import { showError, showSuccess } from '../utils/toast';

const DirectMessenger = () => {
  const { user } = useAuth();
  const { isConnected, onConversationEvent, joinConversationRoom } = useWebSocketContext();
  const { isMobile } = useMobile();

  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(null);
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setStoriesLoading(true);
        const [contactsRes, threadsRes, storiesRes] = await Promise.all([
          getAllContacts(),
          getMessageThreads(),
          getStoriesFeed()
        ]);
        setContacts(contactsRes.data || []);
        setThreads(threadsRes.data || []);
        setStories(storiesRes.data?.stories || []);
      } catch (error) {
        console.error('Error loading data:', error);
        showError('Fehler beim Laden der Daten');
        setStories([]);
      } finally {
        setLoading(false);
        setStoriesLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
    } else {
      setShowSidebar(true);
    }
  }, [isMobile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedThreadId || !isConnected) return;

    joinConversationRoom(selectedThreadId);

    const handleNewMessage = (data) => {
      if (data.conversationId === selectedThreadId) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    const unsubscribe = onConversationEvent('new_message', handleNewMessage);
    return unsubscribe;
  }, [selectedThreadId, isConnected, joinConversationRoom, onConversationEvent]);

  const loadMessages = useCallback(async (threadId) => {
    try {
      const response = await getConversationMessages(threadId);
      const msgs = Array.isArray(response.data) ? response.data : [];
      setMessages(
        msgs.map((msg) => ({
          ...msg,
          attachments: Array.isArray(msg.attachments)
            ? msg.attachments
            : typeof msg.attachments === 'string'
            ? JSON.parse(msg.attachments || '[]')
            : []
        }))
      );
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Fehler beim Laden der Nachrichten');
    }
  }, []);

  const handleContactClick = async (contact) => {
    try {
      setSelectedContact(contact);

      const existingThread = threads.find(
        (t) =>
          t.type === 'direct' &&
          t.members?.some((member) => member.user_id === contact.id)
      );

      if (existingThread) {
        setSelectedThreadId(existingThread.id);
        await loadMessages(existingThread.id);
      } else {
        const response = await createConversationThread({
          name: contact.name,
          type: 'direct',
          memberIds: [contact.id]
        });
        setSelectedThreadId(response.data.id);
        setMessages([]);
        setThreads((prev) => [...prev, response.data]);
      }

      if (isMobile) {
        setShowSidebar(false);
      }
    } catch (error) {
      console.error('Error selecting contact:', error);
      showError('Fehler beim Öffnen des Chats');
    }
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const trimmed = messageInput.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    if (!selectedThreadId) {
      showError('Kein Chat ausgewählt');
      return;
    }

    const inputValue = messageInput;
    const attachments = [...pendingAttachments];
    setMessageInput('');
    setPendingAttachments([]);
    setSending(true);

    try {
      let attachmentsData = [];
      if (attachments.length > 0) {
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
      }

      await sendConversationMessage(selectedThreadId, {
        message: trimmed,
        attachments: attachmentsData
      });

      await loadMessages(selectedThreadId);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Fehler beim Senden';
      showError(errorMsg);
      setMessageInput(inputValue);
      setPendingAttachments(attachments);
    } finally {
      setSending(false);
    }
  };

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
      await loadMessages(selectedThreadId);
    } catch (error) {
      console.error('Error sending GIF:', error);
      showError('Fehler beim Senden des GIFs');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...files.slice(0, 5 - prev.length)]);
  };

  const removeAttachment = useCallback((index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const storiesByUser = useMemo(() => {
    const map = {};
    stories.forEach((story) => {
      if (!story || !story.userId) return;
      const existing = map[story.userId];
      if (!existing) {
        map[story.userId] = story;
        return;
      }
      const existingTime = new Date(existing.createdAt || 0).getTime();
      const currentTime = new Date(story.createdAt || 0).getTime();
      if (currentTime > existingTime) {
        map[story.userId] = story;
      }
    });
    return map;
  }, [stories]);

  const storyEntries = useMemo(() => Object.values(storiesByUser), [storiesByUser]);

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
        setPendingAttachments((prev) => [...prev, file]);

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        showSuccess('Audioaufnahme hinzugefügt');
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

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Nachricht wirklich löschen?')) return;

    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      showSuccess('Nachricht gelöscht');
    } catch (error) {
      console.error('Error deleting message:', error);
      showError('Fehler beim Löschen');
    }
  };

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [contacts, searchTerm]
  );

  const selectedStory = useMemo(
    () =>
      selectedStoryIndex !== null && stories[selectedStoryIndex]
        ? stories[selectedStoryIndex]
        : null,
    [selectedStoryIndex, stories]
  );

  const handleStoryOpen = useCallback(
    (storyId) => {
      const index = stories.findIndex((story) => story.id === storyId);
      if (index !== -1) {
        setSelectedStoryIndex(index);
      }
    },
    [stories]
  );

  const handleStoryClose = useCallback(() => {
    setSelectedStoryIndex(null);
  }, []);

  const handleStoryNext = useCallback(() => {
    if (stories.length === 0 || selectedStoryIndex === null) return;
    const nextIndex = (selectedStoryIndex + 1) % stories.length;
    setSelectedStoryIndex(nextIndex);
  }, [selectedStoryIndex, stories.length]);

  const handleStoryPrev = useCallback(() => {
    if (stories.length === 0 || selectedStoryIndex === null) return;
    const prevIndex = (selectedStoryIndex - 1 + stories.length) % stories.length;
    setSelectedStoryIndex(prevIndex);
  }, [selectedStoryIndex, stories.length]);

  useEffect(() => {
    if (selectedStoryIndex === null) return;
    if (!stories[selectedStoryIndex]) {
      setSelectedStoryIndex(null);
    }
  }, [stories, selectedStoryIndex]);

  useEffect(() => {
    if (!selectedStory || selectedStory.viewerHasSeen) return;
    const markSeen = async () => {
      try {
        await markStoryViewed(selectedStory.id);
        setStories((prev) =>
          prev.map((story, index) =>
            index === selectedStoryIndex ? { ...story, viewerHasSeen: true } : story
          )
        );
      } catch (error) {
        console.error('Error marking story view:', error);
      }
    };

    markSeen();
  }, [selectedStory, selectedStoryIndex]);

  const renderAttachmentPreview = useCallback(
    (file, idx) => (
      <div key={`${file.name}-${idx}`} className="relative inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs text-slate-700">
        <Paperclip className="w-4 h-4 text-slate-500" />
        <span className="max-w-[140px] truncate">{file.name}</span>
        <button
          type="button"
          onClick={() => removeAttachment(idx)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ),
    [removeAttachment]
  );

  const renderMessageContent = (msg, isMine) => {
    const baseClassMobile = `message-bubble ${isMine ? 'mine' : 'other'}`;
    const baseClassDesktop = isMine
      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
      : 'bg-white text-slate-900 border border-slate-200';

    return (
      <div
        className={
          isMobile
            ? baseClassMobile
            : `max-w-md lg:max-w-lg rounded-2xl px-4 py-3 shadow-sm ${baseClassDesktop}`
        }
      >
        {!isMine && msg.sender_name && !isMobile && (
          <p className="text-xs font-semibold text-blue-600 mb-1">
            {msg.sender_name}
          </p>
        )}

        {msg.message_type === 'gif' ? (
          <img src={msg.message} alt="GIF" className="rounded-lg max-h-60 w-full object-contain" />
        ) : (
          <p className={`${isMobile ? 'message-text' : 'text-sm whitespace-pre-wrap break-words'}`}>
            {msg.message}
          </p>
        )}

        {msg.attachments?.length > 0 && (
          <div className="mt-2 space-y-2">
            {msg.attachments.map((att, idx) => {
              if (att.type === 'image') {
                return (
                  <img
                    key={`${att.url}-${idx}`}
                    src={att.url}
                    alt="Anhang"
                    className="rounded-xl max-h-48 w-full object-cover"
                  />
                );
              }
              if (att.type === 'audio') {
                return (
                  <audio key={`${att.url}-${idx}`} controls src={att.url} className="w-full mt-2" />
                );
              }
              return (
                <a
                  key={`${att.url}-${idx}`}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs underline text-blue-600"
                >
                  📎 {att.name || 'Datei'}
                </a>
              );
            })}
          </div>
        )}

        <div
          className={`mt-2 text-xs opacity-75 flex items-center justify-between ${
            isMobile ? 'message-time' : ''
          }`}
        >
          <span>{format(parseISO(msg.created_at), 'HH:mm', { locale: de })}</span>
          {isMine && (
            <div className="flex items-center gap-1">
              {msg.read ? <CheckCheck className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                className="ml-2 hover:text-red-400 transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <User className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">Keine Nachrichten</p>
          <p className="text-sm">Beginne die Konversation!</p>
        </div>
      );
    }

    return messages.map((msg) => {
      const isMine = msg.sender_id === user?.id;
      return (
        <div
          key={msg.id}
          className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
            isMobile ? '' : 'px-1'
          }`}
        >
          {renderMessageContent(msg, isMine)}
        </div>
      );
    });
  };

  const ContactList = ({ variant, storyEntries, storyMap, onStoryOpen, storiesLoading }) => (
    <div
      className={
        variant === 'overlay'
          ? 'flex flex-col h-full bg-white'
          : 'flex flex-col w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 shadow-lg'
      }
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-white" />
          <h2 className="text-lg font-bold text-white">Kontakte</h2>
        </div>
        {variant === 'overlay' && (
          <button
            onClick={() => setShowSidebar(false)}
            className="p-2 text-white hover:bg-white/20 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

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

      {storiesLoading && (
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={`story-skeleton-${idx}`}
                className="w-16 h-16 rounded-full bg-slate-200/70 animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {!storiesLoading && storyEntries.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex gap-4 overflow-x-auto pb-1">
            {storyEntries.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => onStoryOpen(story.id)}
                className="flex flex-col items-center gap-2 focus:outline-none"
              >
                <div
                  className={`p-[3px] rounded-full transition ${
                    story.viewerHasSeen
                      ? 'bg-slate-200'
                      : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-800">
                    {story.userName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
                <span className="text-xs text-slate-600 max-w-[72px] text-center truncate">
                  {story.userName || 'Story'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

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
            {filteredContacts.map((contact) => {
              const contactStory = storyMap?.[contact.id];
              return (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className={`w-full px-4 py-4 flex items-center gap-3 transition ${
                    selectedContact?.id === contact.id
                      ? 'bg-blue-50 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                <div className="flex-shrink-0 mr-1">
                  <div
                    role={contactStory ? 'button' : undefined}
                    tabIndex={contactStory ? 0 : -1}
                    onClick={(event) => {
                      if (contactStory) {
                        event.stopPropagation();
                        onStoryOpen(contactStory.id);
                      }
                    }}
                    className={`p-[2px] rounded-full ${
                      contactStory
                        ? contactStory.viewerHasSeen
                          ? 'bg-slate-200'
                          : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500'
                        : 'bg-transparent'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md cursor-pointer">
                      {contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}
                    </div>
                  </div>
                  {contactStory && !contactStory.viewerHasSeen && (
                    <span className="block w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-full mx-auto -mt-2" />
                  )}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderDesktopLayout = () => (
    <div className="flex flex-1 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
      {showSidebar && (
        <ContactList
          variant="panel"
          storyEntries={storyEntries}
          storyMap={storiesByUser}
          onStoryOpen={handleStoryOpen}
          storiesLoading={storiesLoading}
        />
      )}

      <div className="flex-1 flex flex-col bg-white">
        {selectedContact ? (
          <>
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

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              {pendingAttachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((file, idx) => renderAttachmentPreview(file, idx))}
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
                    onClick={() => setShowGifPicker((prev) => !prev)}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="GIF senden"
                  >
                    <ImageIcon className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-xl transition ${
                      isRecording ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100'
                    }`}
                    title={isRecording ? 'Aufnahme stoppen' : 'Sprachnachricht'}
                  >
                    {isRecording ? (
                      <StopCircle className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5 text-slate-600" />
                    )}
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

  const renderMobileLayout = () => (
    <div className="messenger-mobile-container">
      {showSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowSidebar(false)}
          />
          <div className="fixed inset-0 z-50">
            <ContactList
              variant="overlay"
              storyEntries={storyEntries}
              storyMap={storiesByUser}
              onStoryOpen={handleStoryOpen}
              storiesLoading={storiesLoading}
            />
          </div>
        </>
      )}

      <div className="messenger-mobile-header">
        <button
          className="back-btn"
          onClick={() => setShowSidebar(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="contact-info">
          <p className="contact-name">
            {selectedContact ? selectedContact.name : 'Chat auswählen'}
          </p>
          <p className="contact-status">
            {isConnected ? 'Online' : 'Offline'}
          </p>
        </div>
        <div className="avatar">
          {selectedContact?.name?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || '?'}
        </div>
      </div>

      <div className="messenger-mobile-messages">
        {selectedContact ? renderMessages() : (
          <div className="flex-1 flex flex-col items-center justify-center text-blue-100">
            <Users className="w-20 h-20 mb-3" />
            <p className="text-lg font-semibold">Kontakt auswählen</p>
            <p className="text-sm text-blue-200 mt-1">Tippe auf die Liste, um einen Chat zu starten</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 bg-slate-900">
          <div className="flex gap-2 overflow-x-auto">
            {pendingAttachments.map((file, idx) => renderAttachmentPreview(file, idx))}
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="messenger-mobile-input">
        <div className="input-wrapper">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-blue-300 hover:text-white transition"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGifPicker((prev) => !prev)}
            className="p-2 text-blue-300 hover:text-white transition"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 transition ${
              isRecording ? 'text-red-400' : 'text-blue-300 hover:text-white'
            }`}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Nachricht..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
        </div>
        <button
          type="submit"
          disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0)}
          className="send-btn"
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
  );

  return (
    <>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
      {selectedStory && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div>
              <p className="font-semibold text-lg">{selectedStory.userName}</p>
              {selectedStory.createdAt && (
                <p className="text-xs text-white/70">
                  {formatDistanceToNow(new Date(selectedStory.createdAt), {
                    addSuffix: true,
                    locale: de
                  })}
                </p>
              )}
            </div>
            <button
              onClick={handleStoryClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            {selectedStory.mediaType?.startsWith('video') ? (
              <video
                src={selectedStory.mediaUrl}
                controls
                autoPlay
                className="max-h-[70vh] max-w-full rounded-3xl shadow-2xl"
              />
            ) : (
              <img
                src={selectedStory.mediaUrl}
                alt={selectedStory.caption || 'Story'}
                className="max-h-[70vh] max-w-full rounded-3xl shadow-2xl object-contain"
              />
            )}
          </div>
          {selectedStory.caption && (
            <div className="px-5 pb-4 text-sm text-white/80">
              {selectedStory.caption}
            </div>
          )}
          {stories.length > 1 && (
            <div className="flex items-center justify-between px-5 pb-6">
              <button
                onClick={handleStoryPrev}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button
                onClick={handleStoryNext}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition"
              >
                Weiter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {showGifPicker && (
        <GifPicker
          onSelectGif={handleSelectGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </>
  );
};

export default DirectMessenger;
