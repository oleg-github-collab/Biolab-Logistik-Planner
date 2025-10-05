# Waste Disposal Planner - Usage Examples

## Quick Start Guide

### Step 1: Access the Planner

Navigate to the Waste Disposal Planner page in your application:

```jsx
import { BrowserRouter as Router, Route } from 'react-router-dom';
import WasteDisposalPlanner from './components/WasteDisposalPlanner';

<Router>
  <Route path="/waste-disposal-planner" component={WasteDisposalPlanner} />
</Router>
```

### Step 2: Create Your First Disposal Schedule

1. **Click on any date** in the calendar
2. **Fill in the form:**
   ```
   Waste Item: Lösungsmittel - Kanister 140603
   Date & Time: 2025-10-15 10:00
   Assign To: John Doe
   Priority: High
   Disposal Method: Incineration
   Quantity: 25
   Unit: kg
   ```
3. **Click "Create Schedule"**

### Step 3: Enable Notifications

```javascript
// The component automatically requests notification permission
// Users will see a browser prompt on first load

// To manually trigger:
const { requestNotificationPermission } = useWebSocket();
await requestNotificationPermission();
```

## Common Use Cases

### Use Case 1: Schedule Regular Chemical Waste Disposal

**Scenario:** You need to dispose of acetone solvents every week.

**Solution:**
```javascript
// Create a recurring weekly schedule
{
  waste_item_id: 1, // Lösungsmittel
  scheduled_date: "2025-10-15T10:00:00.000Z",
  assigned_to: 2, // Lab Manager
  is_recurring: true,
  recurrence_pattern: "weekly",
  recurrence_end_date: "2026-10-15T10:00:00.000Z",
  priority: "high",
  disposal_method: "Professional Collection Service",
  quantity: "25",
  unit: "L"
}
```

**Result:**
- Schedule created for Oct 15, 2025
- Reminders sent 7, 3, 1 days before
- After completion, next occurrence auto-created for Oct 22, 2025
- Continues every week for one year

### Use Case 2: Batch Schedule Multiple Waste Items

**Scenario:** You have 5 different waste items that need disposal on the same day.

**Frontend:**
```jsx
// In the component
const handleBatchSchedule = async () => {
  const selectedItems = [
    { id: 1, name: 'Lösungsmittel', hazard: 'high' },
    { id: 2, name: 'Säuren', hazard: 'critical' },
    { id: 3, name: 'Wassereluate', hazard: 'medium' }
  ];

  const schedules = selectedItems.map(item => ({
    waste_item_id: item.id,
    scheduled_date: "2025-10-20T09:00:00.000Z",
    assigned_to: selectedUser,
    priority: item.hazard === 'critical' ? 'critical' : 'medium'
  }));

  const response = await fetch('/api/waste/schedule/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ schedules })
  });

  // Result: All 3 waste items scheduled for Oct 20, 2025
};
```

### Use Case 3: Handle Critical Waste with Urgent Scheduling

**Scenario:** Mercury contaminated materials need immediate disposal.

**Solution:**
```javascript
{
  waste_item_id: 3, // Quecksilbereluate
  scheduled_date: new Date().toISOString(), // Today
  assigned_to: 5, // Safety Officer
  priority: "critical",
  disposal_method: "Specialized Hazmat Disposal",
  quantity: "2",
  unit: "kg",
  notes: "URGENT: Mercury contamination - handle with extreme care"
}
```

**Features Triggered:**
- Immediate notification to Safety Officer
- Calendar highlights in red (critical)
- Event marked with priority border
- Requires interaction notification (can't be dismissed easily)

### Use Case 4: Reschedule Due to Equipment Failure

**Scenario:** Disposal equipment is down, need to reschedule all week's disposals.

**Method 1: Drag & Drop**
1. Find the disposal event in calendar
2. Drag it to the new date
3. System checks for conflicts
4. Confirms rescheduling
5. Notifies assigned user

**Method 2: API Update**
```javascript
const rescheduleDisposal = async (scheduleId, newDate) => {
  const response = await fetch(`/api/waste/schedule/${scheduleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      scheduled_date: newDate,
      status: 'rescheduled',
      notes: 'Rescheduled due to equipment maintenance'
    })
  });

  // Notification automatically sent to assigned user
};
```

### Use Case 5: Monitor Overdue Disposals

**Scenario:** Check for any overdue waste disposals and take action.

**Dashboard View:**
```jsx
// The component displays overdue count in real-time
const overdueDisposals = schedules.filter(s =>
  new Date(s.scheduled_date) < new Date() &&
  s.status !== 'completed' &&
  s.status !== 'cancelled'
);

// Overdue badge shows in UI:
<div className="overdue-badge">
  {overdueDisposals.length} Overdue
</div>
```

**Automated Response:**
- Daily check at 9 AM
- Status automatically updated to 'overdue'
- Urgent notification sent to assigned user
- Appears in red on calendar
- Shows in upcoming disposals timeline

### Use Case 6: Track Disposal Completion

**Scenario:** Disposal was completed, need to record it.

**In UI:**
1. Click on the disposal event
2. Click "Mark as Complete"
3. System records actual completion time
4. If recurring, creates next occurrence

**Via API:**
```javascript
const completeDisposal = async (scheduleId) => {
  const response = await fetch(`/api/waste/schedule/${scheduleId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      actual_date: new Date().toISOString(),
      notes: 'Disposal completed successfully. All safety protocols followed.'
    })
  });

  const result = await response.json();
  // If recurring: result.nextOccurrence contains next scheduled date
};
```

### Use Case 7: Export Monthly Report

**Scenario:** Generate a report of all disposals for the month.

**Frontend Action:**
```jsx
const exportMonthlyReport = () => {
  const monthStart = new Date(2025, 9, 1); // October 1
  const monthEnd = new Date(2025, 9, 31); // October 31

  const monthlyDisposals = schedules.filter(s => {
    const date = new Date(s.scheduled_date);
    return date >= monthStart && date <= monthEnd;
  });

  // Export as CSV
  const csvData = monthlyDisposals.map(s =>
    `${s.waste_name},${s.scheduled_date},${s.status},${s.assigned_to_name || 'Unassigned'},${s.hazard_level}`
  ).join('\n');

  const dataUri = `data:text/csv;charset=utf-8,Waste,Date,Status,Assigned,Hazard\n${encodeURIComponent(csvData)}`;
  const link = document.createElement('a');
  link.setAttribute('href', dataUri);
  link.setAttribute('download', 'october-2025-disposal-report.csv');
  link.click();
};
```

### Use Case 8: Set Custom Reminders

**Scenario:** You want reminders at specific times before disposal.

**Solution:**
```javascript
const setCustomReminders = async (scheduleId, scheduledDate) => {
  const scheduled = new Date(scheduledDate);

  const customReminders = [
    new Date(scheduled.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days before
    new Date(scheduled.getTime() - 5 * 24 * 60 * 60 * 1000),  // 5 days before
    new Date(scheduled.getTime() - 2 * 24 * 60 * 60 * 1000),  // 2 days before
    new Date(scheduled.getTime() - 2 * 60 * 60 * 1000),       // 2 hours before
  ].map(d => d.toISOString());

  await fetch(`/api/waste/schedule/${scheduleId}/reminder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      reminder_dates: customReminders
    })
  });
};
```

### Use Case 9: Check Capacity Before Scheduling

**Scenario:** Verify if a specific day can handle another disposal.

**Solution:**
```javascript
const checkDayCapacity = async (date) => {
  const response = await fetch(
    `/api/waste/schedule/conflicts?date=${date}&maxPerDay=5`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const result = await response.json();

  if (result.hasConflict) {
    alert(`Warning: ${result.count} disposals already scheduled (max: ${result.maxPerDay})`);
    alert(`Critical disposals: ${result.criticalCount}`);
  } else {
    // Safe to schedule
    createNewSchedule(date);
  }
};
```

### Use Case 10: Filter and Search

**Scenario:** Find all critical waste disposals assigned to a specific user.

**Frontend:**
```jsx
const [filters, setFilters] = useState({
  status: 'scheduled',
  hazardLevel: 'critical',
  assignedTo: 2 // User ID
});

// Apply filters
useEffect(() => {
  loadSchedules(); // Automatically uses filters
}, [filters]);

// Results shown:
// - Only scheduled (not completed) disposals
// - Only critical hazard level
// - Only assigned to user ID 2
```

## Advanced Patterns

### Pattern 1: Quarterly Safety Audits

```javascript
// Schedule quarterly audits for all hazardous waste
const scheduleQuarterlyAudits = async () => {
  const hazardousItems = wasteItems.filter(
    item => item.hazard_level === 'critical' || item.hazard_level === 'high'
  );

  const quarters = [
    new Date(2025, 0, 15), // Q1: Jan 15
    new Date(2025, 3, 15), // Q2: Apr 15
    new Date(2025, 6, 15), // Q3: Jul 15
    new Date(2025, 9, 15), // Q4: Oct 15
  ];

  for (const item of hazardousItems) {
    for (const quarterDate of quarters) {
      await createSchedule({
        waste_item_id: item.id,
        scheduled_date: quarterDate.toISOString(),
        assigned_to: safetyOfficerId,
        priority: 'high',
        notes: 'Quarterly Safety Audit'
      });
    }
  }
};
```

### Pattern 2: Emergency Disposal Protocol

```javascript
// Immediate disposal needed
const emergencyDisposal = async (wasteItemId) => {
  const schedule = await createSchedule({
    waste_item_id: wasteItemId,
    scheduled_date: new Date().toISOString(), // Now
    assigned_to: emergencyTeamId,
    priority: 'critical',
    disposal_method: 'Emergency Protocol',
    notes: 'EMERGENCY DISPOSAL - Immediate action required'
  });

  // Send immediate notification
  await sendUrgentNotification(emergencyTeamId, {
    title: 'EMERGENCY: Immediate Waste Disposal Required',
    body: `Critical waste disposal needed NOW`,
    requireInteraction: true,
    actions: [
      { action: 'acknowledge', title: 'Acknowledge' },
      { action: 'view', title: 'View Details' }
    ]
  });
};
```

### Pattern 3: Automated Weekly Planning

```javascript
// Auto-schedule all pending waste items every Monday
const autoScheduleWeekly = async () => {
  const pendingItems = wasteItems.filter(
    item => !item.scheduled && item.status === 'pending'
  );

  const nextMonday = getNextMonday();

  const schedules = pendingItems.map((item, index) => ({
    waste_item_id: item.id,
    scheduled_date: new Date(
      nextMonday.getTime() + index * 60 * 60 * 1000 // Spread over hours
    ).toISOString(),
    assigned_to: getAssignedUser(item.category),
    priority: item.hazard_level === 'critical' ? 'critical' : 'medium',
    is_recurring: item.frequency !== 'once',
    recurrence_pattern: item.frequency || 'weekly'
  }));

  await batchCreateSchedules(schedules);
};
```

## Testing Examples

### Test 1: Verify Reminder System

```javascript
// Create a test disposal 10 minutes from now
const testReminder = await createSchedule({
  waste_item_id: 1,
  scheduled_date: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  assigned_to: yourUserId,
  priority: 'high',
  reminder_dates: [
    new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min before
  ]
});

// Wait 5 minutes, you should receive a browser notification
```

### Test 2: Verify Drag & Drop

```javascript
// 1. Create a disposal for tomorrow
// 2. Drag it to next week in the calendar
// 3. Check that:
//    - Event moves to new date
//    - Database is updated
//    - Assigned user receives notification
//    - Status changes to 'rescheduled'
```

### Test 3: Verify Recurring Schedule

```javascript
// 1. Create weekly recurring disposal
// 2. Mark first occurrence as complete
// 3. Verify:
//    - First occurrence status = 'completed'
//    - Second occurrence is auto-created
//    - Second occurrence is 1 week later
//    - All settings copied (assignee, priority, etc.)
```

## Performance Tips

1. **Use Filters Effectively**
   - Filter by date range to reduce data load
   - Use status filters to focus on active disposals

2. **Batch Operations**
   - Group similar disposals together
   - Use batch create for multiple items

3. **Optimize Reminders**
   - Don't set too many reminder dates
   - Use standard patterns (7, 3, 1 days)

4. **Export Regularly**
   - Archive old completed disposals
   - Export monthly reports for backup

## Troubleshooting Common Issues

### Issue 1: Notifications Not Showing

**Solution:**
```javascript
// Check browser permission
if (Notification.permission === 'denied') {
  alert('Please enable notifications in browser settings');
}

// Request permission
await requestNotificationPermission();
```

### Issue 2: Calendar Events Not Updating

**Solution:**
```javascript
// Force refresh
loadSchedules();

// Or use WebSocket real-time updates
useEffect(() => {
  if (isConnected) {
    // Events will auto-update via WebSocket
  }
}, [isConnected]);
```

### Issue 3: Drag & Drop Not Working

**Solution:**
```javascript
// Ensure DndProvider wraps the calendar
<DndProvider backend={HTML5Backend}>
  <DragAndDropCalendar {...props} />
</DndProvider>
```

---

**Need More Help?**

- Check `/WASTE_DISPOSAL_PLANNER_DOCUMENTATION.md` for full API reference
- Review `/client/src/components/WasteDisposalPlanner.js` for implementation
- Examine `/server/routes/wasteSchedule.js` for backend logic
- Test with `/server/index.js` scheduled jobs

**Last Updated:** October 5, 2025
