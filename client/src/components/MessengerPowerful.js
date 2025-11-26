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
  Bot,
  User,
  MessageSquare
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

const MessengerPowerful = () => {
  const { user } = useAuth();
  const [view, setView] = useState('list'); // 'list' | 'chat'
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // General group chat configuration
  const GENERAL_CHAT = {
    id: 'general-chat',
    name: 'General',
    type: 'group',
    icon: 'general',
    participants_count: 'Alle Mitarbeiter',
    last_message: 'Willkommen im General Chat',
    last_message_at: new Date().toISOString(),
    unread_count: 0,
    isSystemChat: true
  };

  // BL_Bot configuration
  const BL_BOT = {
    id: 999999, // Special ID for bot
    name: 'BL_Bot',
    email: 'bot@biolab.de',
    type: 'bot',
    is_online: true,
    status: 'Immer bereit zu helfen',
    isBot: true
  };

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
      // Load contacts from database
      const contactsRes = await getUsersForMessaging();
      let contactsList = Array.isArray(contactsRes?.data) ? contactsRes.data : [];

      // Filter out any system users but keep real users
      contactsList = contactsList.filter(c =>
        c && c.id && c.name && !c.name.includes('Bot') && !c.name.includes('System')
      );

      // Add BL_Bot to contacts list
      const allContacts = [BL_BOT, ...contactsList];

      console.log('Loaded contacts:', allContacts);
      setContacts(allContacts);

    } catch (error) {
      console.error('Error loading chats:', error);
      // Fallback contacts for testing
      setContacts([
        BL_BOT,
        { id: 1, name: 'Test User', email: 'test@biolab.de', is_online: false }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId, chatType) => {
    try {
      if (chatType === 'group') {
        // Mock messages for General chat
        setMessages([
          {
            id: 1,
            sender_id: 999999,
            sender_name: 'BL_Bot',
            content: 'Willkommen im General Chat! Hier können alle Mitarbeiter kommunizieren.',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            is_mine: false,
            isBot: true
          },
          {
            id: 2,
            sender_id: user?.id,
            sender_name: user?.name,
            content: 'Hallo zusammen!',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            is_mine: true
          },
          {
            id: 3,
            sender_id: 2,
            sender_name: 'Anna Schmidt',
            content: 'Guten Morgen! Hat jemand die neuen Laborproben erhalten?',
            created_at: new Date(Date.now() - 1800000).toISOString(),
            is_mine: false
          }
        ]);
      } else if (chatType === 'bot') {
        // Mock messages for BL_Bot
        setMessages([
          {
            id: 1,
            sender_id: 999999,
            sender_name: 'BL_Bot',
            content: 'Hallo! Ich bin BL_Bot, Ihr persönlicher Assistent. Wie kann ich Ihnen heute helfen?',
            created_at: new Date(Date.now() - 300000).toISOString(),
            is_mine: false,
            isBot: true
          }
        ]);
      } else {
        // Load messages for direct chat
        const response = await getMessagesForUser(chatId);
        setMessages(Array.isArray(response?.data) ? response.data : []);
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

    // Focus input after chat selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageText.trim() || !selectedChat) return;

    setSending(true);

    // Simulate typing indicator for bot
    if (selectedChat.isBot) {
      setTimeout(() => setIsTyping(true), 500);
    }

    try {
      if (selectedChat.type === 'direct' && !selectedChat.isBot) {
        await sendMessage(selectedChat.id, messageText, false);
      }

      // Add message to local state
      const newMessage = {
        id: Date.now(),
        sender_id: user?.id,
        sender_name: user?.name,
        content: messageText,
        created_at: new Date().toISOString(),
        is_mine: true,
        delivered: true
      };
      setMessages(prev => [...prev, newMessage]);
      setMessageText('');
      scrollToBottom();

      // Simulate bot response
      if (selectedChat.isBot) {
        setTimeout(() => {
          setIsTyping(false);
          const botResponse = {
            id: Date.now() + 1,
            sender_id: 999999,
            sender_name: 'BL_Bot',
            content: getBotResponse(messageText),
            created_at: new Date().toISOString(),
            is_mine: false,
            isBot: true
          };
          setMessages(prev => [...prev, botResponse]);
          scrollToBottom();
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const getBotResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('hilfe') || lowerMessage.includes('help')) {
      return 'Ich kann Ihnen bei folgenden Aufgaben helfen:\n• Abfallentsorgung planen\n• Kisten verwalten\n• Termine koordinieren\n• Fragen zum System beantworten';
    }
    if (lowerMessage.includes('abfall') || lowerMessage.includes('entsorgung')) {
      return 'Für die Abfallentsorgung:\n1. Gehen Sie zum Abfall-Modul\n2. Wählen Sie die Kategorie\n3. Tragen Sie die Menge ein\n4. Ich erstelle automatisch die Entsorgungsaufgabe';
    }
    if (lowerMessage.includes('kiste')) {
      return 'Das Kisten-Management finden Sie im Dashboard. Dort können Sie:\n• Neue Kisten hinzufügen\n• Status aktualisieren\n• QR-Codes generieren';
    }
    return 'Interessante Frage! Ich werde das Team informieren und Ihnen so schnell wie möglich antworten.';
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

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Combined chat list for display
  const allChats = [
    { ...GENERAL_CHAT, displayType: 'Gruppenchat' },
    ...filteredContacts.map(c => ({
      ...c,
      displayType: c.isBot ? 'Bot Assistant' : (c.is_online ? 'Online' : 'Offline')
    }))
  ];

  // Render chat list
  const renderChatList = () => (
    <div className="h-full flex flex-col bg-white messenger-chat-list-container">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-4 shadow-lg">
        <h1 className="text-xl font-bold mb-3">Nachrichten</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-300 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Suchen..."
            className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur-sm text-white placeholder-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/50 transition"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : allChats.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Keine Chats verfügbar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {allChats.map((chat) => (
              <button
                key={`${chat.type || 'direct'}-${chat.id}`}
                onClick={() => handleChatSelect(chat, chat.type || (chat.isBot ? 'bot' : 'direct'))}
                className={`w-full p-4 flex items-center gap-3 hover:bg-white transition-all duration-200 ${
                  selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                    chat.type === 'group' ? 'bg-gradient-to-br from-green-500 to-teal-500' :
                    chat.isBot ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                    'bg-gradient-to-br from-blue-500 to-indigo-500'
                  }`}>
                    {chat.type === 'group' ? <Users className="w-6 h-6" /> :
                     chat.isBot ? <Bot className="w-6 h-6" /> :
                     <User className="w-6 h-6" />}
                  </div>
                  {!chat.type && !chat.isBot && chat.is_online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                  )}
                </div>

                {/* Chat Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 truncate">
                      {chat.name}
                      {chat.isBot && <span className="ml-1 text-xs text-purple-600">AI</span>}
                    </p>
                    {chat.last_message_at && (
                      <span className="text-xs text-gray-500 ml-2">
                        {formatMessageTime(chat.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {chat.status || chat.last_message || chat.displayType}
                  </p>
                </div>

                {/* Unread Badge */}
                {chat.unread_count > 0 && (
                  <div className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-sm">
                    {chat.unread_count}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render chat view
  const renderChat = () => (
    <div className="h-full flex flex-col bg-white messenger-chat-container">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg">
        {isMobile && (
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
            selectedChat?.type === 'group' ? 'bg-gradient-to-br from-green-500 to-teal-500' :
            selectedChat?.isBot ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
            'bg-gradient-to-br from-blue-500 to-indigo-500'
          }`}>
            {selectedChat?.type === 'group' ? <Users className="w-5 h-5" /> :
             selectedChat?.isBot ? <Bot className="w-5 h-5" /> :
             <User className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {selectedChat?.name}
              {selectedChat?.isBot && <span className="ml-1 text-xs opacity-90">AI Assistant</span>}
            </p>
            <p className="text-xs opacity-90">
              {selectedChat?.type === 'group'
                ? selectedChat.participants_count
                : selectedChat?.isBot
                  ? 'Immer verfügbar'
                  : selectedChat?.is_online ? 'Online' : 'Offline'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-white/20 rounded-full transition">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/20 rounded-full transition">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/20 rounded-full transition">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto bg-gray-50 messenger-messages-area">
        <div className="p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_mine || message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] ${
                message.is_mine || message.sender_id === user?.id
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-sm'
                  : message.isBot
                    ? 'bg-gradient-to-r from-purple-100 to-pink-100 text-gray-900 rounded-2xl rounded-bl-sm border border-purple-200'
                    : 'bg-white text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-200'
              } px-4 py-2.5 message-bubble-enhanced`}>
                {selectedChat?.type === 'group' && !(message.is_mine || message.sender_id === user?.id) && (
                  <p className="text-xs font-semibold mb-1 opacity-75">
                    {message.sender_name}
                    {message.isBot && ' 🤖'}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <div className={`flex items-center gap-1 mt-1 ${
                  message.is_mine || message.sender_id === user?.id ? 'justify-end' : 'justify-start'
                }`}>
                  <span className="text-xs opacity-60">
                    {formatMessageTime(message.created_at)}
                  </span>
                  {(message.is_mine || message.sender_id === user?.id) && (
                    message.delivered ? <CheckCheck className="w-3 h-3 opacity-70" /> : <Check className="w-3 h-3 opacity-70" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-200 px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold opacity-75 mb-1">BL_Bot</span>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input - Fixed positioning */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 messenger-input-container">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition">
            <Plus className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={selectedChat?.isBot ? "Frage an BL_Bot..." : "Nachricht eingeben..."}
              className="w-full px-4 py-2.5 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              disabled={sending}
            />
            <button type="button" className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full transition">
              <Smile className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition">
            <Paperclip className="w-5 h-5 text-gray-600" />
          </button>

          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="p-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );

  // Main render - responsive layout
  if (isMobile) {
    // Mobile: Show one view at a time
    return (
      <div className="messenger-mobile-container">
        {view === 'list' ? renderChatList() : renderChat()}
      </div>
    );
  } else {
    // Desktop: Show both panels
    return (
      <div className="messenger-desktop-container">
        {/* Left Panel - Chat List */}
        <div className="messenger-sidebar">
          {renderChatList()}
        </div>

        {/* Right Panel - Chat or Empty State */}
        <div className="messenger-main">
          {selectedChat ? (
            renderChat()
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <div className="text-center">
                <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <MessageSquare className="w-16 h-16 text-blue-600" />
                </div>
                <p className="text-2xl font-semibold text-gray-700">Wähle einen Chat</p>
                <p className="text-gray-500 mt-2">
                  Wähle einen Kontakt oder Gruppenchat aus der Liste
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};

export default MessengerPowerful;