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
  Info
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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Nachrichten</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Suche nach Kontakten oder Gruppen..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Lade Chats...</div>
        ) : allChats.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Keine Chats verfügbar</p>
          </div>
        ) : (
          allChats.map((chat) => (
            <button
              key={`${chat.type}-${chat.id}`}
              onClick={() => handleChatSelect(chat, chat.type)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition ${
                selectedChat?.id === chat.id && selectedChat?.type === chat.type ? 'bg-blue-50' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  chat.type === 'group' ? 'bg-gradient-to-br from-green-400 to-blue-400' : 'bg-gradient-to-br from-blue-400 to-purple-400'
                }`}>
                  {chat.type === 'group' ? <Users className="w-6 h-6" /> : chat.name?.[0]?.toUpperCase()}
                </div>
                {chat.type === 'direct' && chat.is_online && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>

              {/* Chat Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 truncate">{chat.name}</p>
                  {chat.last_message_at && (
                    <span className="text-xs text-gray-500">
                      {formatMessageTime(chat.last_message_at)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {chat.last_message || chat.displayType}
                </p>
              </div>

              {/* Unread Badge */}
              {chat.unread_count > 0 && (
                <div className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
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
    <div className="h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        {isMobile && (
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
            selectedChat?.type === 'group' ? 'bg-gradient-to-br from-green-400 to-blue-400' : 'bg-gradient-to-br from-blue-400 to-purple-400'
          }`}>
            {selectedChat?.type === 'group' ? <Users className="w-5 h-5" /> : selectedChat?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{selectedChat?.name}</p>
            <p className="text-xs text-gray-500">
              {selectedChat?.type === 'group'
                ? `${selectedChat.participants_count || 0} Teilnehmer`
                : selectedChat?.is_online ? 'Online' : 'Offline'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Video className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full transition">
            <Info className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.is_mine || message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] ${
              message.is_mine || message.sender_id === user?.id
                ? 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg'
                : 'bg-gray-100 text-gray-900 rounded-r-lg rounded-tl-lg'
            } px-4 py-2`}>
              {selectedChat?.type === 'group' && !(message.is_mine || message.sender_id === user?.id) && (
                <p className="text-xs font-semibold mb-1 opacity-80">{message.sender_name}</p>
              )}
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <div className={`flex items-center gap-1 mt-1 ${
                message.is_mine || message.sender_id === user?.id ? 'justify-end' : 'justify-start'
              }`}>
                <span className="text-xs opacity-70">
                  {formatMessageTime(message.created_at)}
                </span>
                {(message.is_mine || message.sender_id === user?.id) && (
                  message.delivered ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="bg-white border-t p-4">
        <div className="flex items-center gap-2">
          <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition">
            <Plus className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Nachricht eingeben..."
              className="w-full px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={sending}
            />
            <button type="button" className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1">
              <Smile className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition">
            <Paperclip className="w-5 h-5 text-gray-600" />
          </button>

          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
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