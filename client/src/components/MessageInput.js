import React, { useState } from 'react';

const MessageInput = ({ onSend, users, currentUserId }) => {
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [isGroup, setIsGroup] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && (isGroup || selectedUser)) {
      onSend(selectedUser, message, isGroup);
      setMessage('');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={isGroup}
              onChange={(e) => setIsGroup(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium">Gruppennachricht</span>
          </label>

          {!isGroup && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empfänger
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
              >
                <option value="">-- Empfänger auswählen --</option>
                {users
                  .filter(user => user.id !== currentUserId)
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isGroup
                ? "Gruppennachricht eingeben..."
                : "Nachricht eingeben..."
            }
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-biolab-blue focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!message.trim() || (!isGroup && !selectedUser)}
            className="bg-biolab-blue hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Senden
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessageInput;