import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const MessageList = ({ messages, currentUserId }) => {
  const [displayedMessages, setDisplayedMessages] = useState([]);

  useEffect(() => {
    // Sort messages by date
    const sorted = [...messages].sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );
    setDisplayedMessages(sorted);
  }, [messages]);

  const isCurrentUser = (message) => {
    return message.sender_id === currentUserId;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 h-96 overflow-y-auto">
      {displayedMessages.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>Keine Nachrichten vorhanden</p>
          <p className="text-sm mt-2">Beginne eine Unterhaltung mit deinen Kollegen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${isCurrentUser(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isCurrentUser(message)
                    ? 'bg-biolab-blue text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium">
                    {isCurrentUser(message) ? 'Du' : message.sender_name}
                  </span>
                  <span className="text-xs opacity-75">
                    {formatDistanceToNow(new Date(message.created_at), { 
                      addSuffix: true, 
                      locale: de 
                    })}
                  </span>
                </div>
                <p className="text-sm">{message.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageList;