import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  ChevronDown,
  CalendarDays,
  Loader2,
  Smile,
  Reply,
  Plus,
  Pin,
  Zap,
  FileText,
  Forward,
  Bot,
  Keyboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useMobile } from '../hooks/useMobile';
import {
  getAllContacts,
  getConversationThread,
  getConversationMessages,
  sendConversationMessage,
  createConversationThread,
  getMessageThreads,
  addConversationMembers,
  removeConversationMember,
  markConversationAsRead,
  updateConversationThread,
  uploadAttachment,
  deleteMessage,
  getStoriesFeed,
  getQuickReplies,
  markStoryViewed,
  deleteStory,
  linkCalendarToMessage,
  getCalendarEvents,
  addMessageReaction,
  pinMessage,
  getPinnedMessages,
  clearConversation,
  deleteConversation
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
import '../styles/messenger-desktop-fixed.css';
import '../styles/scroll-to-bottom-button.css';
import '../styles/messenger-mobile-hotfix.css';
import '../styles/messenger-scroll-fix.css';
import '../styles/messenger-layout-fix.css';
import '../styles/messenger-mobile-native.css';

const GENERAL_THREAD_NAMES = ['general chat', 'general', 'allgemein', 'allgemeiner chat', 'teamchat'];
const BOT_CONTACT_TEMPLATE = {
  id: 8,
  name: 'BL_Bot',
  email: 'bl_bot@system.local',
  is_bot: true,
  online: true,
  status: 'KI-Assistent'
};
const BOT_FALLBACK_IDS = [BOT_CONTACT_TEMPLATE.id, 999999];
const LONG_PRESS_DELAY = 450;
const LONG_PRESS_MOVE_TOLERANCE = 12;
const LONG_PRESS_MENU_WIDTH = 240;
const LONG_PRESS_MENU_HEIGHT = 300;
const LONG_PRESS_MENU_PADDING = 12;
const LONG_PRESS_VIBRATION_MS = 10;
const MAX_MESSAGE_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const isGeneralThread = (thread) =>
  thread?.type === 'group' &&
  GENERAL_THREAD_NAMES.some((name) => (thread?.name || '').toLowerCase().includes(name));

const isBotContact = (contact) => {
  if (!contact) return false;
  const name = (contact.name || '').toLowerCase();
  const email = (contact.email || '').toLowerCase();
  return Boolean(
    contact.is_bot ||
    BOT_FALLBACK_IDS.includes(contact.id) ||
    name.includes('bot') ||
    email.includes('bot')
  );
};

const normalizeUserId = (value) => {
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) {
    return asNumber;
  }
  return value;
};

const isSameThreadId = (left, right) => normalizeUserId(left) === normalizeUserId(right);

const normalizeStory = (story = {}) => ({
  id: story.id,
  userId: story.user_id ?? story.userId,
  userName: story.user_name ?? story.userName ?? story.name,
  mediaUrl: story.media_url ?? story.mediaUrl,
  mediaType: story.media_type ?? story.mediaType,
  caption: story.caption ?? '',
  createdAt: story.created_at ?? story.createdAt,
  updatedAt: story.updated_at ?? story.updatedAt ?? story.created_at,
  expiresAt: story.expires_at ?? story.expiresAt,
  viewCount: Number(story.view_count ?? story.viewCount ?? 0),
  viewerHasSeen: Boolean(story.viewed_by_me ?? story.viewerHasSeen ?? false),
  profilePhoto: story.profile_photo_url ?? story.profilePhotoUrl ?? story.profilePhoto
});

const DirectMessenger = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isConnected, onConversationEvent, joinConversationRoom, onlineUsers: wsOnlineUsers } = useWebSocketContext();
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
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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
  const [bootstrapDone, setBootstrapDone] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupDraftName, setGroupDraftName] = useState('');
  const [groupDraftDescription, setGroupDraftDescription] = useState('');
  const [groupDraftMemberIds, setGroupDraftMemberIds] = useState([]);
  const [groupDraftSearch, setGroupDraftSearch] = useState('');
  const [groupDraftIncludeBot, setGroupDraftIncludeBot] = useState(true);
  const [groupDraftSaving, setGroupDraftSaving] = useState(false);
  const [groupEditName, setGroupEditName] = useState('');
  const [groupEditDescription, setGroupEditDescription] = useState('');
  const [groupEditSaving, setGroupEditSaving] = useState(false);
  const [groupMembersSaving, setGroupMembersSaving] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupInviteIds, setGroupInviteIds] = useState([]);
  const [voiceMode, setVoiceMode] = useState(false);

  const userNameLookup = useMemo(() => {
    const map = {};
    contacts.forEach((contact) => {
      if (contact?.id) {
        map[contact.id] = contact.name || contact.email || `User ${contact.id}`;
      }
    });
    groupMembers.forEach((member) => {
      const id = member?.user_id ?? member?.id;
      if (id) {
        map[id] = member?.name || member?.user_name || member?.email || map[id];
      }
    });
    if (user?.id) {
      map[user.id] = user.name || map[user.id];
    }
    return map;
  }, [contacts, groupMembers, user]);

  const ensureBotContactExists = useCallback((contactList) => {
    const list = Array.isArray(contactList) ? contactList.filter(Boolean) : [];
    return list;
  }, []);

  const buildContactsFromThreads = useCallback((threadList) => {
    const safeThreads = Array.isArray(threadList) ? threadList : [];
    const byId = new Map();

    safeThreads.forEach((thread) => {
      if (!Array.isArray(thread?.members)) return;
      thread.members.forEach((member) => {
        const userId = normalizeUserId(member?.user_id || member?.id);
        // Exclude current user from contacts
        if (!userId || byId.has(userId) || userId === user?.id) return;
        byId.set(userId, {
          id: userId,
          name: member?.name || member?.email || `Benutzer ${userId}`,
          email: member?.email || '',
          is_bot: member?.is_system_user || isBotContact(member),
          online: member?.online || false
        });
      });
    });

    return Array.from(byId.values());
  }, [user?.id]);

  const mergeContacts = useCallback((primaryList, extraList) => {
    const primary = Array.isArray(primaryList) ? primaryList.filter(Boolean) : [];
    const extras = Array.isArray(extraList) ? extraList.filter(Boolean) : [];
    const map = new Map();

    primary.forEach((contact) => {
      if (!contact?.id) return;
      map.set(contact.id, contact);
    });

    extras.forEach((contact) => {
      if (!contact?.id) return;
      if (!map.has(contact.id)) {
        map.set(contact.id, contact);
      }
    });

    // Ensure bot contact always present
    const withBot = ensureBotContactExists(Array.from(map.values()));
    return withBot;
  }, [ensureBotContactExists]);

  const ensureEssentialThreads = useCallback(async (threadsList, contactList) => {
    const safeThreads = Array.isArray(threadsList) ? threadsList : [];
    const contactsSafe = Array.isArray(contactList) ? contactList.filter(Boolean) : [];
    let updatedThreads = [...safeThreads];

    if (!updatedThreads.some((thread) => isGeneralThread(thread))) {
      try {
        // Get ALL active users for general chat, not just contacts
        const allUsersResponse = await getAllContacts();
        const allUsers = Array.isArray(allUsersResponse?.data)
          ? allUsersResponse.data
          : [];

        // Include current user and all other active users
        const memberIds = allUsers
          .map((u) => u?.id)
          .filter((id) => Boolean(id) && id !== user?.id);

        // Add current user
        if (user?.id) {
          memberIds.push(user.id);
        }

        console.log('Creating General Chat with all users:', memberIds);

        const response = await createConversationThread({
          name: 'Allgemeiner Chat',
          type: 'group',
          description: 'Offener Chat für das gesamte Team',
          memberIds
        });

        if (response?.data) {
          updatedThreads = [normalizeThread(response.data), ...updatedThreads];
        }
      } catch (error) {
        console.error('Error ensuring General Chat exists:', error);
      }
    }

    const hasBotThread = updatedThreads.some(
      (thread) =>
        thread?.is_bot ||
        (thread?.type === 'direct' && (thread?.name || '').toLowerCase().includes('bot'))
    );

    if (!hasBotThread) {
      const botContact = contactsSafe.find((contact) => isBotContact(contact));
      if (botContact?.id) {
        try {
          const botThreadResponse = await createConversationThread({
            name: botContact.name || 'BL_Bot',
            type: 'direct',
            memberIds: [botContact.id],
            is_bot: true
          });

          if (botThreadResponse?.data) {
            updatedThreads = [normalizeThread(botThreadResponse.data), ...updatedThreads];
          }
        } catch (error) {
          console.error('Error ensuring bot thread exists:', error);
        }
      }
    }

    return updatedThreads;
  }, []);

  const pickDefaultThread = useCallback((threadList) => {
    if (!Array.isArray(threadList) || threadList.length === 0) return null;
    const general = threadList.find((thread) => isGeneralThread(thread));
    if (general) return general;
    return threadList[0];
  }, []);

  const fileInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const mobileTextareaRef = useRef(null);
  const desktopTextareaRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressOriginRef = useRef({ x: 0, y: 0 });
  const longPressTargetRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const longPressMenuRef = useRef(null);
  const longPressAnchorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const recordingActiveRef = useRef(false);
  const voicePressActiveRef = useRef(false);
  const uploadCleanupRef = useRef({});
  const lastReadUpdateRef = useRef({});
  const pendingReadTimeoutRef = useRef({});
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
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

  const formatRecordingTime = (seconds) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
    const mins = Math.floor(safe / 60);
    const secs = String(safe % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const buildUploadId = (file, idx) =>
    `${file.name}-${file.size}-${file.lastModified}-${idx}-${Date.now()}`;

  const normalizeReactionUsers = useCallback((users = []) => {
    if (!Array.isArray(users)) return [];
    return users
      .map((userEntry) => {
        if (userEntry && typeof userEntry === 'object') {
          const rawId = userEntry.user_id ?? userEntry.id ?? userEntry.userId;
          const id = typeof rawId === 'string' && Number.isFinite(Number(rawId)) ? Number(rawId) : rawId;
          if (!id) return null;
          return {
            id,
            name: userEntry.user_name ?? userEntry.name ?? userNameLookup[id],
            photo: userEntry.user_photo ?? userEntry.profile_photo ?? userEntry.photo
          };
        }
        if (Number.isInteger(userEntry) || typeof userEntry === 'string') {
          const id = Number(userEntry);
          return Number.isNaN(id) ? null : { id, name: userNameLookup[id] };
        }
        return null;
      })
      .filter(Boolean);
  }, [userNameLookup]);

  const normalizeReactions = useCallback((rawReactions) => {
    const reactions = {};
    if (Array.isArray(rawReactions)) {
      rawReactions.forEach((reaction) => {
        if (!reaction?.emoji) return;
        const users = reaction.users ?? reaction.user_ids ?? reaction.userIds ?? [];
        reactions[reaction.emoji] = normalizeReactionUsers(users);
      });
    } else if (rawReactions && typeof rawReactions === 'object') {
      Object.entries(rawReactions).forEach(([emoji, users]) => {
        reactions[emoji] = normalizeReactionUsers(users);
      });
    }
    return reactions;
  }, [normalizeReactionUsers]);

  const updateUploadQueue = useCallback((id, updater) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updater } : item))
    );
  }, []);

  const removeUploadQueueItem = useCallback((id) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scheduleUploadCleanup = useCallback((id) => {
    if (uploadCleanupRef.current[id]) {
      clearTimeout(uploadCleanupRef.current[id]);
    }
    uploadCleanupRef.current[id] = setTimeout(() => {
      removeUploadQueueItem(id);
      delete uploadCleanupRef.current[id];
    }, 1400);
  }, [removeUploadQueueItem]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      recordingStartedAtRef.current = null;
      return undefined;
    }

    const startedAt = Date.now();
    recordingStartedAtRef.current = startedAt;
    setRecordingSeconds(0);
    const timer = setInterval(() => {
      setRecordingSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 500);

    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => () => {
    Object.values(uploadCleanupRef.current || {}).forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
  }, []);

  useEffect(() => () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.warn('Failed to stop recorder on unmount', error);
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recordingActiveRef.current = false;
  }, []);

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

    const reactions = normalizeReactions(message.reactions);

    return {
      ...message,
      attachments,
      calendar_refs: calendarRefs,
      metadata,
      reactions
    };
  }, [normalizeReactions]);

  const normalizeContact = useCallback((contact) => {
    if (!contact) return contact;
    return {
      ...contact,
      online: Boolean(contact.online ?? contact.is_online ?? false),
      is_bot: Boolean(contact.is_bot || contact.is_system_user || isBotContact(contact))
    };
  }, []);

  const normalizeThreadLastMessage = useCallback((message) => {
    if (!message) return null;
    const content = message.content ?? message.message ?? message.text ?? '';
    const createdAt = message.createdAt ?? message.created_at ?? message.createdAt ?? message.created_at;
    const messageType = message.messageType ?? message.message_type ?? message.type ?? 'text';
    const senderId = message.senderId ?? message.sender_id ?? message.senderId ?? message.sender_id;

    return {
      ...message,
      content,
      createdAt,
      messageType,
      senderId
    };
  }, []);

  const normalizeThread = useCallback((thread) => {
    if (!thread) return thread;
    return {
      ...thread,
      type: thread.type || thread.conversation_type,
      unreadCount: Number(thread.unreadCount ?? thread.unread_count ?? 0),
      participantCount: Number(thread.participantCount ?? thread.participant_count ?? 0),
      members: Array.isArray(thread.members)
        ? thread.members
        : Array.isArray(thread.member_snapshot)
          ? thread.member_snapshot
          : [],
      lastMessage: normalizeThreadLastMessage(thread.lastMessage)
    };
  }, [normalizeThreadLastMessage]);

  const getThreadTimestamp = useCallback((thread) => {
    const last = thread?.lastMessage;
    return last?.createdAt || last?.created_at || thread?.updatedAt || thread?.updated_at || null;
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
        console.log('🔍 [DirectMessenger] Starting to load contacts, threads, and stories...');
        const [contactsRes, threadsRes, storiesRes] = await Promise.all([
          getAllContacts().catch(err => {
            console.error('❌ Error loading contacts:', err);
            return { data: { contacts: [] } };
          }),
          getMessageThreads().catch(err => {
            console.error('❌ Error loading threads:', err);
            return { data: [] };
          }),
          getStoriesFeed().catch(err => {
            console.error('❌ Error loading stories:', err);
            return { data: { stories: [] } };
          })
        ]);
        // Обробка контактів - може бути в data або data.contacts
        const contactsArray = Array.isArray(contactsRes?.data)
          ? contactsRes.data
          : Array.isArray(contactsRes?.data?.contacts)
            ? contactsRes.data.contacts
            : Array.isArray(contactsRes?.data?.data)
              ? contactsRes.data.data
              : [];
        const normalizedContacts = contactsArray.map(normalizeContact);
        // Filter out current user from contacts list
        const contactsWithoutSelf = normalizedContacts.filter(c => c.id !== user?.id);
        const contactsWithBot = ensureBotContactExists(contactsWithoutSelf);
        const rawThreads = Array.isArray(threadsRes?.data) ? threadsRes.data : [];
        const normalizedThreads = rawThreads.map(normalizeThread);
        const threadsWithEssentials = await ensureEssentialThreads(normalizedThreads, contactsWithBot);
        const sanitizedThreads = threadsWithEssentials.map(normalizeThread);
        const threadContacts = buildContactsFromThreads(sanitizedThreads).map(normalizeContact);
        const mergedContacts = mergeContacts(contactsWithBot, threadContacts).map(normalizeContact).filter(c => c.id !== user?.id);

        setContacts(mergedContacts);
        setThreads(sanitizedThreads);
        const rawStories = Array.isArray(storiesRes?.data?.stories)
          ? storiesRes.data.stories
          : Array.isArray(storiesRes?.data)
            ? storiesRes.data
            : [];
        setStories(rawStories.map(normalizeStory));
      } catch (error) {
        console.error('❌ Error loading data:', error);
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
  }, [
    buildContactsFromThreads,
    ensureBotContactExists,
    ensureEssentialThreads,
    mergeContacts,
    normalizeContact,
    normalizeThread
  ]);

  useEffect(() => {
    if (isMobile) {
      setShowSidebar(false);
    } else {
      setShowSidebar(true);
    }
  }, [isMobile]);

  // When arriving from main menu, default to contact list view
  useEffect(() => {
    if (location.pathname.includes('/messages')) {
      if (isMobile) {
        setMobileMode('list');
      }
      setShowSidebar(!isMobile);
    }
  }, [isMobile, location.pathname]);

  // Keep contacts in sync with thread members (fallback when contact API misses users)
  useEffect(() => {
    const extras = buildContactsFromThreads(threads).map(normalizeContact);
    const merged = mergeContacts(contacts, extras).map(normalizeContact).filter(c => c.id !== user?.id);
    const currentIds = new Set(contacts.map((c) => c.id));
    const mergedIds = new Set(merged.map((c) => c.id));
    const hasDiff = currentIds.size !== mergedIds.size || Array.from(mergedIds).some((id) => !currentIds.has(id));
    if (hasDiff) {
      setContacts(merged);
    }
  }, [buildContactsFromThreads, contacts, mergeContacts, normalizeContact, threads, user?.id]);

  // Sync online status from WebSocket to contacts
  useEffect(() => {
    if (!wsOnlineUsers || wsOnlineUsers.length === 0) return;

    const onlineUserIds = new Set(wsOnlineUsers.map(u => u.userId));
    const onlineUserMap = new Map(wsOnlineUsers.map(u => [u.userId, u]));

    setContacts(prevContacts =>
      prevContacts.map(contact => {
        const isOnline = onlineUserIds.has(contact.id);
        const wsUser = onlineUserMap.get(contact.id);

        return {
          ...contact,
          online: isOnline,
          last_seen_at: wsUser?.lastSeen || contact.last_seen_at
        };
      })
    );
  }, [wsOnlineUsers]);

  useEffect(() => {
    setSelectedEvent(null);
  }, [selectedThreadId]);

  useEffect(() => {
    setUnreadCount(0);
    setShowScrollToBottom(false);
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
  }, [messages]);

  const clearThreadUnread = useCallback((threadId) => {
    if (!threadId) return;
    setThreads((prev) =>
      prev.map((thread) =>
        isSameThreadId(thread.id, threadId) ? { ...thread, unreadCount: 0 } : thread
      )
    );
  }, []);

  const markActiveConversationRead = useCallback(async (force = false) => {
    if (!selectedThreadId) return;
    const threadKey = String(selectedThreadId);
    const minIntervalMs = 1200;
    const now = Date.now();
    const lastReadAt = lastReadUpdateRef.current[threadKey] || 0;
    if (!force && now - lastReadAt < minIntervalMs) {
      if (!pendingReadTimeoutRef.current[threadKey]) {
        const delay = Math.max(minIntervalMs - (now - lastReadAt), 300);
        pendingReadTimeoutRef.current[threadKey] = setTimeout(() => {
          delete pendingReadTimeoutRef.current[threadKey];
          lastReadUpdateRef.current[threadKey] = Date.now();
          // API ПЕРЕД clearThreadUnread для уникнення race condition
          markConversationAsRead(selectedThreadId)
            .then(() => clearThreadUnread(selectedThreadId))
            .catch((err) => {
              console.error('❌ Failed to mark conversation as read:', err);
            });
        }, delay);
      }
      return;
    }
    if (pendingReadTimeoutRef.current[threadKey]) {
      clearTimeout(pendingReadTimeoutRef.current[threadKey]);
      delete pendingReadTimeoutRef.current[threadKey];
    }
    lastReadUpdateRef.current[threadKey] = now;
    // API ПЕРЕД clearThreadUnread для уникнення race condition
    try {
      await markConversationAsRead(selectedThreadId);
      clearThreadUnread(selectedThreadId);
    } catch (err) {
      console.error('❌ Failed to mark conversation as read:', err);
      // Не очищаємо локальний state якщо API провалився
    }
  }, [clearThreadUnread, markConversationAsRead, selectedThreadId]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
    setUnreadCount(0);
    markActiveConversationRead(true);
  }, [markActiveConversationRead]);

  useEffect(() => {
    return () => {
      Object.values(pendingReadTimeoutRef.current).forEach((timeoutId) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
      pendingReadTimeoutRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!selectedThreadId || !shouldAutoScrollRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      markActiveConversationRead();
    }
  }, [messages, markActiveConversationRead, selectedThreadId]);

  // Handle scroll detection
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;

    if (!messagesContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < 120;

      shouldAutoScrollRef.current = isNearBottom;
      setShowScrollToBottom(!isNearBottom);
      if (isNearBottom) {
        setUnreadCount(0);
        markActiveConversationRead();
      }
    };

    handleScroll();
    messagesContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => messagesContainer.removeEventListener('scroll', handleScroll);
  }, [isMobile, markActiveConversationRead, selectedThreadId]);

  useEffect(() => {
    if (!selectedThreadId || !isConnected) return;

    joinConversationRoom(selectedThreadId);

    const handleNewMessage = (data) => {
      if (!data?.conversationId || !data?.message) return;

      const normalized = normalizeMessage(data.message);
      const lastMessage = normalizeThreadLastMessage(normalized);
      const isActive = isSameThreadId(data.conversationId, selectedThreadId);
      const senderId = normalized.sender_id ?? normalized.senderId ?? normalized.sender?.id;
      const isOwnMessage = normalizeUserId(senderId) === normalizeUserId(user?.id);
      const container = isActive ? messagesContainerRef.current : null;
      const distanceFromBottom = container
        ? container.scrollHeight - container.scrollTop - container.clientHeight
        : 0;
      const isNearBottom = isActive ? distanceFromBottom < 120 : false;
      if (isActive) {
        shouldAutoScrollRef.current = isNearBottom;
      }

      // Update threads + unread instantly
      setThreads((prev) =>
        prev.map((thread) =>
          isSameThreadId(thread.id, data.conversationId)
            ? {
                ...thread,
                lastMessage,
                unreadCount: (() => {
                  const currentUnread = thread.unreadCount || 0;
                  if (isActive) {
                    if (isNearBottom) return 0;
                    return isOwnMessage ? currentUnread : currentUnread + 1;
                  }
                  return isOwnMessage ? currentUnread : currentUnread + 1;
                })()
              }
            : thread
        )
      );

      if (isActive) {
        setMessages((prev) => {
          if (Array.isArray(prev) && prev.some((m) => m?.id === normalized.id)) {
            return prev;
          }
          return Array.isArray(prev) ? [...prev, normalized] : [normalized];
        });
        if (isNearBottom) {
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        } else {
          setShowScrollToBottom(true);
          if (!isOwnMessage) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      }
    };

    const handleMessageReaction = (data) => {
      if (isSameThreadId(data?.conversationId, selectedThreadId) && data?.messageId) {
        setMessages((prev) =>
          Array.isArray(prev)
            ? prev.map((msg) => {
                if (msg?.id === data.messageId) {
                  const reactions = normalizeReactions(data.reactions);
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
      if (isSameThreadId(data?.conversationId, selectedThreadId) && data?.message) {
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
      if (isSameThreadId(data?.conversationId, selectedThreadId) && data?.userId && data.userId !== user?.id) {
        setTypingUsers(prev => ({
          ...prev,
          [data.userId]: { name: data.userName || 'Benutzer', timestamp: Date.now() }
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
      if (isSameThreadId(data?.conversationId, selectedThreadId) && data?.userId) {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[data.userId];
          return updated;
        });
      }
    };

    const handleMessageRead = (data) => {
      const conversationId = data?.conversationId ?? data?.conversation_id;
      if (!conversationId) return;
      const readId = normalizeUserId(conversationId);
      setThreads(prev => prev.map(thread =>
        normalizeUserId(thread.id) === readId
          ? { ...thread, unreadCount: 0 }
          : thread
      ));
    };

    const handleMembersUpdated = (data) => {
      if (!data?.conversationId) return;
      if (isSameThreadId(data.conversationId, selectedThreadId) && Array.isArray(data.members)) {
        setGroupMembers(data.members);
      }
      setThreads((prev) =>
        prev.map((thread) =>
          isSameThreadId(thread.id, data.conversationId)
            ? {
                ...thread,
                members: Array.isArray(data.members) ? data.members : thread.members,
                participantCount: Array.isArray(data.members)
                  ? Math.max(data.members.length - 1, 0)
                  : thread.participantCount
              }
            : thread
        )
      );
    };

    const handleConversationCreated = (data) => {
      if (!data?.conversation?.id) return;
      const incoming = normalizeThread({
        ...data.conversation,
        members: Array.isArray(data.members) ? data.members : []
      });
      setThreads((prev) => {
        const exists = prev.some((thread) => thread.id === incoming.id);
        if (exists) return prev;
        return [incoming, ...prev];
      });
    };

    const handleConversationUpdated = (data) => {
      if (!data?.conversationId) return;
      const updated = data.conversation || {};
      setThreads((prev) =>
        prev.map((thread) =>
          isSameThreadId(thread.id, data.conversationId)
            ? {
                ...thread,
                name: updated.name ?? thread.name,
                description: updated.description ?? thread.description,
                updatedAt: updated.updatedAt ?? thread.updatedAt
              }
            : thread
        )
      );
      if (isSameThreadId(data.conversationId, selectedThreadId) && Array.isArray(data.members)) {
        setGroupMembers(data.members);
      }
    };

    const handleConversationRemoved = (data) => {
      if (!data?.conversationId) return;
      setThreads((prev) => prev.filter((thread) => !isSameThreadId(thread.id, data.conversationId)));
      if (isSameThreadId(data.conversationId, selectedThreadId)) {
        setSelectedThreadId(null);
        setSelectedContact(null);
        setMessages([]);
        setMobileMode('list');
      }
    };

    const unsubscribeNewMessage = onConversationEvent('new_message', handleNewMessage);
    const unsubscribeReaction = onConversationEvent('message:reaction', handleMessageReaction);
    const unsubscribePin = onConversationEvent('message:pin', handleMessagePin);
    const unsubscribeTyping = onConversationEvent('typing:start', handleUserTyping);
    const unsubscribeStopTyping = onConversationEvent('typing:stop', handleUserStopTyping);
    const unsubscribeMessageRead = onConversationEvent('message:read', handleMessageRead);
    const unsubscribeMembersUpdated = onConversationEvent('conversation:members_updated', handleMembersUpdated);
    const unsubscribeConversationCreated = onConversationEvent('conversation:created', handleConversationCreated);
    const unsubscribeConversationUpdated = onConversationEvent('conversation:updated', handleConversationUpdated);
    const unsubscribeConversationRemoved = onConversationEvent('conversation:removed', handleConversationRemoved);

    return () => {
      unsubscribeNewMessage();
      unsubscribeReaction();
      unsubscribePin();
      unsubscribeTyping();
      unsubscribeStopTyping();
      unsubscribeMessageRead();
      unsubscribeMembersUpdated();
      unsubscribeConversationCreated();
      unsubscribeConversationUpdated();
      unsubscribeConversationRemoved();
    };
  }, [
    isConnected,
    joinConversationRoom,
    markActiveConversationRead,
    normalizeMessage,
    normalizeReactions,
    normalizeThread,
    normalizeThreadLastMessage,
    onConversationEvent,
    scrollToBottom,
    selectedThreadId,
    user
  ]);

  useEffect(() => {
    if (!showMembersModal) {
      setGroupInviteIds([]);
      setGroupMemberSearch('');
    }
  }, [showMembersModal]);

  useEffect(() => {
    if (!isMobile || mobileMode !== 'chat') {
      return undefined;
    }

    const updateInputHeight = () => {
      const element = mobileInputRef.current;
      if (!element) return;
      const { height } = element.getBoundingClientRect();
      document.documentElement.style.setProperty(
        '--messenger-input-height',
        `${Math.ceil(height)}px`
      );
    };

    updateInputHeight();
    window.addEventListener('resize', updateInputHeight);
    return () => {
      window.removeEventListener('resize', updateInputHeight);
    };
  }, [isMobile, mobileMode, showComposerActions, voiceMode]);

  useEffect(() => {
    if (isMobile) {
      if ((selectedThreadId || selectedContact) && !voiceMode) {
        requestAnimationFrame(() => {
          mobileTextareaRef.current?.focus();
        });
      }
    } else if (selectedThreadId || selectedContact) {
      requestAnimationFrame(() => {
        desktopTextareaRef.current?.focus({ preventScroll: true });
      });
    }
  }, [isMobile, selectedThreadId, selectedContact, voiceMode]);

  useEffect(() => {
    if (isMobile && voiceMode) {
      mobileTextareaRef.current?.blur();
    }
  }, [isMobile, voiceMode]);

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

  const refreshGroupDetails = useCallback(async (threadId) => {
    if (!threadId) return;
    try {
      const response = await getConversationThread(threadId);
      const data = response?.data;
      if (data?.members && Array.isArray(data.members)) {
        setGroupMembers(data.members);
      } else {
        setGroupMembers([]);
      }
      if (data?.name !== undefined) {
        setGroupEditName(data.name || '');
      }
      if (data?.description !== undefined) {
        setGroupEditDescription(data.description || '');
      }
    } catch (error) {
      console.error('Error loading group details:', error);
    }
  }, []);

  const handleContactClick = useCallback(async (contact) => {
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
              t.members.some((member) =>
                normalizeUserId(member?.user_id) === normalizeUserId(contact.id)
              )
          )
        : null;

      console.log('[DirectMessenger] Existing thread:', existingThread);

      if (existingThread?.id) {
        console.log('[DirectMessenger] Using existing thread:', existingThread.id);
        setSelectedThreadId(existingThread.id);
        await loadMessages(existingThread.id);
        // DON'T mark as read immediately - wait for user to actually read
        // Mark as read will be called after 2s delay or when scrolled to bottom
        setShowScrollToBottom(false);
      } else {
        console.log('[DirectMessenger] Creating new thread...');
        const response = await createConversationThread({
          name: contact.name || 'Unbekannt',
          type: 'direct',
          memberIds: [normalizeUserId(contact.id)]
        });

        console.log('[DirectMessenger] Create thread response:', response);

        if (response?.data?.id) {
          console.log('[DirectMessenger] Thread created successfully:', response.data.id);
          const normalizedThread = normalizeThread(response.data);
          setSelectedThreadId(normalizedThread.id);
          setMessages([]);
          setThreads((prev) => Array.isArray(prev) ? [...prev, normalizedThread] : [normalizedThread]);
          // Виклик API перед очищенням локального state
          try {
            await markConversationAsRead(normalizedThread.id);
            clearThreadUnread(normalizedThread.id);
          } catch (err) {
            console.error('❌ Failed to mark new thread as read:', err);
          }
        } else {
          throw new Error('Ungültige Antwort vom Server');
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
      const serverMessage = error?.response?.data?.error || error?.message || 'Unbekannter Fehler';
      showError('Chat konnte nicht geöffnet werden: ' + serverMessage);
    }
  }, [clearThreadUnread, isMobile, loadMessages, markConversationAsRead, normalizeThread, threads]);

  // Handler for group chat selection
  const handleGroupChatClick = useCallback(async (groupThread) => {
    if (!groupThread?.id) {
      showError('Gruppenchat nicht gefunden');
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
      // DON'T mark as read immediately - wait for user to actually read
      // Mark as read will be called after 2s delay or when scrolled to bottom
      setShowScrollToBottom(false);

      if (isMobile) {
        setMobileMode('chat');
      }
    } catch (error) {
      console.error('Error opening group chat:', error);
      showError('Gruppenchat konnte nicht geladen werden: ' + (error?.message || 'Unbekannter Fehler'));
    }
  }, [clearThreadUnread, isMobile, joinConversationRoom, loadMessages, markConversationAsRead]);

  // Auto-select a default thread (General or first) once data is ready
  useEffect(() => {
    // On mobile, stay on contact list until user picks a chat
    if (isMobile) return;
    if (bootstrapDone) return;
    if (!Array.isArray(threads) || threads.length === 0) return;
    if (selectedThreadId || selectedContact) return;

    const defaultThread = pickDefaultThread(threads);
    if (!defaultThread) return;

    setBootstrapDone(true);

    if (defaultThread.type === 'group') {
      handleGroupChatClick(defaultThread);
      return;
    }

    const partner =
      Array.isArray(defaultThread.members) &&
      defaultThread.members.find(
        (member) => member?.user_id && member.user_id !== user?.id
      );

    const partnerContact =
      (partner && contacts.find((contact) => contact.id === partner.user_id)) ||
      contacts.find((contact) => isBotContact(contact));

    if (partnerContact) {
      handleContactClick(partnerContact);
    } else if (defaultThread.id) {
      setSelectedThreadId(defaultThread.id);
      loadMessages(defaultThread.id);
    }
  }, [
    bootstrapDone,
    contacts,
    handleContactClick,
    handleGroupChatClick,
    loadMessages,
    pickDefaultThread,
    selectedContact,
    selectedThreadId,
    threads,
    user?.id
  ]);

  // Auto-mark conversation as read after 3 seconds of viewing
  useEffect(() => {
    if (!selectedThreadId) return;

    const timer = setTimeout(async () => {
      try {
        await markConversationAsRead(selectedThreadId);
        clearThreadUnread(selectedThreadId);
        console.log('✅ Auto-marked conversation as read after 3s:', selectedThreadId);
      } catch (err) {
        console.error('❌ Failed to auto-mark as read:', err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [selectedThreadId, markConversationAsRead, clearThreadUnread]);

  // Load members when thread changes to group
  useEffect(() => {
    const currentThread = threads.find((thread) => isSameThreadId(thread.id, selectedThreadId));
    if (currentThread?.type === 'group' && selectedThreadId) {
      refreshGroupDetails(selectedThreadId);
    } else {
      setGroupMembers([]);
      setGroupEditName('');
      setGroupEditDescription('');
    }
    setGroupInviteIds([]);
    setGroupMemberSearch('');
  }, [refreshGroupDetails, selectedThreadId, threads]);

  useEffect(() => {
    if (recordingActiveRef.current && mediaRecorderRef.current?.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.warn('Failed to stop recording on thread change', error);
      }
    }
    recordingActiveRef.current = false;
    voicePressActiveRef.current = false;
    setIsRecording(false);
    setVoiceMode(false);
  }, [selectedThreadId, selectedContact]);

  // Handle input change with @mention detection and typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    if (voiceMode) {
      setVoiceMode(false);
    }

    // Auto-resize textarea on mobile (1 row → 4 rows max, then scroll)
    if (mobileTextareaRef.current && isMobile) {
      const textarea = mobileTextareaRef.current;
      textarea.style.height = 'auto';

      // 1 рядок = 20px, 4 рядки = 80px
      const minHeight = 20;
      const maxHeight = 80;
      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.max(minHeight, Math.min(maxHeight, scrollHeight))}px`;

      // Показуємо overflow тільки коли досягли maxHeight
      if (scrollHeight > maxHeight) {
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.overflowY = 'hidden';
      }
    }

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

      // Check if we're still in mention mode (no space or closing brace after @)
      if (!afterAt.includes(' ') && !afterAt.includes('}')) {
        const query = afterAt.replace(/^\{/, '').toLowerCase();
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
      const mentionName = member.name?.includes(' ') ? `{${member.name}}` : member.name;
      const newText = textBeforeCursor.substring(0, lastAtSymbol) +
                      `@${mentionName} ` +
                      textAfterCursor;
      setMessageInput(newText);
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  // Highlight @mentions in message text
  const highlightMentions = (text, isMine) => {
    if (!text) return text;

    const mentionRegex = /@(\{[^}]+\}|[^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add highlighted mention
      const rawMention = match[1];
      const mentionName = rawMention.startsWith('{') && rawMention.endsWith('}')
        ? rawMention.slice(1, -1)
        : rawMention;
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
    if (voiceMode) {
      setVoiceMode(false);
      voicePressActiveRef.current = false;
    }

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

    const attachmentsWithIds = attachments.map((file, idx) => ({
      file,
      id: buildUploadId(file, idx)
    }));

    if (attachmentsWithIds.length > 0) {
      setUploadQueue(
        attachmentsWithIds.map(({ file, id }) => ({
          id,
          name: file.name,
          progress: 0,
          status: 'uploading'
        }))
      );
    }

    // Optimistic message for instant feedback
    const optimisticId = `tmp-${Date.now()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: user?.id,
      sender_name: user?.name,
      message: trimmed || (eventToShare?.title ? `Kalender: ${eventToShare.title}` : ''),
      created_at: new Date().toISOString(),
      attachments: attachments.map((file, idx) => ({
        id: `tmp-attach-${idx}`,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        url: URL.createObjectURL(file)
      })),
      metadata: eventToShare?.id
        ? { shared_event: eventToShare }
        : undefined,
      status: 'sending'
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    requestAnimationFrame(() => scrollToBottom());

    try {
      let attachmentsData = [];
      if (attachmentsWithIds.length > 0) {
        const uploadResults = await Promise.all(
          attachmentsWithIds.map(async ({ file, id }) => {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('context', 'message');
              formData.append('conversationId', selectedThreadId);
              const res = await uploadAttachment(formData, {
                onUploadProgress: (progressEvent) => {
                  if (!progressEvent.total) return;
                  const progress = Math.min(
                    100,
                    Math.round((progressEvent.loaded / progressEvent.total) * 100)
                  );
                  updateUploadQueue(id, { progress });
                }
              });
              updateUploadQueue(id, { progress: 100, status: 'done' });
              scheduleUploadCleanup(id);
              return { data: res?.data || null, file };
            } catch (err) {
              console.error('Error uploading attachment:', err);
              updateUploadQueue(id, { status: 'error' });
              scheduleUploadCleanup(id);
              return { data: null, file };
            }
          })
        );

        if (uploadResults.some((result) => !result.data)) {
          showError('Einige Anhänge konnten nicht hochgeladen werden');
        }

        attachmentsData = uploadResults
          .filter((result) => result.data)
          .map((result) => {
            const duration = result.file?.__audioDuration;
            if (duration && result.data?.type === 'audio') {
              return { ...result.data, duration };
            }
            return result.data;
          });
      }

      setShowGifPicker(false);

      const messageBody = trimmed || (eventToShare?.title ? `Kalender: ${eventToShare.title}` : '');
      if (!messageBody && attachmentsData.length === 0 && !eventToShare?.id) {
        throw new Error('Keine Anhänge konnten hochgeladen werden');
      }
      const audioDuration = attachmentsWithIds
        .map(({ file }) => file?.__audioDuration || 0)
        .reduce((max, value) => (value > max ? value : max), 0);

      const hasAudioAttachment = attachmentsData.some(
        (att) => att?.type === 'audio' || att?.mimeType?.startsWith('audio/')
      );

      const payload = {
        message: messageBody,
        attachments: attachmentsData,
        messageType: hasAudioAttachment && !messageBody ? 'audio' : undefined
      };

      if (eventToShare?.id) {
        payload.metadata = {
          ...(payload.metadata || {}),
          shared_event: eventToShare
        };
      }

      if (audioDuration) {
        payload.metadata = {
          ...(payload.metadata || {}),
          audio_duration: audioDuration
        };
      }

      if (replyTo?.id) {
        payload.metadata = payload.metadata || {};
        payload.metadata.reply_to = {
          id: replyTo.id,
          message: replyTo.message || '',
          sender_name: replyTo.sender_name || 'Unbekannt'
        };
      }

      if (eventToShare?.id) {
        payload.metadata = payload.metadata || {};
        payload.metadata.shared_event = {
          id: eventToShare.id,
          title: eventToShare.title || 'Ohne Titel',
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
            event_title: eventToShare.title || 'Ohne Titel',
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
                title: eventToShare.title || 'Ohne Titel',
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

      // Replace optimistic with server message; if WS also arrives, dedupe by id
      if (newMessage) {
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== newMessage.id) // drop potential WS duplicate
            .map((msg) => (msg.id === optimisticId ? newMessage : msg))
        );
      } else {
        await loadMessages(selectedThreadId);
      }

      const lastThreadMessage = normalizeThreadLastMessage(newMessage || optimisticMessage);
      setThreads((prev) =>
        prev.map((thread) =>
          isSameThreadId(thread.id, selectedThreadId)
            ? { ...thread, lastMessage: lastThreadMessage, unreadCount: 0 }
            : thread
        )
      );

      setSelectedEvent(null);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMsg =
        error?.response?.data?.error || error?.message || 'Fehler beim Senden';
      showError(errorMsg);
      setMessageInput(inputValue || '');
      setPendingAttachments(Array.isArray(attachments) ? attachments : []);
      setSelectedEvent(eventToShare || null);
      // Revert optimistic message
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
    } finally {
      setSending(false);
    }
  };

  const handleSelectGif = async (gifData) => {
    if (!selectedThreadId) return;
    if (voiceMode) {
      setVoiceMode(false);
    }

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
    if (voiceMode) {
      setVoiceMode(false);
    }
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const availableSlots = Math.max(0, 5 - pendingAttachments.length);
    const accepted = [];
    files.forEach((file) => {
      const isAllowed =
        file.type.startsWith('image/') ||
        file.type.startsWith('audio/') ||
        file.type.startsWith('video/') ||
        allowedTypes.includes(file.type) ||
        (!file.type && ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.gif', '.webm', '.mp4', '.ogg'].some((ext) =>
          file.name?.toLowerCase().endsWith(ext)
        ));
      if (!isAllowed) {
        showError(`"${file.name}" hat ein nicht unterstütztes Format`);
        return;
      }
      if (file.size > MAX_MESSAGE_ATTACHMENT_SIZE) {
        showError(`"${file.name}" ist zu groß (max. 10 MB)`);
        return;
      }
      if (accepted.length < availableSlots) {
        accepted.push(file);
      }
    });
    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
    if (event.target) {
      event.target.value = '';
    }
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
    if (recordingActiveRef.current) {
      return;
    }
    try {
      if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        showError('Audioaufnahme wird von diesem Gerät nicht unterstützt');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4'
      ];
      const selectedType = supportedTypes.find((type) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );
      const recorderOptions = selectedType ? { mimeType: selectedType } : undefined;
      const mediaRecorder = recorderOptions ? new MediaRecorder(stream, recorderOptions) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event?.error || event);
        recordingActiveRef.current = false;
        setIsRecording(false);
      };

      mediaRecorder.onstop = async () => {
        const stoppedAt = Date.now();
        const startedAt = recordingStartedAtRef.current || stoppedAt;
        const durationSeconds = Math.max(1, Math.round((stoppedAt - startedAt) / 1000));
        const resolvedMime = selectedType || 'audio/webm';
        const extension = resolvedMime.includes('ogg')
          ? 'ogg'
          : resolvedMime.includes('mp4')
            ? 'm4a'
            : 'webm';
        if (recordingChunksRef.current.length > 0) {
          const blob = new Blob(recordingChunksRef.current, { type: resolvedMime });
          const file = new File([blob], `voice_${Date.now()}.${extension}`, { type: resolvedMime });
          file.__audioDuration = durationSeconds;
          setPendingAttachments((prev) => [...prev, file]);
          showSuccess('Audioaufnahme hinzugefügt');
        }

        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingActiveRef.current = false;
        setIsRecording(false);
      };

      mediaRecorder.start();
      recordingActiveRef.current = true;
      setIsRecording(true);
    } catch (error) {
      recordingActiveRef.current = false;
      console.error('Error starting recording:', error);
      showError('Mikrofon-Zugriff verweigert');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'inactive') {
      recordingActiveRef.current = false;
      setIsRecording(false);
      return;
    }
    if (recordingActiveRef.current || isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
      recordingActiveRef.current = false;
      setIsRecording(false);
    }
  };

  const handleVoicePressStart = useCallback((event) => {
    if (event?.cancelable) {
      event.preventDefault();
    }
    event?.stopPropagation?.();
    if (voicePressActiveRef.current || recordingActiveRef.current || isRecording) {
      return;
    }
    voicePressActiveRef.current = true;
    startRecording();
  }, [isRecording, startRecording]);

  const handleVoicePressEnd = useCallback((event) => {
    if (event?.cancelable) {
      event.preventDefault();
    }
    event?.stopPropagation?.();
    if (!voicePressActiveRef.current) return;
    voicePressActiveRef.current = false;
    stopRecording();
    setVoiceMode(false);
  }, [stopRecording]);

  const handleVoicePressCancel = useCallback((event) => {
    if (event?.cancelable) {
      event.preventDefault();
    }
    event?.stopPropagation?.();
    if (!voicePressActiveRef.current) return;
    voicePressActiveRef.current = false;
    stopRecording();
    setVoiceMode(false);
  }, [stopRecording]);

  const exitVoiceMode = useCallback(() => {
    voicePressActiveRef.current = false;
    if (recordingActiveRef.current || isRecording) {
      stopRecording();
    }
    setVoiceMode(false);
  }, [isRecording, stopRecording]);

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
        const currentUsers = normalizeReactionUsers(reactions[emoji]);
        const userIds = currentUsers.map((entry) => entry.id);
        if (userIds.includes(user.id)) {
          const filtered = currentUsers.filter((entry) => entry.id !== user.id);
          if (filtered.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = filtered;
          }
        } else {
          reactions[emoji] = [
            ...currentUsers,
            { id: user.id, name: user.name || userNameLookup[user.id], photo: user.profile_photo }
          ];
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
  }, [user, selectedThreadId, loadMessages, normalizeReactionUsers, userNameLookup]);

  const handleReplyTo = useCallback((message) => {
    setReplyToMessage(message);
  }, []);

  // Long press handlers for mobile (movement tolerant + viewport clamped)
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;
  }, []);

  const calculateLongPressMenuPosition = useCallback((target, touchPoint, menuSize) => {
    const width = menuSize?.width || LONG_PRESS_MENU_WIDTH;
    const height = menuSize?.height || LONG_PRESS_MENU_HEIGHT;
    const padding = LONG_PRESS_MENU_PADDING;

    const messageBubble = target?.querySelector?.('.message-bubble');
    const rect = messageBubble?.getBoundingClientRect?.() || target?.getBoundingClientRect?.();
    const centerX = touchPoint?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);

    let y;
    if (rect) {
      const spaceAbove = rect.top - padding;
      const spaceBelow = window.innerHeight - rect.bottom - padding;
      const canOpenAbove = spaceAbove >= height;
      const canOpenBelow = spaceBelow >= height;
      const shouldOpenAbove = canOpenAbove || (!canOpenBelow && spaceAbove >= spaceBelow);

      if (shouldOpenAbove) {
        y = rect.top - height - padding;
      } else {
        y = rect.bottom + padding;
      }
    } else {
      y = (touchPoint?.clientY ?? window.innerHeight / 2) - height / 2;
    }

    const minX = padding + width / 2;
    const maxX = window.innerWidth - padding - width / 2;
    const minY = padding;
    const maxY = window.innerHeight - padding - height;

    return {
      x: Math.min(maxX, Math.max(minX, centerX)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  }, []);

  const openLongPressMenu = useCallback((msg, target, touchPoint) => {
    const position = calculateLongPressMenuPosition(target, touchPoint);
    longPressAnchorRef.current = { target, touchPoint };
    setShowReactionPicker(null);
    setLongPressMenuMessage(msg);
    setLongPressMenuPosition(position);
    longPressTriggeredRef.current = true;
  }, [calculateLongPressMenuPosition]);

  const handleLongPressStart = useCallback((e, msg) => {
    if (!isMobile) return;
    if (e.touches && e.touches.length > 1) return; // ignore multi-touch

    const touch = e.touches?.[0] || e.changedTouches?.[0];
    longPressOriginRef.current = {
      x: touch?.clientX ?? 0,
      y: touch?.clientY ?? 0
    };
    longPressTargetRef.current = e.currentTarget;
    longPressTriggeredRef.current = false;

    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      openLongPressMenu(msg, longPressTargetRef.current, touch);
      longPressTimerRef.current = null;
      if (window?.navigator?.vibrate) {
        try {
          window.navigator.vibrate(LONG_PRESS_VIBRATION_MS);
        } catch (_) {
          // vibration might be blocked - ignore silently
        }
      }
    }, LONG_PRESS_DELAY);
  }, [isMobile, clearLongPressTimer, openLongPressMenu]);

  const handleLongPressMove = useCallback((e) => {
    if (!isMobile) return;
    if (!longPressTimerRef.current) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - longPressOriginRef.current.x;
    const dy = touch.clientY - longPressOriginRef.current.y;
    const distance = Math.hypot(dx, dy);

    if (distance > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }
  }, [isMobile, clearLongPressTimer]);

  const handleLongPressEnd = useCallback(() => {
    if (!longPressTriggeredRef.current) {
      clearLongPressTimer();
    }
    longPressTargetRef.current = null;
  }, [clearLongPressTimer]);

  const handleLongPressCancel = useCallback(() => {
    clearLongPressTimer();
    longPressTargetRef.current = null;
    longPressAnchorRef.current = null;
  }, [clearLongPressTimer]);

  const handleLongPressContextMenu = useCallback((e, msg) => {
    if (!isMobile) return;
    if (longPressMenuMessage?.id === msg.id) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    clearLongPressTimer();
    openLongPressMenu(msg, e.currentTarget, { clientX: e.clientX, clientY: e.clientY });
  }, [isMobile, longPressMenuMessage, clearLongPressTimer, openLongPressMenu]);

  const closeLongPressMenu = useCallback(() => {
    longPressTriggeredRef.current = false;
    setLongPressMenuMessage(null);
    longPressAnchorRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  useEffect(() => {
    if (!longPressMenuMessage) return;
    // After menu is rendered, measure its actual size and reposition precisely near the anchor
    const menuEl = longPressMenuRef.current;
    const anchor = longPressAnchorRef.current;
    if (!menuEl || !anchor?.target) return;

    const reposition = () => {
      const menuRect = menuEl.getBoundingClientRect();
      const nextPosition = calculateLongPressMenuPosition(
        anchor.target,
        anchor.touchPoint,
        { width: menuRect.width, height: menuRect.height }
      );
      setLongPressMenuPosition(nextPosition);
    };

    // Measure after paint to ensure correct size
    const raf = window.requestAnimationFrame(reposition);
    return () => window.cancelAnimationFrame(raf);
  }, [longPressMenuMessage, calculateLongPressMenuPosition]);

  useEffect(() => {
    if (!longPressMenuMessage) return;

    const handleRepositioningEvents = () => {
      closeLongPressMenu();
      clearLongPressTimer();
    };

    window.addEventListener('scroll', handleRepositioningEvents, true);
    window.addEventListener('resize', handleRepositioningEvents);

    return () => {
      window.removeEventListener('scroll', handleRepositioningEvents, true);
      window.removeEventListener('resize', handleRepositioningEvents);
    };
  }, [longPressMenuMessage, closeLongPressMenu, clearLongPressTimer]);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleBackToContacts = useCallback(() => {
    setShowSidebar(true);
    setMobileMode('list');
    setSelectedThreadId(null);
    setSelectedContact(null);
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

      showSuccess(`Termin bereit zum Teilen mit ${contact.name}`);
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

  const handleMessageSearchSelect = useCallback(async (message) => {
    if (!message?.id) return;
    setShowSearch(false);

    const conversationId = message.conversation_id || message.conversationId;
    if (conversationId) {
      const normalizedConversationId = normalizeUserId(conversationId);
      const thread = threads.find((item) => isSameThreadId(item.id, normalizedConversationId));
      if (thread?.type === 'group') {
        setSelectedContact(null);
        await handleGroupChatClick(thread);
      } else {
        const otherUserId = message.sender_id === user?.id ? message.receiver_id : message.sender_id;
        const partner = contacts.find(
          (contact) => normalizeUserId(contact.id) === normalizeUserId(otherUserId)
        );
        if (partner) {
          await handleContactClick(partner);
        } else {
          setSelectedContact(null);
          setSelectedThreadId(normalizedConversationId);
          await loadMessages(normalizedConversationId);
          clearThreadUnread(normalizedConversationId);
          markConversationAsRead(normalizedConversationId).catch(() => {});
        }
      }
      setTimeout(() => highlightMessage(message.id), 200);
      return;
    }

    highlightMessage(message.id);
  }, [
    clearThreadUnread,
    contacts,
    handleContactClick,
    handleGroupChatClick,
    highlightMessage,
    loadMessages,
    markConversationAsRead,
    threads,
    user?.id
  ]);

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
    setShowComposerActions((prev) => {
      const next = !prev;
      if (next) {
        setVoiceMode(false);
      }
      return next;
    });
  }, []);

  const getBotContact = useCallback(() => {
    const fromContacts = contacts.find((contact) => isBotContact(contact));
    if (fromContacts?.id) {
      return fromContacts;
    }
    const fromMembers = groupMembers.find((member) =>
      isBotContact({ ...member, id: member.user_id })
    );
    if (fromMembers?.user_id) {
      return {
        id: fromMembers.user_id,
        name: fromMembers.name || 'BL_Bot',
        email: fromMembers.email || '',
        is_bot: true
      };
    }
    return null;
  }, [contacts, groupMembers]);

  const ensureBotInConversation = useCallback(async () => {
    const bot = getBotContact();
    if (!bot?.id || !selectedThreadId) return bot;
    const isMember = groupMembers.some(
      (member) => normalizeUserId(member.user_id) === normalizeUserId(bot.id)
    );
    if (!isMember) {
      try {
        await addConversationMembers(selectedThreadId, [bot.id]);
        await refreshGroupDetails(selectedThreadId);
      } catch (error) {
        console.error('Error adding bot to conversation:', error);
        showError('BL_Bot konnte nicht zur Gruppe hinzugefügt werden');
      }
    }
    return bot;
  }, [addConversationMembers, getBotContact, groupMembers, refreshGroupDetails, selectedThreadId, showError]);

  const handleAskBot = useCallback(async () => {
    const currentThread = threads.find((thread) => isSameThreadId(thread.id, selectedThreadId));
    const isGroupChat = currentThread?.type === 'group';
    let botProfile = null;

    if (isGroupChat) {
      botProfile = await ensureBotInConversation();
    } else {
      botProfile = getBotContact();
      if (botProfile?.id) {
        await handleContactClick(botProfile);
      }
    }

    if (!botProfile?.id) {
      showError('BL_Bot ist derzeit nicht verfügbar');
      return;
    }

    if (isGroupChat) {
      const botName = botProfile?.name || 'BL_Bot';
      const mentionName = botName.includes(' ') ? `{${botName}}` : botName;
      setMessageInput((prev) => {
        const lastChar = prev.slice(-1);
        const needsSpace = prev && lastChar !== ' ' && lastChar !== '\n';
        return `${prev}${needsSpace ? ' ' : ''}@${mentionName} `;
      });
      setShowComposerActions(false);
      setTimeout(() => {
        const textarea = isMobile ? mobileTextareaRef.current : desktopTextareaRef.current;
        if (textarea) {
          textarea.focus({ preventScroll: true });
          const len = textarea.value.length;
          textarea.setSelectionRange(len, len);
        }
      }, 0);
    }
  }, [ensureBotInConversation, getBotContact, handleContactClick, isMobile, selectedThreadId, threads]);

  const openCreateGroupModal = useCallback(() => {
    setGroupDraftName('');
    setGroupDraftDescription('');
    setGroupDraftMemberIds([]);
    setGroupDraftSearch('');
    setGroupDraftIncludeBot(true);
    setShowCreateGroupModal(true);
  }, []);

  const toggleGroupDraftMember = useCallback((memberId) => {
    setGroupDraftMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  }, []);

  const toggleGroupInviteMember = useCallback((memberId) => {
    setGroupInviteIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const trimmedName = groupDraftName.trim();
    if (!trimmedName) {
      showError('Bitte einen Gruppennamen eingeben');
      return;
    }

    const memberIds = [...groupDraftMemberIds];
    const botProfile = groupDraftIncludeBot ? getBotContact() : null;
    if (botProfile?.id) {
      memberIds.push(botProfile.id);
    }

    if (memberIds.length === 0) {
      showError('Bitte mindestens ein Mitglied auswählen');
      return;
    }

    setGroupDraftSaving(true);
    try {
      const response = await createConversationThread({
        name: trimmedName,
        description: groupDraftDescription.trim() || null,
        type: 'group',
        memberIds
      });

      if (response?.data?.id) {
        const normalizedThread = normalizeThread(response.data);
        setThreads((prev) => [normalizedThread, ...(Array.isArray(prev) ? prev : [])]);
        setSelectedContact(null);
        setSelectedThreadId(normalizedThread.id);
        setMessages([]);
        clearThreadUnread(normalizedThread.id);
        await refreshGroupDetails(normalizedThread.id);
        if (isMobile) {
          setMobileMode('chat');
        }
        setShowCreateGroupModal(false);
        showSuccess('Gruppe erstellt');
      } else {
        throw new Error('Keine Gruppendaten erhalten');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      showError(error?.response?.data?.error || 'Gruppe konnte nicht erstellt werden');
    } finally {
      setGroupDraftSaving(false);
    }
  }, [
    clearThreadUnread,
    createConversationThread,
    getBotContact,
    groupDraftDescription,
    groupDraftIncludeBot,
    groupDraftMemberIds,
    groupDraftName,
    isMobile,
    normalizeThread,
    refreshGroupDetails
  ]);

  const handleUpdateGroupDetails = useCallback(async () => {
    if (!selectedThreadId) return;
    const trimmedName = groupEditName.trim();
    if (!trimmedName) {
      showError('Bitte einen Gruppennamen eingeben');
      return;
    }

    setGroupEditSaving(true);
    try {
      const response = await updateConversationThread(selectedThreadId, {
        name: trimmedName,
        description: groupEditDescription.trim() || null
      });
      const updated = response?.data;
      if (updated) {
        setThreads((prev) =>
          prev.map((thread) =>
            isSameThreadId(thread.id, selectedThreadId)
              ? { ...thread, name: updated.name, description: updated.description }
              : thread
          )
        );
      }
      await refreshGroupDetails(selectedThreadId);
      showSuccess('Gruppe aktualisiert');
    } catch (error) {
      console.error('Error updating group:', error);
      showError(error?.response?.data?.error || 'Gruppe konnte nicht aktualisiert werden');
    } finally {
      setGroupEditSaving(false);
    }
  }, [groupEditDescription, groupEditName, refreshGroupDetails, selectedThreadId, updateConversationThread]);

  const handleAddGroupMembers = useCallback(async () => {
    if (!selectedThreadId || groupInviteIds.length === 0) return;
    setGroupMembersSaving(true);
    try {
      await addConversationMembers(selectedThreadId, groupInviteIds);
      await refreshGroupDetails(selectedThreadId);
      setGroupInviteIds([]);
      showSuccess('Mitglieder hinzugefügt');
    } catch (error) {
      console.error('Error adding members:', error);
      showError(error?.response?.data?.error || 'Mitglieder konnten nicht hinzugefügt werden');
    } finally {
      setGroupMembersSaving(false);
    }
  }, [addConversationMembers, groupInviteIds, refreshGroupDetails, selectedThreadId]);

  const handleRemoveGroupMember = useCallback(async (memberId) => {
    if (!selectedThreadId || !memberId) return;
    setGroupMembersSaving(true);
    try {
      await removeConversationMember(selectedThreadId, memberId);
      await refreshGroupDetails(selectedThreadId);
      showSuccess('Mitglied entfernt');
    } catch (error) {
      console.error('Error removing member:', error);
      showError(error?.response?.data?.error || 'Mitglied konnte nicht entfernt werden');
    } finally {
      setGroupMembersSaving(false);
    }
  }, [refreshGroupDetails, removeConversationMember, selectedThreadId]);

  const handleLeaveGroup = useCallback(async () => {
    if (!selectedThreadId || !user?.id) return;
    setGroupMembersSaving(true);
    try {
      await removeConversationMember(selectedThreadId, user.id);
      setThreads((prev) => prev.filter((thread) => !isSameThreadId(thread.id, selectedThreadId)));
      setSelectedThreadId(null);
      setSelectedContact(null);
      setMessages([]);
      setShowMembersModal(false);
      setMobileMode('list');
      showSuccess('Du hast die Gruppe verlassen');
    } catch (error) {
      console.error('Error leaving group:', error);
      showError(error?.response?.data?.error || 'Gruppe konnte nicht verlassen werden');
    } finally {
      setGroupMembersSaving(false);
    }
  }, [removeConversationMember, selectedThreadId, user?.id]);

  const activeThread = useMemo(
    () => threads.find((thread) => isSameThreadId(thread.id, selectedThreadId)) || null,
    [selectedThreadId, threads]
  );

  const handleDeleteGroup = useCallback(async () => {
    if (!selectedThreadId || !activeThread) return;
    if (user?.role !== 'superadmin') {
      showError('Nur Superadmin kann Gruppen löschen');
      return;
    }
    const name = activeThread.name || 'diese Gruppe';
    const confirmed = window.confirm(
      `Möchtest du die Gruppe "${name}" wirklich löschen? Alle Nachrichten und Mitglieder werden entfernt.`
    );
    if (!confirmed) return;

    setGroupMembersSaving(true);
    try {
      await deleteConversation(selectedThreadId);
      setThreads((prev) => prev.filter((thread) => !isSameThreadId(thread.id, selectedThreadId)));
      setSelectedThreadId(null);
      setSelectedContact(null);
      setMessages([]);
      setShowMembersModal(false);
      setMobileMode('list');
      showSuccess('Gruppe gelöscht');
    } catch (error) {
      console.error('Error deleting group:', error);
      showError(error?.response?.data?.error || 'Gruppe konnte nicht gelöscht werden');
    } finally {
      setGroupMembersSaving(false);
    }
  }, [activeThread, selectedThreadId, user?.role]);

  const handleOpenProfile = useCallback((profileId) => {
    if (!profileId) {
      navigate('/profile/me');
      return;
    }
    navigate(`/profile/${profileId}`);
  }, [navigate]);

  const handleStoryCreated = useCallback(async () => {
    try {
      const storiesRes = await getStoriesFeed();
      const rawStories = Array.isArray(storiesRes?.data?.stories)
        ? storiesRes.data.stories
        : Array.isArray(storiesRes?.data)
          ? storiesRes.data
          : [];
      setStories(rawStories.map(normalizeStory));
    } catch (error) {
      console.error('Error refreshing stories:', error);
    }
  }, []);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredContacts = useMemo(() => {
    if (!normalizedSearchTerm) return contacts;
    return contacts.filter((contact) => {
      const haystack = `${contact.name || ''} ${contact.email || ''} ${contact.status || ''}`.toLowerCase();
      return haystack.includes(normalizedSearchTerm);
    });
  }, [contacts, normalizedSearchTerm]);

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
        ? thread.members.find((member) =>
            member?.user_id &&
            normalizeUserId(member.user_id) !== normalizeUserId(user?.id)
          )
        : null;
      if (partner?.user_id) {
        map[normalizeUserId(partner.user_id)] = thread;
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
        const aGeneral = isGeneralThread(a);
        const bGeneral = isGeneralThread(b);
        if (aGeneral && !bGeneral) return -1;
        if (bGeneral && !aGeneral) return 1;

        // Sort by unread count
        const aUnread = a.unreadCount || 0;
        const bUnread = b.unreadCount || 0;
        if (bUnread !== aUnread) return bUnread - aUnread;

        // Then by last message time
        const aTime = getThreadTimestamp(a);
        const bTime = getThreadTimestamp(b);
        return new Date(bTime) - new Date(aTime);
      });
  }, [getThreadTimestamp, threads]);

  const filteredGroupThreads = useMemo(() => {
    if (!normalizedSearchTerm) return groupThreads;
    return groupThreads.filter((thread) => {
      const haystack = `${thread.name || ''} ${thread.description || ''}`.toLowerCase();
      return haystack.includes(normalizedSearchTerm);
    });
  }, [groupThreads, normalizedSearchTerm]);

  const canManageGroup = useMemo(() => {
    if (!activeThread || activeThread.type !== 'group') return false;
    const role = activeThread.myRole || activeThread.my_role;
    if (role === 'owner' || role === 'moderator') return true;
    return ['admin', 'superadmin'].includes(user?.role);
  }, [activeThread, user?.role]);

  const isSuperadmin = useMemo(() => user?.role === 'superadmin', [user?.role]);

  const decoratedContacts = useMemo(
    () =>
      filteredContacts.map((contact) => {
        const thread = threadMapByContact[contact.id];
        const lastMessage = thread?.lastMessage;
        const timestamp = getThreadTimestamp(thread);
        const messageType = lastMessage?.messageType || lastMessage?.message_type;
        const typeLabel = messageType && messageType !== 'text'
          ? messageType === 'image'
            ? 'Bild'
            : messageType === 'audio'
              ? 'Audio'
              : messageType === 'gif'
                ? 'GIF'
                : messageType.toUpperCase()
          : '';
        return {
          ...contact,
          thread,
          unreadCount: thread?.unreadCount || 0,
          lastMessageSnippet:
            lastMessage?.content ||
            lastMessage?.message ||
            typeLabel ||
            contact.status ||
            'Bereit, direkt zu schreiben',
          lastMessageTime: timestamp,
          lastMessageTimeLabel: formatContactTimestamp(timestamp)
        };
      }),
    [filteredContacts, formatContactTimestamp, getThreadTimestamp, threadMapByContact]
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
      .sort(sortByRecency);
    return {
      unreadContacts: unread,
      remainingContacts: remaining
    };
  }, [decoratedContacts]);

  const groupDraftCandidates = useMemo(() => {
    const searchValue = groupDraftSearch.trim().toLowerCase();
    const candidates = contacts.filter((contact) => !isBotContact(contact));
    if (!searchValue) return candidates;
    return candidates.filter((contact) => {
      const haystack = `${contact.name || ''} ${contact.email || ''}`.toLowerCase();
      return haystack.includes(searchValue);
    });
  }, [contacts, groupDraftSearch]);

  const groupInviteCandidates = useMemo(() => {
    if (!activeThread || activeThread.type !== 'group') return [];
    const memberIds = new Set(groupMembers.map((member) => normalizeUserId(member.user_id)));
    const candidates = contacts.filter(
      (contact) => !memberIds.has(normalizeUserId(contact.id))
    );
    const searchValue = groupMemberSearch.trim().toLowerCase();
    if (!searchValue) return candidates;
    return candidates.filter((contact) => {
      const haystack = `${contact.name || ''} ${contact.email || ''}`.toLowerCase();
      return haystack.includes(searchValue);
    });
  }, [activeThread, contacts, groupMemberSearch, groupMembers]);

  // Get stories for currently selected user
  const selectedUserStories = useMemo(() => {
    if (selectedStoryIndex === null || !stories[selectedStoryIndex]) return [];
    const userId = stories[selectedStoryIndex].userId;
    return stories
      .filter((s) => s.userId === userId)
      .sort(
        (a, b) =>
          new Date(a.createdAt || a.updatedAt || 0).getTime() -
          new Date(b.createdAt || b.updatedAt || 0).getTime()
      );
  }, [stories, selectedStoryIndex]);

  const selectedStory = useMemo(() => {
    if (selectedStoryIndex === null || !stories[selectedStoryIndex]) return null;
    return stories[selectedStoryIndex];
  }, [selectedStoryIndex, stories]);

  const selectedStoryIndexInUserStories = useMemo(() => {
    if (!selectedStory || selectedUserStories.length === 0) return 0;
    const foundIndex = selectedUserStories.findIndex((s) => s.id === selectedStory.id);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [selectedStory, selectedUserStories]);

  const hasPreviousStory = selectedStoryIndex !== null && selectedStoryIndex > 0;
  const hasNextStory = selectedStoryIndex !== null && selectedStoryIndex < stories.length - 1;
  const showStoryNavigation = hasPreviousStory || hasNextStory;

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
    if (selectedStoryIndex === null) return;
    const nextIndex = selectedStoryIndex + 1;
    if (nextIndex >= stories.length) {
      setSelectedStoryIndex(null);
      return;
    }
    setSelectedStoryIndex(nextIndex);
  }, [selectedStoryIndex, stories.length]);

  const handleStoryPrev = useCallback(() => {
    if (selectedStoryIndex === null || selectedStoryIndex <= 0) return;
    setSelectedStoryIndex(selectedStoryIndex - 1);
  }, [selectedStoryIndex]);

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
            index === selectedStoryIndex
              ? { ...story, viewerHasSeen: true, viewCount: (story.viewCount || 0) + 1 }
              : story
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

  const renderUploadQueue = useCallback((className = '') => {
    if (!uploadQueue.length) return null;
    return (
      <div className={`upload-progress ${className}`}>
        {uploadQueue.map((item) => (
          <div key={item.id} className={`upload-progress__item ${item.status || ''}`}>
            <div className="upload-progress__meta">
              <span className="upload-progress__name">{item.name}</span>
              <span className="upload-progress__percent">{item.progress}%</span>
            </div>
            <div className="upload-progress__bar">
              <span className="upload-progress__fill" style={{ width: `${item.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }, [uploadQueue]);

  const renderMessageContent = (msg, isMine) => {
    const baseClassMobile = `message-bubble messenger-bubble messenger-bubble--${isMine ? 'mine' : 'other'} ${isMine ? 'mine' : 'other'}`;
    const baseClassDesktop = `${isMine
      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white'
      : 'bg-white text-slate-900 border border-slate-200'} messenger-bubble messenger-bubble--${isMine ? 'mine' : 'other'}`;

    const isHovered = hoveredMessage === msg.id;
    const isPinned = pinnedMessages.some((m) => m.id === msg.id);
    const isReactionToolbarOpen = showReactionPicker === msg.id;
    const messageTimestamp = msg.created_at
      ? format(parseISO(msg.created_at), 'HH:mm', { locale: de })
      : '';
    const isReadMessage = Boolean(msg.read_status || msg.read);
    const audioAttachment = (msg.attachments || []).find(
      (att) => att?.type === 'audio' || att?.mimeType?.startsWith('audio/')
    );
    const audioDuration = msg.audio_duration || msg.metadata?.audio_duration || audioAttachment?.duration;

    return (
      <div
        className="relative group"
        onMouseEnter={() => setHoveredMessage(msg.id)}
        onMouseLeave={() => setHoveredMessage(null)}
        onTouchStart={(e) => handleLongPressStart(e, msg)}
        onTouchEnd={handleLongPressEnd}
        onTouchMove={handleLongPressMove}
        onTouchCancel={handleLongPressCancel}
        onContextMenu={(e) => handleLongPressContextMenu(e, msg)}
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
          {audioAttachment && audioDuration ? (
            <VoiceMessagePlayer
              audioUrl={audioAttachment.url}
              duration={audioDuration}
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
                if (att.type === 'audio' || att?.mimeType?.startsWith('audio/')) {
                  return (
                    <audio key={`${att.url}-${idx}`} controls src={att.url} className="w-full mt-2" />
                  );
                }
                if (att.type === 'video' || att?.mimeType?.startsWith('video/')) {
                  return (
                    <video
                      key={`${att.url}-${idx}`}
                      controls
                      src={att.url}
                      className="w-full mt-2 rounded-2xl border border-white/10 shadow-lg"
                    />
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
                const reactionUsers = normalizeReactionUsers(userIds);
                const userIdsArray = reactionUsers.map((entry) => entry.id);
                const tooltipNames = reactionUsers
                  .map((entry) => entry.name || userNameLookup[entry.id] || `User ${entry.id}`)
                  .filter(Boolean);
                const tooltipLabel = tooltipNames.join(', ');
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(msg.id, emoji)}
                    className={`reaction-chip inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                      userIdsArray.includes(user?.id)
                        ? 'bg-blue-100 border border-blue-300'
                        : 'bg-slate-100 border border-slate-200'
                    } hover:scale-110 transition-transform`}
                    title={tooltipLabel || 'Reaktionen'}
                    aria-label={`${emoji} (${userIdsArray.length}) ${tooltipLabel}`}
                  >
                    <span>{emoji}</span>
                    <span className="font-semibold">{userIdsArray.length}</span>
                    {tooltipLabel && (
                      <span className="reaction-tooltip">
                        {tooltipLabel}
                      </span>
                    )}
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
              } top-full mt-3 bg-white border-2 border-slate-300 rounded-2xl shadow-2xl p-3 flex gap-3 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200 reaction-picker max-w-[92vw] overflow-x-auto`}
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
        {isMobile && longPressMenuMessage?.id === msg.id && typeof document !== 'undefined' && createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20"
              style={{ zIndex: 400000 }}
              onClick={closeLongPressMenu}
            />
            {/* Context menu */}
            <div
              className="fixed bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              ref={longPressMenuRef}
              style={{
                top: `${longPressMenuPosition.y}px`,
                left: `${longPressMenuPosition.x}px`,
                transform: 'translate(-50%, 0)',
                minWidth: '200px',
                maxWidth: 'calc(100vw - 40px)',
                zIndex: 400100
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
          </>,
          document.body
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
    const humanContacts = contacts.filter((contact) => !isBotContact(contact));
    const totalContacts = humanContacts.length;
    const totalGroups = groupThreads.length;
    const onlineContacts = humanContacts.filter((contact) => contact.online).length;
    const filteredCount = filteredContacts.length;
    const visibleGroups = filteredGroupThreads.length;
    const visibleItems = filteredCount + visibleGroups;
    const summaryLabel = normalizedSearchTerm
      ? `${visibleItems} Treffer · ${onlineContacts} online`
      : `${totalContacts} Kontakte · ${totalGroups} Gruppen · ${onlineContacts} online`;

  const renderContactCard = (contact) => {
    const isSelected = selectedContact?.id === contact.id;
    const contactStory = storyMap?.[contact.id];
    const unreadCount = contact.unreadCount || 0;
    const isBot = contact.is_bot || contact.is_system_user ||
                    contact.email?.includes('bl_bot') ||
                    contact.email?.includes('entsorgungsbot');
    const lastSeenAt = contact.last_seen_at || contact.last_seen;
    const lastSeenText = lastSeenAt ? formatContactTimestamp(lastSeenAt) : '';
    const lastSeenLabel = contact.online
      ? 'Online'
      : lastSeenText
        ? `Zuletzt online ${lastSeenText}`
        : 'Offline';

      return (
        <button
          key={contact.id}
          onClick={() => handleContactClick(contact)}
          className={`contact-card ${isSelected ? 'contact-card--active' : ''} ${isBot ? 'contact-card--bot' : ''}`}
        >
          <div className="relative">
            <div
              className={`contact-card__avatar-ring ${contactStory ? 'has-story' : ''} ${
                contactStory && !contactStory.viewerHasSeen ? 'story-unread' : ''
              } ${isBot ? 'bot-ring' : ''}`}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                handleOpenProfile(contact.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleOpenProfile(contact.id);
                }
              }}
            >
              <div className={`contact-card__avatar ${isBot ? 'bot-avatar' : ''}`}>
                {contact.profile_photo ? (
                  <>
                    <img
                      src={getAssetUrl(contact.profile_photo)}
                      alt={contact.name}
                      className="w-full h-full object-cover rounded-full"
                      style={{ display: 'block' }}
                      onError={(e) => {
                        console.error('Failed to load avatar:', contact.name, getAssetUrl(contact.profile_photo));
                        e.target.style.display = 'none';
                        const fallback = e.target.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="flex items-center justify-center w-full h-full" style={{ display: 'none' }}>
                      {isBot ? (
                        <Bot className="w-5 h-5" />
                      ) : (
                        contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    {isBot ? (
                      <Bot className="w-5 h-5" />
                    ) : (
                      contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Online status indicator */}
            {contact.online && !isBot && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white shadow-sm" />
            )}
            {/* Bot badge */}
            {isBot && (
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            {unreadCount > 0 && (
              <div className="contact-card__badge absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
          <div className="contact-card__body">
            <p className="contact-card__name">
              {contact.name}
            </p>
            <p className="contact-card__last-seen">{lastSeenLabel}</p>
          </div>
        </button>
      );
    };

    // Render group chat card
    const renderGroupChatCard = (groupThread) => {
      const isSelected = selectedThreadId === groupThread.id;
      const unreadCount = groupThread.unreadCount || 0;
      const isGeneral = isGeneralThread(groupThread);
      const displayName = isGeneral ? 'Allgemeiner Chat' : (groupThread.name || 'Gruppenchat');
      const lastMessage = groupThread.lastMessage;
      const timestamp = getThreadTimestamp(groupThread);
      const typeLabel = lastMessage?.messageType && lastMessage.messageType !== 'text'
        ? lastMessage.messageType === 'image'
          ? 'Bild'
          : lastMessage.messageType === 'audio'
            ? 'Audio'
            : lastMessage.messageType === 'gif'
              ? 'GIF'
              : lastMessage.messageType.toUpperCase()
        : '';
      const snippet = lastMessage?.content ||
        lastMessage?.message ||
        typeLabel ||
        groupThread.description ||
        'Gruppenchat';

      return (
        <button
          key={groupThread.id}
          onClick={() => handleGroupChatClick(groupThread)}
          className={`contact-card ${isSelected ? 'contact-card--active' : ''} ${isGeneral ? 'contact-card--general' : ''}`}
        >
          <div className="relative">
            <div className="contact-card__avatar-ring">
              <div className="contact-card__avatar bg-gradient-to-br from-blue-500 to-purple-600">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="contact-card__badge absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
          <div className="contact-card__body">
            <p className="contact-card__name">
              {displayName}
              {isGeneral && <span className="contact-card__pill">Allgemein</span>}
            </p>
            <p className="contact-card__message">{snippet}</p>
            <div className="contact-card__meta">
              {timestamp && (
                <span>{formatContactTimestamp(timestamp)}</span>
              )}
            </div>
          </div>
        </button>
      );
    };

    return (
      <div className={wrapperClass}>
        <div className="contact-list__header">
          <div>
            <p className="contact-list__eyebrow">Team-Messenger</p>
            <h2>Nachrichten im Griff</h2>
            <p className="contact-list__subheader">{summaryLabel}</p>
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

        <div className="contact-list__actions">
          <button
            type="button"
            className="contact-list__action"
            onClick={() => handleOpenProfile()}
          >
            <User className="w-4 h-4" />
            <span>Mein Profil</span>
          </button>
          <button
            type="button"
            className="contact-list__action"
            onClick={openCreateGroupModal}
          >
            <Users className="w-4 h-4" />
            <span>Neue Gruppe</span>
          </button>
          <button
            type="button"
            className="contact-list__action contact-list__action--bot"
            onClick={handleAskBot}
          >
            <Bot className="w-4 h-4" />
            <span>BL_Bot</span>
          </button>
        </div>

        <div className="contact-list__search">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Kontakte und Gruppen suchen"
            aria-label="Kontakte und Gruppen suchen"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="contact-list__stories">
          <div className="contact-list__stories-header">
            <div>
              <p className="contact-list__section-title">Storys</p>
              <p className="contact-list__section-subtitle">Neuigkeiten aus dem Team</p>
            </div>
            <button
              type="button"
              onClick={() => setShowStoryComposer(true)}
              className="story-header-btn"
            >
              <Plus className="w-4 h-4" />
              <span>Story erstellen</span>
            </button>
          </div>
          {storiesLoading || storyEntries.length > 0 ? (
            <div className="contact-list__stories-row">
              {storiesLoading && (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={`story-skeleton-${idx}`} className="story-chip story-chip--skeleton" />
                ))
              )}
              {!storiesLoading && storyEntries.map((story) => {
                const preview = story.mediaUrl ? getAssetUrl(story.mediaUrl) : null;
                const timestamp = story.updatedAt || story.createdAt;
                return (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => onStoryOpen(story.id)}
                    className={`story-chip ${story.viewerHasSeen ? 'seen' : 'new'}`}
                    aria-label={`Story von ${story.userName || 'Team'}${
                      story.viewerHasSeen ? ', bereits gesehen' : ', neu'
                    }`}
                    title={`${story.userName || 'Story'} - ${
                      story.viewerHasSeen ? 'bereits angesehen' : 'neu'
                    }`}
                  >
                    <div
                      className={`story-chip__ring ${story.viewerHasSeen ? 'seen' : 'has-story'}`}
                      aria-hidden="true"
                    >
                      <div className="story-chip__avatar" aria-hidden={!preview}>
                        {preview ? (
                          <img
                            src={preview}
                            alt={`${story.userName || 'Story'} media`}
                            className="story-chip__avatar-img"
                          />
                        ) : (
                          <span>{story.userName?.charAt(0)?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                    </div>
                    <span className="story-chip__name">{story.userName || 'Story'}</span>
                    <small className="story-chip__meta">
                      {timestamp
                        ? formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: de })
                        : 'vor kurzem'}
                    </small>
                  </button>
                );
              })}
              {!storiesLoading && storyEntries.length > 0 && (
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
              )}
            </div>
          ) : (
            <div className="story-empty">
              <p>Noch keine Storys.</p>
              <button type="button" onClick={() => setShowStoryComposer(true)}>
                Erste Story erstellen
              </button>
            </div>
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
              {filteredGroupThreads.length > 0 && (
                <div className="contact-group mb-4">
                  <p className="contact-group__heading flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Gruppen-Chats</span>
                    <span className="ml-auto text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-0.5 rounded-full font-semibold">
                      {filteredGroupThreads.length}
                    </span>
                  </p>
                  <div className="contact-group__grid">
                    {filteredGroupThreads.map(thread => renderGroupChatCard(thread))}
                  </div>
                </div>
              )}

              {/* Divider between groups and contacts */}
              {filteredGroupThreads.length > 0 && decoratedContacts.length > 0 && (
                <div className="border-t border-slate-200 my-4" />
              )}

              {/* Individual Contacts Sections */}
              {decoratedContacts.length === 0 && filteredGroupThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                  <Users className="w-12 h-12" />
                  <p>Keine Unterhaltungen gefunden</p>
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
                        {decoratedContacts.map((contact) => renderContactCard(contact))}
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
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-lg" style={{ height: '100%', maxHeight: '100%', overflow: 'hidden' }}>
      {showSidebar && (
        <ContactList
          variant="panel"
          storyEntries={storyEntries}
          storyMap={storiesByUser}
          onStoryOpen={handleStoryOpen}
          storiesLoading={storiesLoading}
        />
      )}

      <div className="flex-1 flex flex-col bg-white min-h-0 messenger-container" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    <button
                      type="button"
                      className="messenger-desktop-header__avatar-wrapper"
                      onClick={() => handleOpenProfile(selectedContact.id)}
                      aria-label="Profil öffnen"
                    >
                      <div className="messenger-desktop-header__avatar">
                        {selectedContact.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className={`messenger-desktop-header__status ${selectedContact.online ? 'online' : 'offline'}`}></div>
                    </button>
                    <div className="messenger-desktop-header__contact-info">
                      <h3 className="messenger-desktop-header__name">{selectedContact.name}</h3>
                      <p className="messenger-desktop-header__status-text">
                        {selectedContact.online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                ) : selectedThreadId && activeThread ? (
                  <>
                    <button
                      type="button"
                      className="messenger-desktop-header__avatar-wrapper"
                      onClick={() => setShowMembersModal(true)}
                      aria-label="Gruppenverwaltung öffnen"
                    >
                      <div className="messenger-desktop-header__avatar bg-gradient-to-br from-blue-500 to-purple-600">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </button>
                    <div className="messenger-desktop-header__contact-info">
                      <h3 className="messenger-desktop-header__name">
                        {activeThread.name || 'Gruppenchat'}
                      </h3>
                      <p className="messenger-desktop-header__status-text">
                        {groupMembers.length || (activeThread.participantCount ? activeThread.participantCount + 1 : 0)} Mitglieder
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="messenger-desktop-header__actions">
                <button
                  onClick={handleBackToContacts}
                  className="messenger-desktop-header__action-btn"
                  title="Zurück zu Kontakten"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden lg:inline">Kontakte</span>
                </button>
                {activeThread?.type === 'group' && (
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className="messenger-desktop-header__action-btn"
                    title="Gruppe verwalten"
                  >
                    <Users className="w-5 h-5" />
                    <span className="hidden lg:inline">Gruppe</span>
                  </button>
                )}
                {activeThread?.type === 'group' && user?.role === 'superadmin' && (
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Möchten Sie ALLE Nachrichten in "${activeThread.name}" löschen? Dies kann nicht rückgängig gemacht werden!`)) {
                        return;
                      }
                      try {
                        const response = await clearConversation(selectedThreadId);
                        showSuccess(`${response.data.deletedCount} Nachrichten gelöscht`);
                        // Refresh messages
                        await loadMessages();
                      } catch (error) {
                        console.error('Error clearing chat:', error);
                        showError(error.response?.data?.error || 'Fehler beim Löschen der Nachrichten');
                      }
                    }}
                    className="messenger-desktop-header__action-btn"
                    style={{ color: '#dc2626' }}
                    title="Alle Nachrichten löschen (Superadmin)"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="hidden lg:inline">Chat leeren</span>
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
                  onClick={handleAskBot}
                  className="messenger-desktop-header__action-btn"
                  title="BL_Bot öffnen"
                >
                  <Bot className="w-5 h-5" />
                  <span className="hidden lg:inline">BL_Bot</span>
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

            <div className="messenger-messages-container" ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, maxHeight: 'none' }}>
              {renderMessages()}

              {/* Typing Indicators */}
              {Object.entries(typingUsers).map(([userId, data]) => (
                <TypingIndicator key={userId} userName={data.name} />
              ))}

              <div ref={messagesEndRef} />

              {/* Scroll to Bottom Button - Desktop */}
              <button
                type="button"
                onClick={scrollToBottom}
                className={`scroll-to-bottom-btn ${showScrollToBottom ? 'visible' : ''}`}
                aria-label="Zum Ende scrollen"
              >
                <ChevronDown />
                {unreadCount > 0 && (
                  <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="messenger-input-container" style={{ flexShrink: 0, position: 'relative', borderTop: '1px solid #e2e8f0', background: 'white', zIndex: 100 }}>
                {(replyToMessage || selectedEvent || pendingAttachments.length > 0 || uploadQueue.length > 0) && (
                  <div className="messenger-composer-stack">
                    {replyToMessage && (
                      <div className="messenger-composer-stack__item flex items-start gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-50 to-slate-50 text-slate-700 shadow-sm border-l-4 border-blue-500">
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
                      <div className="messenger-composer-stack__item flex items-center gap-3 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 shadow-sm border border-blue-200">
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
                      <div className="messenger-composer-stack__item flex flex-wrap gap-2">
                        {pendingAttachments.map((file, idx) => renderAttachmentPreview(file, idx))}
                      </div>
                    )}
                    {uploadQueue.length > 0 && (
                      <div className="messenger-composer-stack__item">
                        {renderUploadQueue('upload-progress--floating')}
                      </div>
                    )}
                  </div>
                )}

                {isRecording && (
                  <div className="messenger-recording-indicator">
                    <span className="messenger-recording-dot" />
                    <span>Aufnahme läuft</span>
                    <span className="messenger-recording-time">{formatRecordingTime(recordingSeconds)}</span>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="messenger-recording-stop"
                      aria-label="Aufnahme stoppen"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>Stop</span>
                    </button>
                  </div>
                )}


                {/* Plus Button */}
                <button
                  type="button"
                  onClick={toggleComposerActions}
                  className={`messenger-btn-plus ${showComposerActions ? 'active' : ''}`}
                  title="Mehr Optionen"
                >
                  <Plus className="w-5 h-5" />
                </button>

                {/* Composer Actions Menu */}
                {showComposerActions && (
                  <div className="messenger-composer-menu">
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setVoiceMode(false);
                        setShowComposerActions(false);
                      }}
                      className="messenger-composer-menu-item"
                    >
                      <Paperclip />
                      <span>Datei</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGifPicker((prev) => !prev);
                        setVoiceMode(false);
                        setShowComposerActions(false);
                      }}
                      className="messenger-composer-menu-item"
                    >
                      <ImageIcon />
                      <span>GIF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        openEventPicker();
                        setVoiceMode(false);
                        setShowComposerActions(false);
                      }}
                      className="messenger-composer-menu-item"
                    >
                      <CalendarDays />
                      <span>Termin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowQuickReplies(true);
                        setVoiceMode(false);
                        setShowComposerActions(false);
                      }}
                      className="messenger-composer-menu-item"
                    >
                      <Zap />
                      <span>Schnellantworten</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isMobile) {
                          setVoiceMode(true);
                          mobileTextareaRef.current?.blur();
                        } else {
                          isRecording ? stopRecording() : startRecording();
                        }
                        setShowComposerActions(false);
                      }}
                      className="messenger-composer-menu-item"
                    >
                      {isRecording ? <StopCircle /> : <Mic />}
                      <span>Audio</span>
                    </button>
                    {activeThread?.type === 'group' && (
                      <button
                        type="button"
                        onClick={() => {
                          handleAskBot();
                          setVoiceMode(false);
                          setShowComposerActions(false);
                        }}
                        className="messenger-composer-menu-item"
                      >
                        <Bot />
                        <span>BL_Bot</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Input Wrapper */}
                <div
                  className="messenger-input-wrapper"
                  onClick={() => desktopTextareaRef.current?.focus({ preventScroll: true })}
                  style={{ position: 'relative', zIndex: 2 }}
                >
                  <textarea
                    ref={desktopTextareaRef}
                    rows={1}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={
                      activeThread?.type === 'group'
                        ? "Nachricht schreiben... (Tipp: @BL_Bot für Hilfe)"
                        : "Nachricht schreiben..."
                    }
                    className="messenger-text-input"
                    style={{
                      height: 'auto',
                      pointerEvents: 'auto',
                      cursor: 'text',
                      zIndex: 1,
                      color: '#1e293b',
                      backgroundColor: 'transparent',
                      fontSize: '15px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                      lineHeight: '1.5',
                      padding: '12px 16px',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      width: '100%',
                      opacity: 1,
                      WebkitTextFillColor: '#1e293b',
                      caretColor: '#3b82f6'
                    }}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 88) + 'px';
                    }}
                  />

                  {/* Quick Bot Mention for Groups */}
                  {activeThread?.type === 'group' && (
                    <button
                      type="button"
                      onClick={handleAskBot}
                      className="messenger-btn-bot"
                      title="BL_Bot erwähnen"
                    >
                      <Bot />
                      <span>BL_Bot</span>
                    </button>
                  )}
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0 && !selectedEvent)}
                  className="messenger-btn-send"
                  title="Senden"
                >
                  <Send />
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
          Mehr
        </button>
      </div>
    );
  };

  const renderMobileContactListView = () => (
    <div className="messenger-mobile-list-view">
      <div className="messenger-mobile-list-header">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400">Team-Messenger</p>
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
          onClick={() => {
            setMobileMode('list');
            setSelectedThreadId(null);
            setSelectedContact(null);
          }}
          aria-label="Zurück zu Kontakten"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="messenger-mobile-header-enhanced__info">
          <h3 className="messenger-mobile-header-enhanced__name">
            {selectedContact?.name || activeThread?.name || 'Chat auswählen'}
          </h3>
          <p className="messenger-mobile-header-enhanced__status">
            {selectedContact
              ? (selectedContact.online ? 'Online' : 'Offline')
              : activeThread?.type === 'group'
                ? `${groupMembers.length || (activeThread.participantCount ? activeThread.participantCount + 1 : 0)} Mitglieder`
                : 'Gruppe'}
          </p>
        </div>
        <button
          type="button"
          className="messenger-mobile-header-enhanced__avatar-wrapper"
          onClick={() => {
            if (selectedContact?.id) {
              handleOpenProfile(selectedContact.id);
            } else if (activeThread?.type === 'group') {
              setShowMembersModal(true);
            }
          }}
          aria-label="Profil oder Gruppe öffnen"
        >
          <div className={`messenger-mobile-header-enhanced__avatar ${
            !selectedContact && activeThread?.type === 'group'
              ? 'bg-gradient-to-br from-blue-500 to-purple-600'
              : ''
          }`}>
            {selectedContact
              ? (selectedContact.name?.[0]?.toUpperCase() || '?')
              : activeThread?.type === 'group'
                ? <Users className="w-5 h-5 text-white" />
                : (user?.name?.[0]?.toUpperCase() || '?')}
          </div>
          {selectedContact && (
            <div className={`messenger-mobile-header-enhanced__status-dot ${selectedContact.online ? 'online' : 'offline'}`}></div>
          )}
        </button>
      </div>
      {(selectedContact || (selectedThreadId && activeThread)) && (
        <div className="messenger-mobile-header-actions">
          {activeThread?.type === 'group' && (
            <button
              type="button"
              onClick={() => setShowMembersModal(true)}
              aria-label="Gruppenmitglieder"
              title="Gruppeneinstellungen"
            >
              <Users className="w-5 h-5" />
              <span>Gruppe</span>
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
          <button
            type="button"
            onClick={handleAskBot}
            aria-label="BL_Bot öffnen"
            title="BL_Bot öffnen"
          >
            <Bot className="w-5 h-5" />
            <span>BL_Bot</span>
          </button>
        </div>
      )}
      <div className="messenger-mobile-messages" ref={messagesContainerRef}>
        {renderMessages()}
        {Object.entries(typingUsers).map(([userId, data]) => (
          <TypingIndicator key={userId} userName={data.name} />
        ))}
        <div ref={messagesEndRef} />

        {/* Scroll to Bottom Button - Mobile */}
        <button
          type="button"
          onClick={scrollToBottom}
          className={`scroll-to-bottom-btn ${showScrollToBottom ? 'visible' : ''}`}
          aria-label="Zum Ende scrollen"
        >
          <ChevronDown />
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
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
      {uploadQueue.length > 0 && (
        <div className="px-4 pb-2 bg-slate-900">
          {renderUploadQueue('upload-progress--mobile')}
        </div>
      )}
      {isRecording && (
        <div className="messenger-recording-indicator messenger-recording-indicator--mobile">
          <span className="messenger-recording-dot" />
          <span>Aufnahme läuft</span>
          <span className="messenger-recording-time">{formatRecordingTime(recordingSeconds)}</span>
          <button
            type="button"
            onClick={stopRecording}
            className="messenger-recording-stop"
            aria-label="Aufnahme stoppen"
          >
            <StopCircle className="w-4 h-4" />
            <span>Stop</span>
          </button>
        </div>
      )}
      {renderMobileQuickReplies()}
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
        <div className="fixed inset-0 z-[300100] flex items-center justify-center px-4 py-6">
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
                  Termin teilen: {pendingEventShare.title}
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

      {showCreateGroupModal && (
        <div className="group-create-overlay">
          <div className="group-create-modal">
            <div className="group-create-header">
              <div>
                <p className="group-create-eyebrow">Neue Gruppe</p>
                <h3>Team-Chat erstellen</h3>
                <p>Wähle Mitglieder und starte den Chat.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="group-create-close"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="group-create-body">
              <div className="group-create-form">
                <label htmlFor="group-draft-name">Gruppenname</label>
                <input
                  id="group-draft-name"
                  type="text"
                  value={groupDraftName}
                  onChange={(event) => setGroupDraftName(event.target.value)}
                  placeholder="z.B. Laborplanung"
                />
                <label htmlFor="group-draft-description">Beschreibung</label>
                <textarea
                  id="group-draft-description"
                  value={groupDraftDescription}
                  onChange={(event) => setGroupDraftDescription(event.target.value)}
                  placeholder="Worum geht es in der Gruppe?"
                  rows={3}
                />
                <label className="group-create-bot">
                  <input
                    type="checkbox"
                    checked={groupDraftIncludeBot}
                    onChange={(event) => setGroupDraftIncludeBot(event.target.checked)}
                  />
                  <span>BL_Bot direkt hinzufügen</span>
                </label>
              </div>

              <div className="group-create-members">
                <div className="group-create-members__header">
                  <span>Mitglieder auswählen</span>
                  {groupDraftMemberIds.length > 0 && (
                    <em>{groupDraftMemberIds.length} gewählt</em>
                  )}
                </div>
                <div className="group-create-search">
                  <Search className="w-4 h-4" />
                  <input
                    type="text"
                    value={groupDraftSearch}
                    onChange={(event) => setGroupDraftSearch(event.target.value)}
                    placeholder="Kontakte suchen"
                  />
                </div>
                <div className="group-create-list">
                  {groupDraftCandidates.length === 0 ? (
                    <p className="group-create-empty">Keine Kontakte gefunden.</p>
                  ) : (
                    groupDraftCandidates.map((contact) => (
                      <button
                        key={`draft-${contact.id}`}
                        type="button"
                        className={`group-create-member ${
                          groupDraftMemberIds.includes(contact.id) ? 'selected' : ''
                        }`}
                        onClick={() => toggleGroupDraftMember(contact.id)}
                      >
                        <span>{contact.name || contact.email}</span>
                        {groupDraftMemberIds.includes(contact.id) && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="group-create-footer">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="group-create-cancel"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={groupDraftSaving}
                className="group-create-submit"
              >
                {groupDraftSaving ? 'Erstellen…' : 'Gruppe erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isMobile ? renderMobileLayout() : renderDesktopLayout()}

      {/* MOBILE INPUT - ПОЗА messenger-mobile-container для правильного z-index */}
      {isMobile && mobileMode === 'chat' && (selectedContact || selectedThreadId) && (
        <form ref={mobileInputRef} onSubmit={handleSendMessage} className="messenger-input-container messenger-mobile-input">
          {/* Plus Button */}
          <button
            type="button"
            onClick={toggleComposerActions}
            className={`messenger-btn-plus ${showComposerActions ? 'active' : ''}`}
            aria-label="Aktionen umschalten"
          >
            <Plus />
          </button>

          {/* Composer Actions Menu */}
          {showComposerActions && typeof document !== 'undefined' && createPortal(
            <>
              <div
                className="messenger-composer-backdrop"
                onClick={() => setShowComposerActions(false)}
              />
              <div className="messenger-composer-menu">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setVoiceMode(false);
                    setShowComposerActions(false);
                  }}
                  className="messenger-composer-menu-item"
                >
                  <Paperclip />
                  <span>Datei</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGifPicker((prev) => !prev);
                    setVoiceMode(false);
                    setShowComposerActions(false);
                  }}
                  className="messenger-composer-menu-item"
                >
                  <ImageIcon />
                  <span>GIF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openEventPicker();
                    setVoiceMode(false);
                    setShowComposerActions(false);
                  }}
                  className="messenger-composer-menu-item"
                >
                  <CalendarDays />
                  <span>Termin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickReplies(true);
                    setVoiceMode(false);
                    setShowComposerActions(false);
                  }}
                  className="messenger-composer-menu-item"
                >
                  <Zap />
                  <span>Schnellantworten</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceMode(true);
                    mobileTextareaRef.current?.blur();
                    setShowComposerActions(false);
                  }}
                  className="messenger-composer-menu-item"
                >
                  {isRecording ? <StopCircle /> : <Mic />}
                  <span>Audio</span>
                </button>
                {activeThread?.type === 'group' ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleAskBot();
                      setVoiceMode(false);
                      setShowComposerActions(false);
                    }}
                    className="messenger-composer-menu-item"
                  >
                    <Bot />
                    <span>BL_Bot</span>
                  </button>
                ) : null}
              </div>
            </>,
            document.body
          )}

          {/* Input Wrapper */}
          {voiceMode ? (
            <div className="messenger-voice-composer">
              <button
                type="button"
                className="messenger-voice-exit"
                onClick={exitVoiceMode}
                aria-label="Zur Tastatur wechseln"
              >
                <Keyboard className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`messenger-voice-hold ${isRecording ? 'is-recording' : ''}`}
                onPointerDown={handleVoicePressStart}
                onPointerUp={handleVoicePressEnd}
                onPointerLeave={handleVoicePressCancel}
                onPointerCancel={handleVoicePressCancel}
                onTouchStart={handleVoicePressStart}
                onTouchEnd={handleVoicePressEnd}
                aria-label="Gedrückt halten, um aufzunehmen"
              >
                <Mic className="w-5 h-5" />
                <div className="messenger-voice-hold__text">
                  <span className="messenger-voice-hold__title">
                    {isRecording ? 'Aufnahme läuft' : 'Gedrückt halten'}
                  </span>
                  <span className="messenger-voice-hold__subtitle">
                    {isRecording
                      ? `${formatRecordingTime(recordingSeconds)} • Loslassen zum Stoppen`
                      : 'Zum Aufnehmen von Audio'}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div
              className="messenger-input-wrapper"
              onClick={() => mobileTextareaRef.current?.focus()}
            >
              <textarea
                ref={mobileTextareaRef}
                rows={1}
                value={messageInput}
                onChange={handleInputChange}
                placeholder={
                  activeThread?.type === 'group'
                    ? "Nachricht... (@BL_Bot für Hilfe)"
                    : "Nachricht schreiben..."
                }
                onFocus={() => setVoiceMode(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="messenger-text-input"
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px';
                }}
              />

              {/* Quick Bot Mention for Groups */}
              {activeThread?.type === 'group' ? (
                <button
                  type="button"
                  onClick={handleAskBot}
                  className="messenger-btn-bot"
                  title="BL_Bot erwähnen"
                >
                  <Bot />
                  <span>BL_Bot</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Send Button */}
          <button
            type="submit"
            disabled={sending || (!messageInput.trim() && pendingAttachments.length === 0 && !selectedEvent)}
            className="messenger-btn-send"
          >
            <Send />
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
      )}

      {isMobile && showPinnedDrawer && (
        <div className="fixed inset-0 z-[300100] bg-slate-900/70 backdrop-blur-sm flex flex-col justify-end">
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
                aria-label="Gepinnte Nachrichten schließen"
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
      <div className="fixed inset-0 z-[300200] bg-black flex flex-col relative">
          {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/80 to-transparent relative" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0))' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {selectedStory.userName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-bold text-white text-base">{selectedStory.userName}</p>
                  {selectedStory.createdAt && (
                    <p className="text-xs text-white/60">
                      {formatDistanceToNow(new Date(selectedStory.createdAt), {
                        addSuffix: true,
                        locale: de
                      })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedStory.userId === user?.id && (
                  <button
                    onClick={async () => {
                      if (window.confirm('Story löschen?')) {
                        try {
                          await deleteStory(selectedStory.id);
                          setStories(prev => prev.filter(s => s.id !== selectedStory.id));
                          handleStoryClose();
                          showSuccess('Story gelöscht');
                        } catch (err) {
                          console.error('Error deleting story:', err);
                          showError('Fehler beim Löschen');
                        }
                      }
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/80 active:bg-red-600/80 transition-colors relative z-50"
                    type="button"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={handleStoryClose}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 transition-colors relative z-50"
                  type="button"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="story-viewer-extra-close">
              <button
                type="button"
                onClick={handleStoryClose}
                className="story-viewer-close-btn"
              >
                <X className="w-4 h-4" />
                <span>Schließen</span>
              </button>
            </div>

          {/* Progress Bars */}
          {selectedUserStories.length > 1 && (
            <div className="flex gap-1 px-4 pb-2">
              {selectedUserStories.map((_, index) => (
                <div
                  key={index}
                  className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    className={`h-full bg-white transition-all duration-300 ${
                      index < selectedStoryIndexInUserStories
                        ? 'w-full'
                        : index === selectedStoryIndexInUserStories
                        ? 'w-full animate-pulse'
                        : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Media */}
          <div className="flex-1 flex items-center justify-center px-4 relative">
            {/* Tap Areas for Navigation */}
            {showStoryNavigation && (
              <>
                {hasPreviousStory && (
                  <button
                    onClick={handleStoryPrev}
                    className="absolute left-0 top-0 bottom-0 w-1/3 z-10 active:bg-white/10 transition-colors"
                    aria-label="Vorherige Story"
                  />
                )}
                {hasNextStory && (
                  <button
                    onClick={handleStoryNext}
                    className="absolute right-0 top-0 bottom-0 w-1/3 z-10 active:bg-white/10 transition-colors"
                    aria-label="Nächste Story"
                  />
                )}
              </>
            )}

            {selectedStory.mediaType?.startsWith('video') ? (
              <video
                src={getAssetUrl(selectedStory.mediaUrl)}
                controls
                autoPlay
                className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl relative z-20"
              />
            ) : (
              <img
                src={getAssetUrl(selectedStory.mediaUrl)}
                alt={selectedStory.caption || 'Story'}
                className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain relative z-20"
              />
            )}
          </div>

          {/* Caption */}
          {selectedStory.caption && (
            <div className="px-6 py-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white text-center leading-relaxed">
                {selectedStory.caption}
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          {showStoryNavigation && (
            <div
              className="flex items-center justify-between px-4 pb-6 bg-gradient-to-t from-black/60 to-transparent"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0))' }}
            >
              <button
                onClick={handleStoryPrev}
                disabled={!hasPreviousStory}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/20 backdrop-blur-md text-white font-medium active:bg-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Zurück</span>
              </button>
              <div className="text-white/60 text-sm font-medium">
                {selectedStoryIndexInUserStories + 1} / {selectedUserStories.length}
              </div>
              <button
                onClick={handleStoryNext}
                disabled={!hasNextStory}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/20 backdrop-blur-md text-white font-medium active:bg-white/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-sm">Weiter</span>
                <ChevronRight className="w-5 h-5" />
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
          contacts={contacts}
          threads={threads}
          currentConversationId={selectedThreadId}
          currentUserId={user?.id}
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
        <div className="group-settings-overlay">
          <div className="group-settings-modal">
            <div className="group-settings-header">
              <div>
                <p className="group-settings-eyebrow">Gruppeneinstellungen</p>
                <h3>{activeThread?.name || 'Gruppe'}</h3>
                <p>{groupMembers.length} Mitglieder</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="group-settings-close"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="group-settings-body">
              <section className="group-settings-section">
                <div className="group-settings-section__header">
                  <h4>Gruppendetails</h4>
                  {!canManageGroup && <span>Nur Admins</span>}
                </div>
                {canManageGroup ? (
                  <div className="group-settings-form">
                    <label htmlFor="group-name">Gruppenname</label>
                    <input
                      id="group-name"
                      type="text"
                      value={groupEditName}
                      onChange={(event) => setGroupEditName(event.target.value)}
                      placeholder="z.B. Laborplanung"
                    />
                    <label htmlFor="group-description">Beschreibung</label>
                    <textarea
                      id="group-description"
                      value={groupEditDescription}
                      onChange={(event) => setGroupEditDescription(event.target.value)}
                      placeholder="Kurzbeschreibung der Gruppe"
                      rows={3}
                    />
                    <button
                      type="button"
                      onClick={handleUpdateGroupDetails}
                      disabled={groupEditSaving}
                      className="group-settings-save"
                    >
                      {groupEditSaving ? 'Speichern…' : 'Änderungen speichern'}
                    </button>
                  </div>
                ) : (
                  <div className="group-settings-readonly">
                    <p><strong>{groupEditName || activeThread?.name}</strong></p>
                    <p>{groupEditDescription || activeThread?.description || 'Keine Beschreibung hinterlegt.'}</p>
                  </div>
                )}
              </section>

              <section className="group-settings-section">
                <div className="group-settings-section__header">
                  <h4>Mitglieder hinzufügen</h4>
                  {groupInviteIds.length > 0 && (
                    <span>{groupInviteIds.length} ausgewählt</span>
                  )}
                </div>
                {canManageGroup ? (
                  <>
                    <div className="group-settings-search">
                      <Search className="w-4 h-4" />
                      <input
                        type="text"
                        value={groupMemberSearch}
                        onChange={(event) => setGroupMemberSearch(event.target.value)}
                        placeholder="Kontakte suchen"
                      />
                    </div>
                    <div className="group-settings-candidates">
                      {groupInviteCandidates.length === 0 ? (
                        <p className="group-settings-empty">Keine passenden Kontakte gefunden.</p>
                      ) : (
                        groupInviteCandidates.map((contact) => (
                          <button
                            key={`invite-${contact.id}`}
                            type="button"
                            className={`group-settings-candidate ${
                              groupInviteIds.includes(contact.id) ? 'selected' : ''
                            }`}
                            onClick={() => toggleGroupInviteMember(contact.id)}
                          >
                            <span>{contact.name || contact.email}</span>
                            {groupInviteIds.includes(contact.id) && <Check className="w-4 h-4" />}
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddGroupMembers}
                      disabled={groupMembersSaving || groupInviteIds.length === 0}
                      className="group-settings-add"
                    >
                      {groupMembersSaving ? 'Hinzufügen…' : 'Mitglieder hinzufügen'}
                    </button>
                  </>
                ) : (
                  <p className="group-settings-empty">Du kannst keine Mitglieder hinzufügen.</p>
                )}
              </section>

              <section className="group-settings-section">
                <div className="group-settings-section__header">
                  <h4>Mitglieder</h4>
                  <span>{groupMembers.length}</span>
                </div>
                <div className="group-settings-members">
                  {groupMembers.map((member) => {
                    const isSelf = member.user_id === user?.id;
                    const isOwner = member.role === 'owner';
                    const canRemove = canManageGroup && !isOwner && !isSelf;
                    return (
                      <div key={member.user_id} className="group-settings-member">
                        <div
                          className="group-settings-member__avatar"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenProfile(member.user_id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleOpenProfile(member.user_id);
                            }
                          }}
                        >
                          {member.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="group-settings-member__info">
                          <div className="group-settings-member__name">
                            <span>{member.name}</span>
                            {isSelf && <em>Du</em>}
                          </div>
                          <div className="group-settings-member__meta">
                            <span>{member.email}</span>
                            {member.role && (
                              <strong>
                                {member.role === 'owner'
                                  ? 'Besitzer'
                                  : member.role === 'moderator'
                                    ? 'Moderator'
                                    : 'Mitglied'}
                              </strong>
                            )}
                          </div>
                        </div>
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupMember(member.user_id)}
                            className="group-settings-member__remove"
                            disabled={groupMembersSaving}
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {isSuperadmin && activeThread?.type === 'group' && (
                <section className="group-settings-section group-settings-section--danger">
                  <div className="group-settings-section__header">
                    <h4>Superadmin</h4>
                    <span>Gefahr</span>
                  </div>
                  <div className="group-settings-danger">
                    <p>Diese Aktion löscht die Gruppe dauerhaft inklusive aller Nachrichten.</p>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      disabled={groupMembersSaving}
                      className="group-settings-delete"
                    >
                      Gruppe löschen
                    </button>
                  </div>
                </section>
              )}
            </div>

            <div className="group-settings-footer">
              <button
                type="button"
                onClick={handleLeaveGroup}
                disabled={groupMembersSaving}
                className="group-settings-leave"
              >
                Gruppe verlassen
              </button>
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="group-settings-close-btn"
              >
                Schließen
              </button>
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
                  <p className="text-xs text-slate-500 truncate">
                    @{member.name?.includes(' ') ? `{${member.name}}` : member.name}
                  </p>
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
