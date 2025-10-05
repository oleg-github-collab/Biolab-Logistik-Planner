# Advanced Waste Disposal Planning System

## Overview

The Advanced Waste Disposal Planning System is a comprehensive solution for managing and scheduling waste disposal in a biolab environment. It features an interactive calendar, drag-and-drop rescheduling, automated reminders, and real-time notifications.

## Features

### 1. Interactive Calendar View
- **Full Calendar Integration**: Uses `react-big-calendar` with multiple views (month, week, day, agenda)
- **Drag & Drop**: Reschedule disposal events by dragging them to new dates
- **Color-Coded Events**: Events are color-coded by hazard level and status
  - Critical: Red (#EF4444)
  - High: Orange (#F59E0B)
  - Medium: Blue (#3B82F6)
  - Low: Purple (#8B5CF6)
  - Completed: Green (#10B981)
  - Cancelled: Gray (#6B7280)
  - Overdue: Red (#DC2626)

### 2. Automated Notifications
- **7-Day Reminder**: Notification sent 7 days before scheduled disposal
- **3-Day Reminder**: Notification sent 3 days before scheduled disposal
- **1-Day Reminder**: Notification sent 1 day before scheduled disposal
- **Day-of Reminder**: Notification sent on the day of disposal
- **Overdue Alerts**: Urgent notifications for overdue disposals

### 3. Recurring Schedules
Supports various recurrence patterns:
- Daily
- Weekly
- Bi-weekly
- Monthly
- Quarterly
- Yearly

### 4. Batch Planning
- Schedule multiple waste items at once
- Assign to specific users
- Set priority levels automatically based on hazard level

### 5. Conflict Detection
- Warns when too many disposals are scheduled for the same day
- Configurable maximum per day (default: 5)
- Highlights days with critical waste disposals

### 6. Export Functionality
- Export to CSV format
- Export to JSON format
- Includes all schedule details and metadata

### 7. Real-Time Updates
- WebSocket integration for instant notifications
- Push notifications (browser-based)
- Auto-refresh every 5 minutes

## Database Schema

### `waste_disposal_schedule` Table

```sql
CREATE TABLE waste_disposal_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  waste_item_id INTEGER NOT NULL,
  scheduled_date DATETIME NOT NULL,
  actual_date DATETIME,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'rescheduled', 'overdue'
  assigned_to INTEGER,
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT 0,
  reminder_dates TEXT, -- JSON array of reminder dates
  is_recurring BOOLEAN DEFAULT 0,
  recurrence_pattern TEXT, -- 'weekly', 'monthly', 'quarterly', 'yearly'
  recurrence_end_date DATETIME,
  next_occurrence DATETIME,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  disposal_method TEXT,
  quantity TEXT,
  unit TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (waste_item_id) REFERENCES waste_items (id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);
```

## Backend API Endpoints

### 1. Get Disposal Schedule
```
GET /api/waste/schedule
```

**Query Parameters:**
- `startDate`: Filter by start date (ISO 8601)
- `endDate`: Filter by end date (ISO 8601)
- `status`: Filter by status (scheduled, completed, cancelled, overdue)
- `assignedTo`: Filter by assigned user ID
- `wasteItemId`: Filter by waste item ID
- `hazardLevel`: Filter by hazard level (critical, high, medium, low)
- `category`: Filter by category

**Response:**
```json
[
  {
    "id": 1,
    "waste_item_id": 5,
    "waste_name": "Lösungsmittel - Kanister 140603",
    "scheduled_date": "2025-10-15T10:00:00.000Z",
    "status": "scheduled",
    "hazard_level": "high",
    "category": "chemical",
    "assigned_to": 2,
    "assigned_to_name": "John Doe",
    "reminder_dates": ["2025-10-08T10:00:00.000Z", "2025-10-12T10:00:00.000Z"],
    "priority": "high",
    "quantity": "25",
    "unit": "kg"
  }
]
```

### 2. Get Upcoming Disposals
```
GET /api/waste/schedule/upcoming?days=30
```

**Response:** Array of upcoming disposal schedules

### 3. Create Disposal Schedule
```
POST /api/waste/schedule
```

**Request Body:**
```json
{
  "waste_item_id": 5,
  "scheduled_date": "2025-10-15T10:00:00.000Z",
  "assigned_to": 2,
  "notes": "Handle with care",
  "priority": "high",
  "disposal_method": "Incineration",
  "quantity": "25",
  "unit": "kg",
  "is_recurring": true,
  "recurrence_pattern": "monthly",
  "recurrence_end_date": "2026-10-15T10:00:00.000Z"
}
```

### 4. Update Disposal Schedule
```
PUT /api/waste/schedule/:id
```

**Request Body:** (all fields optional)
```json
{
  "scheduled_date": "2025-10-16T10:00:00.000Z",
  "status": "rescheduled",
  "notes": "Updated notes"
}
```

### 5. Delete Disposal Schedule
```
DELETE /api/waste/schedule/:id
```

### 6. Batch Create Schedules
```
POST /api/waste/schedule/batch
```

**Request Body:**
```json
{
  "schedules": [
    {
      "waste_item_id": 5,
      "scheduled_date": "2025-10-15T10:00:00.000Z",
      "assigned_to": 2,
      "priority": "high"
    },
    {
      "waste_item_id": 6,
      "scheduled_date": "2025-10-15T10:00:00.000Z",
      "assigned_to": 2,
      "priority": "medium"
    }
  ]
}
```

### 7. Set Custom Reminder
```
POST /api/waste/schedule/:id/reminder
```

**Request Body:**
```json
{
  "reminder_dates": [
    "2025-10-08T10:00:00.000Z",
    "2025-10-12T10:00:00.000Z",
    "2025-10-14T10:00:00.000Z"
  ]
}
```

### 8. Mark as Completed
```
POST /api/waste/schedule/:id/complete
```

**Request Body:**
```json
{
  "actual_date": "2025-10-15T14:30:00.000Z",
  "notes": "Completed successfully"
}
```

### 9. Check for Conflicts
```
GET /api/waste/schedule/conflicts?date=2025-10-15&maxPerDay=5
```

## Frontend Component Usage

### Basic Integration

```jsx
import WasteDisposalPlanner from './components/WasteDisposalPlanner';

function App() {
  return (
    <div>
      <WasteDisposalPlanner />
    </div>
  );
}
```

### Component Features

#### 1. Quick Stats Dashboard
- Total scheduled disposals
- Upcoming disposals (next 7 days)
- Overdue disposals count
- Completed disposals count

#### 2. Advanced Filtering
```jsx
// Filters available in the UI
const filters = {
  status: 'all', // scheduled, completed, cancelled, overdue
  hazardLevel: 'all', // critical, high, medium, low
  category: 'all', // chemical, heavy_metal, aqueous, hazardous, general
  assignedTo: 'all' // User ID
};
```

#### 3. Calendar Views
- **Month View**: Overview of all disposals in a month
- **Week View**: Detailed week schedule
- **Day View**: Hour-by-hour disposal schedule
- **Agenda View**: List view of upcoming disposals

#### 4. Drag & Drop Rescheduling
Simply drag an event to a new date on the calendar. The system will:
1. Check for conflicts
2. Warn if the day is too busy
3. Update the schedule
4. Send notifications to assigned users

#### 5. Creating Schedules

**Single Schedule:**
1. Click on a date in the calendar
2. Fill in the form:
   - Select waste item
   - Set date/time
   - Assign to user
   - Set priority
   - Add disposal method, quantity, and notes
3. Optionally enable recurring schedule
4. Click "Create Schedule"

**Batch Schedule:**
1. Select multiple waste items
2. Choose a date
3. Assign to user
4. Click "Batch Create"

#### 6. Event Details Modal
Click on any event to see:
- Full waste item details
- Schedule information
- Assigned user
- Hazard level and category
- Notes and disposal method
- Quick actions (Mark Complete, Delete)

## Notification System

### Scheduled Jobs

#### Hourly Reminder Check (Every hour at :00)
```javascript
// Cron: '0 * * * *'
- Checks for reminders due in the next hour
- Sends browser notifications to assigned users
- Updates reminder_sent status
```

#### Daily Overdue Check (Every day at 9:00 AM)
```javascript
// Cron: '0 9 * * *'
- Identifies overdue disposals
- Updates status to 'overdue'
- Sends urgent notifications
```

### Notification Types

1. **Standard Reminder** (7, 3, 1 days before)
   ```javascript
   {
     title: 'Waste Disposal Reminder',
     body: 'Lösungsmittel disposal scheduled in 3 day(s)',
     requireInteraction: false,
     priority: 'normal'
   }
   ```

2. **Critical Reminder** (for critical hazard level)
   ```javascript
   {
     title: 'CRITICAL: Waste Disposal Reminder',
     body: 'Quecksilbereluate disposal scheduled today',
     requireInteraction: true,
     priority: 'high'
   }
   ```

3. **Overdue Alert**
   ```javascript
   {
     title: 'OVERDUE: Waste Disposal',
     body: 'Säuren disposal is overdue! Please complete immediately.',
     requireInteraction: true,
     priority: 'urgent'
   }
   ```

## Recurring Schedules

When a recurring disposal is marked as complete, the system automatically:
1. Creates the next occurrence based on the pattern
2. Copies all settings (assignee, priority, notes, etc.)
3. Respects the recurrence end date
4. Sets up new reminder dates

**Example:**
- Original: October 15, 2025 (Monthly recurrence)
- Completed: October 15, 2025
- Next occurrence: November 15, 2025
- Continues until recurrence_end_date

## Permissions

Required permissions from `usePermissions` hook:

- `waste:read` - View disposal schedules
- `waste:create` - Create new schedules
- `waste:update` - Update/reschedule disposals
- `waste:delete` - Delete schedules

## Export Formats

### CSV Export
```csv
Waste Name,Scheduled Date,Status,Assigned To
Lösungsmittel - Kanister 140603,2025-10-15T10:00:00.000Z,scheduled,John Doe
Säuren - Kanister 060106,2025-10-16T10:00:00.000Z,completed,Jane Smith
```

### JSON Export
```json
[
  {
    "id": 1,
    "waste_name": "Lösungsmittel - Kanister 140603",
    "scheduled_date": "2025-10-15T10:00:00.000Z",
    "status": "scheduled",
    "assigned_to_name": "John Doe",
    "hazard_level": "high",
    "category": "chemical"
  }
]
```

## WebSocket Events

### Client → Server
- `send_message` - Send notification
- `heartbeat` - Keep connection alive

### Server → Client
- `notification` - Receive disposal reminders
- `user_online` - User status updates
- `user_offline` - User disconnected

## Best Practices

1. **Scheduling**
   - Schedule critical waste disposals with lower daily limits
   - Use recurring schedules for regular maintenance
   - Always assign responsible users

2. **Notifications**
   - Enable browser notifications for real-time alerts
   - Check upcoming disposals daily
   - Respond to overdue alerts immediately

3. **Data Management**
   - Export schedules regularly for backup
   - Review and clean up completed schedules monthly
   - Use filters to find specific disposals quickly

4. **Safety**
   - Prioritize critical and high hazard disposals
   - Double-check disposal methods
   - Document all disposal actions in notes

## Troubleshooting

### Calendar Not Loading
- Check token authentication
- Verify API endpoint is accessible
- Check browser console for errors

### Notifications Not Working
- Ensure browser notifications are enabled
- Check WebSocket connection status
- Verify user is assigned to disposal

### Drag & Drop Not Working
- Ensure user has `waste:update` permission
- Check if DndProvider is properly initialized
- Verify event has proper structure

## Integration with Existing Systems

The Waste Disposal Planner integrates with:

1. **User Management** - Assigns disposals to users
2. **Waste Management** - Uses waste items and templates
3. **WebSocket System** - Real-time notifications
4. **Permission System** - Role-based access control

## Future Enhancements

Potential improvements:
- Email notifications (integrate with Nodemailer)
- SMS alerts for critical disposals
- Mobile app integration
- Advanced analytics and reporting
- AI-based scheduling optimization
- Integration with external disposal services
- QR code scanning for disposal confirmation
- Photo documentation of completed disposals

## Support

For issues or questions:
1. Check the console logs for errors
2. Verify database schema is up to date
3. Ensure all npm packages are installed
4. Contact system administrator

---

**Version:** 1.0.0
**Last Updated:** October 5, 2025
**Component Location:** `/client/src/components/WasteDisposalPlanner.js`
**API Routes:** `/server/routes/wasteSchedule.js`
**Database Migration:** `/server/database.js`
