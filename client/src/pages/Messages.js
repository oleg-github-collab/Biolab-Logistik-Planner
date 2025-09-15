import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import TelegramChat from '../components/TelegramChat';
import { 
  getMessages, 
  sendMessage, 
  getUsersForMessaging,
  getUnreadCount
} from '../utils/api';

const Messages = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    loadData();
    // Set up polling for new messages every 30 seconds
    const interval = setInterval(() => {
      getMessagesData();
      getUnreadCountData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [messagesRes, usersRes, unreadRes] = await Promise.all([
        getMessages(),
        getUsersForMessaging(),
        getUnreadCount()
      ]);
      
      setMessages(messagesRes.data);
      setUsers(usersRes.data);
      setUnreadCount(unreadRes.data.unreadCount);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Fehler beim Laden der Nachrichten. Bitte versuche es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const getMessagesData = async () => {
    try {
      const messagesRes = await getMessages();
      setMessages(messagesRes.data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const getUnreadCountData = async () => {
    try {
      const unreadRes = await getUnreadCount();
      setUnreadCount(unreadRes.data.unreadCount);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const handleSendMessage = async (receiverId, message) => {
    try {
      const messageData = await sendMessage(receiverId, message);
      // Add new message to state
      setMessages(prev => [...prev, messageData]);
      // Update unread count
      getUnreadCountData();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Fehler beim Senden der Nachricht. Bitte versuche es erneut.');
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    // Mark messages as read when selecting user
    if (user) {
      setMessages(prev => 
        prev.map(msg => 
          msg.receiver_id === user.id && msg.read_status === 0
            ? { ...msg, read_status: 1 }
            : msg
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="mt-4 text-gray-600">Nachrichten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Nachrichten
        </h1>
        <p className="text-gray-600">
          Kommuniziere mit deinen Kollegen in Echtzeit
        </p>
      </div>

      <TelegramChat
        users={users}
        messages={messages.filter(msg => 
          selectedUser 
            ? (msg.sender_id === selectedUser.id || msg.receiver_id === selectedUser.id)
            : true
        )}
        currentUserId={user.id}
        onSendMessage={handleSendMessage}
        onSelectUser={handleSelectUser}
        selectedUser={selectedUser}
      />
    </div>
  );
};

export default Messages;