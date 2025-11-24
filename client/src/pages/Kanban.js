import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  MessageCircle,
  Paperclip,
  Mic,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TaskModal from '../components/TaskModal';
import KanbanTaskModal from '../components/KanbanTaskModal';
import useWebSocket from '../hooks/useWebSocket';
import {
  fetchTasks,
  createTask,
  updateTask,
  getPriorityLabel,
  getPriorityColorClass,
} from '../utils/kanbanApi';
import { getAllUsers } from '../utils/api';

const COLUMNS = [
  { id: 'backlog', title: 'Backlog', color: 'bg-slate-100' },
  { id: 'todo', title: 'Todo', color: 'bg-blue-100' },
  { id: 'in_progress', title: 'In Arbeit', color: 'bg-yellow-100' },
  { id: 'review', title: 'Review', color: 'bg-purple-100' },
  { id: 'done', title: 'Erledigt', color: 'bg-green-100' },
];

const KanbanBoard = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState('todo');
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // WebSocket for real-time updates
  const { onTaskEvent } = useWebSocket();

  // Load initial data
  useEffect(() => {
    loadTasks();
    loadUsers();
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    const unsubscribeCreated = onTaskEvent('task:created', (data) => {
      console.log('Task created via WebSocket:', data);
      loadTasks(); // Refresh tasks
    });

    const unsubscribeUpdated = onTaskEvent('task:updated', (data) => {
      console.log('Task updated via WebSocket:', data);
      loadTasks(); // Refresh tasks
    });

    const unsubscribeDeleted = onTaskEvent('task:deleted', (data) => {
      console.log('Task deleted via WebSocket:', data);
      setTasks((prev) => prev.filter((t) => t.id !== data.taskId));
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [onTaskEvent]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      setErrorDetails(null);
      const data = await fetchTasks();
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setError(
        error.response?.data?.error ||
          error.message ||
          'Fehler beim Laden der Aufgaben'
      );
      setErrorDetails(
        error.response?.status
          ? `${error.response.status} ${error.response.statusText || ''}`.trim()
          : error.message
      );
      toast.error('Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getAllUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        const matchesDescription = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDescription) return false;
      }

      // User filter
      if (filterUser && task.assigned_to !== parseInt(filterUser)) {
        return false;
      }

      // Priority filter
      if (filterPriority && task.priority !== filterPriority) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, filterUser, filterPriority]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = {
      backlog: [],
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      const status = task.status || 'todo';
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    // Optimistic update
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    );

    try {
      await updateTask(taskId, { status: newStatus });
      toast.success('Status aktualisiert');
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Fehler beim Aktualisieren');
      // Revert on error
      loadTasks();
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleCreateTask = (columnId) => {
    setCreateModalStatus(columnId);
    setShowCreateModal(true);
  };

  const handleTaskCreated = async (taskData) => {
    try {
      const newTask = await createTask({
        ...taskData,
        status: createModalStatus,
        assigned_to: taskData.assigned_to || null,
      });

      toast.success('Aufgabe erstellt');
      setShowCreateModal(false);
      loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(error.response?.data?.error || 'Fehler beim Erstellen');
    }
  };

  const handleTaskUpdated = (updatedTask) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === updatedTask.id ? { ...updatedTask, ...task } : task))
    );
    setShowTaskModal(false);
    loadTasks(); // Refresh to get full data
  };

  const handleTaskDeleted = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setShowTaskModal(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterUser('');
    setFilterPriority('');
  };

  const hasActiveFilters = searchQuery || filterUser || filterPriority;

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 px-4">
        <div className="bg-white border border-red-200 rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
          <div className="flex items-center justify-center mb-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Kanban konnte nicht geladen werden</h2>
          <p className="text-sm text-slate-500 mb-4">
            {error}
          </p>
          {errorDetails && (
            <p className="text-xs text-slate-400 italic mb-4">{errorDetails}</p>
          )}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={loadTasks}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen mobile-kanban-container" style={{background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'}}
      {/* Header */}
      <div className="bg-white border-b border-slate-200 lg:px-6 px-3 py-4 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Kanban Board</h1>
            <p className="text-sm text-slate-600 mt-1">
              {tasks.length} Aufgaben insgesamt
              {hasActiveFilters && ` · ${filteredTasks.length} gefiltert`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Aufgaben suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                hasActiveFilters
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1 px-2 py-0.5 bg-white text-blue-600 text-xs rounded-full font-bold">
                  {[searchQuery, filterUser, filterPriority].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zugewiesen an
                </label>
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Alle Benutzer</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Priorität
                </label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Alle Prioritäten</option>
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="urgent">Dringend</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-white transition"
                >
                  Filter zurücksetzen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="mobile-kanban-board lg:p-6 px-3 pt-3">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 min-w-max mobile-kanban-columns">
            {COLUMNS.map((column) => {
              const columnTasks = tasksByStatus[column.id] || [];

              return (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col w-80 bg-white rounded-xl border-2 transition-all ${
                        snapshot.isDraggingOver
                          ? 'border-blue-400 bg-blue-50 shadow-lg'
                          : 'border-slate-200'
                      }`}
                    >
                      {/* Column Header */}
                      <div className={`px-4 py-3 border-b-2 border-slate-200 ${column.color}`}>
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 text-base">{column.title}</h3>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-white text-slate-700 rounded-full text-xs font-bold shadow-sm">
                              {columnTasks.length}
                            </span>
                            <button
                              onClick={() => handleCreateTask(column.id)}
                              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition shadow-sm"
                              title="Aufgabe erstellen"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Column Content */}
                      <div className="flex-1 p-3 overflow-y-auto min-h-[200px]">
                        {columnTasks.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            <p>Keine Aufgaben</p>
                            <button
                              onClick={() => handleCreateTask(column.id)}
                              className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                            >
                              + Aufgabe erstellen
                            </button>
                          </div>
                        )}

                        {columnTasks.map((task, index) => {
                          const hasAudio = task.attachments?.some(
                            (att) => att.file_type === 'audio'
                          );
                          const attachmentCount = task.attachments?.length || 0;
                          const commentCount = task.comments_count || 0;

                          return (
                            <Draggable
                              key={task.id}
                              draggableId={String(task.id)}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => handleTaskClick(task)}
                                  className={`mb-3 p-4 rounded-lg cursor-pointer transition-all border-2 bg-white ${
                                    snapshot.isDragging
                                      ? 'shadow-2xl border-blue-500 rotate-2 scale-105'
                                      : 'border-transparent hover:border-blue-300 hover:shadow-md'
                                  }`}
                                >
                                  {/* Task Header */}
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="font-semibold text-slate-900 text-sm leading-tight flex-1">
                                      {task.title}
                                    </h4>
                                    <span
                                      className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap border ${getPriorityColorClass(
                                        task.priority
                                      )}`}
                                    >
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                  </div>

                                  {/* Task Description */}
                                  {task.description && (
                                    <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  {/* Task Footer */}
                                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                      {/* Assigned User */}
                                      {task.assignee_name && (
                                        <div
                                          className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded"
                                          title={`Zugewiesen an: ${task.assignee_name}`}
                                        >
                                          <User className="w-3 h-3" />
                                          <span className="font-medium max-w-[80px] truncate">
                                            {task.assignee_name}
                                          </span>
                                        </div>
                                      )}

                                      {/* Due Date */}
                                      {task.due_date && (
                                        <div
                                          className={`flex items-center gap-1 px-2 py-1 rounded ${
                                            new Date(task.due_date) < new Date()
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-blue-50 text-blue-700'
                                          }`}
                                          title={`Fällig am: ${new Date(
                                            task.due_date
                                          ).toLocaleDateString('de-DE')}`}
                                        >
                                          <Calendar className="w-3 h-3" />
                                          <span className="font-medium">
                                            {new Date(task.due_date).toLocaleDateString('de-DE', {
                                              day: 'numeric',
                                              month: 'short',
                                            })}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {/* Audio Indicator */}
                                      {hasAudio && (
                                        <div
                                          className="flex items-center gap-1 text-purple-600"
                                          title="Hat Audio-Anweisung"
                                        >
                                          <Mic className="w-3 h-3" />
                                        </div>
                                      )}

                                      {/* Attachments Count */}
                                      {attachmentCount > 0 && (
                                        <div
                                          className="flex items-center gap-1 text-slate-600"
                                          title={`${attachmentCount} Anhänge`}
                                        >
                                          <Paperclip className="w-3 h-3" />
                                          <span className="font-medium">{attachmentCount}</span>
                                        </div>
                                      )}

                                      {/* Comments Count */}
                                      {commentCount > 0 && (
                                        <div
                                          className="flex items-center gap-1 text-slate-600"
                                          title={`${commentCount} Kommentare`}
                                        >
                                          <MessageCircle className="w-3 h-3" />
                                          <span className="font-medium">{commentCount}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Labels */}
                                  {task.labels && task.labels.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {task.labels.slice(0, 3).map((label, idx) => (
                                        <span
                                          key={idx}
                                          className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                                        >
                                          #{label}
                                        </span>
                                      ))}
                                      {task.labels.length > 3 && (
                                        <span className="text-xs text-slate-500 px-2 py-0.5">
                                          +{task.labels.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Overdue Warning */}
                                  {task.due_date && new Date(task.due_date) < new Date() && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-red-600 font-medium">
                                      <AlertCircle className="w-3 h-3" />
                                      Überfällig
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <TaskModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          users={users}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <KanbanTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleTaskCreated}
          task={null}
          users={users}
        />
      )}
    </div>
  );
};

export default KanbanBoard;
