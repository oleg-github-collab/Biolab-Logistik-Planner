import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import TelegramChat from '../components/TelegramChat';
import {
  getMessages,
  sendMessage,
  getUsersForMessaging,
  getUnreadCount
} from '../utils/api';

const DEFAULT_PAGE_SIZE = 50;

const normalizeMessage = (message) => ({
  ...message,
  read_status: Boolean(message?.read_status),
  delivered_status: Boolean(message?.delivered_status)
});

const mergeMessages = (existing, incoming, direction = 'append') => {
  const combined = direction === 'prepend'
    ? [...incoming, ...existing]
    : [...existing, ...incoming];

  const map = new Map();
  combined.forEach((msg) => {
    if (!msg || typeof msg !== 'object' || !msg.id) {
      return;
    }
    const current = map.get(msg.id) || {};
    map.set(msg.id, {
      ...current,
      ...msg
    });
  });

  return Array.from(map.values()).sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
};

const normalizeUsers = (rawUsers = []) =>
  rawUsers.map((user) => ({
    ...user,
    unread_count: Number(user.unread_count) || 0
  }));

const Messages = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messageMeta, setMessageMeta] = useState({
    hasMore: false,
    nextCursor: null,
    latestCursor: null
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [conversationError, setConversationError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const latestCursorRef = useRef(null);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const updateLatestCursorRef = useCallback((cursor) => {
    latestCursorRef.current = cursor;
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError('');

      const [usersRes, unreadRes] = await Promise.all([
        getUsersForMessaging(),
        getUnreadCount()
      ]);

      const usersPayload = Array.isArray(usersRes?.data?.data)
        ? usersRes.data.data
        : Array.isArray(usersRes?.data)
          ? usersRes.data
          : [];
      const fetchedUsers = normalizeUsers(usersPayload);

      fetchedUsers.sort((a, b) => {
        if (b.unread_count !== a.unread_count) {
          return b.unread_count - a.unread_count;
        }

        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;

        if (dateA !== dateB) {
          return dateB - dateA;
        }

        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      setUsers(fetchedUsers);

      if (selectedUserId && fetchedUsers.every((item) => item.id !== selectedUserId)) {
        if (fetchedUsers.length > 0) {
          setSelectedUserId(fetchedUsers[0].id);
        } else {
          setSelectedUserId(null);
        }
      }

      const totalUnread = unreadRes?.data?.data?.unreadCount ?? unreadRes?.data?.unreadCount ?? 0;
      setUnreadCount(Number(totalUnread) || 0);

      if (!selectedUserId && fetchedUsers.length > 0) {
        const preferredUser = fetchedUsers.find((item) => item.unread_count > 0) || fetchedUsers[0];
        setSelectedUserId(preferredUser.id);
      }
    } catch (err) {
      console.error('Error loading messaging users:', err);
      setError('Fehler beim Laden der Nachrichten. Bitte versuche es später erneut.');
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedUserId]);

  const fetchConversation = useCallback(async (userId, options = {}) => {
    if (!userId) {
      return;
    }

    const {
      mode = 'initial',
      cursor,
      limit = DEFAULT_PAGE_SIZE
    } = options;

    const params = {
      with: userId,
      limit
    };

    if (mode === 'older' && cursor) {
      params.before = cursor;
    } else if (mode === 'newer' && cursor) {
      params.after = cursor;
    }

    try {
      if (mode === 'initial') {
        setLoadingConversation(true);
      } else if (mode === 'older') {
        setLoadingMore(true);
      }

      const response = await getMessages(params);
      const payload = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      const meta = response?.data?.meta || {};
      const normalizedMessages = payload.map(normalizeMessage);
      const newestMessage = normalizedMessages.length > 0
        ? normalizedMessages[normalizedMessages.length - 1]
        : null;

      setConversationMessages((prev) => {
        if (mode === 'initial') {
          return normalizedMessages;
        }

        if (mode === 'older') {
          return mergeMessages(prev, normalizedMessages, 'prepend');
        }

        return mergeMessages(prev, normalizedMessages, 'append');
      });

      setMessageMeta((prev) => ({
        hasMore: typeof meta.hasMore === 'boolean' ? meta.hasMore : prev.hasMore,
        nextCursor: meta.nextCursor ?? prev.nextCursor,
        latestCursor: meta.latestCursor ?? newestMessage?.created_at ?? prev.latestCursor
      }));

      if (newestMessage) {
        updateLatestCursorRef(newestMessage.created_at);
      }

      setUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === userId
            ? {
                ...item,
                unread_count: 0,
                last_message: newestMessage?.message ?? item.last_message,
                last_message_at: newestMessage?.created_at ?? item.last_message_at
              }
            : item
        )
      );

      setConversationError('');
    } catch (err) {
      console.error('Error loading conversation:', err);
      if (mode === 'initial') {
        setConversationMessages([]);
      }
      setConversationError('Fehler beim Laden der Unterhaltung. Bitte versuche es erneut.');
    } finally {
      if (mode === 'initial') {
        setLoadingConversation(false);
      } else if (mode === 'older') {
        setLoadingMore(false);
      }
    }
  }, [updateLatestCursorRef]);

  const getUnreadCountData = useCallback(async () => {
    try {
      const unreadRes = await getUnreadCount();
      const totalUnread = unreadRes?.data?.data?.unreadCount ?? unreadRes?.data?.unreadCount ?? 0;
      setUnreadCount(Number(totalUnread) || 0);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!selectedUserId) {
      setConversationMessages([]);
      setConversationError('');
      setMessageMeta({ hasMore: false, nextCursor: null, latestCursor: null });
      updateLatestCursorRef(null);
      return;
    }

    setConversationError('');
    fetchConversation(selectedUserId, { mode: 'initial', limit: DEFAULT_PAGE_SIZE });
  }, [selectedUserId, fetchConversation, updateLatestCursorRef]);

  useEffect(() => {
    updateLatestCursorRef(messageMeta.latestCursor || null);
  }, [messageMeta.latestCursor, updateLatestCursorRef]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadUsers();
      getUnreadCountData();
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, [loadUsers, getUnreadCountData]);

  useEffect(() => {
    if (!selectedUserId) {
      return undefined;
    }

    const interval = setInterval(() => {
      const cursor = latestCursorRef.current;
      if (cursor) {
        fetchConversation(selectedUserId, { mode: 'newer', cursor });
      } else {
        fetchConversation(selectedUserId, { mode: 'initial', limit: DEFAULT_PAGE_SIZE });
      }
      getUnreadCountData();
    }, 20000);

    return () => clearInterval(interval);
  }, [selectedUserId, fetchConversation, getUnreadCountData]);

  const handleSendMessage = useCallback(async (receiverId, content) => {
    if (!receiverId || !content || isSending) {
      return;
    }

    try {
      setIsSending(true);
      const response = await sendMessage(receiverId, content);
      const payload = response?.data?.data || response?.data;
      const newMessage = normalizeMessage(payload);

      if (!newMessage || !newMessage.id) {
        return;
      }

      setConversationMessages((prev) => mergeMessages(prev, [newMessage], 'append'));
      setMessageMeta((prev) => ({
        ...prev,
        latestCursor: newMessage.created_at || prev.latestCursor
      }));
      updateLatestCursorRef(newMessage.created_at || null);

      setUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === receiverId
            ? {
                ...item,
                last_message: newMessage.message,
                last_message_at: newMessage.created_at,
                unread_count: 0
              }
            : item
        )
      );
    } catch (err) {
      console.error('Error sending message:', err);
      setConversationError('Fehler beim Senden der Nachricht. Bitte versuche es erneut.');
    } finally {
      setIsSending(false);
    }
  }, [isSending, updateLatestCursorRef]);

  const handleSelectUser = useCallback((item) => {
    if (!item) {
      setSelectedUserId(null);
      return;
    }

    setSelectedUserId(item.id);
    setUsers((prevUsers) =>
      prevUsers.map((userItem) =>
        userItem.id === item.id
          ? { ...userItem, unread_count: 0 }
          : userItem
      )
    );
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!selectedUserId || !messageMeta.nextCursor || loadingMore) {
      return;
    }

    fetchConversation(selectedUserId, {
      mode: 'older',
      cursor: messageMeta.nextCursor,
      limit: DEFAULT_PAGE_SIZE
    });
  }, [selectedUserId, messageMeta.nextCursor, loadingMore, fetchConversation]);

  const handleRetryConversation = useCallback(() => {
    if (selectedUserId) {
      fetchConversation(selectedUserId, { mode: 'initial', limit: DEFAULT_PAGE_SIZE });
    }
  }, [selectedUserId, fetchConversation]);

  if (loadingUsers) {
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
        <p className="text-gray-600 flex items-center gap-2">
          Kommuniziere mit deinen Kollegen in Echtzeit
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {unreadCount} ungelesen
            </span>
          )}
        </p>
      </div>

      <TelegramChat
        users={users}
        messages={conversationMessages}
        currentUserId={user.id}
        onSendMessage={handleSendMessage}
        onSelectUser={handleSelectUser}
        selectedUser={selectedUser}
        onLoadMore={handleLoadMore}
        hasMore={messageMeta.hasMore}
        isLoadingMessages={loadingConversation}
        isLoadingMore={loadingMore}
        onRetry={handleRetryConversation}
        error={conversationError}
        isSending={isSending}
      />
    </div>
  );
};

export default Messages;
