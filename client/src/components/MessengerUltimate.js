import React, { useState, useEffect, useRef } from 'react';
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
  ArrowLeft
} from 'lucide-react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import {
  getUsersForMessaging,
  getMessagesForUser,
  sendMessage,
  getThreads
} from '../utils/api';
import '../styles/mobile-messenger.css';

const MessengerUltimate = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'chat'
  const [contacts, setContacts] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
    loadChats();
  }, []);

  const loadChats = async () => {
    setLoading(true);
    try {
      // Load contacts
      const contactsRes = await getUsersForMessaging();
      const contactsList = Array.isArray(contactsRes?.data) ? contactsRes.data : [];
      setContacts(contactsList);

      // Load group chats (threads)
      try {
        const threadsRes = await getThreads();
        const threadsList = Array.isArray(threadsRes?.data) ? threadsRes.data : [];
        setGroupChats(threadsList);
      } catch (error) {
        // If threads endpoint doesn't exist, create a default group chat
        setGroupChats([{
          id: 'group-main',
          name: 'Team Chat',
          type: 'group',
          participants_count: contactsList.length + 1,
          last_message: 'Willkommen im Team Chat!',
          last_message_at: new Date().toISOString(),
          unread_count: 0
        }]);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId, chatType) => {
    try {
      if (chatType === 'direct') {
        const response = await getMessagesForUser(chatId);
        setMessages(Array.isArray(response?.data) ? response.data : []);
      } else {
        // For group chats, we'll use mock data for now
        setMessages([
          {
            id: 1,
            sender_id: user?.id,
            sender_name: user?.name,
            content: 'Hallo Team!',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            is_mine: true
          },
          {
            id: 2,
            sender_id: 2,
            sender_name: 'Anna Schmidt',
            content: 'Guten Morgen! Wie geht es euch?',
            created_at: new Date(Date.now() - 1800000).toISOString(),
            is_mine: false
          }
        ]);
      }
      scrollToBottom();
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const handleChatSelect = async (chat, type) => {
    setSelectedChat({ ...chat, type });
    await loadMessages(chat.id, type);

    // On mobile, switch to chat view
    if (isMobile) {
      setView('chat');
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    setSending(true);
    try {
      if (selectedChat.type === 'direct') {
        await sendMessage(selectedChat.id, messageText, false);
      }

      // Add message to local state
      const newMessage = {
        id: Date.now(),
        sender_id: user?.id,
        sender_name: user?.name,
        content: messageText,
        created_at: new Date().toISOString(),
        is_mine: true
      };
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  // Filter chats based on search
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredGroups = groupChats.filter(group =>
    group.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Combined chat list for mobile
  const allChats = [
    ...filteredGroups.map(g => ({ ...g, type: 'group', displayType: 'Gruppe' })),
    ...filteredContacts.map(c => ({ ...c, type: 'direct', displayType: c.is_online ? 'Online' : 'Offline' }))
  ];

  // Render chat list
  const renderChatList = () => (
    <div className="chats-list-container">
      {/* Header */}
      <div className="chats-header">
        <h1 className="chats-title">Nachrichten</h1>

        {/* Search */}
        <div className="chats-search">
          <Search className="chats-search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Suche nach Kontakten oder Gruppen..."
            className="chats-search-input"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="chats-list">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Lade Chats...</div>
        ) : allChats.length === 0 ? (
          <div className="chats-empty">
            <Users className="chats-empty-icon" />
            <p className="text-gray-500">Keine Chats verfügbar</p>
          </div>
        ) : (
          allChats.map((chat) => (
            <button
              key={`${chat.type}-${chat.id}`}
              onClick={() => handleChatSelect(chat, chat.type)}
              className="chat-item"
            >
              {/* Avatar */}
              <div className={`chat-item-avatar ${chat.type === 'group' ? 'group-avatar' : ''}`}>
                {chat.type === 'group' ? <Users className="w-6 h-6" /> : chat.name?.[0]?.toUpperCase()}
                {chat.type === 'direct' && chat.is_online && (
                  <div className="online-indicator" />
                )}
              </div>

              {/* Chat Info */}
              <div className="chat-item-content">
                <div className="chat-item-header">
                  <p className="chat-item-name">{chat.name}</p>
                  {chat.last_message_at && (
                    <span className="chat-item-time">
                      {formatMessageTime(chat.last_message_at)}
                    </span>
                  )}
                </div>
                <p className="chat-item-message">
                  {chat.last_message || chat.displayType}
                </p>
              </div>

              {/* Unread Badge */}
              {chat.unread_count > 0 && (
                <div className="chat-item-unread">
                  {chat.unread_count}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Render chat view
  const renderChat = () => (
    <div className="messenger-container">
      {/* Chat Header */}
      <div className="chat-header">
        {isMobile && (
          <button
            onClick={() => setView('list')}
            className="chat-back-btn"
          >
            <ArrowLeft />
          </button>
        )}

        <div className="chat-user-info">
          <div className="chat-user-avatar">
            {selectedChat?.type === 'group' ? <Users className="w-5 h-5" /> : selectedChat?.name?.[0]?.toUpperCase()}
          </div>
          <div className="chat-user-details">
            <p className="chat-user-name">{selectedChat?.name}</p>
            <p className="chat-user-status">
              {selectedChat?.type === 'group'
                ? `${selectedChat.participants_count || 0} Teilnehmer`
                : selectedChat?.is_online ? 'Online' : 'Offline'
              }
            </p>
          </div>
        </div>

        <div className="chat-actions">
          <button className="chat-action-btn">
            <Phone className="w-5 h-5" />
          </button>
          <button className="chat-action-btn">
            <Video className="w-5 h-5" />
          </button>
          <button className="chat-action-btn">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message) => {
          const isOwn = message.is_mine || message.sender_id === user?.id;
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`message-bubble ${isOwn ? 'sent' : 'received'}`}>
                {selectedChat?.type === 'group' && !isOwn && (
                  <p className="text-xs font-semibold mb-1 opacity-80">{message.sender_name}</p>
                )}
                <p>{message.content}</p>
                <div className="message-time">
                  {formatMessageTime(message.created_at)}
                  {isOwn && (
                    <span className="ml-1">
                      {message.delivered ? <CheckCheck className="inline w-3 h-3" /> : <Check className="inline w-3 h-3" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="message-input-container">
        <button type="button" className="message-attach-btn">
          <Plus className="w-5 h-5" />
        </button>

        <div className="message-input-wrapper">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Nachricht eingeben..."
            className="message-input"
            disabled={sending}
          />
          <button type="button" className="message-attach-btn">
            <Smile className="w-5 h-5" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!messageText.trim() || sending}
          className="message-send-btn"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );

  // Main render - responsive layout
  if (isMobile) {
    // Mobile: Show one view at a time
    return (
      <div className="h-screen flex flex-col bg-white">
        {view === 'list' ? renderChatList() : renderChat()}
      </div>
    );
  } else {
    // Desktop: Show both panels
    return (
      <div className="h-screen flex bg-white">
        {/* Left Panel - Chat List */}
        <div className="w-80 border-r flex-shrink-0">
          {renderChatList()}
        </div>

        {/* Right Panel - Chat or Empty State */}
        <div className="flex-1">
          {selectedChat ? (
            renderChat()
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-xl text-gray-600">Wähle einen Chat aus</p>
                <p className="text-sm text-gray-400 mt-2">
                  Wähle einen Kontakt oder eine Gruppe aus der Liste
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default MessengerUltimate;