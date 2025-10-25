import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Clock, User, Users, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTodayTaskPool, getMyTasks, claimTask, requestTaskHelp, respondToHelpRequest, getMyHelpRequests, completeTask } from '../utils/apiEnhanced';

const TaskPoolView = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [helpRequests, setHelpRequests] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState('available'); // available, assigned, my, all
  const [loading, setLoading] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = {};
      if (filter === 'available') params.unassigned_only = 'true';
      else if (filter !== 'all') params.status = filter;

      const [poolResponse, myTasksResponse, helpResponse] = await Promise.all([
        getTodayTaskPool(params),
        getMyTasks(),
        getMyHelpRequests('pending')
      ]);

      setTasks(poolResponse.data.tasks);
      setCounts(poolResponse.data.counts);
      setMyTasks(myTasksResponse.data);
      setHelpRequests(helpResponse.data);

      // Load users for help requests
      if (!users.length) {
        const response = await fetch('/api/profile/contacts/all', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading task pool:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimTask = async (taskPoolId) => {
    try {
      await claimTask(taskPoolId);
      loadData();
      alert('Aufgabe übernommen!');
    } catch (error) {
      console.error('Error claiming task:', error);
      alert('Fehler beim Übernehmen der Aufgabe');
    }
  };

  const handleRequestHelp = async (taskPoolId) => {
    if (!selectedUser || !helpMessage) {
      alert('Bitte wählen Sie einen Benutzer und schreiben Sie eine Nachricht');
      return;
    }

    try {
      await requestTaskHelp(taskPoolId, parseInt(selectedUser), helpMessage);
      setShowHelpModal(null);
      setSelectedUser('');
      setHelpMessage('');
      loadData();
      alert('Anfrage gesendet!');
    } catch (error) {
      console.error('Error requesting help:', error);
      alert('Fehler beim Anfordern von Hilfe');
    }
  };

  const handleRespondToHelp = async (requestId, action) => {
    try {
      await respondToHelpRequest(requestId, action);
      loadData();
      alert(action === 'accept' ? 'Aufgabe angenommen!' : 'Anfrage abgelehnt');
    } catch (error) {
      console.error('Error responding to help request:', error);
    }
  };

  const handleCompleteTask = async (taskPoolId) => {
    const notes = prompt('Notizen hinzufügen (optional):');
    try {
      await completeTask(taskPoolId, notes || '');
      loadData();
      alert('Завдання завершено!');
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Помилка при завершенні');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-green-100 text-green-800 border-green-300'
    };
    return colors[priority] || colors.medium;
  };

  const filterOptions = [
    { value: 'available', label: 'Доступні', count: counts.available || 0 },
    { value: 'my', label: 'Мої', count: myTasks.length },
    { value: 'claimed', label: 'Взяті', count: counts.claimed || 0 },
    { value: 'completed', label: 'Завершені', count: counts.completed || 0 },
    { value: 'all', label: 'Всі', count: Object.values(counts).reduce((a, b) => a + b, 0) }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const displayTasks = filter === 'my' ? myTasks : tasks;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Завдання на сьогодні</h1>
        <p className="text-gray-600">Оберіть завдання або запросіть допомогу від колег</p>
      </div>

      {/* Help Requests Alert */}
      {helpRequests.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Запити допомоги ({helpRequests.length})</h3>
          </div>
          <div className="space-y-2">
            {helpRequests.map(request => (
              <div key={request.id} className="flex items-center justify-between bg-white p-3 rounded border border-yellow-200">
                <div>
                  <p className="font-medium text-sm">{request.task_title}</p>
                  <p className="text-xs text-gray-600">від {request.requested_by_name}</p>
                  {request.message && <p className="text-xs text-gray-500 mt-1">{request.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespondToHelp(request.id, 'accept')}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition text-sm"
                  >
                    Прийняти
                  </button>
                  <button
                    onClick={() => handleRespondToHelp(request.id, 'decline')}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition text-sm"
                  >
                    Відхилити
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {filterOptions.map(option => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition flex items-center gap-2 ${
              filter === option.value
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span>{option.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filter === option.value ? 'bg-white bg-opacity-30' : 'bg-gray-100'
            }`}>
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tasks Grid */}
      {displayTasks.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Немає завдань</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTasks.map(task => (
            <div key={task.id} className="bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-lg transition">
              {/* Priority Badge */}
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(task.priority || task.task_priority)}`}>
                  {task.priority || task.task_priority}
                </span>
                {task.estimated_duration && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{task.estimated_duration} хв</span>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <h3 className="font-semibold text-gray-900 mb-2">{task.title || task.task_title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
              )}

              {/* Assignment Info */}
              {task.assigned_to_name && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <User className="w-4 h-4" />
                  <span>{task.assigned_to_name}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                {task.status === 'available' && !task.assigned_to && (
                  <>
                    <button
                      onClick={() => handleClaimTask(task.id)}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm font-medium"
                    >
                      Взяти завдання
                    </button>
                    <button
                      onClick={() => setShowHelpModal(task.id)}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                      title="Запросити допомогу"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  </>
                )}

                {(task.assigned_to === user.id || task.claimed_by === user.id) && task.status !== 'completed' && (
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="flex-1 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Завершити</span>
                  </button>
                )}

                {task.status === 'completed' && (
                  <div className="flex-1 px-3 py-2 bg-gray-100 text-gray-500 rounded text-sm font-medium text-center">
                    ✓ Завершено
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Request Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Запросити допомогу</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Обрати колегу</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Оберіть --</option>
                  {users.filter(u => u.id !== user.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Повідомлення</label>
                <textarea
                  value={helpMessage}
                  onChange={(e) => setHelpMessage(e.target.value)}
                  placeholder="Опишіть чим потрібна допомога..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleRequestHelp(showHelpModal)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
              >
                Надіслати
              </button>
              <button
                onClick={() => {
                  setShowHelpModal(null);
                  setSelectedUser('');
                  setHelpMessage('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskPoolView;
