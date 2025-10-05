# Real-time Kanban Board - WebSocket Events Documentation

## Overview
The Kanban Board is now a shared, real-time collaborative space where all users can see and interact with tasks simultaneously. Changes made by any user are instantly broadcast to all connected clients via WebSocket.

## WebSocket Events

### 1. Task Created (`task:created`)
**Triggered when:** A user creates a new task
**Payload:**
```javascript
{
  task: {
    id: 123,
    title: "New Task",
    description: "Task description",
    status: "todo",
    priority: "high",
    assignee_id: 5,
    assignee_name: "Max Müller",
    due_date: "2025-10-10",
    tags: ["urgent", "bug"],
    last_updated_by: 5,
    last_updated_by_name: "Max Müller",
    created_at: "2025-10-05 12:30:00",
    updated_at: "2025-10-05 12:30:00"
  },
  user: {
    id: 5,
    name: "Max Müller"
  }
}
```
**Result:** All other users see a toast notification: "Max Müller hat eine neue Aufgabe erstellt: 'New Task'"

### 2. Task Updated (`task:updated`)
**Triggered when:** A user modifies a task (title, description, priority, etc.)
**Payload:**
```javascript
{
  task: {
    id: 123,
    title: "Updated Task Title",
    description: "Updated description",
    status: "todo",
    priority: "medium",
    assignee_id: 5,
    assignee_name: "Max Müller",
    last_updated_by: 7,
    last_updated_by_name: "Anna Schmidt",
    updated_at: "2025-10-05 12:35:00"
  },
  user: {
    id: 7,
    name: "Anna Schmidt"
  }
}
```
**Result:**
- If another user is NOT editing the task: Toast notification "Anna Schmidt hat eine Aufgabe aktualisiert: 'Updated Task Title'"
- If another user IS editing the task: Conflict dialog appears

### 3. Task Moved (`task:moved`)
**Triggered when:** A user drags a task to a different column (status change)
**Payload:**
```javascript
{
  task: {
    id: 123,
    title: "Task in Progress",
    status: "inprogress",  // New status
    priority: "high",
    last_updated_by: 3,
    last_updated_by_name: "Peter Schneider",
    updated_at: "2025-10-05 12:40:00"
  },
  user: {
    id: 3,
    name: "Peter Schneider"
  },
  previousStatus: "todo"  // Old status
}
```
**Result:** Toast notification "Peter Schneider hat 'Task in Progress' nach In Arbeit verschoben"

### 4. Task Deleted (`task:deleted`)
**Triggered when:** A user deletes a task
**Payload:**
```javascript
{
  taskId: 123,
  task: {
    id: 123,
    title: "Deleted Task",
    status: "done"
  },
  user: {
    id: 5,
    name: "Max Müller"
  }
}
```
**Result:**
- Task is removed from the board for all users
- Toast notification "Max Müller hat eine Aufgabe gelöscht: 'Deleted Task'"

### 5. User Editing (`task:user_editing`)
**Triggered when:** A user opens a task for editing
**Payload:**
```javascript
{
  taskId: 123,
  user: {
    id: 7,
    name: "Anna Schmidt"
  }
}
```
**Result:**
- Task card shows a blue border with ring
- Indicator appears: "✏️ Anna Schmidt bearbeitet gerade..."

### 6. User Stopped Editing (`task:user_stopped_editing`)
**Triggered when:** A user closes the task edit modal
**Payload:**
```javascript
{
  taskId: 123,
  user: {
    id: 7,
    name: "Anna Schmidt"
  }
}
```
**Result:** Editing indicator is removed from the task card

## UI Indicators

### Live Status Badge
When WebSocket is connected, the header shows:
```
🚀 Kanban Board [🟢 Live]
Verwalte deine Aufgaben effizient • Echtzeit-Sync aktiv
```

### Task Card Indicators
Each task card can display:
1. **Editing indicator** (blue border + message): "✏️ Anna Schmidt bearbeitet gerade..."
2. **Last updated info** (bottom of card): "Zuletzt aktualisiert von Max Müller - 05.10.2025 12:30"
3. **Assignee info**: "👤 Max Müller"

### Toast Notifications
Real-time notifications appear in the top-right corner:
- **Green (success)**: "Aufgabe erfolgreich erstellt"
- **Blue (info)**: "Max hat eine neue Aufgabe erstellt: 'Bug Fix'"
- **Red (error)**: Error messages

## Conflict Resolution

### Scenario: Concurrent Editing
1. User A opens Task #123 for editing → Broadcasts `task:user_editing`
2. User B also opens Task #123 → Both see each other's editing indicator
3. User B makes changes and saves → Server broadcasts `task:updated`
4. User A receives the update and sees a **Conflict Dialog**:

```
⚠️ Konflikt erkannt
Anna Schmidt hat diese Aufgabe gerade aktualisiert

Die Aufgabe wurde von Anna Schmidt geändert, während Sie sie bearbeitet haben.
Wählen Sie, ob Sie Ihre Änderungen behalten oder die neuen Änderungen übernehmen möchten.

[Your Changes]           [New Changes by Anna]
Title: Fix bug           Title: Fix critical bug
Status: todo             Status: inprogress
Priority: medium         Priority: high

[Meine Änderungen behalten]  [Neue Änderungen übernehmen]
```

### Options:
- **Meine Änderungen behalten**: Your changes remain, but you can still save them (potential overwrite)
- **Neue Änderungen übernehmen**: Anna's changes replace yours in the edit form

## Real-time Flow Examples

### Example 1: Team Collaboration
```
Time    User          Action                           Result for Others
----    ----          ------                           -----------------
12:00   Max           Creates "Deploy to production"   Toast: "Max hat eine neue Aufgabe erstellt"
12:01   Anna          Opens task for editing           Max sees: "✏️ Anna bearbeitet gerade..."
12:02   Anna          Changes priority to HIGH         Task updates in real-time
12:03   Peter         Moves task to "In Progress"      Toast: "Peter hat Task nach In Arbeit verschoben"
12:04   Max           Opens same task                  Sees editing indicator for Anna
12:05   Anna          Saves changes                    Max gets conflict dialog
```

### Example 2: Real-time Drag & Drop
```
1. Max drags "Fix Login Bug" from "Todo" to "In Progress"
2. Server broadcasts task:moved event
3. All users see the task move instantly with animation
4. Toast notification: "Max hat 'Fix Login Bug' nach In Arbeit verschoben"
5. Task shows "Zuletzt aktualisiert von Max - vor 1 Sekunde"
```

### Example 3: Deletion Alert
```
1. Anna deletes task "Old Feature Request"
2. Server broadcasts task:deleted event
3. All users see the task fade out and disappear
4. Toast: "Anna hat eine Aufgabe gelöscht: 'Old Feature Request'"
```

## Technical Implementation

### Database Schema Addition
```sql
ALTER TABLE tasks ADD COLUMN last_updated_by INTEGER REFERENCES users(id);
```

### Backend Broadcasts
```javascript
// In tasks.js routes
const io = getIO();
io.emit('task:created', { task, user: req.user });
io.emit('task:updated', { task, user: req.user });
io.emit('task:moved', { task, user: req.user, previousStatus });
io.emit('task:deleted', { taskId, task, user: req.user });
```

### Frontend WebSocket Integration
```javascript
// In ImprovedKanbanBoard.js
const { isConnected, onTaskEvent } = useWebSocket();

onTaskEvent('task:created', (data) => {
  if (data.user.id !== currentUser.id) {
    setTasks(prev => [...prev, data.task]);
    showToast(`${data.user.name} created: "${data.task.title}"`);
  }
});
```

## Features Summary

✅ **Shared Kanban Board** - All users see the same tasks
✅ **Real-time Updates** - Changes broadcast instantly via WebSocket
✅ **Live Indicator** - Shows when WebSocket is connected
✅ **User Presence** - See who is editing which task
✅ **Toast Notifications** - Informative messages for all actions
✅ **Conflict Resolution** - Smart handling of concurrent edits
✅ **Last Updated By** - Track who made the last change
✅ **Optimistic UI** - Instant feedback, sync with server
✅ **Auto-reconnect** - WebSocket reconnects automatically

## Next Steps / Future Enhancements

1. **User Avatars** - Show profile pictures on task cards
2. **Typing Indicators** - Real-time "User is typing..." in task modal
3. **Activity Feed** - Timeline of all task changes
4. **@Mentions** - Tag users in task descriptions with notifications
5. **Collaborative Comments** - Real-time discussion on tasks
6. **Presence System** - Show all online users in header
7. **Lock Mechanism** - Optionally lock tasks while being edited
8. **Undo/Redo** - Revert recent changes
9. **Keyboard Shortcuts** - Quick actions with hotkeys
10. **Mobile Push Notifications** - Alerts on mobile devices
