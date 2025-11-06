import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import GifPicker from './GifPicker';
import ConnectionStatus from './ConnectionStatus';
import MessageReactions from './MessageReactions';
import offlineQueue from '../utils/offlineQueue';
import { showSuccess, showError, showInfo, showCustom } from '../utils/toast';
import { showTypedNotification, NotificationTypes, getNotificationPermission } from '../utils/notifications';
import io from 'socket.io-client';

const ModernMessenger = () => {
  const auth = useAuth(); const user = auth?.user;
  const { isAdmin } = usePermissions();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [conversationSearchTerm, setConversationSearchTerm] = useState('');
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const typingTimeoutRef = useRef(null);
  const audioRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [reactionRefreshMap, setReactionRefreshMap] = useState({});

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    const wsUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:5000'
      : window.location.origin;

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      upgrade: true
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected for messenger');
      showInfo('Verbindung hergestellt');
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts');
      showSuccess('Verbindung wiederhergestellt');
      // Reload conversations to sync any missed messages
      loadConversations();
      if (selectedConversation) {
        loadMessages(selectedConversation.id);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('⚠️ WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        newSocket.connect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Handle online users
    newSocket.on('online_users', (users) => {
      setOnlineUsers(new Set(users.map(u => u.userId)));
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    // Handle new message - optimistic updates
    newSocket.on('new_message', (message) => {
      // Add message to list if conversation is selected
      if (selectedConversation && message.sender_id === selectedConversation.id) {
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });

        // Mark as read immediately if conversation is open (only for real messages)
        if (!message.isOptimistic && message.id && !message.id.toString().startsWith('temp_')) {
          newSocket.emit('mark_as_read', { messageId: message.id });
        }
      }

      // Update conversations list (debounced)
      if (!message.isOptimistic) {
        loadConversations();
      }

      // Show notification if not on current conversation or not on Messages page
      const isOnMessagesPage = location.pathname === '/messages';
      const isFromCurrentConversation = selectedConversation && message.sender_id === selectedConversation.id;

      if (!isOnMessagesPage || !isFromCurrentConversation) {
        // Show toast notification
        const messagePreview = message.message.length > 50
          ? message.message.substring(0, 50) + '...'
          : message.message;

        showCustom(`Neue Nachricht von ${message.sender_name}`, {
          label: 'Anzeigen',
          onClick: () => {
            // Navigate to messages or open conversation
            if (!isOnMessagesPage) {
              window.location.href = '/messages';
            }
          }
        });

        // Play notification sound if enabled
        const soundEnabled = localStorage.getItem('notification_sound') === 'true';
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(err => console.warn('Could not play sound:', err));
        }

        // Show desktop notification if granted
        if (getNotificationPermission() === 'granted') {
          showTypedNotification(NotificationTypes.NEW_MESSAGE, {
            messageId: message.id,
            senderId: message.sender_id,
            senderName: message.sender_name,
            messagePreview: messagePreview
          });
        }
      }
    });

    // Handle typing indicators
    newSocket.on('user_typing', (data) => {
      if (selectedConversation && data.userId === selectedConversation.id) {
        setTypingUsers(prev => new Set([...prev, data.userId]));
      }
    });

    newSocket.on('user_stopped_typing', (data) => {
      setTypingUsers(prev => {
        const updated = new Set(prev);
        updated.delete(data.userId);
        return updated;
      });
    });

    // Handle message read status
    newSocket.on('message_read', ({ messageId }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, read_status: 1 } : msg
      ));
    });

    // Handle message confirmation (optimistic -> real)
    newSocket.on('message_confirmed', ({ tempId, message }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === tempId ? { ...message, isOptimistic: false } : msg
      ));
    });

    // Handle message failure
    newSocket.on('message_failed', ({ tempId }) => {
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      showError('Nachricht konnte nicht gesendet werden');
    });

    // Handle message sent confirmation
    newSocket.on('message_sent', (message) => {
      // Optimistic update - add immediately
      if (message.isOptimistic && selectedConversation && message.receiver_id === selectedConversation.id) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    });

    const handleReactionUpdate = ({ messageId, reactions }) => {
      if (!messageId) return;
      const numericId = Number(messageId);

      setMessages(prev => prev.map(msg =>
        Number(msg.id) === numericId ? { ...msg, reactions } : msg
      ));

      setReactionRefreshMap(prev => {
        const key = String(messageId);
        return {
          ...prev,
          [key]: (prev[key] || 0) + 1
        };
      });
    };

    const handleMentionNotification = ({ messageId, mentionedBy }) => {
      const mentionAuthor = mentionedBy?.name || 'Ein Kollege';
      showCustom(`${mentionAuthor} hat dich erwähnt`, {
        label: 'Öffnen',
        onClick: () => {
          if (location.pathname !== '/messages') {
            window.location.href = '/messages';
          } else if (messageId) {
            const bubble = document.querySelector(`[data-message-id="${messageId}"]`);
            bubble?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            bubble?.classList.add('ring-2', 'ring-blue-400');
            setTimeout(() => {
              bubble?.classList.remove('ring-2', 'ring-blue-400');
            }, 1500);
          }
        }
      });
    };

    newSocket.on('message:reaction', handleReactionUpdate);
    newSocket.on('message:mentioned', handleMentionNotification);

    setSocket(newSocket);

    return () => {
      newSocket.off('message:reaction', handleReactionUpdate);
      newSocket.off('message:mentioned', handleMentionNotification);
      newSocket.disconnect();
    };
  }, [user, selectedConversation, location.pathname]);

  useEffect(() => {
    loadUsers();
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [newMessage]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/messages/contacts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Error loading users:', err);
      showError('Fehler beim Laden der Kontakte');
    }
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
      showError('Fehler beim Laden der Unterhaltungen');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await fetch(`/api/messages/conversation/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
      showError('Fehler beim Laden der Nachrichten');
    }
  };

  const startConversation = async (userId) => {
    try {
      const response = await fetch('/api/messages/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ receiver_id: userId })
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const conversation = await response.json();
      setSelectedConversation(conversation);
      setShowUserList(false);
      setContactSearchTerm('');
      setSidebarOpen(false);
      loadConversations();
      showSuccess('Unterhaltung gestartet');
    } catch (err) {
      console.error('Error starting conversation:', err);
      showError('Fehler beim Starten der Unterhaltung');
    }
  };

  const sendMessage = async (e, messageType = 'text', messageContent = null) => {
    if (e) e.preventDefault();

    const content = messageContent || newMessage.trim();
    if (!content || !selectedConversation || sending) return;

    setSending(true);
    setIsTyping(false);

    // Clear input immediately for better UX
    setNewMessage('');

    const messageData = {
      receiverId: selectedConversation.id,
      message: content,
      messageType: messageType
    };

    try {
      // Check if online and socket connected
      if (!navigator.onLine || !socket || !socket.connected) {
        // Add to offline queue
        offlineQueue.enqueue({
          type: 'message',
          data: messageData
        });

        showInfo('Nachricht wird gesendet, sobald Verbindung besteht');
        return;
      }

      // Send via WebSocket for instant delivery
      socket.emit('send_message', messageData);

      if (messageType === 'gif') {
        showSuccess('GIF gesendet!');
      }

      // Stop typing indicator
      if (socket) {
        socket.emit('typing_stop', { receiverId: selectedConversation.id });
      }
    } catch (err) {
      console.error('Error sending message:', err);

      // Add to offline queue on error
      offlineQueue.enqueue({
        type: 'message',
        data: messageData
      });

      showInfo('Nachricht wird später gesendet');
    } finally {
      setSending(false);
    }
  };

  const handleGifSelect = (gif) => {
    sendMessage(null, 'gif', gif.url);
    setShowGifPicker(false);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Größenbeschränkung 5MB
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      showError('Datei ist zu groß! Maximale Größe: 5MB');
      event.target.value = '';
      return;
    }

    // Prüfe Dateityp
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    if (!isImage && !isAudio) {
      showError('Nur Bilder und Audio-Dateien sind erlaubt');
      event.target.value = '';
      return;
    }

    try {
      setSending(true);

      // Erstelle FormData für Upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('receiverId', selectedConversation.id);
      formData.append('messageType', isImage ? 'image' : 'audio');

      const token = localStorage.getItem('token');
      const response = await fetch('/api/messages/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload fehlgeschlagen');
      }

      const data = await response.json();
      showSuccess(isImage ? 'Bild gesendet!' : 'Audio gesendet!');

      // Socket-Event für neue Nachricht
      if (socket) {
        socket.emit('send_message', {
          senderId: user.id,
          receiverId: selectedConversation.id,
          content: data.fileUrl,
          messageType: isImage ? 'image' : 'audio'
        });
      }

      // Input zurücksetzen
      event.target.value = '';

    } catch (error) {
      console.error('Upload error:', error);
      showError('Upload fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    setIsTyping(true);

    // Emit typing event via WebSocket
    if (socket && selectedConversation) {
      socket.emit('typing_start', { receiverId: selectedConversation.id });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Emit stop typing event
      if (socket && selectedConversation) {
        socket.emit('typing_stop', { receiverId: selectedConversation.id });
      }
    }, 1000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Gestern ' + format(date, 'HH:mm');
    } else {
      return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
    }
  };

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return 'Gestern';
    } else {
      return format(date, 'dd.MM.yy', { locale: de });
    }
  };

  const groupUsersByRole = (userList) => {
    const roleOrder = { superadmin: 0, admin: 1, employee: 2, user: 3 };
    const grouped = userList.reduce((acc, user) => {
      const role = user.role || 'user';
      if (!acc[role]) acc[role] = [];
      acc[role].push(user);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => roleOrder[a] - roleOrder[b]);
  };

  const getRoleLabel = (role) => {
    const labels = {
      superadmin: 'Super Admins',
      admin: 'Admins',
      employee: 'Mitarbeiter',
      user: 'Benutzer'
    };
    return labels[role] || role;
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(contactSearchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(contactSearchTerm.toLowerCase())
  );

  const groupedUsers = groupUsersByRole(filteredUsers);

  const filteredMessages = messageSearchTerm
    ? messages.filter(msg =>
        msg.message.toLowerCase().includes(messageSearchTerm.toLowerCase())
      )
    : messages;

  const groupMessagesByDate = (msgs) => {
    const grouped = [];
    let currentDate = null;

    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at);
      const dateStr = format(msgDate, 'yyyy-MM-dd');

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        grouped.push({ type: 'date', date: msgDate });
      }
      grouped.push({ type: 'message', data: msg });
    });

    return grouped;
  };

  const formatDateDivider = (date) => {
    if (isToday(date)) return 'Heute';
    if (isYesterday(date)) return 'Gestern';
    return format(date, 'dd. MMMM yyyy', { locale: de });
  };

  const openConversationWithUser = (contact) => {
    const existing = conversations.find(conv => conv.id === contact.id);

    if (existing) {
      setSelectedConversation({
        ...existing,
        name: existing.name || existing.user_name || contact.name,
        email: existing.email || existing.user_email || contact.email
      });
      setSidebarOpen(false);
      setMessageSearchTerm('');
      return;
    }

    startConversation(contact.id);
  };

  const UserAvatar = ({ user: avatarUser, size = 'w-10 h-10', showOnline = false, fontSize = 'text-sm' }) => {
    const initials = avatarUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const colors = [
      'bg-gradient-to-br from-red-400 to-red-600',
      'bg-gradient-to-br from-blue-400 to-blue-600',
      'bg-gradient-to-br from-green-400 to-green-600',
      'bg-gradient-to-br from-yellow-400 to-yellow-600',
      'bg-gradient-to-br from-purple-400 to-purple-600',
      'bg-gradient-to-br from-pink-400 to-pink-600',
      'bg-gradient-to-br from-indigo-400 to-indigo-600',
      'bg-gradient-to-br from-teal-400 to-teal-600'
    ];

    const colorIndex = avatarUser.id % colors.length;
    const isOnline = onlineUsers.has(avatarUser.id);

    return (
      <div className="relative flex-shrink-0">
        <div className={`${size} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold shadow-md ${fontSize}`}>
          {initials}
        </div>
        {showOnline && (
          <div className={`absolute -bottom-0.5 -right-0.5 ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
          } border-2 border-white rounded-full ${
            size === 'w-12 h-12' ? 'w-4 h-4' : 'w-3 h-3'
          } transition-all duration-300 ${isOnline ? 'animate-pulse' : ''}`} />
        )}
      </div>
    );
  };

  const MessageBubble = ({ message, isOwn }) => {
    const sender = !isOwn && message.sender_name ? {
      id: message.sender_id,
      name: message.sender_name
    } : null;

    const isGif = message.message_type === 'gif' || message.type === 'gif';
    const isImage = message.message_type === 'image' || message.type === 'image';
    const isAudio = message.message_type === 'audio' || message.type === 'audio';
    const isMedia = isGif || isImage || isAudio;
    const isHighlighted = messageSearchTerm &&
      message.message.toLowerCase().includes(messageSearchTerm.toLowerCase());

    return (
      <div
        data-message-id={message.id}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 group px-2 transition-all duration-200 ${
        isHighlighted ? 'bg-yellow-50 -mx-2 px-4 py-1 rounded-lg' : ''
      }`}
      >
        <div className={`flex items-end gap-1.5 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg ${
          isOwn ? 'flex-row-reverse' : 'flex-row'
        }`}>
          {!isOwn && sender && (
            <div className="mb-1">
              <UserAvatar user={sender} size="w-7 h-7" fontSize="text-xs" />
            </div>
          )}

          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            <div className={`${isMedia ? 'p-1' : 'px-3 py-2'} shadow-sm transition-all duration-200 ${
              isOwn
                ? 'bg-[#3B82F6] text-white rounded-2xl rounded-br-md hover:shadow-md'
                : 'bg-[#F3F4F6] text-gray-900 rounded-2xl rounded-bl-md hover:shadow-md'
            }`}>
              {isGif ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={message.message}
                    alt="GIF"
                    className="max-w-[250px] max-h-64 object-contain"
                    loading="lazy"
                  />
                </div>
              ) : isImage ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={message.message}
                    alt="Bild"
                    className="max-w-[250px] max-h-64 object-contain cursor-pointer hover:opacity-95 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(message.message, '_blank')}
                  />
                </div>
              ) : isAudio ? (
                <div className="p-2">
                  <audio
                    controls
                    className="max-w-[250px]"
                    src={message.message}
                    preload="metadata"
                  >
                    Ihr Browser unterstützt keine Audio-Wiedergabe.
                  </audio>
                </div>
              ) : (
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                  {message.message}
                </p>
              )}

              <div className={`flex items-center justify-end gap-1 mt-1 ${isMedia ? 'px-2 pb-1' : ''}`}>
                <span className={`text-[11px] ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                  {format(new Date(message.created_at), 'HH:mm')}
                </span>

                {isOwn && (
                  <div className="flex items-center">
                    {message.read_status ? (
                      <svg className="w-4 h-4 text-blue-200" viewBox="0 0 16 15" fill="none">
                        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="currentColor"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-200" viewBox="0 0 12 11" fill="none">
                        <path d="M11.1 2.1L9.4 0.6C9.3 0.5 9.1 0.5 9 0.6L3.4 6.7C3.3 6.8 3.1 6.8 3 6.7L0.9 4.6C0.8 4.5 0.6 4.5 0.5 4.6L0 5.1C-0.1 5.2 -0.1 5.4 0 5.5L2.9 8.9C3 9 3.2 9 3.3 8.9L11 1.6C11.2 1.5 11.2 1.2 11.1 2.1Z" fill="currentColor"/>
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>

            {message.id && !String(message.id).startsWith('temp_') && (
              <div className={`mt-1 ${isOwn ? 'items-end' : 'items-start'} flex`}>
                <MessageReactions
                  messageId={message.id}
                  currentUserId={user.id}
                  compact={isOwn}
                  refreshKey={reactionRefreshMap[String(message.id)] || 0}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TypingIndicator = () => (
    <div className="flex items-end gap-1.5 mb-2 px-2 animate-fadeIn">
      <div className="mb-1">
        <div className="w-7 h-7 bg-gray-200 rounded-full animate-pulse" />
      </div>
      <div className="bg-[#F3F4F6] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );

  const DateDivider = ({ date }) => (
    <div className="flex items-center justify-center my-4">
      <div className="bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
        {formatDateDivider(date)}
      </div>
    </div>
  );

  const EmptyState = ({ icon, title, description, action }) => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center px-4 py-12 max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 mb-6">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-500 mb-6">{description}</p>
        {action}
      </div>
    </div>
  );

  return (
    <>
      <ConnectionStatus socket={socket} />
      <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-full sm:w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col border-r border-gray-200`}>

        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUserList(true)}
                className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 transform hover:scale-110"
                title="Neue Unterhaltung"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={conversationSearchTerm}
              onChange={(e) => setConversationSearchTerm(e.target.value)}
              placeholder="Unterhaltungen durchsuchen..."
              className="w-full bg-gray-50 border-0 rounded-xl px-4 py-2.5 pl-11 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
            />
            <svg className="w-5 h-5 absolute left-3.5 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Contacts + Conversations */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="pb-6">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/90">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Kontakte</p>
                  <p className="text-xs text-gray-400">{users.length} registrierte Benutzer</p>
                </div>
                <button
                  onClick={loadUsers}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200"
                  title="Kontakte aktualisieren"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  placeholder="Kontakte durchsuchen..."
                  className="w-full bg-gray-50 border-0 rounded-xl px-4 py-2.5 pl-11 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-sm"
                />
                <svg className="w-5 h-5 absolute left-3.5 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  Keine Kontakte gefunden
                </div>
              ) : (
                filteredUsers.map((contact) => {
                  const conversation = conversations.find(conv => conv.id === contact.id);
                  const isSelected = selectedConversation?.id === contact.id;
                  const unreadCount = conversation?.unreadCount || 0;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => openConversationWithUser(contact)}
                      className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-all duration-200 border-l-4 ${
                        isSelected ? 'bg-blue-50 border-blue-600' : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <UserAvatar user={contact} size="w-11 h-11" showOnline fontSize="text-base" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {contact.name}
                          </p>
                          {conversation?.lastMessageTime && (
                            <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                              {formatLastMessageTime(conversation.lastMessageTime)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {conversation?.lastMessage || contact.status_message || 'Noch keine Nachrichten'}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <div className="bg-blue-600 text-white text-xs rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center font-semibold flex-shrink-0">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner variant="dots" size="md" text="Lade Unterhaltungen..." />
                </div>
              ) : conversations.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                  title="Keine Unterhaltungen"
                  description="Starten Sie eine neue Unterhaltung, um loszulegen"
                  action={
                    <button
                      onClick={() => setShowUserList(true)}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 transform hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Neue Unterhaltung
                    </button>
                  }
                />
              ) : (
                conversations
                  .filter(conv =>
                    !conversationSearchTerm ||
                    (conv.name || conv.user_name || '').toLowerCase().includes(conversationSearchTerm.toLowerCase())
                  )
                  .map(conversation => {
                    const conversationUser = {
                      id: conversation.id,
                      name: conversation.name || conversation.user_name,
                      email: conversation.email || conversation.user_email
                    };

                    const isSelected = selectedConversation?.id === conversation.id;

                    return (
                      <div
                        key={conversation.id}
                        onClick={() => {
                          setSelectedConversation(conversationUser);
                          setSidebarOpen(false);
                          setMessageSearchTerm('');
                        }}
                        className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar user={conversationUser} size="w-12 h-12" showOnline fontSize="text-base" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-sm font-semibold truncate ${
                                isSelected ? 'text-blue-900' : 'text-gray-900'
                              } ${conversation.unreadCount > 0 ? 'font-bold' : ''}`}>
                                {conversationUser.name}
                              </p>
                              {conversation.lastMessageTime && (
                                <span className={`text-xs flex-shrink-0 ml-2 ${
                                  conversation.unreadCount > 0 ? 'text-blue-600 font-semibold' : 'text-gray-500'
                                }`}>
                                  {formatLastMessageTime(conversation.lastMessageTime)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate flex-1 ${
                                conversation.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                              }`}>
                                {conversation.lastMessage || 'Keine Nachrichten'}
                              </p>
                              {conversation.unreadCount > 0 && (
                                <div className="bg-blue-600 text-white text-xs rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center font-semibold flex-shrink-0">
                                  {conversation.unreadCount}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#EFEAE2]">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center flex-shrink-0 shadow-sm">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden mr-3 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <UserAvatar user={selectedConversation} size="w-10 h-10" showOnline />

              <div className="ml-3 flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900 truncate">
                  {selectedConversation.name}
                </h2>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  {onlineUsers.has(selectedConversation.id) ? (
                    <>
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      Online
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                      Offline
                    </>
                  )}
                </p>
              </div>

              <button
                onClick={() => setShowMessageSearch(!showMessageSearch)}
                className={`p-2 rounded-full transition-all duration-200 ${
                  showMessageSearch
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title="Nachrichten durchsuchen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            {/* Search Bar */}
            {showMessageSearch && (
              <div className="bg-white border-b border-gray-200 px-4 py-3 animate-fadeIn">
                <div className="relative">
                  <input
                    type="text"
                    value={messageSearchTerm}
                    onChange={(e) => setMessageSearchTerm(e.target.value)}
                    placeholder="Nachrichten durchsuchen..."
                    className="w-full bg-gray-50 border-0 rounded-xl px-4 py-2 pl-11 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200 text-sm"
                  />
                  <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {messageSearchTerm && (
                    <button
                      onClick={() => setMessageSearchTerm('')}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d1d5db' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              {filteredMessages.length === 0 && !messageSearchTerm ? (
                <EmptyState
                  icon={
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                  title="Noch keine Nachrichten"
                  description="Senden Sie die erste Nachricht und starten Sie die Unterhaltung"
                />
              ) : filteredMessages.length === 0 && messageSearchTerm ? (
                <EmptyState
                  icon={
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                  title="Keine Ergebnisse"
                  description={`Keine Nachrichten gefunden für "${messageSearchTerm}"`}
                />
              ) : (
                <>
                  {groupMessagesByDate(filteredMessages).map((item, index) =>
                    item.type === 'date' ? (
                      <DateDivider key={`date-${index}`} date={item.date} />
                    ) : (
                      <MessageBubble
                        key={item.data.id}
                        message={item.data}
                        isOwn={item.data.sender_id === user.id}
                      />
                    )
                  )}
                  {typingUsers.has(selectedConversation.id) && <TypingIndicator />}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
              <form onSubmit={sendMessage} className="flex items-end gap-2">
                <input
                  type="file"
                  ref={(ref) => fileInputRef.current = ref}
                  accept="image/*,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />

                <button
                  type="button"
                  onClick={() => document.getElementById('file-upload').click()}
                  className="p-2.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-full transition-all duration-200 flex-shrink-0 transform hover:scale-110"
                  title="Foto oder Audio senden (max 5MB)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGifPicker(true)}
                  className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all duration-200 flex-shrink-0 transform hover:scale-110"
                  title="GIF senden"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    placeholder="Nachricht eingeben..."
                    className="w-full bg-gray-50 border-0 rounded-2xl px-4 py-3.5 pr-14 focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none overflow-hidden transition-all duration-200 text-base sm:text-sm"
                    disabled={sending}
                    rows="1"
                    style={{ maxHeight: '140px', minHeight: '52px' }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="absolute right-2 bottom-3 p-2.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full transition-all duration-200 transform hover:scale-110 disabled:scale-100 shadow-lg disabled:shadow-none"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            title="Willkommen im Messenger"
            description="Wählen Sie eine Unterhaltung aus der Liste oder starten Sie eine neue"
            action={
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Unterhaltungen anzeigen
              </button>
            }
          />
        )}
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl transform transition-all animate-scaleIn">
            <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Neue Unterhaltung</h3>
                <button
                  onClick={() => {
                    setShowUserList(false);
                    setContactSearchTerm('');
                  }}
                  className="text-white hover:bg-white/20 p-2 rounded-full transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={contactSearchTerm}
                  onChange={(e) => setContactSearchTerm(e.target.value)}
                  placeholder="Benutzer suchen..."
                  className="w-full border-0 rounded-xl px-4 py-2.5 pl-11 focus:ring-2 focus:ring-blue-300 text-sm"
                  autoFocus
                />
                <svg className="w-5 h-5 absolute left-3.5 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 160px)' }}>
              {filteredUsers.length === 0 ? (
                <div className="text-center p-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-base font-medium">Keine Benutzer gefunden</p>
                  <p className="text-sm text-gray-400 mt-1">Versuchen Sie einen anderen Suchbegriff</p>
                </div>
              ) : (
                groupedUsers.map(([role, roleUsers]) => (
                  <div key={role}>
                    <div className="bg-gray-50 px-4 py-2.5 sticky top-0 z-10 border-b border-gray-200">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                        {getRoleLabel(role)} ({roleUsers.length})
                      </h4>
                    </div>
                    {roleUsers.map(u => (
                      <div
                        key={u.id}
                        onClick={() => startConversation(u.id)}
                        className="px-4 py-3.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex items-center gap-3 transition-all duration-200 group"
                      >
                        <UserAvatar user={u} size="w-11 h-11" showOnline />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors text-sm">
                            {u.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                        {onlineUsers.has(u.id) && (
                          <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-700 font-medium">Online</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* GIF Picker Modal */}
      {showGifPicker && (
        <GifPicker
          onSelectGif={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      </div>
    </>
  );
};

export default ModernMessenger;
