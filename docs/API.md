# Biolab Logistik Planner - API Documentation

Comprehensive API documentation for the Biolab Logistik Planner backend services.

**Base URL:** `/api`

**Version:** 1.0.0

**Last Updated:** 2025-01-19

---

## Table of Contents

1. [Authentication](#authentication)
2. [User Profile & Preferences](#user-profile--preferences)
3. [Scheduling & Calendar](#scheduling--calendar)
4. [Tasks & Task Pool](#tasks--task-pool)
5. [Kanban Board](#kanban-board)
6. [Messaging & Conversations](#messaging--conversations)
7. [Notifications](#notifications)
8. [Knowledge Base](#knowledge-base)
9. [Waste Management](#waste-management)
10. [Storage Bins (Kisten)](#storage-bins-kisten)
11. [Admin Management](#admin-management)
12. [Health & Monitoring](#health--monitoring)
13. [File Uploads](#file-uploads)
14. [Common Patterns](#common-patterns)
15. [Error Handling](#error-handling)
16. [WebSocket Events](#websocket-events)

---

## Quick Reference Table

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/login` | POST | No | User login |
| `/auth/register` | POST | No/Admin | User registration |
| `/auth/user` | GET | Yes | Get current user |
| `/profile/:userId` | GET | Yes | Get user profile |
| `/schedule/week/:weekStart` | GET | Yes | Get weekly schedule |
| `/tasks` | GET | Yes | Get all tasks |
| `/kanban/tasks` | GET | Yes | Get kanban tasks |
| `/messages/threads` | GET | Yes | Get message threads |
| `/notifications` | GET | Yes | Get notifications |
| `/kb/articles` | GET | Yes | Get KB articles |
| `/waste/items` | GET | Yes | Get waste items |
| `/kisten` | GET | Yes | Get storage bins |
| `/admin/users` | GET | Admin | Get all users |
| `/health` | GET | No | Health check |

---

## Authentication

### Check First Setup Status

**GET** `/auth/first-setup`

Checks if this is the first setup (no users exist).

**Authentication:** Not required

**Response Schema:**
```json
{
  "isFirstSetup": boolean,
  "reason": "no_users" | "no_superadmin" | "ready"
}
```

**Example Response:**
```json
{
  "isFirstSetup": true,
  "reason": "no_users"
}
```

---

### Register New User

**POST** `/auth/register`

Register a new user. First user becomes superadmin. Subsequent registrations require superadmin authentication.

**Authentication:** No (first user) / Superadmin (subsequent users)

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required)",
  "password": "string (required)",
  "role": "employee" | "admin" | "superadmin" | "observer",
  "employment_type": "Vollzeit" | "Werkstudent",
  "weekly_hours_quota": number
}
```

**Response Schema:**
```json
{
  "user": {
    "id": number,
    "name": "string",
    "email": "string",
    "role": "string",
    "employment_type": "string",
    "weekly_hours_quota": number,
    "first_login_completed": boolean,
    "created_at": "timestamp"
  },
  "token": "string (JWT token - only for first setup)",
  "isFirstSetup": boolean,
  "message": "string"
}
```

**Response Codes:**
- `201` - User created successfully
- `400` - Validation error
- `401` - Authentication required
- `403` - Superadmin permissions required
- `409` - User already exists
- `500` - Server error

**Example Request:**
```json
{
  "name": "Max Mustermann",
  "email": "max@example.com",
  "password": "SecurePass123!",
  "role": "employee",
  "employment_type": "Vollzeit",
  "weekly_hours_quota": 40
}
```

---

### Login

**POST** `/auth/login`

Authenticate user and receive JWT token.

**Authentication:** Not required

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response Schema:**
```json
{
  "token": "string (JWT)",
  "user": {
    "id": number,
    "name": "string",
    "email": "string",
    "role": "string",
    "employment_type": "string",
    "weekly_hours_quota": number,
    "first_login_completed": boolean
  },
  "message": "string"
}
```

**Response Codes:**
- `200` - Login successful
- `400` - Invalid credentials
- `403` - First setup required
- `500` - Server error

**Example Request:**
```json
{
  "email": "max@example.com",
  "password": "SecurePass123!"
}
```

**Example Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Max Mustermann",
    "email": "max@example.com",
    "role": "employee",
    "employment_type": "Vollzeit",
    "weekly_hours_quota": 40.0,
    "first_login_completed": true
  },
  "message": "Login successful"
}
```

---

### Get Current User

**GET** `/auth/user`

Get the currently authenticated user's data.

**Authentication:** Required

**Response Schema:**
```json
{
  "id": number,
  "name": "string",
  "email": "string",
  "role": "string",
  "employment_type": "string",
  "weekly_hours_quota": number,
  "first_login_completed": boolean,
  "created_at": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - User not found
- `500` - Server error

---

### Complete First Login

**POST** `/auth/complete-first-login`

Complete first login and set weekly hours quota.

**Authentication:** Required

**Request Body:**
```json
{
  "weekly_hours_quota": number (required, 0-80)
}
```

**Response Schema:**
```json
{
  "user": {
    "id": number,
    "name": "string",
    "email": "string",
    "role": "string",
    "employment_type": "string",
    "weekly_hours_quota": number,
    "first_login_completed": boolean
  },
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `400` - Invalid quota
- `404` - User not found
- `500` - Server error

---

## User Profile & Preferences

### Get User Profile

**GET** `/profile/:userId`

Get detailed user profile including preferences.

**Authentication:** Required

**URL Parameters:**
- `userId` - User ID

**Response Schema:**
```json
{
  "id": number,
  "name": "string",
  "email": "string",
  "role": "string",
  "employment_type": "string",
  "weekly_hours_quota": number,
  "profile_photo": "string (URL)",
  "status": "online" | "away" | "busy" | "offline",
  "status_message": "string",
  "bio": "string",
  "position_description": "string",
  "phone": "string",
  "phone_mobile": "string",
  "emergency_contact": "string",
  "emergency_phone": "string",
  "address": "string",
  "date_of_birth": "date",
  "hire_date": "date",
  "last_seen_at": "timestamp",
  "timezone": "string",
  "language": "string",
  "theme": "string",
  "created_at": "timestamp",
  "is_active": boolean,
  "email_notifications": boolean,
  "push_notifications": boolean,
  "desktop_notifications": boolean,
  "sound_enabled": boolean,
  "notify_messages": boolean,
  "notify_tasks": boolean,
  "notify_mentions": boolean,
  "notify_reactions": boolean,
  "notify_calendar": boolean,
  "compact_view": boolean,
  "show_avatars": boolean,
  "message_preview": boolean,
  "quiet_hours_enabled": boolean,
  "quiet_hours_start": "time",
  "quiet_hours_end": "time"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - User not found
- `500` - Server error

---

### Update User Profile

**PUT** `/profile/:userId`

Update user profile. Users can only edit their own profile unless they are admin/superadmin.

**Authentication:** Required

**URL Parameters:**
- `userId` - User ID

**Request Body:**
```json
{
  "name": "string",
  "status": "online" | "away" | "busy" | "offline",
  "status_message": "string",
  "bio": "string",
  "position_description": "string",
  "phone": "string",
  "phone_mobile": "string",
  "emergency_contact": "string",
  "emergency_phone": "string",
  "address": "string",
  "date_of_birth": "date",
  "timezone": "string",
  "language": "string",
  "theme": "string"
}
```

**Response Schema:** Same as Get User Profile

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Unauthorized
- `500` - Server error

**WebSocket Event:** `user:status_changed` (when status is updated)

---

### Upload Profile Photo

**POST** `/profile/:userId/photo`

Upload profile photo (supports Cloudinary or local storage).

**Authentication:** Required

**URL Parameters:**
- `userId` - User ID

**Request:** Multipart form data
- `photo` - Image file (max 25MB)

**Response Schema:**
```json
{
  "success": boolean,
  "photo_url": "string (URL)"
}
```

**Response Codes:**
- `200` - Success
- `400` - No file uploaded or invalid file
- `401` - Not authenticated
- `403` - Unauthorized
- `500` - Server error

---

### Update User Preferences

**PUT** `/profile/:userId/preferences`

Update notification and UI preferences.

**Authentication:** Required (only own preferences)

**URL Parameters:**
- `userId` - User ID

**Request Body:**
```json
{
  "email_notifications": boolean,
  "push_notifications": boolean,
  "desktop_notifications": boolean,
  "sound_enabled": boolean,
  "notify_messages": boolean,
  "notify_tasks": boolean,
  "notify_mentions": boolean,
  "notify_reactions": boolean,
  "notify_calendar": boolean,
  "compact_view": boolean,
  "show_avatars": boolean,
  "message_preview": boolean,
  "quiet_hours_enabled": boolean,
  "quiet_hours_start": "HH:MM",
  "quiet_hours_end": "HH:MM"
}
```

**Response Schema:**
```json
{
  "id": number,
  "user_id": number,
  "email_notifications": boolean,
  "push_notifications": boolean,
  "desktop_notifications": boolean,
  "sound_enabled": boolean,
  "notify_messages": boolean,
  "notify_tasks": boolean,
  "notify_mentions": boolean,
  "notify_reactions": boolean,
  "notify_calendar": boolean,
  "compact_view": boolean,
  "show_avatars": boolean,
  "message_preview": boolean,
  "quiet_hours_enabled": boolean,
  "quiet_hours_start": "time",
  "quiet_hours_end": "time",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Unauthorized
- `500` - Server error

---

### Get All Contacts

**GET** `/profile/contacts/all`

Get all active users as contacts with online status.

**Authentication:** Required

**Query Parameters:**
- `search` - Search by name or email
- `role` - Filter by role
- `status` - Filter by status

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "email": "string",
    "role": "string",
    "profile_photo": "string",
    "status": "string",
    "status_message": "string",
    "position_description": "string",
    "last_seen_at": "timestamp",
    "created_at": "timestamp",
    "is_system_user": boolean,
    "online": boolean
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Online Users

**GET** `/profile/online-users/list`

Get currently online users (active in last 5 minutes).

**Authentication:** Required

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "profile_photo": "string",
    "status": "string",
    "status_message": "string",
    "role": "string",
    "last_seen_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Stories Feed

**GET** `/profile/stories/feed`

Get active stories from all users (24-hour expiring content).

**Authentication:** Required

**Response Schema:**
```json
{
  "stories": [
    {
      "id": number,
      "user_id": number,
      "user_name": "string",
      "user_photo": "string",
      "media_url": "string",
      "media_type": "image" | "video",
      "caption": "string",
      "created_at": "timestamp",
      "expires_at": "timestamp",
      "view_count": number,
      "has_viewed": boolean
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Upload Story

**POST** `/profile/:userId/stories`

Upload a story (24-hour expiring content).

**Authentication:** Required (only own stories)

**URL Parameters:**
- `userId` - User ID

**Request:** Multipart form data
- `storyMedia` - Image/video file
- `caption` - Optional caption text

**Response Schema:**
```json
{
  "story": {
    "id": number,
    "user_id": number,
    "media_url": "string",
    "media_type": "string",
    "caption": "string",
    "created_at": "timestamp",
    "expires_at": "timestamp"
  }
}
```

**Response Codes:**
- `200` - Success
- `400` - No file uploaded
- `401` - Not authenticated
- `403` - Unauthorized
- `500` - Server error

---

### Mark Story as Viewed

**POST** `/profile/stories/:storyId/view`

Mark a story as viewed.

**Authentication:** Required

**URL Parameters:**
- `storyId` - Story ID

**Response Schema:**
```json
{
  "story": {
    "id": number,
    "view_count": number,
    "has_viewed": boolean
  }
}
```

**Response Codes:**
- `200` - Success
- `404` - Story not found
- `500` - Server error

---

## Scheduling & Calendar

### Get Weekly Schedule

**GET** `/schedule/week/:weekStart`

Get schedule for a specific week. Creates default schedule if none exists.

**Authentication:** Required

**URL Parameters:**
- `weekStart` - Week start date (YYYY-MM-DD, Monday)

**Query Parameters:**
- `userId` - Optional user ID (admin/superadmin only)

**Response Schema:**
```json
[
  {
    "id": number,
    "user_id": number,
    "week_start": "date",
    "day_of_week": number (0-6),
    "is_working": boolean,
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "time_blocks": [
      {
        "start": "HH:MM",
        "end": "HH:MM"
      }
    ],
    "notes": "string",
    "user_name": "string",
    "last_updated_by_name": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

**Example Response:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "week_start": "2025-01-13",
    "day_of_week": 0,
    "is_working": true,
    "start_time": "08:00",
    "end_time": "16:30",
    "time_blocks": [
      { "start": "08:00", "end": "12:00" },
      { "start": "12:30", "end": "16:30" }
    ],
    "notes": null,
    "user_name": "Max Mustermann",
    "last_updated_by_name": "Max Mustermann",
    "created_at": "2025-01-13T10:00:00Z",
    "updated_at": "2025-01-13T10:00:00Z"
  }
]
```

---

### Get Hours Summary for Week

**GET** `/schedule/hours-summary/:weekStart`

Get hours summary for a week (booked vs quota, adjusted for public holidays).

**Authentication:** Required

**URL Parameters:**
- `weekStart` - Week start date (YYYY-MM-DD)

**Query Parameters:**
- `userId` - Optional user ID (admin/superadmin only)

**Response Schema:**
```json
{
  "weeklyQuota": number,
  "expectedHours": number,
  "totalBooked": number,
  "difference": number,
  "status": "exact" | "under" | "over",
  "weekStart": "date",
  "workingDaysCount": number,
  "publicHolidaysCount": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - User not found
- `500` - Server error

**Example Response:**
```json
{
  "weeklyQuota": 40.0,
  "expectedHours": 32.0,
  "totalBooked": 32.0,
  "difference": 0.0,
  "status": "exact",
  "weekStart": "2025-01-13",
  "workingDaysCount": 4,
  "publicHolidaysCount": 1
}
```

---

### Update Schedule Day

**PUT** `/schedule/day/:id`

Update a single day in the schedule.

**Authentication:** Required (own schedule or admin)

**URL Parameters:**
- `id` - Schedule day ID

**Request Body:**
```json
{
  "isWorking": boolean,
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "timeBlocks": [
    {
      "start": "HH:MM",
      "end": "HH:MM"
    }
  ]
}
```

**Response Schema:** Same as weekly schedule item

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Unauthorized
- `404` - Schedule day not found
- `500` - Server error

**WebSocket Event:** `schedule:day_updated`

---

### Get Calendar Events

**GET** `/schedule/events`

Get all calendar events with optional filters.

**Authentication:** Required

**Query Parameters:**
- `startDate` or `start` - Filter by start date
- `endDate` or `end` - Filter by end date
- `userId` - Filter by user (admin/superadmin only)
- `type` - Filter by event type
- `priority` - Filter by priority

**Response Schema:**
```json
[
  {
    "id": number,
    "title": "string",
    "description": "string",
    "start_time": "timestamp",
    "end_time": "timestamp",
    "all_day": boolean,
    "event_type": "string",
    "color": "string",
    "location": "string",
    "attendees": ["string"],
    "attachments": [
      {
        "type": "image" | "audio" | "document",
        "url": "string",
        "name": "string",
        "mimeType": "string"
      }
    ],
    "cover_image": "string",
    "priority": "low" | "medium" | "high",
    "status": "confirmed" | "tentative" | "cancelled" | "completed",
    "category": "string",
    "reminder": number,
    "notes": "string",
    "tags": ["string"],
    "is_recurring": boolean,
    "recurrence_pattern": "string",
    "recurrence_end_date": "date",
    "created_by": number,
    "created_by_name": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "audio_url": "string"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create Calendar Event

**POST** `/schedule/events`

Create a new calendar event.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string",
  "startDate": "date (required)",
  "endDate": "date",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "all_day": boolean,
  "event_type": "string",
  "type": "string",
  "location": "string",
  "attendees": ["string"],
  "color": "string",
  "attachments": [
    {
      "type": "string",
      "url": "string",
      "name": "string",
      "mimeType": "string"
    }
  ],
  "priority": "low" | "medium" | "high",
  "status": "confirmed" | "tentative" | "cancelled",
  "category": "string",
  "reminder": number,
  "notes": "string",
  "tags": ["string"],
  "is_recurring": boolean,
  "recurrence_pattern": "string",
  "recurrence_end_date": "date"
}
```

**Response Schema:** Same as event object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `schedule:event_created`

---

### Update Calendar Event

**PUT** `/schedule/events/:id`

Update an existing calendar event.

**Authentication:** Required (owner, admin, or superadmin)

**URL Parameters:**
- `id` - Event ID

**Request Body:** Same as Create Calendar Event (all fields optional)

**Response Schema:** Same as event object

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Unauthorized
- `404` - Event not found
- `500` - Server error

**WebSocket Event:** `schedule:event_updated`

---

### Delete Calendar Event

**DELETE** `/schedule/events/:id`

Delete a calendar event.

**Authentication:** Required (owner, admin, or superadmin)

**URL Parameters:**
- `id` - Event ID

**Response Schema:**
```json
{
  "message": "string",
  "deletedId": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Unauthorized
- `404` - Event not found
- `500` - Server error

**WebSocket Event:** `schedule:event_deleted`

---

### Create Absence Event

**POST** `/schedule/absence`

Create an absence event (vacation, sick leave, overtime reduction).

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "start_date": "date (required)",
  "end_date": "date (required)",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "type": "Urlaub" | "Krankheit" | "Überstundenabbau",
  "is_all_day": boolean
}
```

**Response Schema:** Calendar event object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `calendar:event_created`

---

### Get Event Conflicts

**GET** `/events/conflicts`

Detect overlapping calendar events.

**Authentication:** Required

**Query Parameters:**
- `startDate` - Start date
- `endDate` - End date
- `userId` - Filter by user

**Response Schema:**
```json
[
  {
    "event1": {
      "id": number,
      "title": "string",
      "start_time": "timestamp",
      "end_time": "timestamp"
    },
    "event2": {
      "id": number,
      "title": "string",
      "start_time": "timestamp",
      "end_time": "timestamp"
    },
    "overlap_minutes": number,
    "severity": "high" | "medium" | "low"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

## Tasks & Task Pool

### Get All Tasks

**GET** `/tasks`

Get all tasks with optional status filter.

**Authentication:** Required

**Query Parameters:**
- `status` - Filter by status (todo, in_progress, done, cancelled)

**Response Schema:**
```json
[
  {
    "id": number,
    "title": "string",
    "description": "string",
    "status": "todo" | "in_progress" | "done" | "cancelled",
    "priority": "low" | "medium" | "high",
    "category": "string",
    "due_date": "date",
    "assigned_to": number,
    "assignee_name": "string",
    "created_by": number,
    "created_by_name": "string",
    "tags": ["string"],
    "completed_at": "timestamp",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Unified Task Board

**GET** `/tasks/board`

Get unified data for Kanban + Task Pool board.

**Authentication:** Required

**Query Parameters:**
- `date` - Target date (defaults to today)

**Response Schema:**
```json
{
  "date": "date",
  "counts": {
    "backlog": number,
    "poolAvailable": number,
    "inProgress": number,
    "needsHelp": number,
    "completed": number
  },
  "tasks": [
    {
      "id": number,
      "title": "string",
      "description": "string",
      "status": "string",
      "priority": "string",
      "category": "string",
      "dueDate": "date",
      "assigneeId": number,
      "assigneeName": "string",
      "createdById": number,
      "createdByName": "string",
      "tags": ["string"],
      "completedAt": "timestamp",
      "updatedAt": "timestamp",
      "attachmentsCount": number,
      "audioAttachmentCount": number,
      "commentsCount": number,
      "audioCommentCount": number,
      "pool": {
        "id": number,
        "status": "available" | "claimed" | "assigned" | "completed",
        "availableDate": "date",
        "estimatedDuration": number,
        "claimedBy": number,
        "claimedByName": "string",
        "assignedTo": number,
        "assignedToName": "string",
        "helpRequestedFrom": number,
        "helpRequestedFromName": "string",
        "helpMessage": "string",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create Task

**POST** `/tasks`

Create a new task.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string",
  "status": "todo" | "in_progress" | "done" | "cancelled",
  "priority": "low" | "medium" | "high",
  "assigneeId": number,
  "dueDate": "date",
  "tags": ["string"],
  "category": "string"
}
```

**Response Schema:** Task object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `task:created`

---

### Update Task

**PUT** `/tasks/:id`

Update an existing task.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "status": "string",
  "priority": "string",
  "assigneeId": number,
  "dueDate": "date",
  "tags": ["string"]
}
```

**Response Schema:** Task object

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

**WebSocket Event:** `task:updated` or `task:moved` (if status changed)

---

### Delete Task

**DELETE** `/tasks/:id`

Delete a task.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Response Schema:**
```json
{
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

**WebSocket Event:** `task:deleted`

---

### Get Task Pool - Today's Tasks

**GET** `/task-pool/today`

Get available tasks from the pool for today.

**Authentication:** Required

**Query Parameters:**
- `status` - Filter by status
- `priority` - Filter by priority
- `category` - Filter by category

**Response Schema:**
```json
[
  {
    "id": number,
    "task_id": number,
    "title": "string",
    "description": "string",
    "status": "available" | "claimed" | "assigned" | "completed",
    "priority": "string",
    "available_date": "date",
    "estimated_duration": number,
    "claimed_by": number,
    "claimed_by_name": "string",
    "assigned_to": number,
    "assigned_to_name": "string",
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Claim Task from Pool

**POST** `/task-pool/:taskPoolId/claim`

Claim an available task from the pool.

**Authentication:** Required

**URL Parameters:**
- `taskPoolId` - Task pool entry ID

**Response Schema:**
```json
{
  "task": {
    "id": number,
    "status": "claimed",
    "claimed_by": number,
    "claimed_by_name": "string",
    "claimed_at": "timestamp"
  }
}
```

**Response Codes:**
- `200` - Success
- `400` - Task already claimed
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

**WebSocket Event:** Task pool update

---

### Request Help on Task

**POST** `/task-pool/:taskPoolId/request-help`

Request help from another user on a task.

**Authentication:** Required

**URL Parameters:**
- `taskPoolId` - Task pool entry ID

**Request Body:**
```json
{
  "help_user_id": number (required),
  "message": "string"
}
```

**Response Schema:**
```json
{
  "help_request": {
    "id": number,
    "task_pool_id": number,
    "requested_by": number,
    "help_user_id": number,
    "message": "string",
    "status": "pending",
    "created_at": "timestamp"
  }
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

---

### Complete Task from Pool

**POST** `/task-pool/:taskPoolId/complete`

Mark a task pool entry as completed.

**Authentication:** Required

**URL Parameters:**
- `taskPoolId` - Task pool entry ID

**Response Schema:**
```json
{
  "task": {
    "id": number,
    "status": "completed",
    "completed_by": number,
    "completed_at": "timestamp"
  }
}
```

**Response Codes:**
- `200` - Success
- `400` - Task not claimed or assigned to user
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

---

## Kanban Board

### Get Kanban Tasks

**GET** `/kanban/tasks`

Get all kanban tasks with user info and counts.

**Authentication:** Required

**Response Schema:**
```json
[
  {
    "id": number,
    "title": "string",
    "description": "string",
    "status": "todo" | "in_progress" | "review" | "done",
    "priority": "low" | "medium" | "high" | "urgent",
    "assigned_to": number,
    "assignee_name": "string",
    "assignee_photo": "string",
    "created_by": number,
    "creator_name": "string",
    "due_date": "date",
    "category": "string",
    "tags": ["string"],
    "attachments_count": number,
    "comments_count": number,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Single Kanban Task

**GET** `/kanban/tasks/:id`

Get single task with full details including attachments and comments.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Response Schema:**
```json
{
  "id": number,
  "title": "string",
  "description": "string",
  "status": "string",
  "priority": "string",
  "assigned_to": number,
  "assignee_name": "string",
  "assignee_photo": "string",
  "created_by": number,
  "creator_name": "string",
  "due_date": "date",
  "category": "string",
  "tags": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "attachments": [
    {
      "id": number,
      "file_name": "string",
      "file_url": "string",
      "file_type": "string",
      "mime_type": "string",
      "file_size": number,
      "created_at": "timestamp"
    }
  ],
  "comments": [
    {
      "id": number,
      "task_id": number,
      "user_id": number,
      "user_name": "string",
      "user_photo": "string",
      "comment": "string",
      "audio_url": "string",
      "created_at": "timestamp"
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

---

### Create Kanban Task

**POST** `/kanban/tasks`

Create a new kanban task.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (required)",
  "description": "string",
  "status": "todo" | "in_progress" | "review" | "done",
  "priority": "low" | "medium" | "high" | "urgent",
  "assigned_to": number,
  "due_date": "date",
  "category": "string",
  "tags": ["string"]
}
```

**Response Schema:** Kanban task object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `task:created`

---

### Update Kanban Task

**PUT** `/kanban/tasks/:id`

Update a kanban task. Automatically syncs with linked waste items.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "status": "string",
  "priority": "string",
  "assigned_to": number,
  "due_date": "date",
  "category": "string",
  "tags": ["string"]
}
```

**Response Schema:** Kanban task object

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

**WebSocket Event:** `task:updated`

**Note:** When status is changed to `done`, linked waste items are automatically marked as `disposed`.

---

### Delete Kanban Task

**DELETE** `/kanban/tasks/:id`

Delete a kanban task.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Response Schema:**
```json
{
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Task not found
- `500` - Server error

**WebSocket Event:** `task:deleted`

---

### Add Task Comment

**POST** `/kanban/tasks/:id/comments`

Add a comment to a task with optional attachments.

**Authentication:** Required

**URL Parameters:**
- `id` - Task ID

**Request:** Multipart form data
- `comment_text` or `comment` - Comment text (required if no attachments)
- `attachments` - File attachments (max 5 files)

**Response Schema:**
```json
{
  "id": number,
  "task_id": number,
  "user_id": number,
  "user_name": "string",
  "user_photo": "string",
  "comment": "string",
  "attachments": [
    {
      "file_name": "string",
      "file_url": "string",
      "mime_type": "string",
      "file_size": number
    }
  ],
  "created_at": "timestamp"
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `task:comment`

---

## Messaging & Conversations

### Get Message Threads

**GET** `/messages/threads`

Get unified conversations (direct, groups, topics) for current user.

**Authentication:** Required

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "description": "string",
    "type": "direct" | "group" | "topic",
    "isTemporary": boolean,
    "expiresAt": "timestamp",
    "updatedAt": "timestamp",
    "participantCount": number,
    "unreadCount": number,
    "lastMessage": {
      "id": number,
      "content": "string",
      "messageType": "text" | "image" | "audio" | "gif",
      "createdAt": "timestamp",
      "senderId": number
    },
    "myRole": "owner" | "moderator" | "member",
    "myLastReadAt": "timestamp",
    "isMuted": boolean,
    "members": [
      {
        "user_id": number,
        "name": "string",
        "profile_photo": "string",
        "role": "string"
      }
    ]
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Conversation Messages

**GET** `/messages/conversations/:conversationId/messages`

Get all messages for a conversation.

**Authentication:** Required (member of conversation)

**URL Parameters:**
- `conversationId` - Conversation ID

**Response Schema:**
```json
[
  {
    "id": number,
    "conversation_id": number,
    "sender_id": number,
    "sender_name": "string",
    "sender_photo": "string",
    "receiver_id": number,
    "message": "string",
    "message_type": "text" | "image" | "audio" | "gif",
    "attachments": [
      {
        "type": "string",
        "url": "string",
        "name": "string",
        "mimeType": "string"
      }
    ],
    "quoted_message_id": number,
    "quoted_message": {
      "id": number,
      "message": "string",
      "sender_name": "string"
    },
    "reactions": [
      {
        "emoji": "string",
        "count": number,
        "user_ids": [number],
        "hasReacted": boolean
      }
    ],
    "mentions": [
      {
        "user_id": number,
        "user_name": "string"
      }
    ],
    "is_pinned": boolean,
    "is_forwarded": boolean,
    "forwarded_from_name": "string",
    "read_status": boolean,
    "read_at": "timestamp",
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Not a member of conversation
- `404` - Conversation not found
- `500` - Server error

---

### Create Conversation

**POST** `/messages/conversations`

Create a new group/topic conversation.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "memberIds": [number],
  "type": "group" | "topic" | "direct",
  "isTemporary": boolean,
  "expiresAt": "timestamp"
}
```

**Response Schema:**
```json
{
  "id": number,
  "name": "string",
  "description": "string",
  "type": "string",
  "isTemporary": boolean,
  "expiresAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "members": [
    {
      "user_id": number,
      "name": "string",
      "role": "owner" | "moderator" | "member"
    }
  ]
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `conversation:created`

---

### Send Message

**POST** `/messages` or **POST** `/messages/conversations/:conversationId/messages`

Send a message to a conversation or user.

**Authentication:** Required

**Request Body:**
```json
{
  "recipientId": number,
  "conversationId": number,
  "content": "string",
  "message": "string",
  "gif": "string (URL)",
  "attachments": [
    {
      "type": "string",
      "url": "string",
      "name": "string",
      "mimeType": "string"
    }
  ],
  "messageType": "text" | "image" | "audio" | "gif",
  "quotedMessageId": number,
  "mentionedUserIds": [number],
  "metadata": {}
}
```

**Response Schema:**
```json
{
  "conversationId": number,
  "message": {
    "id": number,
    "conversation_id": number,
    "sender_id": number,
    "sender_name": "string",
    "message": "string",
    "message_type": "string",
    "attachments": [],
    "created_at": "timestamp"
  },
  "conversation": {
    "id": number,
    "name": "string",
    "type": "string"
  },
  "members": [number]
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `403` - Not a member of conversation
- `404` - Conversation/recipient not found
- `500` - Server error

**WebSocket Event:** `conversation:new_message`

**Note:** Messages support @mentions. Use `@username` in message content to mention users. The system will automatically parse mentions and notify mentioned users.

---

### React to Message

**POST** `/messages/:messageId/react`

Add or remove a reaction on a message.

**Authentication:** Required (member of conversation)

**URL Parameters:**
- `messageId` - Message ID

**Request Body:**
```json
{
  "emoji": "string (required)"
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "action": "added" | "removed",
  "reactions": [
    {
      "emoji": "string",
      "count": number,
      "user_ids": [number],
      "hasReacted": boolean
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Not a member of conversation
- `404` - Message not found
- `500` - Server error

**WebSocket Event:** `message:reaction`

---

### Quote/Reply to Message

**POST** `/messages/:messageId/quote`

Create a reply that quotes an existing message.

**Authentication:** Required

**URL Parameters:**
- `messageId` - Message ID to quote

**Request Body:**
```json
{
  "content": "string (required)",
  "conversationId": number,
  "receiverId": number,
  "attachments": [],
  "metadata": {},
  "mentionedUserIds": [number]
}
```

**Response Schema:** Same as Send Message

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `404` - Original message not found
- `500` - Server error

---

### Pin Message

**POST** `/messages/:messageId/pin`

Pin or unpin a message in a conversation.

**Authentication:** Required (member of conversation)

**URL Parameters:**
- `messageId` - Message ID

**Response Schema:**
```json
{
  "success": boolean,
  "action": "pinned" | "unpinned"
}
```

**Response Codes:**
- `200` - Success
- `400` - Message not in conversation
- `401` - Not authenticated
- `403` - Not a member of conversation
- `404` - Message not found
- `500` - Server error

**WebSocket Event:** `message:pin`

---

### Forward Message

**POST** `/messages/:messageId/forward`

Forward message to multiple recipients.

**Authentication:** Required

**URL Parameters:**
- `messageId` - Message ID to forward

**Request Body:**
```json
{
  "recipientIds": [number] (required),
  "comment": "string"
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "forwardedCount": number,
  "messages": [
    {
      "id": number,
      "conversation_id": number,
      "message": "string",
      "is_forwarded": boolean,
      "created_at": "timestamp"
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `404` - Message not found
- `500` - Server error

---

### Search Messages

**GET** `/messages/search`

Full-text search messages.

**Authentication:** Required

**Query Parameters:**
- `q` - Search query (required, min 2 characters)
- `from` - Filter by sender ID
- `date` - Filter by date
- `type` - Filter by message type
- `limit` - Results limit (default: 50)
- `offset` - Results offset (default: 0)

**Response Schema:**
```json
{
  "results": [
    {
      "id": number,
      "sender_id": number,
      "sender_name": "string",
      "receiver_id": number,
      "receiver_name": "string",
      "message": "string",
      "message_type": "string",
      "created_at": "timestamp",
      "rank": number
    }
  ],
  "total": number,
  "limit": number,
  "offset": number
}
```

**Response Codes:**
- `200` - Success
- `400` - Invalid search query
- `401` - Not authenticated
- `500` - Server error

---

### Get Unread Message Count

**GET** `/messages/unread-count`

Get count of unread messages.

**Authentication:** Required

**Response Schema:**
```json
{
  "count": number,
  "unreadCount": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Mark Conversation as Read

**POST** `/messages/conversations/:conversationId/read`

Mark all messages in a conversation as read.

**Authentication:** Required (member of conversation)

**URL Parameters:**
- `conversationId` - Conversation ID

**Response Schema:**
```json
{
  "success": boolean
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Not a member of conversation
- `404` - Conversation not found
- `500` - Server error

---

## Notifications

### Get Notifications

**GET** `/notifications`

Get user notifications with optional filters.

**Authentication:** Required

**Query Parameters:**
- `type` - Filter by type (message, task_assigned, mention, reaction, calendar_event, etc.)
- `is_read` - Filter by read status (true/false)
- `limit` - Results limit (default: 50)
- `offset` - Results offset (default: 0)

**Response Schema:**
```json
{
  "notifications": [
    {
      "id": number,
      "user_id": number,
      "type": "string",
      "title": "string",
      "content": "string",
      "priority": "low" | "normal" | "high" | "urgent",
      "is_read": boolean,
      "read_at": "timestamp",
      "action_url": "string",
      "action_label": "string",
      "action_taken": "string",
      "action_taken_at": "timestamp",
      "metadata": {},
      "related_user_id": number,
      "related_user_name": "string",
      "task_id": number,
      "message_id": number,
      "event_id": number,
      "created_at": "timestamp"
    }
  ],
  "unread_count": number,
  "total": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Unread Count

**GET** `/notifications/unread-count`

Get unread notification count by type.

**Authentication:** Required

**Response Schema:**
```json
{
  "messages": number,
  "mentions": number,
  "reactions": number,
  "tasks": number,
  "events": number,
  "total": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Mark Notification as Read

**PUT** `/notifications/:id/read`

Mark a notification as read. Supports both database IDs and localStorage-generated IDs.

**Authentication:** Required

**URL Parameters:**
- `id` - Notification ID (integer or `notif-{timestamp}`)

**Response Schema:**
```json
{
  "id": number,
  "is_read": boolean,
  "read_at": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Notification not found
- `500` - Server error

---

### Mark All as Read

**PUT** `/notifications/mark-all-read`

Mark all notifications as read.

**Authentication:** Required

**Request Body:**
```json
{
  "type": "string (optional - filter by type)"
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "updated_count": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Clear All Read Notifications

**DELETE** `/notifications/clear-all`

Delete all read notifications.

**Authentication:** Required

**Response Schema:**
```json
{
  "success": boolean,
  "deleted_count": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Delete Notification

**DELETE** `/notifications/:id`

Delete a specific notification. Supports both database IDs and localStorage-generated IDs.

**Authentication:** Required

**URL Parameters:**
- `id` - Notification ID

**Response Schema:**
```json
{
  "success": boolean,
  "deleted_id": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Notification not found
- `500` - Server error

---

### Snooze Notification

**PUT** `/notifications/:id/snooze`

Snooze a notification for a specified duration.

**Authentication:** Required

**URL Parameters:**
- `id` - Notification ID

**Request Body:**
```json
{
  "minutes": number (default: 60)
}
```

**Response Schema:**
```json
{
  "id": number,
  "snoozed_until": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Notification not found
- `500` - Server error

---

### Dismiss Notification

**PUT** `/notifications/:id/dismiss`

Dismiss a notification permanently.

**Authentication:** Required

**URL Parameters:**
- `id` - Notification ID

**Response Schema:**
```json
{
  "id": number,
  "dismissed_at": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Notification not found
- `500` - Server error

---

### Get Smart Notifications

**GET** `/notifications/smart`

Get notifications with AI prioritization and grouping.

**Authentication:** Required

**Query Parameters:**
- `limit` - Results limit (default: 50)
- `offset` - Results offset (default: 0)
- `include_grouped` - Include grouped notifications (default: false)

**Response Schema:**
```json
{
  "notifications": [
    {
      "id": number,
      "ai_priority_score": number,
      "group_key": "string",
      "group_size": number,
      "group_summary": "string",
      "snoozed_until": "timestamp",
      "dismissed_at": "timestamp",
      "is_grouped": boolean,
      "parent_notification_id": number,
      ...
    }
  ],
  "groups": [
    {
      "group_key": "string",
      "user_id": number,
      "notification_count": number,
      "summary": "string",
      "is_read": boolean,
      "last_updated_at": "timestamp"
    }
  ],
  "unread_count": number,
  "is_dnd_active": boolean,
  "total": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get/Update Notification Preferences

**GET** `/notifications/preferences`
**PUT** `/notifications/preferences`

Get or update notification preferences including DND settings.

**Authentication:** Required

**Request Body (PUT):**
```json
{
  "dnd_enabled": boolean,
  "dnd_start_time": "HH:MM",
  "dnd_end_time": "HH:MM",
  "dnd_days": [0-6],
  "auto_group_enabled": boolean,
  "group_window_minutes": number,
  "priority_weight_urgency": number,
  "priority_weight_sender": number,
  "priority_weight_content": number,
  "notify_messages": boolean,
  "notify_tasks": boolean,
  "notify_events": boolean,
  "notify_waste": boolean,
  "notify_system": boolean,
  "desktop_notifications": boolean,
  "sound_enabled": boolean,
  "vibration_enabled": boolean,
  "vip_user_ids": [number],
  "muted_keywords": ["string"]
}
```

**Response Schema:**
```json
{
  "id": number,
  "user_id": number,
  "dnd_enabled": boolean,
  "dnd_start_time": "time",
  "dnd_end_time": "time",
  "dnd_days": [number],
  "auto_group_enabled": boolean,
  "group_window_minutes": number,
  "priority_weight_urgency": number,
  "priority_weight_sender": number,
  "priority_weight_content": number,
  "notify_messages": boolean,
  "notify_tasks": boolean,
  "notify_events": boolean,
  "notify_waste": boolean,
  "notify_system": boolean,
  "desktop_notifications": boolean,
  "sound_enabled": boolean,
  "vibration_enabled": boolean,
  "vip_user_ids": [number],
  "muted_keywords": ["string"],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error (PUT only)
- `401` - Not authenticated
- `500` - Server error

---

## Knowledge Base

### Get Categories

**GET** `/kb/categories`

Get all KB categories with article counts.

**Authentication:** Required

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "description": "string",
    "icon": "string",
    "color": "string",
    "parent_category_id": number,
    "display_order": number,
    "is_active": boolean,
    "created_by": number,
    "creator_name": "string",
    "articles_count": number,
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create Category

**POST** `/kb/categories`

Create a new KB category.

**Authentication:** Required (not observer)

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string",
  "icon": "string",
  "color": "string",
  "parent_category_id": number,
  "display_order": number
}
```

**Response Schema:** Category object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `403` - Observer role cannot create
- `500` - Server error

---

### Get Articles

**GET** `/kb/articles`

Get KB articles with optional filters.

**Authentication:** Required

**Query Parameters:**
- `category_id` - Filter by category
- `tag` - Filter by tag
- `search` - Full-text search
- `status` - Filter by status (default: published)
- `limit` - Results limit (default: 50)
- `offset` - Results offset (default: 0)
- `sort` - Sort by: recent, popular, helpful

**Response Schema:**
```json
[
  {
    "id": number,
    "title": "string",
    "slug": "string",
    "content": "string",
    "summary": "string",
    "category_id": number,
    "category_name": "string",
    "category_color": "string",
    "author_id": number,
    "author_name": "string",
    "author_photo": "string",
    "status": "draft" | "published" | "archived",
    "visibility": "everyone" | "employees" | "admins",
    "tags": ["string"],
    "view_count": number,
    "helpful_count": number,
    "not_helpful_count": number,
    "is_featured": boolean,
    "published_at": "timestamp",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "comments_count": number,
    "version_count": number,
    "user_vote": boolean
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Get Single Article

**GET** `/kb/articles/:id`

Get detailed article including comments. Increments view count.

**Authentication:** Required

**URL Parameters:**
- `id` - Article ID

**Response Schema:**
```json
{
  "id": number,
  "title": "string",
  "slug": "string",
  "content": "string",
  "summary": "string",
  "category_id": number,
  "category_name": "string",
  "category_color": "string",
  "category_icon": "string",
  "author_id": number,
  "author_name": "string",
  "author_photo": "string",
  "status": "string",
  "visibility": "string",
  "tags": ["string"],
  "view_count": number,
  "helpful_count": number,
  "not_helpful_count": number,
  "is_featured": boolean,
  "published_at": "timestamp",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "media": [],
  "comments": [
    {
      "id": number,
      "article_id": number,
      "user_id": number,
      "user_name": "string",
      "user_photo": "string",
      "comment_text": "string",
      "parent_comment_id": number,
      "created_at": "timestamp"
    }
  ],
  "user_vote": boolean,
  "version_count": number
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Article not found
- `500` - Server error

---

### Create Article

**POST** `/kb/articles`

Create a new KB article.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "excerpt": "string",
  "summary": "string",
  "category_id": number (required),
  "tags": ["string"],
  "status": "draft" | "published" | "archived",
  "visibility": "everyone" | "employees" | "admins"
}
```

**Response Schema:** Article object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `kb:article_published` (if status is published)

---

### Update Article

**PUT** `/kb/articles/:id`

Update an article. Creates version history automatically.

**Authentication:** Required (owner, admin, or superadmin)

**URL Parameters:**
- `id` - Article ID

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "excerpt": "string",
  "summary": "string",
  "category_id": number,
  "tags": ["string"],
  "status": "string",
  "visibility": "string",
  "featured": boolean,
  "pinned": boolean
}
```

**Response Schema:** Article object

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Unauthorized
- `404` - Article not found
- `500` - Server error

**WebSocket Event:** `kb:article_updated`

---

### Delete Article

**DELETE** `/kb/articles/:id`

Delete an article.

**Authentication:** Required (owner, admin, or superadmin)

**URL Parameters:**
- `id` - Article ID

**Response Schema:**
```json
{
  "success": boolean,
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Unauthorized
- `404` - Article not found
- `500` - Server error

**WebSocket Event:** `kb:article_deleted`

---

### Vote on Article

**POST** `/kb/articles/:id/vote`

Vote if article is helpful or not.

**Authentication:** Required

**URL Parameters:**
- `id` - Article ID

**Request Body:**
```json
{
  "is_helpful": boolean (required)
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "helpful_count": number,
  "not_helpful_count": number
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

---

### Add Comment

**POST** `/kb/articles/:id/comments`

Add a comment to an article.

**Authentication:** Required

**URL Parameters:**
- `id` - Article ID

**Request Body:**
```json
{
  "comment_text": "string (required)",
  "parent_comment_id": number
}
```

**Response Schema:**
```json
{
  "id": number,
  "article_id": number,
  "user_id": number,
  "user_name": "string",
  "user_photo": "string",
  "comment_text": "string",
  "parent_comment_id": number,
  "created_at": "timestamp"
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**WebSocket Event:** `kb:comment_added`

---

### Search Knowledge Base

**GET** `/kb/search`

Full-text search KB articles.

**Authentication:** Required

**Query Parameters:**
- `q` - Search query (required)
- `category` - Filter by category ID
- `tag` - Filter by tag
- `sort` - Sort by: relevance, recent, popular

**Response Schema:**
```json
[
  {
    "id": number,
    "title": "string",
    "content": "string",
    "summary": "string",
    "category_name": "string",
    "category_color": "string",
    "author_name": "string",
    "views_count": number,
    "rank": number,
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `400` - Search query required
- `401` - Not authenticated
- `500` - Server error

---

### Dictate Article

**POST** `/kb/articles/dictate`

Transcribe audio and generate KB instructions via OpenAI.

**Authentication:** Required

**Request:** Multipart form data
- `audio` - Audio file (required)
- `language` - Language hint (default: auto)

**Response Schema:**
```json
{
  "transcript": "string",
  "instructions": "string",
  "language": "string"
}
```

**Response Codes:**
- `200` - Success
- `400` - No audio file uploaded
- `500` - Server error (includes OpenAI errors)

**Note:** Requires OpenAI API key configuration.

---

### Translate Text

**POST** `/kb/translate`

Translate and improve text to German using OpenAI.

**Authentication:** Required

**Request Body:**
```json
{
  "text": "string (required)"
}
```

**Response Schema:**
```json
{
  "original": "string",
  "translated": "string"
}
```

**Response Codes:**
- `200` - Success
- `400` - Text required
- `500` - Server error

---

## Waste Management

### Get Waste Templates

**GET** `/waste/templates`

Get all waste disposal templates.

**Authentication:** Required

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "category": "string",
    "hazard_level": "low" | "medium" | "high" | "critical",
    "disposal_frequency_days": number,
    "color": "string",
    "icon": "string",
    "description": "string",
    "safety_instructions": "string",
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create Waste Template

**POST** `/waste/templates`

Create a new waste template.

**Authentication:** Admin only

**Request Body:**
```json
{
  "name": "string (required)",
  "category": "string (required)",
  "hazard_level": "low" | "medium" | "high" | "critical",
  "disposal_frequency_days": number,
  "color": "string",
  "icon": "string",
  "description": "string",
  "safety_instructions": "string"
}
```

**Response Schema:** Waste template object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `403` - Admin only
- `500` - Server error

---

### Get Waste Items

**GET** `/waste/items`

Get all waste items with template data and linked kanban tasks.

**Authentication:** Required

**Response Schema:**
```json
{
  "active": [
    {
      "id": number,
      "template_id": number,
      "template_name": "string",
      "template_description": "string",
      "color": "string",
      "icon": "string",
      "hazard_level": "string",
      "category": "string",
      "disposal_frequency_days": number,
      "name": "string",
      "location": "string",
      "quantity": number,
      "unit": "string",
      "status": "active" | "disposed" | "archived",
      "next_disposal_date": "date",
      "last_disposal_date": "date",
      "notes": "string",
      "kanban_task_id": number,
      "task_status": "string",
      "task_priority": "string",
      "task_due_date": "date",
      "task_assigned_to": number,
      "attachments": [
        {
          "id": number,
          "type": "string",
          "url": "string",
          "name": "string",
          "mimeType": "string",
          "size": number
        }
      ],
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ],
  "history": []
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create Waste Item

**POST** `/waste/items`

Create a new waste item. Automatically creates linked kanban task.

**Authentication:** Required

**Request Body:**
```json
{
  "template_id": number,
  "category": "string",
  "category_id": number,
  "name": "string (required)",
  "location": "string",
  "quantity": number,
  "unit": "string",
  "next_disposal_date": "date",
  "notes": "string",
  "attachments": [
    {
      "type": "string",
      "url": "string",
      "name": "string",
      "mimeType": "string",
      "size": number
    }
  ]
}
```

**Response Schema:** Waste item object with attachments

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**Note:** Either `template_id`, `category` name, or `category_id` is required. Attachments are linked to the automatically created kanban task.

---

### Update Waste Item

**PUT** `/waste/items/:id`

Update a waste item. Automatically syncs with linked kanban task.

**Authentication:** Required

**URL Parameters:**
- `id` - Waste item ID

**Request Body:**
```json
{
  "name": "string",
  "location": "string",
  "quantity": number,
  "unit": "string",
  "status": "active" | "disposed" | "archived",
  "next_disposal_date": "date",
  "last_disposal_date": "date",
  "notes": "string",
  "assigned_to": number
}
```

**Response Schema:**
```json
{
  "message": "string",
  "item": {
    "id": number,
    "status": "string",
    "updated_at": "timestamp",
    ...
  }
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `404` - Waste item not found
- `500` - Server error

**Note:** When status is changed to `disposed`, the linked kanban task is automatically marked as `done`.

---

### Delete Waste Item

**DELETE** `/waste/items/:id`

Delete a waste item and its linked kanban task.

**Authentication:** Required

**URL Parameters:**
- `id` - Waste item ID

**Response Schema:**
```json
{
  "success": boolean,
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `404` - Waste item not found
- `500` - Server error

---

### Get Waste Categories

**GET** `/waste-categories`

Get all waste categories with linked template IDs.

**Authentication:** Not required (public endpoint)

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "description": "string",
    "icon": "string",
    "color": "string",
    "instructions": "string",
    "safety_notes": "string",
    "image_url": "string",
    "disposal_frequency": "string",
    "template_id": number,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `500` - Server error

---

### Get Waste Statistics

**GET** `/waste/statistics`

Get comprehensive waste statistics with trends.

**Authentication:** Required

**Query Parameters:**
- `start_date` - Filter start date
- `end_date` - Filter end date
- `group_by` - Group by: day, week, month, year (default: month)

**Response Schema:**
```json
{
  "summary": {
    "total": number,
    "disposed": number,
    "pending": number,
    "avgDisposalDays": number
  },
  "byCategory": [
    {
      "category": "string",
      "color": "string",
      "count": number,
      "disposed": number
    }
  ],
  "byHazardLevel": [
    {
      "hazard_level": "string",
      "count": number,
      "percentage": number
    }
  ],
  "trend": [
    {
      "period": "timestamp",
      "count": number,
      "disposed": number,
      "pending": number
    }
  ],
  "topLocations": [
    {
      "location": "string",
      "count": number
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

## Storage Bins (Kisten)

### Get All Storage Bins

**GET** `/kisten`

Get all storage bins with enriched data. Automatically completes bins with done tasks.

**Authentication:** Required

**Response Schema:**
```json
{
  "bins": [
    {
      "id": number,
      "code": "string",
      "comment": "string",
      "keep_until": "date",
      "status": "pending" | "completed",
      "calendar_event_id": number,
      "task_id": number,
      "barcode_image_path": "string",
      "created_by": number,
      "completed_by": number,
      "completed_at": "timestamp",
      "created_at": "timestamp",
      "updated_at": "timestamp",
      "calendar_event": {
        "id": number,
        "title": "string",
        "start_time": "timestamp",
        "status": "string"
      },
      "task": {
        "id": number,
        "title": "string",
        "status": "string",
        "priority": "string"
      }
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

### Create/Update Storage Bins

**POST** `/kisten`

Create or update storage bins. Automatically generates barcodes and creates calendar events and kanban tasks.

**Authentication:** Required

**Request Body:**
```json
{
  "codes": ["string"] | "string (comma/newline separated)",
  "comment": "string",
  "keepUntil": "date (required)"
}
```

**Response Schema:**
```json
{
  "bins": [
    {
      "id": number,
      "code": "string",
      "comment": "string",
      "keep_until": "date",
      "status": "pending",
      "barcode_image_path": "string",
      "calendar_event_id": number,
      "task_id": number,
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `500` - Server error

**Note:**
- Creates/updates calendar events with title "Kistenprüfung: {code}"
- Creates/updates kanban tasks linked to bins
- Automatically generates barcode images for QR codes
- Sends notifications to creator and admins via bot

---

### Complete Storage Bin

**POST** `/kisten/:id/complete`

Mark a storage bin as completed. Also completes linked task and calendar event.

**Authentication:** Required

**URL Parameters:**
- `id` - Storage bin ID

**Response Schema:**
```json
{
  "bins": [...]
}
```

**Response Codes:**
- `200` - Success
- `400` - Already completed
- `401` - Not authenticated
- `404` - Bin not found
- `500` - Server error

**Note:** Sends confirmation message to user via bot.

---

### Upload Barcode Image

**POST** `/kisten/:id/barcode`

Upload a barcode image for a storage bin.

**Authentication:** Required

**URL Parameters:**
- `id` - Storage bin ID

**Request:** Multipart form data
- `barcodeImage` - Image file (max 10MB, jpeg/jpg/png/gif/webp)

**Response Schema:**
```json
{
  "success": boolean,
  "barcode_image_path": "string",
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `400` - Invalid file
- `401` - Not authenticated
- `404` - Bin not found
- `500` - Server error

---

### Get Bins by Date

**GET** `/kisten/by-date/:date`

Get storage bins by disposal date.

**Authentication:** Required

**URL Parameters:**
- `date` - Disposal date (YYYY-MM-DD)

**Response Schema:**
```json
{
  "bins": [
    {
      "id": number,
      "code": "string",
      "comment": "string",
      "keep_until": "date",
      "status": "pending",
      "barcode_image_path": "string",
      "created_by": number,
      "created_by_name": "string",
      "calendar_title": "string",
      "has_barcode": boolean,
      "created_at": "timestamp"
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `500` - Server error

---

## Admin Management

### Get All Users

**GET** `/admin/users`

Get all users with detailed information.

**Authentication:** Admin/Superadmin only

**Query Parameters:**
- `role` - Filter by role
- `is_active` - Filter by active status
- `search` - Search by name or email

**Response Schema:**
```json
[
  {
    "id": number,
    "name": "string",
    "email": "string",
    "role": "string",
    "employment_type": "string",
    "weekly_hours_quota": number,
    "profile_photo": "string",
    "status": "string",
    "is_active": boolean,
    "last_seen_at": "timestamp",
    "created_at": "timestamp"
  }
]
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

---

### Create User

**POST** `/admin/users`

Create a new user (admin function).

**Authentication:** Admin/Superadmin only

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required)",
  "password": "string (required)",
  "role": "employee" | "admin" | "superadmin" | "observer",
  "employment_type": "Vollzeit" | "Werkstudent",
  "weekly_hours_quota": number
}
```

**Response Schema:** User object

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `403` - Admin access required
- `409` - User already exists
- `500` - Server error

---

### Update User

**PUT** `/admin/users/:id`

Update user information with validation.

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `id` - User ID

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "role": "string",
  "employment_type": "string",
  "weekly_hours_quota": number,
  "is_active": boolean
}
```

**Response Schema:** Updated user object

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Admin access required / Cannot modify superadmin
- `404` - User not found
- `500` - Server error

---

### Delete User

**DELETE** `/admin/users/:id`

Delete a user (soft delete - marks as inactive).

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `id` - User ID

**Response Schema:**
```json
{
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required / Cannot delete superadmin
- `404` - User not found
- `500` - Server error

---

### Activate User

**POST** `/admin/users/:id/activate`

Activate a deactivated user.

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `id` - User ID

**Response Schema:** User object

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required
- `404` - User not found
- `500` - Server error

---

### Deactivate User

**POST** `/admin/users/:id/deactivate`

Deactivate a user.

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `id` - User ID

**Response Schema:** User object

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required / Cannot deactivate superadmin
- `404` - User not found
- `500` - Server error

---

### Reset User Password

**POST** `/admin/users/:id/reset-password`

Generate temporary password for user.

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `id` - User ID

**Response Schema:**
```json
{
  "message": "string",
  "temporaryPassword": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required
- `404` - User not found
- `500` - Server error

---

### Get Dashboard Statistics

**GET** `/admin/stats`

Get aggregated dashboard metrics.

**Authentication:** Admin/Superadmin only

**Response Schema:**
```json
{
  "users": {
    "total": number,
    "active": number,
    "inactive": number,
    "online": number
  },
  "tasks": {
    "total": number,
    "todo": number,
    "in_progress": number,
    "done": number,
    "overdue": number
  },
  "events": {
    "total": number,
    "upcoming": number,
    "today": number
  },
  "messages": {
    "total": number,
    "today": number
  },
  "waste": {
    "active": number,
    "disposed": number,
    "pending_disposal": number
  },
  "storage_bins": {
    "pending": number,
    "completed": number
  }
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

---

### Get System Health

**GET** `/admin/system-health`

Get realtime system diagnostics.

**Authentication:** Admin/Superadmin only

**Response Schema:**
```json
{
  "database": {
    "status": "healthy" | "degraded" | "down",
    "responseTime": number,
    "connections": number
  },
  "memory": {
    "used": number,
    "total": number,
    "percentage": number
  },
  "uptime": number,
  "version": "string"
}
```

**Response Codes:**
- `200` - Success
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

---

### Export Data

**GET** `/admin/export/:type`

Export datasets in CSV/JSON format.

**Authentication:** Admin/Superadmin only

**URL Parameters:**
- `type` - Export type: users, events, tasks, waste, kb-articles

**Query Parameters:**
- `format` - Export format: csv, json (default: csv)

**Response:** File download (CSV or JSON)

**Response Codes:**
- `200` - Success
- `400` - Invalid export type
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

---

### Broadcast Message

**POST** `/admin/broadcast`

Broadcast message to all users via notifications and WebSocket.

**Authentication:** Admin/Superadmin only

**Request Body:**
```json
{
  "title": "string (required)",
  "message": "string (required)",
  "priority": "low" | "normal" | "high" | "urgent",
  "target_roles": ["employee", "admin", "superadmin", "observer"]
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "broadcast_id": number,
  "recipients_count": number
}
```

**Response Codes:**
- `201` - Created
- `400` - Validation error
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

**WebSocket Event:** `admin:broadcast`

---

### Bulk User Operations

**POST** `/admin/users/bulk`

Perform bulk operations on users.

**Authentication:** Admin/Superadmin only

**Request Body:**
```json
{
  "action": "activate" | "deactivate" | "delete" | "updateRole",
  "userIds": [number] (required),
  "role": "string (required if action is updateRole)"
}
```

**Response Schema:**
```json
{
  "success": boolean,
  "affected_count": number,
  "message": "string"
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `403` - Admin access required
- `500` - Server error

---

## Health & Monitoring

### Basic Health Check

**GET** `/health`

Lightweight health check endpoint.

**Authentication:** Not required

**Response Schema:**
```json
{
  "status": "ok" | "error",
  "timestamp": "timestamp",
  "uptime": number
}
```

**Response Codes:**
- `200` - Healthy
- `503` - Unhealthy

---

### Detailed Health Check

**GET** `/health/detailed`

Detailed health check for all subsystems.

**Authentication:** Not required

**Response Schema:**
```json
{
  "status": "healthy" | "degraded" | "critical",
  "timestamp": "timestamp",
  "uptime": number,
  "checks": {
    "database": {
      "status": "healthy" | "degraded" | "critical",
      "responseTime": number,
      "message": "string"
    },
    "memory": {
      "status": "healthy" | "degraded" | "critical",
      "used": number,
      "total": number,
      "percentage": number
    },
    "disk": {
      "status": "healthy" | "degraded" | "critical",
      "used": number,
      "total": number,
      "percentage": number
    },
    "redis": {
      "status": "healthy" | "degraded" | "critical",
      "connected": boolean
    },
    "websocket": {
      "status": "healthy" | "degraded" | "critical",
      "connections": number
    }
  }
}
```

**Response Codes:**
- `200` - Healthy or degraded
- `503` - Critical

---

### Readiness Probe

**GET** `/health/ready`

Kubernetes readiness probe endpoint.

**Authentication:** Not required

**Response Schema:**
```json
{
  "ready": boolean,
  "checks": {
    "database": "string",
    "redis": "string"
  }
}
```

**Response Codes:**
- `200` - Ready
- `503` - Not ready

---

### Liveness Probe

**GET** `/health/live`

Kubernetes liveness probe endpoint.

**Authentication:** Not required

**Response Schema:**
```json
{
  "alive": boolean
}
```

**Response Codes:**
- `200` - Alive
- `503` - Not alive

---

### System Metrics

**GET** `/health/metrics`

Get detailed system metrics.

**Authentication:** Not required

**Response Schema:**
```json
{
  "process": {
    "uptime": number,
    "memory": {
      "rss": number,
      "heapTotal": number,
      "heapUsed": number,
      "external": number
    },
    "cpu": {
      "user": number,
      "system": number
    }
  },
  "system": {
    "platform": "string",
    "arch": "string",
    "nodeVersion": "string",
    "totalMemory": number,
    "freeMemory": number,
    "cpus": number,
    "loadAverage": [number]
  }
}
```

**Response Codes:**
- `200` - Success

---

## File Uploads

### Upload File

**POST** `/uploads`

Upload a single file for various contexts (messages, calendar, tasks, general).

**Authentication:** Required

**Request:** Multipart form data
- `file` - File to upload (max 25MB)
- `context` - Upload context: message, calendar, task, general (default: general)

**Supported File Types:**
- Images: png, jpeg, webp, gif
- Audio: mpeg, wav, ogg, webm, mp4

**Response Schema:**
```json
{
  "success": boolean,
  "file": {
    "filename": "string",
    "originalname": "string",
    "path": "string",
    "url": "string",
    "size": number,
    "mimetype": "string"
  }
}
```

**Response Codes:**
- `200` - Success
- `400` - No file uploaded or invalid file type
- `401` - Not authenticated
- `413` - File too large
- `500` - Server error

**Example Response:**
```json
{
  "success": true,
  "file": {
    "filename": "message-1737307200000-abc123.png",
    "originalname": "screenshot.png",
    "path": "uploads/message/message-1737307200000-abc123.png",
    "url": "/uploads/message/message-1737307200000-abc123.png",
    "size": 524288,
    "mimetype": "image/png"
  }
}
```

---

### Upload Multiple Files

**POST** `/uploads/multiple`

Upload multiple files (max 10).

**Authentication:** Required

**Request:** Multipart form data
- `files` - Multiple files (max 10, each max 25MB)
- `context` - Upload context: message, calendar, task, general (default: general)

**Response Schema:**
```json
{
  "success": boolean,
  "files": [
    {
      "filename": "string",
      "originalname": "string",
      "path": "string",
      "url": "string",
      "size": number,
      "mimetype": "string"
    }
  ]
}
```

**Response Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Not authenticated
- `413` - File too large
- `500` - Server error

---

## Common Patterns

### Pagination

Most list endpoints support pagination through query parameters:

```
GET /api/endpoint?limit=50&offset=0
```

- `limit` - Number of items per page (default varies by endpoint)
- `offset` - Number of items to skip

### Filtering

Common filter patterns:

```
GET /api/tasks?status=todo&priority=high
GET /api/messages?userId=5
GET /api/schedule/events?startDate=2025-01-01&endDate=2025-01-31
```

### Searching

Full-text search endpoints:

```
GET /api/kb/search?q=disposal&sort=relevance
GET /api/messages/search?q=meeting&from=5&type=text
```

### Sorting

Common sort parameters:

```
GET /api/kb/articles?sort=popular
GET /api/kb/articles?sort=recent
GET /api/kb/articles?sort=helpful
```

### Date Formats

- **Dates:** `YYYY-MM-DD` (e.g., `2025-01-19`)
- **Times:** `HH:MM` (e.g., `14:30`)
- **Timestamps:** ISO 8601 (e.g., `2025-01-19T14:30:00.000Z`)

### Response Formats

All responses are JSON with consistent structure:

**Success Response:**
```json
{
  "data": {},
  "message": "string (optional)"
}
```

**Error Response:**
```json
{
  "error": "string",
  "details": "string (development only)"
}
```

---

## Error Handling

### Standard Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Validation error, missing required fields |
| 401 | Unauthorized | Not authenticated, invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Duplicate entry, constraint violation |
| 413 | Payload Too Large | File upload exceeds size limit |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Service unhealthy or degraded |

### Error Response Examples

**Validation Error:**
```json
{
  "error": "Titel ist erforderlich"
}
```

**Authentication Error:**
```json
{
  "error": "Invalid or expired token"
}
```

**Permission Error:**
```json
{
  "error": "Unauthorized",
  "details": "Only superadmin can perform this action"
}
```

**Not Found:**
```json
{
  "error": "User not found"
}
```

**Conflict:**
```json
{
  "error": "User with this email already exists"
}
```

---

## WebSocket Events

The application uses Socket.io for real-time communication. Connect to the WebSocket server using the same JWT token used for HTTP requests.

### Connection

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### User Rooms

Upon connection, users are automatically joined to:
- `user_{userId}` - Personal room for user-specific events

### Event Categories

#### Authentication Events

- `user:connected` - User connected to WebSocket
- `user:disconnected` - User disconnected

#### Task Events

- `task:created` - New task created
  ```json
  {
    "task": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `task:updated` - Task updated
  ```json
  {
    "task": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `task:moved` - Task status changed (moved between columns)
  ```json
  {
    "task": {...},
    "user": { "id": number, "name": "string" },
    "previousStatus": "string"
  }
  ```

- `task:deleted` - Task deleted
  ```json
  {
    "taskId": number,
    "task": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `task:comment` - Comment added to task
  ```json
  {
    "taskId": number,
    "comment": {...}
  }
  ```

#### Message Events

- `conversation:new_message` - New message in conversation
  ```json
  {
    "conversationId": number,
    "message": {...}
  }
  ```

- `conversation:created` - New conversation created
  ```json
  {
    "conversation": {...},
    "members": [...]
  }
  ```

- `conversation:members_updated` - Conversation members changed
  ```json
  {
    "conversationId": number,
    "members": [...],
    "addedMemberIds": [number],
    "removedMemberId": number
  }
  ```

- `conversation:removed` - User removed from conversation
  ```json
  {
    "conversationId": number
  }
  ```

- `message:reaction` - Reaction added/removed
  ```json
  {
    "messageId": number,
    "conversationId": number,
    "reactions": [...],
    "action": "added" | "removed",
    "user": { "id": number, "name": "string" }
  }
  ```

- `message:mentioned` - User mentioned in message
  ```json
  {
    "messageId": number,
    "mentionedBy": { "id": number, "name": "string" }
  }
  ```

- `message:pin` - Message pinned/unpinned
  ```json
  {
    "messageId": number,
    "conversationId": number,
    "action": "pinned" | "unpinned",
    "user": { "id": number, "name": "string" }
  }
  ```

- `message:read` - Message marked as read
  ```json
  {
    "messageId": number,
    "userId": number
  }
  ```

- `message:deleted` - Message deleted
  ```json
  {
    "messageId": number,
    "senderId": number,
    "recipientId": number
  }
  ```

- `user:typing` - User is typing
  ```json
  {
    "userId": number,
    "userName": "string",
    "recipientId": number,
    "isTyping": boolean
  }
  ```

#### Schedule Events

- `schedule:day_updated` - Schedule day updated
  ```json
  {
    "day": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `schedule:week_updated` - Week schedule updated
  ```json
  {
    "weekStart": "date",
    "days": [...],
    "user": { "id": number, "name": "string" }
  }
  ```

- `schedule:event_created` - Calendar event created
  ```json
  {
    "event": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `schedule:event_updated` - Calendar event updated
  ```json
  {
    "event": {...},
    "user": { "id": number, "name": "string" }
  }
  ```

- `schedule:event_deleted` - Calendar event deleted
  ```json
  {
    "eventId": number,
    "user": { "id": number, "name": "string" }
  }
  ```

- `calendar:event_created` - Calendar event created (alternate)
  ```json
  {
    "event": {...},
    "createdBy": { "id": number, "name": "string" }
  }
  ```

#### User Status Events

- `user:status_changed` - User status changed
  ```json
  {
    "userId": number,
    "status": "online" | "away" | "busy" | "offline",
    "status_message": "string"
  }
  ```

#### Notification Events

- `notification:new` - New notification
  ```json
  {
    "id": number,
    "type": "string",
    "title": "string",
    "content": "string",
    "priority": "string",
    "created_at": "timestamp"
  }
  ```

#### Knowledge Base Events

- `kb:article_published` - Article published
  ```json
  {
    "article": {...}
  }
  ```

- `kb:article_updated` - Article updated
  ```json
  {
    "article": {...}
  }
  ```

- `kb:article_deleted` - Article deleted
  ```json
  {
    "articleId": number
  }
  ```

- `kb:comment_added` - Comment added to article
  ```json
  {
    "articleId": number,
    "comment": {...}
  }
  ```

#### Admin Events

- `admin:broadcast` - Admin broadcast message
  ```json
  {
    "title": "string",
    "message": "string",
    "priority": "string",
    "timestamp": "timestamp"
  }
  ```

### Client-Side Event Listening

```javascript
// Task events
socket.on('task:created', (data) => {
  console.log('New task:', data.task);
});

socket.on('task:updated', (data) => {
  console.log('Task updated:', data.task);
});

// Message events
socket.on('conversation:new_message', (data) => {
  console.log('New message:', data.message);
});

// Notification events
socket.on('notification:new', (data) => {
  console.log('New notification:', data);
});

// User status events
socket.on('user:status_changed', (data) => {
  console.log('Status changed:', data.userId, data.status);
});
```

---

## Authentication Headers

Include JWT token in all authenticated requests:

```
Authorization: Bearer {your-jwt-token}
```

**Example:**
```javascript
fetch('/api/tasks', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Rate Limiting

Currently no rate limiting is implemented. This may be added in future versions.

---

## API Versioning

Current version: **v1** (implicit)

The API is not versioned in the URL. Breaking changes will be communicated through release notes.

---

## Support & Contact

For API support or questions, contact the development team or file an issue in the project repository.

---

**End of API Documentation**
