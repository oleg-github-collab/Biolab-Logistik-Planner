import React, { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import useWebSocket from '../hooks/useWebSocket';

const AdvancedMessaging = () => {
  const { user } = useAuth();
  const {
    isConnected,
    sendMessage,
    showNotification,
    requestNotificationPermission
  } = useWebSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);

  // Request notification permission on component mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  // Load users and conversations on component mount
  useEffect(() => {
    loadUsers();
    loadConversations();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load users for conversation
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/messages/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Fehler beim Laden der Benutzer');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const response = await fetch('/api/messages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Group messages by conversation
        const conversationMap = new Map();

        data.forEach(message => {
          const otherUserId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
          const otherUserName = message.sender_id === user.id ? message.receiver_name : message.sender_name;

          if (!conversationMap.has(otherUserId)) {
            conversationMap.set(otherUserId, {
              userId: otherUserId,
              userName: otherUserName,
              lastMessage: message,
              unreadCount: 0,
              messages: []
            });
          }

          const conversation = conversationMap.get(otherUserId);
          conversation.messages.push(message);

          // Update last message if this one is newer
          if (new Date(message.created_at) > new Date(conversation.lastMessage.created_at)) {
            conversation.lastMessage = message;
          }

          // Count unread messages
          if (message.receiver_id === user.id && !message.read_status) {
            conversation.unreadCount++;
          }
        });

        const sortedConversations = Array.from(conversationMap.values())
          .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

        setConversations(sortedConversations);

        // Set unread counts
        const counts = {};
        sortedConversations.forEach(conv => {
          counts[conv.userId] = conv.unreadCount;
        });
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      setError('Fehler beim Laden der Unterhaltungen');
    }
  };

  // Start a conversation
  const startConversation = (selectedUser) => {
    const existingConv = conversations.find(conv => conv.userId === selectedUser.id);

    if (existingConv) {
      setActiveConversation(existingConv);
      setMessages(existingConv.messages);
    } else {
      const newConversation = {
        userId: selectedUser.id,
        userName: selectedUser.name,
        lastMessage: null,
        unreadCount: 0,
        messages: []
      };
      setActiveConversation(newConversation);
      setMessages([]);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !activeConversation) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Try WebSocket first
      const success = sendMessage(activeConversation.userId, messageText);

      if (!success) {
        // Fallback to HTTP
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            receiverId: activeConversation.userId,
            message: messageText,
            isGroup: false
          })
        });

        if (response.ok) {
          const messageData = await response.json();

          // Add message to current conversation
          setMessages(prev => [...prev, messageData]);

          // Update conversation
          const updatedConversation = {
            ...activeConversation,
            lastMessage: messageData,
            messages: [...(activeConversation.messages || []), messageData]
          };
          setActiveConversation(updatedConversation);

          // Update conversations list
          setConversations(prev => {
            const filtered = prev.filter(conv => conv.userId !== activeConversation.userId);
            return [updatedConversation, ...filtered];
          });
        } else {
          setError('Fehler beim Senden der Nachricht');
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Nachricht konnte nicht gesendet werden');
    }
  };

  // Handle typing
  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Start typing indicator
    // startTyping(activeConversation.userId);

    typingTimeoutRef.current = setTimeout(() => {
      // stopTyping(activeConversation.userId);
    }, 1000);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format message time
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);

    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Gestern ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
    }
  };

  // Get filtered users
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get filtered conversations
  const filteredConversations = conversations.filter(conv =>
    conv.userName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Emojis for quick reactions
  const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center space-x-3">
          <span>💬</span>
          <span>Nachrichten</span>
          {isConnected && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>
              Online
            </span>
          )}
        </h1>
        <p className="text-gray-600">
          Kommunizieren Sie in Echtzeit mit Ihrem Team
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 text-red-800 hover:text-red-900"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden h-[600px] flex">
        {/* Sidebar */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Benutzer oder Unterhaltungen suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                🔍
              </div>
            </div>
          </div>

          {/* Conversations/Users List */}
          <div className="flex-1 overflow-y-auto">
            {searchQuery ? (
              // Show users when searching
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                  Benutzer ({filteredUsers.length})
                </div>
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">{u.name}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                    {onlineUsers.includes(u.id) && (
                      <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              // Show conversations when not searching
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-1">
                  Unterhaltungen ({conversations.length})
                </div>
                {conversations.map(conv => (
                  <button
                    key={conv.userId}
                    onClick={() => {
                      setActiveConversation(conv);
                      setMessages(conv.messages);
                      // Reset unread count
                      setUnreadCounts(prev => ({
                        ...prev,
                        [conv.userId]: 0
                      }));
                    }}
                    className={`w-full flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors ${
                      activeConversation?.userId === conv.userId ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold relative">
                      {conv.userName.charAt(0).toUpperCase()}
                      {onlineUsers.includes(conv.userId) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">{conv.userName}</div>
                        {conv.lastMessage && (
                          <div className="text-xs text-gray-500">
                            {formatMessageTime(conv.lastMessage.created_at)}
                          </div>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <div className="text-sm text-gray-500 truncate">
                          {conv.lastMessage.sender_id === user.id ? 'Sie: ' : ''}
                          {conv.lastMessage.message}
                        </div>
                      )}
                    </div>
                    {unreadCounts[conv.userId] > 0 && (
                      <div className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                        {unreadCounts[conv.userId]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold relative">
                    {activeConversation.userName.charAt(0).toUpperCase()}
                    {onlineUsers.includes(activeConversation.userId) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{activeConversation.userName}</div>
                    <div className="text-sm text-gray-500">
                      {onlineUsers.includes(activeConversation.userId) ? 'Online' : 'Offline'}
                      {typingUsers.includes(activeConversation.userId) && ' • tippt...'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => {
                  const isOwn = message.sender_id === user.id;
                  const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end space-x-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isOwn && showAvatar && (
                        <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {message.sender_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {!isOwn && !showAvatar && <div className="w-8"></div>}

                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}>
                        <div className="text-sm">{message.message}</div>
                        <div className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                          {formatMessageTime(message.created_at)}
                          {isOwn && message.read_status && (
                            <span className="ml-1">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typingUsers.includes(activeConversation.userId) && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {activeConversation.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="bg-gray-200 rounded-2xl px-4 py-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={messageInputRef}
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Nachricht eingeben..."
                      className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-blue-500 focus:border-blue-500"
                      rows="1"
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-600"
                    >
                      😊
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex space-x-2">
                        {quickEmojis.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setNewMessage(newMessage + emoji);
                              setShowEmojiPicker(false);
                              messageInputRef.current?.focus();
                            }}
                            className="text-xl hover:bg-gray-100 rounded p-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            </>
          ) : (
            // No conversation selected
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Wählen Sie eine Unterhaltung
                </h2>
                <p className="text-gray-600">
                  Beginnen Sie eine Unterhaltung, indem Sie einen Benutzer aus der Liste auswählen
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedMessaging;