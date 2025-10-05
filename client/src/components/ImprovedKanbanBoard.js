import React, { useState, useEffect, useCallback, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format, differenceInDays, isOverdue, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

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
const TaskCard = memo(({ task, index, onTaskClick, onDuplicate, onDelete, getPriorityInfo, getCategoryInfo, getTaskTimeInfo }) => {
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
          className={`bg-white rounded-lg shadow-sm border border-gray-200 mb-3 p-4 cursor-pointer hover:shadow-md transition-all ${
            snapshot.isDragging ? 'shadow-lg rotate-2 scale-105' : ''
          } ${timeInfo?.urgent ? 'ring-2 ring-red-300' : ''}`}
          onClick={() => onTaskClick(task)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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
        </div>
      )}
    </Draggable>
  );
});
TaskCard.displayName = 'TaskCard';

const ImprovedKanbanBoard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
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

  // Load tasks from localStorage on component mount
  useEffect(() => {
    setLoading(true);
    loadTasksFromStorage();
    setTimeout(() => setLoading(false), 500);
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    saveTasksToStorage();
    groupTasksByStatus();
  }, [tasks]);

  const loadTasksFromStorage = () => {
    try {
      const savedTasks = localStorage.getItem('kanban-tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        // Ensure all tasks have required fields and fix dates
        const validTasks = parsedTasks.map(task => ({
          id: task.id || Date.now() + Math.random(),
          title: task.title || 'Untitled Task',
          description: task.description || '',
          assignee: task.assignee || '',
          dueDate: task.dueDate || null,
          priority: task.priority || 'medium',
          tags: Array.isArray(task.tags) ? task.tags : [],
          status: task.status || 'todo',
          createdAt: task.createdAt || new Date().toISOString(),
          updatedAt: task.updatedAt || new Date().toISOString(),
          createdBy: task.createdBy || user.name,
          estimatedHours: task.estimatedHours || '',
          category: task.category || 'general',
          completedAt: task.completedAt || null,
          completedBy: task.completedBy || null
        }));
        setTasks(validTasks);
      } else {
        // Load initial demo tasks
        loadInitialTasks();
      }
    } catch (error) {
      console.error('Error loading tasks from storage:', error);
      loadInitialTasks();
    }
  };

  const saveTasksToStorage = () => {
    try {
      localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
      setError('Fehler beim Speichern der Aufgaben');
    }
  };

  const loadInitialTasks = () => {
    const initialTasks = [
      {
        id: 1,
        title: 'Wochenplanung abschließen',
        description: 'Stelle sicher, dass alle Arbeitszeiten für die kommende Woche eingetragen sind',
        status: 'todo',
        priority: 'high',
        assignee: user.name,
        dueDate: new Date().toISOString(),
        tags: ['planung', 'dringend'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.name,
        estimatedHours: '2',
        category: 'general'
      },
      {
        id: 2,
        title: 'Abfallentsorgung planen',
        description: 'Überprüfe die nächsten Entsorgungstermine für alle Abfallarten',
        status: 'inprogress',
        priority: 'medium',
        assignee: user.name,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['abfall', 'logistik'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.name,
        estimatedHours: '4',
        category: 'maintenance'
      },
      {
        id: 3,
        title: 'Team Meeting vorbereiten',
        description: 'Agenda erstellen und Präsentation für das wöchentliche Team Meeting',
        status: 'review',
        priority: 'medium',
        assignee: user.name,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['meeting', 'team'],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user.name,
        estimatedHours: '1',
        category: 'meeting'
      }
    ];
    setTasks(initialTasks);
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

  const onDragEnd = useCallback((result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    updateTask(taskId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      ...(newStatus === 'done' ? {
        completedAt: new Date().toISOString(),
        completedBy: user.name
      } : {})
    });

    // Haptic feedback for mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    showToast(`Aufgabe erfolgreich verschoben`, 'success');
  }, [user.name, showToast]);

  const createTask = useCallback(() => {
    if (!newTask.title.trim()) {
      setError('Titel ist erforderlich');
      return;
    }

    const task = {
      id: Date.now() + Math.random(),
      ...newTask,
      dueDate: newTask.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.name,
      tags: Array.isArray(newTask.tags) ? newTask.tags : []
    };

    setTasks(prev => [...prev, task]);
    closeModal();
    showToast('Aufgabe erfolgreich erstellt', 'success');
  }, [newTask, user.name, showToast]);

  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    ));
  }, []);

  const deleteTask = useCallback((taskId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Aufgabe löschen möchten?')) {
      setTasks(prev => prev.filter(task => task.id !== taskId));
      showToast('Aufgabe erfolgreich gelöscht', 'success');

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  }, [showToast]);

  const duplicateTask = useCallback((task) => {
    const duplicatedTask = {
      ...task,
      id: Date.now() + Math.random(),
      title: `${task.title} (Kopie)`,
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.name,
      completedAt: null,
      completedBy: null
    };
    setTasks(prev => [...prev, duplicatedTask]);
    showToast('Aufgabe dupliziert', 'success');

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [user.name, showToast]);

  const handleTaskSubmit = (e) => {
    e.preventDefault();
    if (selectedTask) {
      updateTask(selectedTask.id, newTask);
    } else {
      createTask();
    }
    closeModal();
  };

  const closeModal = () => {
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

  const clearAllTasks = () => {
    if (window.confirm('Sind Sie sicher, dass Sie alle Aufgaben löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      setTasks([]);
      localStorage.removeItem('kanban-tasks');
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
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">🚀 Kanban Board</h2>
          <p className="text-sm md:text-base text-gray-600">Verwalte deine Aufgaben effizient und behalte den Überblick</p>
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
    </div>
  );
};

export default ImprovedKanbanBoard;