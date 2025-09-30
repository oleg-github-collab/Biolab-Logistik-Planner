import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { format, differenceInDays, isOverdue, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

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

  // Load tasks from localStorage on component mount
  useEffect(() => {
    loadTasksFromStorage();
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

  const onDragEnd = (result) => {
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
  };

  const createTask = () => {
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
  };

  const updateTask = (taskId, updates) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, ...updates, updatedAt: new Date().toISOString() }
        : task
    ));
  };

  const deleteTask = (taskId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Aufgabe löschen möchten?')) {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }
  };

  const duplicateTask = (task) => {
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
  };

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

  const getPriorityInfo = (priority) => {
    return priorities.find(p => p.value === priority) || priorities[1];
  };

  const getCategoryInfo = (category) => {
    return categories.find(c => c.value === category) || categories[0];
  };

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
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-xl">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">🚀 Kanban Board</h2>
          <p className="text-gray-600">Verwalte deine Aufgaben effizient und behalte den Überblick</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportTasks}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>📊</span>
            <span>Export</span>
          </button>
          <button
            onClick={clearAllTasks}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>🗑️</span>
            <span>Alle löschen</span>
          </button>
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Neue Aufgabe</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Aufgaben durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {Object.values(filteredColumns).map(column => (
            <Droppable key={column.id} droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`${column.bgColor} rounded-lg shadow-sm min-w-80 max-w-80 border-2 ${
                    snapshot.isDraggingOver ? column.borderColor : 'border-transparent'
                  } transition-colors`}
                >
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 text-lg">{column.title}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="bg-white px-2 py-1 rounded-full text-sm font-semibold" style={{color: column.color}}>
                          {column.tasks.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 min-h-96 max-h-[600px] overflow-y-auto">
                    {column.tasks.map((task, index) => {
                      const priorityInfo = getPriorityInfo(task.priority);
                      const categoryInfo = getCategoryInfo(task.category);
                      const timeInfo = getTaskTimeInfo(task);

                      return (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg shadow-sm border border-gray-200 mb-3 p-4 cursor-pointer hover:shadow-md transition-all ${
                                snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                              } ${timeInfo?.urgent ? 'ring-2 ring-red-300' : ''}`}
                              onClick={() => handleTaskClick(task)}
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
                                      duplicateTask(task);
                                    }}
                                    className="text-gray-400 hover:text-blue-600 text-xs p-1"
                                    title="Duplizieren"
                                  >
                                    📋
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTask(task.id);
                                    }}
                                    className="text-gray-400 hover:text-red-600 text-xs p-1"
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
                    })}
                    {provided.placeholder}

                    {/* Empty State */}
                    {column.tasks.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <div className="text-4xl mb-2">📝</div>
                        <p>Keine Aufgaben in dieser Spalte</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {selectedTask ? '✏️ Aufgabe bearbeiten' : '➕ Neue Aufgabe'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTaskSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priorität
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="projekt, wichtig, dringend, meeting"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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