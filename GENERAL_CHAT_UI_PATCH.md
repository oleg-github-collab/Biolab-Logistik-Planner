# General Chat UI Implementation Guide

## Проблема
DirectMessenger.js зараз показує тільки direct chats (1-on-1).
Group chats (включно з General Chat) НЕ відображаються в UI.

## Причина
```javascript
// Line ~988
threads.forEach((thread) => {
  if (thread?.type !== 'direct') return; // ❌ Групові чати ігноруються!
```

## Рішення

### 1. Додати окремий список для групових чатів

```javascript
// After line 997, add:
const groupThreads = useMemo(() => {
  if (!Array.isArray(threads) || threads.length === 0) return [];
  return threads
    .filter(thread => thread?.type === 'group')
    .sort((a, b) => {
      // Pinned groups first
      if (a.name === 'General Chat') return -1;
      if (b.name === 'General Chat') return 1;

      // Then by last message time
      const aTime = a.lastMessage?.createdAt || a.updatedAt;
      const bTime = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(bTime) - new Date(aTime);
    });
}, [threads]);
```

### 2. Додати рендер функцію для групових чатів

```javascript
// After renderContactCard, add:
const renderGroupChatCard = (groupThread) => {
  const isSelected = selectedThreadId === groupThread.id;
  const lastMessage = groupThread.lastMessage;
  const unreadCount = groupThread.unreadCount || 0;
  const memberCount = groupThread.participantCount || 0;

  return (
    <div
      key={groupThread.id}
      onClick={() => handleGroupChatSelect(groupThread)}
      className={`
        contact-card cursor-pointer
        ${isSelected ? 'contact-card--active' : ''}
        hover:bg-blue-50 transition-colors
      `}
    >
      {/* Group Icon */}
      <div className="relative">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
          <Users className="w-7 h-7" />
        </div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* Group Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-gray-900 truncate">
            {groupThread.name}
          </h4>
          {lastMessage?.createdAt && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatContactTimestamp(lastMessage.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <p className={`text-sm truncate flex-1 ${unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
            {lastMessage?.content || 'No messages yet'}
          </p>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {memberCount} members
          </span>
        </div>
      </div>
    </div>
  );
};
```

### 3. Додати обробник вибору групового чату

```javascript
// Add new handler:
const handleGroupChatSelect = useCallback(async (groupThread) => {
  try {
    setSelectedThreadId(groupThread.id);
    setSelectedContact(null); // Clear individual contact
    setMobileMode('chat');

    // Join WebSocket room
    if (joinConversationRoom) {
      joinConversationRoom(groupThread.id);
    }

    // Load messages
    await loadMessages(groupThread.id);
  } catch (error) {
    console.error('Error selecting group chat:', error);
    showError('Failed to load group chat');
  }
}, [joinConversationRoom, loadMessages]);
```

### 4. Оновити ContactList для відображення групових чатів

```javascript
// In ContactList component, after search input, add:

{/* Group Chats Section */}
{groupThreads.length > 0 && (
  <div className="contact-group mb-4">
    <p className="contact-group__heading flex items-center gap-2">
      <Users className="w-4 h-4" />
      <span>Group Chats</span>
      <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
        {groupThreads.length}
      </span>
    </p>
    <div className="contact-group__grid space-y-2">
      {groupThreads.map(thread => renderGroupChatCard(thread))}
    </div>
  </div>
)}

{/* Divider */}
{groupThreads.length > 0 && decoratedContacts.length > 0 && (
  <div className="border-t border-gray-200 my-4" />
)}
```

### 5. Оновити header для групових чатів

```javascript
// In messenger-desktop-header, update:
const isGroupChat = selectedThreadId && !selectedContact;
const currentThread = threads.find(t => t.id === selectedThreadId);

<div className="messenger-desktop-header__left">
  {isGroupChat ? (
    <>
      <div className="messenger-desktop-header__avatar-wrapper">
        <div className="messenger-desktop-header__avatar bg-gradient-to-br from-blue-500 to-purple-600">
          <Users className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className="messenger-desktop-header__contact-info">
        <h3 className="messenger-desktop-header__name">
          {currentThread?.name || 'Group Chat'}
        </h3>
        <p className="messenger-desktop-header__status-text">
          {currentThread?.participantCount || 0} members
        </p>
      </div>
    </>
  ) : (
    // Existing individual contact header
    ...
  )}
</div>
```

### 6. Mobile Support

```javascript
// In mobile layout, add tab for groups:
<div className="flex border-b border-gray-200 bg-white">
  <button
    onClick={() => setMobileMode('contacts')}
    className={`flex-1 py-3 text-sm font-medium ${
      mobileMode === 'contacts'
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600'
    }`}
  >
    <User className="w-4 h-4 inline mr-2" />
    Contacts
  </button>
  <button
    onClick={() => setMobileMode('groups')}
    className={`flex-1 py-3 text-sm font-medium ${
      mobileMode === 'groups'
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-600'
    }`}
  >
    <Users className="w-4 h-4 inline mr-2" />
    Groups ({groupThreads.length})
  </button>
</div>

{/* Groups list */}
{mobileMode === 'groups' && (
  <div className="flex-1 overflow-y-auto">
    {groupThreads.map(thread => renderGroupChatCard(thread))}
  </div>
)}
```

### 7. WebSocket Updates

```javascript
// Update WebSocket listener for group messages:
useEffect(() => {
  if (!isConnected) return;

  const handleNewMessage = (data) => {
    const { conversationId, message } = data;

    // Update threads list
    setThreads(prev => {
      const updated = prev.map(thread => {
        if (thread.id === conversationId) {
          return {
            ...thread,
            lastMessage: message,
            updatedAt: message.createdAt,
            unreadCount: thread.id === selectedThreadId ? 0 : (thread.unreadCount || 0) + 1
          };
        }
        return thread;
      });
      return updated.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.updatedAt;
        const bTime = b.lastMessage?.createdAt || b.updatedAt;
        return new Date(bTime) - new Date(aTime);
      });
    });

    // Update messages if currently viewing this conversation
    if (conversationId === selectedThreadId) {
      setMessages(prev => [...prev, normalizeMessage(message)]);
      scrollToBottom();
    }
  };

  onConversationEvent('conversation:new_message', handleNewMessage);

  return () => {
    // Cleanup
  };
}, [isConnected, selectedThreadId, onConversationEvent, normalizeMessage]);
```

### 8. Send Message for Groups

```javascript
// Update sendMessage to support groups:
const handleSendMessage = useCallback(async () => {
  if (!messageInput.trim() && pendingAttachments.length === 0) return;
  if (!selectedThreadId && !selectedContact) return;

  setSending(true);
  try {
    const conversationId = selectedThreadId || await getOrCreateConversation(selectedContact.id);

    await sendConversationMessage({
      conversationId,
      content: messageInput.trim(),
      attachments: pendingAttachments,
      quotedMessageId: replyToMessage?.id
    });

    setMessageInput('');
    setPendingAttachments([]);
    setReplyToMessage(null);
    scrollToBottom();
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Failed to send message');
  } finally {
    setSending(false);
  }
}, [messageInput, pendingAttachments, selectedThreadId, selectedContact, replyToMessage]);
```

## Стилі

Додати в CSS:

```css
/* Group Chat Card */
.contact-card--group {
  position: relative;
}

.contact-card--group::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 70%;
  background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
  border-radius: 0 2px 2px 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.contact-card--group.contact-card--active::before {
  opacity: 1;
}

/* General Chat Badge */
.general-chat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

## Testing Checklist

- [ ] General Chat відображається першим в списку
- [ ] Group chats мають іконку Users
- [ ] Unread count працює для груп
- [ ] Member count відображається
- [ ] Click на group chat відкриває чат
- [ ] Messages відправляються в group
- [ ] WebSocket real-time updates працюють
- [ ] Mobile: окрема вкладка для groups
- [ ] Tablet: responsive layout
- [ ] Desktop: sidebar з groups
- [ ] @mentions працюють (для BL_Bot)
- [ ] Error handling для failed loads
- [ ] Loading states показуються
- [ ] Empty states (no groups) показуються

## Error Handling

```javascript
// Add robust error handling:
const loadGroupChats = async () => {
  try {
    const response = await getMessageThreads();
    if (!response?.data) {
      throw new Error('No data received');
    }
    setThreads(response.data);
  } catch (error) {
    console.error('Failed to load group chats:', error);
    showError('Failed to load conversations. Please refresh.');
    // Fallback to empty array
    setThreads([]);
  }
};
```

## Performance Optimization

```javascript
// Memoize expensive computations:
const sortedGroupThreads = useMemo(() => {
  return groupThreads.sort((a, b) => {
    // Pin General Chat
    if (a.name === 'General Chat') return -1;
    if (b.name === 'General Chat') return 1;

    // Sort by unread
    if (a.unreadCount !== b.unreadCount) {
      return (b.unreadCount || 0) - (a.unreadCount || 0);
    }

    // Sort by last message
    const aTime = new Date(a.lastMessage?.createdAt || a.updatedAt);
    const bTime = new Date(b.lastMessage?.createdAt || b.updatedAt);
    return bTime - aTime;
  });
}, [groupThreads]);
```
