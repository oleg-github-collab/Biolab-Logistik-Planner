import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  ChevronLeft,
  Plus,
  Paperclip,
  Smile,
  MoreVertical,
  Users,
  Check,
  CheckCheck,
  Phone,
  Video,
  Info,
  Bot,
  User,
  MessageSquare,
  X,
  Image,
  FileText,
  Mic,
  StopCircle,
  Play,
  Pause,
  Download,
  Reply,
  Forward,
  Pin,
  Trash2,
  Edit,
  Camera,
  Settings,
  Clock,
  Calendar,
  File,
  Upload
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';
import io from 'socket.io-client';

// API configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

// API instance with auth headers
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const EnhancedMessenger = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  // UI States
  const [view, setView] = useState('list'); // 'list' | 'chat' | 'stories'
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Data States
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [stories, setStories] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Input States
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);

  // Feature States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Modal States
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showStoryCreate, setShowStoryCreate] = useState(false);
  const [showStoryView, setShowStoryView] = useState(false);
  const [currentStory, setCurrentStory] = useState(null);
  const [storyFile, setStoryFile] = useState(null);
  const [storyCaption, setStoryCaption] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const typingTimeout = useRef(null);
  const storyFileInputRef = useRef(null);

  // BL_Bot ID (from database)
  const BL_BOT_ID = 999999;

  // Initialize Socket.IO
  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('token') }
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    newSocket.on('new_message', (message) => {
      if (selectedConversation?.id === message.conversation_id) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }
      // Update conversation list
      loadConversations();
    });

    newSocket.on('user_typing', ({ userId, conversationId, isTyping }) => {
      if (conversationId === selectedConversation?.id) {
        setTypingUsers(prev => {
          if (isTyping) {
            return [...prev.filter(id => id !== userId), userId];
          } else {
            return prev.filter(id => id !== userId);
          }
        });
      }
    });

    newSocket.on('message_updated', (updatedMessage) => {
      setMessages(prev => prev.map(msg =>
        msg.id === updatedMessage.id ? updatedMessage : msg
      ));
    });

    newSocket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load initial data
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadContacts(),
        loadConversations(),
        loadStories()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await api.get('/messages/contacts');
      setContacts(res.data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await api.get('/messages/conversations');
      setConversations(res.data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/messages`);
      setMessages(res.data || []);

      // Mark messages as read
      api.post(`/messages/conversations/${conversationId}/read`);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadStories = async () => {
    try {
      const res = await api.get('/messages/stories');
      setStories(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading stories:', error);
      setStories([]);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();

    if ((!messageText.trim() && !attachmentFile) || !selectedConversation) return;

    setSending(true);

    try {
      const formData = new FormData();
      formData.append('message', messageText);

      if (attachmentFile) {
        formData.append('attachment', attachmentFile);
      }

      if (replyingTo) {
        formData.append('reply_to_id', replyingTo.id);
      }

      const res = await api.post(
        `/messages/conversations/${selectedConversation.id}/messages`,
        formData,
        {
          headers: attachmentFile ? { 'Content-Type': 'multipart/form-data' } : {}
        }
      );

      if (res.data) {
        setMessages(prev => [...prev, res.data]);
        setMessageText('');
        setAttachmentFile(null);
        setReplyingTo(null);
        scrollToBottom();

        // Update conversation list
        loadConversations();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Fehler beim Senden der Nachricht');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('Datei ist zu groß. Maximum 10MB erlaubt.');
        return;
      }
      setAttachmentFile(file);
      setShowAttachmentMenu(false);

      // Focus back on input
      inputRef.current?.focus();
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Bitte wählen Sie ein Bild aus.');
        return;
      }

      // Check file size (5MB limit for images)
      if (file.size > 5 * 1024 * 1024) {
        alert('Bild ist zu groß. Maximum 5MB erlaubt.');
        return;
      }

      setAttachmentFile(file);
      setShowAttachmentMenu(false);
      inputRef.current?.focus();
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });

        setAttachmentFile(audioFile);
        setIsRecording(false);
        setRecordingTime(0);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      // Start recording timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      mediaRecorder.current.timer = timer;
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Fehler beim Zugriff auf das Mikrofon');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      clearInterval(mediaRecorder.current.timer);
      mediaRecorder.current.stop();
    }
  };

  const handleTyping = () => {
    if (!socket || !selectedConversation) return;

    socket.emit('typing', {
      conversationId: selectedConversation.id,
      isTyping: true
    });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing', {
        conversationId: selectedConversation.id,
        isTyping: false
      });
    }, 2000);
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Nachricht wirklich löschen?')) return;

    try {
      await api.delete(`/messages/${messageId}`);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const editMessage = async (messageId, newText) => {
    try {
      const res = await api.put(`/messages/${messageId}`, { message: newText });
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? res.data : msg
      ));
      setEditingMessage(null);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const createConversation = async (type, members = [], name = '') => {
    try {
      const res = await api.post('/messages/conversations', {
        type,
        members,
        name
      });

      if (res.data) {
        await loadConversations();
        setSelectedConversation(res.data);
        await loadMessages(res.data.id);
        setShowNewChatModal(false);

        if (isMobile) {
          setView('chat');
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const createBotChat = async () => {
    // Check if bot chat already exists
    const existingBot = conversations.find(c =>
      c.is_bot || c.name === 'BL_Bot' || c.members?.some(m => m.id === BL_BOT_ID)
    );

    if (existingBot) {
      setSelectedConversation(existingBot);
      await loadMessages(existingBot.id);
    } else {
      await createConversation('direct', [BL_BOT_ID], 'BL_Bot');
    }

    setShowNewChatModal(false);
    if (isMobile) setView('chat');
  };

  const handleStoryUpload = async () => {
    if (!storyFile) return;

    try {
      const formData = new FormData();
      formData.append('file', storyFile);
      formData.append('caption', storyCaption);

      await api.post('/messages/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowStoryCreate(false);
      setStoryFile(null);
      setStoryCaption('');

      // Reload stories
      await loadStories();
    } catch (error) {
      console.error('Error creating story:', error);
      alert('Fehler beim Erstellen der Story');
    }
  };

  const viewStory = async (story) => {
    setCurrentStory(story);
    setShowStoryView(true);

    // Mark story as viewed
    try {
      await api.post(`/messages/stories/${story.id}/view`);
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      setShowStoryView(false);
      setCurrentStory(null);
    }, 5000);
  };

  const formatMessageTime = (date) => {
    const msgDate = new Date(date);
    if (isToday(msgDate)) {
      return format(msgDate, 'HH:mm', { locale: de });
    } else if (isYesterday(msgDate)) {
      return 'Gestern ' + format(msgDate, 'HH:mm', { locale: de });
    } else {
      return format(msgDate, 'dd.MM.yyyy HH:mm', { locale: de });
    }
  };

  // Render Chat List
  const renderChatList = () => (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Messenger</h1>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Suchen..."
            className="w-full pl-10 pr-4 py-2 bg-white/90 text-gray-900 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Stories */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Add Story Button */}
          <button
            onClick={() => setShowStoryCreate(true)}
            className="flex-shrink-0 w-16 h-16"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <Plus className="w-6 h-6 text-gray-600" />
              </div>
              <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap">
                Story
              </span>
            </div>
          </button>

          {/* Stories List */}
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => viewStory(story)}
              className="flex-shrink-0 w-16 h-16"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 p-0.5">
                  <div className="w-full h-full rounded-full bg-white p-0.5">
                    {story.media_type === 'image' ? (
                      <img
                        src={story.media_url}
                        alt={story.user_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                        <Play className="w-6 h-6 text-purple-600" />
                      </div>
                    )}
                  </div>
                </div>
                <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 whitespace-nowrap truncate max-w-[64px]">
                  {story.user_name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Keine Unterhaltungen</p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Neue Unterhaltung starten
            </button>
          </div>
        ) : (
          conversations
            .filter(conv => {
              if (!searchTerm) return true;
              const search = searchTerm.toLowerCase();
              return conv.name?.toLowerCase().includes(search) ||
                     conv.last_message?.toLowerCase().includes(search);
            })
            .map((conv) => (
              <button
                key={conv.id}
                onClick={async () => {
                  setSelectedConversation(conv);
                  await loadMessages(conv.id);
                  if (isMobile) setView('chat');
                }}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    conv.is_bot ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  }`}>
                    {conv.is_bot ? <Bot className="w-6 h-6" /> : conv.name?.charAt(0)}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{conv.name}</p>
                    <span className="text-xs text-gray-500">
                      {conv.last_message_time && formatMessageTime(conv.last_message_time)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {conv.last_message || 'Keine Nachrichten'}
                  </p>
                </div>
              </button>
            ))
        )}
      </div>
    </div>
  );

  // Render Chat View
  const renderChat = () => {
    if (!selectedConversation) return null;

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => {
                    setView('list');
                    setSelectedConversation(null);
                  }}
                  className="p-1"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                selectedConversation.is_bot ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-400 to-indigo-500'
              }`}>
                {selectedConversation.is_bot ? <Bot className="w-5 h-5" /> : selectedConversation.name?.charAt(0)}
              </div>

              <div>
                <p className="font-semibold">{selectedConversation.name}</p>
                {typingUsers.length > 0 && (
                  <p className="text-xs text-white/80">schreibt...</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.map((message) => {
            const isOwn = message.sender_id === user?.id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
                  {/* Reply indicator */}
                  {message.reply_to && (
                    <div className={`text-xs text-gray-500 mb-1 px-3 ${isOwn ? 'text-right' : ''}`}>
                      <Reply className="inline w-3 h-3 mr-1" />
                      Antwort auf {message.reply_to.sender_name}
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                        : 'bg-white text-gray-900 shadow-md'
                    }`}
                  >
                    {/* Attachment */}
                    {message.attachment_url && (
                      <div className="mb-2">
                        {message.attachment_type?.startsWith('image/') ? (
                          <img
                            src={message.attachment_url}
                            alt="Attachment"
                            className="rounded-lg max-w-full"
                          />
                        ) : message.attachment_type?.startsWith('audio/') ? (
                          <audio controls className="max-w-full">
                            <source src={message.attachment_url} type={message.attachment_type} />
                          </audio>
                        ) : (
                          <a
                            href={message.attachment_url}
                            download
                            className={`flex items-center gap-2 ${isOwn ? 'text-white' : 'text-blue-600'}`}
                          >
                            <Download className="w-4 h-4" />
                            <span>Datei herunterladen</span>
                          </a>
                        )}
                      </div>
                    )}

                    <p className="break-words">{message.message}</p>

                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      isOwn ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      <span>{formatMessageTime(message.created_at)}</span>
                      {isOwn && (
                        <>
                          {message.is_read ? (
                            <CheckCheck className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Message actions */}
                  {isOwn && (
                    <div className="flex justify-end gap-1 mt-1">
                      <button
                        onClick={() => setEditingMessage(message)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reply indicator */}
        {replyingTo && (
          <div className="px-4 py-2 bg-gray-100 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Reply className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Antwort an {replyingTo.sender_name}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Attachment preview */}
        {attachmentFile && (
          <div className="px-4 py-2 bg-gray-100 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 truncate max-w-[200px]">
                {attachmentFile.name}
              </span>
            </div>
            <button
              onClick={() => setAttachmentFile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
          <div className="flex items-center gap-2">
            {/* Attachment menu button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Plus className="w-6 h-6 text-gray-600" />
              </button>

              {/* Attachment menu */}
              {showAttachmentMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border p-2 min-w-[200px]">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Image className="w-5 h-5 text-blue-600" />
                    <span>Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <File className="w-5 h-5 text-green-600" />
                    <span>Datei</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.capture = 'camera';
                      input.onchange = handleImageSelect;
                      input.click();
                      setShowAttachmentMenu(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Camera className="w-5 h-5 text-purple-600" />
                    <span>Kamera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Voice recording button */}
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Mic className="w-6 h-6 text-gray-600" />
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="p-2 bg-red-100 hover:bg-red-200 rounded-full transition-colors animate-pulse"
              >
                <StopCircle className="w-6 h-6 text-red-600" />
              </button>
            )}

            {/* Text input */}
            <div className="flex-1 relative">
              {isRecording ? (
                <div className="px-4 py-2 bg-red-50 rounded-full text-red-600 text-center">
                  Aufnahme... {recordingTime}s
                </div>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingMessage ? editingMessage.message : messageText}
                    onChange={(e) => {
                      if (editingMessage) {
                        setEditingMessage({ ...editingMessage, message: e.target.value });
                      } else {
                        setMessageText(e.target.value);
                        handleTyping();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && editingMessage) {
                        setEditingMessage(null);
                      }
                    }}
                    placeholder={editingMessage ? "Nachricht bearbeiten..." : "Nachricht schreiben..."}
                    className="w-full px-4 py-2 pr-10 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Emoji button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <Smile className="w-5 h-5 text-gray-500" />
                  </button>

                  {/* Emoji picker */}
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-2 z-50">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={300}
                        height={400}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Send/Update button */}
            {editingMessage ? (
              <button
                type="button"
                onClick={() => editMessage(editingMessage.id, editingMessage.message)}
                className="p-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
              >
                <Check className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!messageText.trim() && !attachmentFile) || sending}
                className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>
        </form>
      </div>
    );
  };

  // New Chat Modal
  const renderNewChatModal = () => {
    if (!showNewChatModal) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={() => setShowNewChatModal(false)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Neue Unterhaltung</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* BL_Bot Option */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <button
                onClick={createBotChat}
                className="w-full p-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-purple-200 transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900">BL_Bot</p>
                  <p className="text-sm text-gray-600">KI-Assistent für Hilfe & Fragen</p>
                </div>
              </button>
            </div>

            <p className="text-sm font-semibold text-gray-500 mb-2">Teammitglieder:</p>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => createConversation('direct', [contact.id])}
                  className="w-full p-4 flex items-center gap-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                    {contact.name?.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{contact.name}</p>
                    <p className="text-sm text-gray-500">{contact.email}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t">
            <button
              onClick={() => setShowNewChatModal(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Story Create Modal
  const renderStoryCreateModal = () => {
    if (!showStoryCreate) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={() => setShowStoryCreate(false)}
      >
        <div
          className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Story erstellen</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center">
              <input
                ref={storyFileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setStoryFile(e.target.files?.[0])}
                className="hidden"
              />

              {storyFile ? (
                <div className="space-y-2">
                  {storyFile.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(storyFile)}
                      alt="Story preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Play className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-700">{storyFile.name}</p>
                  <button
                    onClick={() => setStoryFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Entfernen
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => storyFileInputRef.current?.click()}
                  className="space-y-2"
                >
                  <Upload className="w-16 h-16 text-purple-400 mx-auto" />
                  <p className="text-sm text-gray-600">Foto oder Video auswählen</p>
                </button>
              )}
            </div>

            <textarea
              value={storyCaption}
              onChange={(e) => setStoryCaption(e.target.value)}
              placeholder="Beschreibung hinzufügen (optional)..."
              className="w-full px-4 py-3 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowStoryCreate(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleStoryUpload}
                disabled={!storyFile}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all"
              >
                Posten
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Story View Modal
  const renderStoryViewModal = () => {
    if (!showStoryView || !currentStory) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onClick={() => setShowStoryView(false)}
      >
        <div className="relative w-full h-full max-w-md">
          {/* Story Progress */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full animate-[progress_5s_linear]"
                style={{
                  animation: 'progress 5s linear',
                  '@keyframes progress': {
                    from: { width: '0%' },
                    to: { width: '100%' }
                  }
                }}
              />
            </div>
          </div>

          {/* Story Header */}
          <div className="absolute top-12 left-4 right-4 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {currentStory.user_name?.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold">{currentStory.user_name}</p>
                <p className="text-white/80 text-xs">
                  {formatDistanceToNow(new Date(currentStory.created_at), {
                    addSuffix: true,
                    locale: de
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStoryView(false)}
              className="text-white p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Story Content */}
          <div className="w-full h-full flex items-center justify-center p-4">
            {currentStory.media_type === 'image' ? (
              <img
                src={currentStory.media_url}
                alt="Story"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video
                src={currentStory.media_url}
                className="max-w-full max-h-full"
                controls
                autoPlay
              />
            )}
          </div>

          {/* Story Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-8 left-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white text-center text-lg font-medium">
                {currentStory.caption}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render
  return (
    <>
      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>

      {isMobile ? (
        <div className="h-screen flex flex-col bg-white">
          {view === 'list' ? renderChatList() : renderChat()}
        </div>
      ) : (
        <div className="h-screen flex bg-white">
          <div className="w-96 border-r flex-shrink-0">
            {renderChatList()}
          </div>
          <div className="flex-1">
            {selectedConversation ? (
              renderChat()
            ) : (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <MessageSquare className="w-16 h-16 text-blue-600" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-700">Wähle eine Unterhaltung</p>
                  <p className="text-gray-500 mt-2">
                    Wähle einen Chat aus der Liste oder starte eine neue Unterhaltung
                  </p>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    Neue Unterhaltung
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {renderNewChatModal()}
      {renderStoryCreateModal()}
      {renderStoryViewModal()}
    </>
  );
};

export default EnhancedMessenger;