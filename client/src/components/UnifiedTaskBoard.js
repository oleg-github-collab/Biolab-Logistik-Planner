import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format, parseISO, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  ClipboardList,
  Layers,
  Users,
  Flame,
  CheckCircle,
  Clock,
  Activity,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import KanbanTaskModal from './KanbanTaskModal';
import {
  getUnifiedTaskBoard,
  createTaskPoolEntry,
  claimTask,
  completeTask,
  createTask,
  updateKanbanTask,
  getAllContacts,
  getKanbanTask
} from '../utils/apiEnhanced';
import { showSuccess, showError, showInfo } from '../utils/toast';

const buildColumnMeta = (t) => ({
  backlog: {
    title: t('board.column.backlog'),
    description: t('board.column.backlog.desc'),
    icon: ClipboardList,
    accent: 'bg-slate-100 border-slate-300'
  },
  pool: {
    title: t('board.column.pool'),
    description: t('board.column.pool.desc'),
    icon: Sparkles,
    accent: 'bg-indigo-50 border-indigo-200'
  },
  inProgress: {
    title: t('board.column.progress'),
    description: t('board.column.progress.desc'),
    icon: Activity,
    accent: 'bg-emerald-50 border-emerald-200'
  },
  completed: {
    title: t('board.column.done'),
    description: t('board.column.done.desc'),
    icon: CheckCircle,
    accent: 'bg-stone-50 border-stone-200'
  }
});

const buildPriorityMeta = (t) => ({
  urgent: { label: t('board.task.priority.urgent'), className: 'bg-red-100 text-red-700 border-red-300' },
  high: { label: t('board.task.priority.high'), className: 'bg-orange-100 text-orange-700 border-orange-300' },
  medium: { label: t('board.task.priority.medium'), className: 'bg-amber-100 text-amber-700 border-amber-300' },
  low: { label: t('board.task.priority.low'), className: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
});

const formatDateTime = (value) => {
  if (!value) return null;
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
};

const getColumnForTask = (task) => {
  const poolStatus = task.pool?.status || null;

  if (poolStatus === 'completed' || task.status === 'done') {
    return 'completed';
  }

  if (poolStatus === 'claimed' || poolStatus === 'assigned' || task.status === 'in_progress') {
    return 'inProgress';
  }

  if (poolStatus === 'available') {
    return 'pool';
  }

  return 'backlog';
};

const buildBoardState = (tasks) => {
  const taskMap = {};
  const columns = {
    backlog: [],
    pool: [],
    inProgress: [],
    completed: []
  };

  tasks.forEach((task) => {
    const column = getColumnForTask(task);
    taskMap[task.id] = task;
    columns[column].push(task.id);
  });

  return { taskMap, columns };
};

const EMPTY_COUNTS = { backlog: 0, poolAvailable: 0, inProgress: 0, needsHelp: 0, completed: 0 };

const UnifiedTaskBoard = () => {
  const auth = useAuth();
  const { t } = useLocale();
  const user = auth?.user;
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [boardState, setBoardState] = useState(() => buildBoardState([]));
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [actionBusy, setActionBusy] = useState({});
  const [users, setUsers] = useState([]);

  const columnMeta = useMemo(() => buildColumnMeta(t), [t]);
  const priorityMeta = useMemo(() => buildPriorityMeta(t), [t]);
  const isAdmin = useMemo(() => user?.role === 'admin' || user?.role === 'superadmin', [user]);
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return new Date();
    try {
      return parseISO(selectedDate);
    } catch (error) {
      return new Date();
    }
  }, [selectedDate]);

  const subtitle = useMemo(() => {
    if (!selectedDateObj || Number.isNaN(selectedDateObj.getTime())) {
      return t('board.subtitle.today');
    }
    if (isToday(selectedDateObj)) {
      return t('board.subtitle.today');
    }
    return t('board.subtitle.date', {
      date: format(selectedDateObj, 'dd.MM.yyyy', { locale: de })
    });
  }, [selectedDateObj, t]);

  const loadBoard = useCallback(async (date, { silent } = { silent: false }) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await getUnifiedTaskBoard({ date });
      const tasks = response.data.tasks || [];

      setBoardState(buildBoardState(tasks));
      setCounts(response.data.counts || EMPTY_COUNTS);
      setError(null);
      setErrorDetails(null);
    } catch (err) {
      console.error('Error loading unified task board', err);
      const message = err.response?.data?.error || t('board.error.load');
      const detail =
        err.response?.status
          ? `${err.response.status} ${err.response.statusText || ''}`.trim()
          : err.message;
      setBoardState(buildBoardState([]));
      setCounts(EMPTY_COUNTS);
      setError(message);
      setErrorDetails(detail);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadBoard(selectedDate);
  }, [selectedDate, loadBoard]);

  // Load users for assignment dropdown
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await getAllContacts();
        setUsers(response?.data || []);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  const refresh = useCallback(() => {
    loadBoard(selectedDate, { silent: true });
  }, [selectedDate, loadBoard]);

  const updateLocalState = (updater) => {
    setBoardState((prev) => {
      const next = updater(prev);
      return { taskMap: { ...next.taskMap }, columns: { ...next.columns } };
    });
  };

  const reorderWithinColumn = (columnId, startIndex, endIndex) => {
    updateLocalState((prev) => {
      const newColumn = Array.from(prev.columns[columnId]);
      const [removed] = newColumn.splice(startIndex, 1);
      newColumn.splice(endIndex, 0, removed);

      return {
        ...prev,
        columns: {
          ...prev.columns,
          [columnId]: newColumn
        }
      };
    });
  };

  const moveBetweenColumns = (sourceId, destId, sourceIndex, destIndex) => {
    updateLocalState((prev) => {
      const sourceColumn = Array.from(prev.columns[sourceId]);
      const destColumn = Array.from(prev.columns[destId]);
      const [removed] = sourceColumn.splice(sourceIndex, 1);
      destColumn.splice(destIndex, 0, removed);

      return {
        ...prev,
        columns: {
          ...prev.columns,
          [sourceId]: sourceColumn,
          [destId]: destColumn
        }
      };
    });
  };

  const handleCreatePoolEntry = async (taskId, { skipRefresh = false } = {}) => {
    if (!isAdmin) {
      showInfo(t('board.help.adminOnly'));
      return;
    }

    setActionBusy((prev) => ({ ...prev, [taskId]: true }));
    try {
      await createTaskPoolEntry({
        taskId,
        availableDate: selectedDate,
        priority: boardState.taskMap[taskId]?.priority || 'medium',
        estimatedDuration: boardState.taskMap[taskId]?.pool?.estimatedDuration || null,
        requiredSkills: null,
        isRecurring: false,
        recurrencePattern: null
      });
      showSuccess(t('board.actions.publish.success'));
      if (!skipRefresh) {
        await refresh();
      }
    } catch (err) {
      console.error('Error creating task pool entry', err);
      showError(err.response?.data?.error || t('board.actions.publish.error'));
      await refresh();
    } finally {
      setActionBusy((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleClaimTask = async (taskId, { skipRefresh = false } = {}) => {
    const poolId = boardState.taskMap[taskId]?.pool?.id;
    if (!poolId) {
      showError(t('board.actions.missingPool'));
      return;
    }

    setActionBusy((prev) => ({ ...prev, [taskId]: true }));
    try {
      await claimTask(poolId);
      showSuccess(t('board.actions.claim.success'));
      if (!skipRefresh) {
        await refresh();
      }
    } catch (err) {
      console.error('Error claiming task', err);
      showError(err.response?.data?.error || t('board.actions.claim.error'));
      await refresh();
    } finally {
      setActionBusy((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleCompleteTask = async (taskId, { skipRefresh = false } = {}) => {
    const poolId = boardState.taskMap[taskId]?.pool?.id;
    if (!poolId) {
      showError(t('board.actions.missingPool'));
      return;
    }

    setActionBusy((prev) => ({ ...prev, [taskId]: true }));
    try {
      await completeTask(poolId, '');
      showSuccess(t('board.actions.complete.success'));
      if (!skipRefresh) {
        await refresh();
      }
    } catch (err) {
      console.error('Error completing task', err);
      showError(err.response?.data?.error || t('board.actions.complete.error'));
      await refresh();
    } finally {
      setActionBusy((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const openTaskModal = useCallback(async (taskId) => {
    try {
      const response = await getKanbanTask(taskId);
      const taskDetails = response?.data || response;
      setEditingTask(taskDetails);
      setShowTaskModal(true);
    } catch (error) {
      console.error('Error loading task details', error);
      showError('Aufgabe konnte nicht geladen werden');
    }
  }, []);

  const handleTaskSave = async (taskData) => {
    try {
      if (editingTask?.id) {
        // Update existing task
        await updateKanbanTask(editingTask.id, taskData);
        showSuccess('Aufgabe aktualisiert');
      } else {
        // Create new task
        await createTask({
          ...taskData,
          status: 'todo'
        });
        showSuccess('Aufgabe erfolgreich erstellt');
      }

      setShowTaskModal(false);
      setEditingTask(null);
      await refresh();
    } catch (err) {
      console.error('Error saving task:', err);
      showError(err.response?.data?.error || 'Fehler beim Speichern der Aufgabe');
    }
  };

  useEffect(() => {
    const highlightTask = location.state?.highlightTask;
    if (highlightTask) {
      openTaskModal(highlightTask);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, openTaskModal]);

  const determineMoveAction = (sourceId, destId) => {
    if (sourceId === destId) {
      return 'reorder';
    }

    if (sourceId === 'backlog' && destId === 'pool') {
      return 'activate';
    }

    if (sourceId === 'pool' && destId === 'inProgress') {
      return 'claim';
    }

    if (sourceId === 'inProgress' && destId === 'completed') {
      return 'complete';
    }

    return null;
  };

  const onDragEnd = async (result) => {
    const { destination, source } = result;
    if (!destination) {
      return;
    }

    const taskId = boardState.columns[source.droppableId][source.index];
    const action = determineMoveAction(source.droppableId, destination.droppableId);

    if (!action) {
      showInfo(t('board.actions.notAllowed'));
      return;
    }

    if (action === 'reorder') {
      if (destination.index === source.index) {
        return;
      }
      reorderWithinColumn(source.droppableId, source.index, destination.index);
      return;
    }

    moveBetweenColumns(source.droppableId, destination.droppableId, source.index, destination.index);

    try {
      if (action === 'activate') {
        await handleCreatePoolEntry(taskId, { skipRefresh: true });
      } else if (action === 'claim') {
        await handleClaimTask(taskId, { skipRefresh: true });
      } else if (action === 'complete') {
        await handleCompleteTask(taskId, { skipRefresh: true });
      }
    } catch (err) {
      console.error('Drag action failed', err);
    } finally {
      // Always refresh to ensure state is consistent with backend
      await refresh();
    }
  };

  const renderEmptyState = (message) => (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <Users className="w-10 h-10 text-slate-300 mb-3" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );

  const renderTaskCard = (taskId, index, columnId) => {
    const task = boardState.taskMap[taskId];
    if (!task) return null;

    const priority = priorityMeta[task.priority] || priorityMeta.medium;
    const isMine =
      task.assigneeId === user?.id ||
      task.pool?.claimedBy === user?.id ||
      task.pool?.assignedTo === user?.id;

    const isHelpNeeded = task.pool?.helpStatus === 'pending';

    const canClaim = columnId === 'pool';
    const canComplete =
      columnId === 'inProgress' &&
      (task.pool?.claimedBy === user?.id || task.pool?.assignedTo === user?.id);

    const canActivate = columnId === 'backlog' && isAdmin;

    const dueLabel = task.dueDate ? formatDateTime(task.dueDate) : null;
    const poolUpdated = task.pool?.updatedAt ? formatDateTime(task.pool.updatedAt) : null;
    const attachmentsCount = Number(task.attachmentsCount || 0);
    const audioAttachmentCount = Number(task.audioAttachmentCount || 0);
    const commentsCount = Number(task.commentsCount || 0);
    const audioCommentCount = Number(task.audioCommentCount || 0);

    return (
      <Draggable key={taskId} draggableId={String(taskId)} index={index}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} className="mb-3">
            <div
              className={`bg-white rounded-xl border p-4 shadow-sm transition-all cursor-pointer ${
                snapshot.isDragging ? 'ring-2 ring-indigo-200 shadow-lg rotate-1' : ''
              }`}
              onClick={() => {
                if (!snapshot.isDragging) {
                  openTaskModal(taskId);
                }
              }}
            >
              <div
                className="flex items-start justify-between gap-3 mb-3"
                {...provided.dragHandleProps}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 line-clamp-3 whitespace-pre-line">
                      {task.description}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-1 rounded-full border uppercase tracking-wide ${priority.className}`}
                >
                  {priority.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {task.category && (
                  <span className="px-2 py-1 bg-slate-100 rounded-full border border-slate-200 text-slate-600">
                    #{task.category}
                  </span>
                )}
                {task.tags && task.tags.length > 0 && (
                  <span className="px-2 py-1 bg-blue-50 rounded-full border border-blue-200 text-blue-600">
                    {Array.isArray(task.tags) ? task.tags.join(', ') : task.tags}
                  </span>
                )}
                {dueLabel && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full border border-amber-200 text-amber-700">
                    <Clock className="w-3 h-3" />
                    {dueLabel}
                  </span>
                )}
                {task.estimatedHours && (
                  <span className="px-2 py-1 bg-emerald-50 rounded-full border border-emerald-200 text-emerald-600">
                    ⏱ {t('board.task.estimated', { hours: task.estimatedHours })}
                  </span>
                )}
                {isMine && (
                  <span className="px-2 py-1 bg-emerald-100 rounded-full border border-emerald-300 text-emerald-700">
                    {t('board.task.mine')}
                  </span>
                )}
              </div>

              {(attachmentsCount > 0 || commentsCount > 0 || audioAttachmentCount > 0 || audioCommentCount > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  {attachmentsCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full border border-slate-200">
                      📎 {attachmentsCount}
                    </span>
                  )}
                  {audioAttachmentCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full border border-purple-200 text-purple-600">
                      🎤 {audioAttachmentCount}
                    </span>
                  )}
                  {commentsCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-full border border-amber-200 text-amber-700">
                      💬 {commentsCount}
                    </span>
                  )}
                  {audioCommentCount > 0 && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-rose-100 rounded-full border border-rose-200 text-rose-600">
                      🔊 {audioCommentCount}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 space-y-2 text-[12px] text-slate-500">
                {task.pool?.assignedToName && (
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    <span>{t('board.task.assignedTo', { name: task.pool.assignedToName })}</span>
                  </div>
                )}

                {task.pool?.claimedByName && (
                  <div className="flex items-center gap-2">
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>{t('board.task.claimedBy', { name: task.pool.claimedByName })}</span>
                  </div>
                )}

                {poolUpdated && (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('board.task.updated', { date: poolUpdated })}</span>
                  </div>
                )}

                {isHelpNeeded && (
                  <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{t('board.task.help')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canActivate && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCreatePoolEntry(taskId);
                    }}
                    disabled={actionBusy[taskId]}
                    className="flex-1 px-3 py-2 text-[12px] font-semibold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition disabled:opacity-60"
                  >
                    {t('board.task.assign')}
                  </button>
                )}

                {canClaim && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleClaimTask(taskId);
                    }}
                    disabled={actionBusy[taskId]}
                    className="flex-1 px-3 py-2 text-[12px] font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-60"
                  >
                    {t('board.task.claim')}
                  </button>
                )}

                {canComplete && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCompleteTask(taskId);
                    }}
                    disabled={actionBusy[taskId]}
                    className="flex-1 px-3 py-2 text-[12px] font-semibold bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-60"
                  >
                    {t('board.task.complete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  const renderColumn = (columnId) => {
    const meta = columnMeta[columnId];
    if (!meta) return null;
    const Icon = meta.icon;
    const tasksInColumn = boardState.columns[columnId];

    return (
      <div key={columnId} className="flex-shrink-0 w-[85vw] sm:w-[320px] lg:flex-1 lg:min-w-[280px] lg:max-w-[380px] snap-center lg:snap-align-none">
        <div className={`rounded-2xl border ${meta.accent} p-4 mb-3 shadow-sm`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">{meta.title}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">{meta.description}</p>
            </div>
            <div className="text-xs font-semibold text-slate-500 bg-white rounded-full px-3 py-1 border border-slate-200">
              {tasksInColumn.length}
            </div>
          </div>
        </div>

        <Droppable droppableId={columnId}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[200px] rounded-2xl border border-dashed border-slate-200 bg-white p-3 transition ${
                snapshot.isDraggingOver ? 'bg-slate-50 border-indigo-300' : ''
              }`}
            >
              {tasksInColumn.length === 0
                ? renderEmptyState(t('board.empty'))
                : tasksInColumn.map((taskId, index) => renderTaskCard(taskId, index, columnId))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="h-72 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('board.title')}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleCreateTask}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Aufgabe
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('app.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">{t('board.error.title')}</p>
              <p>{error}</p>
              {errorDetails && (
                <p className="text-xs text-red-500/80 mt-1 break-all">{errorDetails}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadBoard(selectedDate)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 bg-white/70 text-xs font-semibold text-red-600 hover:bg-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('app.refresh')}
            </button>
            <Link
              to="/kanban"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Layers className="w-3.5 h-3.5" />
              Kanban öffnen
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('board.metrics.backlog')}</p>
          <p className="text-3xl font-bold text-slate-900">{counts.backlog}</p>
        </div>
        <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
          <p className="text-xs text-indigo-600 uppercase font-semibold mb-1">{t('board.metrics.pool')}</p>
          <p className="text-3xl font-bold text-indigo-700">{counts.poolAvailable}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
          <p className="text-xs text-emerald-600 uppercase font-semibold mb-1">{t('board.metrics.active')}</p>
          <p className="text-3xl font-bold text-emerald-700">{counts.inProgress}</p>
        </div>
        <div className="rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-4 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
          <p className="text-xs text-orange-600 uppercase font-semibold mb-1">{t('board.metrics.help')}</p>
          <p className="text-3xl font-bold text-orange-600">{counts.needsHelp}</p>
        </div>
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">{t('board.metrics.completed')}</p>
          <p className="text-3xl font-bold text-slate-800">{counts.completed}</p>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6 lg:pb-4 snap-x snap-mandatory lg:snap-none -mx-4 px-4 lg:mx-0 lg:px-0">
          {Object.keys(columnMeta).map((columnId) => renderColumn(columnId))}
        </div>
      </DragDropContext>

      {/* Task Modal */}
      <KanbanTaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        onSave={handleTaskSave}
        task={editingTask}
        users={users}
      />

      <button
        type="button"
        onClick={handleCreateTask}
        className="lg:hidden fixed bottom-[calc(90px+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center justify-center w-14 h-14 rounded-full shadow-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-3xl font-bold"
        aria-label="Neue Aufgabe"
      >
        +
      </button>
    </div>
  );
};

export default UnifiedTaskBoard;
