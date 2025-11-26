import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Smile, Mic, Image, Video, Camera, Plus,
  Search, Phone, VideoIcon, MoreVertical, ChevronLeft, X,
  Users, User, Circle, CheckCircle, Clock, Star, Settings,
  Bell, BellOff, Pin, Archive, Trash2, Edit, Reply, Forward,
  Heart, ThumbsUp, Laugh, Frown, MessageCircle, Share2, Download
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  getUsersForMessaging,
  getMessagesForUser,
  getThreads,
  getConversations,
  sendMessage
} from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { showSuccess, showError } from '../utils/toast';

const MessengerRedesigned = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list', 'chat', 'profile'
  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [stories, setStories] = useState([]);
  const [activeStoryView, setActiveStoryView] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load contacts using getUsersForMessaging
      const contactsRes = await getUsersForMessaging();
      console.log('Raw contacts response:', contactsRes);

      // Process contacts - the API returns a simple array
      let contactsList = [];
      if (Array.isArray(contactsRes?.data)) {
        contactsList = contactsRes.data;
      } else if (Array.isArray(contactsRes?.data?.users)) {
        // Fallback for different API format
        contactsList = contactsRes.data.users;
      } else {
        console.warn('Unexpected contacts response format:', contactsRes);
        contactsList = [];
      }

      // Filter out invalid entries (but keep all valid contacts)
      contactsList = contactsList.filter(c =>
        c && c.id && c.name && c.email
      );

      console.log('Processed contacts:', contactsList.length, 'contacts found');
      setContacts(contactsList);

      // For now, we'll use empty threads since getThreads doesn't exist
      // In production, this would come from a real API endpoint
      setThreads([]);

      // Generate mock stories for demo
      const mockStories = contactsList.slice(0, 5).map(contact => ({
        id: `story-${contact.id}`,
        userId: contact.id,
        userName: contact.name,
        userAvatar: contact.profile_photo,
        content: {
          type: 'image',
          url: `https://picsum.photos/400/700?random=${contact.id}`,
          caption: 'Check out my day! 🌟'
        },
        createdAt: new Date(Date.now() - Math.random() * 86400000),
        viewed: Math.random() > 0.5,
        viewers: Math.floor(Math.random() * 20)
      }));
      setStories(mockStories);

    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (contactId) => {
    try {
      // Use getMessagesForUser with the contact's ID
      const response = await getMessagesForUser(contactId);
      setMessages(Array.isArray(response?.data) ? response.data : []);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      // Don't show error for empty conversations
      if (error.response?.status !== 404) {
        showError('Fehler beim Laden der Nachrichten');
      }
      setMessages([]);
    }
  };

  const handleContactClick = async (contact) => {
    setSelectedContact(contact);

    // Create a virtual thread for the UI
    const virtualThread = {
      id: `thread-${contact.id}`,
      type: 'direct',
      participants: [contact],
      name: contact.name,
      created_at: new Date().toISOString()
    };

    setSelectedThread(virtualThread);

    // Load messages for this contact
    try {
      await loadMessages(contact.id);
    } catch (error) {
      // It's okay if this fails, we'll show empty messages
      setMessages([]);
    }

    setView('chat');
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();

    if (!messageText.trim() && attachments.length === 0) return;
    if (!selectedContact) return;

    setSending(true);
    try {
      // Use the correct API format
      await sendMessage(selectedContact.id, messageText, false);

      // Add the message to local state for immediate feedback
      const newMessage = {
        id: Date.now(),
        message: messageText,
        sender_id: user?.id,
        created_at: new Date().toISOString()
      };
      setMessages([...messages, newMessage]);

      setMessageText('');
      setAttachments([]);
      scrollToBottom();
      showSuccess('Nachricht gesendet');
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Fehler beim Senden');
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return `Gestern ${format(messageDate, 'HH:mm')}`;
    } else {
      return format(messageDate, 'dd.MM.yyyy HH:mm');
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const emojis = ['😀', '😍', '🤣', '😎', '🤔', '👍', '❤️', '🎉', '🔥', '✨'];

  // Render contact list view
  const renderListView = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-blue-100 text-sm">{contacts.length} Kontakte</p>
          </div>
          <button
            onClick={() => setShowStoryComposer(true)}
            className="bg-white/20 backdrop-blur p-2 rounded-full hover:bg-white/30 transition"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Suche Kontakte..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/90 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Stories Section */}
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide">
          {/* Add Story */}
          <button
            onClick={() => setShowStoryComposer(true)}
            className="flex-shrink-0 flex flex-col items-center gap-1"
          >
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                <Plus className="w-3 h-3 text-white" />
              </div>
            </div>
            <span className="text-xs text-gray-600">Your Story</span>
          </button>

          {/* Stories */}
          {stories.map(story => (
            <button
              key={story.id}
              onClick={() => setActiveStoryView(story)}
              className="flex-shrink-0 flex flex-col items-center gap-1"
            >
              <div className={`w-16 h-16 rounded-full p-0.5 ${
                story.viewed
                  ? 'bg-gradient-to-br from-gray-300 to-gray-400'
                  : 'bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500'
              }`}>
                <div className="w-full h-full bg-white rounded-full p-0.5">
                  <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold">
                    {story.userName?.[0]?.toUpperCase()}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-600 max-w-[64px] truncate">
                {story.userName}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <Users className="w-12 h-12 mb-2" />
            <p>Keine Kontakte gefunden</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Group Chats */}
            {threads.filter(t => t.type === 'group').map(thread => (
              <button
                key={thread.id}
                onClick={() => {
                  setSelectedThread(thread);
                  loadMessages(thread.id);
                  setView('chat');
                }}
                className="w-full p-4 hover:bg-gray-50 transition flex items-center gap-3"
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-gray-900">{thread.name}</p>
                  <p className="text-sm text-gray-500">
                    {thread.participant_count || 0} Mitglieder
                  </p>
                </div>
                {thread.unread_count > 0 && (
                  <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {thread.unread_count}
                  </div>
                )}
              </button>
            ))}

            {/* Divider */}
            {threads.filter(t => t.type === 'group').length > 0 && (
              <div className="py-2 px-4 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase">Direkte Nachrichten</p>
              </div>
            )}

            {/* Direct Messages */}
            {filteredContacts.length > 0 ? (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  className="w-full p-4 hover:bg-gray-50 transition flex items-center gap-3"
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold">
                      {contact.name?.[0]?.toUpperCase()}
                    </div>
                    {contact.is_online && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">{contact.name}</p>
                    <p className="text-sm text-gray-500">
                      {contact.is_online ? 'Online' : contact.last_seen ?
                        formatDistanceToNow(new Date(contact.last_seen), { addSuffix: true, locale: de }) :
                        'Offline'}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchTerm ? 'Keine Kontakte gefunden' : 'Keine Kontakte verfügbar'}
                </p>
                {!searchTerm && (
                  <p className="text-sm text-gray-400 mt-2">
                    Kontakte werden geladen...
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render chat view
  const renderChatView = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => setView('list')}
          className="p-2 hover:bg-gray-100 rounded-full transition lg:hidden"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold">
            {selectedContact?.name?.[0]?.toUpperCase() ||
             selectedThread?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">
              {selectedContact?.name || selectedThread?.name}
            </p>
            <p className="text-xs text-gray-500">
              {selectedContact?.is_online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <VideoIcon className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageCircle className="w-16 h-16 mb-4" />
            <p>Keine Nachrichten</p>
            <p className="text-sm">Beginne die Konversation!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id || idx}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] ${isMine ? 'order-2' : 'order-1'}`}>
                    <div className={`
                      px-4 py-2 rounded-2xl
                      ${isMine
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'}
                    `}>
                      <p className="break-words">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isMine ? 'text-blue-100' : 'text-gray-400'}`}>
                        {formatMessageTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-3">
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded"
                />
                <button
                  onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
          >
            <Smile className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <input
              ref={messageInputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Nachricht schreiben..."
              className="w-full px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg p-2 flex gap-1">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setMessageText(messageText + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-2xl hover:bg-gray-100 p-1 rounded"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsRecording(!isRecording)}
            className={`p-2 rounded-full transition ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={sending || (!messageText.trim() && attachments.length === 0)}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={(e) => setAttachments([...attachments, ...Array.from(e.target.files)])}
          className="hidden"
        />
      </div>
    </div>
  );

  // Story Composer
  const renderStoryComposer = () => (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={() => setShowStoryComposer(false)}
          className="p-2 hover:bg-white/10 rounded-full transition"
        >
          <X className="w-6 h-6" />
        </button>
        <p className="font-semibold">Create Story</p>
        <button className="px-4 py-2 bg-blue-500 rounded-full text-sm font-semibold">
          Share
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-white">
          <Camera className="w-24 h-24 mx-auto mb-4" />
          <p className="text-xl mb-2">Add to your story</p>
          <p className="text-gray-300">Share a moment with your contacts</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 p-6">
        <button className="p-4 bg-white/10 backdrop-blur rounded-full">
          <Image className="w-6 h-6 text-white" />
        </button>
        <button className="p-4 bg-white/10 backdrop-blur rounded-full">
          <Video className="w-6 h-6 text-white" />
        </button>
        <button className="p-4 bg-white/10 backdrop-blur rounded-full">
          <Camera className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );

  // Story Viewer
  const renderStoryViewer = () => {
    if (!activeStoryView) return null;

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 text-white absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center font-bold">
              {activeStoryView.userName?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold">{activeStoryView.userName}</p>
              <p className="text-xs opacity-75">
                {formatDistanceToNow(activeStoryView.createdAt, { addSuffix: true, locale: de })}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveStoryView(null)}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          {activeStoryView.content.type === 'image' && (
            <img
              src={activeStoryView.content.url}
              alt="Story"
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>

        <div className="p-4 text-white text-center">
          <p className="mb-2">{activeStoryView.content.caption}</p>
          <p className="text-sm opacity-75">
            <Eye className="w-4 h-4 inline mr-1" />
            {activeStoryView.viewers} views
          </p>
        </div>
      </div>
    );
  };

  // Main render
  const isMobile = window.innerWidth < 768;

  return (
    <div className="h-full w-full bg-white">
      {isMobile ? (
        // Mobile Layout
        <>
          {view === 'list' && renderListView()}
          {view === 'chat' && renderChatView()}
          {showStoryComposer && renderStoryComposer()}
          {activeStoryView && renderStoryViewer()}
        </>
      ) : (
        // Desktop Layout
        <div className="flex h-full">
          <div className="w-96 border-r">
            {renderListView()}
          </div>
          <div className="flex-1">
            {selectedThread || selectedContact ? renderChatView() : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="w-24 h-24 mx-auto mb-4" />
                  <p className="text-xl">Wähle einen Chat aus</p>
                </div>
              </div>
            )}
          </div>
          {showStoryComposer && renderStoryComposer()}
          {activeStoryView && renderStoryViewer()}
        </div>
      )}
    </div>
  );
};

export default MessengerRedesigned;