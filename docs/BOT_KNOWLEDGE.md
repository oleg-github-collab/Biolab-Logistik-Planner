# BL_Bot Knowledge Base - User Guide

## Overview

This document contains comprehensive information about all features and functions of the Biolab Logistik Planner platform. BL_Bot uses this knowledge to answer user questions about how to use the system.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication & Profile](#authentication--profile)
3. [Messaging System](#messaging-system)
4. [Tasks & Kanban](#tasks--kanban)
5. [Calendar & Scheduling](#calendar--scheduling)
6. [Knowledge Base](#knowledge-base)
7. [Waste Management](#waste-management)
8. [Storage Bins (Kisten)](#storage-bins-kisten)
9. [Notifications](#notifications)
10. [Stories](#stories)
11. [Admin Functions](#admin-functions)
12. [Mobile Features](#mobile-features)

---

## Getting Started

### Registration & First Login

**Q: How do I register?**
A: Navigate to the registration page at `/register`. Fill in:
- Name (unique username)
- Email (unique)
- Password (minimum 6 characters)
- Employment type (Vollzeit or Werkstudent)

After registration, you'll go through a first-login setup flow where you can:
- Upload a profile photo
- Set your default working hours
- Configure notification preferences

**Q: How do I log in?**
A: Go to `/login` and enter your email and password. You'll receive a JWT token that authenticates all future requests.

**Q: How do I log out?**
A: Click your profile in the header and select "Abmelden" (Logout). This clears your session and token.

---

## Authentication & Profile

### Profile Management

**Q: How do I view/edit my profile?**
A:
1. Click your profile photo/name in the header
2. Select "Profil" or navigate to `/profile`
3. You can edit:
   - Name, email, phone numbers
   - Profile photo
   - Bio and position description
   - Emergency contact information
   - Working hours preferences
   - Employment type and weekly hours quota

**Q: How do I change my profile photo?**
A:
1. Go to your profile page
2. Click the camera icon on your current photo
3. Select a new photo (JPG, PNG up to 5MB)
4. Photo is uploaded to Cloudinary and updated in your profile

**Q: How do I update my password?**
A: Currently not implemented via UI. Contact an administrator.

### Notification Preferences

**Q: How do I configure notifications?**
A:
1. Click the bell icon in the header
2. Select "Einstellungen" (Settings)
3. Toggle preferences for:
   - Email notifications
   - Push notifications
   - Desktop notifications
   - Sound effects
   - Specific notification types (messages, tasks, mentions, reactions, calendar)
   - Quiet hours (DND mode)

---

## Messaging System

### Direct Messages

**Q: How do I send a direct message?**
A:
1. Go to Messenger page
2. Click "Neue Nachricht" or the + button
3. Select a user from contacts
4. Type your message and press Enter or click Send

**Q: How do I start a conversation with BL_Bot?**
A:
1. Go to Messenger
2. Select "BL_Bot" from contacts or search
3. Send any question - I respond to all messages in direct chats!

**Features:**
- Text messages
- Voice messages (click microphone icon)
- File attachments (click paperclip icon)
- GIF search (click image icon)
- Calendar event sharing (click calendar icon)
- Quick replies (click lightning icon)
- Message reactions (hover over message, click emoji)
- Message deletion (hover over message, click trash)
- Message forwarding (hover over message, click forward)

### Group Conversations

**Q: How do I create a group chat?**
A:
1. Click "Neue Gruppe" in messenger
2. Enter group name
3. Select members to add
4. Click "Gruppe erstellen"

**Q: How do I mention someone in a group?**
A:
- Type `@` followed by the person's name
- Select from autocomplete suggestions
- In group chats, you can quickly mention me (BL_Bot) by clicking the blue bot icon button!

**Q: How does BL_Bot respond in group chats?**
A: I only respond when mentioned with `@BL_Bot`. Use the quick mention button (blue bot icon) to save time!

**Q: How do I pin important messages?**
A:
1. Hover over the message
2. Click the pin icon
3. Pinned messages appear at the top of the conversation
4. Click "Angepinnte Nachrichten" to view all pins

**Q: How do I forward a message?**
A:
1. Hover over the message
2. Click the forward icon
3. Select conversation(s) to forward to
4. Click "Weiterleiten"

### Voice Messages

**Q: How do I send a voice message?**
A:
1. Click the microphone icon
2. Allow microphone permissions
3. Speak your message (red recording indicator appears)
4. Click stop when finished
5. Voice message is automatically sent

**Q: How do I play a voice message?**
A: Click the play button on the voice message. Waveform shows playback progress.

### Message Features

**Q: How do I add a reaction to a message?**
A:
1. Hover over the message
2. Click the smile emoji icon
3. Select an emoji from the picker
4. Your reaction appears below the message

**Q: How do I delete a message?**
A:
1. Hover over your own message
2. Click the trash icon
3. Confirm deletion
4. Message is removed for all participants

**Q: How do I search messages?**
A:
1. Click the search icon in messenger header
2. Type your search query
3. Results show matching messages with context

**Q: What are Quick Replies?**
A: Pre-defined message templates you can send with one click:
1. Click lightning icon
2. Select from templates like "Verstanden", "Danke", "Bin gleich da"
3. Message is sent immediately

### Read Receipts

**Q: How do read receipts work?**
A:
- Single checkmark ✓ = Message sent
- Double checkmark ✓✓ = Message read by recipient
- Messages auto-mark as read when you view the conversation

---

## Tasks & Kanban

### Task Pool

**Q: What is the Task Pool?**
A: A daily shared pool of tasks that any team member can claim. Perfect for distributing daily work.

**Q: How do I add tasks to the Task Pool?**
A:
1. Go to Task Pool page
2. Click "Neue Aufgabe"
3. Enter task details:
   - Title and description
   - Category (optional)
   - Priority (low, medium, high)
   - Due date (defaults to today)
4. Click "Hinzufügen"

**Q: How do I claim a task from the pool?**
A:
1. Find the task in "Verfügbare Aufgaben"
2. Click "Übernehmen"
3. Task moves to "Meine Aufgaben"

**Q: How do I complete a task?**
A:
1. Click the checkbox next to the task
2. Task is marked as completed with timestamp

**Q: How do I request help on a task?**
A:
1. Click "Hilfe anfragen" on your claimed task
2. Task moves back to available pool with "needs help" flag
3. Other team members can see you need assistance

### Kanban Board

**Q: How do I use the Kanban board?**
A:
1. Go to Kanban page
2. View tasks organized in columns (Todo, In Progress, Done, etc.)
3. Drag and drop tasks between columns
4. Click on a task card to view/edit details

**Q: How do I create a task on Kanban?**
A:
1. Click "Neue Aufgabe" or + in any column
2. Fill in task details:
   - Title (required)
   - Description
   - Assignee
   - Due date
   - Priority
   - Tags
   - Checklist items
   - Attachments
3. Click "Speichern"

**Q: How do I add checklist items?**
A:
1. Open task modal
2. Go to "Checkliste" section
3. Click "Element hinzufügen"
4. Enter checklist item text
5. Check/uncheck items as completed

**Q: How do I attach files to tasks?**
A:
1. Open task modal
2. Click "Datei anhängen" or drag & drop
3. Select file (max 10MB)
4. File is uploaded and linked to task

**Q: How do I comment on tasks?**
A:
1. Open task modal
2. Scroll to comments section
3. Type your comment
4. Click "Kommentieren"
5. Comments appear with timestamp and author

**Q: How do I use task templates?**
A:
1. Click "Vorlage verwenden" when creating task
2. Select from predefined templates
3. Template populates task fields automatically
4. Modify as needed

**Q: How do I filter/search tasks?**
A:
- Use search box to filter by title
- Filter by assignee
- Filter by priority (low, medium, high)
- Filter by due date range
- Filter by tags

### Task Management Tips

**Best Practices:**
- Use priorities: High (urgent), Medium (important), Low (nice to have)
- Add detailed descriptions for complex tasks
- Break large tasks into checklist items
- Attach relevant files/documents
- Comment to discuss with team members
- Use tags for categorization
- Set realistic due dates

---

## Calendar & Scheduling

### Work Schedule

**Q: How do I set my weekly schedule?**
A:
1. Go to Schedule/Zeitplan page
2. Click on any day
3. Toggle "Arbeiten" if working that day
4. Set start and end times
5. Add notes if needed
6. Click "Speichern"

**Q: How do I mark absence/vacation?**
A:
1. Go to your schedule
2. Click the day you'll be absent
3. Toggle "Abwesend"
4. Enter reason (Urlaub, Krank, etc.)
5. Save

**Q: How do I view team schedules?**
A: Go to "Team-Zeitplan" to see who is working when, who is absent, and overall team availability.

**Q: How are working hours calculated?**
A: The system automatically calculates:
- Daily hours (end time - start time - breaks)
- Weekly total hours
- Monthly hours with public holiday consideration
- Comparison to your weekly quota

### Calendar Events

**Q: How do I create a calendar event?**
A:
1. Go to Calendar/Kalender page
2. Click on a date or time slot
3. Fill in event details:
   - Title
   - Description
   - Start and end date/time
   - Location
   - Event type (Meeting, Deadline, Training, etc.)
   - Participants
   - Recurrence (daily, weekly, monthly, yearly)
3. Click "Erstellen"

**Q: How do I edit/delete an event?**
A:
- Click on the event
- Click "Bearbeiten" to modify
- Click "Löschen" to delete
- Confirm deletion

**Q: What are recurring events?**
A: Events that repeat on a schedule:
- Daily: Every day
- Weekly: Every week on the same day
- Monthly: Every month on the same date
- Yearly: Every year on the same date

**Q: How do event conflicts work?**
A: When creating an event, the system checks for scheduling conflicts:
- Warns if you have overlapping events
- Shows conflicting events
- You can still create if you choose

**Q: How do I share events in messenger?**
A:
1. In messenger, click calendar icon
2. Select an event
3. Event link is sent in chat
4. Recipients can click to view event details

### Public Holidays

**Q: How are public holidays handled?**
A:
- Admins can add public holidays via Admin panel
- Holidays appear on calendars
- Working hours calculations exclude holidays
- German public holidays pre-configured

---

## Knowledge Base

### Viewing Articles

**Q: How do I find Knowledge Base articles?**
A:
1. Go to Wissensdatenbank page
2. Browse by category (colored tags)
3. Use search box for keywords
4. Filter by tags
5. Sort by newest, helpful, or title

**Q: How do I read an article?**
A:
1. Click on article title
2. Article opens in full view
3. View content, author, category, version history
4. Vote if helpful/not helpful
5. Add comments at bottom

**Q: How do I search the Knowledge Base?**
A:
1. Use search box on KB page
2. Enter keywords
3. System searches titles, content, and tags
4. Results ranked by relevance

**Q: How do voting/feedback work?**
A:
1. At bottom of article, click thumbs up (helpful) or thumbs down (not helpful)
2. Your vote is recorded
3. Helpful count affects article ranking in search
4. You can change your vote anytime

### Creating/Editing Articles

**Q: How do I create a Knowledge Base article?**
A:
1. Click "Neuer Artikel" on KB page
2. Enter:
   - Title (required)
   - Summary/excerpt
   - Category (required)
   - Tags (optional)
   - Content (markdown supported)
3. Set status: Draft or Published
4. Click "Veröffentlichen"

**Q: How do I edit an article?**
A:
1. Open the article
2. Click "Bearbeiten" (Edit button)
3. Modify content
4. Click "Speichern"
5. Previous version is saved in history

**Q: How do I use voice dictation for articles?**
A:
1. Click "Diktieren" when creating/editing article
2. Allow microphone permissions
3. Speak your content
4. System transcribes using OpenAI Whisper
5. Review and edit transcribed text
6. Click "Übernehmen" to insert

**Q: What are article versions?**
A:
- Every time you edit an article, a version is saved
- View version history by clicking "Versionen"
- See who edited, when, and what changed
- Restore previous versions if needed

**Q: How do article categories work?**
A:
- Categories organize articles by topic
- Each category has a color for visual grouping
- Examples: Chemikalien, Sicherheit, Prozesse, Geräte
- Filter articles by category

**Q: How do I comment on articles?**
A:
1. Scroll to bottom of article
2. Type your comment
3. Click "Kommentar hinzufügen"
4. Comments appear with your name and timestamp

### KB Best Practices

**Tips for writing good articles:**
- Clear, descriptive titles
- Concise summary (2-3 sentences)
- Well-structured content with headings
- Add relevant tags for searchability
- Include images/diagrams if helpful
- Keep language simple and direct
- Update regularly to keep current

---

## Waste Management

### Overview

**Q: What is the Waste Management system?**
A: A system to track chemical waste disposal, plan pickup dates, and manage waste categories.

### Waste Items

**Q: How do I register waste for disposal?**
A:
1. Go to Entsorgung (Waste) page
2. Click "Neues Abfallitem"
3. Fill in details:
   - Waste name/description
   - Category (Lösemittel, Säuren, etc.)
   - Amount and unit
   - Location
   - Hazard information
   - Notes
4. Set status: Pending, Scheduled, Disposed
5. Click "Speichern"

**Q: How do I schedule waste pickup?**
A:
1. Select waste items
2. Click "Entsorgung planen"
3. Choose pickup date
4. System can create:
   - Calendar event for pickup
   - Task reminder
   - Kanban card
5. BL_Bot sends reminder before pickup date

**Q: What are waste categories?**
A: Predefined types of waste:
- Lösemittel (Solvents)
- Säuren (Acids)
- Basen (Bases)
- Schwermetalle (Heavy metals)
- Organische Abfälle (Organic waste)
- Each category has specific disposal rules

**Q: How do I view waste statistics?**
A:
1. Go to waste management page
2. Click "Statistiken"
3. View:
   - Total waste by category
   - Monthly disposal trends
   - Most common waste types
   - Upcoming disposal dates

### Waste Templates

**Q: What are waste templates?**
A: Pre-configured waste items for common chemicals:
1. Select template instead of manual entry
2. Template fills in category, hazards, disposal method
3. You only add amount and location
4. Saves time and ensures consistency

---

## Storage Bins (Kisten)

### Overview

**Q: What are Storage Bins (Kisten)?**
A: A system to track temporary storage boxes with expiration dates and QR codes.

### Using Storage Bins

**Q: How do I register storage bins?**
A:
1. Go to Kisten page
2. Click "Scan starten" or "Code eingeben"
3. Either:
   - Scan QR code with camera
   - Manually enter bin code
4. Enter details:
   - Comment/description (what's in the bin)
   - Keep until date (when to dispose)
5. Click "Speichern"

**Q: How does QR code scanning work?**
A:
1. Click "Scan starten"
2. Allow camera permissions
3. Point camera at QR code on bin
4. Code is detected automatically
5. Success beep plays
6. Code added to list

**Q: Are barcodes generated automatically?**
A: Yes! When you register a bin:
- QR code is automatically generated
- Stored as PNG image
- You can view/print it later
- Scannable by laser scanners

**Q: How do I view bin barcodes?**
A:
1. Go to Kisten page
2. Click "Codes anzeigen" for bins on a specific date
3. Swipeable fullscreen gallery opens
4. Swipe left/right to view each code
5. Codes are large for easy laser scanning

**Q: How do bin reminders work?**
A:
1. Set "Keep until" date when registering
2. On that date, BL_Bot sends you a message
3. Message includes:
   - List of bins to check
   - Button to view codes
   - Option to extend or dispose
4. Calendar event is created automatically

**Q: How do I link bins to calendar/tasks?**
A: When creating bins:
- System automatically creates calendar event on "keep until" date
- Can create Kanban task for disposal
- Links appear in bin details

### Barcode Features

**Features:**
- Auto-generation on bin creation
- High error correction (Level H)
- 400x400px resolution
- Stored in `/uploads/barcodes/`
- Fullscreen viewing gallery
- Swipe gestures for navigation
- Works with laser scanners

---

## Notifications

### Notification Center

**Q: How do I view notifications?**
A:
1. Click bell icon in header
2. Badge shows unread count
3. Dropdown shows recent notifications
4. Click "Alle anzeigen" for full list

**Q: What types of notifications exist?**
A:
- **Messages:** New messages, mentions
- **Tasks:** Assignments, due dates, comments
- **Calendar:** Event reminders, conflicts
- **System:** Important announcements
- **Waste:** Disposal reminders
- **Bins:** Expiration reminders

**Q: How does AI prioritization work?**
A:
- Notifications get AI priority score (0-100)
- Based on:
  - Type of notification
  - Your preferences
  - Urgency/deadline
  - Context
- High priority notifications appear first
- Can be snoozed or dismissed

**Q: How do I snooze a notification?**
A:
1. Click on notification
2. Select "Snoozen"
3. Choose duration (15 min, 1 hour, 3 hours, tomorrow)
4. Notification reappears after snooze period

**Q: How do I dismiss notifications?**
A:
- Click "X" to dismiss individual notification
- Click "Alle löschen" to clear all
- Dismissed notifications are deleted

**Q: What are notification groups?**
A:
- Similar notifications are grouped together
- Example: "5 neue Nachrichten von Anna"
- Click to expand and see all
- Reduces notification spam

**Q: How do I enable desktop notifications?**
A:
1. Go to notification settings
2. Toggle "Desktop-Benachrichtigungen"
3. Browser requests permission
4. Allow notifications
5. You'll receive browser push notifications

### Do Not Disturb

**Q: How do I set quiet hours?**
A:
1. Go to notification preferences
2. Toggle "Ruhezeiten aktiviert"
3. Set start time (e.g., 22:00)
4. Set end time (e.g., 08:00)
5. No notifications during these hours

---

## Stories

### Overview

**Q: What are Stories?**
A: 24-hour temporary photo/video posts, similar to Instagram Stories.

### Using Stories

**Q: How do I create a Story?**
A:
1. Click "Story erstellen" on profile or dashboard
2. Choose:
   - Camera (take photo/video now)
   - Galerie (upload existing file)
3. Add caption (optional)
4. Click "Veröffentlichen"
5. Story expires after 24 hours

**Q: How do I view Stories?**
A:
1. Stories appear in feed on homepage
2. Click on user's profile photo to view
3. Tap left/right to navigate between stories
4. Progress bar shows time remaining
5. Auto-advances to next story

**Q: Who can see my Stories?**
A: All users in the system can view your stories.

**Q: How do I delete a Story?**
A:
1. View your own story
2. Click delete icon
3. Confirm deletion
4. Story is removed immediately

**Q: What file types are supported?**
A:
- Images: JPG, PNG, GIF
- Videos: MP4, WebM, MOV
- Max file size: 50MB

---

## Admin Functions

**Note: These functions require admin or superadmin role**

### User Management

**Q: How do admins manage users?**
A:
1. Go to Admin Dashboard
2. Click "Benutzerverwaltung"
3. View all users with details
4. Actions available:
   - Edit user details
   - Change user role
   - Reset password
   - Deactivate/activate account
   - Delete user (removes all data)

**Q: How do I create a new user?**
A:
1. Admin Dashboard → "Neuer Benutzer"
2. Fill in user information
3. Assign role and employment type
4. Click "Erstellen"
5. User receives credentials

**Q: What are user roles?**
A:
- **Employee:** Standard user access
- **Admin:** Can manage users, view logs, send broadcasts
- **Superadmin:** Full system access (currently same as admin)

### Audit Logs

**Q: How do I view audit logs?**
A:
1. Admin Dashboard → "Audit-Logs"
2. View chronological log of:
   - User logins/logouts
   - Data changes
   - Admin actions
   - System events
3. Filter by user, action type, date range

### Broadcast Messages

**Q: How do I send broadcast messages?**
A:
1. Admin Dashboard → "Broadcast"
2. Compose message
3. Select recipients:
   - All users
   - Specific roles
   - Individual users
4. Choose delivery method:
   - In-app notification
   - Email (if configured)
5. Click "Senden"

### System Statistics

**Q: What statistics can admins view?**
A:
- Total users (active/inactive)
- Message count and activity
- Task completion rates
- Calendar event density
- Knowledge base article count
- Waste items pending/disposed
- Storage bins active/expired
- System health metrics

### Public Holidays

**Q: How do I manage public holidays?**
A:
1. Admin Dashboard → "Feiertage"
2. View existing holidays
3. Add new holiday:
   - Date
   - Name
   - Description
4. Delete holidays
5. Holidays affect working hours calculations

---

## Mobile Features

### Mobile Interface

**Q: How does the mobile version work?**
A: The platform is fully responsive:
- Optimized layouts for small screens
- Touch gestures (swipe, tap, long-press)
- Bottom navigation bar
- Drawer menus
- Mobile-first components

**Q: What are the mobile navigation differences?**
A:
- Bottom tab bar replaces desktop sidebar
- Tabs: Home, Messages, Tasks, Calendar, More
- Swipe from left for main menu
- Swipe from right for notifications

**Q: Can I use camera on mobile?**
A: Yes! Mobile-optimized features:
- QR code scanning (Kisten)
- Take photos for Stories
- Take photos for profile
- Voice messages
- All use native mobile APIs

**Q: Do touch gestures work?**
A:
- Swipe right: Go back / open menu
- Swipe left: Open notifications
- Long-press: Context menu
- Pull to refresh: Update content
- Pinch to zoom: Images

**Q: Are offline features available?**
A: Limited offline support:
- Cached pages remain viewable
- Offline indicator appears
- Actions queued until online
- Full offline mode not yet implemented

---

## Common Questions

### General Usage

**Q: How do I search across the platform?**
A:
- Messages: Use search in messenger
- Tasks: Filter/search in Kanban or Task Pool
- Calendar: Date picker and event list
- Knowledge Base: Full-text search box
- Users: Search in contacts/admin panel

**Q: Can I use keyboard shortcuts?**
A: Limited shortcuts:
- Enter: Send message, submit form
- Escape: Close modal
- Arrow keys: Navigate in some lists
- Full keyboard navigation not yet implemented

**Q: How do I report bugs or request features?**
A: Contact your administrator or use the feedback system (if available).

**Q: What browsers are supported?**
A:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Android)
- IE not supported

**Q: What languages are supported?**
A: Currently German (DE) only. English (EN) support is limited.

### Troubleshooting

**Q: What if I don't receive notifications?**
A:
1. Check notification preferences
2. Ensure browser notifications are allowed
3. Check quiet hours settings
4. Verify email is correct (for email notifications)
5. Check spam folder

**Q: What if WebSocket disconnects?**
A:
- Connection status indicator appears
- Auto-reconnect attempts every few seconds
- Offline mode activates
- Real-time features pause until reconnected

**Q: What if file uploads fail?**
A:
- Check file size (max 10MB for most files, 50MB for stories)
- Verify file type is supported
- Ensure stable internet connection
- Try again or contact admin

**Q: What if I forget my password?**
A: Contact your administrator for password reset. Self-service password reset not yet implemented.

**Q: Why can't I see certain features?**
A: Check your user role:
- Some features require admin role
- First-login flow must be completed
- Account must be active

---

## Feature Access by Role

### Employee (Standard User)
✅ Messaging (direct & group)
✅ Task Pool (view, claim, complete)
✅ Kanban (view, create, edit own tasks)
✅ Calendar (view, create events)
✅ Schedule (edit own schedule)
✅ Knowledge Base (read, create articles)
✅ Waste Management (create items)
✅ Storage Bins (register, scan)
✅ Notifications (receive, manage)
✅ Stories (create, view)
✅ Profile (edit own)

### Admin
✅ All employee features
✅ User Management (CRUD)
✅ Audit Logs (view)
✅ Broadcast Messages (send)
✅ System Statistics (view)
✅ Delete any content
✅ Manage categories/templates

### Superadmin
✅ All admin features
✅ Public Holidays (manage)
✅ System configuration
✅ Full database access

---

## Integration Features

### Calendar Integration

**Q: How does calendar integrate with other modules?**
A:
- **Tasks:** Convert tasks to calendar events
- **Waste:** Disposal dates create events
- **Bins:** Expiration dates create reminders
- **Messages:** Share events in chat
- **Team Schedule:** Sync work hours

### Task Linking

**Q: What can tasks be linked to?**
A:
- Calendar events
- Waste disposal items
- Kanban cards
- Messages (via calendar event sharing)
- Storage bins

### Notification Triggers

**Q: What triggers notifications?**
A:
- New message received
- Task assigned to you
- Task due date approaching
- Event reminder (15 min before)
- Someone mentions you
- Message reaction
- Calendar conflict
- Waste disposal due
- Storage bin expiration
- System announcements

---

## Data & Privacy

### Data Storage

**Q: Where is my data stored?**
A:
- Database: PostgreSQL on Railway
- Files: Local filesystem (uploads folder)
- Profile photos: Cloudinary CDN
- Backups: Automatic (Railway)

**Q: Who can see my data?**
A:
- **Messages:** Only conversation participants
- **Tasks:** Assignee and admins
- **Calendar:** Public to all users
- **Profile:** Public to all users
- **Stories:** Public to all users (24h)
- **Admin:** Can access all data

### Privacy Settings

**Q: Can I make my profile private?**
A: No, profiles are visible to all users in the organization.

**Q: Can I delete my account?**
A: Contact an administrator. Account deletion removes all your data.

**Q: What happens to my messages if I leave?**
A: Messages remain in conversations but your account is deactivated.

---

## Best Practices & Tips

### Messaging
- Use @mentions in groups to get attention
- Pin important information
- Use quick replies for common responses
- Forward instead of copy-pasting
- React to acknowledge messages
- Use BL_Bot for quick answers!

### Task Management
- Set realistic due dates
- Break large tasks into checklists
- Use priorities appropriately
- Add detailed descriptions
- Attach relevant files
- Comment for discussions
- Claim tasks you can finish

### Calendar
- Set reminders for important events
- Check for conflicts before creating
- Use recurring events for regular meetings
- Share events in messenger for coordination
- Keep event descriptions clear

### Knowledge Base
- Search before asking
- Vote on article helpfulness
- Comment with questions
- Keep articles updated
- Use clear titles and tags
- Add detailed content
- Use voice dictation for long articles

### Notifications
- Configure preferences to reduce noise
- Use quiet hours for focus time
- Snooze instead of dismissing important items
- Clear notifications regularly
- Enable desktop notifications for critical items

---

## Quick Reference Commands

### Ask BL_Bot (Examples)

**Tasks & Schedule:**
- "Zeige meine Aufgaben für heute"
- "Wann muss ich als nächstes arbeiten?"
- "Wie viele Stunden habe ich diese Woche?"
- "Erstelle eine Aufgabe für morgen"

**Calendar:**
- "Was steht heute im Kalender?"
- "Habe ich morgen Meetings?"
- "Zeige meine nächsten Events"

**Waste & Bins:**
- "Welche Entsorgungen stehen an?"
- "Zeige abgelaufene Kisten"
- "Wann ist die nächste Abholung?"

**Knowledge Base:**
- "Wie entsorge ich Aceton?"
- "Suche Artikel über Sicherheit"
- "Wo finde ich Geräteanleitungen?"

**General:**
- "Wer ist heute im Büro?"
- "Habe ich neue Nachrichten?"
- "Zeige mir meine Benachrichtigungen"

---

## Support

**Q: How do I get help?**
A:
1. Ask BL_Bot! I'm here 24/7 in direct messages or @mention me in groups
2. Search Knowledge Base for guides
3. Contact your administrator
4. Check this documentation

**Q: How do I report a bug?**
A: Tell your administrator or mention it to BL_Bot. Include:
- What you were doing
- What happened (error message)
- What you expected to happen
- Browser and device info

**Q: How do I suggest a feature?**
A: Contact your administrator or discuss with the team.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Maintained for:** BL_Bot AI Assistant

**Note for BL_Bot:** Use this knowledge base to answer user questions accurately. Always be helpful, concise, and friendly. When users ask "how do I...", refer to the relevant section above and provide step-by-step guidance. If something is not documented here, say so honestly and offer to help find the information.
