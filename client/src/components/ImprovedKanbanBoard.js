import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format, differenceInDays, isOverdue, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import useWebSocket from '../hooks/useWebSocket';

// Toast notification component
const Toast = memo(({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in flex items-center gap-2`}>
      <span>{message}</span>
      <button onClick={onClose} className="text-white hover:text-gray-200">✕</button>
    </div>
  );
});
Toast.displayName = 'Toast';

// Skeleton loader for cards
const TaskSkeleton = memo(() => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3 p-4 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
  </div>
));
TaskSkeleton.displayName = 'TaskSkeleton';

// Memoized Task Card Component
const TaskCard = memo(({ task, index, onTaskClick, onDuplicate, onDelete, getPriorityInfo, getCategoryInfo, getTaskTimeInfo, editingUser }) => {
  const priorityInfo = getPriorityInfo(task.priority);
  const categoryInfo = getCategoryInfo(task.category);
  const timeInfo = getTaskTimeInfo(task);

  // Touch state for better mobile interaction
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      onDelete(task.id);
    } else if (isRightSwipe) {
      onDuplicate(task);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <Draggable key={task.id} draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg shadow-sm border mb-3 p-4 cursor-pointer hover:shadow-md transition-all ${
            snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''
          } ${timeInfo?.urgent ? 'ring-2 ring-red-300' : ''} ${
            editingUser ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
          }`}
          onClick={() => onTaskClick(task)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Editing indicator */}
          {editingUser && (
            <div className="mb-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
              <span className="animate-pulse">✏️</span>
              <span>{editingUser.name} bearbeitet gerade...</span>
            </div>
          )}
          {/* Task Header */}
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-gray-800 flex-1 pr-2">{task.title}</h4>
            <div className="flex items-center space-x-1">
              <span className={`text-xs px-2 py-1 rounded-full ${priorityInfo.color}`}>
                {priorityInfo.icon}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(task);
                }}
                className="text-gray-400 hover:text-blue-600 text-xs p-2 min-w-[44px] min-h-[44px] md:p-1 md:min-w-0 md:min-h-0 flex items-center justify-center"
                title="Duplizieren"
              >
                📋
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                }}
                className="text-gray-400 hover:text-red-600 text-xs p-2 min-w-[44px] min-h-[44px] md:p-1 md:min-w-0 md:min-h-0 flex items-center justify-center"
                title="Löschen"
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Task Meta Info */}
          <div className="space-y-2 text-xs text-gray-500">
            {task.assignee && (
              <div className="flex items-center space-x-1">
                <span>👤</span>
                <span>{task.assignee}</span>
              </div>
            )}

            {timeInfo && (
              <div className={`flex items-center space-x-1 ${timeInfo.color}`}>
                <span>📅</span>
                <span className="font-semibold">{timeInfo.text}</span>
              </div>
            )}

            {task.estimatedHours && (
              <div className="flex items-center space-x-1">
                <span>⏱️</span>
                <span>{task.estimatedHours}h geschätzt</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <span>{categoryInfo.icon}</span>
              <span>{categoryInfo.label}</span>
            </div>
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {task.tags.slice(0, 3).map((tag, tagIndex) => (
                <span key={tagIndex} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  +{task.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Completion Info */}
          {task.status === 'done' && task.completedBy && (
            <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-green-600">
              ✅ Abgeschlossen von {task.completedBy}
              {task.completedAt && (
                <div className="text-gray-500">
                  {format(new Date(task.completedAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                </div>
              )}
            </div>
          )}

          {/* Last Updated Info */}
          {task.last_updated_by_name && task.updated_at && (
            <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
              Zuletzt aktualisiert von {task.last_updated_by_name}
              <div className="text-gray-400">
                {format(new Date(task.updated_at), 'dd.MM.yyyy HH:mm', { locale: de })}
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
});
TaskCard.displayName = 'TaskCard';

const ImprovedKanbanBoard = () => {
  const { user } = useAuth();
  const { isConnected, onTaskEvent, emitTaskEditing, emitTaskStopEditing } = useWebSocket();
  const [tasks, setTasks] = useState([]);
  const [editingUsers, setEditingUsers] = useState({});
  const editingTimeoutRef = useRef({});
  const [columns, setColumns] = useState({
    todo: {
      id: 'todo',
      title: '📋 Zu erledigen',
      tasks: [],
      color: '#3B82F6',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    inprogress: {
      id: 'inprogress',
      title: '⚡ In Arbeit',
      tasks: [],
      color: '#F59E0B',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    review: {
      id: 'review',
      title: '🔍 Zur Überprüfung',
      tasks: [],
      color: '#8B5CF6',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    done: {
      id: 'done',
      title: '✅ Erledigt',
      tasks: [],
      color: '#10B981',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [toast, setToast] = useState(null);
  const [conflictDialog, setConflictDialog] = useState(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
    priority: 'medium',
    tags: [],
    status: 'todo',
    estimatedHours: '',
    category: 'general'
  });

  const priorities = [
    { value: 'low', label: 'Niedrig', color: 'bg-green-100 text-green-800', icon: '🟢' },
    { value: 'medium', label: 'Mittel', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    { value: 'high', label: 'Hoch', color: 'bg-orange-100 text-orange-800', icon: '🟠' },
    { value: 'urgent', label: 'Dringend', color: 'bg-red-100 text-red-800', icon: '🔴' }
  ];

  const categories = [
    { value: 'general', label: 'Allgemein', icon: '📝' },
    { value: 'development', label: 'Entwicklung', icon: '💻' },
    { value: 'testing', label: 'Testing', icon: '🧪' },
    { value: 'meeting', label: 'Meeting', icon: '🤝' },
    { value: 'research', label: 'Recherche', icon: '🔬' },
    { value: 'maintenance', label: 'Wartung', icon: '🔧' }
  ];

  // Show toast notification
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // Load tasks from API on component mount
  useEffect(() => {
    loadTasksFromAPI();
  }, []);

  // Group tasks by status whenever tasks change
  useEffect(() => {
    groupTasksByStatus();
  }, [tasks]);

  // WebSocket event handlers for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    // Task created by another user
    const unsubscribeCreated = onTaskEvent('task:created', (data) => {
      const { task, user: updatedByUser } = data;

      // Don't update if it's the current user (already updated optimistically)
      if (updatedByUser.id === user.id) return;

      setTasks(prev => {
        // Check if task already exists
        if (prev.find(t => t.id === task.id)) return prev;
        return [...prev, task];
      });

      showToast(`${updatedByUser.name} hat eine neue Aufgabe erstellt: "${task.title}"`, 'info');
    });

    // Task updated by another user
    const unsubscribeUpdated = onTaskEvent('task:updated', (data) => {
      const { task, user: updatedByUser } = data;

      if (updatedByUser.id === user.id) return;

      // Check if current user is editing this task
      if (selectedTask && selectedTask.id === task.id && showTaskModal) {
        // Show conflict dialog
        setConflictDialog({
          updatedTask: task,
          updatedByUser,
          currentChanges: newTask
        });
      } else {
        setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        showToast(`${updatedByUser.name} hat eine Aufgabe aktualisiert: "${task.title}"`, 'info');
      }
    });

    // Task moved by another user
    const unsubscribeMoved = onTaskEvent('task:moved', (data) => {
      const { task, user: updatedByUser, previousStatus } = data;

      if (updatedByUser.id === user.id) return;

      setTasks(prev => prev.map(t => t.id === task.id ? task : t));

      const statusNames = {
        todo: 'Zu erledigen',
        inprogress: 'In Arbeit',
        review: 'Zur Überprüfung',
        done: 'Erledigt'
      };

      showToast(
        `${updatedByUser.name} hat "${task.title}" nach ${statusNames[task.status]} verschoben`,
        'info'
      );
    });

    // Task deleted by another user
    const unsubscribeDeleted = onTaskEvent('task:deleted', (data) => {
      const { taskId, task, user: deletedByUser } = data;

      if (deletedByUser.id === user.id) return;

      setTasks(prev => prev.filter(t => t.id !== parseInt(taskId)));
      showToast(`${deletedByUser.name} hat eine Aufgabe gelöscht: "${task.title}"`, 'info');
    });

    // User editing task
    const unsubscribeUserEditing = onTaskEvent('task:user_editing', (data) => {
      const { taskId, user: editingUser } = data;
      setEditingUsers(prev => ({
        ...prev,
        [taskId]: editingUser
      }));

      // Clear timeout if exists
      if (editingTimeoutRef.current[taskId]) {
        clearTimeout(editingTimeoutRef.current[taskId]);
      }

      // Auto-remove after 5 seconds if no stop signal
      editingTimeoutRef.current[taskId] = setTimeout(() => {
        setEditingUsers(prev => {
          const newState = { ...prev };
          delete newState[taskId];
          return newState;
        });
      }, 5000);
    });

    // User stopped editing task
    const unsubscribeUserStoppedEditing = onTaskEvent('task:user_stopped_editing', (data) => {
      const { taskId } = data;

      if (editingTimeoutRef.current[taskId]) {
        clearTimeout(editingTimeoutRef.current[taskId]);
        delete editingTimeoutRef.current[taskId];
      }

      setEditingUsers(prev => {
        const newState = { ...prev };
        delete newState[taskId];
        return newState;
      });
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeMoved();
      unsubscribeDeleted();
      unsubscribeUserEditing();
      unsubscribeUserStoppedEditing();
    };
  }, [isConnected, onTaskEvent, user.id, showToast, selectedTask, showTaskModal, newTask]);

  const loadTasksFromAPI = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load tasks');
      }

      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks from API:', error);
      showToast('Fehler beim Laden der Aufgaben', 'error');
    } finally {
      setLoading(false);
    }
  };


  const groupTasksByStatus = useCallback(() => {
    const groupedTasks = {
      todo: [],
      inprogress: [],
      review: [],
      done: []
    };

    tasks.forEach(task => {
      const status = task.status || 'todo';
      if (groupedTasks[status]) {
        groupedTasks[status].push(task);
      }
    });

    setColumns(prev => ({
      ...prev,
      todo: { ...prev.todo, tasks: groupedTasks.todo },
      inprogress: { ...prev.inprogress, tasks: groupedTasks.inprogress },
      review: { ...prev.review, tasks: groupedTasks.review },
      done: { ...prev.done, tasks: groupedTasks.done }
    }));
  }, [tasks]);

  const onDragEnd = useCallback(async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    // Optimistic UI update
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? {
            ...task,
            status: newStatus,
            ...(newStatus === 'done' ? {
              completedAt: new Date().toISOString(),
              completedBy: user.name
            } : {})
          }
        : task
    ));

    try {
      await updateTaskAPI(taskId, { status: newStatus });

      // Haptic feedback for mobile
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }

      showToast(`Aufgabe erfolgreich verschoben`, 'success');
    } catch (error) {
      // Revert on error
      loadTasksFromAPI();
      showToast('Fehler beim Verschieben der Aufgabe', 'error');
    }
  }, [user.name, showToast]);

  const createTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      setError('Titel ist erforderlich');
      return;
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          assigneeId: newTask.assigneeId,
          dueDate: newTask.dueDate,
          tags: newTask.tags
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const task = await response.json();
      setTasks(prev => [...prev, task]);
      closeModal();
      showToast('Aufgabe erfolgreich erstellt', 'success');
    } catch (error) {
      console.error('Error creating task:', error);
      showToast('Fehler beim Erstellen der Aufgabe', 'error');
    }
  }, [newTask, showToast]);

  const updateTaskAPI = useCallback(async (taskId, updates) => {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update task');
    }

    const updatedTask = await response.json();
    setTasks(prev => prev.map(task => task.id === taskId ? updatedTask : task));
    return updatedTask;
  }, []);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      await updateTaskAPI(taskId, updates);
      showToast('Aufgabe erfolgreich aktualisiert', 'success');
    } catch (error) {
      console.error('Error updating task:', error);
      showToast('Fehler beim Aktualisieren der Aufgabe', 'error');
    }
  }, [updateTaskAPI, showToast]);

  const deleteTask = useCallback(async (taskId) => {
    if (!window.confirm('Sind Sie sicher, dass Sie diese Aufgabe löschen möchten?')) {
      return;
    }

    // Optimistic UI update
    setTasks(prev => prev.filter(task => task.id !== taskId));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      showToast('Aufgabe erfolgreich gelöscht', 'success');

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      // Reload tasks on error
      loadTasksFromAPI();
      showToast('Fehler beim Löschen der Aufgabe', 'error');
    }
  }, [showToast]);

  const duplicateTask = useCallback(async (task) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: `${task.title} (Kopie)`,
          description: task.description,
          status: 'todo',
          priority: task.priority,
          assigneeId: task.assignee_id,
          dueDate: task.due_date,
          tags: task.tags
        })
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate task');
      }

      const duplicatedTask = await response.json();
      setTasks(prev => [...prev, duplicatedTask]);
      showToast('Aufgabe dupliziert', 'success');

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (error) {
      console.error('Error duplicating task:', error);
      showToast('Fehler beim Duplizieren der Aufgabe', 'error');
    }
  }, [showToast]);

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (selectedTask) {
      await updateTask(selectedTask.id, newTask);
      closeModal();
    } else {
      await createTask();
    }
  };

  const closeModal = () => {
    // Emit stop editing if task was being edited
    if (selectedTask) {
      emitTaskStopEditing(selectedTask.id);
    }

    setShowTaskModal(false);
    setSelectedTask(null);
    setError('');
    setNewTask({
      title: '',
      description: '',
      assignee: '',
      dueDate: '',
      priority: 'medium',
      tags: [],
      status: 'todo',
      estimatedHours: '',
      category: 'general'
    });
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setNewTask({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      tags: Array.isArray(task.tags) ? task.tags : []
    });
    setShowTaskModal(true);

    // Emit editing status
    emitTaskEditing(task.id);
  };

  const getTaskTimeInfo = (task) => {
    if (!task.dueDate) return null;

    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const diffDays = differenceInDays(dueDate, now);

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)} Tage überfällig`, color: 'text-red-600', urgent: true };
    } else if (diffDays === 0) {
      return { text: 'Heute fällig', color: 'text-orange-600', urgent: true };
    } else if (diffDays === 1) {
      return { text: 'Morgen fällig', color: 'text-yellow-600', urgent: false };
    } else {
      return { text: `In ${diffDays} Tagen`, color: 'text-gray-600', urgent: false };
    }
  };

  const getPriorityInfo = useCallback((priority) => {
    return priorities.find(p => p.value === priority) || priorities[1];
  }, []);

  const getCategoryInfo = useCallback((category) => {
    return categories.find(c => c.value === category) || categories[0];
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.assignee.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesAssignee = filterAssignee === 'all' || task.assignee === filterAssignee;

    return matchesSearch && matchesPriority && matchesAssignee;
  });

  const uniqueAssignees = [...new Set(tasks.map(task => task.assignee).filter(Boolean))];

  // Filter columns based on filtered tasks
  const filteredColumns = Object.keys(columns).reduce((acc, columnId) => {
    acc[columnId] = {
      ...columns[columnId],
      tasks: filteredTasks.filter(task => task.status === columnId)
    };
    return acc;
  }, {});

  const exportTasks = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `kanban-tasks-${format(new Date(), 'yyyy-MM-dd')}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const clearAllTasks = async () => {
    if (!window.confirm('Sind Sie sicher, dass Sie alle Aufgaben löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }

    try {
      // Delete all tasks one by one
      const deletePromises = tasks.map(task =>
        fetch(`/api/tasks/${task.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      );

      await Promise.all(deletePromises);
      setTasks([]);
      showToast('Alle Aufgaben wurden gelöscht', 'success');
    } catch (error) {
      console.error('Error clearing tasks:', error);
      showToast('Fehler beim Löschen aller Aufgaben', 'error');
      loadTasksFromAPI();
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 p-3 md:p-6 rounded-xl">
      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4 md:mb-6 space-y-3 lg:space-y-0">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2 flex items-center gap-2">
              🚀 Kanban Board
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full animate-pulse">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Live
                </span>
              )}
            </h2>
            <p className="text-sm md:text-base text-gray-600">
              Verwalte deine Aufgaben effizient und behalte den Überblick
              {isConnected && <span className="ml-2 text-green-600">• Echtzeit-Sync aktiv</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button
            onClick={exportTasks}
            className="bg-gray-600 hover:bg-gray-700 active:bg-gray-800 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 flex-1 lg:flex-initial"
          >
            <span>📊</span>
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={clearAllTasks}
            className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 flex-1 lg:flex-initial"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Alle löschen</span>
          </button>
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 flex-1 lg:flex-initial"
          >
            <span>+</span>
            <span>Neue Aufgabe</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 md:mb-6 bg-white rounded-lg p-3 md:p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Aufgaben durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
          </div>

          <div className="flex gap-2 flex-col sm:flex-row">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="flex-1 sm:flex-initial p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="all">Alle Prioritäten</option>
              {priorities.map(priority => (
                <option key={priority.value} value={priority.value}>
                  {priority.icon} {priority.label}
                </option>
              ))}
            </select>

            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="flex-1 sm:flex-initial p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            >
              <option value="all">Alle Personen</option>
              {uniqueAssignees.map(assignee => (
                <option key={assignee} value={assignee}>
                  👤 {assignee}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Mobile: Vertical layout, Tablet: 2 columns, Desktop: Horizontal layout */}
        <div className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-row gap-3 md:gap-4 lg:space-x-4 pb-4 lg:overflow-x-auto">
          {loading ? (
            // Skeleton loader
            Object.values(filteredColumns).map(column => (
              <div key={column.id} className={`${column.bgColor} rounded-lg shadow-sm w-full lg:min-w-80 lg:max-w-80 border-2 border-transparent`}>
                <div className="p-3 md:p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 text-base md:text-lg">{column.title}</h3>
                  </div>
                </div>
                <div className="p-3 min-h-64 md:min-h-96">
                  <TaskSkeleton />
                  <TaskSkeleton />
                </div>
              </div>
            ))
          ) : (
            Object.values(filteredColumns).map(column => (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`${column.bgColor} rounded-lg shadow-sm w-full lg:min-w-80 lg:max-w-80 border-2 ${
                      snapshot.isDraggingOver ? column.borderColor : 'border-transparent'
                    } transition-colors`}
                  >
                    <div className="p-3 md:p-4 border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-sm z-10">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-800 text-base md:text-lg">{column.title}</h3>
                        <div className="flex items-center space-x-2">
                          <span className="bg-white px-2 py-1 rounded-full text-sm font-semibold" style={{color: column.color}}>
                            {column.tasks.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 md:p-3 min-h-64 md:min-h-96 max-h-[500px] md:max-h-[600px] overflow-y-auto">
                      {column.tasks.map((task, index) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          index={index}
                          onTaskClick={handleTaskClick}
                          onDuplicate={duplicateTask}
                          onDelete={deleteTask}
                          getPriorityInfo={getPriorityInfo}
                          getCategoryInfo={getCategoryInfo}
                          getTaskTimeInfo={getTaskTimeInfo}
                          editingUser={editingUsers[task.id]}
                        />
                      ))}
                      {provided.placeholder}

                      {/* Empty State */}
                      {column.tasks.length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <div className="text-4xl mb-2">📝</div>
                          <p className="text-sm">Keine Aufgaben in dieser Spalte</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            ))
          )}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 md:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-4 md:p-6 w-full max-w-2xl mx-auto my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">
                {selectedTask ? '✏️ Aufgabe bearbeiten' : '➕ Neue Aufgabe'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTaskSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    required
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="Aufgaben Titel"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Beschreibung
                  </label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    rows="3"
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base resize-y"
                    placeholder="Detailierte Beschreibung der Aufgabe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verantwortlich
                  </label>
                  <input
                    type="text"
                    value={newTask.assignee}
                    onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="Name der verantwortlichen Person"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fälligkeitsdatum
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priorität
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    {priorities.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.icon} {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategorie
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({...newTask, category: e.target.value})}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.icon} {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geschätzte Stunden
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newTask.estimatedHours}
                    onChange={(e) => setNewTask({...newTask, estimatedHours: e.target.value})}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="z.B. 2.5"
                  />
                </div>

                {selectedTask && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={newTask.status}
                      onChange={(e) => setNewTask({...newTask, status: e.target.value})}
                      className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    >
                      <option value="todo">📋 Zu erledigen</option>
                      <option value="inprogress">⚡ In Arbeit</option>
                      <option value="review">🔍 Zur Überprüfung</option>
                      <option value="done">✅ Erledigt</option>
                    </select>
                  </div>
                )}

                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (durch Komma getrennt)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(newTask.tags) ? newTask.tags.join(', ') : ''}
                    onChange={(e) => setNewTask({
                      ...newTask,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    })}
                    className="w-full p-3 min-h-[44px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                    placeholder="projekt, wichtig, dringend, meeting"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 md:mt-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium"
                >
                  {selectedTask ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Resolution Dialog */}
      {conflictDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Konflikt erkannt</h3>
                <p className="text-sm text-gray-600">
                  {conflictDialog.updatedByUser.name} hat diese Aufgabe gerade aktualisiert
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                Die Aufgabe wurde von {conflictDialog.updatedByUser.name} geändert, während Sie sie bearbeitet haben.
                Wählen Sie, ob Sie Ihre Änderungen behalten oder die neuen Änderungen übernehmen möchten.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span>📝</span>
                  Ihre Änderungen
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Titel:</span> {conflictDialog.currentChanges.title}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {conflictDialog.currentChanges.status}
                  </div>
                  <div>
                    <span className="font-medium">Priorität:</span> {conflictDialog.currentChanges.priority}
                  </div>
                </div>
              </div>

              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <span>🔄</span>
                  Neue Änderungen von {conflictDialog.updatedByUser.name}
                </h4>
                <div className="space-y-2 text-sm text-blue-900">
                  <div>
                    <span className="font-medium">Titel:</span> {conflictDialog.updatedTask.title}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {conflictDialog.updatedTask.status}
                  </div>
                  <div>
                    <span className="font-medium">Priorität:</span> {conflictDialog.updatedTask.priority}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  // Keep current changes - do nothing special
                  setConflictDialog(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                Meine Änderungen behalten
              </button>
              <button
                onClick={() => {
                  // Accept server changes
                  setTasks(prev => prev.map(t =>
                    t.id === conflictDialog.updatedTask.id ? conflictDialog.updatedTask : t
                  ));
                  setNewTask({
                    ...conflictDialog.updatedTask,
                    dueDate: conflictDialog.updatedTask.dueDate ?
                      new Date(conflictDialog.updatedTask.dueDate).toISOString().split('T')[0] : '',
                    tags: Array.isArray(conflictDialog.updatedTask.tags) ? conflictDialog.updatedTask.tags : []
                  });
                  setSelectedTask(conflictDialog.updatedTask);
                  setConflictDialog(null);
                  showToast('Änderungen von ' + conflictDialog.updatedByUser.name + ' übernommen', 'info');
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Neue Änderungen übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImprovedKanbanBoard;