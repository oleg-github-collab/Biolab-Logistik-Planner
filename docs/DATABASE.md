# Database Schema Documentation

**Biolab Logistik Planner - PostgreSQL Database**

Version: Current (as of Migration 053)
Database Type: PostgreSQL 14+
Extensions: `uuid-ossp`, `pgcrypto`

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference - All Tables](#quick-reference---all-tables)
3. [Entity Relationship Diagram](#entity-relationship-diagram)
4. [Core Modules](#core-modules)
   - [User Management](#user-management)
   - [Scheduling & Work Hours](#scheduling--work-hours)
   - [Calendar Events](#calendar-events)
   - [Task Management](#task-management)
   - [Messaging System](#messaging-system)
   - [Notifications](#notifications)
   - [Knowledge Base](#knowledge-base)
   - [Waste Management](#waste-management)
   - [Storage Bins](#storage-bins)
   - [User Stories](#user-stories)
   - [System Tables](#system-tables)
5. [Indexes & Performance](#indexes--performance)
6. [Triggers & Automation](#triggers--automation)
7. [Common Query Patterns](#common-query-patterns)
8. [Migration History](#migration-history)

---

## Overview

The Biolab Logistik Planner database is a comprehensive PostgreSQL schema designed for laboratory logistics management. It includes modules for user management, scheduling, task tracking, messaging, knowledge base, and waste disposal management.

**Key Features:**
- Full-text search capabilities (German & English)
- Automatic timestamp tracking
- Audit logging for critical operations
- AI-based notification prioritization
- Version control for knowledge base articles
- JSONB columns for flexible data structures
- Comprehensive foreign key relationships

---

## Quick Reference - All Tables

### User & Authentication (3 tables)
- `users` - User accounts and profiles
- `user_preferences` - User-specific preference settings
- `user_contacts` - User contact lists and relationships

### Scheduling (3 tables)
- `weekly_schedules` - Weekly work schedules with time blocks
- `work_hours_audit` - Audit log for schedule changes
- `public_holidays` - Company-wide holidays

### Calendar (2 tables)
- `calendar_events` - Calendar events with attendees
- `event_breaks` - Break periods during events

### Tasks (11 tables)
- `tasks` - Main task table with Kanban support
- `task_pool` - Available tasks pool for assignment
- `task_help_requests` - Task help request system
- `task_comments` - Comments on tasks
- `task_attachments` - File attachments for tasks
- `task_activity_log` - Activity tracking for tasks
- `task_templates` - Reusable task templates

### Messaging (12 tables)
- `message_conversations` - Group and direct conversations
- `message_conversation_members` - Conversation membership
- `messages` - All messages (DMs and group)
- `message_reactions` - Emoji reactions on messages
- `message_quotes` - Quoted/replied messages
- `message_mentions` - User mentions in messages
- `message_pins` - Pinned messages
- `message_calendar_refs` - References to calendar events
- `message_task_refs` - References to tasks
- `quick_reply_templates` - User-defined quick replies
- `contact_notes` - Private notes about contacts

### Notifications (5 tables)
- `notifications` - All user notifications
- `notification_preferences` - User notification settings
- `notification_actions` - Notification action audit log
- `notification_groups` - Grouped notifications

### Knowledge Base (13 tables)
- `kb_categories` - Article categories
- `kb_articles` - Knowledge base articles
- `kb_article_versions` - Article version history
- `kb_article_revisions` - Legacy revision table
- `kb_media` - Media attachments for articles
- `kb_article_media` - Alternative media table
- `kb_article_feedback` - User feedback on articles
- `kb_article_views` - Article view tracking
- `kb_article_relations` - Related articles
- `kb_article_comments` - Comments on articles
- `kb_article_votes` - Helpful/not helpful votes
- `kb_bookmarks` - User bookmarks
- `kb_search_history` - Search query history
- `kb_tags` - Tag autocomplete

### Waste Management (6 tables)
- `waste_templates` - Waste disposal templates
- `waste_items` - Waste items to be disposed
- `waste_disposal_schedule` - Scheduled disposals
- `waste_categories` - Waste category definitions
- `waste_disposal_schedule_responses` - User responses to reminders

### Storage Management (2 tables)
- `storage_bins` - Storage bin tracking (Kistenmanagement)
- `storage_bin_audit` - Storage bin audit log

### User Stories (2 tables)
- `user_stories` - Temporary user stories (24h)
- `user_story_views` - Story view tracking

### System (3 tables)
- `system_flags` - System configuration flags
- `admin_broadcast_logs` - Admin broadcast history

**Total Tables: 60+**

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER MANAGEMENT                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │    TASKS     │ │   CALENDAR   │ │  MESSAGES    │
            │              │ │              │ │              │
            │ - tasks      │ │ - events     │ │ - messages   │
            │ - task_pool  │ │ - breaks     │ │ - convos     │
            │ - comments   │ └──────────────┘ │ - reactions  │
            │ - templates  │                  │ - mentions   │
            └──────────────┘                  └──────────────┘
                    │                                 │
                    │                                 │
            ┌───────┼─────────┐              ┌────────┼────────┐
            ▼       ▼         ▼              ▼        ▼        ▼
    ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐
    │  WASTE   │ │STORAGE │ │  KB    │ │ NOTIF  │ │SCHED │ │AUDIT │
    └──────────┘ └────────┘ └────────┘ └────────┘ └──────┘ └──────┘

Legend:
  ─── Direct Foreign Key Relationship
  ┌─┐ Table/Module
  │   Many-to-One/One-to-Many
```

### Core Relationships

**Users → Everything:**
- Users are central to all modules
- Most tables have `created_by`, `assigned_to`, or `user_id` FK to users
- User deletion cascades or nullifies depending on context

**Tasks → Multiple Systems:**
- Tasks link to waste_items (waste disposal)
- Tasks link to storage_bins (bin management)
- Tasks referenced in messages (message_task_refs)
- Tasks generate notifications

**Messages → Cross-References:**
- Messages reference calendar events (message_calendar_refs)
- Messages reference tasks (message_task_refs)
- Messages mention users (message_mentions)
- Messages quote other messages (message_quotes)

**Knowledge Base → Self-Referential:**
- Articles have categories (hierarchical)
- Articles have versions (history)
- Articles relate to other articles (kb_article_relations)

---

## Core Modules

### User Management

#### `users`
Primary table storing all user accounts and profiles.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee'
    CHECK (role IN ('employee', 'admin', 'superadmin')),
  employment_type VARCHAR(50) NOT NULL DEFAULT 'Werkstudent'
    CHECK (employment_type IN ('Vollzeit', 'Werkstudent')),

  -- Work configuration
  weekly_hours_quota NUMERIC(5,2) DEFAULT 20.0,
  auto_schedule BOOLEAN DEFAULT FALSE,
  default_start_time TIME DEFAULT '08:00',
  default_end_time TIME DEFAULT '17:00',

  -- Profile information
  profile_photo VARCHAR(500),
  status VARCHAR(100) DEFAULT 'available',
  status_message VARCHAR(500),
  bio TEXT,
  position_description TEXT,

  -- Contact information
  phone VARCHAR(50),
  phone_mobile VARCHAR(50),
  emergency_contact VARCHAR(200),
  emergency_phone VARCHAR(50),
  address TEXT,

  -- Personal details
  date_of_birth DATE,
  hire_date DATE,

  -- System preferences
  timezone VARCHAR(100) DEFAULT 'Europe/Berlin',
  language VARCHAR(10) DEFAULT 'de',
  theme VARCHAR(20) DEFAULT 'light',

  -- Account status
  is_active BOOLEAN DEFAULT TRUE,
  is_system_user BOOLEAN DEFAULT FALSE,
  first_login_completed BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_users_email` - Fast email lookup for authentication
- `idx_users_role` - Filter by user role
- `idx_users_active` - Filter active users

**Key Constraints:**
- Email and name must be unique
- Role must be employee, admin, or superadmin
- Employment type must be Vollzeit or Werkstudent

**Special Fields:**
- `is_system_user` - Marks bot accounts (BL_Bot)
- `weekly_hours_quota` - For work hour tracking (20.0 for students, 40.0 for full-time)

---

#### `user_preferences`
User-specific notification and UI preferences.

```sql
CREATE TABLE user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Notification settings
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  desktop_notifications BOOLEAN DEFAULT FALSE,
  sound_enabled BOOLEAN DEFAULT TRUE,

  -- Notification types
  notify_messages BOOLEAN DEFAULT TRUE,
  notify_tasks BOOLEAN DEFAULT TRUE,
  notify_mentions BOOLEAN DEFAULT TRUE,
  notify_reactions BOOLEAN DEFAULT TRUE,
  notify_calendar BOOLEAN DEFAULT TRUE,

  -- UI preferences
  compact_view BOOLEAN DEFAULT FALSE,
  show_avatars BOOLEAN DEFAULT TRUE,
  message_preview BOOLEAN DEFAULT TRUE,

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relationship:**
- One-to-one with `users` table
- Cascades on user deletion

---

#### `user_contacts`
User contact lists and relationships (address book).

```sql
CREATE TABLE user_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Contact metadata
  nickname VARCHAR(255),
  notes TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  groups JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_blocked BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (user_id, contact_user_id)
);
```

**Indexes:**
- `idx_user_contacts_user` - User's contact list
- `idx_user_contacts_contact` - Reverse lookup

**Special Behavior:**
- BL_Bot is automatically added to all users' contacts (via trigger)

---

### Scheduling & Work Hours

#### `weekly_schedules`
Weekly work schedules with support for multiple time blocks per day.

```sql
CREATE TABLE weekly_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- Working status
  is_working BOOLEAN DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  time_blocks JSONB DEFAULT '[]'::jsonb, -- Multiple time blocks per day

  -- Absence tracking
  is_absent BOOLEAN DEFAULT FALSE,
  absence_reason TEXT,
  notes TEXT,

  -- Audit
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, week_start, day_of_week)
);
```

**Indexes:**
- `idx_weekly_schedules_user_week` - Composite index for user+week queries
- `idx_weekly_schedules_updated_by` - Track who made changes

**Key Features:**
- `day_of_week`: 0=Sunday, 6=Saturday
- `time_blocks`: JSONB array of `{start, end}` objects for split shifts
- Unique constraint prevents duplicate entries

**Triggers:**
- `trg_weekly_schedules_updated_at` - Auto-update timestamp
- `trg_weekly_schedules_audit` - Log all changes to work_hours_audit

---

#### `work_hours_audit`
Audit trail for all schedule changes.

```sql
CREATE TABLE work_hours_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  change_type VARCHAR(20) NOT NULL, -- 'insert', 'update', 'delete'

  -- Previous values
  previous_start_time TIME,
  previous_end_time TIME,
  previous_is_working BOOLEAN,

  -- New values
  new_start_time TIME,
  new_end_time TIME,
  new_is_working BOOLEAN,

  -- Audit metadata
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);
```

**Indexes:**
- `idx_work_hours_audit_user_week` - Filter by user and week
- `idx_work_hours_audit_changed_at` - Time-based queries

**Purpose:** Provides complete audit trail for compliance and dispute resolution.

---

#### `public_holidays`
Company-wide public holidays and non-working days.

```sql
CREATE TABLE public_holidays (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_month INTEGER, -- 1-12
  recurrence_day INTEGER,   -- 1-31

  -- Location
  country_code VARCHAR(2) DEFAULT 'DE',
  region VARCHAR(100),

  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_public_holidays_date` - Fast date lookups
- `idx_public_holidays_country` - Filter by country
- `idx_public_holidays_recurring` - Find recurring holidays

**Pre-loaded Data:**
- German federal holidays for 2025
- Includes Neujahr, Karfreitag, Ostermontag, Tag der Arbeit, etc.

---

### Calendar Events

#### `calendar_events`
Calendar events with rich metadata and attendee management.

```sql
CREATE TABLE calendar_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Timing
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,

  -- Classification
  event_type VARCHAR(50) DEFAULT 'meeting',
  color VARCHAR(50),
  location VARCHAR(500),
  category VARCHAR(50) DEFAULT 'work',
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'confirmed',

  -- Participants
  attendees JSONB DEFAULT '[]'::jsonb, -- Array of user IDs or emails

  -- Attachments & Media
  attachments JSONB DEFAULT '[]'::jsonb,
  cover_image VARCHAR(500),

  -- Reminders & Notes
  reminder INTEGER DEFAULT 15, -- Minutes before event
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(30),
  recurrence_end_date TIMESTAMP,

  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_calendar_events_time` - Range queries for calendar views
- `idx_calendar_events_creator` - Events by user
- `idx_calendar_events_priority` - High-priority events
- `idx_calendar_events_status` - Filter by status
- `idx_calendar_events_category` - Filter by category
- `idx_calendar_events_recurring` - Find recurring events
- `idx_calendar_events_tags` - GIN index for tag search
- `idx_calendar_events_attendees` - GIN index for attendee search

**Event Types:**
- meeting, appointment, deadline, training, break, maintenance, etc.

**Recurrence Patterns:**
- daily, weekly, monthly, yearly, custom

---

#### `event_breaks`
Break periods during calendar events (e.g., lunch breaks during work days).

```sql
CREATE TABLE event_breaks (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,

  break_start TIME NOT NULL,
  break_end TIME NOT NULL,
  break_type VARCHAR(50) DEFAULT 'lunch',
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_event_breaks_event_id` - Get all breaks for an event

**Break Types:**
- lunch, coffee, rest, personal, etc.

---

### Task Management

#### `tasks`
Main Kanban task table with enhanced features.

```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Status & Priority
  status VARCHAR(50) DEFAULT 'todo'
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')),
  priority VARCHAR(50) DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Dates
  due_date DATE,
  start_date DATE,

  -- Classification
  category VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  labels TEXT[],

  -- Time tracking
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),

  -- Media
  cover_image TEXT,

  -- Checklist & Watchers
  checklist JSONB, -- [{id, text, completed}]
  watchers INTEGER[], -- Array of user IDs

  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_tasks_status` - Filter by Kanban column
- `idx_tasks_assigned` - User's tasks
- `idx_tasks_due_date` - Upcoming deadlines
- `idx_tasks_tags` - GIN index for tag search

**Kanban Columns:**
- backlog → todo → in_progress → review → done
- cancelled (terminal state)

**Priority Levels:**
- low, medium, high, urgent (with visual indicators)

---

#### `task_pool`
Pool of available tasks for self-assignment and help requests.

```sql
CREATE TABLE task_pool (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,

  -- Task details
  available_date DATE NOT NULL,
  task_title VARCHAR(500),
  task_priority VARCHAR(20),
  estimated_duration INTEGER, -- minutes
  required_skills JSONB DEFAULT '[]'::jsonb,

  -- Status
  status VARCHAR(50) DEFAULT 'available'
    CHECK (status IN ('available', 'claimed', 'assigned', 'in_progress',
                      'completed', 'help_requested')),

  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,

  -- Self-claiming
  claimed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMP,

  -- Help requests
  help_requested_from INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  help_requested_at TIMESTAMP,
  help_request_status VARCHAR(50),
  help_request_message TEXT,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_task_pool_date_status` - Available tasks by date
- `idx_task_pool_assigned` - User's assigned tasks
- `idx_task_pool_claimed` - User's claimed tasks

**Workflow:**
1. Task added to pool as 'available'
2. User claims task → 'claimed'
3. Admin assigns task → 'assigned'
4. Work begins → 'in_progress'
5. Task finished → 'completed'
6. Help needed → 'help_requested'

---

#### `task_help_requests`
Help request system for tasks.

```sql
CREATE TABLE task_help_requests (
  id SERIAL PRIMARY KEY,
  task_pool_id INTEGER NOT NULL REFERENCES task_pool(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);
```

**Indexes:**
- `idx_task_help_requests_pool` - Requests for a task
- `idx_task_help_requests_user` - User's pending help requests

---

#### `task_comments`
Comments on tasks with audio support.

```sql
CREATE TABLE task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  comment_text TEXT,
  audio_url TEXT,
  audio_duration INTEGER, -- seconds

  parent_comment_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE,
  is_edited BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_task_comments_task` - All comments for a task
- `idx_task_comments_user` - User's comments
- `idx_task_comments_parent` - Thread hierarchy

**Features:**
- Text comments
- Voice note comments (audio_url)
- Threaded replies (parent_comment_id)
- Edit tracking

---

#### `task_attachments`
File attachments for tasks.

```sql
CREATE TABLE task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  file_type VARCHAR(50) NOT NULL
    CHECK (file_type IN ('image', 'audio', 'video', 'document')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(500),
  file_size INTEGER, -- bytes
  mime_type VARCHAR(100),
  duration INTEGER, -- for audio/video

  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_task_attachments_task` - Task's attachments
- `idx_task_attachments_type` - Filter by media type

---

#### `task_activity_log`
Complete activity history for tasks.

```sql
CREATE TABLE task_activity_log (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'created', 'updated', 'deleted', 'moved', 'assigned',
    'status_changed', 'priority_changed', 'comment_added',
    'attachment_added', 'attachment_removed'
  )),

  old_value TEXT,
  new_value TEXT,
  metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_task_activity_task` - Task's history
- `idx_task_activity_user` - User's actions
- `idx_task_activity_type` - Filter by action type
- `idx_task_activity_created` - Time-based queries

**Purpose:** Full audit trail for task changes.

---

#### `task_templates`
Reusable task templates for quick task creation.

```sql
CREATE TABLE task_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),

  priority VARCHAR(50) DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_duration INTEGER, -- minutes

  tags JSONB DEFAULT '[]'::jsonb,
  checklist JSONB DEFAULT '[]'::jsonb,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_task_templates_created_by` - User's templates
- `idx_task_templates_category` - Filter by category
- `idx_task_templates_public` - Public templates
- `idx_task_templates_usage` - Most used templates

**Pre-loaded Templates:**
- Laborgeräte reinigen (Lab equipment cleaning)
- Chemikalienbestand prüfen (Chemical inventory check)
- Sicherheitsprotokoll erstellen (Safety protocol creation)
- Entsorgung planen (Waste disposal planning)
- Schulung organisieren (Training organization)

---

### Messaging System

#### `message_conversations`
Group and direct message conversations.

```sql
CREATE TABLE message_conversations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,

  conversation_type VARCHAR(20) NOT NULL DEFAULT 'group'
    CHECK (conversation_type IN ('direct', 'group', 'topic')),

  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Temporary conversations
  is_temporary BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,

  settings JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_message_conversations_type` - Filter by conversation type
- `idx_message_conversations_creator` - User's conversations

**Special Conversation:**
- "General Chat" - System-wide group chat (all users auto-added)

---

#### `message_conversation_members`
Conversation membership and roles.

```sql
CREATE TABLE message_conversation_members (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'moderator', 'member')),

  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb,

  UNIQUE(conversation_id, user_id)
);
```

**Indexes:**
- `idx_message_members_user` - User's memberships
- `idx_message_members_conversation` - Conversation's members

**Roles:**
- owner - Created the conversation
- moderator - Can manage members and settings
- member - Regular participant

---

#### `messages`
All messages (direct and group).

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES message_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- For DMs

  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  is_group BOOLEAN DEFAULT FALSE,

  -- Status
  read_status BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  delivered_status BOOLEAN DEFAULT FALSE,

  -- Voice messages
  audio_duration INTEGER,
  audio_waveform JSONB,
  transcription TEXT,

  -- Forwarding
  is_forwarded BOOLEAN DEFAULT FALSE,
  forwarded_from_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  forwarded_from_name VARCHAR(255),

  -- Attachments
  attachments JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_messages_sender` - Sent messages
- `idx_messages_receiver` - Received messages
- `idx_messages_unread` - Unread messages per user
- `idx_messages_conversation` - Conversation timeline
- `idx_messages_search` - GIN full-text search
- `idx_messages_transcription_search` - GIN search on voice transcriptions

**Message Types:**
- text, image, video, audio, file, system, notification

---

#### `message_reactions`
Emoji reactions on messages.

```sql
CREATE TABLE message_reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(50) NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_message_reaction UNIQUE (message_id, user_id, emoji)
);
```

**Indexes:**
- `idx_message_reactions_message` - Reactions on a message
- `idx_message_reactions_user` - User's reactions

**Constraint:** One user can only react with same emoji once per message.

---

#### `message_quotes`
Quoted/replied messages.

```sql
CREATE TABLE message_quotes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  quoted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  snippet TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_message_quotes_message` - Quote chain for a message
- `idx_message_quotes_original` - All replies to original message

---

#### `message_mentions`
User mentions (@username) in messages.

```sql
CREATE TABLE message_mentions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentioned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,

  CONSTRAINT uq_message_mentions UNIQUE (message_id, mentioned_user_id)
);
```

**Indexes:**
- `idx_message_mentions_user` - Unread mentions for a user

**Purpose:** Track @mentions for notifications.

---

#### `message_pins`
Pinned messages in conversations.

```sql
CREATE TABLE message_pins (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
  pinned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_message_pin UNIQUE (message_id, conversation_id)
);
```

**Indexes:**
- `idx_message_pins_message` - Check if message is pinned
- `idx_message_pins_conversation` - All pinned messages in conversation
- `idx_message_pins_pinned_by` - Who pinned messages
- `idx_message_pins_pinned_at` - Pin order

---

#### `message_calendar_refs`
References to calendar events in messages.

```sql
CREATE TABLE message_calendar_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_message_calendar_refs UNIQUE (message_id, event_id)
);
```

**Indexes:**
- `idx_message_calendar_refs_event` - Messages about an event

---

#### `message_task_refs`
References to tasks in messages.

```sql
CREATE TABLE message_task_refs (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  ref_type VARCHAR(30) DEFAULT 'mention',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_message_task_refs UNIQUE (message_id, task_id)
);
```

**Indexes:**
- `idx_message_task_refs_task` - Messages about a task

---

#### `quick_reply_templates`
User-defined quick reply templates.

```sql
CREATE TABLE quick_reply_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  shortcut VARCHAR(20),
  category VARCHAR(50) DEFAULT 'general',
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_quick_reply_user` - User's templates
- `idx_quick_reply_category` - Filter by category

**Purpose:** Quick responses for common messages (e.g., "/brb", "/thanks").

---

#### `contact_notes`
Private notes about contacts.

```sql
CREATE TABLE contact_notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  note TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_contact_note UNIQUE (user_id, contact_id)
);
```

**Indexes:**
- `idx_contact_notes_user` - User's notes
- `idx_contact_notes_contact` - Notes about a contact
- `idx_contact_notes_tags` - GIN index for tag search

---

### Notifications

#### `notifications`
All system notifications with AI priority scoring.

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,

  -- Related entities
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES calendar_events(id) ON DELETE CASCADE,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  -- Smart features
  ai_priority_score INTEGER DEFAULT 50 CHECK (ai_priority_score BETWEEN 0 AND 100),
  group_key VARCHAR(255),
  group_count INTEGER DEFAULT 1,
  is_grouped BOOLEAN DEFAULT FALSE,
  parent_notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,

  -- Snoozing & Dismissing
  dismissed_at TIMESTAMP,
  snoozed_until TIMESTAMP,

  -- Action tracking
  action_taken VARCHAR(50),
  action_taken_at TIMESTAMP,

  priority VARCHAR(20) DEFAULT 'normal',
  action_url VARCHAR(500),
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_notifications_user_created` - User's notifications timeline
- `idx_notifications_unread` - Unread notifications
- `idx_notifications_ai_priority` - Prioritized notifications
- `idx_notifications_group_key` - Grouped notifications
- `idx_notifications_parent` - Notification groups
- `idx_notifications_snoozed` - Snoozed notifications

**AI Priority Score:**
- 0-100 scale calculated by `calculate_notification_priority()` function
- Based on:
  - Urgency (40% weight)
  - Sender importance (30% weight)
  - Content analysis (30% weight)
- VIP users get boosted scores
- Muted keywords reduce scores

**Notification Types:**
- message, task_assigned, task_completed, mention, reaction
- calendar_event, calendar_reminder, waste_disposal_due
- system, broadcast, help_request, etc.

---

#### `notification_preferences`
User notification preferences and DND settings.

```sql
CREATE TABLE notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Do Not Disturb
  dnd_enabled BOOLEAN DEFAULT FALSE,
  dnd_start_time TIME DEFAULT '22:00:00',
  dnd_end_time TIME DEFAULT '08:00:00',
  dnd_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6],

  -- Smart grouping
  auto_group_enabled BOOLEAN DEFAULT TRUE,
  group_window_minutes INTEGER DEFAULT 30,

  -- AI Priority weights
  priority_weight_urgency DECIMAL(3,2) DEFAULT 0.40,
  priority_weight_sender DECIMAL(3,2) DEFAULT 0.30,
  priority_weight_content DECIMAL(3,2) DEFAULT 0.30,

  -- Type-specific settings
  notify_messages BOOLEAN DEFAULT TRUE,
  notify_tasks BOOLEAN DEFAULT TRUE,
  notify_events BOOLEAN DEFAULT TRUE,
  notify_waste BOOLEAN DEFAULT TRUE,
  notify_system BOOLEAN DEFAULT TRUE,

  -- Delivery preferences
  desktop_notifications BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  vibration_enabled BOOLEAN DEFAULT TRUE,

  -- VIP & Muting
  vip_user_ids INTEGER[] DEFAULT '{}',
  muted_keywords TEXT[] DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);
```

**Indexes:**
- `idx_notification_preferences_user` - One-to-one lookup

**Auto-creation:**
- Automatically created for new users via trigger
- Ensures broadcast API never fails

**DND (Do Not Disturb):**
- Time-based (e.g., 22:00-08:00)
- Day-specific (weekends only, etc.)
- Checked by `is_dnd_active()` function

---

#### `notification_actions`
Audit log of notification actions.

```sql
CREATE TABLE notification_actions (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  action_type VARCHAR(50) NOT NULL, -- 'read', 'dismiss', 'snooze', 'act', 'archive'
  action_metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_notification_actions_notif` - Actions on a notification
- `idx_notification_actions_user` - User's notification behavior

**Purpose:** Analytics and user behavior tracking.

---

#### `notification_groups`
Grouped notifications for better organization.

```sql
CREATE TABLE notification_groups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  group_key VARCHAR(255) NOT NULL,
  group_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT,

  notification_count INTEGER DEFAULT 0,
  latest_notification_id INTEGER REFERENCES notifications(id) ON DELETE SET NULL,

  first_created_at TIMESTAMP NOT NULL,
  last_updated_at TIMESTAMP NOT NULL,

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,

  UNIQUE(user_id, group_key)
);
```

**Indexes:**
- `idx_notification_groups_user` - User's notification groups

**Grouping Logic:**
- Messages from same user → grouped
- Updates to same task → grouped
- Similar notifications within 30min → grouped

---

### Knowledge Base

#### `kb_categories`
Hierarchical categories for articles.

```sql
CREATE TABLE kb_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  icon VARCHAR(100) DEFAULT '📄',
  color VARCHAR(20) DEFAULT '#3B82F6',

  parent_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_categories_parent` - Subcategories
- `idx_kb_categories_active` - Active categories

**Pre-loaded Categories:**
- Allgemein (General)
- Labor (Laboratory)
- Chemikalien (Chemicals)
- Sicherheit (Safety)
- Geräte (Equipment)
- Verfahren (Procedures/SOPs)
- FAQ

**Hierarchical Structure:**
- Supports nested categories via `parent_id`
- Display order controls sorting

---

#### `kb_articles`
Knowledge base articles with full-text search.

```sql
CREATE TABLE kb_articles (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,

  title VARCHAR(500) NOT NULL,
  slug VARCHAR(600) NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,

  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Publishing workflow
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'published', 'archived')),
  visibility VARCHAR(20) DEFAULT 'all',
  published_at TIMESTAMP,

  -- Features
  is_featured BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]'::jsonb,

  -- Statistics
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP,

  -- Media
  cover_image VARCHAR(500),
  reading_time INTEGER, -- minutes

  -- Versioning
  current_version INTEGER DEFAULT 1,
  last_edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_edited_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_articles_status` - Filter by workflow status
- `idx_kb_articles_featured` - Featured articles
- `idx_kb_articles_category` - Category filtering
- `idx_kb_articles_tags` - GIN index for tag search
- `idx_kb_articles_search` - GIN full-text search (English)
- `idx_kb_articles_title_search` - GIN title search (German)
- `idx_kb_articles_content_search` - GIN content search (German)

**Workflow:**
1. draft → author writes article
2. review → awaiting approval
3. published → live and searchable
4. archived → hidden but not deleted

**Full-Text Search:**
- Uses PostgreSQL's tsvector
- German and English language support
- Searches title, content, summary, tags

---

#### `kb_article_versions`
Complete version history for articles.

```sql
CREATE TABLE kb_article_versions (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,

  category_id INTEGER REFERENCES kb_categories(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tags TEXT[],
  status VARCHAR(50) DEFAULT 'draft',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by_name VARCHAR(255),
  change_summary TEXT,

  UNIQUE(article_id, version_number)
);
```

**Indexes:**
- `idx_kb_article_versions_article` - Version history for article
- `idx_kb_article_versions_created` - Time-based queries

**Auto-Versioning:**
- Trigger creates new version on content change
- Stores complete snapshot (not just diff)
- Includes author name for historical accuracy

---

#### `kb_media`
Media attachments for articles.

```sql
CREATE TABLE kb_media (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,

  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_type VARCHAR(50),

  -- Image dimensions
  width INTEGER,
  height INTEGER,
  thumbnail_path VARCHAR(500),

  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_media_article` - Article's media (ordered)

**Supported Types:**
- Images (with thumbnails)
- Videos
- Documents (PDFs, etc.)
- Audio files

---

#### `kb_article_feedback`
User feedback (helpful/not helpful) on articles.

```sql
CREATE TABLE kb_article_feedback (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_helpful BOOLEAN NOT NULL,
  comment TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_kb_article_feedback UNIQUE (article_id, user_id)
);
```

**Constraint:** One feedback per user per article.

---

#### `kb_article_views`
Article view tracking and analytics.

```sql
CREATE TABLE kb_article_views (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100),
  user_agent TEXT
);
```

**Indexes:**
- `idx_kb_article_views_article` - View history for article

**Purpose:** Analytics, popular articles, user behavior.

---

#### `kb_article_comments`
Threaded comments on articles.

```sql
CREATE TABLE kb_article_comments (
  id SERIAL PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES kb_article_comments(id) ON DELETE CASCADE,

  comment TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_article_comments_article` - Comments on article

**Features:**
- Threaded discussions via `parent_id`
- Edit tracking

---

#### `kb_bookmarks`
User bookmarks for articles.

```sql
CREATE TABLE kb_bookmarks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,

  folder VARCHAR(100),
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (user_id, article_id)
);
```

**Purpose:** Personal reading lists, favorites.

---

#### `kb_search_history`
Search query tracking for autocomplete and analytics.

```sql
CREATE TABLE kb_search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  ip_address VARCHAR(100),

  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_search_history_user` - User's search history

**Purpose:**
- Search suggestions
- Popular queries
- Search analytics

---

#### `kb_tags`
Tag autocomplete and usage tracking.

```sql
CREATE TABLE kb_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_kb_tags_name` - Tag lookup
- `idx_kb_tags_usage` - Popular tags

---

### Waste Management

#### `waste_templates`
Reusable waste disposal templates.

```sql
CREATE TABLE waste_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,

  hazard_level VARCHAR(50) NOT NULL
    CHECK (hazard_level IN ('low', 'medium', 'high', 'critical')),

  disposal_frequency_days INTEGER,
  disposal_instructions TEXT,
  default_frequency VARCHAR(50) DEFAULT 'weekly',

  waste_code VARCHAR(100),
  color VARCHAR(50),
  icon VARCHAR(50),
  description TEXT,
  safety_instructions TEXT,

  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_waste_templates_category` - Filter by category
- `idx_waste_templates_hazard` - Filter by hazard level

**Hazard Levels:**
- low - General waste
- medium - Caution required
- high - Protective equipment mandatory
- critical - Special handling, emergency protocols

---

#### `waste_categories`
Waste category definitions with safety information.

```sql
CREATE TABLE waste_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,

  icon VARCHAR(50),
  color VARCHAR(20) DEFAULT '#3B82F6',

  instructions TEXT,
  safety_notes TEXT,
  image_url TEXT,
  disposal_frequency VARCHAR(50),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pre-loaded Categories:**
- Eluate (Chromatography solutions)
- Quecksilbereluate (Mercury solutions) ☢️
- Kühlcontainer (Refrigerated waste) ❄️
- EBV Regal (Electronics/batteries) 📦
- Eimer (General lab waste) 🪣
- Asphalte (Asphalt residues) 🛢️
- Heptane (Heptane solvents) ⚗️
- Königswasser (Aqua regia) ⚠️

---

#### `waste_items`
Individual waste items requiring disposal.

```sql
CREATE TABLE waste_items (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES waste_templates(id) ON DELETE SET NULL,

  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(50),

  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('active', 'disposed', 'archived')),

  last_disposal_date TIMESTAMP,
  next_disposal_date TIMESTAMP,

  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notification_users JSONB DEFAULT '[]'::jsonb,

  description TEXT,
  notes TEXT,

  -- Cross-references
  kanban_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_waste_items_template` - Items from template
- `idx_waste_items_status` - Active items
- `idx_waste_items_assigned` - User's assigned waste
- `idx_waste_items_task` - Linked Kanban tasks

**Integration:**
- Links to Kanban tasks for workflow tracking
- Notifications sent to multiple users

---

#### `waste_disposal_schedule`
Scheduled waste disposal events.

```sql
CREATE TABLE waste_disposal_schedule (
  id SERIAL PRIMARY KEY,
  waste_item_id INTEGER NOT NULL REFERENCES waste_items(id) ON DELETE CASCADE,

  scheduled_date TIMESTAMP NOT NULL,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,

  status VARCHAR(50) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'rescheduled', 'completed', 'overdue', 'cancelled')),

  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actual_date TIMESTAMP,

  -- Reminders
  reminder_dates JSONB DEFAULT '[]'::jsonb,
  reminder_sent BOOLEAN DEFAULT FALSE,

  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),
  recurrence_end_date TIMESTAMP,
  next_occurrence TIMESTAMP,

  priority VARCHAR(50) DEFAULT 'medium',
  disposal_method VARCHAR(255),
  quantity NUMERIC(10,2),
  unit VARCHAR(50),
  notes TEXT,

  -- Integration
  calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL,
  last_bot_notification_at TIMESTAMP,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_waste_disposal_item` - Schedules for waste item
- `idx_waste_disposal_scheduled` - Upcoming disposals
- `idx_waste_disposal_status` - Filter by status
- `idx_waste_disposal_calendar` - Linked calendar events
- `idx_waste_disposal_last_bot` - Bot notification tracking

**BL_Bot Integration:**
- Sends automatic reminders via messenger
- Tracks reminder history
- Creates calendar events

---

#### `waste_disposal_schedule_responses`
User responses to BL_Bot disposal reminders.

```sql
CREATE TABLE waste_disposal_schedule_responses (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES waste_disposal_schedule(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  action VARCHAR(24) NOT NULL CHECK (action IN ('acknowledge', 'defer')),
  message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_waste_disposal_schedule_responses_schedule` - Responses for schedule

**Actions:**
- acknowledge - User confirms they'll handle it
- defer - User requests postponement

---

### Storage Bins

#### `storage_bins`
Storage bin tracking system (Kistenmanagement).

```sql
CREATE TABLE storage_bins (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) NOT NULL,
  comment TEXT,
  keep_until DATE NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed')),

  -- Cross-references
  calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,

  -- Barcode scanning
  barcode_image_path TEXT,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_storage_bins_status` - Active bins
- `idx_storage_bins_keep_until` - Expiring bins
- `idx_storage_bins_keep_until_status` - Composite for queries

**Features:**
- QR/Barcode image storage for laser scanner viewing
- Links to calendar for disposal scheduling
- Links to tasks for workflow tracking

---

#### `storage_bin_audit`
Audit trail for storage bin operations.

```sql
CREATE TABLE storage_bin_audit (
  id SERIAL PRIMARY KEY,
  storage_bin_id INTEGER NOT NULL REFERENCES storage_bins(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_storage_bin_audit_bin` - Audit trail for bin

**Actions:**
- created, updated, completed, deleted, scanned, etc.

---

### User Stories

#### `user_stories`
Temporary user stories (24-hour expiry).

```sql
CREATE TABLE user_stories (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  media_path TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(100) NOT NULL DEFAULT 'image',
  caption TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  views JSONB DEFAULT '[]'::jsonb
);
```

**Indexes:**
- `idx_user_stories_user` - User's stories
- `idx_user_stories_expires` - Expired stories cleanup

**Media Types:**
- image, video

**Auto-Expiry:**
- Stories expire after 24 hours
- Background job removes expired stories

---

#### `user_story_views`
Story view tracking.

```sql
CREATE TABLE user_story_views (
  id SERIAL PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES user_stories(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(story_id, viewer_id)
);
```

**Indexes:**
- `idx_user_story_views_story` - Views for a story
- `idx_user_story_views_viewer` - Stories viewed by user

**Constraint:** One view per user per story.

---

### System Tables

#### `system_flags`
System-wide configuration flags.

```sql
CREATE TABLE system_flags (
  name VARCHAR(255) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Pre-configured Flags:**
- `first_setup_completed` - Whether superadmin setup is done

---

#### `admin_broadcast_logs`
Admin broadcast message history.

```sql
CREATE TABLE admin_broadcast_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  message TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'info',
  recipients INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_admin_broadcast_logs_admin` - Broadcasts by admin
- `idx_admin_broadcast_logs_created` - Recent broadcasts

**Severity Levels:**
- info, warning, urgent, critical

---

## Indexes & Performance

### Critical Performance Indexes

**Users:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
```

**Calendar:**
```sql
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX idx_calendar_events_attendees ON calendar_events USING gin (attendees);
```

**Tasks:**
```sql
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_tags ON tasks USING gin (tags);
```

**Messages:**
```sql
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(receiver_id, read_status);
CREATE INDEX idx_messages_search ON messages USING gin(to_tsvector('english', message));
```

**Notifications:**
```sql
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_ai_priority ON notifications(user_id, ai_priority_score DESC, created_at DESC);
```

**Knowledge Base:**
```sql
CREATE INDEX idx_kb_articles_search ON kb_articles USING gin (to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_kb_articles_title_search ON kb_articles USING gin(to_tsvector('german', title));
```

### GIN Indexes (Full-Text & JSONB)

**Full-Text Search:**
- `kb_articles` - German and English search
- `messages` - Message content search
- `messages.transcription` - Voice message search

**JSONB Arrays:**
- `tasks.tags` - Tag filtering
- `calendar_events.tags` - Event tag search
- `calendar_events.attendees` - Attendee search
- `user_preferences` - Notification settings

### Composite Indexes

**Multi-Column Queries:**
```sql
-- Weekly schedules by user and week
idx_weekly_schedules_user_week (user_id, week_start)

-- Unread messages per user
idx_messages_unread (receiver_id, read_status)

-- User notifications timeline
idx_notifications_user_created (user_id, created_at DESC)

-- AI-prioritized notifications
idx_notifications_ai_priority (user_id, ai_priority_score DESC, created_at DESC)
```

### Partial Indexes

**Optimized for specific conditions:**
```sql
-- Only active storage bins
CREATE INDEX idx_storage_bins_keep_until_status
ON storage_bins(keep_until, status)
WHERE status = 'pending';

-- Only featured articles
CREATE INDEX idx_kb_articles_featured
ON kb_articles(featured)
WHERE featured = TRUE;

-- Only grouped notifications
CREATE INDEX idx_notifications_group_key
ON notifications(group_key)
WHERE group_key IS NOT NULL;
```

---

## Triggers & Automation

### Timestamp Triggers

**Auto-Update `updated_at`:**
```sql
CREATE OR REPLACE FUNCTION set_updated_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to tables:
- users, user_preferences
- weekly_schedules
- calendar_events, tasks, task_pool
- messages, message_conversations
- notifications, kb_articles, kb_categories
- waste_templates, waste_items, waste_disposal_schedule

### Audit Triggers

**Work Hours Audit:**
```sql
CREATE TRIGGER trg_weekly_schedules_audit
  AFTER INSERT OR UPDATE OR DELETE ON weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION log_weekly_schedule_changes();
```

Logs all schedule changes with old/new values.

### Knowledge Base Versioning

**Auto-Create Article Versions:**
```sql
CREATE TRIGGER kb_article_version_update
  BEFORE UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION kb_article_version_trigger();
```

Creates version snapshot on title/content change.

**Search Vector Update:**
```sql
CREATE TRIGGER kb_article_search_vector_update
  BEFORE INSERT OR UPDATE ON kb_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_article_search_vector();
```

Updates full-text search index automatically.

### Notification Automation

**Auto-Calculate AI Priority:**
```sql
CREATE TRIGGER trg_notification_auto_priority
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trg_notification_auto_priority();
```

Calculates AI priority score based on user preferences.

**Auto-Group Notifications:**
```sql
CREATE TRIGGER trg_update_notification_group
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trg_update_notification_group();
```

Groups related notifications automatically.

### User Management

**Auto-Create Notification Preferences:**
```sql
CREATE TRIGGER trg_user_create_notification_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trg_user_create_notification_prefs();
```

Creates default notification preferences for new users.

**Auto-Add to General Chat:**
```sql
CREATE TRIGGER add_user_to_general_chat_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION add_user_to_general_chat();
```

Adds new users to "General Chat" conversation.

**Auto-Add BL_Bot Contact:**
```sql
CREATE TRIGGER add_bl_bot_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION add_bl_bot_to_new_user();
```

Adds BL_Bot to new user's contacts.

---

## Common Query Patterns

### User Management

**Get active users with their preferences:**
```sql
SELECT u.*, up.*
FROM users u
LEFT JOIN user_preferences up ON u.id = up.user_id
WHERE u.is_active = TRUE
ORDER BY u.name;
```

**Find users by role:**
```sql
SELECT * FROM users
WHERE role = 'admin' AND is_active = TRUE;
```

### Scheduling

**Get user's schedule for a week:**
```sql
SELECT *
FROM weekly_schedules
WHERE user_id = $1
  AND week_start = $2
ORDER BY day_of_week;
```

**Find working users on a specific date:**
```sql
SELECT DISTINCT u.*
FROM users u
JOIN weekly_schedules ws ON u.id = ws.user_id
WHERE ws.week_start = date_trunc('week', $1::date)
  AND ws.day_of_week = EXTRACT(DOW FROM $1::date)
  AND ws.is_working = TRUE
  AND u.is_active = TRUE;
```

### Calendar

**Get events in date range:**
```sql
SELECT *
FROM calendar_events
WHERE (start_time, end_time) OVERLAPS ($1::timestamp, $2::timestamp)
ORDER BY start_time;
```

**Find events for a user (as creator or attendee):**
```sql
SELECT *
FROM calendar_events
WHERE created_by = $1
   OR attendees @> to_jsonb($1::int)
ORDER BY start_time DESC;
```

### Tasks

**Get user's active tasks by status:**
```sql
SELECT *
FROM tasks
WHERE assigned_to = $1
  AND status IN ('todo', 'in_progress')
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  due_date NULLS LAST;
```

**Search tasks by tags:**
```sql
SELECT *
FROM tasks
WHERE tags @> '["safety"]'::jsonb
ORDER BY created_at DESC;
```

**Get task with all details (comments, attachments, activity):**
```sql
-- Main task
SELECT t.*,
       u_assigned.name as assigned_to_name,
       u_created.name as created_by_name
FROM tasks t
LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.id
LEFT JOIN users u_created ON t.created_by = u_created.id
WHERE t.id = $1;

-- Comments
SELECT tc.*, u.name as user_name, u.profile_photo
FROM task_comments tc
JOIN users u ON tc.user_id = u.id
WHERE tc.task_id = $1
ORDER BY tc.created_at ASC;

-- Attachments
SELECT ta.*, u.name as uploaded_by_name
FROM task_attachments ta
LEFT JOIN users u ON ta.uploaded_by = u.id
WHERE ta.task_id = $1
ORDER BY ta.created_at DESC;

-- Activity log
SELECT tal.*, u.name as user_name
FROM task_activity_log tal
LEFT JOIN users u ON tal.user_id = u.id
WHERE tal.task_id = $1
ORDER BY tal.created_at DESC;
```

### Messaging

**Get user's conversations with unread counts:**
```sql
SELECT
  mc.*,
  mcm.last_read_at,
  COUNT(m.id) FILTER (WHERE m.created_at > mcm.last_read_at) as unread_count,
  MAX(m.created_at) as last_message_at
FROM message_conversations mc
JOIN message_conversation_members mcm
  ON mc.id = mcm.conversation_id AND mcm.user_id = $1
LEFT JOIN messages m ON mc.id = m.conversation_id
GROUP BY mc.id, mcm.last_read_at
ORDER BY last_message_at DESC NULLS LAST;
```

**Get messages in a conversation:**
```sql
SELECT
  m.*,
  u.name as sender_name,
  u.profile_photo as sender_photo,
  (SELECT json_agg(json_build_object('emoji', emoji, 'user_id', user_id))
   FROM message_reactions mr WHERE mr.message_id = m.id) as reactions
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.conversation_id = $1
ORDER BY m.created_at DESC
LIMIT 50;
```

**Find unread mentions:**
```sql
SELECT mm.*, m.message, u.name as mentioned_by_name
FROM message_mentions mm
JOIN messages m ON mm.message_id = m.id
JOIN users u ON mm.mentioned_by = u.id
WHERE mm.mentioned_user_id = $1
  AND mm.is_read = FALSE
ORDER BY mm.created_at DESC;
```

### Notifications

**Get user's prioritized notifications:**
```sql
SELECT *
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE
  AND (snoozed_until IS NULL OR snoozed_until < NOW())
  AND dismissed_at IS NULL
ORDER BY ai_priority_score DESC, created_at DESC
LIMIT 20;
```

**Get notification groups:**
```sql
SELECT ng.*,
       n.title as latest_title,
       n.content as latest_content
FROM notification_groups ng
LEFT JOIN notifications n ON ng.latest_notification_id = n.id
WHERE ng.user_id = $1
  AND ng.is_read = FALSE
ORDER BY ng.last_updated_at DESC;
```

### Knowledge Base

**Full-text search:**
```sql
SELECT
  kb.*,
  ts_rank(
    to_tsvector('german', title || ' ' || content),
    plainto_tsquery('german', $2)
  ) as rank
FROM kb_articles kb
WHERE status = 'published'
  AND to_tsvector('german', title || ' ' || content) @@ plainto_tsquery('german', $2)
ORDER BY rank DESC, view_count DESC
LIMIT 20;
```

**Get article with version history:**
```sql
-- Current article
SELECT kb.*,
       kbc.name as category_name,
       u.name as author_name
FROM kb_articles kb
LEFT JOIN kb_categories kbc ON kb.category_id = kbc.id
LEFT JOIN users u ON kb.author_id = u.id
WHERE kb.id = $1;

-- Version history
SELECT kbv.*, u.name as editor_name
FROM kb_article_versions kbv
LEFT JOIN users u ON kbv.author_id = u.id
WHERE kbv.article_id = $1
ORDER BY kbv.version_number DESC;
```

**Popular articles:**
```sql
SELECT kb.*, kbc.name as category_name
FROM kb_articles kb
LEFT JOIN kb_categories kbc ON kb.category_id = kbc.id
WHERE kb.status = 'published'
ORDER BY kb.view_count DESC, kb.helpful_count DESC
LIMIT 10;
```

### Waste Management

**Get overdue waste disposals:**
```sql
SELECT
  wds.*,
  wi.name as waste_item_name,
  wi.location,
  u.name as assigned_to_name
FROM waste_disposal_schedule wds
JOIN waste_items wi ON wds.waste_item_id = wi.id
LEFT JOIN users u ON wds.assigned_to = u.id
WHERE wds.status IN ('scheduled', 'overdue')
  AND wds.scheduled_date < NOW()
ORDER BY wds.scheduled_date;
```

**Get waste items needing attention:**
```sql
SELECT
  wi.*,
  wt.hazard_level,
  wt.disposal_instructions
FROM waste_items wi
LEFT JOIN waste_templates wt ON wi.template_id = wt.id
WHERE wi.status = 'active'
  AND (wi.next_disposal_date < NOW() + INTERVAL '7 days'
       OR wi.next_disposal_date IS NULL)
ORDER BY wi.next_disposal_date NULLS FIRST;
```

---

## Migration History

### Migration 001: Initial Schema
- Core user management (users, user_preferences)
- Scheduling system (weekly_schedules, work_hours_audit)
- Calendar events
- Tasks and task pool
- Messaging system (conversations, messages, reactions)
- Notifications
- Knowledge base (categories, articles, media)
- Waste management (templates, items, schedules)
- System flags
- All base triggers and indexes

### Migration 002: Task Pool & Contacts
- Enhanced task_pool with skills, recurrence, help requests
- Added user_contacts table
- Updated task_pool status constraints

### Migration 009 (event_breaks): Event Breaks
- Added event_breaks table for calendar events
- Break time tracking during work days

### Migration 009 (enhanced_kanban): Enhanced Kanban & KB
- Task attachments (images, audio, video, documents)
- Task comments with audio support
- Task activity log
- KB categories with hierarchy
- KB articles with full-text search
- KB article media, comments, votes, revisions
- Full-text search triggers

### Migration 010: KB Categories
- Pre-loaded German KB categories
- Unique constraint on category names

### Migration 011: Waste Categories
- Enhanced waste_categories table
- Pre-loaded German waste types with safety info

### Migration 014: Schedule Time Blocks
- Added JSONB time_blocks to weekly_schedules
- Support for multiple work periods per day

### Migration 015: User Stories
- user_stories table (24h expiry)
- user_story_views tracking
- UUID primary keys

### Migration 016: Storage Bins
- storage_bins table (Kistenmanagement)
- storage_bin_audit for tracking
- Calendar and task integration

### Migration 017: Waste-Task Link
- Added kanban_task_id to waste_items
- Link waste to Kanban workflow

### Migration 018: EntsorgungBot Calendar
- Added calendar_event_id to waste_disposal_schedule
- Bot notification tracking

### Migration 020: Task Attachments
- task_attachments table (duplicate cleanup)
- Updated trigger function

### Migration 021: KB Article Versions
- kb_article_versions table
- Version tracking columns on kb_articles
- kb_tags table

### Migration 022: Performance Indexes
- Added critical performance indexes
- Full-text search indexes
- Composite indexes for common queries

### Migration 023: EntsorgungsBot Setup
- Created EntsorgungsBot system user
- Auto-add bot to all users' contacts
- Trigger for new user registration

### Migration 024: Fix KB Schema
- Renamed summary to excerpt in kb_article_versions
- Updated versioning trigger

### Migration 025: Message Pins
- message_pins table
- Pin important messages in conversations

### Migration 026: Messenger Enhancements
- quick_reply_templates
- contact_notes with tags
- Voice message support (audio_duration, transcription)
- Message forwarding
- Full-text search on messages

### Migration 027: Smart Notifications
- AI priority scoring (0-100)
- notification_preferences with DND
- notification_actions audit log
- notification_groups for auto-grouping
- Functions: calculate_notification_priority, is_dnd_active
- Triggers for auto-priority and grouping

### Migration 028: Task Templates
- task_templates table
- Pre-loaded German templates
- Usage count tracking

### Migration 029 (auto_prefs): Auto-Create Notification Prefs
- Trigger to create notification_preferences for new users
- Backfill for existing users
- Fixes broadcast API errors

### Migration 029/030 (kb_versions): KB Versioning
- Fixed kb_article_versions structure
- Auto-versioning trigger
- Change summary tracking

### Migration 030 (task_constraints): Update Task Constraints
- Added 'backlog', 'review' to task status
- Added 'urgent' to task priority
- Support for enhanced Kanban board

### Migration 031: Waste Disposal Responses
- waste_disposal_schedule_responses table
- Track user responses to bot reminders

### Migration 032: Broadcast History
- admin_broadcast_logs table
- Audit trail for admin broadcasts

### Migration 050: Rename Bot
- Renamed EntsorgungsBot → BL_Bot
- Updated email to bl_bot@biolab.de
- Upgraded role to admin
- Updated all related triggers and functions

### Migration 051: General Chat
- Created "General Chat" group conversation
- Auto-add all users to General Chat
- Trigger for new users
- Welcome message from BL_Bot

### Migration 052: Public Holidays
- public_holidays table
- Pre-loaded German federal holidays for 2025
- Recurrence support for annual holidays

### Migration 053: Barcode Images
- Added barcode_image_path to storage_bins
- Support for laser scanner image viewing
- Optimized index for pending bins

---

## Database Statistics

**Total Tables:** 60+
**Total Indexes:** 150+
**Total Triggers:** 20+
**Total Functions:** 15+

**Database Size (typical):**
- Small deployment (<100 users): ~50-200 MB
- Medium deployment (100-1000 users): ~500 MB - 2 GB
- Large deployment (1000+ users): 2-10+ GB

**Query Performance:**
- User login: <10ms
- Calendar view: <50ms
- Message list: <100ms
- Full-text search: <200ms
- Complex analytics: <1s

---

## Best Practices

### Data Integrity
- Always use foreign keys with appropriate CASCADE/SET NULL
- Use CHECK constraints for enum-like values
- Add UNIQUE constraints where applicable
- Use NOT NULL for required fields

### Performance
- Create indexes on foreign keys
- Use GIN indexes for JSONB and full-text search
- Use partial indexes for filtered queries
- Analyze queries with EXPLAIN ANALYZE

### Maintenance
- Regular VACUUM ANALYZE
- Monitor index usage
- Archive old data (stories, notifications)
- Clean up soft-deleted records

### Security
- Use parameterized queries (prevent SQL injection)
- Row-level security for multi-tenant scenarios
- Audit sensitive operations
- Hash passwords with bcrypt

### Scalability
- Use connection pooling
- Consider read replicas for reporting
- Archive historical data
- Partition large tables by date

---

**Document Version:** 1.0
**Last Updated:** November 19, 2025
**Maintained By:** Biolab Logistik Planner Team
