import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

const AdvancedWasteManager = () => {
  const auth = useAuth(); const user = auth?.user;
  const [wasteItems, setWasteItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedWasteType, setSelectedWasteType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('all');

  // Professional waste types with specific handling requirements
  const wasteTypes = [
    {
      id: 'acetone',
      name: 'Acetone',
      container: 'Kanister 140603',
      category: 'chemical',
      hazardLevel: 'high',
      color: '#FF6B6B',
      icon: '⚗️',
      description: 'Lösungsmittelabfälle, hochentzündlich',
      defaultFrequency: 'monthly',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Chemikaliencontainer',
        instructions: 'Nur in original Kanistern sammeln. Niemals mischen!',
        frequency: 'Bei Bedarf oder monatlich',
        responsibleRole: ['admin', 'safety_officer']
      }
    },
    {
      id: 'acids',
      name: 'Säuren',
      container: 'Kanister 060106',
      category: 'chemical',
      hazardLevel: 'high',
      color: '#FF4757',
      icon: '🧪',
      description: 'Säurehaltige Abfälle aller Art',
      defaultFrequency: 'biweekly',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Säuresammelbehälter',
        instructions: 'Säuren getrennt sammeln. pH-Wert dokumentieren.',
        frequency: 'Alle 2 Wochen oder bei 80% Füllstand',
        responsibleRole: ['admin', 'safety_officer']
      }
    },
    {
      id: 'mercury_eluates',
      name: 'Quecksilbereluate',
      container: 'Spezialcontainer',
      category: 'toxic',
      hazardLevel: 'critical',
      color: '#8B0000',
      icon: '☢️',
      description: 'Quecksilberhaltige Lösungen und Eluate',
      defaultFrequency: 'immediate',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Sondermüllsammelstelle',
        instructions: 'SOFORTIGE Entsorgung erforderlich! Niemals lagern.',
        frequency: 'Sofort nach Entstehung',
        responsibleRole: ['admin']
      }
    },
    {
      id: 'water_eluates',
      name: 'Wassereluate',
      container: 'Sammelbehälter',
      category: 'liquid',
      hazardLevel: 'medium',
      color: '#3742FA',
      icon: '💧',
      description: 'Wässrige Eluate und Probelösungen',
      defaultFrequency: 'weekly',
      requiresSpecialHandling: false,
      disposal: {
        location: 'Abwasseraufbereitung',
        instructions: 'Nach pH-Wert und Inhaltsstoffen trennen',
        frequency: 'Wöchentlich',
        responsibleRole: ['employee', 'admin']
      }
    },
    {
      id: 'water_samples',
      name: 'Wasserproben',
      container: 'Waschbecken',
      category: 'liquid',
      hazardLevel: 'low',
      color: '#00D2D3',
      icon: '🚰',
      description: 'Gebrauchte Wasserproben',
      defaultFrequency: 'daily',
      requiresSpecialHandling: false,
      disposal: {
        location: 'Waschbecken/Abfluss',
        instructions: 'Nur schadstofffreie Proben über Waschbecken',
        frequency: 'Täglich nach Gebrauch',
        responsibleRole: ['employee', 'admin']
      }
    },
    {
      id: 'asbestos',
      name: 'Asbest',
      container: 'Asbest Säcke im Lager',
      category: 'hazardous',
      hazardLevel: 'critical',
      color: '#2C2C54',
      icon: '⚠️',
      description: 'Asbesthaltige Materialien',
      defaultFrequency: 'immediate',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Speziallager für Asbest',
        instructions: 'NUR mit Schutzausrüstung! Doppelt verpacken.',
        frequency: 'Sofortige Lagerung nach Entstehung',
        responsibleRole: ['admin']
      }
    },
    {
      id: 'asphalt',
      name: 'Asphalte',
      container: 'Großcontainer',
      category: 'construction',
      hazardLevel: 'medium',
      color: '#57606F',
      icon: '🏗️',
      description: 'Asphaltabfälle und teerhaltige Materialien',
      defaultFrequency: 'monthly',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Bauschutt-Container',
        instructions: 'Getrennt von anderem Bauschutt sammeln',
        frequency: 'Monatlich oder bei vollem Container',
        responsibleRole: ['admin', 'manager']
      }
    },
    {
      id: 'soil_samples',
      name: 'Bodenproben',
      container: 'Probenbehälter',
      category: 'samples',
      hazardLevel: 'medium',
      color: '#8D6E63',
      icon: '🌱',
      description: 'Kontaminierte und unkontaminierte Bodenproben',
      defaultFrequency: 'weekly',
      requiresSpecialHandling: false,
      disposal: {
        location: 'Probenarchiv oder Entsorgung',
        instructions: 'Nach Kontaminationsgrad trennen',
        frequency: 'Wöchentlich nach Analyse',
        responsibleRole: ['employee', 'admin']
      }
    },
    {
      id: 'extract_containers',
      name: 'Gefäße nach Extrakte',
      container: 'Glascontainer',
      category: 'labware',
      hazardLevel: 'medium',
      color: '#FFA726',
      icon: '🧴',
      description: 'Kontaminierte Laborgefäße nach Extraktionen',
      defaultFrequency: 'daily',
      requiresSpecialHandling: true,
      disposal: {
        location: 'Laborglas-Reinigung',
        instructions: 'Gründlich vorspülen, nach Kontamination sortieren',
        frequency: 'Täglich nach Gebrauch',
        responsibleRole: ['employee', 'admin']
      }
    },
    {
      id: 'commercial_waste',
      name: 'Restmüll',
      container: 'Gewerbemüllcontainer',
      category: 'general',
      hazardLevel: 'low',
      color: '#95A5A6',
      icon: '🗑️',
      description: 'Allgemeiner Gewerbeabfall',
      defaultFrequency: 'weekly',
      requiresSpecialHandling: false,
      disposal: {
        location: 'Gewerbemüllcontainer',
        instructions: 'Normale Büro- und Betriebsabfälle',
        frequency: 'Wöchentlich am Montag',
        responsibleRole: ['employee', 'admin', 'manager']
      }
    }
  ];

  const hazardLevels = {
    low: { label: 'Niedrig', color: '#27AE60', priority: 1 },
    medium: { label: 'Mittel', color: '#F39C12', priority: 2 },
    high: { label: 'Hoch', color: '#E74C3C', priority: 3 },
    critical: { label: 'Kritisch', color: '#8B0000', priority: 4 }
  };

  const frequencies = [
    { value: 'immediate', label: 'Sofort', days: 0 },
    { value: 'daily', label: 'Täglich', days: 1 },
    { value: 'weekly', label: 'Wöchentlich', days: 7 },
    { value: 'biweekly', label: 'Alle 2 Wochen', days: 14 },
    { value: 'monthly', label: 'Monatlich', days: 30 },
    { value: 'quarterly', label: 'Quartalsweise', days: 90 }
  ];

  const [itemForm, setItemForm] = useState({
    wasteTypeId: '',
    assignedTo: '',
    scheduledDate: '',
    frequency: 'weekly',
    notes: '',
    priority: 'medium',
    location: '',
    estimatedQuantity: '',
    isRecurring: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadWasteItems(),
        loadUsers(),
        loadNotifications()
      ]);
    } catch (error) {
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const loadWasteItems = async () => {
    // Mock data - replace with actual API call
    const mockItems = [
      {
        id: 1,
        wasteTypeId: 'acetone',
        assignedTo: user.id,
        assignedToName: user.name,
        scheduledDate: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
        frequency: 'monthly',
        notes: 'Großes Volumen erwartet',
        priority: 'high',
        location: 'Labor A',
        estimatedQuantity: '2 Kanister',
        isRecurring: true,
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastCompleted: null,
        completedBy: null
      },
      {
        id: 2,
        wasteTypeId: 'mercury_eluates',
        assignedTo: user.id,
        assignedToName: user.name,
        scheduledDate: format(new Date(), 'yyyy-MM-dd'),
        frequency: 'immediate',
        notes: 'DRINGEND - sofortige Entsorgung erforderlich',
        priority: 'critical',
        location: 'Labor B',
        estimatedQuantity: '500ml',
        isRecurring: false,
        status: 'overdue',
        createdAt: new Date().toISOString(),
        lastCompleted: null,
        completedBy: null
      }
    ];
    setWasteItems(mockItems);
  };

  const loadUsers = async () => {
    // Mock users - replace with actual API call
    const mockUsers = [
      { id: 1, name: 'Max Mustermann', role: 'admin', email: 'max@biolab.de' },
      { id: 2, name: 'Anna Schmidt', role: 'safety_officer', email: 'anna@biolab.de' },
      { id: 3, name: 'Tom Weber', role: 'employee', email: 'tom@biolab.de' },
      { id: 4, name: 'Lisa Müller', role: 'manager', email: 'lisa@biolab.de' }
    ];
    setUsers(mockUsers);
  };

  const loadNotifications = async () => {
    // Mock notifications - replace with actual API call
    const mockNotifications = [
      {
        id: 1,
        type: 'urgent',
        title: 'Quecksilbereluate entsorgung überfällig!',
        message: 'Kritische Abfälle müssen sofort entsorgt werden.',
        wasteItemId: 2,
        createdAt: new Date().toISOString(),
        read: false
      }
    ];
    setNotifications(mockNotifications);
  };

  const handleCreateWasteItem = async () => {
    try {
      setLoading(true);
      const wasteType = wasteTypes.find(type => type.id === itemForm.wasteTypeId);
      const assignedUser = users.find(u => u.id === parseInt(itemForm.assignedTo));

      const newItem = {
        id: Date.now(),
        ...itemForm,
        assignedToName: assignedUser?.name || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastCompleted: null,
        completedBy: null
      };

      setWasteItems([...wasteItems, newItem]);

      // Create notification for assigned user
      if (assignedUser && assignedUser.id !== user.id) {
        const notification = {
          id: Date.now() + 1,
          type: wasteType.hazardLevel === 'critical' ? 'urgent' : 'info',
          title: `Neue Abfallentsorgung zugewiesen: ${wasteType.name}`,
          message: `Sie wurden für die Entsorgung von ${wasteType.name} eingeteilt.`,
          wasteItemId: newItem.id,
          createdAt: new Date().toISOString(),
          read: false
        };
        setNotifications(prev => [notification, ...prev]);
      }

      setShowAddModal(false);
      resetForm();
    } catch (error) {
      setError('Fehler beim Erstellen der Abfallentsorgung');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteWasteItem = async (itemId) => {
    try {
      const item = wasteItems.find(w => w.id === itemId);
      if (!item) return;

      const updatedItems = wasteItems.map(w => {
        if (w.id === itemId) {
          const completed = {
            ...w,
            status: 'completed',
            lastCompleted: new Date().toISOString(),
            completedBy: user.name
          };

          // If recurring, create next occurrence
          if (w.isRecurring) {
            const frequency = frequencies.find(f => f.value === w.frequency);
            const nextDate = addDays(new Date(w.scheduledDate), frequency?.days || 7);

            setTimeout(() => {
              const nextItem = {
                ...w,
                id: Date.now() + Math.random(),
                scheduledDate: format(nextDate, 'yyyy-MM-dd'),
                status: 'pending',
                createdAt: new Date().toISOString()
              };
              setWasteItems(prev => [...prev, nextItem]);
            }, 100);
          }

          return completed;
        }
        return w;
      });

      setWasteItems(updatedItems);

      // Create completion notification
      const wasteType = wasteTypes.find(type => type.id === item.wasteTypeId);
      const notification = {
        id: Date.now(),
        type: 'success',
        title: `Abfallentsorgung abgeschlossen: ${wasteType?.name}`,
        message: `${wasteType?.name} wurde erfolgreich entsorgt.`,
        wasteItemId: itemId,
        createdAt: new Date().toISOString(),
        read: false
      };
      setNotifications(prev => [notification, ...prev]);

    } catch (error) {
      setError('Fehler beim Abschließen der Entsorgung');
    }
  };

  const getStatusInfo = (item) => {
    const today = new Date();
    const scheduledDate = new Date(item.scheduledDate);
    const daysUntil = differenceInDays(scheduledDate, today);

    if (item.status === 'completed') {
      return { label: 'Abgeschlossen', color: 'bg-green-100 text-green-800', priority: 0 };
    }

    if (daysUntil < 0) {
      return { label: `${Math.abs(daysUntil)} Tage überfällig`, color: 'bg-red-100 text-red-800', priority: 4 };
    }

    if (daysUntil === 0) {
      return { label: 'Heute fällig', color: 'bg-orange-100 text-orange-800', priority: 3 };
    }

    if (daysUntil <= 1) {
      return { label: 'Morgen fällig', color: 'bg-yellow-100 text-yellow-800', priority: 2 };
    }

    return { label: `In ${daysUntil} Tagen`, color: 'bg-blue-100 text-blue-800', priority: 1 };
  };

  const filteredItems = wasteItems.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'overdue') {
      const daysUntil = differenceInDays(new Date(item.scheduledDate), new Date());
      return daysUntil < 0 && item.status === 'pending';
    }
    if (filter === 'critical') {
      const wasteType = wasteTypes.find(type => type.id === item.wasteTypeId);
      return wasteType?.hazardLevel === 'critical';
    }
    if (filter === 'my') return item.assignedTo === user.id;
    return true;
  });

  const resetForm = () => {
    setItemForm({
      wasteTypeId: '',
      assignedTo: '',
      scheduledDate: '',
      frequency: 'weekly',
      notes: '',
      priority: 'medium',
      location: '',
      estimatedQuantity: '',
      isRecurring: true
    });
    setSelectedWasteType('');
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🏭 Professionelles Abfallmanagement
            </h1>
            <p className="text-gray-600">
              Laborabfälle sicher und systematisch verwalten
            </p>
          </div>

          {unreadNotifications > 0 && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2">
              <span className="font-semibold">⚠️ {unreadNotifications} Benachrichtigungen</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Übersicht ({filteredItems.length})
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 Terminplanung
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'types'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🧪 Abfallarten ({wasteTypes.length})
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors relative ${
              activeTab === 'notifications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔔 Benachrichtigungen
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Filters and Actions */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Alle', count: wasteItems.length },
                { value: 'pending', label: 'Ausstehend', count: wasteItems.filter(w => w.status === 'pending').length },
                { value: 'overdue', label: 'Überfällig', count: wasteItems.filter(w => differenceInDays(new Date(w.scheduledDate), new Date()) < 0 && w.status === 'pending').length },
                { value: 'critical', label: 'Kritisch', count: wasteItems.filter(w => wasteTypes.find(type => type.id === w.wasteTypeId)?.hazardLevel === 'critical').length },
                { value: 'my', label: 'Meine', count: wasteItems.filter(w => w.assignedTo === user.id).length }
              ].map(filterOption => (
                <button
                  key={filterOption.value}
                  onClick={() => setFilter(filterOption.value)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filter === filterOption.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filterOption.label} ({filterOption.count})
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowScheduleModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <span>📅</span>
                <span>Entsorgung planen</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <span>+</span>
                <span>Neue Entsorgung</span>
              </button>
            </div>
          </div>

          {/* Waste Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const wasteType = wasteTypes.find(type => type.id === item.wasteTypeId);
              const hazard = hazardLevels[wasteType?.hazardLevel || 'low'];
              const statusInfo = getStatusInfo(item);

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-lg border-l-4 overflow-hidden hover:shadow-xl transition-all ${
                    wasteType?.hazardLevel === 'critical' ? 'ring-2 ring-red-300 animate-pulse' : ''
                  }`}
                  style={{ borderLeftColor: wasteType?.color }}
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm"
                          style={{ backgroundColor: `${wasteType?.color}20` }}
                        >
                          {wasteType?.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{wasteType?.name}</h3>
                          <p className="text-sm text-gray-500">{wasteType?.container}</p>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium text-white`} style={{ backgroundColor: hazard.color }}>
                          {hazard.label}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Zuständig:</span>
                        <p className="text-gray-600">{item.assignedToName}</p>
                      </div>

                      <div>
                        <span className="font-medium text-gray-700">Geplant für:</span>
                        <p className="text-gray-600">
                          {format(new Date(item.scheduledDate), 'dd.MM.yyyy - EEEE', { locale: de })}
                        </p>
                      </div>

                      <div>
                        <span className="font-medium text-gray-700">Standort:</span>
                        <p className="text-gray-600">{item.location}</p>
                      </div>

                      {item.estimatedQuantity && (
                        <div>
                          <span className="font-medium text-gray-700">Menge:</span>
                          <p className="text-gray-600">{item.estimatedQuantity}</p>
                        </div>
                      )}

                      {item.notes && (
                        <div>
                          <span className="font-medium text-gray-700">Notizen:</span>
                          <p className="text-gray-600">{item.notes}</p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-700">Entsorgungshinweise:</span>
                        <p className="text-gray-600 text-xs">{wasteType?.disposal.instructions}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    {item.status === 'pending' && item.assignedTo === user.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => handleCompleteWasteItem(item.id)}
                          className="w-full bg-green-600 text-white px-3 py-2 rounded-md text-sm hover:bg-green-700 transition-colors"
                        >
                          ✓ Als entsorgt markieren
                        </button>
                      </div>
                    )}

                    {item.status === 'completed' && (
                      <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                        <p className="text-sm text-green-600">
                          ✓ Abgeschlossen von {item.completedBy}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.lastCompleted), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Waste Types Tab */}
      {activeTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wasteTypes.map(wasteType => {
            const hazard = hazardLevels[wasteType.hazardLevel];

            return (
              <div
                key={wasteType.id}
                className="bg-white rounded-xl shadow-lg border-l-4 overflow-hidden hover:shadow-xl transition-shadow"
                style={{ borderLeftColor: wasteType.color }}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg"
                        style={{ backgroundColor: `${wasteType.color}20` }}
                      >
                        {wasteType.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{wasteType.name}</h3>
                        <p className="text-sm text-gray-600">{wasteType.container}</p>
                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white mt-1`} style={{ backgroundColor: hazard.color }}>
                          {hazard.label}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Beschreibung:</span>
                      <p className="text-gray-600 mt-1">{wasteType.description}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Entsorgungsort:</span>
                      <p className="text-gray-600">{wasteType.disposal.location}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Häufigkeit:</span>
                      <p className="text-gray-600">{wasteType.disposal.frequency}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Anweisungen:</span>
                      <p className="text-gray-600 text-xs bg-gray-50 p-2 rounded">
                        {wasteType.disposal.instructions}
                      </p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Zuständige Rollen:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wasteType.disposal.responsibleRole.map(role => (
                          <span key={role} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {role === 'admin' ? 'Administrator' :
                             role === 'safety_officer' ? 'Sicherheitsbeauftragter' :
                             role === 'manager' ? 'Manager' : 'Mitarbeiter'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSelectedWasteType(wasteType.id);
                        setItemForm(prev => ({ ...prev, wasteTypeId: wasteType.id }));
                        setShowAddModal(true);
                      }}
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
                    >
                      Entsorgung planen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Neue Abfallentsorgung planen</h2>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Abfallart *
                  </label>
                  <select
                    value={itemForm.wasteTypeId}
                    onChange={(e) => setItemForm({...itemForm, wasteTypeId: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Abfallart wählen...</option>
                    {wasteTypes.map(type => {
                      const hazard = hazardLevels[type.hazardLevel];
                      return (
                        <option key={type.id} value={type.id}>
                          {type.icon} {type.name} - {hazard.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Zuständige Person *
                  </label>
                  <select
                    value={itemForm.assignedTo}
                    onChange={(e) => setItemForm({...itemForm, assignedTo: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Person auswählen...</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geplantes Datum *
                  </label>
                  <input
                    type="date"
                    value={itemForm.scheduledDate}
                    onChange={(e) => setItemForm({...itemForm, scheduledDate: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Häufigkeit
                  </label>
                  <select
                    value={itemForm.frequency}
                    onChange={(e) => setItemForm({...itemForm, frequency: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {frequencies.map(freq => (
                      <option key={freq.value} value={freq.value}>
                        {freq.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Standort
                  </label>
                  <input
                    type="text"
                    value={itemForm.location}
                    onChange={(e) => setItemForm({...itemForm, location: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. Labor A, Raum 201"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Geschätzte Menge
                  </label>
                  <input
                    type="text"
                    value={itemForm.estimatedQuantity}
                    onChange={(e) => setItemForm({...itemForm, estimatedQuantity: e.target.value})}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. 2 Kanister, 500ml"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notizen
                </label>
                <textarea
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({...itemForm, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Zusätzliche Informationen oder spezielle Anweisungen..."
                />
              </div>

              <div className="mt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemForm.isRecurring}
                    onChange={(e) => setItemForm({...itemForm, isRecurring: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Wiederkehrende Entsorgung (automatisch neue Termine erstellen)
                  </span>
                </label>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateWasteItem}
                  disabled={loading || !itemForm.wasteTypeId || !itemForm.assignedTo || !itemForm.scheduledDate}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                >
                  {loading ? 'Erstelle...' : 'Entsorgung planen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Keine Benachrichtigungen</h3>
              <p className="text-gray-600">Alle Abfallentsorgungen sind auf dem neuesten Stand.</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border-l-4 ${
                  notification.type === 'urgent' ? 'bg-red-50 border-red-400' :
                  notification.type === 'success' ? 'bg-green-50 border-green-400' :
                  'bg-blue-50 border-blue-400'
                } ${!notification.read ? 'shadow-md' : 'opacity-75'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{notification.title}</h4>
                    <p className="text-gray-700 mt-1">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {format(new Date(notification.createdAt), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => {
                        setNotifications(prev =>
                          prev.map(n => n.id === notification.id ? {...n, read: true} : n)
                        );
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedWasteManager;
