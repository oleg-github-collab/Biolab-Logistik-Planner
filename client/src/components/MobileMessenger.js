import React, { useState, useRef, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { getAssetUrl } from '../utils/media';
import GifPicker from './GifPicker';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import StoryComposer from './StoryComposer';
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
  handleFileAttachment
}) => {
  const [mobileMode, setMobileMode] = useState('list'); // 'list' or 'chat'

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

  // Switch to chat mode when thread selected
  useEffect(() => {
    if (selectedThreadId || selectedContact) {
      setMobileMode('chat');
    }
  }, [selectedThreadId, selectedContact]);

  // Render contact list view
  const renderContactList = () => {
    // Filter out current user
    const filteredContacts = contacts.filter(c => c.id !== user?.id);

    // Sort threads by updated_at
    const sortedThreads = [...threads].sort((a, b) => {
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
            <button className="mobile-messenger-icon-btn">
              <Search size={20} />
            </button>
            <button className="mobile-messenger-icon-btn">
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
            {filteredContacts.slice(0, 6).map(contact => (
              <div
                key={contact.id}
                className="mobile-messenger-story"
                onClick={() => {
                  handleContactClick(contact);
                  setMobileMode('chat');
                }}
              >
                <div className="mobile-messenger-story-avatar">
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
            ))}
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
                  <div className="mobile-messenger-chat-avatar">
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
                        {thread.name || contactForThread?.name || 'Unbenannt'}
                      </div>
                      <div className="mobile-messenger-chat-time">
                        {lastMessage?.created_at ? formatMessageTime(lastMessage.created_at) : ''}
                      </div>
                    </div>

                    <div className="mobile-messenger-chat-message">
                      {lastMessage?.sender_id === user?.id && (
                        <CheckCheck size={16} className="mobile-messenger-chat-status" />
                      )}
                      <div className="mobile-messenger-chat-text">
                        {lastMessage?.message || lastMessage?.content || 'Keine Nachrichten'}
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

          <div className="mobile-messenger-chat-avatar-header">
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
          </div>

          <div className="mobile-messenger-chat-info">
            <div className="mobile-messenger-chat-name">{displayName}</div>
            <div className={`mobile-messenger-chat-status ${isOnline ? 'online' : ''}`}>
              {activeThread?.type === 'group'
                ? `${activeThread.members?.length || 0} Mitglieder`
                : isOnline ? 'Online' : 'Offline'
              }
            </div>
          </div>
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

              return (
                <div
                  key={message.id}
                  className={`mobile-messenger-message ${isMine ? 'mine' : 'other'}`}
                >
                  <div className="mobile-messenger-message-bubble">
                    {message.attachments?.length > 0 && message.attachments[0].type?.startsWith('image/') ? (
                      <div className="mobile-messenger-message-image">
                        <img src={getAssetUrl(message.attachments[0].url)} alt="" />
                      </div>
                    ) : null}

                    {message.message || message.content ? (
                      <>
                        <p className="mobile-messenger-message-text">
                          {message.message || message.content}
                        </p>
                        <div className="mobile-messenger-message-time">
                          {formatMessageTime(message.created_at)}
                        </div>
                      </>
                    ) : null}
                  </div>
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

  // Debug logging
  console.log('[MobileMessenger] Render:', {
    contacts: contacts?.length,
    threads: threads?.length,
    messages: messages?.length,
    mobileMode,
    selectedThreadId,
    selectedContact: selectedContact?.name,
    activeThread: activeThread?.name,
    user: user?.id
  });

  // When chat view is active, log current messages
  if (mobileMode === 'chat') {
    const threadId = selectedThreadId || activeThread?.id;
    const currentMessages = messages.filter(m => m.thread_id === threadId);
    console.log('[MobileMessenger] Chat View:', {
      threadId,
      currentMessages: currentMessages.length,
      allMessages: messages.length,
      allThreadIds: [...new Set(messages.map(m => m.thread_id || m.conversation_id))],
      firstMessage: messages[0]
    });
  }

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
    </>
  );
};

export default MobileMessenger;
