import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, MessageCircle, Search, Send, Menu, X, Hash, Loader2, Sparkles, Paperclip, Mic, StopCircle, Trash2, Smile, Quote, ThumbsUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useWebSocketContext } from '../context/WebSocketContext';
import {
  getMessageThreads,
  createConversationThread,
  getConversationMessages,
  sendConversationMessage,
  markConversationAsRead,
  getConversationThread,
  getAllContacts,
  uploadAttachment,
  addMessageReaction,
  deleteMessage
} from '../utils/apiEnhanced';
import GifPicker from './GifPicker';
import { showError, showSuccess } from '../utils/toast';

const ConversationTypeBadge = ({ type }) => {
  const map = {
    direct: { label: 'Direkt', className: 'bg-blue-100 text-blue-700' },
    group: { label: 'Gruppe', className: 'bg-emerald-100 text-emerald-700' },
    topic: { label: 'Thema', className: 'bg-purple-100 text-purple-700' }
  };

  const meta = map[type] || map.direct;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '🙏'];
const COMMON_EMOJIS = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😢', '👏', '🔥', '🥳', '🤩', '🙌', '👌', '🤝', '💡'];

const MessageBubble = ({
  message,
  currentUserId,
  onReact,
  onToggleReactionPicker,
  onQuote,
  onDelete,
  showReactionPicker
}) => {
  const isMine = message.sender_id === currentUserId;
  const timestamp = message.created_at ? format(parseISO(message.created_at), 'dd.MM.yyyy HH:mm', { locale: de }) : '';
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const quote = message.quote || null;
  const shouldShowText = message.message && !(attachments.length > 0 && message.message === '[attachment]');

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} py-1`}>
      <div className={`group relative max-w-full md:max-w-xl rounded-2xl px-4 py-3 shadow-sm border ${isMine ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-800 border-slate-200'}`}>
        {!isMine && (
          <p className="text-xs font-semibold text-blue-600 mb-1">
            {message.sender_name || message.sender_id}
          </p>
        )}

        {quote && (
          <div className={`mb-2 rounded-xl border px-3 py-2 text-xs ${isMine ? 'border-blue-400 bg-white/10 text-blue-100' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            <p className="font-semibold">{quote.quoted_sender_name || 'Antwort'}</p>
            <p className="truncate">{quote.snippet || quote.quoted_message || 'Nachricht'}</p>
          </div>
        )}

        {shouldShowText && (
          message.message_type === 'gif'
            ? <img src={message.message} alt="GIF" className="rounded-lg max-h-60" />
            : <p className="text-sm whitespace-pre-line break-words">{message.message}</p>
        )}

        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((attachment) => {
              if (attachment.type === 'image') {
                return (
                  <img
                    key={attachment.id || attachment.url}
                    src={attachment.url}
                    alt={attachment.name || 'Anhang'}
                    className="rounded-lg max-h-64 border border-slate-200"
                  />
                );
              }
              if (attachment.type === 'audio') {
                return (
                  <audio
                    key={attachment.id || attachment.url}
                    className="w-full"
                    controls
                    src={attachment.url}
                  >
                    Ihr Browser unterstützt das Audio-Element nicht.
                  </audio>
                );
              }
              return (
                <a
                  key={attachment.id || attachment.url}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 text-sm underline ${isMine ? 'text-blue-100' : 'text-blue-600'}`}
                >
                  📎 {attachment.name || 'Datei herunterladen'}
                </a>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs">
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${isMine ? 'bg-blue-500/40 text-white hover:bg-blue-500/60' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => onToggleReactionPicker(message.id)}
            aria-label="Reaktion hinzufügen"
          >
            <Smile className="h-4 w-4" />
            Reagieren
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${isMine ? 'bg-blue-500/40 text-white hover:bg-blue-500/60' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            onClick={() => onQuote(message)}
            aria-label="Nachricht zitieren"
          >
            <Quote className="h-4 w-4" />
            Antworten
          </button>
          {isMine && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-red-500/40 text-white hover:bg-red-500/60"
              onClick={() => onDelete(message.id)}
              aria-label="Nachricht löschen"
            >
              <Trash2 className="h-4 w-4" />
              Löschen
            </button>
          )}
        </div>

        {showReactionPicker && (
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${isMine ? 'border-blue-400 bg-blue-500/40 text-white hover:bg-blue-500/60' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => onReact(message, emoji)}
              >
                <span>{emoji}</span>
              </button>
            ))}
            <button
              type="button"
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-sm ${isMine ? 'border-blue-400 bg-blue-500/30 text-white hover:bg-blue-500/60' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => onReact(message, '👍')}
            >
              <ThumbsUp className="h-4 w-4" />
              Like
            </button>
          </div>
        )}

        {reactions.length > 0 && (
          <div className={`mt-3 flex flex-wrap gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((reaction) => {
              const users = Array.isArray(reaction.users) ? reaction.users : [];
              const hasReacted = users.some((entry) => entry?.user_id === currentUserId);
              return (
                <button
                  key={`${reaction.emoji}-${message.id}`}
                  type="button"
                  onClick={() => onReact(message, reaction.emoji)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${hasReacted ? 'border-blue-300 bg-blue-500/40 text-white' : isMine ? 'border-blue-300 bg-blue-500/20 text-white' : 'border-slate-200 bg-slate-100 text-slate-600'}`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}

        <p className={`mt-2 text-[11px] ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>{timestamp}</p>
      </div>
    </div>
  );
};

const sortThreads = (threads) =>
  [...threads].sort((a, b) => {
    const aDate = a.lastMessage?.createdAt || a.updatedAt || a.createdAt;
    const bDate = b.lastMessage?.createdAt || b.updatedAt || b.createdAt;
    return new Date(bDate || 0) - new Date(aDate || 0);
  });

const deriveDisplayName = (thread, currentUserId) => {
  if (thread.name && thread.name.trim().length > 0) {
    return thread.name;
  }

  if (thread.type === 'direct' && Array.isArray(thread.members) && thread.members.length > 0) {
    const other = thread.members.find((member) => member.user_id !== currentUserId);
    if (other) {
      return other.name || `Kontakt ${other.user_id}`;
    }
  }

  if (Array.isArray(thread.members) && thread.members.length > 0) {
    const names = thread.members
      .filter((member) => member.user_id !== currentUserId)
      .map((member) => member.name)
      .filter(Boolean);
    if (names.length > 0) {
      return names.join(', ');
    }
  }

  return 'Konversation';
};

const UnifiedMessenger = () => {
  const { user } = useAuth();
  const { t } = useLocale();
  const {
    isConnected,
    onConversationEvent,
    joinConversationRoom,
    leaveConversationRoom
  } = useWebSocketContext();

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsError, setThreadsError] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messagesByThread, setMessagesByThread] = useState({});
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    description: '',
    type: 'group',
    memberIds: [],
    isTemporary: false,
    expiresAt: ''
  });
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [reactionTargetId, setReactionTargetId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingStreamRef = useRef(null);

  const loadThreads = useCallback(async () => {
    try {
      setThreadsLoading(true);
      const response = await getMessageThreads();
      const enriched = response.data.map((thread) => ({
        ...thread,
        displayName: deriveDisplayName(thread, user?.id)
      }));
      setThreads(sortThreads(enriched));
      setThreadsError(null);
    } catch (error) {
      console.error('Failed to load threads', error);
      setThreadsError(t('messenger.error.loadThreads'));
    } finally {
      setThreadsLoading(false);
    }
  }, [t, user?.id]);

  const loadContacts = useCallback(async () => {
    try {
      setContactsLoading(true);
      const response = await getAllContacts();
      setContacts(response.data || []);
    } catch (error) {
      console.error('Failed to load contacts', error);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;

    try {
      setMessagesLoading(true);
      const response = await getConversationMessages(conversationId);
      const messages = Array.isArray(response.data)
        ? response.data.map((message) => ({
            ...message,
            attachments: Array.isArray(message.attachments)
              ? message.attachments
              : typeof message.attachments === 'string'
                ? JSON.parse(message.attachments || '[]')
                : []
          }))
        : [];
      setMessagesByThread((prev) => ({
        ...prev,
        [conversationId]: messages
      }));
      markConversationAsRead(conversationId).catch(() => undefined);
    } catch (error) {
      console.error('Failed to load messages', error);
      showError(t('messenger.error.loadMessages'));
    } finally {
      setMessagesLoading(false);
    }
  }, [t]);

  const uploadAttachmentFile = useCallback(
    async (file, extra = {}) => {
      if (!file) return null;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('context', extra.context || 'message');
      if (extra.conversationId) {
        formData.append('conversationId', String(extra.conversationId));
      }
      if (extra.eventId) {
        formData.append('eventId', String(extra.eventId));
      }

      try {
        setUploadingAttachment(true);
        const response = await uploadAttachment(formData);
        return response.data;
      } catch (error) {
        console.error('Attachment upload failed', error);
        showError(t('messenger.error.send'));
        return null;
      } finally {
        setUploadingAttachment(false);
      }
    },
    [t]
  );

  const handleAttachmentUpload = useCallback(
    async (fileList) => {
      if (!selectedThreadId) {
        showError(t('messenger.empty.select'));
        return;
      }

      const files = Array.from(fileList || []);
      for (const file of files) {
        const metadata = await uploadAttachmentFile(file, { context: 'message', conversationId: selectedThreadId });
        if (metadata) {
          setPendingAttachments((prev) => [...prev, metadata]);
        }
      }
    },
    [selectedThreadId, t, uploadAttachmentFile]
  );

  const onFileInputChange = useCallback((event) => {
    const files = event.target.files;
    if (files && files.length) {
      handleAttachmentUpload(files).catch(() => undefined);
    }
    event.target.value = '';
  }, [handleAttachmentUpload]);

  const removePendingAttachment = useCallback((attachmentId) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const handleToggleReactionPicker = useCallback((messageId) => {
    setReactionTargetId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const updateMessageReactions = useCallback((conversationId, messageId, reactions) => {
    setMessagesByThread((prev) => {
      if (conversationId) {
        const existing = prev[conversationId] || [];
        if (!existing.length) return prev;
        return {
          ...prev,
          [conversationId]: existing.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
        };
      }
      const updatedEntries = Object.entries(prev).map(([id, list]) => ([
        id,
        list.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
      ]));
      return Object.fromEntries(updatedEntries);
    });
  }, []);

  const handleAddReaction = useCallback(async (message, emoji) => {
    if (!message?.id) return;
    try {
      const response = await addMessageReaction(message.id, emoji);
      const updated = Array.isArray(response.data?.reactions) ? response.data.reactions : [];
      updateMessageReactions(message.conversation_id || selectedThreadId, message.id, updated);
    } catch (error) {
      console.error('Failed to toggle reaction', error);
      showError(t('messenger.error.send'));
    } finally {
      setReactionTargetId(null);
    }
  }, [selectedThreadId, t, updateMessageReactions, showError]);

  const handleQuoteMessage = useCallback((message) => {
    if (!message) return;
    setReplyTo({
      id: message.id,
      sender_name: message.sender_name || message.sender_id,
      snippet: message.message || (message.attachments?.length ? 'Anhang' : '')
    });
  }, []);

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!messageId) return;

    if (!window.confirm('Möchten Sie diese Nachricht wirklich löschen?')) {
      return;
    }

    try {
      await deleteMessage(messageId);

      // Remove message from local state
      setMessagesByThread((prev) => {
        const conversationId = selectedThreadId;
        if (!conversationId || !prev[conversationId]) return prev;

        return {
          ...prev,
          [conversationId]: prev[conversationId].filter(msg => msg.id !== messageId)
        };
      });

      showSuccess('Nachricht erfolgreich gelöscht');
    } catch (error) {
      console.error('Failed to delete message', error);
      showError('Fehler beim Löschen der Nachricht');
    }
  }, [selectedThreadId]);

  const clearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleEmojiSelect = useCallback((emoji) => {
    setMessageInput((prev) => `${prev}${emoji}`);
  }, []);

  const resetRecordingState = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
    recordingChunksRef.current = [];
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      resetRecordingState();
    }
  }, [resetRecordingState]);

  const startRecording = useCallback(async () => {
    if (!selectedThreadId) {
      showError(t('messenger.empty.select'));
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Audio-Aufnahme wird von diesem Browser nicht unterstützt.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          const metadata = await uploadAttachmentFile(file, { context: 'message', conversationId: selectedThreadId });
          if (metadata) {
            setPendingAttachments((prev) => [...prev, metadata]);
          }
        } catch (error) {
          console.error('Voice upload failed', error);
          showError(t('messenger.error.send'));
        } finally {
          resetRecordingState();
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Unable to start recording', error);
      showError('Audio-Aufnahme konnte nicht gestartet werden.');
      resetRecordingState();
    }
  }, [selectedThreadId, t, uploadAttachmentFile, resetRecordingState]);

  useEffect(() => () => {
    resetRecordingState();
  }, [resetRecordingState]);

  useEffect(() => {
    loadThreads();
    loadContacts();
  }, [loadThreads, loadContacts]);

  // Listen for new users being created
  useEffect(() => {
    if (!isConnected || !onConversationEvent) return;

    const handleUserCreated = (payload) => {
      console.log('New user created:', payload);
      // Reload contacts to include the new user
      loadContacts();
    };

    onConversationEvent('user:created', handleUserCreated);
  }, [isConnected, onConversationEvent, loadContacts]);

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId) {
      return undefined;
    }

    loadMessages(selectedThreadId);
    joinConversationRoom(selectedThreadId);
    markConversationAsRead(selectedThreadId).catch(() => undefined);
    setThreads((prev) => prev.map((thread) => (
      thread.id === selectedThreadId ? { ...thread, unreadCount: 0 } : thread
    )));
    setPendingAttachments([]);
    setMessageInput('');

    return () => {
      leaveConversationRoom(selectedThreadId);
    };
  }, [selectedThreadId, loadMessages, joinConversationRoom, leaveConversationRoom]);

  const handleConversationEvent = useCallback((eventType, payload) => {
    if (!payload || !payload.conversationId) return;

    const conversationId = payload.conversationId;
    const message = payload.message;
    const parsedMessage = message
      ? {
          ...message,
          attachments: Array.isArray(message.attachments)
            ? message.attachments
            : typeof message.attachments === 'string'
              ? JSON.parse(message.attachments || '[]')
              : [],
          reactions: Array.isArray(message.reactions)
            ? message.reactions
            : typeof message.reactions === 'string'
              ? JSON.parse(message.reactions || '[]')
              : [],
          mentions: Array.isArray(message.mentions)
            ? message.mentions
            : typeof message.mentions === 'string'
              ? JSON.parse(message.mentions || '[]')
              : [],
          calendar_refs: Array.isArray(message.calendar_refs)
            ? message.calendar_refs
            : typeof message.calendar_refs === 'string'
              ? JSON.parse(message.calendar_refs || '[]')
              : [],
          task_refs: Array.isArray(message.task_refs)
            ? message.task_refs
            : typeof message.task_refs === 'string'
              ? JSON.parse(message.task_refs || '[]')
              : [],
          quote: message.quote || null
        }
      : null;

    setThreads((prev) => {
      const updated = prev.map((thread) => {
        if (thread.id !== conversationId) return thread;
        const isOwnMessage = parsedMessage?.sender_id === user?.id;
        const unreadCount = conversationId === selectedThreadId || isOwnMessage
          ? 0
          : (Number(thread.unreadCount) || 0) + 1;
        return {
          ...thread,
          unreadCount,
          lastMessage: parsedMessage
            ? {
                id: parsedMessage.id,
                content: parsedMessage.message,
                senderId: parsedMessage.sender_id,
                messageType: parsedMessage.message_type,
                createdAt: parsedMessage.created_at
              }
            : thread.lastMessage,
          updatedAt: parsedMessage?.created_at || thread.updatedAt,
          displayName: thread.displayName || deriveDisplayName(thread, user?.id)
        };
      });
      return sortThreads(updated);
    });

    setMessagesByThread((prev) => {
      const existing = prev[conversationId] || [];
      if (parsedMessage && existing.find((msg) => msg.id === parsedMessage.id)) {
        return prev;
      }
      const updated = parsedMessage ? [...existing, parsedMessage] : existing;
      return { ...prev, [conversationId]: updated };
    });

    if (conversationId === selectedThreadId) {
      markConversationAsRead(conversationId).catch(() => undefined);
    }
  }, [selectedThreadId, user?.id]);

  const handleReactionEvent = useCallback(({ conversationId, messageId, reactions }) => {
    if (!messageId) return;
    setMessagesByThread((prev) => {
      if (!conversationId) {
        // Apply to all conversations that contain the message (fallback)
        const entries = Object.entries(prev).map(([key, list]) => ([key, list.map((msg) => msg.id === messageId ? { ...msg, reactions: reactions || [] } : msg)]));
        return Object.fromEntries(entries);
      }
      const existing = prev[conversationId] || [];
      if (existing.length === 0) return prev;
      return {
        ...prev,
        [conversationId]: existing.map((msg) => (msg.id === messageId ? { ...msg, reactions: reactions || [] } : msg))
      };
    });
  }, []);

  const handleMentionNotification = useCallback((payload) => {
    if (!payload || payload?.mentionedBy?.id === user?.id) return;
    const author = payload.mentionedBy?.name || payload.mentionedBy?.id || 'Ein Teammitglied';
    showSuccess(`${author} hat dich erwähnt.`);
  }, [showSuccess, user?.id]);

  useEffect(() => {
    const cleanupNew = onConversationEvent('conversation:new_message', (payload) => handleConversationEvent('conversation:new_message', payload));
    const cleanupConfirmed = onConversationEvent('conversation:message_confirmed', (payload) => handleConversationEvent('conversation:message_confirmed', payload));
    const cleanupReaction = onConversationEvent('message:reaction', handleReactionEvent);
    const cleanupMention = onConversationEvent('message:mentioned', handleMentionNotification);
    const cleanupCreated = onConversationEvent('conversation:created', ({ conversation }) => {
      if (!conversation) return;
      setThreads((prev) => sortThreads([
        {
          ...conversation,
          displayName: deriveDisplayName(conversation, user?.id),
          unreadCount: 0,
          members: conversation.members || []
        },
        ...prev
      ]));
    });

    const cleanupMembers = onConversationEvent('conversation:members_updated', async ({ conversationId }) => {
      if (!conversationId) return;
      try {
        const response = await getConversationThread(conversationId);
        setThreads((prev) => prev.map((thread) => (
          thread.id === conversationId
            ? {
                ...thread,
                ...response.data,
                displayName: deriveDisplayName(response.data, user?.id),
                members: response.data.members
              }
            : thread
        )));
      } catch (error) {
        console.error('Failed to refresh conversation members', error);
      }
    });

    return () => {
      cleanupNew();
      cleanupConfirmed();
      cleanupCreated();
      cleanupMembers();
      cleanupReaction();
      cleanupMention();
    };
  }, [onConversationEvent, handleConversationEvent, handleReactionEvent, handleMentionNotification, user?.id]);

  const formattedRecordingTime = useMemo(() => {
    const minutes = String(Math.floor(recordingTime / 60)).padStart(2, '0');
    const seconds = String(recordingTime % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [recordingTime]);

  const filteredThreads = useMemo(() => {
    if (!searchTerm) return threads;
    const term = searchTerm.toLowerCase();
    return threads.filter((thread) =>
      thread.displayName?.toLowerCase().includes(term) ||
      thread.description?.toLowerCase().includes(term)
    );
  }, [threads, searchTerm]);

  const currentMessages = selectedThreadId ? messagesByThread[selectedThreadId] || [] : [];

  useEffect(() => {
    setReactionTargetId(null);
    setShowEmojiPanel(false);
  }, [selectedThreadId]);

  const handleSendMessage = async () => {
    if (!selectedThreadId || uploadingAttachment) return;
    const trimmed = messageInput.trim();
    const hasText = trimmed.length > 0;
    const hasAttachments = pendingAttachments.length > 0;

    if (!hasText && !hasAttachments) {
      return;
    }

    const payload = {
      message: hasText ? trimmed : null,
      attachments: pendingAttachments,
      quotedMessageId: replyTo?.id || null,
      metadata: replyTo ? { quoted_message_id: replyTo.id } : {},
      mentionedUserIds: []
    };

    try {
      setSending(true);
      const response = await sendConversationMessage(selectedThreadId, payload);
      const newMessage = response.data?.message || response.data;
      const normalizedMessage = {
        ...newMessage,
        conversation_id: newMessage.conversation_id || selectedThreadId,
        attachments: Array.isArray(newMessage.attachments)
          ? newMessage.attachments
          : typeof newMessage.attachments === 'string'
            ? JSON.parse(newMessage.attachments || '[]')
            : [],
        reactions: Array.isArray(newMessage.reactions)
          ? newMessage.reactions
          : typeof newMessage.reactions === 'string'
            ? JSON.parse(newMessage.reactions || '[]')
            : [],
        quote: newMessage.quote || null
      };
      setMessageInput('');
      setPendingAttachments([]);
      setReplyTo(null);
      setShowEmojiPanel(false);
      setMessagesByThread((prev) => {
        const existing = prev[selectedThreadId] || [];
        if (existing.find((msg) => msg.id === normalizedMessage.id)) {
          return prev;
        }
        return {
          ...prev,
          [selectedThreadId]: [...existing, normalizedMessage]
        };
      });
      markConversationAsRead(selectedThreadId).catch(() => undefined);
    } catch (error) {
      console.error('Failed to send message', error);
      showError(t('messenger.error.send'));
    } finally {
      setSending(false);
    }
  };

  const handleSelectThread = (threadId) => {
    setSelectedThreadId(threadId);
    setShowSidebar(false);
  };

  const handleGifSelect = async ({ url }) => {
    if (!selectedThreadId || !url) return;
    try {
      setSending(true);
      const response = await sendConversationMessage(selectedThreadId, {
        gif: url,
        quotedMessageId: replyTo?.id || null,
        metadata: replyTo ? { quoted_message_id: replyTo.id } : {},
        mentionedUserIds: []
      });
      const newMessage = response.data?.message || response.data;
      const normalizedMessage = {
        ...newMessage,
        conversation_id: newMessage.conversation_id || selectedThreadId,
        attachments: Array.isArray(newMessage.attachments)
          ? newMessage.attachments
          : typeof newMessage.attachments === 'string'
            ? JSON.parse(newMessage.attachments || '[]')
            : [],
        reactions: Array.isArray(newMessage.reactions)
          ? newMessage.reactions
          : typeof newMessage.reactions === 'string'
            ? JSON.parse(newMessage.reactions || '[]')
            : [],
        quote: newMessage.quote || null
      };
      setMessagesByThread((prev) => ({
        ...prev,
        [selectedThreadId]: [...(prev[selectedThreadId] || []), normalizedMessage]
      }));
    } catch (error) {
      console.error('Failed to send GIF', error);
      showError(t('messenger.error.send'));
    } finally {
      setSending(false);
      setShowGifPicker(false);
      setReplyTo(null);
    }
  };

  const handleCreateConversation = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        name: createData.name,
        description: createData.description,
        type: createData.type,
        memberIds: createData.memberIds,
        isTemporary: createData.isTemporary,
        expiresAt: createData.expiresAt || null
      };

      const response = await createConversationThread(payload);
      const conversation = response.data;
      setThreads((prev) => sortThreads([
        {
          ...conversation,
          displayName: deriveDisplayName(conversation, user?.id)
        },
        ...prev
      ]));
      showSuccess(t('messenger.success.threadCreated'));
      setShowCreateModal(false);
      setCreateData({
        name: '',
        description: '',
        type: 'group',
        memberIds: [],
        isTemporary: false,
        expiresAt: ''
      });
    } catch (error) {
      console.error('Failed to create conversation', error);
      showError(t('messenger.error.loadThreads'));
    }
  };

  const renderThreadItem = (thread) => {
    const isActive = thread.id === selectedThreadId;
    const lastMessageText = thread.lastMessage?.content || t('messenger.empty.noMessages');
    const lastMessageDate = thread.lastMessage?.createdAt
      ? formatDistanceToNow(new Date(thread.lastMessage.createdAt), { addSuffix: true, locale: de })
      : '';

    return (
      <button
        key={thread.id}
        onClick={() => handleSelectThread(thread.id)}
        className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${isActive ? 'bg-white border-blue-300 shadow-sm' : 'bg-white/60 border-transparent hover:bg-white'} flex flex-col gap-1`}
      >
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-slate-900 truncate flex-1 pr-2">{thread.displayName}</p>
          <ConversationTypeBadge type={thread.type} />
        </div>
        <p className="text-xs text-slate-500 truncate">{lastMessageText}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{lastMessageDate}</span>
          {thread.unreadCount > 0 && (
            <span className="inline-flex items-center justify-center bg-blue-600 text-white text-[11px] font-semibold rounded-full min-w-[24px] h-6 px-2">
              {thread.unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderCreateModal = () => (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <form onSubmit={handleCreateConversation} className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            {t('messenger.actions.createGroup')}
          </h2>
          <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t('messenger.group.name')}</label>
          <input
            type="text"
            value={createData.name}
            onChange={(event) => setCreateData((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('messenger.group.placeholder')}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t('messenger.group.topic')}</label>
          <input
            type="text"
            value={createData.description}
            onChange={(event) => setCreateData((prev) => ({ ...prev, description: event.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('messenger.topic.placeholder')}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">{t('messenger.group.members')}</label>
          <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
            {contactsLoading && (
              <div className="p-3 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('messenger.error.loadThreads')}
              </div>
            )}
            {!contactsLoading && contacts.length === 0 && (
              <div className="p-3 text-sm text-slate-500">{t('messenger.empty.noMessages')}</div>
            )}
            {!contactsLoading && contacts.map((contact) => {
              const checked = createData.memberIds.includes(contact.id);
              return (
                <label key={contact.id} className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const selected = event.target.checked
                        ? [...createData.memberIds, contact.id]
                        : createData.memberIds.filter((id) => id !== contact.id);
                      setCreateData((prev) => ({ ...prev, memberIds: selected }));
                    }}
                  />
                  <span>{contact.name || contact.email}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={createData.isTemporary}
              onChange={(event) => setCreateData((prev) => ({ ...prev, isTemporary: event.target.checked }))}
            />
            {t('messenger.group.tempFlag')}
          </label>
          {createData.isTemporary && (
            <input
              type="date"
              value={createData.expiresAt}
              onChange={(event) => setCreateData((prev) => ({ ...prev, expiresAt: event.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500"
          >
            {t('messenger.group.create')}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="h-full w-full bg-slate-100 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            className="lg:hidden p-2 rounded-lg bg-slate-100 text-slate-600"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            {t('messenger.title')}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">
            {isConnected ? 'Online' : 'Offline'}
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            {t('messenger.actions.createGroup')}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`bg-slate-50 border-r border-slate-200 w-80 flex-shrink-0 flex flex-col transition-transform duration-200 ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="p-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('messenger.search.placeholder')}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
            {threadsLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500 px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('messenger.error.loadThreads')}
              </div>
            )}
            {threadsError && (
              <div className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg border border-red-100">
                {threadsError}
              </div>
            )}
            {!threadsLoading && filteredThreads.length === 0 && (
              <div className="text-sm text-slate-500 px-4 py-3">
                {t('messenger.empty.select')}
              </div>
            )}
            {!threadsLoading && filteredThreads.map(renderThreadItem)}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          {selectedThreadId ? (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {threads.find((thread) => thread.id === selectedThreadId)?.displayName || t('messenger.mobile.openSidebar')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {threads.find((thread) => thread.id === selectedThreadId)?.description || t('messenger.thread.members', { count: threads.find((thread) => thread.id === selectedThreadId)?.participantCount || 0 })}
                  </p>
                </div>
                <button
                  className="lg:hidden p-2 rounded-lg bg-slate-100 text-slate-600"
                  onClick={() => setShowSidebar(true)}
                >
                  <Hash className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-100">
                {messagesLoading && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('messenger.error.loadMessages')}
                  </div>
                )}
                {!messagesLoading && currentMessages.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-10">
                    {t('messenger.empty.noMessages')}
                  </div>
                )}
                {currentMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={user?.id}
                    onReact={handleAddReaction}
                    onToggleReactionPicker={handleToggleReactionPicker}
                    onQuote={handleQuoteMessage}
                    onDelete={handleDeleteMessage}
                    showReactionPicker={reactionTargetId === message.id}
                  />
                ))}
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-3">
                {replyTo && (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    <div className="flex flex-col max-w-[80%]">
                      <span className="font-semibold">{replyTo.sender_name || 'Antwort'}</span>
                      <span className="truncate text-blue-600/90">{replyTo.snippet || 'Zitierte Nachricht'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearReply}
                      className="rounded-full p-1 text-blue-500 hover:bg-blue-100"
                      aria-label={t('common.cancel')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {pendingAttachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-3">
                    {pendingAttachments.map((attachment) => (
                      <div key={attachment.id || attachment.url} className="relative">
                        {attachment.type === 'image' ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name || 'Anhang'}
                            className="h-20 w-20 rounded-xl object-cover border border-slate-200"
                          />
                        ) : attachment.type === 'audio' ? (
                          <div className="flex w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <span className="font-semibold text-slate-600">{attachment.name || 'Audio'}</span>
                            <audio controls src={attachment.url} className="w-full" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                            <Paperclip className="w-3 h-3" />
                            <span>{attachment.name || 'Datei'}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePendingAttachment(attachment.id)}
                          className="absolute -top-2 -right-2 rounded-full bg-rose-600 p-1 text-white shadow-lg hover:bg-rose-500"
                          aria-label="Anhang entfernen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isRecording && (
                  <div className="mb-2 flex items-center gap-3 text-sm text-rose-600">
                    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                    <span>{t('messenger.actions.recording')} · {formattedRecordingTime}</span>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                    >
                      <StopCircle className="w-4 h-4" />
                      {t('messenger.actions.recordStop')}
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    onClick={() => setShowGifPicker(true)}
                    type="button"
                    aria-label="GIF auswählen"
                  >
                    <img src="https://static.thenounproject.com/png/781035-200.png" alt="GIF" className="w-5 h-5" />
                  </button>
                  <button
                    className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t('messenger.actions.attach')}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    className={`p-2 rounded-lg ${showEmojiPanel ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'} hover:bg-slate-200`}
                    type="button"
                    onClick={() => setShowEmojiPanel((prev) => !prev)}
                    aria-label="Emoji auswählen"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <button
                    className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    aria-label={isRecording ? t('messenger.actions.recordStop') : t('messenger.actions.recordStart')}
                  >
                    {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <textarea
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    placeholder={t('messenger.input.placeholder')}
                    disabled={isRecording}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || uploadingAttachment || (!messageInput.trim() && pendingAttachments.length === 0)}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-500 disabled:opacity-60"
                  >
                    {(sending || uploadingAttachment) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('messenger.actions.send')}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={onFileInputChange}
                />

                {showEmojiPanel && (
                  <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg shadow-sm">
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="hover:scale-110 transition-transform"
                        onClick={() => handleEmojiSelect(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              {t('messenger.empty.select')}
            </div>
          )}
        </main>
      </div>

      {showCreateModal && renderCreateModal()}

      {showGifPicker && (
        <GifPicker
          onSelectGif={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
};

export default UnifiedMessenger;
