import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Plus,
  Send,
  Mic,
  Paperclip,
  ImageIcon,
  CalendarDays,
  Bot,
  Search,
  CheckCheck,
  StopCircle,
  X,
  Smile,
  Reply,
  Forward,
  Pin,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { getAssetUrl } from '../utils/media';
import GifPicker from './GifPicker';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import StoryComposer from './StoryComposer';
import MessageSearch from './MessageSearch';
import MessageForwardModal from './MessageForwardModal';
import { showError, showSuccess } from '../utils/toast';

const MobileMessenger = ({
  user,
  contacts,
  threads,
  messages,
  selectedThreadId,
  selectedContact,
  activeThread,
  messageInput,
  sending,
  isRecording,
  pendingAttachments,
  typingUsers,
  showComposerActions,
  setShowComposerActions,
  setSelectedThreadId,
  setSelectedContact,
  setMessageInput,
  handleSendMessage,
  handleContactClick,
  handleThreadSelect,
  handleInputChange,
  fileInputRef,
  mobileTextareaRef,
  messagesEndRef,
  messagesContainerRef,
  setShowGifPicker,
  showGifPicker,
  handleSelectGif,
  openEventPicker,
  showEventPicker,
  setShowEventPicker,
  calendarEvents,
  handleEventSelect,
  startRecording,
  stopRecording,
  handleBotInvoke,
  setShowStoryComposer,
  showStoryComposer,
  handleStoryCreated,
  storiesLoading,
  storyEntries,
  handleFileAttachment,
  handleLongPressStart,
  handleLongPressEnd,
  handleLongPressMove,
  handleLongPressCancel,
  handleLongPressContextMenu,
  longPressMenuMessage,
  closeLongPressMenu,
  longPressMenuCoords,
  handleReaction,
  handleForward,
  handleReply,
  handleDelete,
  handlePin,
  pinnedMessages,
  replyToMessage,
  setReplyToMessage,
  selectedEvent,
  setSelectedEvent,
  handleMessageSearchSelect,
  onShowGroupInfo,
  onCreateGroup
}) => {
  const navigate = useNavigate();
  const [mobileMode, setMobileMode] = useState('list'); // 'list' or 'chat'
  const [showReactionPicker, setShowReactionPicker] = useState(null); // message id
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);

  // v13.1.0 - Mobile Complete Unification

  // Common emojis for reactions
  const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '✅'];

  // Format time for messages
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return format(date, 'HH:mm');
      } else if (diffDays === 1) {
        return 'Gestern';
      } else if (diffDays < 7) {
        return format(date, 'EEEE');
      } else {
        return format(date, 'dd.MM.yy');
      }
    } catch {
      return '';
    }
  };

  const formatLastSeenLabel = (contact) => {
    if (!contact) return '';
    if (contact.online) return 'Online jetzt';
    const lastSeen = contact.last_seen || contact.last_seen_at;
    if (!lastSeen) return 'Zuletzt online';
    return `Zuletzt online ${formatMessageTime(lastSeen)}`;
  };

  // Format event date range
  const formatEventDateRange = (start, end) => {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    if (!startDate || isNaN(startDate.getTime())) {
      return 'Unbekannter Zeitraum';
    }

    const startLabel = format(startDate, 'dd.MM.yyyy HH:mm', { locale: de });

    if (!endDate || isNaN(endDate.getTime())) {
      return startLabel;
    }

    const sameDay =
      format(startDate, 'dd.MM.yyyy', { locale: de }) === format(endDate, 'dd.MM.yyyy', { locale: de });

    return sameDay
      ? `${format(startDate, 'dd.MM.yyyy HH:mm', { locale: de })} - ${format(endDate, 'HH:mm', { locale: de })}`
      : `${format(startDate, 'dd.MM.yyyy HH:mm', { locale: de })} - ${format(endDate, 'dd.MM.yyyy HH:mm', { locale: de })}`;
  };

  // Switch to chat mode when thread selected
  useEffect(() => {
    if (selectedThreadId || selectedContact) {
      setMobileMode('chat');
    }
  }, [selectedThreadId, selectedContact]);

  // Render contact list view
  const renderContactList = () => {
    const contactMap = new Map();
    const contactSource = Array.isArray(contacts) ? contacts : [];

    contactSource.forEach((contact) => {
      if (!contact?.id || contact.id === user?.id) return;
      contactMap.set(contact.id, contact);
    });

    if (Array.isArray(threads)) {
      threads.forEach((thread) => {
        const members = Array.isArray(thread.members) ? thread.members : [];
        members.forEach((member) => {
          const memberId = member.id || member.user_id;
          if (!memberId || memberId === user?.id || contactMap.has(memberId)) return;
          contactMap.set(memberId, {
            id: memberId,
            name: member.name || member.user_name || member.username || member.email || 'Kontakt',
            email: member.email,
            profile_photo: member.profile_photo || member.profile_photo_url,
            profile_photo_url: member.profile_photo_url,
            online: member.online,
            last_seen: member.last_seen,
            last_seen_at: member.last_seen_at
          });
        });
      });
    }

    const filteredContacts = Array.from(contactMap.values());

    // Filter and sort threads - exclude self-chats
    const sortedThreads = [...threads]
      .filter(thread => {
        // Exclude threads where all members are the current user
        const members = thread.members || [];
        if (members.length === 0) return true; // Keep if no members info
        const otherMembers = members.filter(m => {
          const memberId = m.id || m.user_id;
          return memberId !== user?.id;
        });
        return otherMembers.length > 0; // Only show if there are other members
      })
      .sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

    return (
      <div className="mobile-messenger-list">
        {/* Header */}
        <div className="mobile-messenger-header">
          <h1 className="mobile-messenger-title">Chats</h1>
          <div className="mobile-messenger-actions">
            <button
              className="mobile-messenger-icon-btn"
              onClick={() => setShowSearchModal(true)}
              aria-label="Nachrichten durchsuchen"
            >
              <Search size={20} />
            </button>
            <button
              className="mobile-messenger-icon-btn"
              onClick={() => onCreateGroup && onCreateGroup()}
              aria-label="Neue Gruppe erstellen"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Stories Section */}
        <div className="mobile-messenger-stories">
          <div className="mobile-messenger-stories-label">PINNED</div>
          <div className="mobile-messenger-stories-scroll">
            {/* Add Story */}
            <div
              className="mobile-messenger-story"
              onClick={() => setShowStoryComposer(true)}
            >
              <div className="mobile-messenger-story-avatar add">
                <div className="mobile-messenger-story-plus">+</div>
              </div>
              <div className="mobile-messenger-story-name">Add</div>
            </div>

            {/* Contacts Stories */}
            {filteredContacts.slice(0, 6).map(contact => {
              const hasStory = storyEntries?.some(s => s.user_id === contact.id);

              return (
                <div
                  key={contact.id}
                  className="mobile-messenger-story"
                  onClick={() => {
                    handleContactClick(contact);
                    setMobileMode('chat');
                  }}
                >
                  <div className={`mobile-messenger-story-avatar ${hasStory ? 'has-story' : ''}`}>
                  {contact.profile_photo || contact.profile_photo_url ? (
                    <img
                      src={getAssetUrl(contact.profile_photo || contact.profile_photo_url)}
                      alt={contact.name}
                      className="mobile-messenger-story-img"
                    />
                  ) : (
                    <div className="mobile-messenger-story-initials">
                      {contact.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className="mobile-messenger-story-name">
                  {contact.name?.split(' ')[0]}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Chat List */}
        <div className="mobile-messenger-chats">
          <div className="mobile-messenger-section-title">Your Messages</div>

          {sortedThreads.length === 0 ? (
            <div className="mobile-messenger-empty">
              Keine Unterhaltungen
            </div>
          ) : (
            sortedThreads.map(thread => {
              const threadMessages = messages.filter(m => m.thread_id === thread.id);
              const lastMessage = threadMessages[threadMessages.length - 1];
              const unreadCount = thread.unread_count || 0;
              const lastMessageTime =
                lastMessage?.created_at ||
                lastMessage?.createdAt ||
                thread.updated_at ||
                thread.updatedAt ||
                thread.created_at ||
                thread.createdAt;

              // Get contact for direct chat
              const contactForThread = filteredContacts.find(c =>
                thread.type === 'direct' &&
                thread.members?.some(m => (m.id === c.id || m.user_id === c.id))
              );

              return (
                <div
                  key={thread.id}
                  className="mobile-messenger-chat-item"
                  onClick={() => {
                    handleThreadSelect(thread);
                    setMobileMode('chat');
                  }}
                >
                  <div
                    className="mobile-messenger-chat-avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (contactForThread?.id) {
                        navigate(`/profile/${contactForThread.id}`);
                      }
                    }}
                  >
                    {contactForThread?.profile_photo || contactForThread?.profile_photo_url ? (
                      <img
                        src={getAssetUrl(contactForThread.profile_photo || contactForThread.profile_photo_url)}
                        alt=""
                        className="mobile-messenger-chat-avatar-img"
                      />
                    ) : (
                      <div className="mobile-messenger-chat-avatar-initials">
                        {thread.name?.[0]?.toUpperCase() || contactForThread?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {contactForThread?.online && (
                      <div className="mobile-messenger-chat-online" />
                    )}
                  </div>

                  <div className="mobile-messenger-chat-content">
                    <div className="mobile-messenger-chat-header">
                      <div className="mobile-messenger-chat-name">
                        {thread.type === 'direct' ? (contactForThread?.name || thread.name || 'Unbenannt') : (thread.name || 'Gruppenchat')}
                      </div>
                      <div className="mobile-messenger-chat-time">
                        {lastMessageTime ? formatMessageTime(lastMessageTime) : ''}
                      </div>
                    </div>

                    <div className="mobile-messenger-chat-message">
                      {lastMessage?.sender_id === user?.id && (
                        <CheckCheck size={16} className="mobile-messenger-chat-status" />
                      )}
                      {thread.type === 'direct' && contactForThread?.online && !lastMessage && (
                        <span className="mobile-messenger-chat-pill">Online</span>
                      )}
                      <div
                        className="mobile-messenger-chat-text"
                        data-status={!lastMessage && thread.type === 'direct' ? 'presence' : undefined}
                        data-online={!lastMessage && thread.type === 'direct' ? (contactForThread?.online ? 'true' : 'false') : undefined}
                      >
                        {lastMessage?.message ||
                          lastMessage?.content ||
                          (thread.type === 'direct'
                            ? formatLastSeenLabel(contactForThread)
                            : (thread.description || 'Letzte Nachricht anzeigen'))}
                      </div>
                      {unreadCount > 0 && (
                        <div className="mobile-messenger-chat-unread">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {filteredContacts.length > 0 && (
            <>
              <div className="mobile-messenger-section-title">Kontakte</div>
              {filteredContacts.map((contact) => (
                <div
                  key={`contact-${contact.id}`}
                  className="mobile-messenger-chat-item"
                  onClick={() => {
                    handleContactClick(contact);
                    setMobileMode('chat');
                  }}
                >
                  <div
                    className="mobile-messenger-chat-avatar"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${contact.id}`);
                    }}
                  >
                    {contact.profile_photo || contact.profile_photo_url ? (
                      <img
                        src={getAssetUrl(contact.profile_photo || contact.profile_photo_url)}
                        alt=""
                        className="mobile-messenger-chat-avatar-img"
                      />
                    ) : (
                      <div className="mobile-messenger-chat-avatar-initials">
                        {contact.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {contact.online && (
                      <div className="mobile-messenger-chat-online" />
                    )}
                  </div>

                  <div className="mobile-messenger-chat-content">
                    <div className="mobile-messenger-chat-header">
                      <div className="mobile-messenger-chat-name">
                        {contact.name || 'Kontakt'}
                      </div>
                    </div>
                    <div className="mobile-messenger-chat-message">
                      <div
                        className="mobile-messenger-chat-text"
                        data-status="presence"
                        data-online={contact.online ? 'true' : 'false'}
                      >
                        {formatLastSeenLabel(contact)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="mobile-messenger-bottom-nav">
          <button className="mobile-messenger-nav-item active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
            <span>Chats</span>
          </button>
          <button className="mobile-messenger-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
            <span>Calls</span>
          </button>
          <button className="mobile-messenger-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            <span>Groups</span>
          </button>
          <button className="mobile-messenger-nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span>More</span>
          </button>
        </div>
      </div>
    );
  };

  // Render chat view
  const renderChatView = () => {
    const threadId = selectedThreadId || activeThread?.id;
    const currentMessages = messages.filter(m =>
      m.thread_id === threadId || m.conversation_id === threadId
    );

    // Get contact info
    const contactForHeader = selectedContact || (
      activeThread?.type === 'direct' &&
      contacts.find(c =>
        activeThread.members?.some(m =>
          (m.id === c.id || m.user_id === c.id) && c.id !== user?.id
        )
      )
    );

    const displayName = contactForHeader?.name || activeThread?.name || 'Chat';
    const isOnline = contactForHeader?.online || false;

    return (
      <div className="mobile-messenger-chat">
        {/* Header */}
        <div className="mobile-messenger-chat-header">
          <button
            className="mobile-messenger-chat-back"
            onClick={() => {
              setMobileMode('list');
              setSelectedThreadId(null);
              setSelectedContact(null);
            }}
          >
            <ChevronLeft size={24} />
          </button>

          <button
            className="mobile-messenger-chat-avatar-header"
            onClick={() => {
              if (activeThread?.type === 'group' && onShowGroupInfo) {
                onShowGroupInfo();
              } else if (contactForHeader?.id) {
                navigate(`/profile/${contactForHeader.id}`);
              }
            }}
          >
            {contactForHeader?.profile_photo || contactForHeader?.profile_photo_url ? (
              <img
                src={getAssetUrl(contactForHeader.profile_photo || contactForHeader.profile_photo_url)}
                alt={displayName}
                className="mobile-messenger-chat-avatar-img"
              />
            ) : (
              <div className="mobile-messenger-chat-avatar-initials">
                {displayName?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </button>

          <button
            type="button"
            className="mobile-messenger-chat-info text-left"
            onClick={() => {
              if (activeThread?.type === 'group' && onShowGroupInfo) {
                onShowGroupInfo();
              }
            }}
            disabled={activeThread?.type !== 'group'}
          >
            <div className="mobile-messenger-chat-name">{displayName}</div>
            <div className={`mobile-messenger-chat-status ${isOnline && activeThread?.type !== 'group' ? 'online' : ''}`}>
              {activeThread?.type === 'group'
                ? `${activeThread.members?.length || 0} Mitglieder`
                : isOnline
                  ? 'Online'
                  : (contactForHeader?.last_seen || contactForHeader?.last_seen_at)
                    ? `Zuletzt online ${formatMessageTime(contactForHeader.last_seen || contactForHeader.last_seen_at)}`
                    : 'Zuletzt online'
              }
            </div>
          </button>

          <button
            className="mobile-messenger-chat-search"
            onClick={() => setShowSearchModal(true)}
          >
            <Search size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="mobile-messenger-messages" ref={messagesContainerRef}>
          {currentMessages.length === 0 ? (
            <div className="mobile-messenger-empty-chat">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <p>Keine Nachrichten</p>
              <p className="sub">Beginnen Sie eine neue Unterhaltung</p>
            </div>
          ) : (
            currentMessages.map((message) => {
              const isMine = message.sender_id === user?.id;
              const isPinned = pinnedMessages?.some(p => p.id === message.id);

              return (
                <div
                  key={message.id}
                  className={`mobile-messenger-message ${isMine ? 'mine' : 'other'} ${isPinned ? 'pinned' : ''}`}
                  onTouchStart={(e) => handleLongPressStart(e, message)}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressMove}
                  onTouchCancel={handleLongPressCancel}
                  onContextMenu={(e) => handleLongPressContextMenu(e, message)}
                >
                  <div className="mobile-messenger-message-bubble">
                    {/* Pinned indicator */}
                    {isPinned && (
                      <div className="mobile-messenger-message-pinned-badge">
                        <Pin size={12} />
                      </div>
                    )}

                    {/* Image attachments */}
                    {message.attachments?.length > 0 && message.attachments[0].type?.startsWith('image/') ? (
                      <div className="mobile-messenger-message-image">
                        <img src={getAssetUrl(message.attachments[0].url)} alt="" />
                      </div>
                    ) : null}

                    {/* Audio attachments */}
                    {message.attachments?.some(a => a.type === 'audio' || a.mimeType?.startsWith('audio/') || a.type?.startsWith('audio/')) && (
                      <div className="mobile-messenger-message-audio">
                        <VoiceMessagePlayer
                          audioUrl={getAssetUrl(
                            message.attachments.find(a => a.type === 'audio' || a.mimeType?.startsWith('audio/') || a.type?.startsWith('audio/')).url
                          )}
                          duration={message.audio_duration || message.metadata?.audio_duration}
                        />
                      </div>
                    )}

                    {/* GIF content */}
                    {(message.message_type === 'gif' ||
                      (message.message && (message.message.includes('giphy.com') || message.message.includes('tenor.com') || message.message.match(/\.(gif|webp)(\?|$)/i))) ||
                      (message.content && (message.content.includes('giphy.com') || message.content.includes('tenor.com') || message.content.match(/\.(gif|webp)(\?|$)/i)))) ? (
                      <img
                        src={message.message || message.content}
                        alt="GIF"
                        loading="lazy"
                        className="rounded-xl w-full h-auto max-h-[280px] object-contain"
                      />
                    ) : null}

                    {/* Text content */}
                    {(message.message || message.content) &&
                     message.message_type !== 'gif' &&
                     !(message.message && (message.message.includes('giphy.com') || message.message.includes('tenor.com') || message.message.match(/\.(gif|webp)(\?|$)/i))) &&
                     !(message.content && (message.content.includes('giphy.com') || message.content.includes('tenor.com') || message.content.match(/\.(gif|webp)(\?|$)/i))) ? (
                      <>
                        {/* Reply quote */}
                        {message.reply_to_message_id && (
                          <div className="mobile-messenger-message-reply-quote">
                            <div className="mobile-messenger-message-reply-line" />
                            <div className="mobile-messenger-message-reply-content">
                              <div className="mobile-messenger-message-reply-sender">
                                {message.reply_to_sender_name || 'User'}
                              </div>
                              <div className="mobile-messenger-message-reply-text">
                                {message.reply_to_message || message.reply_to_content || 'Nachricht'}
                              </div>
                            </div>
                          </div>
                        )}
                        <p className="mobile-messenger-message-text">
                          {message.message || message.content}
                        </p>
                        <div className="mobile-messenger-message-time">
                          {formatMessageTime(message.created_at)}
                        </div>
                      </>
                    ) : null}

                    {/* Reactions display - inside bubble */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className="mobile-messenger-message-reactions">
                        {Object.entries(message.reactions).map(([emoji, userIds]) => {
                          const userIdsArray = Array.isArray(userIds) ? userIds :
                            (typeof userIds === 'object' ? Object.values(userIds).map(u => u.id || u) : []);
                          const isActive = userIdsArray.includes(user?.id);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReaction && handleReaction(message.id, emoji)}
                              className={`mobile-messenger-reaction-chip ${isActive ? 'active' : ''}`}
                            >
                              <span className="mobile-messenger-reaction-chip-emoji">{emoji}</span>
                              <span className="mobile-messenger-reaction-chip-count">{userIdsArray.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Event Preview */}
                  {(() => {
                    const calendarRefsRaw = Array.isArray(message.calendar_refs) ? message.calendar_refs : [];
                    const metadataEvent = message.metadata?.shared_event;
                    const calendarRefs = [...calendarRefsRaw];

                    if (!calendarRefs.length && metadataEvent) {
                      calendarRefs.push({
                        id: `meta-${message.id}`,
                        event_id: metadataEvent.id,
                        event_title: metadataEvent.title,
                        event_start_time: metadataEvent.start_time,
                        event_end_time: metadataEvent.end_time,
                        location: metadataEvent.location || null
                      });
                    }

                    if (!calendarRefs.length) return null;

                    return calendarRefs.map((ref) => (
                      <div
                        key={`${message.id}-event-${ref.id || ref.event_id}`}
                        className="mobile-messenger-event-card"
                      >
                        <div className="mobile-messenger-event-header">
                          <div className="mobile-messenger-event-icon">
                            <CalendarDays size={20} />
                          </div>
                          <div className="mobile-messenger-event-info">
                            <p className="mobile-messenger-event-title">
                              {ref.event_title || 'Kalenderereignis'}
                            </p>
                            <p className="mobile-messenger-event-date">
                              {formatEventDateRange(ref.event_start_time, ref.event_end_time)}
                            </p>
                            {ref.location && (
                              <p className="mobile-messenger-event-location">📍 {ref.location}</p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard', { state: { focusEventId: ref.event_id } })}
                          className="mobile-messenger-event-button"
                        >
                          Im Kalender öffnen →
                        </button>
                      </div>
                    ));
                  })()}
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="mobile-messenger-typing">
              <div className="mobile-messenger-typing-dot" />
              <div className="mobile-messenger-typing-dot" />
              <div className="mobile-messenger-typing-dot" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reply/Event Indicator */}
        {(replyToMessage || selectedEvent) && (
          <div className="mobile-messenger-composer-stack">
            {replyToMessage && (
              <div className="mobile-messenger-composer-item">
                <div className="mobile-messenger-composer-icon">
                  <Reply size={18} />
                </div>
                <div className="mobile-messenger-composer-content">
                  <p className="mobile-messenger-composer-label">
                    Antworten auf {replyToMessage.sender_name}
                  </p>
                  <p className="mobile-messenger-composer-text">
                    {replyToMessage.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToMessage(null)}
                  className="mobile-messenger-composer-close"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {selectedEvent && (
              <div className="mobile-messenger-composer-item">
                <div className="mobile-messenger-composer-icon calendar">
                  <CalendarDays size={18} />
                </div>
                <div className="mobile-messenger-composer-content">
                  <p className="mobile-messenger-composer-label">Termin teilen</p>
                  <p className="mobile-messenger-composer-text">
                    {selectedEvent.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="mobile-messenger-composer-close"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <form className="mobile-messenger-input" onSubmit={handleSendMessage}>
          <button
            type="button"
            className="mobile-messenger-input-btn"
            onClick={() => setShowComposerActions(!showComposerActions)}
          >
            <Plus size={20} />
          </button>

          <div className="mobile-messenger-input-wrapper">
            <textarea
              ref={mobileTextareaRef}
              className="mobile-messenger-input-field"
              value={messageInput}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Message"
              rows="1"
            />
          </div>

          {messageInput.trim() || pendingAttachments.length > 0 ? (
            <button
              type="submit"
              className="mobile-messenger-input-btn send"
              disabled={sending}
            >
              <Send size={20} />
            </button>
          ) : (
            <button
              type="button"
              className="mobile-messenger-input-btn mic"
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
            >
              {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
            </button>
          )}
        </form>

        {/* Composer Actions Menu */}
        {showComposerActions && (
          <>
            <div
              className="mobile-messenger-backdrop"
              onClick={() => setShowComposerActions(false)}
            />
            <div className="mobile-messenger-actions-menu">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowComposerActions(false);
                }}
                className="mobile-messenger-action-item"
              >
                <Paperclip size={24} />
                <span>Datei</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  startRecording();
                  setShowComposerActions(false);
                }}
                className="mobile-messenger-action-item"
              >
                <Mic size={24} />
                <span>Audio</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  openEventPicker();
                  setShowComposerActions(false);
                }}
                className="mobile-messenger-action-item"
              >
                <CalendarDays size={24} />
                <span>Termin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGifPicker(true);
                  setShowComposerActions(false);
                }}
                className="mobile-messenger-action-item"
              >
                <ImageIcon size={24} />
                <span>GIF</span>
              </button>
              {activeThread?.type === 'group' && activeThread.members?.some(m => m.user_id === 8 || m.id === 8) && (
                <button
                  type="button"
                  onClick={() => {
                    handleBotInvoke();
                    setShowComposerActions(false);
                  }}
                  className="mobile-messenger-action-item"
                >
                  <Bot size={24} />
                  <span>Bot</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  // Fallback if loading
  if (!contacts || !threads || !user) {
    return (
      <div className="messenger-mobile-container mobile-messenger-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ffffff',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#000000'
        }}>
          <div style={{ fontSize: '48px' }}>📱</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>Loading...</div>
          <div style={{ fontSize: '14px', color: '#999' }}>
            User: {user ? '✓' : '✗'} | Contacts: {contacts?.length || 0} | Threads: {threads?.length || 0}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="messenger-mobile-container mobile-messenger-container">
        {mobileMode === 'list' ? renderContactList() : renderChatView()}
      </div>

      {/* GIF Picker Modal */}
      {showGifPicker && (
        <GifPicker
          onSelectGif={handleSelectGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* Long Press Context Menu */}
      {longPressMenuMessage && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-[20000]"
            onClick={closeLongPressMenu}
            style={{ touchAction: 'none' }}
          />
          {/* Context menu */}
          <div
            className="fixed bg-white rounded-2xl shadow-2xl overflow-hidden z-[20001]"
            style={{
              top: `${longPressMenuCoords?.y || 100}px`,
              left: `${longPressMenuCoords?.x || 100}px`,
              transform: 'translate(-50%, 0)',
              minWidth: '200px',
              maxWidth: 'calc(100vw - 40px)',
            }}
          >
            <div className="py-2">
              <button
                type="button"
                onClick={() => {
                  setShowReactionPicker(longPressMenuMessage.id);
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
                  handleReply && handleReply(longPressMenuMessage);
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
                  setMessageToForward(longPressMenuMessage);
                  setShowForwardModal(true);
                  closeLongPressMenu();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <Forward className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Weiterleiten</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePin && handlePin(longPressMenuMessage);
                  closeLongPressMenu();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <Pin className={`w-5 h-5 ${pinnedMessages?.some(p => p.id === longPressMenuMessage.id) ? 'text-yellow-500' : 'text-slate-400'}`} />
                <span className="font-medium">
                  {pinnedMessages?.some(p => p.id === longPressMenuMessage.id) ? 'Entfestigen' : 'Anpinnen'}
                </span>
              </button>
              {longPressMenuMessage.sender_id === user?.id && (
                <>
                  <div className="h-px bg-slate-200 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete && handleDelete(longPressMenuMessage.id);
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

      {/* Reaction Picker Modal */}
      {showReactionPicker && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[20000]"
            onClick={() => setShowReactionPicker(null)}
          />
          <div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-4 z-[20001]"
            style={{ minWidth: '280px' }}
          >
            <div className="grid grid-cols-4 gap-4">
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReaction && handleReaction(showReactionPicker, emoji);
                    setShowReactionPicker(null);
                  }}
                  className="text-4xl hover:scale-125 transition-transform active:scale-110 p-2"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Event Picker Modal */}
      {showEventPicker && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0a0a0a] rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Termin auswählen</h3>
              <button onClick={() => setShowEventPicker(false)} className="text-white/70 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4">
              {calendarEvents && calendarEvents.length > 0 ? (
                calendarEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      handleEventSelect(event);
                      setShowEventPicker(false);
                    }}
                    className="w-full p-3 mb-2 bg-white/5 hover:bg-white/10 rounded-lg text-left transition"
                  >
                    <div className="font-medium text-white">{event.title}</div>
                    <div className="text-sm text-white/60 mt-1">
                      {format(new Date(event.start), 'dd.MM.yyyy HH:mm')}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-white/60 text-center py-8">Keine Termine verfügbar</p>
              )}
            </div>
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

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileAttachment}
        style={{ display: 'none' }}
        multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
      />

      {/* Message Search Modal */}
      {showSearchModal && (
        <MessageSearch
          onClose={() => setShowSearchModal(false)}
          onMessageSelect={(message) => {
            handleMessageSearchSelect(message);
            setShowSearchModal(false);
          }}
          contacts={contacts || []}
          threads={threads || []}
          currentConversationId={selectedThreadId}
          currentUserId={user?.id}
        />
      )}

      {/* Message Forward Modal */}
      {showForwardModal && messageToForward && createPortal(
        <MessageForwardModal
          message={messageToForward}
          threads={threads}
          onClose={() => {
            setShowForwardModal(false);
            setMessageToForward(null);
          }}
          onSuccess={() => {
            setShowForwardModal(false);
            setMessageToForward(null);
            showSuccess('Nachricht erfolgreich weitergeleitet');
          }}
        />,
        document.body
      )}
    </>
  );
};

export default MobileMessenger;
