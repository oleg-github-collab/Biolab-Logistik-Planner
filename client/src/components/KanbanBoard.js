import React, { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import io from 'socket.io-client';

const KanbanBoard = ({ tasks = [], onTaskUpdate, onTaskCreate, onTaskDelete }) => {
  const [socket, setSocket] = useState(null);
  const [columns, setColumns] = useState({
    todo: {
      id: 'todo',
      title: 'Zu erledigen',
      tasks: []
    },
    inprogress: {
      id: 'inprogress',
      title: 'In Arbeit',
      tasks: []
    },
    review: {
      id: 'review',
      title: 'Zur Überprüfung',
      tasks: []
    },
    done: {
      id: 'done',
      title: 'Erledigt',
      tasks: []
    }
  });
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee: '',
    dueDate: '',
    priority: 'medium',
    tags: []
  });

  // Initialize WebSocket for real-time sync
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:5000'
      : window.location.origin;

    const newSocket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Kanban WebSocket connected');
    });

    // Listen for real-time task updates from other users
    newSocket.on('task:created', (taskData) => {
      console.log('Task created by another user:', taskData);
      if (onTaskCreate) {
        onTaskCreate(taskData.task);
      }
    });

    newSocket.on('task:updated', (taskData) => {
      console.log('Task updated by another user:', taskData);
      if (onTaskUpdate) {
        onTaskUpdate(taskData.task.id, taskData.task);
      }
    });

    newSocket.on('task:deleted', (taskData) => {
      console.log('Task deleted by another user:', taskData);
      if (onTaskDelete) {
        onTaskDelete(taskData.taskId);
      }
    });

    newSocket.on('task:moved', (taskData) => {
      console.log('Task moved by another user:', taskData);
      if (onTaskUpdate) {
        onTaskUpdate(taskData.taskId, { status: taskData.toStatus });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [onTaskCreate, onTaskUpdate, onTaskDelete]);

  useEffect(() => {
    // Group tasks by status
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
      } else {
        groupedTasks.todo.push(task);
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

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    const sourceTasks = [...sourceColumn.tasks];
    const destTasks = source.droppableId === destination.droppableId ? sourceTasks : [...destColumn.tasks];
    const [removed] = sourceTasks.splice(source.index, 1);
    destTasks.splice(destination.index, 0, removed);

    // Optimistic UI update
    setColumns({
      ...columns,
      [source.droppableId]: {
        ...sourceColumn,
        tasks: sourceTasks
      },
      [destination.droppableId]: {
        ...destColumn,
        tasks: destTasks
      }
    });

    // Update task status
    if (onTaskUpdate) {
      onTaskUpdate(removed.id, {
        ...removed,
        status: destination.droppableId
      });
    }

    // Broadcast to other users via WebSocket
    if (socket) {
      socket.emit('task:move', {
        taskId: removed.id,
        fromStatus: source.droppableId,
        toStatus: destination.droppableId,
        newIndex: destination.index
      });
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setNewTask({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
    });
    setShowTaskModal(true);
  };

  const handleTaskSubmit = (e) => {
    e.preventDefault();
    if (selectedTask) {
      // Update existing task
      const updatedTask = {
        ...newTask,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null
      };

      if (onTaskUpdate) {
        onTaskUpdate(selectedTask.id, updatedTask);
      }

      // Broadcast update to other users
      if (socket) {
        socket.emit('task:update', {
          task: { ...selectedTask, ...updatedTask }
        });
      }
    } else {
      // Create new task
      const newTaskData = {
        ...newTask,
        id: Date.now(),
        status: 'todo',
        createdAt: new Date(),
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null
      };

      if (onTaskCreate) {
        onTaskCreate(newTaskData);
      }

      // Broadcast creation to other users
      if (socket) {
        socket.emit('task:create', {
          task: newTaskData
        });
      }
    }
    setShowTaskModal(false);
    setSelectedTask(null);
    setNewTask({
      title: '',
      description: '',
      assignee: '',
      dueDate: '',
      priority: 'medium',
      tags: []
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border border-green-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="h-full bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Kanban Board</h2>
        <button
          onClick={() => {
            setSelectedTask(null);
            setShowTaskModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Neue Aufgabe</span>
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.values(columns).map(column => (
            <Droppable key={column.id} droppableId={column.id}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`bg-white rounded-xl shadow-md border-2 transition-all duration-200 ${
                    snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4 border-b-2 border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-800 text-lg">{column.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {column.tasks.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 min-h-[600px] max-h-[calc(100vh-300px)] overflow-y-auto">
                    {column.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mb-3 p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                              snapshot.isDragging
                                ? 'shadow-2xl border-blue-500 bg-blue-50 rotate-2'
                                : 'kanban-card border-transparent hover:shadow-lg hover:border-blue-300'
                            }`}
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-semibold text-gray-900 text-base leading-tight flex-1 pr-2">{task.title}</h4>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${getPriorityColor(task.priority)}`}>
                                {task.priority === 'high' ? 'Hoch' : task.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t border-gray-100">
                              {task.assignee && (
                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                                  <span>👤</span>
                                  <span className="font-medium">{task.assignee}</span>
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                  <span>📅</span>
                                  <span className="font-medium">{formatDate(task.dueDate)}</span>
                                </span>
                              )}
                            </div>
                            
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {task.tags.map((tag, tagIndex) => (
                                  <span key={tagIndex} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md mx-auto slide-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                {selectedTask ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleTaskSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titel *
                  </label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                    required
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Aufgaben Titel"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                    rows="3"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Beschreibung (optional)"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Verantwortlich
                    </label>
                    <input
                      type="text"
                      value={newTask.assignee}
                      onChange={(e) => setNewTask({...newTask, assignee: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fälligkeitsdatum
                    </label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priorität
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (durch Komma getrennt)
                  </label>
                  <input
                    type="text"
                    value={Array.isArray(newTask.tags) ? newTask.tags.join(', ') : ''}
                    onChange={(e) => setNewTask({
                      ...newTask, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="projekt, wichtig, dringend"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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

export default KanbanBoard;