import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
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

  const handleSendMessage = async (receiverId, message, isGroup) => {
    try {
      const messageData = await sendMessage(receiverId, message, isGroup);
      // Add new message to state
      setMessages(prev => [...prev, messageData]);
      // Update unread count
      getUnreadCountData();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Fehler beim Senden der Nachricht. Bitte versuche es erneut.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-biolab-blue mx-auto"></div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-biolab-dark mb-2">
          Nachrichten
        </h2>
        <p className="text-gray-600">
          Kommuniziere mit deinen Kollegen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MessageList 
            messages={messages} 
            currentUserId={user.id} 
          />
        </div>
        
        <div>
          <MessageInput 
            onSend={handleSendMessage}
            users={users}
            currentUserId={user.id}
          />
          
          <div className="mt-6 bg-white rounded-lg shadow-md p-4">
            <h3 className="text-lg font-bold text-biolab-dark mb-3">
              Ungelesene Nachrichten
            </h3>
            <div className="text-3xl font-bold text-biolab-blue">
              {unreadCount}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {unreadCount === 1 ? 'ungelesene Nachricht' : 'ungelesene Nachrichten'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;