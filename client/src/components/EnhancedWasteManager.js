import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

// ✅ OPTIMIZED: Memoized WasteIcon component
const WasteIcon = memo(({ type, className = "w-6 h-6" }) => {
  const icons = {
    chemical: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7,2V4H8V18A4,4 0 0,0 12,22A4,4 0 0,0 16,18V4H17V2H7M10,4H14V18A2,2 0 0,1 12,20A2,2 0 0,1 10,18V4Z" />
      </svg>
    ),
    glass: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2C13.1,7.4 18,9.9 18,15.5C18,19.1 15.1,22 11.5,22C7.9,22 5,19.1 5,15.5C5,9.9 9.9,7.4 11,2H12Z" />
      </svg>
    ),
    medical: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2M12,4.74L11.38,8.5L7.76,9L11.38,9.5L12,13.26L12.62,9.5L16.24,9L12.62,8.5L12,4.74Z" />
      </svg>
    ),
    bio: (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M2,17H22V19H2V17M3,2V4H5V6H3V8H5V10H3V12H5V14H21V4H19V2H3M7,8H9V10H11V8H13V10H15V8H17V10H19V12H5V10H7V8Z" />
      </svg>
    ),
    plastic: (
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
});

WasteIcon.displayName = 'WasteIcon';

// ✅ OPTIMIZED: Memoized HazardBadge component
const HazardBadge = memo(({ level }) => {
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
});

HazardBadge.displayName = 'HazardBadge';

// ✅ OPTIMIZED: Memoized FrequencyBadge component
const FrequencyBadge = memo(({ frequency }) => {
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
});

FrequencyBadge.displayName = 'FrequencyBadge';

const EnhancedWasteManager = () => {
  const { user } = useAuth();
  const [wasteTemplates, setWasteTemplates] = useState([]);
  const [wasteItems, setWasteItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWaste, setSelectedWaste] = useState(null);
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [hazardFilter, setHazardFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('items');

  const [newWaste, setNewWaste] = useState({
    template_id: '',
    next_disposal_date: '',
    assigned_to: '',
    notification_users: [],
    notes: ''
  });

  // Category definitions with icons and colors
  const categories = {
    chemical: { label: 'Chemikalien', icon: 'chemical', color: '#FF6B6B' },
    heavy_metal: { label: 'Schwermetalle', icon: 'chemical', color: '#8E44AD' },
    aqueous: { label: 'Wassrige Losungen', icon: 'glass', color: '#3498DB' },
    hazardous: { label: 'Gefahrstoffe', icon: 'medical', color: '#6C757D' },
    construction: { label: 'Bauschutt', icon: 'bio', color: '#495057' },
    soil: { label: 'Bodenproben', icon: 'bio', color: '#8D6E63' },
    container: { label: 'Behalter', icon: 'plastic', color: '#FFC107' },
    general: { label: 'Allgemein', icon: 'trash', color: '#6C757D' }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ✅ OPTIMIZED: useCallback for data loading and notification functions
  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 5000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load waste templates
      const templatesResponse = await fetch('/api/waste/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!templatesResponse.ok) throw new Error('Fehler beim Laden der Vorlagen');
      const templatesData = await templatesResponse.json();
      setWasteTemplates(templatesData);

      // Load waste items
      const itemsResponse = await fetch('/api/waste/items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!itemsResponse.ok) throw new Error('Fehler beim Laden der Abfalle');
      const itemsData = await itemsResponse.json();
      setWasteItems(itemsData);

      // Load users
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!usersResponse.ok) throw new Error('Fehler beim Laden der Benutzer');
      const usersData = await usersResponse.json();
      setUsers(usersData);

    } catch (err) {
      showError('Fehler beim Laden der Daten: ' + err.message);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const handleCreateWasteItem = async (e) => {
    e.preventDefault();
    setLoading(true);

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
        const template = wasteTemplates.find(t => t.id === parseInt(newWaste.template_id));
        showSuccess(`Entsorgung "${template?.name}" erfolgreich erstellt!`);
        setShowCreateModal(false);
        setNewWaste({
          template_id: '',
          next_disposal_date: '',
          assigned_to: '',
          notification_users: [],
          notes: ''
        });
        await loadData();
      } else {
        throw new Error('Fehler beim Erstellen des Abfall-Elements');
      }
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddFromTemplate = (template) => {
    // Calculate next disposal date based on frequency
    const frequencies = {
      immediate: 0,
      daily: 1,
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
      yearly: 365
    };
    const days = frequencies[template.default_frequency] || 7;
    const nextDate = format(addDays(new Date(), days), 'yyyy-MM-dd');

    setNewWaste({
      template_id: template.id,
      next_disposal_date: nextDate,
      assigned_to: user?.id || '',
      notification_users: [],
      notes: ''
    });
    setShowCreateModal(true);
  };

  const handleDeleteWasteItem = async (id) => {
    if (!window.confirm('Mochten Sie dieses Abfall-Element wirklich loschen?')) return;

    try {
      const response = await fetch(`/api/waste/items/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        showSuccess('Abfall-Element erfolgreich geloscht');
        await loadData();
      } else {
        throw new Error('Fehler beim Loschen');
      }
    } catch (err) {
      showError(err.message);
    }
  };

  const handleMarkAsDisposed = async (item) => {
    try {
      const template = wasteTemplates.find(t => t.id === item.template_id);
      const frequencies = {
        immediate: 0,
        daily: 1,
        weekly: 7,
        biweekly: 14,
        monthly: 30,
        quarterly: 90,
        yearly: 365
      };
      const days = frequencies[template?.default_frequency] || 7;
      const nextDate = format(addDays(new Date(), days), 'yyyy-MM-dd');

      const response = await fetch(`/api/waste/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...item,
          next_disposal_date: nextDate
        })
      });

      if (response.ok) {
        showSuccess('Als entsorgt markiert. Nachster Termin geplant.');
        await loadData();
      } else {
        throw new Error('Fehler beim Aktualisieren');
      }
    } catch (err) {
      showError(err.message);
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

  // ✅ OPTIMIZED: useCallback for utility functions
  const getDaysUntilDisposal = useCallback((nextDate) => {
    if (!nextDate) return null;
    return differenceInDays(new Date(nextDate), new Date());
  }, []);

  // ✅ OPTIMIZED: useMemo for filtered waste items to prevent recalculation on every render
  const filteredWasteItems = useMemo(() => {
    return wasteItems.filter(item => {
      if (!item.template_id) return false;

      const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.waste_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      const matchesHazard = hazardFilter === 'all' || item.hazard_level === hazardFilter;

      const days = getDaysUntilDisposal(item.next_disposal_date);
      const matchesFilter = filter === 'all' ||
                           (filter === 'urgent' && days !== null && days <= 3) ||
                           (filter === 'overdue' && days !== null && days < 0) ||
                           (filter === 'upcoming' && days !== null && days >= 0 && days <= 7);

      return matchesSearch && matchesCategory && matchesHazard && matchesFilter;
    });
  }, [wasteItems, searchTerm, categoryFilter, hazardFilter, filter, getDaysUntilDisposal]);

  // ✅ OPTIMIZED: useMemo for unique categories
  const uniqueCategories = useMemo(() => [...new Set(wasteTemplates.map(t => t.category))], [wasteTemplates]);

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

          <div className="mt-4 sm:mt-0 flex gap-2">
            <button
              onClick={() => setShowTemplatesModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Schnellzugriff
            </button>
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Neue Entsorgung
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-800 hover:text-red-900 font-bold">×</button>
          </div>
        )}

        {success && (
          <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center animate-fade-in">
            <span>{success}</span>
            <button onClick={() => setSuccess('')} className="text-green-800 hover:text-green-900 font-bold">×</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'items'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Abfall-Items ({wasteItems.length})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Vorlagen ({wasteTemplates.length})
          </button>
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'items' && (
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Suche</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Name oder Code..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle</option>
                <option value="urgent">Dringend (3 Tage)</option>
                <option value="overdue">Uberfällig</option>
                <option value="upcoming">Anstehend (7 Tage)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle Kategorien</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {categories[cat]?.label || cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gefahrenstufe</label>
              <select
                value={hazardFilter}
                onChange={(e) => setHazardFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Alle Stufen</option>
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
                <option value="critical">Kritisch</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                  setCategoryFilter('all');
                  setHazardFilter('all');
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                Filter zurucksetzen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waste Items Grid */}
      {activeTab === 'items' && (
        <>
          {filteredWasteItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🗑</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Abfall-Items gefunden</h3>
              <p className="text-gray-600">Versuchen Sie, die Filter anzupassen oder erstellen Sie ein neues Item.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWasteItems.map(item => {
                const daysUntil = getDaysUntilDisposal(item.next_disposal_date);
                const assignedUser = users.find(u => u.id === item.assigned_to);
                const categoryInfo = categories[item.category] || { label: item.category, icon: 'trash', color: '#6B7280' };

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border-l-4 group"
                    style={{ borderLeftColor: item.color || categoryInfo.color }}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center flex-1">
                          <div
                            className="p-3 rounded-lg mr-3 flex-shrink-0"
                            style={{ backgroundColor: (item.color || categoryInfo.color) + '20', color: item.color || categoryInfo.color }}
                          >
                            <WasteIcon type={item.icon || categoryInfo.icon} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                              {item.name}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                              Code: {item.waste_code || 'N/A'}
                            </p>
                            <div className="mt-1">
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                {categoryInfo.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <HazardBadge level={item.hazard_level} />
                          <FrequencyBadge frequency={item.default_frequency} />
                        </div>

                        {item.next_disposal_date && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <span className="text-xs font-medium text-gray-600 block mb-1">Nachste Entsorgung:</span>
                            <div className={`font-bold text-lg ${
                              daysUntil === null ? 'text-gray-600' :
                              daysUntil < 0 ? 'text-red-600' :
                              daysUntil <= 3 ? 'text-orange-600' :
                              daysUntil <= 7 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {daysUntil === null ? 'Nicht geplant' :
                               daysUntil < 0 ? `${Math.abs(daysUntil)} Tage uberfällig` :
                               daysUntil === 0 ? 'Heute' :
                               daysUntil === 1 ? 'Morgen' :
                               `In ${daysUntil} Tagen`}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(item.next_disposal_date), 'dd.MM.yyyy - EEEE', { locale: de })}
                            </p>
                          </div>
                        )}

                        {assignedUser && (
                          <div className="text-sm">
                            <span className="text-gray-600 font-medium">Zugewiesen an:</span>
                            <div className="text-gray-900 mt-1">{assignedUser.name}</div>
                          </div>
                        )}

                        {item.disposal_instructions && (
                          <div className="text-xs bg-blue-50 border-l-2 border-blue-400 p-2 rounded">
                            <p className="text-gray-700">{item.disposal_instructions}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                        <button
                          onClick={() => handleMarkAsDisposed(item)}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 transition-colors font-medium"
                        >
                          ✓ Entsorgt
                        </button>
                        {(user?.role === 'admin' || user?.role === 'superadmin') && (
                          <button
                            onClick={() => handleDeleteWasteItem(item.id)}
                            className="px-3 py-2 bg-red-100 text-red-600 rounded-md text-sm hover:bg-red-200 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wasteTemplates.map(template => {
            const categoryInfo = categories[template.category] || { label: template.category, icon: 'trash', color: '#6B7280' };

            return (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border-l-4"
                style={{ borderLeftColor: template.color || categoryInfo.color }}
              >
                <div className="p-6">
                  <div className="flex items-start mb-4">
                    <div
                      className="p-3 rounded-lg mr-3 flex-shrink-0"
                      style={{ backgroundColor: (template.color || categoryInfo.color) + '20', color: template.color || categoryInfo.color }}
                    >
                      <WasteIcon type={template.icon || categoryInfo.icon} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1">
                        {template.name}
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                          {categoryInfo.label}
                        </span>
                        {template.waste_code && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                            {template.waste_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <HazardBadge level={template.hazard_level} />
                      <FrequencyBadge frequency={template.default_frequency} />
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-600">
                        {template.description}
                      </p>
                    )}

                    {template.disposal_instructions && (
                      <div className="text-xs bg-blue-50 border-l-2 border-blue-400 p-2 rounded">
                        <span className="font-medium text-gray-700">Anweisungen:</span>
                        <p className="text-gray-600 mt-1">{template.disposal_instructions}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleQuickAddFromTemplate(template)}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors font-medium"
                    >
                      + Schnell hinzufugen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Schnellzugriff - Vorlagen</h3>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wasteTemplates.map(template => {
                const categoryInfo = categories[template.category] || { label: template.category, icon: 'trash', color: '#6B7280' };

                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      handleQuickAddFromTemplate(template);
                      setShowTemplatesModal(false);
                    }}
                    className="text-left p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center mb-2">
                      <div
                        className="p-2 rounded-lg mr-2"
                        style={{ backgroundColor: (template.color || categoryInfo.color) + '20', color: template.color || categoryInfo.color }}
                      >
                        <WasteIcon type={template.icon || categoryInfo.icon} className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                          {template.name}
                        </h4>
                        <p className="text-xs text-gray-500">{template.waste_code}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <HazardBadge level={template.hazard_level} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Neue Entsorgung erstellen</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateWasteItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Abfall-Typ *
                </label>
                <select
                  value={newWaste.template_id}
                  onChange={(e) => setNewWaste({...newWaste, template_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Typ wahlen...</option>
                  {wasteTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.waste_code}) - {categories[template.category]?.label}
                    </option>
                  ))}
                </select>
              </div>

              {newWaste.template_id && (() => {
                const selectedTemplate = wasteTemplates.find(t => t.id === parseInt(newWaste.template_id));
                if (!selectedTemplate) return null;
                const categoryInfo = categories[selectedTemplate.category] || {};

                return (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                    <div className="flex items-start">
                      <div
                        className="p-2 rounded-lg mr-3"
                        style={{ backgroundColor: (selectedTemplate.color || categoryInfo.color) + '40', color: selectedTemplate.color || categoryInfo.color }}
                      >
                        <WasteIcon type={selectedTemplate.icon || categoryInfo.icon} />
                      </div>
                      <div className="flex-1">
                        <div className="flex gap-2 mb-2">
                          <HazardBadge level={selectedTemplate.hazard_level} />
                          <FrequencyBadge frequency={selectedTemplate.default_frequency} />
                        </div>
                        <p className="text-sm text-gray-700">{selectedTemplate.disposal_instructions}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nachste Entsorgung *
                  </label>
                  <input
                    type="date"
                    value={newWaste.next_disposal_date}
                    onChange={(e) => setNewWaste({...newWaste, next_disposal_date: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zuweisen an
                  </label>
                  <select
                    value={newWaste.assigned_to}
                    onChange={(e) => setNewWaste({...newWaste, assigned_to: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Niemand zugewiesen</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Benachrichtigungen senden an
                </label>
                <div className="border border-gray-300 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto bg-gray-50">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center hover:bg-white px-2 py-1 rounded cursor-pointer">
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
                        className="mr-2 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({u.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notizen
                </label>
                <textarea
                  value={newWaste.notes}
                  onChange={(e) => setNewWaste({...newWaste, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Zusatzliche Informationen oder besondere Hinweise..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={loading}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-gray-400"
                  disabled={loading}
                >
                  {loading ? 'Erstelle...' : 'Erstellen'}
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
