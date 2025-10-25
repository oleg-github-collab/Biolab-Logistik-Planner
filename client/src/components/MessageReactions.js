import React, { useState, useEffect } from 'react';
import { Smile, Plus } from 'lucide-react';
import { addMessageReaction, getMessageReactions } from '../utils/apiEnhanced';

const QUICK_EMOJIS = ['👍', '❤️', '😊', '🎉', '🔥', '👏', '✅'];

const MessageReactions = ({ messageId, currentUserId, compact = false, refreshKey = 0 }) => {
  const [reactions, setReactions] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messageId || String(messageId).startsWith('temp_')) return;
    loadReactions();
  }, [messageId, refreshKey]);

  const loadReactions = async () => {
    if (!messageId || String(messageId).startsWith('temp_')) return;
    try {
      const response = await getMessageReactions(messageId);
      setReactions(response.data);
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  };

  const handleReaction = async (emoji) => {
    try {
      setLoading(true);
      await addMessageReaction(messageId, emoji);
      await loadReactions();
      setShowPicker(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserNames = (users) => {
    if (!users || users.length === 0) return '';
    return users.map(u => u.user_name).join(', ');
  };

  const hasUserReacted = (reaction) => {
    return reaction.users?.some(u => u.user_id === currentUserId);
  };

  if (!messageId || String(messageId).startsWith('temp_')) {
    return null;
  }

  return (
    <div className="relative">
      {/* Reaction Display */}
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {reactions.map((reaction, idx) => (
          <button
            key={idx}
            onClick={() => handleReaction(reaction.emoji)}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs sm:text-sm transition-all hover:scale-110 ${
              hasUserReacted(reaction)
                ? 'bg-blue-100 border border-blue-300 text-blue-700'
                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200'
            }`}
            title={getUserNames(reaction.users)}
          >
            <span>{reaction.emoji}</span>
            <span className="font-medium text-xs">{reaction.count}</span>
          </button>
        ))}

        {/* Add Reaction Button */}
        {!compact && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="p-1 rounded-full hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
            title="Reakcja hinzufügen"
          >
            <Smile className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Emoji Picker */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 animate-fadeIn">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  disabled={loading}
                  className="p-2 text-xl sm:text-2xl hover:bg-gray-100 rounded transition disabled:opacity-50"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MessageReactions;
