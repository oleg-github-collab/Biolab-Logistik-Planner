import React, { useState, useEffect, useRef } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const TelegramChat = ({ 
  users = [], 
  messages = [], 
  currentUserId, 
  onSendMessage,
  onSelectUser,
  selectedUser
}) => {
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageText.trim() && selectedUser) {
      onSendMessage(selectedUser.id, messageText.trim());
      setMessageText('');
    }
  };

  const addEmoji = (emoji) => {
    setMessageText(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const isCurrentUser = (message) => {
    return message.sender_id === currentUserId;
  };

  const formatDateHeader = (date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (format(today, 'yyyy-MM-dd') === format(messageDate, 'yyyy-MM-dd')) {
      return 'Heute';
    }
    
    if (format(addDays(today, -1), 'yyyy-MM-dd') === format(messageDate, 'yyyy-MM-dd')) {
      return 'Gestern';
    }
    
    return format(messageDate, 'dd. MMMM yyyy', { locale: de });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  // Common emojis
  const emojis = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', 
    '🙂', '🙃', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚',
    '👍', '👎', '👏', '🙌', '🙏', '✌️', '🤞', '🤟', '🤘', '👌',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'
  ];

  return (
    <div className="h-full flex bg-[#f5f5f5] rounded-lg overflow-hidden">
      {/* User List - Desktop */}
      <div className="hidden lg:block w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Nachrichten</h2>
        </div>
        
        <div className="p-2">
          {users.map(user => (
            <div
              key={user.id}
              onClick={() => onSelectUser(user)}
              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedUser?.id === user.id 
                  ? 'bg-blue-100 border-r-4 border-blue-500' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        {selectedUser ? (
          <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-3">
            <div className="lg:hidden">
              <button 
                onClick={() => onSelectUser(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
              {selectedUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-gray-800">{selectedUser.name}</h3>
              <p className="text-sm text-gray-500">Online</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-center">
            <p className="text-gray-500">Wähle einen Benutzer zum Chatten aus</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {selectedUser ? (
            Object.keys(groupedMessages).map(date => (
              <div key={date}>
                <div className="flex justify-center my-4">
                  <span className="bg-gray-200 text-gray-600 text-xs px-4 py-1 rounded-full">
                    {formatDateHeader(date)}
                  </span>
                </div>
                
                {groupedMessages[date].map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${isCurrentUser(message) ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isCurrentUser(message)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-800 shadow-sm'
                      }`}
                    >
                      <p className="text-sm">{message.message}</p>
                      <p className={`text-xs mt-1 ${
                        isCurrentUser(message) ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {formatDistanceToNow(new Date(message.created_at), { 
                          addSuffix: true, 
                          locale: de 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <h3 className="text-lg font-medium">Willkommen bei Biolab Chat</h3>
                <p className="mt-2">Wähle einen Benutzer aus, um eine Unterhaltung zu beginnen</p>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        {selectedUser && (
          <div className="bg-white border-t border-gray-200 p-4">
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-h-64 overflow-y-auto z-10">
                <div className="grid grid-cols-5 gap-2">
                  {emojis.map((emoji, index) => (
                    <button
                      key={index}
                      onClick={() => addEmoji(emoji)}
                      className="text-2xl hover:bg-gray-100 p-2 rounded-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Schreibe eine Nachricht..."
                className="flex-1 p-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <button
                type="submit"
                disabled={!messageText.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* User List - Mobile */}
      {!selectedUser && (
        <div className="lg:hidden fixed inset-0 bg-white z-20 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Nachrichten</h2>
          </div>
          
          <div className="p-2">
            {users.map(user => (
              <div
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to add days
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export default TelegramChat;