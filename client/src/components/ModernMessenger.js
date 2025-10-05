import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday, isSameDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import GifPicker from './GifPicker';
import { showSuccess, showError, showInfo, showCustom } from '../utils/toast';
import { showTypedNotification, NotificationTypes, getNotificationPermission } from '../utils/notifications';
import io from 'socket.io-client';

const ModernMessenger = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const typingTimeoutRef = useRef(null);
  const audioRef = useRef(null);

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
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected for messenger');
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

    // Handle new message
    newSocket.on('new_message', (message) => {
      // Add message to list if conversation is selected
      if (selectedConversation && message.sender_id === selectedConversation.id) {
        setMessages(prev => [...prev, message]);

        // Mark as read immediately if conversation is open
        newSocket.emit('mark_as_read', { messageId: message.id });
      }

      // Update conversations list
      loadConversations();

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

    setSocket(newSocket);

    return () => {
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

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
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
      showError('Fehler beim Laden der Benutzer');
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

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          receiver_id: selectedConversation.id,
          message: content,
          messageType: messageType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const message = await response.json();
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      loadConversations();

      if (messageType === 'gif') {
        showSuccess('GIF gesendet!');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      showError('Fehler beim Senden der Nachricht');
    } finally {
      setSending(false);
    }
  };

  const handleGifSelect = (gif) => {
    sendMessage(null, 'gif', gif.url);
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

  const getConversationPreview = (conversation) => {
    if (conversation.last_message) {
      const maxLength = 50;
      return conversation.last_message.length > maxLength
        ? conversation.last_message.substring(0, maxLength) + '...'
        : conversation.last_message;
    }
    return 'Neue Unterhaltung';
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
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedUsers = groupUsersByRole(filteredUsers);

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

  const UserAvatar = ({ user: avatarUser, size = 'w-10 h-10', showOnline = false }) => {
    const initials = avatarUser.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];

    const colorIndex = avatarUser.id % colors.length;

    return (
      <div className={`${size} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold relative`}>
        {initials}
        {showOnline && onlineUsers.has(avatarUser.id) && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
        )}
      </div>
    );
  };

  const MessageBubble = ({ message, isOwn }) => {
    // Create sender object for non-own messages
    const sender = !isOwn && message.sender_name ? {
      id: message.sender_id,
      name: message.sender_name
    } : null;

    const isGif = message.message_type === 'gif' || message.type === 'gif';

    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3 animate-fadeIn`}>
        <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md xl:max-w-lg ${isOwn ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
          {!isOwn && sender && <UserAvatar user={sender} size="w-8 h-8" />}
          <div className="flex flex-col">
            <div className={`${isGif ? 'p-1' : 'px-4 py-2.5'} rounded-2xl shadow-sm transition-all hover:shadow-md ${
              isOwn
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md'
                : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
            }`}>
              {isGif ? (
                <div className="relative">
                  <img
                    src={message.message}
                    alt="GIF"
                    className="rounded-lg max-w-xs max-h-64 object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
              )}
              <div className={`flex items-center justify-between ${isGif ? 'px-2 pb-1' : ''} mt-1.5 gap-2`}>
                <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatMessageTime(message.created_at)}
                </p>
                {isOwn && (
                  <div className="flex items-center space-x-1">
                    {message.read_status ? (
                      <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                        <path d="M12.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L4 10.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TypingIndicator = () => (
    <div className="flex items-center space-x-2 mb-4 animate-fadeIn">
      <div className="w-8 h-8" />
      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );

  const DateDivider = ({ date }) => (
    <div className="flex items-center justify-center my-4">
      <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full shadow-sm">
        {formatDateDivider(date)}
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>

        {/* Header - Fixed */}
        <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Nachrichten</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowUserList(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Neue Unterhaltung"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Conversations List - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingSpinner variant="dots" size="md" text="Lade Unterhaltungen..." />
          ) : conversations.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>Keine Unterhaltungen</p>
              <p className="text-sm text-gray-400 mt-1">Starten Sie eine neue Unterhaltung</p>
            </div>
          ) : (
            conversations.map(conversation => {
              const conversationUser = {
                id: conversation.id,
                name: conversation.name || conversation.user_name,
                email: conversation.email || conversation.user_email
              };

              return (
                <div
                  key={conversation.id}
                  onClick={() => {
                    setSelectedConversation(conversationUser);
                    setSidebarOpen(false);
                  }}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                    selectedConversation?.id === conversation.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <UserAvatar user={conversationUser} showOnline />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {conversationUser.name}
                        </p>
                        {conversation.lastMessageTime && (
                          <p className="text-xs text-gray-500">
                            {formatMessageTime(conversation.lastMessageTime)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {conversation.lastMessage || 'Neue Unterhaltung'}
                      </p>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <div className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center animate-pulse">
                        {conversation.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center flex-shrink-0 shadow-sm">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden mr-3 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <UserAvatar user={selectedConversation} showOnline />
              <div className="ml-3 flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {selectedConversation.name}
                </h2>
                <p className="text-sm text-gray-500 flex items-center">
                  {onlineUsers.has(selectedConversation.id) ? (
                    <>
                      <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                      Online
                    </>
                  ) : (
                    <>
                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                      Offline
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">Noch keine Nachrichten</p>
                  <p className="text-sm text-gray-400 mt-1">Senden Sie die erste Nachricht</p>
                </div>
              ) : (
                <>
                  {groupMessagesByDate(messages).map((item, index) =>
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

            {/* Message Input - Fixed */}
            <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
              <form onSubmit={sendMessage} className="flex items-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowGifPicker(true)}
                  className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors mb-1"
                  title="GIF hinzufügen"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <textarea
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
                    placeholder="Nachricht eingeben... (Enter zum Senden)"
                    className="w-full border border-gray-300 rounded-2xl px-4 py-2.5 pr-12 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden"
                    disabled={sending}
                    rows="1"
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="absolute right-2 bottom-2 p-2 text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed rounded-full hover:bg-blue-50 transition-all"
                  >
                    {sending ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
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
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="text-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden mb-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg transition-all hover:shadow-xl"
              >
                Unterhaltungen anzeigen
              </button>
              <svg className="w-20 h-20 mx-auto mb-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Willkommen im Messenger</h3>
              <p className="text-gray-500">Wählen Sie eine Unterhaltung aus oder starten Sie eine neue</p>
            </div>
          </div>
        )}
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl transform transition-all">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">Neue Unterhaltung</h3>
                <button
                  onClick={() => {
                    setShowUserList(false);
                    setSearchTerm('');
                  }}
                  className="text-white hover:bg-blue-400 p-1.5 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Benutzer suchen..."
                  className="w-full border-0 rounded-lg px-4 py-2 pl-10 focus:ring-2 focus:ring-blue-300"
                />
                <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {filteredUsers.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>Keine Benutzer gefunden</p>
                </div>
              ) : (
                groupedUsers.map(([role, roleUsers]) => (
                  <div key={role}>
                    <div className="bg-gray-100 px-4 py-2 sticky top-0 z-10">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {getRoleLabel(role)} ({roleUsers.length})
                      </h4>
                    </div>
                    {roleUsers.map(u => (
                      <div
                        key={u.id}
                        onClick={() => startConversation(u.id)}
                        className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex items-center space-x-3 transition-colors group"
                      >
                        <UserAvatar user={u} showOnline />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{u.name}</p>
                          <p className="text-sm text-gray-500 truncate">{u.email}</p>
                        </div>
                        {onlineUsers.has(u.id) ? (
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 font-medium">Online</span>
                          </div>
                        ) : null}
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
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
  );
};

export default ModernMessenger;