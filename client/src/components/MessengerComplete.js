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
  Edit
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import EmojiPicker from 'emoji-picker-react';

// API instance with auth headers
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
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

const MessengerComplete = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'chat' | 'newChat' | 'stories'
  const [contacts, setContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [stories, setStories] = useState([]);
  const [showStoryCreate, setShowStoryCreate] = useState(false);
  const [showStoryView, setShowStoryView] = useState(false);
  const [currentStory, setCurrentStory] = useState(null);
  const [storyFile, setStoryFile] = useState(null);
  const [storyText, setStoryText] = useState('');
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [groupInfoData, setGroupInfoData] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorder = useRef(null);
  const typingTimeout = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // BL_Bot ID (from database)
  const BL_BOT_ID = 999999;

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
    loadAllData();
    loadQuickReplies();
    loadStories();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load contacts
      const contactsRes = await api.get('/messages/contacts');
      setContacts(Array.isArray(contactsRes?.data) ? contactsRes.data : []);

      // Load conversations
      const conversationsRes = await api.get('/messages/conversations');
      const convList = Array.isArray(conversationsRes?.data) ? conversationsRes.data : [];

      // Ensure General chat exists
      const hasGeneral = convList.some(c => c.name === 'General' && c.conversation_type === 'group');
      if (!hasGeneral) {
        // Create General chat if it doesn't exist
        try {
          const generalChat = await api.post('/messages/conversations', {
            name: 'General',
            description: 'Allgemeiner Chat für alle Mitarbeiter',
            conversation_type: 'group',
            members: [] // Will add all users server-side
          });
          if (generalChat.data) {
            convList.unshift(generalChat.data);
          }
        } catch (err) {
          console.log('General chat might already exist');
        }
      }

      setConversations(convList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuickReplies = async () => {
    try {
      const res = await api.get('/messages/quick-replies');
      setQuickReplies(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading quick replies:', error);
    }
  };

  const loadStories = async () => {
    try {
      const res = await api.get('/messages/stories');
      setStories(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading stories:', error);
      // Не критично, stories може не бути
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/messages`);
      const messageList = Array.isArray(res?.data) ? res.data : [];

      // Mark messages as read
      await api.post(`/messages/conversations/${conversationId}/read`);

      setMessages(messageList);
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const handleConversationSelect = async (conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);

    if (isMobile) {
      setView('chat');
    }

    // Focus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();

    if ((!messageText.trim() && !attachmentFile) || !selectedConversation) return;

    setSending(true);

    try {
      let messageData = {
        conversation_id: selectedConversation.id,
        message: messageText.trim(),
        message_type: 'text'
      };

      // Handle file attachment
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('file', attachmentFile);

        const uploadRes = await api.post('/messages/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data) {
          messageData.attachments = [{
            file_type: attachmentFile.type.startsWith('image/') ? 'image' : 'file',
            file_url: uploadRes.data.url,
            file_name: attachmentFile.name,
            file_size: attachmentFile.size,
            mime_type: attachmentFile.type
          }];
          messageData.message_type = attachmentFile.type.startsWith('image/') ? 'image' : 'file';
        }
        setAttachmentFile(null);
      }

      // Handle reply
      if (replyingTo) {
        await api.post(`/messages/${replyingTo.id}/quote`, {
          snippet: messageText.substring(0, 100)
        });
        setReplyingTo(null);
      }

      // Send message
      const res = await api.post(`/messages/conversations/${selectedConversation.id}/messages`, messageData);

      if (res.data) {
        // Add message to local state
        setMessages(prev => [...prev, res.data]);
        setMessageText('');
        scrollToBottom();

        // Handle bot conversation - check if it's a bot conversation
        const isBotConversation =
          selectedConversation.is_bot ||
          selectedConversation.name === 'BL_Bot' ||
          selectedConversation.name === 'EntsorgungsBot' ||
          selectedConversation.members?.some(m => m.id === BL_BOT_ID || m.id === 8 || m.is_system_user);

        if (isBotConversation) {
          handleBotResponse(messageText);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Fehler beim Senden der Nachricht');
    } finally {
      setSending(false);
    }
  };

  const handleBotResponse = async (userMessage) => {
    // Simulate typing
    setTypingUsers([{ id: BL_BOT_ID, name: 'BL_Bot' }]);

    setTimeout(async () => {
      setTypingUsers([]);

      // Generate bot response
      const botResponse = getBotResponse(userMessage);

      try {
        const res = await api.post(`/messages/conversations/${selectedConversation.id}/messages`, {
          conversation_id: selectedConversation.id,
          message: botResponse,
          message_type: 'text',
          sender_id: BL_BOT_ID // Bot sends as itself
        });

        if (res.data) {
          setMessages(prev => [...prev, res.data]);
          scrollToBottom();
        }
      } catch (error) {
        // Fallback: Add local bot response
        const localBotMessage = {
          id: Date.now(),
          sender_id: BL_BOT_ID,
          sender_name: 'BL_Bot',
          message: botResponse,
          created_at: new Date().toISOString(),
          is_bot: true
        };
        setMessages(prev => [...prev, localBotMessage]);
        scrollToBottom();
      }
    }, 2000);
  };

  const getBotResponse = (message) => {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hilfe') || lowerMessage.includes('help')) {
      return 'Ich kann Ihnen bei folgenden Aufgaben helfen:\n• 📦 Kisten verwalten und QR-Codes generieren\n• 🗑️ Abfallentsorgung planen und dokumentieren\n• 📅 Termine koordinieren und erinnern\n• 📊 Berichte und Statistiken erstellen\n• ❓ Fragen zum System beantworten\n\nWie kann ich Ihnen heute helfen?';
    }

    if (lowerMessage.includes('abfall') || lowerMessage.includes('entsorgung')) {
      return '🗑️ Für die Abfallentsorgung:\n\n1. Gehen Sie zum Abfall-Modul im Dashboard\n2. Wählen Sie die entsprechende Kategorie\n3. Tragen Sie die Menge und Details ein\n4. Ich erstelle automatisch die Entsorgungsaufgabe\n\nBenötigen Sie Hilfe bei einem spezifischen Abfalltyp?';
    }

    if (lowerMessage.includes('kiste') || lowerMessage.includes('box')) {
      return '📦 Das Kisten-Management finden Sie im Dashboard:\n\n• Neue Kisten hinzufügen und nummerieren\n• Status aktualisieren (Leer/In Benutzung/Voll)\n• QR-Codes generieren und drucken\n• Historie und Bewegungen verfolgen\n\nMöchten Sie eine neue Kiste anlegen?';
    }

    if (lowerMessage.includes('termin') || lowerMessage.includes('kalender')) {
      return '📅 Für Termine und Kalender:\n\n• Neue Events im Kalender erstellen\n• Erinnerungen einrichten\n• Team-Termine koordinieren\n• Wiederkehrende Aufgaben planen\n\nSoll ich einen Termin für Sie erstellen?';
    }

    if (lowerMessage.includes('danke') || lowerMessage.includes('thanks')) {
      return 'Gerne! 😊 Ich bin immer hier, wenn Sie Hilfe benötigen. Zögern Sie nicht, mich bei Fragen zu kontaktieren!';
    }

    if (lowerMessage.includes('hallo') || lowerMessage.includes('hi') || lowerMessage.includes('guten')) {
      return `Hallo ${user?.name || 'dort'}! 👋 Willkommen im BioLab Logistik System. Wie kann ich Ihnen heute helfen?`;
    }

    return 'Interessante Frage! Ich habe das Team informiert und werde Ihnen so schnell wie möglich eine detaillierte Antwort geben. In der Zwischenzeit können Sie:\n\n• Die Dokumentation im Hilfe-Bereich durchsuchen\n• Einen Admin direkt kontaktieren\n• Mir eine spezifischere Frage stellen\n\nWie kann ich Ihnen sonst noch helfen?';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('Datei ist zu groß. Maximum 5MB erlaubt.');
        return;
      }
      setAttachmentFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.current.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
        setAttachmentFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      // Start timer
      const startTime = Date.now();
      const interval = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      mediaRecorder.current.addEventListener('stop', () => {
        clearInterval(interval);
        setRecordingTime(0);
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Mikrofonzugriff verweigert');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handleTyping = () => {
    if (!selectedConversation) return;

    // Send typing indicator
    api.post('/messages/typing', {
      conversationId: selectedConversation.id,
      isTyping: true
    });

    // Clear previous timeout
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    // Set timeout to stop typing
    typingTimeout.current = setTimeout(() => {
      api.post('/messages/typing', {
        conversationId: selectedConversation.id,
        isTyping: false
      });
    }, 3000);
  };

  const handleEmojiClick = (emojiData) => {
    setMessageText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      await api.post(`/messages/${messageId}/react`, { emoji });
      // Reload messages to show reaction
      loadMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Nachricht löschen?')) return;

    try {
      await api.delete(`/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      await api.post(`/messages/${messageId}/pin`);
      // Reload messages to show pin status
      loadMessages(selectedConversation.id);
    } catch (error) {
      console.error('Error pinning message:', error);
    }
  };

  const handleQuickReply = (reply) => {
    setMessageText(reply.content);
    inputRef.current?.focus();

    // Track usage
    api.post(`/messages/quick-replies/${reply.id}/use`);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleShowGroupInfo = async () => {
    if (!selectedConversation) return;

    try {
      // Завантажуємо учасників групи
      const membersRes = await api.get(`/messages/conversations/${selectedConversation.id}/members`);

      // Завантажуємо файли з групи
      const filesRes = await api.get(`/messages/conversations/${selectedConversation.id}/files`);

      setGroupInfoData({
        conversation: selectedConversation,
        members: Array.isArray(membersRes?.data) ? membersRes.data : [],
        files: Array.isArray(filesRes?.data) ? filesRes.data : []
      });
      setShowGroupInfoModal(true);
    } catch (error) {
      console.error('Error loading group info:', error);
      // Показуємо модалку навіть якщо є помилка, але з порожніми даними
      setGroupInfoData({
        conversation: selectedConversation,
        members: [],
        files: []
      });
      setShowGroupInfoModal(true);
    }
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return `Gestern ${format(messageDate, 'HH:mm')}`;
    }
    return format(messageDate, 'dd.MM.yyyy HH:mm');
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render chat list
  const renderChatList = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-5 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold tracking-tight">Nachrichten</h1>
            <div className="flex items-center gap-2">
              <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1 text-sm font-semibold">
                {conversations.filter(c => c.unread_count > 0).length > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Suchen..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/25 backdrop-blur-md text-white placeholder-white/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Stories Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Stories</h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Add Your Story */}
          <button
            onClick={() => setShowStoryCreate(true)}
            className="flex-shrink-0 flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <p className="text-xs font-medium text-gray-700">Deine Story</p>
          </button>

          {/* Stories from others */}
          {stories.map((story) => (
            <button
              key={story.id}
              onClick={() => {
                setCurrentStory(story);
                setShowStoryView(true);
              }}
              className="flex-shrink-0 flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 p-0.5 shadow-md hover:shadow-lg transition-all hover:scale-105">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  {story.media_type === 'image' ? (
                    <img src={story.media_url} alt={story.user_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
              </div>
              <p className="text-xs font-medium text-gray-700 max-w-[64px] truncate">{story.user_name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
              <MessageSquare className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
            </div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MessageSquare className="w-10 h-10 text-blue-600" />
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-2">Keine Unterhaltungen</p>
            <p className="text-sm text-gray-500 mb-4">Starten Sie eine neue Konversation</p>
            <button
              onClick={loadAllData}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all font-medium"
            >
              Neu laden
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleConversationSelect(conv)}
                className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all duration-200 ${
                  selectedConversation?.id === conv.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg scale-[0.98]'
                    : 'hover:bg-white hover:shadow-md bg-white/60'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold shadow-lg transition-transform hover:scale-105 ${
                    selectedConversation?.id === conv.id
                      ? 'bg-white/20 text-white'
                      : conv.conversation_type === 'group'
                        ? 'bg-gradient-to-br from-green-400 to-teal-500 text-white'
                        : conv.is_bot
                          ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                  }`}>
                    {conv.conversation_type === 'group' ? <Users className="w-7 h-7" /> :
                     conv.is_bot ? <Bot className="w-7 h-7" /> :
                     <User className="w-7 h-7" />}
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-red-500 to-pink-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-bold text-white animate-pulse">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`font-bold truncate ${
                      selectedConversation?.id === conv.id ? 'text-white' : 'text-gray-900'
                    }`}>
                      {conv.name || 'Unterhaltung'}
                      {conv.is_bot && ' 🤖'}
                    </p>
                    {conv.last_message_at && (
                      <span className={`text-xs font-medium ml-2 flex-shrink-0 ${
                        selectedConversation?.id === conv.id ? 'text-white/90' : 'text-gray-500'
                      }`}>
                        {formatMessageTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${
                    selectedConversation?.id === conv.id ? 'text-white/90' : 'text-gray-600'
                  } ${conv.unread_count > 0 ? 'font-semibold' : ''}`}>
                    {conv.last_message || conv.description ||
                     (conv.conversation_type === 'group' ? '📢 Gruppenchat' : '💬 Direktnachricht')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Conversation & Stories Buttons */}
      <div className="p-3 bg-white/80 backdrop-blur-sm border-t border-gray-200 space-y-2">
        <button
          onClick={() => setShowNewChatModal(true)}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all font-semibold"
        >
          <Plus className="w-5 h-5" />
          Neue Unterhaltung
        </button>
        <button
          onClick={() => setShowStoryCreate(true)}
          className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all font-semibold"
        >
          <Plus className="w-4 h-4" />
          Story hinzufügen
        </button>
      </div>
    </div>
  );

  // Render chat view
  const renderChat = () => (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-4 flex items-center gap-3 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>

        {isMobile && (
          <button
            onClick={() => setView('list')}
            className="relative z-10 p-2 hover:bg-white/20 rounded-full transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => {
            if (selectedConversation?.conversation_type === 'group') {
              handleShowGroupInfo();
            }
          }}
          className="relative z-10 flex-1 flex items-center gap-3 hover:bg-white/10 rounded-xl p-2 transition-colors cursor-pointer"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg ${
            selectedConversation?.conversation_type === 'group'
              ? 'bg-white/20 backdrop-blur-md'
              : 'bg-white/20 backdrop-blur-md'
          }`}>
            {selectedConversation?.conversation_type === 'group' ? <Users className="w-6 h-6" /> : <User className="w-6 h-6" />}
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-lg">{selectedConversation?.name || 'Chat'}</p>
            <p className="text-xs text-white/80 font-medium">
              {selectedConversation?.conversation_type === 'group'
                ? `${selectedConversation.member_count || 0} Mitglieder`
                : 'Direktnachricht'
              }
            </p>
          </div>
        </button>

        <div className="relative z-10 flex items-center gap-1">
          <button className="p-2.5 hover:bg-white/20 rounded-xl transition">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2.5 hover:bg-white/20 rounded-xl transition">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2.5 hover:bg-white/20 rounded-xl transition">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Reply Bar */}
      {replyingTo && (
        <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-l-4 border-blue-500">
          <div className="flex items-center gap-2">
            <Reply className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600 font-semibold">
                Antworten an {replyingTo.sender_name}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {replyingTo.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-blue-100 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          {messages.map((msg, index) => {
            const isOwnMessage = msg.sender_id === user?.id;
            const isBotMessage = msg.sender_id === BL_BOT_ID;
            const showAvatar = !isOwnMessage && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar for group chats */}
                {!isOwnMessage && selectedConversation?.conversation_type === 'group' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-md ${
                    showAvatar ? '' : 'opacity-0'
                  } ${
                    isBotMessage
                      ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                      : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    {showAvatar && (isBotMessage ? <Bot className="w-4 h-4" /> : msg.sender_name?.charAt(0))}
                  </div>
                )}

                <div className={`group relative max-w-[75%] ${
                  isOwnMessage
                    ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white rounded-2xl rounded-br-md shadow-lg'
                    : isBotMessage
                      ? 'bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 text-gray-900 rounded-2xl rounded-bl-md shadow-md border-2 border-purple-200'
                      : 'bg-white text-gray-900 rounded-2xl rounded-bl-md shadow-md border border-gray-200'
                } px-4 py-3 transition-all hover:shadow-xl`}>
                  {/* Sender name for group chats */}
                  {selectedConversation?.conversation_type === 'group' && !isOwnMessage && showAvatar && (
                    <div className={`flex items-center gap-1.5 mb-2 ${
                      isBotMessage ? 'text-purple-600' : 'text-blue-600'
                    }`}>
                      <p className="text-xs font-bold">
                        {msg.sender_name}
                      </p>
                      {isBotMessage && (
                        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-full">BOT</span>
                      )}
                    </div>
                  )}

                {/* Message content */}
                {msg.message_type === 'image' && msg.attachments?.[0] ? (
                  <img
                    src={msg.attachments[0].file_url}
                    alt={msg.attachments[0].file_name}
                    className="rounded-lg max-w-full cursor-pointer"
                    onClick={() => window.open(msg.attachments[0].file_url, '_blank')}
                  />
                ) : msg.message_type === 'audio' && msg.attachments?.[0] ? (
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white/20 rounded-full">
                      <Play className="w-4 h-4" />
                    </button>
                    <div className="flex-1">
                      <div className="h-8 bg-white/20 rounded flex items-center">
                        {/* Waveform visualization would go here */}
                      </div>
                      <p className="text-xs mt-1">{msg.audio_duration || 0}s</p>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                )}

                {/* Attachments */}
                {msg.attachments?.length > 0 && msg.message_type !== 'image' && msg.message_type !== 'audio' && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-white/10 rounded hover:bg-white/20"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-xs truncate">{att.file_name}</span>
                        <Download className="w-3 h-3 ml-auto" />
                      </a>
                    ))}
                  </div>
                )}

                {/* Message time and status */}
                <div className={`flex items-center gap-1 mt-1 ${
                  msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
                }`}>
                  <span className="text-xs opacity-60">
                    {formatMessageTime(msg.created_at)}
                  </span>
                  {msg.sender_id === user?.id && (
                    msg.read_status ? <CheckCheck className="w-3 h-3 opacity-70" /> : <Check className="w-3 h-3 opacity-70" />
                  )}
                </div>

                {/* Message actions (hidden by default, shown on hover) */}
                <div className="absolute top-0 right-0 transform translate-x-full hidden group-hover:flex items-center gap-1 ml-2">
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 bg-white rounded shadow hover:bg-gray-100"
                  >
                    <Reply className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handlePinMessage(msg.id)}
                    className="p-1 bg-white rounded shadow hover:bg-gray-100"
                  >
                    <Pin className="w-3 h-3 text-gray-600" />
                  </button>
                  {msg.sender_id === user?.id && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1 bg-white rounded shadow hover:bg-gray-100"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  )}
                </div>

                {/* Reactions */}
                {msg.reactions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.reactions.map((reaction, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-white/20 rounded-full text-xs"
                      >
                        {reaction.emoji} {reaction.count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="flex justify-start gap-2">
              <div className="w-8 h-8"></div>
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl rounded-bl-md shadow-md border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 font-medium">
                    {typingUsers.map(u => u.name).join(', ')} tippt...
                  </span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attachment Preview */}
      {attachmentFile && (
        <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-t">
          <div className="flex items-center gap-2">
            {attachmentFile.type.startsWith('image/') ? (
              <Image className="w-5 h-5 text-blue-600" />
            ) : attachmentFile.type.startsWith('audio/') ? (
              <Mic className="w-5 h-5 text-purple-600" />
            ) : (
              <FileText className="w-5 h-5 text-gray-600" />
            )}
            <span className="text-sm text-gray-700 truncate">
              {attachmentFile.name}
            </span>
            <span className="text-xs text-gray-500">
              ({(attachmentFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            onClick={() => setAttachmentFile(null)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Quick Replies */}
      {quickReplies.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t flex gap-2 overflow-x-auto">
          {quickReplies.slice(0, 5).map((reply) => (
            <button
              key={reply.id}
              onClick={() => handleQuickReply(reply)}
              className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 whitespace-nowrap"
            >
              {reply.title}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md border-t border-gray-200 px-4 py-4 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          {/* File attachment */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,audio/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <Paperclip className="w-5 h-5 text-gray-600" />
          </button>

          {/* Voice recording */}
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <Mic className="w-5 h-5 text-gray-600" />
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-red-100 hover:bg-red-200 rounded-full transition animate-pulse"
            >
              <StopCircle className="w-5 h-5 text-red-600" />
              <span className="ml-2 text-xs text-red-600">{recordingTime}s</span>
            </button>
          )}

          {/* Text input */}
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTyping();
              }}
              placeholder="Nachricht eingeben..."
              className="w-full px-4 py-2.5 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition pr-10"
              disabled={sending || isRecording}
            />

            {/* Emoji picker */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full transition"
            >
              <Smile className="w-5 h-5 text-gray-500" />
            </button>

            {/* Emoji picker popup */}
            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2">
                <div className="bg-white rounded-lg shadow-xl border">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width={300}
                    height={400}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            type="submit"
            disabled={(!messageText.trim() && !attachmentFile) || sending}
            className="p-3 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white rounded-full hover:from-blue-600 hover:via-blue-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );

  // New Chat Modal
  const renderNewChatModal = () => {
    if (!showNewChatModal) return null;

    const createBotChat = async () => {
      try {
        // Пошук BL_Bot conversation або створення нового
        const existingBotChat = conversations.find(c => c.is_bot || c.name === 'BL_Bot' || c.name === 'EntsorgungsBot');

        if (existingBotChat) {
          setSelectedConversation(existingBotChat);
          await loadMessages(existingBotChat.id);
        } else {
          // Створюємо новий чат з ботом
          const res = await api.post('/messages/conversations', {
            name: 'BL_Bot',
            type: 'direct',
            members: [8], // BL_Bot ID
            is_bot: true
          });
          if (res.data) {
            await loadAllData();
            setSelectedConversation(res.data);
          }
        }

        setShowNewChatModal(false);
        if (isMobile) setView('chat');
      } catch (error) {
        console.error('Error creating bot chat:', error);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowNewChatModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
                  <p className="font-bold text-gray-900">🤖 BL_Bot</p>
                  <p className="text-sm text-gray-600">KI-Assistent für Hilfe & Fragen</p>
                </div>
              </button>
            </div>

            <p className="text-sm font-semibold text-gray-500 mb-2">Teammitglieder:</p>
            <div className="space-y-2">
              {contacts.filter(contact => contact.id !== user?.id).map((contact) => (
                <button
                  key={contact.id}
                  onClick={async () => {
                    try {
                      const res = await api.post('/messages/conversations', {
                        type: 'direct',
                        members: [contact.id]
                      });
                      if (res.data) {
                        await loadAllData();
                        setSelectedConversation(res.data);
                        setShowNewChatModal(false);
                        if (isMobile) setView('chat');
                      }
                    } catch (error) {
                      console.error('Error creating conversation:', error);
                    }
                  }}
                  className="w-full p-3 flex items-center gap-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                    {contact.name?.charAt(0) || '?'}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{contact.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500 truncate flex-1">{contact.email}</p>
                      {contact.is_online ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium flex-shrink-0">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          Online
                        </span>
                      ) : contact.last_seen ? (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(contact.last_seen), { addSuffix: true, locale: de })}
                        </span>
                      ) : null}
                    </div>
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

    const handleStoryUpload = async () => {
      if (!storyFile) return;

      try {
        const formData = new FormData();
        formData.append('file', storyFile);
        formData.append('text', storyText);

        await api.post('/messages/stories', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setShowStoryCreate(false);
        setStoryFile(null);
        setStoryText('');
        // Reload stories
        const res = await api.get('/messages/stories');
        setStories(Array.isArray(res?.data) ? res.data : []);
      } catch (error) {
        console.error('Error creating story:', error);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowStoryCreate(false)}>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-2xl">
            <h2 className="text-2xl font-bold text-white">Story erstellen</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setStoryFile(e.target.files[0])}
                className="hidden"
                id="story-file"
              />
              <label htmlFor="story-file" className="cursor-pointer">
                {storyFile ? (
                  <div className="space-y-2">
                    <Image className="w-16 h-16 text-purple-600 mx-auto" />
                    <p className="text-sm font-medium text-gray-700">{storyFile.name}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Plus className="w-16 h-16 text-purple-400 mx-auto" />
                    <p className="text-sm text-gray-600">Foto oder Video auswählen</p>
                  </div>
                )}
              </label>
            </div>

            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Text hinzufügen (optional)..."
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
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setShowStoryView(false)}>
        <div className="relative w-full h-full max-w-md">
          {/* Story Progress */}
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="h-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full w-full animate-progress"></div>
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
                <p className="text-white/80 text-xs">{formatMessageTime(currentStory.created_at)}</p>
              </div>
            </div>
            <button onClick={() => setShowStoryView(false)} className="text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Story Content */}
          <div className="w-full h-full flex items-center justify-center">
            {currentStory.media_type === 'image' ? (
              <img src={currentStory.media_url} alt="Story" className="max-w-full max-h-full object-contain" />
            ) : (
              <video src={currentStory.media_url} className="max-w-full max-h-full" controls autoPlay />
            )}
          </div>

          {/* Story Text */}
          {currentStory.text && (
            <div className="absolute bottom-8 left-4 right-4">
              <p className="text-white text-center text-lg font-medium drop-shadow-lg">{currentStory.text}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Group Info Modal
  const renderGroupInfoModal = () => {
    if (!showGroupInfoModal || !groupInfoData) return null;

    const { conversation, members, files } = groupInfoData;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowGroupInfoModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 rounded-t-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{conversation.name}</h2>
                  <p className="text-white/80 text-sm">{members.length} Mitglieder</p>
                </div>
              </div>
              <button
                onClick={() => setShowGroupInfoModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Description */}
            {conversation.description && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Beschreibung
                </h3>
                <p className="text-gray-700 bg-gray-50 p-4 rounded-xl">{conversation.description}</p>
              </div>
            )}

            {/* Members */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Mitglieder ({members.length})
              </h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                      {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{member.name || 'Unbekannt'}</p>
                      <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                    {member.is_online && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs font-medium text-green-700">Online</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Files */}
            {files.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Dateien ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        {file.file_type === 'image' ? (
                          <Image className="w-5 h-5 text-blue-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {file.sender_name} • {formatMessageTime(file.created_at)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => setShowGroupInfoModal(false)}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main render
  if (isMobile) {
    return (
      <>
        <div className="h-screen flex flex-col bg-white">
          {view === 'list' ? renderChatList() : renderChat()}
        </div>
        {renderNewChatModal()}
        {renderStoryCreateModal()}
        {renderStoryViewModal()}
        {renderGroupInfoModal()}
      </>
    );
  } else {
    return (
      <>
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
                </div>
              </div>
            )}
          </div>
        </div>
        {renderNewChatModal()}
        {renderStoryCreateModal()}
        {renderStoryViewModal()}
        {renderGroupInfoModal()}
      </>
    );
  }
};

export default MessengerComplete;