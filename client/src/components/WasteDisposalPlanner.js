import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useAuth } from '../context/AuthContext';
import usePermissions from '../hooks/usePermissions';
import useWebSocket from '../hooks/useWebSocket';
import LoadingSpinner from './LoadingSpinner';
import toast from 'react-hot-toast';

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

const WasteDisposalPlanner = () => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const { showNotification, isConnected } = useWebSocket();

  // State management
  const [schedules, setSchedules] = useState([]);
  const [wasteItems, setWasteItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('month');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    hazardLevel: 'all',
    category: 'all',
    assignedTo: 'all'
  });

  // Form state for creating/editing events
  const [eventForm, setEventForm] = useState({
    waste_item_id: '',
    scheduled_date: '',
    assigned_to: '',
    notes: '',
    priority: 'medium',
    disposal_method: '',
    quantity: '',
    unit: '',
    is_recurring: false,
    recurrence_pattern: 'weekly',
    recurrence_end_date: ''
  });

  // Load initial data
  useEffect(() => {
    loadSchedules();
    loadWasteItems();
    loadUsers();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadSchedules();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Load schedules with filters
  const loadSchedules = async () => {
    try {
      const params = new URLSearchParams();

      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.hazardLevel !== 'all') params.append('hazardLevel', filters.hazardLevel);
      if (filters.category !== 'all') params.append('category', filters.category);
      if (filters.assignedTo !== 'all') params.append('assignedTo', filters.assignedTo);

      const response = await fetch(`/api/waste/schedule?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      } else {
        toast.error('Failed to load disposal schedules');
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Error loading schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadWasteItems = async () => {
    try {
      const response = await fetch('/api/waste/items', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setWasteItems(data);
      }
    } catch (error) {
      console.error('Error loading waste items:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Convert schedules to calendar events
  const calendarEvents = useMemo(() => {
    return schedules.map(schedule => ({
      id: schedule.id,
      title: `${schedule.waste_name}${schedule.quantity ? ` (${schedule.quantity}${schedule.unit || ''})` : ''}`,
      start: new Date(schedule.scheduled_date),
      end: new Date(schedule.scheduled_date),
      resource: schedule,
      color: getEventColor(schedule)
    }));
  }, [schedules]);

  // Get event color based on status and hazard level
  const getEventColor = (schedule) => {
    if (schedule.status === 'completed') return '#10B981';
    if (schedule.status === 'cancelled') return '#6B7280';
    if (schedule.status === 'overdue') return '#DC2626';

    // Color by hazard level
    switch (schedule.hazard_level) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#8B5CF6';
      default: return schedule.color || '#3B82F6';
    }
  };

  // Event style getter
  const eventStyleGetter = (event) => {
    const backgroundColor = event.color;
    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: event.resource.status === 'completed' ? 0.6 : 1,
      color: 'white',
      border: event.resource.priority === 'critical' ? '2px solid #DC2626' : '0',
      display: 'block',
      fontWeight: event.resource.priority === 'high' || event.resource.priority === 'critical' ? 'bold' : 'normal'
    };

    return { style };
  };

  // Handle event drag and drop (reschedule)
  const handleEventDrop = async ({ event, start, end }) => {
    if (!hasPermission('waste:update')) {
      toast.error('You do not have permission to reschedule disposals');
      return;
    }

    try {
      // Check for conflicts
      const conflictResponse = await fetch(
        `/api/waste/schedule/conflicts?date=${start.toISOString()}&maxPerDay=5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (conflictResponse.ok) {
        const conflictData = await conflictResponse.json();
        if (conflictData.hasConflict) {
          const confirmReschedule = window.confirm(
            `Warning: ${conflictData.count} disposals already scheduled for this day (max recommended: ${conflictData.maxPerDay}). Continue?`
          );
          if (!confirmReschedule) return;
        }
      }

      const response = await fetch(`/api/waste/schedule/${event.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scheduled_date: start.toISOString(),
          status: 'rescheduled'
        })
      });

      if (response.ok) {
        toast.success('Disposal rescheduled successfully');
        loadSchedules();

        // Send notification to assigned user
        if (event.resource.assigned_to) {
          showNotification(
            'Disposal Rescheduled',
            `${event.resource.waste_name} has been rescheduled to ${moment(start).format('MMM D, YYYY')}`
          );
        }
      } else {
        toast.error('Failed to reschedule disposal');
      }
    } catch (error) {
      console.error('Error rescheduling disposal:', error);
      toast.error('Error rescheduling disposal');
    }
  };

  // Handle event click
  const handleEventClick = (event) => {
    setSelectedEvent(event.resource);
    setShowEventModal(true);
  };

  // Handle slot click (create new event)
  const handleSlotClick = (slotInfo) => {
    if (!hasPermission('waste:create')) {
      toast.error('You do not have permission to create disposal schedules');
      return;
    }

    setSelectedDate(slotInfo.start);
    setEventForm({
      ...eventForm,
      scheduled_date: moment(slotInfo.start).format('YYYY-MM-DDTHH:mm')
    });
    setShowCreateModal(true);
  };

  // Create new disposal schedule
  const handleCreateSchedule = async (e) => {
    e.preventDefault();

    try {
      // Calculate reminder dates
      const scheduledDate = new Date(eventForm.scheduled_date);
      const reminderDates = [
        new Date(scheduledDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days before
        new Date(scheduledDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days before
        new Date(scheduledDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day before
        scheduledDate.toISOString() // Day of disposal
      ];

      const response = await fetch('/api/waste/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...eventForm,
          reminder_dates: reminderDates
        })
      });

      if (response.ok) {
        toast.success('Disposal schedule created successfully');
        setShowCreateModal(false);
        loadSchedules();
        resetForm();
      } else {
        toast.error('Failed to create disposal schedule');
      }
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast.error('Error creating schedule');
    }
  };

  // Batch create schedules
  const handleBatchCreate = async () => {
    if (!hasPermission('waste:create')) {
      toast.error('You do not have permission to create disposal schedules');
      return;
    }

    const selectedWasteItems = wasteItems.filter(item => item.selected);
    if (selectedWasteItems.length === 0) {
      toast.error('Please select at least one waste item');
      return;
    }

    const schedules = selectedWasteItems.map(item => ({
      waste_item_id: item.id,
      scheduled_date: selectedDate.toISOString(),
      assigned_to: eventForm.assigned_to,
      priority: item.hazard_level === 'critical' ? 'critical' : 'medium',
      notes: `Batch scheduled for ${moment(selectedDate).format('MMM D, YYYY')}`
    }));

    try {
      const response = await fetch('/api/waste/schedule/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ schedules })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Created ${result.success} schedules successfully`);
        if (result.errors > 0) {
          toast.error(`Failed to create ${result.errors} schedules`);
        }
        loadSchedules();
      } else {
        toast.error('Failed to batch create schedules');
      }
    } catch (error) {
      console.error('Error batch creating schedules:', error);
      toast.error('Error creating schedules');
    }
  };

  // Mark as complete
  const handleMarkComplete = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/waste/schedule/${selectedEvent.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          actual_date: new Date().toISOString(),
          notes: selectedEvent.notes
        })
      });

      if (response.ok) {
        toast.success('Disposal marked as completed');
        setShowEventModal(false);
        loadSchedules();
      } else {
        toast.error('Failed to mark disposal as completed');
      }
    } catch (error) {
      console.error('Error completing disposal:', error);
      toast.error('Error completing disposal');
    }
  };

  // Delete schedule
  const handleDeleteSchedule = async () => {
    if (!selectedEvent) return;

    if (!window.confirm('Are you sure you want to delete this disposal schedule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/waste/schedule/${selectedEvent.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Disposal schedule deleted successfully');
        setShowEventModal(false);
        loadSchedules();
      } else {
        toast.error('Failed to delete disposal schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Error deleting schedule');
    }
  };

  // Export to PDF/Excel
  const handleExport = (format) => {
    const dataStr = format === 'json'
      ? JSON.stringify(schedules, null, 2)
      : schedules.map(s => `${s.waste_name},${s.scheduled_date},${s.status},${s.assigned_to_name || 'Unassigned'}`).join('\n');

    const dataUri = `data:${format === 'json' ? 'application/json' : 'text/csv'};charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `waste-disposal-schedule-${moment().format('YYYY-MM-DD')}.${format === 'json' ? 'json' : 'csv'}`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast.success(`Schedule exported as ${format.toUpperCase()}`);
  };

  const resetForm = () => {
    setEventForm({
      waste_item_id: '',
      scheduled_date: '',
      assigned_to: '',
      notes: '',
      priority: 'medium',
      disposal_method: '',
      quantity: '',
      unit: '',
      is_recurring: false,
      recurrence_pattern: 'weekly',
      recurrence_end_date: ''
    });
  };

  // Get upcoming disposals
  const upcomingDisposals = useMemo(() => {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return schedules
      .filter(s => {
        const schedDate = new Date(s.scheduled_date);
        return schedDate >= now && schedDate <= next7Days && s.status === 'scheduled';
      })
      .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
  }, [schedules]);

  // Get overdue disposals
  const overdueDisposals = useMemo(() => {
    const now = new Date();
    return schedules.filter(s =>
      new Date(s.scheduled_date) < now &&
      s.status !== 'completed' &&
      s.status !== 'cancelled'
    );
  }, [schedules]);

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading disposal planner..." />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="waste-disposal-planner p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Waste Disposal Planner</h1>
          <p className="text-gray-600">Advanced scheduling and planning for waste disposal</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Scheduled</p>
                <p className="text-2xl font-bold text-blue-600">
                  {schedules.filter(s => s.status === 'scheduled').length}
                </p>
              </div>
              <div className="text-3xl text-blue-600">📅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming (7 days)</p>
                <p className="text-2xl font-bold text-green-600">{upcomingDisposals.length}</p>
              </div>
              <div className="text-3xl text-green-600">⏰</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueDisposals.length}</p>
              </div>
              <div className="text-3xl text-red-600">⚠️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-600">
                  {schedules.filter(s => s.status === 'completed').length}
                </p>
              </div>
              <div className="text-3xl text-gray-600">✓</div>
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="overdue">Overdue</option>
            </select>

            <select
              value={filters.hazardLevel}
              onChange={(e) => setFilters({ ...filters, hazardLevel: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Hazard Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Categories</option>
              <option value="chemical">Chemical</option>
              <option value="heavy_metal">Heavy Metal</option>
              <option value="aqueous">Aqueous</option>
              <option value="hazardous">Hazardous</option>
              <option value="general">General</option>
            </select>

            <select
              value={filters.assignedTo}
              onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="all">All Assignees</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>

            <button
              onClick={loadSchedules}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
            >
              Apply Filters
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => handleSlotClick({ start: new Date() })}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
            >
              + New Schedule
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 transition"
            >
              Export JSON
            </button>
            <button
              onClick={loadSchedules}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6" style={{ height: '600px' }}>
          <DragAndDropCalendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            onSelectEvent={handleEventClick}
            onSelectSlot={handleSlotClick}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventDrop}
            resizable
            selectable
            eventPropGetter={eventStyleGetter}
            style={{ height: '100%' }}
            views={['month', 'week', 'day', 'agenda']}
            messages={{
              next: "Next",
              previous: "Previous",
              today: "Today",
              month: "Month",
              week: "Week",
              day: "Day",
              agenda: "Agenda"
            }}
          />
        </div>

        {/* Upcoming Disposals Timeline */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-bold mb-4">Upcoming Disposals (Next 7 Days)</h2>
          {upcomingDisposals.length === 0 ? (
            <p className="text-gray-500">No upcoming disposals in the next 7 days</p>
          ) : (
            <div className="space-y-3">
              {upcomingDisposals.map(disposal => (
                <div
                  key={disposal.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedEvent(disposal);
                    setShowEventModal(true);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getEventColor(disposal) }}
                    />
                    <div>
                      <p className="font-semibold">{disposal.waste_name}</p>
                      <p className="text-sm text-gray-600">
                        {moment(disposal.scheduled_date).format('MMM D, YYYY HH:mm')}
                        {disposal.assigned_to_name && ` • Assigned to: ${disposal.assigned_to_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      disposal.hazard_level === 'critical' ? 'bg-red-100 text-red-800' :
                      disposal.hazard_level === 'high' ? 'bg-orange-100 text-orange-800' :
                      disposal.hazard_level === 'medium' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {disposal.hazard_level?.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Details Modal */}
        {showEventModal && selectedEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">{selectedEvent.waste_name}</h2>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Scheduled Date</p>
                      <p className="font-semibold">
                        {moment(selectedEvent.scheduled_date).format('MMM D, YYYY HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className={`font-semibold ${
                        selectedEvent.status === 'completed' ? 'text-green-600' :
                        selectedEvent.status === 'overdue' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {selectedEvent.status?.toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Hazard Level</p>
                      <p className="font-semibold">{selectedEvent.hazard_level?.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="font-semibold">{selectedEvent.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Waste Code</p>
                      <p className="font-semibold">{selectedEvent.waste_code}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Assigned To</p>
                      <p className="font-semibold">{selectedEvent.assigned_to_name || 'Unassigned'}</p>
                    </div>
                  </div>

                  {selectedEvent.notes && (
                    <div>
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="font-semibold">{selectedEvent.notes}</p>
                    </div>
                  )}

                  {selectedEvent.disposal_method && (
                    <div>
                      <p className="text-sm text-gray-600">Disposal Method</p>
                      <p className="font-semibold">{selectedEvent.disposal_method}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {selectedEvent.status !== 'completed' && (
                    <button
                      onClick={handleMarkComplete}
                      className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
                    >
                      Mark as Complete
                    </button>
                  )}
                  <button
                    onClick={handleDeleteSchedule}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Schedule Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">Create Disposal Schedule</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateSchedule} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Waste Item *
                    </label>
                    <select
                      value={eventForm.waste_item_id}
                      onChange={(e) => setEventForm({ ...eventForm, waste_item_id: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      required
                    >
                      <option value="">Select Waste Item</option>
                      {wasteItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.hazard_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scheduled Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={eventForm.scheduled_date}
                      onChange={(e) => setEventForm({ ...eventForm, scheduled_date: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign To
                    </label>
                    <select
                      value={eventForm.assigned_to}
                      onChange={(e) => setEventForm({ ...eventForm, assigned_to: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Select User</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>{user.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={eventForm.priority}
                        onChange={(e) => setEventForm({ ...eventForm, priority: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Disposal Method
                      </label>
                      <input
                        type="text"
                        value={eventForm.disposal_method}
                        onChange={(e) => setEventForm({ ...eventForm, disposal_method: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="e.g., Incineration"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="text"
                        value={eventForm.quantity}
                        onChange={(e) => setEventForm({ ...eventForm, quantity: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="e.g., 25"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={eventForm.unit}
                        onChange={(e) => setEventForm({ ...eventForm, unit: e.target.value })}
                        className="w-full border rounded px-3 py-2"
                        placeholder="e.g., kg, L"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={eventForm.is_recurring}
                        onChange={(e) => setEventForm({ ...eventForm, is_recurring: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">Recurring Schedule</span>
                    </label>
                  </div>

                  {eventForm.is_recurring && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Recurrence Pattern
                        </label>
                        <select
                          value={eventForm.recurrence_pattern}
                          onChange={(e) => setEventForm({ ...eventForm, recurrence_pattern: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date (Optional)
                        </label>
                        <input
                          type="date"
                          value={eventForm.recurrence_end_date}
                          onChange={(e) => setEventForm({ ...eventForm, recurrence_end_date: e.target.value })}
                          className="w-full border rounded px-3 py-2"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={eventForm.notes}
                      onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      rows="3"
                      placeholder="Additional notes..."
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
                    >
                      Create Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default WasteDisposalPlanner;
