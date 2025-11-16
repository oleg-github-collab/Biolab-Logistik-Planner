# Messenger Enhancements Integration Guide

This guide shows how to integrate the 6 major messenger enhancements into `DirectMessenger.js`.

##  Completed Backend & API Work

1. **Backend API Routes** (`server/routes/messages.pg.js`) -  DONE
   - Quick Reply Templates (GET, POST, PUT, DELETE, POST use)
   - Contact Notes (GET, PUT, DELETE)
   - Message Search (GET with full-text search)
   - Message Forwarding (POST)

2. **Frontend API Client** (`client/src/utils/apiEnhanced.js`) -  DONE
   - All API methods exported and ready to use

3. **WebSocket Events** (`server/websocket.js`) -  DONE
   - Enhanced typing indicators with conversationId support
   - `typing:start` and `typing:stop` events

4. **Frontend Components** -  DONE
   - `VoiceRecorder.js` - Voice message recording with waveform
   - `MessageSearch.js` - Full-text message search
   - `QuickRepliesPanel.js` - Quick reply templates management
   - `ContactNotesPanel.js` - Contact notes with tags
   - `MessageForwardModal.js` - Forward messages to multiple contacts
   - `TypingIndicator.js` - Typing indicator display

---

## =' DirectMessenger.js Integration Steps

### 1. Add Imports

Add these imports at the top of `DirectMessenger.js`:

```javascript
import MessageSearch from './MessageSearch';
import QuickRepliesPanel from './QuickRepliesPanel';
import ContactNotesPanel from './ContactNotesPanel';
import MessageForwardModal from './MessageForwardModal';
import TypingIndicator from './TypingIndicator';
import { Forward } from 'lucide-react';
import { getContactNote } from '../utils/apiEnhanced';
```

### 2. Add State Variables

Add these state variables to the component:

```javascript
// Search
const [showSearch, setShowSearch] = useState(false);

// Quick Replies
const [showQuickReplies, setShowQuickReplies] = useState(false);

// Contact Notes
const [showContactNotes, setShowContactNotes] = useState(false);
const [contactNote, setContactNote] = useState(null);

// Message Forwarding
const [forwardingMessage, setForwardingMessage] = useState(null);

// Typing Indicator
const [typingUsers, setTypingUsers] = useState(new Map()); // Map<userId, { userName, timeout }>
const typingTimeoutRef = useRef(null);
```

### 3. Add WebSocket Listeners for Typing

Add this useEffect for typing indicators:

```javascript
useEffect(() => {
  if (!selectedThreadId || !isConnected) return;

  const handleUserTyping = (data) => {
    if (data.conversationId === selectedThreadId && data.userId !== user?.id) {
      setTypingUsers(prev => {
        const newMap = new Map(prev);

        // Clear existing timeout for this user
        if (newMap.has(data.userId)) {
          clearTimeout(newMap.get(data.userId).timeout);
        }

        // Set new timeout to remove typing indicator after 3 seconds
        const timeout = setTimeout(() => {
          setTypingUsers(current => {
            const updated = new Map(current);
            updated.delete(data.userId);
            return updated;
          });
        }, 3000);

        newMap.set(data.userId, {
          userName: data.userName,
          timeout
        });

        return newMap;
      });
    }
  };

  const handleUserStoppedTyping = (data) => {
    if (data.conversationId === selectedThreadId) {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        if (newMap.has(data.userId)) {
          clearTimeout(newMap.get(data.userId).timeout);
          newMap.delete(data.userId);
        }
        return newMap;
      });
    }
  };

  const unsubTyping = onConversationEvent('user:typing', handleUserTyping);
  const unsubStopTyping = onConversationEvent('user:typing_stop', handleUserStoppedTyping);

  return () => {
    unsubTyping();
    unsubStopTyping();
    // Clear all timeouts
    typingUsers.forEach(({ timeout }) => clearTimeout(timeout));
  };
}, [selectedThreadId, isConnected, onConversationEvent, user?.id]);
```

### 4. Add Typing Emit on Input Change

Modify the message input onChange handler to emit typing events:

```javascript
const handleMessageInputChange = (e) => {
  setMessageInput(e.target.value);

  // Emit typing event (debounced)
  if (selectedThreadId && socket) {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing:start
    socket.emit('typing:start', {
      conversationId: selectedThreadId,
      userId: user?.id,
      userName: user?.name
    });

    // Auto-stop typing after 1 second of no input
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', {
        conversationId: selectedThreadId,
        userId: user?.id
      });
    }, 1000);
  }
};
```

### 5. Load Contact Notes When Contact Selected

Add this useEffect to load contact notes:

```javascript
useEffect(() => {
  const loadContactNotes = async () => {
    if (!selectedContact?.id) {
      setContactNote(null);
      return;
    }

    try {
      const response = await getContactNote(selectedContact.id);
      setContactNote(response.data);
    } catch (error) {
      console.error('Error loading contact note:', error);
      setContactNote(null);
    }
  };

  loadContactNotes();
}, [selectedContact?.id]);
```

### 6. Add Forward Button to Message Actions

In the message rendering section, add a forward button alongside the existing action buttons:

```javascript
// Add this button to the message actions (alongside Pin, Reply, Delete)
<button
  onClick={() => setForwardingMessage(msg)}
  className="p-2.5 bg-white border-2 border-slate-300 rounded-full hover:bg-purple-50 hover:border-purple-400 hover:scale-110 shadow-lg transition-all duration-200 cursor-pointer"
  title="Weiterleiten"
>
  <Forward className="w-4 h-4 text-slate-600" />
</button>
```

### 7. Add Quick Replies Button to Input Area

Add a quick replies button near the message input:

```javascript
// Add this button in the input controls section
<button
  type="button"
  onClick={() => setShowQuickReplies(true)}
  className="p-3 hover:bg-slate-100 rounded-xl transition"
  title="Schnellantworten"
>
  <Zap className="w-5 h-5 text-slate-600" />
</button>
```

### 8. Add Search Button to Header

Add a search button in the conversation header:

```javascript
// Add this button in the header section
<button
  onClick={() => setShowSearch(true)}
  className="p-2 hover:bg-slate-100 rounded-lg transition"
  title="Nachrichten durchsuchen"
>
  <Search className="w-5 h-5 text-slate-600" />
</button>
```

### 9. Add Contact Notes Toggle to Contact Header

Add a notes toggle button when a contact is selected:

```javascript
// Add this button in the contact header section
<button
  onClick={() => setShowContactNotes(!showContactNotes)}
  className={`p-2 rounded-lg transition ${
    showContactNotes ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100'
  }`}
  title="Notizen"
>
  <FileText className="w-5 h-5" />
  {contactNote && (
    <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full" />
  )}
</button>
```

### 10. Add Typing Indicator Display

Add the typing indicator below the messages:

```javascript
{/* Add this right above the messagesEndRef */}
{Array.from(typingUsers.values()).map((typingUser, index) => (
  <TypingIndicator key={index} userName={typingUser.userName} />
))}
<div ref={messagesEndRef} />
```

### 11. Add Modal Renders at End of Component

Add all modal/panel components at the end of the return statement:

```javascript
{/* Message Search */}
{showSearch && (
  <MessageSearch
    onClose={() => setShowSearch(false)}
    onMessageSelect={(message) => {
      // Scroll to message or navigate to conversation
      setShowSearch(false);
      // You can implement scroll-to-message functionality here
    }}
  />
)}

{/* Quick Replies Panel */}
{showQuickReplies && (
  <QuickRepliesPanel
    onSelect={(content) => {
      setMessageInput(prev => prev + content);
      setShowQuickReplies(false);
    }}
    onClose={() => setShowQuickReplies(false)}
  />
)}

{/* Contact Notes Panel */}
{showContactNotes && selectedContact && (
  <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-bold text-lg">Notizen</h3>
        <button onClick={() => setShowContactNotes(false)}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">
        <ContactNotesPanel
          contactId={selectedContact.id}
          contactName={selectedContact.name}
        />
      </div>
    </div>
  </div>
)}

{/* Message Forward Modal */}
{forwardingMessage && (
  <MessageForwardModal
    message={forwardingMessage}
    onClose={() => setForwardingMessage(null)}
    onSuccess={() => {
      setForwardingMessage(null);
      showSuccess('Nachricht weitergeleitet');
    }}
  />
)}
```

### 12. Import Missing Icons

Make sure to import any missing icons from lucide-react:

```javascript
import {
  // ... existing imports
  Zap,
  FileText,
  Forward
} from 'lucide-react';
```

---

## <¯ Features Summary

### 1. **Voice Messages**
- Already implemented in existing VoiceRecorder.js
- Records audio with waveform visualization
- Playback controls with speed adjustment

### 2. **Message Search**
- Full-text search across all messages
- Filter by sender, date, and message type
- Click to navigate to message

### 3. **Quick Replies**
- Create/edit/delete templates
- Organize by categories
- Track usage count
- One-click insertion

### 4. **Contact Notes**
- Private notes for each contact
- Tag system for organization
- Auto-save functionality

### 5. **Message Forwarding**
- Forward to multiple contacts
- Add optional comment
- Visual selection UI

### 6. **Typing Indicators**
- Real-time typing status
- Auto-hide after 3 seconds
- Works with conversations

---

## =Ý Testing Checklist

- [ ] Quick replies can be created, edited, deleted
- [ ] Quick reply insertion works correctly
- [ ] Message search returns accurate results
- [ ] Search filters work (date, sender, type)
- [ ] Contact notes can be created and edited
- [ ] Tags can be added/removed from notes
- [ ] Messages can be forwarded to multiple contacts
- [ ] Forwarding comment is included
- [ ] Typing indicator appears when user types
- [ ] Typing indicator disappears after timeout
- [ ] Voice recorder works (existing feature)
- [ ] All features work on mobile

---

## =€ Deployment Notes

1. **Database Migration**: The migration `026_messenger_enhancements.sql` must be run first
2. **WebSocket**: Ensure WebSocket server supports the new typing events
3. **Permissions**: All endpoints use `auth` middleware
4. **Performance**: Full-text search uses PostgreSQL GIN indexes

---

## = API Endpoints Reference

### Quick Replies
- `GET /api/messages/quick-replies` - Get user's templates
- `POST /api/messages/quick-replies` - Create template
- `PUT /api/messages/quick-replies/:id` - Update template
- `DELETE /api/messages/quick-replies/:id` - Delete template
- `POST /api/messages/quick-replies/:id/use` - Increment usage count

### Contact Notes
- `GET /api/messages/contacts/:contactId/notes` - Get note
- `PUT /api/messages/contacts/:contactId/notes` - Create/update note
- `DELETE /api/messages/contacts/:contactId/notes` - Delete note

### Message Search
- `GET /api/messages/search?q=query&from=userId&date=YYYY-MM-DD&type=text` - Search messages

### Message Forwarding
- `POST /api/messages/:messageId/forward` - Forward message
  - Body: `{ recipientIds: [1, 2, 3], comment: "optional" }`

---

## =Ú Component Props Reference

### MessageSearch
```javascript
<MessageSearch
  onClose={() => void}
  onMessageSelect={(message) => void}
/>
```

### QuickRepliesPanel
```javascript
<QuickRepliesPanel
  onSelect={(content: string) => void}
  onClose={() => void}
/>
```

### ContactNotesPanel
```javascript
<ContactNotesPanel
  contactId={number}
  contactName={string}
/>
```

### MessageForwardModal
```javascript
<MessageForwardModal
  message={messageObject}
  onClose={() => void}
  onSuccess={() => void}
/>
```

### TypingIndicator
```javascript
<TypingIndicator
  userName={string}
/>
```

---

## ( Done!

All 6 messenger enhancements are now fully implemented and ready to integrate into DirectMessenger.js. Follow the integration steps above to add them to your application.
