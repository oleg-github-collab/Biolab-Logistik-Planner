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

const createDefaultMeta = () => ({
  hasMore: false,
  nextCursor: null,
  latestCursor: null
});

const hasTimezone = (value = '') => /Z|[+-]\d{2}:?\d{2}$/.test(value);

const ensureIsoString = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  const direct = new Date(value);

  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const withZone = hasTimezone(normalized) ? normalized : `${normalized}Z`;
    const fallback = new Date(withZone);

    if (!Number.isNaN(fallback.getTime())) {
      return fallback.toISOString();
    }
  }

  return null;
};

const getMessageTimestamp = (message) => {
  if (!message) {
    return 0;
  }

  const iso = ensureIsoString(message.created_at);

  if (!iso) {
    return 0;
  }

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const normalizeMessage = (message) => {
  if (!message) {
    return null;
  }

  const createdAt = ensureIsoString(message.created_at);

  return {
    ...message,
    read_status: Boolean(message?.read_status),
    delivered_status: Boolean(message?.delivered_status),
    created_at: createdAt ?? message.created_at ?? null
  };
};

const mergeMessages = (existing, incoming, direction = 'append') => {
  const combined = direction === 'prepend'
    ? [...incoming, ...existing]
    : [...existing, ...incoming];

  const map = new Map();

  combined.forEach((msg) => {
    if (!msg || typeof msg !== 'object' || (!msg.id && msg.id !== 0)) {
      return;
    }

    const current = map.get(msg.id) || {};
    const normalizedCreatedAt = ensureIsoString(msg.created_at) ?? current.created_at ?? null;

    map.set(msg.id, {
      ...current,
      ...msg,
      created_at: normalizedCreatedAt
    });
  });

  return Array.from(map.values())
    .filter((item) => item && (item.id || item.id === 0))
    .sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
};

const normalizeUsers = (rawUsers = []) =>
  rawUsers.map((user) => ({
    ...user,
    unread_count: Number(user.unread_count) || 0,
    last_message_at: ensureIsoString(user.last_message_at) ?? user.last_message_at ?? null
  }));

const sortUsersList = (list = []) =>
  [...list].sort((a, b) => {
    if (b.unread_count !== a.unread_count) {
      return b.unread_count - a.unread_count;
    }

    const dateA = getMessageTimestamp({ created_at: a.last_message_at });
    const dateB = getMessageTimestamp({ created_at: b.last_message_at });

    if (dateA !== dateB) {
      return dateB - dateA;
    }

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

const Messages = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messageMeta, setMessageMeta] = useState(createDefaultMeta);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [conversationError, setConversationError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const latestCursorRef = useRef(null);
  const activeConversationRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    activeConversationRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const updateLatestCursorRef = useCallback((cursor) => {
    latestCursorRef.current = cursor;
  }, []);

  const sortUsers = useCallback((list) => sortUsersList(list), []);

  const loadUsers = useCallback(async () => {
    if (!isMountedRef.current || !user?.id) {
      return;
    }

    setLoadingUsers(true);
    setError('');

    try {
      const [usersRes, unreadRes] = await Promise.all([
        getUsersForMessaging(),
        getUnreadCount()
      ]);

      if (!isMountedRef.current) {
        return;
      }

      const usersPayload = Array.isArray(usersRes?.data?.data)
        ? usersRes.data.data
        : Array.isArray(usersRes?.data)
          ? usersRes.data
          : [];
      const fetchedUsers = sortUsers(normalizeUsers(usersPayload));

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
      if (!isMountedRef.current) {
        return;
      }
      console.error('Error loading messaging users:', err);
      setError('Fehler beim Laden der Nachrichten. Bitte versuche es später erneut.');
    } finally {
      if (isMountedRef.current) {
        setLoadingUsers(false);
      }
    }
  }, [selectedUserId, sortUsers, user]);

  const fetchConversation = useCallback(async (userId, options = {}) => {
    if (!user?.id || !userId || !isMountedRef.current) {
      return;
    }

    const {
      mode = 'initial',
      cursor,
      limit = DEFAULT_PAGE_SIZE,
      resetState = false
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

    const isActiveConversation = () => activeConversationRef.current === userId;

    try {
      if (mode === 'initial' && resetState && isMountedRef.current && isActiveConversation()) {
        setConversationMessages([]);
        setMessageMeta(createDefaultMeta());
        updateLatestCursorRef(null);
      }

      if (mode === 'initial' && isMountedRef.current && isActiveConversation()) {
        setLoadingConversation(true);
      } else if (mode === 'older' && isMountedRef.current && isActiveConversation()) {
        setLoadingMore(true);
      }

      const response = await getMessages(params);

      if (!isMountedRef.current || !isActiveConversation()) {
        return;
      }

      const payload = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      const meta = response?.data?.meta || {};
      const normalizedMessages = payload.map(normalizeMessage).filter(Boolean);
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

      let latestCursorValue = null;

      setMessageMeta((prev) => {
        const normalizedNextCursor = ensureIsoString(meta.nextCursor);
        const normalizedLatestCursor = ensureIsoString(meta.latestCursor);
        const baseState = mode === 'initial' ? createDefaultMeta() : prev;
        const hasMoreValue = typeof meta.hasMore === 'boolean'
          ? meta.hasMore
          : baseState.hasMore;
        const nextCursorValue = mode === 'initial'
          ? normalizedNextCursor ?? null
          : normalizedNextCursor ?? baseState.nextCursor;
        const resolvedLatestCursor = normalizedLatestCursor
          ?? newestMessage?.created_at
          ?? (mode === 'initial' ? null : baseState.latestCursor);

        latestCursorValue = resolvedLatestCursor;

        return {
          hasMore: hasMoreValue,
          nextCursor: nextCursorValue,
          latestCursor: resolvedLatestCursor
        };
      });

      updateLatestCursorRef(latestCursorValue ?? null);

      setUsers((prevUsers) =>
        sortUsers(
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
        )
      );

      setConversationError('');
    } catch (err) {
      if (!isMountedRef.current || !isActiveConversation()) {
        return;
      }
      console.error('Error loading conversation:', err);
      if (mode === 'initial') {
        setConversationMessages([]);
      }
      setConversationError('Fehler beim Laden der Unterhaltung. Bitte versuche es erneut.');
    } finally {
      if (!isMountedRef.current || !isActiveConversation()) {
        return;
      }

      if (mode === 'initial') {
        setLoadingConversation(false);
      } else if (mode === 'older') {
        setLoadingMore(false);
      }
    }
  }, [sortUsers, updateLatestCursorRef, user]);

  const getUnreadCountData = useCallback(async () => {
    if (!user?.id || !isMountedRef.current) {
      return;
    }

    try {
      const unreadRes = await getUnreadCount();

      if (!isMountedRef.current) {
        return;
      }

      const totalUnread = unreadRes?.data?.data?.unreadCount ?? unreadRes?.data?.unreadCount ?? 0;
      setUnreadCount(Number(totalUnread) || 0);
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      console.error('Error loading unread count:', err);
    }
  }, [user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    setLoadingMore(false);

    if (!selectedUserId) {
      setConversationMessages([]);
      setConversationError('');
      setMessageMeta(createDefaultMeta());
      setLoadingConversation(false);
      updateLatestCursorRef(null);
      return;
    }

    setConversationError('');
    fetchConversation(selectedUserId, { mode: 'initial', limit: DEFAULT_PAGE_SIZE, resetState: true });
  }, [selectedUserId, fetchConversation, updateLatestCursorRef, user]);

  useEffect(() => {
    updateLatestCursorRef(messageMeta.latestCursor ?? null);
  }, [messageMeta.latestCursor, updateLatestCursorRef]);

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const refreshInterval = setInterval(() => {
      loadUsers();
      getUnreadCountData();
    }, 60000);

    return () => clearInterval(refreshInterval);
  }, [loadUsers, getUnreadCountData, user]);

  useEffect(() => {
    if (!user?.id || !selectedUserId) {
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
  }, [selectedUserId, fetchConversation, getUnreadCountData, user]);

  const handleSendMessage = useCallback(async (receiverId, content) => {
    if (!user?.id || !receiverId || !content || isSending || !isMountedRef.current) {
      return;
    }

    try {
      setIsSending(true);
      const response = await sendMessage(receiverId, content);

      if (!isMountedRef.current) {
        return;
      }

      const payload = response?.data?.data || response?.data;
      const newMessage = normalizeMessage(payload);

      if (!newMessage || !newMessage.id) {
        return;
      }

      if (activeConversationRef.current === receiverId) {
        setConversationMessages((prev) => mergeMessages(prev, [newMessage], 'append'));
        let latestCursorValue = null;
        setMessageMeta((prev) => {
          const resolvedLatest = newMessage.created_at ?? prev.latestCursor ?? null;
          latestCursorValue = resolvedLatest;
          return {
            ...prev,
            latestCursor: resolvedLatest
          };
        });
        updateLatestCursorRef(latestCursorValue ?? null);
        setConversationError('');
      }

      setUsers((prevUsers) => {
        const exists = prevUsers.some((item) => item.id === receiverId);
        const updatedUsers = exists
          ? prevUsers.map((item) =>
              item.id === receiverId
                ? {
                    ...item,
                    last_message: newMessage.message,
                    last_message_at: newMessage.created_at,
                    unread_count: 0
                  }
                : item
            )
          : [
              ...prevUsers,
              {
                id: receiverId,
                name: selectedUser?.name || 'Unbekannter Benutzer',
                email: selectedUser?.email || '',
                unread_count: 0,
                last_message: newMessage.message,
                last_message_at: newMessage.created_at
              }
            ];

        return sortUsers(updatedUsers);
      });
    } catch (err) {
      if (!isMountedRef.current) {
        return;
      }
      console.error('Error sending message:', err);
      if (activeConversationRef.current === receiverId) {
        setConversationError('Fehler beim Senden der Nachricht. Bitte versuche es erneut.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  }, [isSending, selectedUser, sortUsers, updateLatestCursorRef, user]);

  const handleSelectUser = useCallback((item) => {
    if (!isMountedRef.current) {
      return;
    }

    if (!item) {
      setSelectedUserId(null);
      setConversationMessages([]);
      setConversationError('');
      setMessageMeta(createDefaultMeta());
      updateLatestCursorRef(null);
      return;
    }

    const isNewSelection = item.id !== selectedUserId;

    setSelectedUserId(item.id);
    setConversationError('');

    if (isNewSelection) {
      setConversationMessages([]);
      setMessageMeta(createDefaultMeta());
      updateLatestCursorRef(null);
    }

    setUsers((prevUsers) =>
      sortUsers(
        prevUsers.map((userItem) =>
          userItem.id === item.id
            ? { ...userItem, unread_count: 0 }
            : userItem
        )
      )
    );
  }, [selectedUserId, sortUsers, updateLatestCursorRef]);

  const handleLoadMore = useCallback(() => {
    if (!user?.id || !selectedUserId || !messageMeta.nextCursor || loadingMore || !isMountedRef.current) {
      return;
    }

    fetchConversation(selectedUserId, {
      mode: 'older',
      cursor: messageMeta.nextCursor,
      limit: DEFAULT_PAGE_SIZE
    });
  }, [selectedUserId, messageMeta.nextCursor, loadingMore, fetchConversation, user]);

  const handleRetryConversation = useCallback(() => {
    if (!user?.id || !selectedUserId) {
      return;
    }

    setConversationError('');
    if (selectedUserId) {
      fetchConversation(selectedUserId, {
        mode: 'initial',
        limit: DEFAULT_PAGE_SIZE,
        resetState: true
      });
    }
  }, [selectedUserId, fetchConversation, user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="mt-4 text-gray-600">Profil wird geladen...</p>
        </div>
      </div>
    );
  }

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
        currentUserId={user?.id ?? null}
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
