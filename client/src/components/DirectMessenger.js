import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Send,
  Search,
  Menu,
  X,
  Paperclip,
  Mic,
  StopCircle,
  Image as ImageIcon,
  Trash2,
  Check,
  CheckCheck,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Loader2,
  Smile,
  Reply,
  Plus,
  Pin,
  Zap,
  FileText,
  Forward,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useMobile } from '../hooks/useMobile';
import {
  getAllContacts,
  getConversationMessages,
  sendConversationMessage,
  createConversationThread,
  getMessageThreads,
  uploadAttachment,
  deleteMessage,
  getStoriesFeed,
  getQuickReplies,
  markStoryViewed,
  linkCalendarToMessage,
  getCalendarEvents,
  addMessageReaction,
  pinMessage,
  getPinnedMessages
} from '../utils/apiEnhanced';
import GifPicker from './GifPicker';
import TypingIndicator from './TypingIndicator';
import MessageSearch from './MessageSearch';
import StoryComposer from './StoryComposer';
import QuickRepliesPanel from './QuickRepliesPanel';
import ContactNotesPanel from './ContactNotesPanel';
import MessageForwardModal from './MessageForwardModal';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import { showError, showSuccess } from '../utils/toast';
import { getAssetUrl } from '../utils/media';

const DirectMessenger = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isConnected, onConversationEvent, joinConversationRoom } = useWebSocketContext();
  const { isMobile } = useMobile();

  const [contacts, setContacts] = useState([]);
  const [threads, setThreads] = useState([]);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [mobileMode, setMobileMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [eventOptions, setEventOptions] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventError, setEventError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [pendingEventShare, setPendingEventShare] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showContactNotes, setShowContactNotes] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [typingUsers, setTypingUsers] = useState({});
  const [showComposerActions, setShowComposerActions] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [mobileQuickReplies, setMobileQuickReplies] = useState([]);
  const [quickRepliesLoading, setQuickRepliesLoading] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [longPressMenuMessage, setLongPressMenuMessage] = useState(null);
  const [longPressMenuPosition, setLongPressMenuPosition] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const typingTimeoutRef = useRef(null);

  // Simple debounce utility
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const normalizeMessage = useCallback((message) => {
    if (!message) return message;

    let attachments = [];
    if (Array.isArray(message.attachments)) {
      attachments = message.attachments;
    } else if (typeof message.attachments === 'string') {
      try {
        const parsed = JSON.parse(message.attachments);
        attachments = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        attachments = [];
      }
    }

    let calendarRefs = [];
    if (Array.isArray(message.calendar_refs)) {
      calendarRefs = message.calendar_refs;
    } else if (message.calendar_refs && typeof message.calendar_refs === 'string') {
      try {
        const parsed = JSON.parse(message.calendar_refs);
        calendarRefs = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        calendarRefs = [];
      }
    }

    let metadata = {};
    if (message.metadata) {
      if (typeof message.metadata === 'string') {
        try {
          metadata = JSON.parse(message.metadata) || {};
        } catch (error) {
          metadata = {};
        }
      } else if (typeof message.metadata === 'object') {
        metadata = { ...message.metadata };
      }
    }

    // Transform reactions from array format to object format
    // Backend returns: [{ emoji: '👍', count: 2, users: [{user_id: 1, ...}, {user_id: 2, ...}] }]
    // Frontend expects: { '👍': [1, 2] }
    let reactions = {};
    if (Array.isArray(message.reactions)) {
      message.reactions.forEach((reaction) => {
        if (reaction.emoji && Array.isArray(reaction.users)) {
          reactions[reaction.emoji] = reaction.users.map(u => u.user_id);
        }
      });
    } else if (message.reactions && typeof message.reactions === 'object') {
      // Already in object format
      reactions = message.reactions;
    }

    return {
      ...message,
      attachments,
      calendar_refs: calendarRefs,
      metadata,
      reactions
    };
  }, []);

  const formatEventDateRange = (start, end) => {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    if (!startDate || Number.isNaN(startDate.getTime())) {
      return 'Unbekannter Zeitraum';
    }

    const startLabel = format(startDate, 'dd.MM.yyyy HH:mm', { locale: de });

    if (!endDate || Number.isNaN(endDate.getTime())) {
      return startLabel;
    }

    const sameDay =
      format(startDate, 'dd.MM.yyyy', { locale: de }) === format(endDate, 'dd.MM.yyyy', { locale: de });

    if (sameDay) {
      return `${startLabel} – ${format(endDate, 'HH:mm', { locale: de })}`;
    }

    return `${startLabel} – ${format(endDate, 'dd.MM.yyyy HH:mm', { locale: de })}`;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setStoriesLoading(true);
        const [contactsRes, threadsRes, storiesRes] = await Promise.all([
          getAllContacts().catch(err => {
            console.error('Error loading contacts:', err);
            return { data: [] };
          }),
          getMessageThreads().catch(err => {
            console.error('Error loading threads:', err);
            return { data: [] };
          }),
          getStoriesFeed().catch(err => {
            console.error('Error loading stories:', err);
            return { data: { stories: [] } };
          })
        ]);
        setContacts(Array.isArray(contactsRes?.data) ? contactsRes.data : []);
        setThreads(Array.isArray(threadsRes?.data) ? threadsRes.data : []);
        setStories(Array.isArray(storiesRes?.data?.stories) ? storiesRes.data.stories : []);
      } catch (error) {
        console.error('Error loading data:', error);
        showError('Fehler beim Laden der Daten');
        setContacts([]);
        setThreads([]);
        setStories([]);
      } finally {
        setLoading(false);
        setStoriesLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
    } else {
      setShowSidebar(true);
    }
  }, [isMobile]);

  useEffect(() => {
    setSelectedEvent(null);
  }, [selectedThreadId]);

  // Load pinned messages when conversation changes
  useEffect(() => {
    const loadPinnedMessages = async () => {
      if (!selectedThreadId) {
        setPinnedMessages([]);
        return;
      }

      try {
        const response = await getPinnedMessages(selectedThreadId);
        setPinnedMessages(response.data || []);
      } catch (error) {
        console.error('Error loading pinned messages:', error);
        setPinnedMessages([]);
      }
    };

    loadPinnedMessages();
  }, [selectedThreadId]);

  // Handle shared event from navigation state
  useEffect(() => {
    if (location.state?.shareEvent) {
      const sharedEvent = location.state.shareEvent;
      setPendingEventShare(sharedEvent);
      setShowContactPicker(true);
      // Clear the navigation state so it doesn't persist on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    shouldAutoScrollRef.current = false;
  }, [messages]);

  useEffect(() => {
    if (!selectedThreadId || !isConnected) return;

    joinConversationRoom(selectedThreadId);

    const handleNewMessage = (data) => {
      console.log('📨 [DirectMessenger] handleNewMessage called:', {
        dataConversationId: data?.conversationId,
        selectedThreadId,
        hasMessage: !!data?.message,
        willAdd: data?.conversationId === selectedThreadId && !!data?.message
      });

      if (data?.conversationId === selectedThreadId && data?.message) {
        shouldAutoScrollRef.current = true;
        setMessages((prev) => {
          // Check for duplicates
          if (Array.isArray(prev) && prev.some(m => m?.id === data.message.id)) {
            console.log('⚠️ [DirectMessenger] Duplicate message, skipping');
            return prev;
          }
          console.log('✅ [DirectMessenger] Adding message to state');
          return Array.isArray(prev) ? [...prev, normalizeMessage(data.message)] : [normalizeMessage(data.message)];
        });
      } else {
        console.log('❌ [DirectMessenger] Message NOT added - conversation mismatch or no message');
      }
    };

    const handleMessageReaction = (data) => {
      if (data?.conversationId === selectedThreadId && data?.messageId) {
        setMessages((prev) =>
          Array.isArray(prev)
            ? prev.map((msg) => {
                if (msg?.id === data.messageId) {
                  // Transform reactions from array to object format
                  let reactions = {};
                  if (Array.isArray(data.reactions)) {
                    data.reactions.forEach((reaction) => {
                      if (reaction.emoji && Array.isArray(reaction.users)) {
                        reactions[reaction.emoji] = reaction.users.map(u => u.user_id);
                      }
                    });
                  }
                  return {
                    ...msg,
                    reactions
                  };
                }
                return msg;
              })
            : prev
        );
      }
    };

    const handleMessagePin = (data) => {
      if (data?.conversationId === selectedThreadId && data?.message) {
        const isPinned = data.isPinned ?? true;
        if (isPinned) {
          setPinnedMessages((prev) => {
            const alreadyExists = prev.some((m) => m.id === data.message.id);
            if (alreadyExists) return prev;
            return [...prev, normalizeMessage(data.message)];
          });
        } else {
          setPinnedMessages((prev) => prev.filter((m) => m.id !== data.message.id));
        }
      }
    };

    const handleUserTyping = (data) => {
      if (data?.conversationId === selectedThreadId && data?.userId && data.userId !== user?.id) {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: { name: data.userName || 'User', timestamp: Date.now() }
        }));

        // Auto-clear after 3 seconds
        setTimeout(() => {
          setTypingUsers(prev => {
            const updated = { ...prev };
            delete updated[data.userId];
            return updated;
          });
        }, 3000);
      }
    };

    const handleUserStopTyping = (data) => {
      if (data?.conversationId === selectedThreadId && data?.userId) {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    };

    const handleMessageRead = (data) => {
      if (data?.conversationId) {
        setThreads(prev => prev.map(thread =>
          thread.id === data.conversationId
            ? { ...thread, unreadCount: 0 }
            : thread
        ));
      }
    };

    const unsubscribeNewMessage = onConversationEvent('new_message', handleNewMessage);
    const unsubscribeReaction = onConversationEvent('message:reaction', handleMessageReaction);
    const unsubscribePin = onConversationEvent('message:pin', handleMessagePin);
    const unsubscribeTyping = onConversationEvent('typing:start', handleUserTyping);
    const unsubscribeStopTyping = onConversationEvent('typing:stop', handleUserStopTyping);
    const unsubscribeMessageRead = onConversationEvent('message:read', handleMessageRead);

    return () => {
      unsubscribeNewMessage();
      unsubscribeReaction();
      unsubscribePin();
      unsubscribeTyping();
      unsubscribeStopTyping();
      unsubscribeMessageRead();
    };
  }, [selectedThreadId, isConnected, joinConversationRoom, onConversationEvent, normalizeMessage, user]);

  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) {
      console.warn('loadMessages called without threadId');
      return;
    }

    try {
      const response = await getConversationMessages(threadId);
      const msgs = Array.isArray(response?.data) ? response.data : [];
      shouldAutoScrollRef.current = true;
      setMessages(msgs.map((msg) => normalizeMessage(msg)));
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Fehler beim Laden der Nachrichten');
      setMessages([]);
    }
  }, [normalizeMessage]);

  const handleContactClick = async (contact) => {
    console.log('[DirectMessenger] ===== handleContactClick START =====');
    console.log('[DirectMessenger] Contact:', contact);
    console.log('[DirectMessenger] Threads length:', threads?.length);

    if (!contact?.id) {
      console.error('[DirectMessenger] ERROR: No contact ID');
      showError('Kontakt nicht gefunden');
      return;
    }

    try {
      console.log('[DirectMessenger] Setting selected contact...');
      setSelectedContact(contact);

      console.log('[DirectMessenger] Searching for existing thread...');
      const existingThread = Array.isArray(threads)
        ? threads.find(
            (t) =>
              t?.type === 'direct' &&
              Array.isArray(t.members) &&
              t.members.some((member) => member?.user_id === contact.id)
          )
        : null;

      console.log('[DirectMessenger] Existing thread:', existingThread);

      if (existingThread?.id) {
        console.log('[DirectMessenger] Using existing thread:', existingThread.id);
        setSelectedThreadId(existingThread.id);
        await loadMessages(existingThread.id);
      } else {
        console.log('[DirectMessenger] Creating new thread...');
        const response = await createConversationThread({
          name: contact.name || 'Unbekannt',
          type: 'direct',
          memberIds: [contact.id]
        });

        console.log('[DirectMessenger] Create thread response:', response);

        if (response?.data?.id) {
          console.log('[DirectMessenger] Thread created successfully:', response.data.id);
          setSelectedThreadId(response.data.id);
          setMessages([]);
          setThreads((prev) => Array.isArray(prev) ? [...prev, response.data] : [response.data]);
        } else {
          throw new Error('Invalid response from createConversationThread');
        }
      }

      console.log('[DirectMessenger] Mobile check:', isMobile);
      if (isMobile) {
        setMobileMode('chat');
      }

      console.log('[DirectMessenger] ===== handleContactClick SUCCESS =====');
    } catch (error) {
      console.error('[DirectMessenger] ===== handleContactClick ERROR =====');
      console.error('[DirectMessenger] Error object:', error);
      console.error('[DirectMessenger] Error message:', error?.message);
      console.error('[DirectMessenger] Error stack:', error?.stack);
      showError('Fehler beim Öffnen des Chats: ' + (error?.message || 'Unbekannter Fehler'));
    }
  };

  // Handler for group chat selection
  const handleGroupChatClick = useCallback(async (groupThread) => {
    if (!groupThread?.id) {
      showError('Group chat not found');
      return;
    }

    try {
      setSelectedContact(null); // Clear individual contact
      setSelectedThreadId(groupThread.id);

      // Join WebSocket room
      if (joinConversationRoom) {
        joinConversationRoom(groupThread.id);
      }

      // Load messages
      await loadMessages(groupThread.id);

      if (isMobile) {
        setMobileMode('chat');
      }
    } catch (error) {
      console.error('Error opening group chat:', error);
      showError('Failed to load group chat: ' + (error?.message || 'Unknown error'));
    }
  }, [joinConversationRoom, loadMessages, isMobile]);

  // Load members when thread changes to group
  useEffect(() => {
    const currentThread = threads.find(t => t.id === selectedThreadId);
    if (currentThread?.type === 'group' && selectedThreadId) {
      // Load group members directly in useEffect
      const loadMembers = async () => {
        try {
          const response = await fetch(`/api/messages/conversations/${selectedThreadId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (!response.ok) throw new Error('Failed to fetch conversation details');

          const data = await response.json();
          if (data?.members && Array.isArray(data.members)) {
            setGroupMembers(data.members);
          }
        } catch (error) {
          console.error('Error loading group members:', error);
        }
      };

      loadMembers();
    } else {
      setGroupMembers([]);
    }
  }, [selectedThreadId, threads]);

  // Handle input change with @mention detection and typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;

    setMessageInput(value);
    setCursorPosition(cursorPos);

    // Send typing indicator using the memoized function
    if (value.trim() && selectedThreadId && isConnected) {
      if (window.socket) {
        window.socket.emit('typing:start', {
          conversationId: selectedThreadId,
          userId: user?.id,
          userName: user?.name
        });
      }

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing indicator after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (window.socket && selectedThreadId) {
          window.socket.emit('typing:stop', {
            conversationId: selectedThreadId,
            userId: user?.id
          });
        }
      }, 3000);
    } else if (!value.trim() && window.socket && selectedThreadId) {
      window.socket.emit('typing:stop', {
        conversationId: selectedThreadId,
        userId: user?.id
      });
    }

    // Check for @ mention
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const afterAt = textBeforeCursor.substring(lastAtSymbol + 1);

      // Check if we're still in mention mode (no space after @)
      if (!afterAt.includes(' ')) {
        const query = afterAt.toLowerCase();
        setMentionQuery(query);

        // Filter members by query
        if (Array.isArray(groupMembers) && groupMembers.length > 0) {
          const filtered = groupMembers.filter(member =>
            member.name?.toLowerCase().includes(query) ||
            member.email?.toLowerCase().includes(query)
          ).slice(0, 5); // Limit to 5 suggestions

          setMentionSuggestions(filtered);
          setShowMentionSuggestions(filtered.length > 0);
        }
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  // Insert mention
  const insertMention = (member) => {
    const textBeforeCursor = messageInput.substring(0, cursorPosition);
    const textAfterCursor = messageInput.substring(cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const newText = textBeforeCursor.substring(0, lastAtSymbol) +
                      `@${member.name} ` +
                      textAfterCursor;
      setMessageInput(newText);
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  // Highlight @mentions in message text
  const highlightMentions = (text, isMine) => {
    if (!text) return text;

    const mentionRegex = /@([^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add highlighted mention
      const mentionName = match[1];
      const isMentionedUser = Array.isArray(groupMembers) && groupMembers.some(m => m.name === mentionName && m.user_id === user?.id);

      parts.push(
        <span
          key={match.index}
          className={`font-semibold ${
            isMentionedUser
              ? 'bg-yellow-200 text-yellow-900 px-1 rounded'
              : isMine
                ? 'text-blue-200'
                : 'text-blue-600'
          }`}
        >
          @{mentionName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const handleSendMessage = async (event) => {
    event?.preventDefault();

    const trimmed = messageInput?.trim() || '';
    if (!trimmed && (!Array.isArray(pendingAttachments) || pendingAttachments.length === 0) && !selectedEvent) return;

    if (!selectedThreadId) {
      showError('Kein Chat ausgewählt');
      return;
    }

    const inputValue = messageInput;
    const attachments = Array.isArray(pendingAttachments) ? [...pendingAttachments] : [];
    const eventToShare = selectedEvent;
    const replyTo = replyToMessage;
    setMessageInput('');
    setPendingAttachments([]);
    setShowComposerActions(false);
    setReplyToMessage(null);
    setSending(true);

    try {
      let attachmentsData = [];
      if (attachments.length > 0) {
        attachmentsData = await Promise.all(
          attachments.map(async (file) => {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('context', 'message');
              formData.append('conversationId', selectedThreadId);
              const res = await uploadAttachment(formData);
              return res?.data || null;
            } catch (err) {
              console.error('Error uploading attachment:', err);
              return null;
            }
          })
        );
        attachmentsData = attachmentsData.filter(a => a !== null);
      }

      setShowGifPicker(false);

      const messageBody = trimmed || (eventToShare?.title ? `Kalender: ${eventToShare.title}` : '');
      const payload = {
        message: messageBody,
        attachments: attachmentsData
      };

      if (replyTo?.id) {
        payload.metadata = payload.metadata || {};
        payload.metadata.reply_to = {
          id: replyTo.id,
          message: replyTo.message || '',
          sender_name: replyTo.sender_name || 'Unknown'
        };
      }

      if (eventToShare?.id) {
        payload.metadata = payload.metadata || {};
        payload.metadata.shared_event = {
          id: eventToShare.id,
          title: eventToShare.title || 'Untitled',
          start_time: eventToShare.start_time,
          end_time: eventToShare.end_time,
          location: eventToShare.location || null
        };
      }

      const response = await sendConversationMessage(selectedThreadId, payload);
      let newMessage = response?.data?.message ? normalizeMessage(response.data.message) : null;

      if (newMessage?.id && eventToShare?.id) {
        try {
          const linkResponse = await linkCalendarToMessage(newMessage.id, eventToShare.id, 'share');
          const referenceId = linkResponse?.data?.id || `event-ref-${newMessage.id}-${eventToShare.id}`;
          const eventReference = {
            id: referenceId,
            event_id: eventToShare.id,
            event_title: eventToShare.title || 'Untitled',
            event_start_time: eventToShare.start_time,
            event_end_time: eventToShare.end_time,
            location: eventToShare.location || null
          };

          newMessage = {
            ...newMessage,
            calendar_refs: Array.isArray(newMessage.calendar_refs)
              ? [...newMessage.calendar_refs, eventReference]
              : [eventReference],
            metadata: {
              ...(newMessage.metadata || {}),
              shared_event: {
                id: eventToShare.id,
                title: eventToShare.title || 'Untitled',
                start_time: eventToShare.start_time,
                end_time: eventToShare.end_time,
                location: eventToShare.location || null
              }
            }
          };
        } catch (eventLinkError) {
          console.error('Error linking calendar event to message:', eventLinkError);
          showError('Kalenderereignis konnte nicht angehängt werden');
        }
      }

      // Don't add message to state here - WebSocket will handle it
      // This prevents duplicate messages since server emits to conversation room
      if (!newMessage) {
        await loadMessages(selectedThreadId);
      }
      // Scroll will happen when WebSocket event adds the message

      setSelectedEvent(null);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Fehler beim Senden';
      showError(errorMsg);
      setMessageInput(inputValue || '');
      setPendingAttachments(Array.isArray(attachments) ? attachments : []);
      setSelectedEvent(eventToShare || null);
    } finally {
      setSending(false);
    }
  };

  const handleSelectGif = async (gifData) => {
    if (!selectedThreadId) return;

    try {
      setSending(true);
      await sendConversationMessage(selectedThreadId, {
        message: gifData.url || gifData,
        message_type: 'gif'
      });
      setShowGifPicker(false);
      showSuccess('GIF gesendet');
      await loadMessages(selectedThreadId);
    } catch (error) {
      console.error('Error sending GIF:', error);
      showError('Fehler beim Senden des GIFs');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...files.slice(0, 5 - prev.length)]);
  };

  const removeAttachment = useCallback((index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const loadCalendarOptions = useCallback(async () => {
    setEventsLoading(true);
    setEventError('');
    try {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const response = await getCalendarEvents({
        startDate: now.toISOString(),
        endDate: future.toISOString()
      });
      setEventOptions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      setEventOptions([]);
      setEventError('Kalenderereignisse konnten nicht geladen werden');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const openEventPicker = useCallback(() => {
    setShowEventPicker(true);
    loadCalendarOptions();
  }, [loadCalendarOptions]);

  const handleEventSelect = useCallback((event) => {
    setSelectedEvent(event);
    setShowEventPicker(false);
  }, []);

  const clearSelectedEvent = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleContactAction = useCallback((action) => {
    if (!selectedContact) {
      showError('Bitte zuerst einen Kontakt auswählen.');
      return;
    }

    const labels = {
      call: 'Sprachanruf vorbereitet',
      video: 'Videoanruf vorbereitet',
      info: 'Kontaktinfo geöffnet'
    };

    showSuccess(`${labels[action] || 'Aktion'} – ${selectedContact.name}`);
  }, [selectedContact]);

  const storiesByUser = useMemo(() => {
    const map = {};
    stories.forEach((story) => {
      if (!story || !story.userId) return;
      const existing = map[story.userId];
      if (!existing) {
        map[story.userId] = story;
        return;
      }
      const existingTime = new Date(existing.createdAt || 0).getTime();
      const currentTime = new Date(story.createdAt || 0).getTime();
      if (currentTime > existingTime) {
        map[story.userId] = story;
      }
    });
    return map;
  }, [stories]);

  const storyEntries = useMemo(() => Object.values(storiesByUser), [storiesByUser]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        setPendingAttachments((prev) => [...prev, file]);

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        showSuccess('Audioaufnahme hinzugefügt');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      showError('Mikrofon-Zugriff verweigert');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!messageId) {
      showError('Nachricht-ID fehlt');
      return;
    }

    if (!window.confirm('Nachricht wirklich löschen?')) return;

    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      showSuccess('Nachricht gelöscht');
    } catch (error) {
      console.error('Error deleting message:', error);
      showError('Fehler beim Löschen');
    }
  };

  const handleReaction = useCallback(async (messageId, emoji) => {
    if (!user?.id) {
      showError('Benutzer nicht gefunden');
      return;
    }

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = { ...(msg.reactions || {}) };

        // ENSURE reactions[emoji] is ALWAYS an array
        if (!Array.isArray(reactions[emoji])) {
          reactions[emoji] = [];
        }

        const userIndex = reactions[emoji].indexOf(user.id);
        if (userIndex > -1) {
          reactions[emoji].splice(userIndex, 1);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        } else {
          reactions[emoji].push(user.id);
        }

        return { ...msg, reactions };
      })
    );
    setShowReactionPicker(null);

    // Call backend API
    try {
      await addMessageReaction(messageId, emoji);
    } catch (error) {
      console.error('Error adding reaction:', error);
      showError('Fehler beim Hinzufügen der Reaktion');
      // Revert optimistic update on error
      await loadMessages(selectedThreadId);
    }
  }, [user, selectedThreadId, loadMessages]);

  const handleReplyTo = useCallback((message) => {
    setReplyToMessage(message);
  }, []);

  // Long press handlers for mobile
  const handleLongPressStart = useCallback((e, msg) => {
    if (!isMobile) return;

    const touch = e.touches ? e.touches[0] : e;
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMenuMessage(msg);
      setLongPressMenuPosition({
        x: touch.clientX,
        y: touch.clientY
      });
    }, 500); // 500ms for long press
  }, [isMobile]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeLongPressMenu = useCallback(() => {
    setLongPressMenuMessage(null);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handlePinMessage = useCallback(async (message) => {
    if (!message?.id) {
      showError('Nachricht nicht gefunden');
      return;
    }

    const isAlreadyPinned = pinnedMessages.some((m) => m.id === message.id);

    // Optimistic UI update
    setPinnedMessages((prev) => {
      if (isAlreadyPinned) {
        return prev.filter((m) => m.id !== message.id);
      } else {
        return [...prev, message];
      }
    });

    // Call backend API
    try {
      await pinMessage(message.id);
      showSuccess(isAlreadyPinned ? 'Nachricht entfestigt' : 'Nachricht angepinnt');
    } catch (error) {
      console.error('Error pinning message:', error);
      showError('Fehler beim Pinnen der Nachricht');
      // Revert optimistic update on error
      setPinnedMessages((prev) => {
        if (isAlreadyPinned) {
          return [...prev, message];
        } else {
          return prev.filter((m) => m.id !== message.id);
        }
      });
    }
  }, [pinnedMessages]);

  const handleContactSelectForEventShare = useCallback(async (contact) => {
    if (!pendingEventShare) return;

    try {
      // Select contact first
      await handleContactClick(contact);

      // Set the event to be shared
      setSelectedEvent(pendingEventShare);

      // Close picker
      setShowContactPicker(false);
      setPendingEventShare(null);

      showSuccess(`Event bereit zum Teilen mit ${contact.name}`);
    } catch (error) {
      console.error('Error selecting contact for event share:', error);
      showError('Fehler beim Auswählen des Kontakts');
    }
  }, [pendingEventShare, handleContactClick]);

  // Send typing indicator (debounced)
  const sendTypingIndicator = useMemo(
    () => debounce((isTyping) => {
      if (selectedThreadId && isConnected) {
        const eventName = isTyping ? 'typing:start' : 'typing:stop';
        // Emit through WebSocket context if available
        if (window.socket) {
          window.socket.emit(eventName, {
            conversationId: selectedThreadId,
            userId: user.id,
            userName: user.name
          });
        }
      }
    }, 300),
    [selectedThreadId, isConnected, user]
  );


  const highlightMessage = useCallback((messageId) => {
    if (!messageId) return;
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      messageElement.classList.add('highlight-flash');
      setTimeout(() => messageElement.classList.remove('highlight-flash'), 2000);
    }
  }, []);

  const handleMessageSearchSelect = useCallback((message) => {
    setShowSearch(false);
    highlightMessage(message.id);
  }, [highlightMessage]);

  const loadMobileQuickReplies = useCallback(async () => {
    setQuickRepliesLoading(true);
    try {
      const response = await getQuickReplies();
      const templates = Array.isArray(response.data) ? response.data : [];
      setMobileQuickReplies(templates.slice(0, 6));
    } catch (error) {
      console.error('Error loading quick replies:', error);
      setMobileQuickReplies([]);
    } finally {
      setQuickRepliesLoading(false);
    }
  }, []);

  const closeQuickReplies = useCallback(() => {
    setShowQuickReplies(false);
    loadMobileQuickReplies();
  }, [loadMobileQuickReplies]);

  const handleQuickReplySelect = useCallback((content) => {
    setMessageInput(content);
    closeQuickReplies();
  }, [closeQuickReplies]);

  const handleForwardMessage = useCallback((message) => {
    setMessageToForward(message);
    setShowForwardModal(true);
  }, []);

  const handleForwardSuccess = useCallback(() => {
    setShowForwardModal(false);
    setMessageToForward(null);
  }, []);

  useEffect(() => {
    loadMobileQuickReplies();
  }, [loadMobileQuickReplies]);

  const toggleComposerActions = useCallback(() => {
    setShowComposerActions((prev) => !prev);
  }, []);

  const handleAskBot = useCallback(() => {
    setMessageInput('@BL_Bot ');
    setShowComposerActions(false);
    // Focus on input after state update
    setTimeout(() => {
      const textarea = document.querySelector('.message-input');
      if (textarea) {
        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 0);
  }, []);

  const handleStoryCreated = useCallback(async () => {
    try {
      const storiesRes = await getStoriesFeed();
      setStories(Array.isArray(storiesRes?.data?.stories) ? storiesRes.data.stories : []);
    } catch (error) {
      console.error('Error refreshing stories:', error);
    }
  }, []);

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [contacts, searchTerm]
  );

  const formatContactTimestamp = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { locale: de, addSuffix: true });
  }, []);

  const threadMapByContact = useMemo(() => {
    if (!Array.isArray(threads) || threads.length === 0) return {};
    const map = {};
    threads.forEach((thread) => {
      if (thread?.type !== 'direct') return;
      const partner = Array.isArray(thread.members)
        ? thread.members.find((member) => member?.user_id && member?.user_id !== user?.id)
        : null;
      if (partner?.user_id) {
        map[partner.user_id] = thread;
      }
    });
    return map;
  }, [threads, user?.id]);

  // Group threads (including General Chat)
  const groupThreads = useMemo(() => {
    if (!Array.isArray(threads) || threads.length === 0) return [];
    return threads
      .filter(thread => thread?.type === 'group')
      .sort((a, b) => {
        // Pin General Chat to top
        if (a.name === 'General Chat') return -1;
        if (b.name === 'General Chat') return 1;

        // Sort by unread count
        const aUnread = a.unreadCount || 0;
        const bUnread = b.unreadCount || 0;
        if (bUnread !== aUnread) return bUnread - aUnread;

        // Then by last message time
        const aTime = a.lastMessage?.createdAt || a.updatedAt;
        const bTime = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(bTime) - new Date(aTime);
      });
  }, [threads]);

  const decoratedContacts = useMemo(
    () =>
      filteredContacts.map((contact) => {
        const thread = threadMapByContact[contact.id];
        const lastMessage = thread?.lastMessage;
        const timestamp = lastMessage?.createdAt || thread?.updatedAt;
        return {
          ...contact,
          thread,
          unreadCount: thread?.unreadCount || 0,
          lastMessageSnippet:
            lastMessage?.content || contact.status || 'Bereit, direkt zu schreiben',
          lastMessageTime: timestamp,
          lastMessageTimeLabel: formatContactTimestamp(timestamp)
        };
      }),
    [filteredContacts, threadMapByContact, formatContactTimestamp]
  );

  const groupedContacts = useMemo(() => {
    const contactList = decoratedContacts;
    const sortByRecency = (a, b) => {
      const aTs = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTs = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (bTs !== aTs) return bTs - aTs;
      return (a.name || '').localeCompare(b.name || '');
    };
    const unread = contactList.filter((item) => item.unreadCount > 0).sort(sortByRecency);
    const remaining = contactList
      .filter((item) => item.unreadCount === 0)
      .sort((a, b) => {
        if (Number(b.online) !== Number(a.online)) {
          return Number(b.online) - Number(a.online);
        }
        return sortByRecency(a, b);
      });
    return {
      unreadContacts: unread,
      remainingContacts: remaining
    };
  }, [decoratedContacts]);

  const selectedStory = useMemo(
    () =>
      selectedStoryIndex !== null && stories[selectedStoryIndex]
        ? stories[selectedStoryIndex]
        : null,
    [selectedStoryIndex, stories]
  );

  const handleStoryOpen = useCallback(
    (storyId) => {
      const index = stories.findIndex((story) => story.id === storyId);
      if (index !== -1) {
        setSelectedStoryIndex(index);
      }
    },
    [stories]
  );

  const handleStoryClose = useCallback(() => {
    setSelectedStoryIndex(null);
  }, []);

  const handleStoryNext = useCallback(() => {
    if (stories.length === 0 || selectedStoryIndex === null) return;
    const nextIndex = (selectedStoryIndex + 1) % stories.length;
    setSelectedStoryIndex(nextIndex);
  }, [selectedStoryIndex, stories.length]);

  const handleStoryPrev = useCallback(() => {
    if (stories.length === 0 || selectedStoryIndex === null) return;
    const prevIndex = (selectedStoryIndex - 1 + stories.length) % stories.length;
    setSelectedStoryIndex(prevIndex);
  }, [selectedStoryIndex, stories.length]);

  useEffect(() => {
    if (selectedStoryIndex === null) return;
    if (!stories[selectedStoryIndex]) {
      setSelectedStoryIndex(null);
    }
  }, [stories, selectedStoryIndex]);

  useEffect(() => {
    if (!selectedStory || selectedStory.viewerHasSeen) return;
    const markSeen = async () => {
      try {
        await markStoryViewed(selectedStory.id);
        setStories((prev) =>
          prev.map((story, index) =>
            index === selectedStoryIndex ? { ...story, viewerHasSeen: true } : story
          )
        );
      } catch (error) {
        console.error('Error marking story view:', error);
      }
    };

    markSeen();
  }, [selectedStory, selectedStoryIndex]);

  const renderAttachmentPreview = useCallback(
    (file, idx) => (
      <div key={`${file.name}-${idx}`} className="relative inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs text-slate-700">
        <Paperclip className="w-4 h-4 text-slate-500" />
        <span className="max-w-[140px] truncate">{file.name}</span>
        <button
          type="button"
          onClick={() => removeAttachment(idx)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ),
    [removeAttachment]
  );

  const renderMessageContent = (msg, isMine) => {
    const baseClassMobile = `message-bubble ${isMine ? 'mine' : 'other'}`;
    const baseClassDesktop = isMine
      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
      : 'bg-white text-slate-900 border border-slate-200';

    const isHovered = hoveredMessage === msg.id;
    const isPinned = pinnedMessages.some((m) => m.id === msg.id);
    const isReactionToolbarOpen = showReactionPicker === msg.id;
    const messageTimestamp = msg.created_at
      ? format(parseISO(msg.created_at), 'HH:mm', { locale: de })
      : '';
    const isReadMessage = Boolean(msg.read_status || msg.read);

    return (
      <div
        className="relative group"
        onMouseEnter={() => setHoveredMessage(msg.id)}
        onMouseLeave={() => setHoveredMessage(null)}
        onTouchStart={(e) => handleLongPressStart(e, msg)}
        onTouchEnd={handleLongPressEnd}
        onTouchMove={handleLongPressEnd}
      >
        {/* Message bubble with pinned highlight */}
        <div
          className={`${
            isMobile
              ? baseClassMobile
              : `rounded-2xl px-4 py-3 shadow-sm ${baseClassDesktop} transition-all duration-200 hover:shadow-md`
          } ${isPinned && !isMobile ? 'ring-2 ring-yellow-300 bg-yellow-50/20' : ''}`}
        >
          {/* Pinned indicator badge */}
          {isPinned && !isMobile && (
            <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 shadow-md">
              <Pin className="w-3 h-3" />
            </div>
          )}
          {isPinned && isMobile && (
            <div className="absolute -top-2 -right-2 bg-yellow-400/90 text-yellow-900 rounded-full p-1 shadow-md">
              <Pin className="w-3 h-3" />
            </div>
          )}

          {!isMine && msg.sender_name && !isMobile && (
            <p className="text-xs font-semibold text-blue-600 mb-1">
              {msg.sender_name}
            </p>
          )}

          {/* Reply-to display */}
          {msg.metadata?.reply_to && (
            <div
              className={`mb-2 px-3 py-2 rounded-lg border-l-4 overflow-hidden ${
                isMine
                  ? 'bg-blue-500/20 border-blue-300'
                  : 'bg-slate-100 border-slate-400'
              }`}
            >
              <p className={`text-xs font-semibold ${isMine ? 'text-blue-100' : 'text-slate-600'} truncate`}>
                {msg.metadata.reply_to.sender_name}
              </p>
              <p className={`text-xs ${isMine ? 'text-blue-200' : 'text-slate-500'} line-clamp-2 break-words`}>
                {msg.metadata.reply_to.message}
              </p>
            </div>
          )}

          {/* Voice Message Player */}
          {msg.audio_duration && msg.attachments?.length > 0 && msg.attachments[0].type === 'audio' ? (
            <VoiceMessagePlayer
              audioUrl={msg.attachments[0].url}
              duration={msg.audio_duration}
              className="mt-2"
            />
          ) : msg.message_type === 'gif' || (msg.message && (msg.message.includes('giphy.com') || msg.message.includes('tenor.com') || msg.message.match(/\.(gif|webp)(\?|$)/i))) ? (
            <img
              src={msg.message}
              alt="GIF"
              loading="lazy"
              className="rounded-2xl w-full h-auto max-h-[360px] object-contain bg-slate-900/20 border border-white/10 shadow-lg"
            />
          ) : (
            <p className={`${isMobile ? 'message-text' : 'text-sm whitespace-pre-wrap break-words'}`}>
              {highlightMentions(msg.message, isMine)}
            </p>
          )}

          {msg.attachments?.length > 0 && (
            <div className="mt-2 space-y-2">
              {msg.attachments.map((att, idx) => {
                if (att.type === 'image') {
                  return (
                    <img
                      key={`${att.url}-${idx}`}
                      src={att.url}
                      alt="Anhang"
                      loading="lazy"
                      className="rounded-2xl w-full h-auto max-h-80 object-cover shadow-lg border border-white/10"
                    />
                  );
                }
                if (att.type === 'audio') {
                  return (
                    <audio key={`${att.url}-${idx}`} controls src={att.url} className="w-full mt-2" />
                  );
                }
                return (
                  <a
                    key={`${att.url}-${idx}`}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs underline text-blue-600"
                  >
                    📎 {att.name || 'Datei'}
                  </a>
                );
              })}
            </div>
          )}

          {(() => {
            const calendarRefsRaw = Array.isArray(msg.calendar_refs) ? msg.calendar_refs : [];
            const metadataEvent = msg.metadata?.shared_event;
            const calendarRefs = [...calendarRefsRaw];

            if (!calendarRefs.length && metadataEvent) {
              calendarRefs.push({
                id: `meta-${msg.id}`,
                event_id: metadataEvent.id,
                event_title: metadataEvent.title,
                event_start_time: metadataEvent.start_time,
                event_end_time: metadataEvent.end_time,
                location: metadataEvent.location || null
              });
            }

            if (!calendarRefs.length) {
              return null;
            }

            return calendarRefs.map((ref) => (
              <div
                key={`${msg.id}-event-${ref.id || ref.event_id}`}
                className={`mt-3 w-full max-w-md rounded-2xl border ${
                  isMine ? 'border-blue-200 bg-blue-50/80' : 'border-slate-200 bg-white'
                } shadow-sm`}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                      isMine ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {ref.event_title || 'Kalenderereignis'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatEventDateRange(ref.event_start_time, ref.event_end_time)}
                    </p>
                    {ref.location && (
                      <p className="text-xs text-slate-500 mt-1">Ort: {ref.location}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate('/dashboard', {
                        state: { focusEventId: ref.event_id }
                      })
                    }
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      isMine
                        ? 'text-blue-700 hover:text-blue-900'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    Im Kalender öffnen →
                  </button>
                </div>
              </div>
            ));
          })()}

          {/* Reactions display */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                const userIdsArray = Array.isArray(userIds) ? userIds : [];
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(msg.id, emoji)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      userIdsArray.includes(user?.id)
                        ? 'bg-blue-100 border border-blue-300'
                        : 'bg-slate-100 border border-slate-200'
                    } hover:scale-110 transition-transform`}
                  >
                    <span>{emoji}</span>
                    <span className="font-semibold">{userIdsArray.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className={`message-meta mt-3 flex items-center gap-2 ${
              isMine ? 'justify-end' : 'justify-start'
            }`}
          >
            <span className="message-meta__time">{messageTimestamp || '—'}</span>
            {isMine && (
              <span className={`message-status ${isReadMessage ? 'read' : 'sent'}`}>
                <span className="message-status__icon">
                  {isReadMessage ? (
                    <CheckCheck className="w-3 h-3" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </span>
                <span className="message-status__label">
                  {isReadMessage ? 'Gelesen' : 'Zugestellt'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Desktop action buttons - positioned outside bubble on hover */}
        {!isMobile && (isHovered || showReactionPicker === msg.id) && (
          <div
            className={`absolute top-0 ${
              isMine ? 'left-0 -translate-x-full pr-3' : 'right-0 translate-x-full pl-3'
            } flex items-center gap-2 z-50`}
          >
            <button
              onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
              className="p-2.5 bg-white border-2 border-slate-300 rounded-full hover:bg-blue-50 hover:border-blue-400 hover:scale-110 shadow-lg transition-all duration-200 cursor-pointer"
              title="Reagieren"
            >
              <Smile className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => handleReplyTo(msg)}
              className="p-2.5 bg-white border-2 border-slate-300 rounded-full hover:bg-green-50 hover:border-green-400 hover:scale-110 shadow-lg transition-all duration-200 cursor-pointer"
              title="Antworten"
            >
              <Reply className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => handleForwardMessage(msg)}
              className="p-2.5 bg-white border-2 border-slate-300 rounded-full hover:bg-purple-50 hover:border-purple-400 hover:scale-110 shadow-lg transition-all duration-200 cursor-pointer"
              title="Weiterleiten"
            >
              <Forward className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => handlePinMessage(msg)}
              className={`p-2.5 border-2 rounded-full shadow-lg hover:scale-110 transition-all duration-200 cursor-pointer ${
                isPinned
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-white border-slate-300 hover:bg-yellow-50 hover:border-yellow-400 text-slate-600'
              }`}
              title={isPinned ? 'Entfestigen' : 'Anpinnen'}
            >
              <Pin className="w-4 h-4" />
            </button>
            {isMine && (
              <button
                onClick={() => handleDeleteMessage(msg.id)}
                className="p-2.5 bg-white border-2 border-slate-300 rounded-full hover:bg-red-50 hover:border-red-400 hover:scale-110 shadow-lg transition-all duration-200 cursor-pointer"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        )}

        {/* Improved reaction picker popup with backdrop */}
        {showReactionPicker === msg.id && (
          <>
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowReactionPicker(null)}
            />
            {/* Reaction picker */}
            <div
              className={`absolute ${
                isMine ? 'right-0' : 'left-0'
              } top-full mt-3 bg-white border-2 border-slate-300 rounded-2xl shadow-2xl p-3 flex gap-3 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(msg.id, emoji)}
                  className="text-3xl hover:scale-125 active:scale-110 transition-transform p-2 rounded-lg hover:bg-slate-100"
                  title={`Reagiere mit ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Mobile long-press context menu */}
        {isMobile && longPressMenuMessage?.id === msg.id && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[10000] bg-black/20"
              onClick={closeLongPressMenu}
            />
            {/* Context menu */}
            <div
              className="fixed z-[10001] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              style={{
                top: `${longPressMenuPosition.y}px`,
                left: `${longPressMenuPosition.x}px`,
                transform: 'translate(-50%, -50%)',
                minWidth: '200px'
              }}
            >
              <div className="py-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReactionPicker(msg.id);
                    closeLongPressMenu();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <Smile className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Reagieren</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReplyTo(msg);
                    closeLongPressMenu();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <Reply className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Antworten</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleForwardMessage(msg);
                    closeLongPressMenu();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <Forward className="w-5 h-5 text-purple-500" />
                  <span className="font-medium">Weiterleiten</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePinMessage(msg);
                    closeLongPressMenu();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                >
                  <Pin className={`w-5 h-5 ${isPinned ? 'text-yellow-500' : 'text-slate-400'}`} />
                  <span className="font-medium">{isPinned ? 'Entfestigen' : 'Anpinnen'}</span>
                </button>
                {isMine && (
                  <>
                    <div className="h-px bg-slate-200 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteMessage(msg.id);
                        closeLongPressMenu();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="font-medium">Löschen</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <User className="w-16 h-16 mb-4" />
          <p className="text-lg font-medium">Keine Nachrichten</p>
          <p className="text-sm">Beginne die Konversation!</p>
        </div>
      );
    }

    let lastDayKey = null;

    return messages.map((msg) => {
      const isMine = msg.sender_id === user?.id;
      const isPinned = pinnedMessages.some((m) => m.id === msg.id);
      const messageDate = msg.created_at ? parseISO(msg.created_at) : new Date();
      const dayKey = format(messageDate, 'yyyy-MM-dd', { locale: de });
      const dayLabel = format(messageDate, "EEEE, d. MMMM", { locale: de });
      const showDayDivider = dayKey !== lastDayKey;

      if (showDayDivider) {
        lastDayKey = dayKey;
      }

      return (
        <React.Fragment key={msg.id}>
          {showDayDivider && (
            <div className="message-day-divider" aria-label={dayLabel}>
              <span>{dayLabel}</span>
            </div>
          )}
          <div
            id={`message-${msg.id}`}
            className={`flex mb-3 ${isMine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={
                isMobile
                  ? `flex w-full items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`
                  : 'relative max-w-[75%] lg:max-w-[60%] min-w-0'
              }
            >
              <div className={`relative ${isMobile ? 'max-w-[85%]' : 'w-full min-w-0 overflow-visible'}`}>
                {renderMessageContent(msg, isMine)}
              </div>

            </div>
          </div>
        </React.Fragment>
      );
    });
  };

  const ContactList = ({ variant, storyEntries, storyMap, onStoryOpen, storiesLoading }) => {
    const wrapperClass =
      variant === 'overlay'
        ? 'contact-list contact-list--overlay'
        : 'contact-list contact-list--panel';
    const totalContacts = contacts.length;
    const onlineContacts = contacts.filter((contact) => contact.online).length;
    const filteredCount = filteredContacts.length;
    const renderContactCard = (contact) => {
      const isSelected = selectedContact?.id === contact.id;
      const contactStory = storyMap?.[contact.id];
      const unreadCount = contact.unreadCount || 0;

      return (
        <button
          key={contact.id}
          onClick={() => handleContactClick(contact)}
          className={`contact-card ${isSelected ? 'contact-card--active' : ''}`}
        >
          <div className="relative">
            <div
              className={`contact-card__avatar-ring ${contactStory ? 'has-story' : ''} ${
                contactStory && !contactStory.viewerHasSeen ? 'story-unread' : ''
              }`}
            >
              <div className="contact-card__avatar">
                {contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}
              </div>
            </div>
            {/* Online status indicator */}
            {contact.online && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
            )}
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
          <div className="contact-card__body">
            <p className="contact-card__name">{contact.name}</p>
          </div>
        </button>
      );
    };

    // Render group chat card
    const renderGroupChatCard = (groupThread) => {
      const isSelected = selectedThreadId === groupThread.id;
      const unreadCount = groupThread.unreadCount || 0;

      return (
        <button
          key={groupThread.id}
          onClick={() => handleGroupChatClick(groupThread)}
          className={`contact-card ${isSelected ? 'contact-card--active' : ''}`}
        >
          <div className="relative">
            <div className="contact-card__avatar-ring">
              <div className="contact-card__avatar bg-gradient-to-br from-blue-500 to-purple-600">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
          <div className="contact-card__body">
            <p className="contact-card__name">{groupThread.name}</p>
          </div>
        </button>
      );
    };

    return (
      <div className={wrapperClass}>
        <div className="contact-list__header">
          <div>
            <p className="contact-list__eyebrow">Team Messenger</p>
            <h2>Kontakte im Blick behalten</h2>
            <p className="contact-list__subheader">
              {filteredCount} von {totalContacts} Kontakten · {onlineContacts} online
            </p>
          </div>
          {variant === 'overlay' && (
            <button
              onClick={() => setShowSidebar(false)}
              className="contact-list__close"
              aria-label="Kontakte schließen"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

          <div className="contact-list__search">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Kontakte suchen"
              aria-label="Kontakte suchen"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

        <div className="contact-list__stories">
          {/* Add Story Button */}
          <button
            type="button"
            onClick={() => setShowStoryComposer(true)}
            className="story-add-btn"
            aria-label="Story erstellen"
          >
            <div className="story-add-btn__circle">
              <Plus className="w-6 h-6" />
            </div>
            <span className="story-add-btn__label">Story</span>
          </button>

          {storiesLoading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={`story-skel-${idx}`} className="story-chip story-chip--skeleton" />
            ))
          ) : (
            storyEntries.map((story) => (
              <button key={story.id} type="button" onClick={() => onStoryOpen(story.id)} className="story-chip">
                <div className={`story-chip__ring ${story.viewerHasSeen ? 'seen' : ''}`}>
                  <div className="story-chip__avatar">
                    {story.userName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
                <span>{story.userName || 'Story'}</span>
              </button>
            ))
          )}
        </div>

        <div className="contact-list__grid">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Group Chats Section */}
              {groupThreads.length > 0 && (
                <div className="contact-group mb-4">
                  <p className="contact-group__heading flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Group Chats</span>
                    <span className="ml-auto text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">
                      {groupThreads.length}
                    </span>
                  </p>
                  <div className="contact-group__grid">
                    {groupThreads.map(thread => renderGroupChatCard(thread))}
                  </div>
                </div>
              )}

              {/* Divider between groups and contacts */}
              {groupThreads.length > 0 && decoratedContacts.length > 0 && (
                <div className="border-t border-slate-200 my-4" />
              )}

              {/* Individual Contacts Sections */}
              {decoratedContacts.length === 0 && groupThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                  <Users className="w-12 h-12" />
                  <p>No conversations found</p>
                </div>
              ) : (
                <>
                  {groupedContacts.unreadContacts.length > 0 && (
                    <div className="contact-group">
                      <p className="contact-group__heading">Unbeantwortete Nachrichten</p>
                      <div className="contact-group__grid">
                        {groupedContacts.unreadContacts.map((contact) => renderContactCard(contact))}
                      </div>
                    </div>
                  )}
                  {decoratedContacts.length > 0 && (
                    <div className="contact-group">
                      <p className="contact-group__heading">Alle Kontakte</p>
                      <div className="contact-group__grid">
                        {groupedContacts.remainingContacts.length > 0 ? (
                          groupedContacts.remainingContacts.map((contact) => renderContactCard(contact))
                        ) : (
                          <p className="contact-list__empty">Alle Kontakte sind auf dem aktuellen Stand.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopLayout = () => (
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
      {showSidebar && (
        <ContactList
          variant="panel"
          storyEntries={storyEntries}
          storyMap={storiesByUser}
          onStoryOpen={handleStoryOpen}
          storiesLoading={storiesLoading}
        />
      )}

      <div className="flex-1 flex flex-col bg-white min-h-0">
        {selectedContact || selectedThreadId ? (
          <>
            <div className="messenger-desktop-header">
              <div className="messenger-desktop-header__left">
                <button
                  onClick={() => setShowSidebar(true)}
                  className="messenger-desktop-header__menu-btn md:hidden"
                  aria-label="Menü öffnen"
                >
                  <Menu className="w-5 h-5" />
                </button>
                {selectedContact ? (
                  <>
                    <div className="messenger-desktop-header__avatar-wrapper">
                      <div className="messenger-desktop-header__avatar">
                        {selectedContact.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className={`messenger-desktop-header__status ${selectedContact.online ? 'online' : 'offline'}`}></div>
                    </div>
                    <div className="messenger-desktop-header__contact-info">
                      <h3 className="messenger-desktop-header__name">{selectedContact.name}</h3>
                      <p className="messenger-desktop-header__status-text">
                        {selectedContact.online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                ) : selectedThreadId && threads.find(t => t.id === selectedThreadId) ? (
                  <>
                    <div className="messenger-desktop-header__avatar-wrapper">
                      <div className="messenger-desktop-header__avatar bg-gradient-to-br from-blue-500 to-purple-600">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="messenger-desktop-header__contact-info">
                      <h3 className="messenger-desktop-header__name">
                        {threads.find(t => t.id === selectedThreadId)?.name || 'Group Chat'}
                      </h3>
                      <p className="messenger-desktop-header__status-text">
                        {threads.find(t => t.id === selectedThreadId)?.participantCount || 0} members
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="messenger-desktop-header__actions">
                {selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group' && (
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="messenger-desktop-header__action-btn"
                    title="Gruppenmitglieder anzeigen"
                  >
                    <Users className="w-5 h-5" />
                    <span className="hidden lg:inline">Mitglieder ({groupMembers.length})</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSearch(true)}
                  className="messenger-desktop-header__action-btn"
                  title="Nachrichten durchsuchen"
                >
                  <Search className="w-5 h-5" />
                  <span className="hidden lg:inline">Suchen</span>
                </button>
                <button
                  onClick={() => setShowContactNotes(!showContactNotes)}
                  className={`messenger-desktop-header__action-btn ${showContactNotes ? 'active' : ''}`}
                  title="Kontaktnotizen"
                >
                  <FileText className="w-5 h-5" />
                  <span className="hidden lg:inline">Notizen</span>
                </button>
              </div>
            </div>

            {/* Contact Notes Panel */}
            {showContactNotes && selectedContact && (
              <div className="px-6 py-4 border-b border-slate-200 bg-white">
                <ContactNotesPanel
                  contactId={selectedContact.id}
                  contactName={selectedContact.name}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {renderMessages()}

              {/* Typing Indicators */}
              {Object.entries(typingUsers).map(([userId, data]) => (
                <TypingIndicator key={userId} userName={data.name} />
              ))}

              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              {replyToMessage && (
                <div className="mb-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-slate-50 text-slate-700 shadow-sm border-l-4 border-blue-500">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white flex-shrink-0">
                    <Reply className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-600 mb-1">Antworten auf {replyToMessage.sender_name}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{replyToMessage.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelReply}
                    className="p-1.5 rounded-full hover:bg-slate-200/80 transition flex-shrink-0"
                    title="Antwort abbrechen"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              )}
              {selectedEvent && (
                <div className="mb-3 flex items-center gap-3 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 shadow-sm border border-blue-200">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedEvent.title}</p>
                    <p className="text-xs opacity-80">
                      {formatEventDateRange(selectedEvent.start_time, selectedEvent.end_time)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedEvent}
                    className="p-1 rounded-full hover:bg-blue-100 transition"
                    title="Ereignis entfernen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {pendingAttachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {pendingAttachments.map((file, idx) => renderAttachmentPreview(file, idx))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="Datei anhängen"
                  >
                    <Paperclip className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGifPicker((prev) => !prev)}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="GIF senden"
                  >
                    <ImageIcon className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={openEventPicker}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="Kalenderereignis teilen"
                  >
                    <CalendarDays className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(true)}
                    className="p-3 hover:bg-slate-100 rounded-xl transition"
                    title="Schnellantworten"
                  >
                    <Zap className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-3 rounded-xl transition ${
                      isRecording ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100'
                    }`}
                    title={isRecording ? 'Aufnahme stoppen' : 'Sprachnachricht'}
                  >
                    {isRecording ? (
                      <StopCircle className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5 text-slate-600" />
                    )}
                  </button>
                  {selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessageInput((prev) => prev + '@BL_Bot ');
                        // Focus the input after insertion
                        setTimeout(() => {
                          const input = document.querySelector('input[type="text"][placeholder*="Nachricht"]');
                          if (input) {
                            input.focus();
                            input.setSelectionRange(input.value.length, input.value.length);
                          }
                        }, 0);
                      }}
                      className="p-3 hover:bg-blue-50 rounded-xl transition border border-blue-200"
                      title="Bot erwähnen"
                    >
                      <Bot className="w-5 h-5 text-blue-600" />
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group'
                      ? "Nachricht schreiben... (Tipp: @BL_Bot für Hilfe)"
                      : "Nachricht schreiben..."
                  }
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <button
                  type="submit"
                  disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0 && !selectedEvent)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
                >
                  <Send className="w-5 h-5" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <Users className="w-24 h-24 mb-4" />
            <p className="text-xl font-medium">Wähle einen Kontakt</p>
            <p className="text-sm mt-2">Beginne eine Unterhaltung</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderMobileQuickReplies = () => {
    if (!isMobile || !selectedContact) return null;

    if (quickRepliesLoading) {
      return (
        <div className="messenger-quick-replies">
          <div className="messenger-quick-reply animate-pulse bg-slate-200" />
          <div className="messenger-quick-reply animate-pulse bg-slate-200" />
          <div className="messenger-quick-reply animate-pulse bg-slate-200" />
        </div>
      );
    }

    if (!mobileQuickReplies.length) {
      return (
        <div className="messenger-quick-replies">
          <button
            type="button"
            onClick={() => setShowQuickReplies(true)}
            className="messenger-quick-reply messenger-quick-reply--action"
          >
            <Zap className="w-4 h-4" />
            Schnellantworten
          </button>
        </div>
      );
    }

    return (
      <div className="messenger-quick-replies">
        {mobileQuickReplies.map((reply) => (
          <button
            key={`qr-${reply.id || reply.shortcut}`}
            type="button"
            onClick={() => setMessageInput(reply.content)}
            className="messenger-quick-reply"
          >
            {reply.shortcut || reply.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowQuickReplies(true)}
          className="messenger-quick-reply messenger-quick-reply--action"
        >
          <Zap className="w-4 h-4" />
          Quick
        </button>
      </div>
    );
  };

  const renderMobileContactListView = () => (
    <div className="messenger-mobile-list-view">
      <div className="messenger-mobile-list-header">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400">Team messenger</p>
          <h2>Kontakte</h2>
        </div>
        <button
          type="button"
          className="messenger-mobile-list-add"
          onClick={() => setShowSearch(true)}
        >
          <Plus className="w-4 h-4 text-white" />
          <span>Nachrichten suchen</span>
        </button>
      </div>
      <ContactList
        variant="panel"
        storyEntries={storyEntries}
        storyMap={storiesByUser}
        onStoryOpen={handleStoryOpen}
        storiesLoading={storiesLoading}
      />
    </div>
  );

  const renderMobileChatView = () => (
    <div className="messenger-mobile-chat-mode">
      <div className="messenger-mobile-header-enhanced">
        <button
          className="messenger-mobile-header-enhanced__back"
          onClick={() => setMobileMode('list')}
          aria-label="Zurück zu Kontakten"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="messenger-mobile-header-enhanced__info">
          <h3 className="messenger-mobile-header-enhanced__name">
            {selectedContact?.name || threads.find(t => t.id === selectedThreadId)?.name || 'Chat auswählen'}
          </h3>
          <p className="messenger-mobile-header-enhanced__status">
            {selectedContact
              ? (selectedContact.online ? 'Online' : 'Offline')
              : selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group'
                ? `${groupMembers.length} Mitglieder`
                : 'Gruppe'}
          </p>
        </div>
        <div className="messenger-mobile-header-enhanced__avatar-wrapper">
          <div className={`messenger-mobile-header-enhanced__avatar ${
            !selectedContact && selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group'
              ? 'bg-gradient-to-br from-blue-500 to-purple-600'
              : ''
          }`}>
            {selectedContact
              ? (selectedContact.name?.[0]?.toUpperCase() || '?')
              : selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group'
                ? <Users className="w-5 h-5 text-white" />
                : (user?.name?.[0]?.toUpperCase() || '?')}
          </div>
          {selectedContact && (
            <div className={`messenger-mobile-header-enhanced__status-dot ${selectedContact.online ? 'online' : 'offline'}`}></div>
          )}
        </div>
      </div>
      {(selectedContact || (selectedThreadId && threads.find(t => t.id === selectedThreadId))) && (
        <div className="messenger-mobile-header-actions">
          {selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group' && (
            <button
              type="button"
              onClick={() => setShowMembersModal(true)}
              aria-label="Gruppenmitglieder"
              title="Gruppenmitglieder"
            >
              <Users className="w-5 h-5" />
              <span>Mitglieder</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            aria-label="Nachrichten durchsuchen"
            title="Nachrichten durchsuchen"
          >
            <Search className="w-5 h-5" />
            <span>Suche</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPinnedDrawer(true)}
            disabled={pinnedMessages.length === 0}
            aria-label="Gepinnte Nachrichten"
            title="Gepinnte Nachrichten"
          >
            <Pin className="w-5 h-5" />
            <span>Gepinnt</span>
          </button>
        </div>
      )}
      <div className="messenger-mobile-messages">
        {renderMessages()}
        {Object.entries(typingUsers).map(([userId, data]) => (
          <TypingIndicator key={userId} userName={data.name} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      {replyToMessage && (
        <div className="px-4 py-3 bg-slate-900 text-slate-100 flex items-start gap-3 border-t border-slate-700 border-l-4 border-l-blue-400">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white flex-shrink-0">
            <Reply className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-300 mb-1">
              Antworten auf {replyToMessage.sender_name}
            </p>
            <p className="text-sm line-clamp-2">{replyToMessage.message}</p>
          </div>
          <button
            type="button"
            onClick={cancelReply}
            className="p-2 rounded-full hover:bg-slate-700 transition flex-shrink-0"
            title="Antwort abbrechen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {selectedEvent && (
        <div className="px-4 pb-1">
          <div className="selected-event-preview">
            <div className="icon">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div className="content">
              <p className="title truncate">{selectedEvent.title || 'Kalendereintrag'}</p>
              <p className="time">
                {formatEventDateRange(selectedEvent.start_time, selectedEvent.end_time)}
              </p>
              {selectedEvent.location && (
                <p className="text-xs text-slate-400 mt-1 leading-tight">
                  Ort: {selectedEvent.location}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearSelectedEvent}
              className="remove"
              aria-label="Ereignis entfernen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 bg-slate-900">
          <div className="flex gap-2 overflow-x-auto">
            {pendingAttachments.map((file, idx) => renderAttachmentPreview(file, idx))}
          </div>
        </div>
      )}
      {renderMobileQuickReplies()}
      <form onSubmit={handleSendMessage} className="messenger-mobile-input">
        <div className="flex items-end gap-2 w-full">
          <div className="flex-1">
            <div className="input-wrapper">
              <button
                type="button"
                onClick={toggleComposerActions}
                className={`compose-toggle ${showComposerActions ? 'active' : ''}`}
                aria-label="Aktionen umschalten"
              >
                <Plus className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={handleInputChange}
                placeholder={
                  selectedThreadId && threads.find(t => t.id === selectedThreadId)?.type === 'group'
                    ? "Nachricht... (@BL_Bot für Hilfe)"
                    : "Nachricht schreiben..."
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            {showComposerActions && (
              <div className="composer-actions">
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="w-4 h-4" />
                  Datei
                </button>
                <button type="button" onClick={() => setShowGifPicker((prev) => !prev)}>
                  <ImageIcon className="w-4 h-4" />
                  GIF
                </button>
                <button type="button" onClick={openEventPicker}>
                  <CalendarDays className="w-4 h-4" />
                  Event
                </button>
                <button type="button" onClick={() => setShowQuickReplies(true)}>
                  <Zap className="w-4 h-4" />
                  Quick
                </button>
                <button type="button" onClick={isRecording ? stopRecording : startRecording}>
                  {isRecording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  Audio
                </button>
                {(() => {
                  const currentThread = threads.find(t => t.id === selectedThreadId);
                  const isGroupChat = currentThread?.type === 'group' || currentThread?.conversation_type === 'group';
                  return isGroupChat ? (
                    <button type="button" onClick={handleAskBot}>
                      <Bot className="w-4 h-4" />
                      Bot
                    </button>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0 && !selectedEvent)}
            className="send-btn"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </form>
    </div>
  );

  const renderMobileLayout = () => {
    const isChatMode = mobileMode === 'chat' && (selectedContact || selectedThreadId);

    if (!isChatMode) {
      return (
        <div className="messenger-mobile-container messenger-mobile-list-mode">
          {renderMobileContactListView()}
        </div>
      );
    }

    return (
      <div className="messenger-mobile-container messenger-mobile-chat-mode">
        {renderMobileChatView()}
      </div>
    );
  };

  const renderEventPicker = () => {
    if (!showEventPicker) return null;

    return (
      <div
        className="event-picker-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Kalenderereignis auswählen"
        onClick={() => setShowEventPicker(false)}
      >
        <div className="event-picker-modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>Kalenderereignis teilen</h2>
              <p className="text-sm text-slate-500">Wähle einen Termin, um ihn im Chat zu teilen.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEventPicker(false)}
              className="rounded-xl border border-slate-100 p-2"
              aria-label="Modal schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="modal-body">
            {eventsLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-500">Kalender lädt…</p>
              </div>
            ) : eventOptions.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-10 space-y-1">
                <p>{eventError || 'Keine kommenden Termine gefunden.'}</p>
                <p>Versuche es später erneut.</p>
              </div>
            ) : (
              eventOptions.map((calendarEvent) => (
                <button
                  key={calendarEvent.id || calendarEvent.start_time}
                  type="button"
                  onClick={() => handleEventSelect(calendarEvent)}
                  className="event-picker-item"
                >
                  <div className="icon">
                    <CalendarDays className="w-5 h-5" />
                  </div>
                  <div className="content">
                    <p className="title">{calendarEvent.title || 'Unbenannter Termin'}</p>
                    <p className="time">
                      {formatEventDateRange(calendarEvent.start_time, calendarEvent.end_time)}
                    </p>
                    {calendarEvent.location && (
                      <p className="text-xs text-slate-400 mt-1">Ort: {calendarEvent.location}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowEventPicker(false)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={loadCalendarOptions}
              disabled={eventsLoading}
            >
              Aktualisieren
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderEventPicker()}

      {/* Contact Picker Modal for Event Sharing */}
      {showContactPicker && pendingEventShare && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => {
              setShowContactPicker(false);
              setPendingEventShare(null);
            }}
          />
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Empfänger auswählen</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Event teilen: {pendingEventShare.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowContactPicker(false);
                  setPendingEventShare(null);
                }}
                className="p-2 rounded-full hover:bg-slate-100 transition"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kontakte durchsuchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-2">
              {filteredContacts.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Keine Kontakte gefunden
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleContactSelectForEventShare(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-200 transition"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                      {contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{contact.name}</p>
                      <p className="text-sm text-slate-500 truncate">{contact.email}</p>
                    </div>
                    {contact.online && (
                      <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      {isMobile && showPinnedDrawer && (
        <div className="fixed inset-0 z-[65] bg-slate-900/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Angepinnt
                </p>
                <h3 className="text-xl font-bold text-slate-900">{pinnedMessages.length} Nachrichten</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPinnedDrawer(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition"
                aria-label="Pinned Drawer schließen"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {pinnedMessages.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine angepinnten Nachrichten.</p>
            ) : (
              <div className="space-y-3">
                {pinnedMessages.map((msg) => (
                  <button
                    key={`pinned-${msg.id}`}
                    type="button"
                    onClick={() => {
                      setShowPinnedDrawer(false);
                      highlightMessage(msg.id);
                    }}
                    className="w-full text-left rounded-2xl border border-slate-200 px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span className="font-semibold text-slate-500">
                        {msg.sender_name || (msg.sender_id === user?.id ? 'Du' : 'Kontakt')}
                      </span>
                      {msg.created_at && (
                        <span>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: de })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2 whitespace-pre-wrap">
                      {msg.message || 'Anhänge / Ereignis'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {selectedStory && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div>
              <p className="font-semibold text-lg">{selectedStory.userName}</p>
              {selectedStory.createdAt && (
                <p className="text-xs text-white/70">
                  {formatDistanceToNow(new Date(selectedStory.createdAt), {
                    addSuffix: true,
                    locale: de
                  })}
                </p>
              )}
            </div>
            <button
              onClick={handleStoryClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            {selectedStory.mediaType?.startsWith('video') ? (
              <video
                src={getAssetUrl(selectedStory.mediaUrl)}
                controls
                autoPlay
                className="max-h-[70vh] max-w-full rounded-3xl shadow-2xl"
              />
            ) : (
              <img
                src={getAssetUrl(selectedStory.mediaUrl)}
                alt={selectedStory.caption || 'Story'}
                className="max-h-[70vh] max-w-full rounded-3xl shadow-2xl object-contain"
              />
            )}
          </div>
          {selectedStory.caption && (
            <div className="px-5 pb-4 text-sm text-white/80">
              {selectedStory.caption}
            </div>
          )}
          {stories.length > 1 && (
            <div className="flex items-center justify-between px-5 pb-6">
              <button
                onClick={handleStoryPrev}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Zurück
              </button>
              <button
                onClick={handleStoryNext}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition"
              >
                Weiter
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {showGifPicker && (
        <GifPicker
          onSelectGif={handleSelectGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* Message Search Modal */}
      {showSearch && (
        <MessageSearch
          onClose={() => setShowSearch(false)}
          onMessageSelect={handleMessageSearchSelect}
        />
      )}

      {/* Quick Replies Panel */}
      {showQuickReplies && (
        <QuickRepliesPanel
          onSelect={handleQuickReplySelect}
          onClose={closeQuickReplies}
        />
      )}

      {/* Message Forward Modal */}
      {showForwardModal && messageToForward && (
        <MessageForwardModal
          message={messageToForward}
          onClose={() => {
            setShowForwardModal(false);
            setMessageToForward(null);
          }}
          onSuccess={handleForwardSuccess}
        />
      )}

      {/* Group Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Gruppenmitglieder</h3>
                  <p className="text-sm text-slate-500">{groupMembers.length} Mitglieder</p>
                </div>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {groupMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {member.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      {member.role && (
                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          member.role === 'owner' ? 'bg-amber-500' :
                          member.role === 'moderator' ? 'bg-blue-500' :
                          'bg-slate-400'
                        } text-white border-2 border-white`}>
                          {member.role === 'owner' ? '👑' : member.role === 'moderator' ? '⭐' : '👤'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                        {member.user_id === user?.id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Du</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{member.email}</p>
                      {member.role && (
                        <p className="text-xs text-slate-400 mt-1 capitalize">
                          {member.role === 'owner' ? 'Besitzer' :
                           member.role === 'moderator' ? 'Moderator' :
                           'Mitglied'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMentionSuggestions && mentionSuggestions.length > 0 && (
        <div className="fixed bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-w-xs w-full"
             style={{
               bottom: '120px',
               left: isMobile ? '20px' : 'auto',
               right: isMobile ? '20px' : '400px'
             }}>
          <div className="p-2 space-y-1">
            {mentionSuggestions.map((member) => (
              <button
                key={member.user_id}
                onClick={() => insertMention(member)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {member.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate text-sm">{member.name}</p>
                  <p className="text-xs text-slate-500 truncate">@{member.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Story Composer Modal */}
      {showStoryComposer && (
        <StoryComposer
          userId={user?.id}
          onClose={() => setShowStoryComposer(false)}
          onSuccess={handleStoryCreated}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </>
  );
};

export default DirectMessenger;
