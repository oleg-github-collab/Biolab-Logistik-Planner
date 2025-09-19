import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const TelegramChat = ({
  users = [],
  messages = [],
  currentUserId,
  onSendMessage,
  onSelectUser,
  selectedUser,
  onLoadMore,
  hasMore = false,
  isLoadingMessages = false,
  isLoadingMore = false,
  onRetry,
  error,
  isSending = false
}) => {
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const lastMessageSnapshotRef = useRef({ id: null, createdAt: 0 });

  const scrollToBottom = useCallback(() => {
    const node = messagesEndRef.current;

    if (!node) {
      return;
    }

    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    setShowEmojiPicker(false);
  }, [selectedUser]);

  useEffect(() => {
    lastMessageSnapshotRef.current = { id: null, createdAt: 0 };
  }, [selectedUser?.id]);

  useEffect(() => {
    if (!Array.isArray(messages)) {
      lastMessageSnapshotRef.current = { id: null, createdAt: 0 };
      return;
    }

    if (messages.length === 0) {
      lastMessageSnapshotRef.current = { id: null, createdAt: 0 };
      if (!isLoadingMore) {
        scrollToBottom();
      }
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const parsedDate =
      safeParseDate(lastMessage?.created_at) ??
      safeParseDate(lastMessage?.createdAt);
    const fallbackDate = parsedDate ?? new Date();
    const timestamp = Number.isNaN(fallbackDate.getTime())
      ? Date.now()
      : fallbackDate.getTime();

    const previousSnapshot = lastMessageSnapshotRef.current;
    const shouldScroll =
      !isLoadingMore &&
      (!previousSnapshot ||
        previousSnapshot.id === null ||
        lastMessage?.id !== previousSnapshot.id ||
        timestamp > previousSnapshot.createdAt);

    lastMessageSnapshotRef.current = {
      id: lastMessage?.id ?? null,
      createdAt: timestamp
    };

    if (shouldScroll) {
      scrollToBottom();
    }
  }, [messages, isLoadingMore, scrollToBottom]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!selectedUser || isSending) {
      return;
    }

    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      return;
    }

    try {
      if (typeof onSendMessage === 'function') {
        await onSendMessage(selectedUser.id, trimmedMessage);
      }
      setMessageText('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const addEmoji = (emoji) => {
    setMessageText((prev = '') => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const isCurrentUser = (message) => message.sender_id === currentUserId;

  const groupedMessages = useMemo(() => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    const map = new Map();

    messages.forEach((message) => {
      if (!message || (message.id === undefined && message.id !== 0)) {
        return;
      }

      const parsedDate =
        safeParseDate(message?.created_at) ??
        safeParseDate(message?.createdAt);

      let resolvedDate = parsedDate;

      if (!resolvedDate) {
        if (message?.created_at || message?.createdAt) {
          const fallback = new Date(message.created_at ?? message.createdAt);
          resolvedDate = Number.isNaN(fallback.getTime()) ? null : fallback;
        }
      }

      if (!resolvedDate || Number.isNaN(resolvedDate.getTime())) {
        resolvedDate = new Date();
      }

      const dateKey = format(resolvedDate, 'yyyy-MM-dd');

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }

      map.get(dateKey).push({
        ...message,
        createdAt: resolvedDate
      });
    });

    return Array.from(map.entries())
      .map(([date, items]) => {
        const sortedItems = items.sort((a, b) => {
          const aTime = a.createdAt?.getTime?.() ?? 0;
          const bTime = b.createdAt?.getTime?.() ?? 0;
          return aTime - bTime;
        });

        const anchorTime = sortedItems[0]?.createdAt?.getTime?.() ?? 0;

        return {
          date,
          anchorTime,
          items: sortedItems
        };
      })
      .sort((a, b) => a.anchorTime - b.anchorTime)
      .map(({ date, items }) => ({ date, items }));
  }, [messages]);

  const sortedUsers = useMemo(() => users, [users]);

  const emojis = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊',
    '🙂', '🙃', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚',
    '👍', '👎', '👏', '🙌', '🙏', '✌️', '🤞', '🤟', '🤘', '👌',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'
  ];

  const formatListTimestamp = (timestamp) => {
    const date = safeParseDate(timestamp);

    if (!date) {
      return '';
    }

    const today = new Date();
    const isSameDay = format(today, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');

    if (isSameDay) {
      return format(date, 'HH:mm', { locale: de });
    }

    return format(date, 'dd.MM.', { locale: de });
  };

  const renderStatusIcon = (message) => {
    if (!isCurrentUser(message)) {
      return null;
    }

    const delivered = Boolean(message.delivered_status);
    const read = Boolean(message.read_status);

    return (
      <span
        className={`inline-flex items-center ml-2 ${read ? 'text-blue-200' : delivered ? 'text-blue-100' : 'text-blue-300'}`}
        title={read ? 'Gelesen' : delivered ? 'Zugestellt' : 'Gesendet'}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="5 12 9 16 19 6" />
          {delivered && <polyline points="7 12 11 16 21 6" />}
        </svg>
      </span>
    );
  };

  return (
    <div className="h-full flex bg-[#f5f5f5] rounded-lg overflow-hidden">
      <div className="hidden lg:block w-80 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Nachrichten</h2>
        </div>

        <div className="p-2">
          {sortedUsers.map(user => (
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
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  <span className="text-[11px] text-gray-400 ml-2 whitespace-nowrap">
                    {formatListTimestamp(user.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500 truncate mr-2">
                    {user.last_message ? user.last_message : user.email}
                  </p>
                  {user.unread_count > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center w-6 h-6 text-xs font-semibold bg-blue-500 text-white rounded-full">
                      {user.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
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
              {selectedUser.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 truncate">{selectedUser.name}</h3>
              <p className="text-sm text-gray-500 truncate">{selectedUser.email}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-center">
            <p className="text-gray-500">Wähle einen Benutzer zum Chatten aus</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6 relative">
          {isLoadingMessages && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-sm text-gray-600">Unterhaltung wird geladen...</p>
            </div>
          )}

          {error && selectedUser && (
            <div className="flex justify-center">
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg flex items-center space-x-3 shadow-sm">
                <span>{error}</span>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 underline"
                  >
                    Erneut versuchen
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedUser ? (
            <>
              {hasMore && !isLoadingMessages && (
                <div className="flex justify-center">
                  <button
                    onClick={onLoadMore}
                    disabled={isLoadingMore}
                    className="px-4 py-2 text-sm rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoadingMore ? 'Lädt ältere Nachrichten...' : 'Ältere Nachrichten anzeigen'}
                  </button>
                </div>
              )}

              {groupedMessages.length === 0 && !isLoadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <h3 className="text-lg font-medium">Keine Nachrichten vorhanden</h3>
                    <p className="mt-2 text-sm">Sende die erste Nachricht, um die Unterhaltung zu starten.</p>
                  </div>
                </div>
              ) : (
                groupedMessages.map(({ date, items }) => (
                  <div key={date}>
                    <div className="flex justify-center my-4">
                      <span className="bg-gray-200 text-gray-600 text-xs px-4 py-1 rounded-full">
                        {formatDateHeader(date)}
                      </span>
                    </div>

                    {items.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${isCurrentUser(message) ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                            isCurrentUser(message)
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-gray-800 shadow-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-line break-words">{message.message}</p>
                          <p
                            className={`text-[11px] mt-1 flex items-center ${
                              isCurrentUser(message)
                                ? 'text-blue-100 justify-end'
                                : 'text-gray-500 justify-start'
                            }`}
                          >
                            <span>
                              {message.createdAt
                                ? formatDistanceToNow(message.createdAt, {
                                    addSuffix: true,
                                    locale: de
                                  })
                                : 'Gerade eben'}
                            </span>
                            {renderStatusIcon(message)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </>
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

        {selectedUser && (
          <div className="bg-white border-t border-gray-200 p-4 relative">
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
                aria-label="Emoji hinzufügen"
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
                disabled={!messageText.trim() || isSending}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-full transition-colors flex items-center justify-center min-w-[48px]"
                aria-label="Nachricht senden"
              >
                {isSending ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {!selectedUser && (
        <div className="lg:hidden fixed inset-0 bg-white z-20 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">Nachrichten</h2>
          </div>

          <div className="p-2">
            {sortedUsers.map(user => (
              <div
                key={user.id}
                onClick={() => onSelectUser(user)}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <span className="text-[11px] text-gray-400 ml-2 whitespace-nowrap">
                      {formatListTimestamp(user.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500 truncate mr-2">
                      {user.last_message ? user.last_message : user.email}
                    </p>
                    {user.unread_count > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-6 h-6 text-xs font-semibold bg-blue-500 text-white rounded-full">
                        {user.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const hasTimezone = (value = '') => /Z|[+-]\d{2}:?\d{2}$/.test(value);

const safeParseDate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number') {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      const fromNumeric = new Date(numeric);
      if (!Number.isNaN(fromNumeric.getTime())) {
        return fromNumeric;
      }
    }

    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const withZone = hasTimezone(normalized) ? normalized : `${normalized}Z`;
    const fallback = new Date(withZone);

    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }

    const directFromString = new Date(trimmed);
    if (!Number.isNaN(directFromString.getTime())) {
      return directFromString;
    }
  }

  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? null : direct;
};

const formatDateHeader = (date) => {
  const today = new Date();
  const messageDate = safeParseDate(date);

  if (!messageDate) {
    return '';
  }

  if (format(today, 'yyyy-MM-dd') === format(messageDate, 'yyyy-MM-dd')) {
    return 'Heute';
  }

  if (format(addDays(today, -1), 'yyyy-MM-dd') === format(messageDate, 'yyyy-MM-dd')) {
    return 'Gestern';
  }

  return format(messageDate, 'dd. MMMM yyyy', { locale: de });
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export default TelegramChat;
