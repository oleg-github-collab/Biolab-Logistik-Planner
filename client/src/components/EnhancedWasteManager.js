import React, { useState, useEffect } from 'react';
import { format, addDays, isToday, isPast, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const WasteIcon = ({ type, className = "w-6 h-6" }) => {
  const icons = {
    chemical: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7,2V4H8V18A4,4 0 0,0 12,22A4,4 0 0,0 16,18V4H17V2H7M10,4H14V18A2,2 0 0,1 12,20A2,2 0 0,1 10,18V4Z" />
      </svg>
    ),
    acid: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11,9H13L13.86,2H15.5L16.15,0H7.85L8.5,2H10.14L11,9M9,11V13H7V15H9V22H15V15H17V13H15V11H9Z" />
      </svg>
    ),
    mercury: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2A3,3 0 0,1 15,5A3,3 0 0,1 12,8A3,3 0 0,1 9,5A3,3 0 0,1 12,2M12,9A4,4 0 0,1 16,13V14H20V16H16V17A4,4 0 0,1 12,21A4,4 0 0,1 8,17V16H4V14H8V13A4,4 0 0,1 12,9Z" />
      </svg>
    ),
    water: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2C13.1,7.4 18,9.9 18,15.5C18,19.1 15.1,22 11.5,22C7.9,22 5,19.1 5,15.5C5,9.9 9.9,7.4 11,2H12Z" />
      </svg>
    ),
    sink: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19,20H5V22H19V20M5,18H19V16H5V18M19,14V4A2,2 0 0,0 17,2H7A2,2 0 0,0 5,4V14H1V16H23V14H19M17,14H7V4H17V14Z" />
      </svg>
    ),
    hazmat: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,4.74L11.38,8.5L7.76,9L11.38,9.5L12,13.26L12.62,9.5L16.24,9L12.62,8.5L12,4.74Z" />
      </svg>
    ),
    construction: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z" />
      </svg>
    ),
    soil: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2,17H22V19H2V17M3,2V4H5V6H3V8H5V10H3V12H5V14H21V4H19V2H3M7,8H9V10H11V8H13V10H15V8H17V10H19V12H5V10H7V8Z" />
      </svg>
    ),
    container: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19,3A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3H19M19,5H5V19H19V5Z" />
      </svg>
    ),
    trash: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
      </svg>
    )
  };

  return icons[type] || icons.trash;
};

const HazardBadge = ({ level }) => {
  const styles = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200'
  };

  const labels = {
    low: 'Niedrig',
    medium: 'Mittel',
    high: 'Hoch',
    critical: 'Kritisch'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
};

const FrequencyBadge = ({ frequency }) => {
  const styles = {
    immediate: 'bg-red-100 text-red-800',
    daily: 'bg-blue-100 text-blue-800',
    weekly: 'bg-green-100 text-green-800',
    biweekly: 'bg-yellow-100 text-yellow-800',
    monthly: 'bg-purple-100 text-purple-800',
    quarterly: 'bg-indigo-100 text-indigo-800',
    yearly: 'bg-gray-100 text-gray-800'
  };

  const labels = {
    immediate: 'Sofort',
    daily: 'Täglich',
    weekly: 'Wöchentlich',
    biweekly: '2-wöchentlich',
    monthly: 'Monatlich',
    quarterly: 'Vierteljährlich',
    yearly: 'Jährlich'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[frequency]}`}>
      {labels[frequency]}
    </span>
  );
};

const EnhancedWasteManager = () => {
  const { user } = useAuth();
  const [wasteTemplates, setWasteTemplates] = useState([]);
  const [wasteItems, setWasteItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedWaste, setSelectedWaste] = useState(null);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [newWaste, setNewWaste] = useState({
    template_id: '',
    next_disposal_date: '',
    assigned_to: '',
    notification_users: [],
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load waste templates
      const templatesResponse = await fetch('/api/waste/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const templatesData = await templatesResponse.json();
      setWasteTemplates(templatesData);

      // Load waste items
      const itemsResponse = await fetch('/api/waste/items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const itemsData = await itemsResponse.json();
      setWasteItems(itemsData);

      // Load users
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const usersData = await usersResponse.json();
      setUsers(usersData);

    } catch (err) {
      setError('Fehler beim Laden der Daten: ' + err.message);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWasteItem = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/waste/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newWaste)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewWaste({
          template_id: '',
          next_disposal_date: '',
          assigned_to: '',
          notification_users: [],
          notes: ''
        });
        loadData();
      } else {
        throw new Error('Fehler beim Erstellen des Abfall-Elements');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignWaste = async (wasteId, assignedTo, notificationUsers) => {
    try {
      const response = await fetch(`/api/waste/items/${wasteId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          assigned_to: assignedTo,
          notification_users: notificationUsers
        })
      });

      if (response.ok) {
        setShowAssignModal(false);
        setSelectedWaste(null);
        loadData();

        // Send notifications
        if (notificationUsers.length > 0) {
          await sendNotifications(wasteId, notificationUsers);
        }
      } else {
        throw new Error('Fehler beim Zuweisen des Abfalls');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const sendNotifications = async (wasteId, userIds) => {
    try {
      await fetch('/api/waste/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          waste_id: wasteId,
          user_ids: userIds,
          type: 'assignment'
        })
      });
    } catch (err) {
      console.error('Error sending notifications:', err);
    }
  };

  const getStatusColor = (nextDisposalDate, hazardLevel) => {
    if (!nextDisposalDate) return 'gray';

    const date = new Date(nextDisposalDate);
    const today = new Date();
    const daysUntil = Math.ceil((date - today) / (1000 * 60 * 60 * 24));

    if (hazardLevel === 'critical' && daysUntil <= 1) return 'red';
    if (hazardLevel === 'high' && daysUntil <= 3) return 'orange';
    if (daysUntil <= 7) return 'yellow';
    return 'green';
  };

  const filteredWasteItems = wasteItems.filter(item => {
    const template = wasteTemplates.find(t => t.id === item.template_id);
    if (!template) return false;

    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.waste_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

    const matchesFilter = filter === 'all' ||
                         (filter === 'urgent' && getStatusColor(item.next_disposal_date, template.hazard_level) === 'red') ||
                         (filter === 'assigned' && item.assigned_to) ||
                         (filter === 'unassigned' && !item.assigned_to);

    return matchesSearch && matchesCategory && matchesFilter;
  });

  const categories = [...new Set(wasteTemplates.map(t => t.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Abfallmanagement</h1>
            <p className="text-gray-600 mt-1">Professionelle Entsorgung und Überwachung</p>
          </div>

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neue Entsorgung
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Name oder Code..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">Alle</option>
              <option value="urgent">Dringend</option>
              <option value="assigned">Zugewiesen</option>
              <option value="unassigned">Nicht zugewiesen</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="all">Alle Kategorien</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilter('all');
                setCategoryFilter('all');
              }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      </div>

      {/* Waste Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWasteItems.map(item => {
          const template = wasteTemplates.find(t => t.id === item.template_id);
          const assignedUser = users.find(u => u.id === item.assigned_to);
          const statusColor = getStatusColor(item.next_disposal_date, template?.hazard_level);

          return (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border-l-4"
              style={{ borderLeftColor: template?.color || '#6B7280' }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div
                      className="p-3 rounded-lg mr-3"
                      style={{ backgroundColor: template?.color + '20', color: template?.color }}
                    >
                      <WasteIcon type={template?.icon} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {template?.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Code: {template?.waste_code}
                      </p>
                    </div>
                  </div>

                  <div className={`w-3 h-3 rounded-full ${
                    statusColor === 'red' ? 'bg-red-500' :
                    statusColor === 'orange' ? 'bg-orange-500' :
                    statusColor === 'yellow' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <HazardBadge level={template?.hazard_level} />
                    <FrequencyBadge frequency={template?.default_frequency} />
                  </div>

                  {item.next_disposal_date && (
                    <div className="text-sm">
                      <span className="text-gray-600">Nächste Entsorgung:</span>
                      <div className={`font-medium ${
                        statusColor === 'red' ? 'text-red-600' :
                        statusColor === 'orange' ? 'text-orange-600' :
                        statusColor === 'yellow' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {format(new Date(item.next_disposal_date), 'dd.MM.yyyy', { locale: de })}
                      </div>
                    </div>
                  )}

                  {assignedUser && (
                    <div className="text-sm">
                      <span className="text-gray-600">Zugewiesen an:</span>
                      <div className="font-medium text-gray-900">{assignedUser.name}</div>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 line-clamp-2">
                    {template?.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between">
                  <button
                    onClick={() => {
                      setSelectedWaste(item);
                      setShowAssignModal(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {assignedUser ? 'Neu zuweisen' : 'Zuweisen'}
                  </button>

                  <span className="text-xs text-gray-500">
                    {template?.category}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWasteItems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">Keine Abfall-Elemente gefunden</div>
          <p className="text-gray-400 mt-2">Versuchen Sie, die Filter anzupassen</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Neue Entsorgung erstellen</h3>

            <form onSubmit={handleCreateWasteItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Abfall-Typ *
                </label>
                <select
                  value={newWaste.template_id}
                  onChange={(e) => setNewWaste({...newWaste, template_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Typ wählen...</option>
                  {wasteTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.waste_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nächste Entsorgung
                </label>
                <input
                  type="date"
                  value={newWaste.next_disposal_date}
                  onChange={(e) => setNewWaste({...newWaste, next_disposal_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zuweisen an
                </label>
                <select
                  value={newWaste.assigned_to}
                  onChange={(e) => setNewWaste({...newWaste, assigned_to: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Niemand zugewiesen</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benachrichtigungen
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newWaste.notification_users.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewWaste({
                              ...newWaste,
                              notification_users: [...newWaste.notification_users, u.id]
                            });
                          } else {
                            setNewWaste({
                              ...newWaste,
                              notification_users: newWaste.notification_users.filter(id => id !== u.id)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notizen
                </label>
                <textarea
                  value={newWaste.notes}
                  onChange={(e) => setNewWaste({...newWaste, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows="3"
                  placeholder="Zusätzliche Informationen..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Erstellen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedWaste && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Abfall zuweisen
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zuweisen an
                </label>
                <select
                  value={selectedWaste.assigned_to || ''}
                  onChange={(e) => setSelectedWaste({...selectedWaste, assigned_to: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Niemand zugewiesen</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benachrichtigungen senden an
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(selectedWaste.notification_users || []).includes(u.id)}
                        onChange={(e) => {
                          const currentUsers = selectedWaste.notification_users || [];
                          if (e.target.checked) {
                            setSelectedWaste({
                              ...selectedWaste,
                              notification_users: [...currentUsers, u.id]
                            });
                          } else {
                            setSelectedWaste({
                              ...selectedWaste,
                              notification_users: currentUsers.filter(id => id !== u.id)
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedWaste(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => handleAssignWaste(
                    selectedWaste.id,
                    selectedWaste.assigned_to,
                    selectedWaste.notification_users || []
                  )}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Zuweisen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedWasteManager;