import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';
import { showError, showSuccess, showWarning } from '../utils/toast';
import { useWebSocketContext } from '../context/WebSocketContext';
import {
  Trash2,
  Plus,
  MapPin,
  Package,
  Calendar,
  User,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  UserPlus,
  Check,
  Loader2,
  CalendarDays,
  SlidersHorizontal
} from 'lucide-react';

const WasteManagementV4 = () => {
  const { onTaskEvent } = useWebSocketContext();

  // Data state
  const [categories, setCategories] = useState([]);
  const [wasteItems, setWasteItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Quick entry form state
  const [formData, setFormData] = useState({
    template_id: '',
    name: '',
    location: '',
    quantity: '',
    unit: 'Stück',
    next_disposal_date: '',
    notes: ''
  });

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    status: 'all',
    dateRange: 'all',
    customStartDate: '',
    customEndDate: '',
    searchText: '',
    assignedUser: ''
  });

  // Sort state
  const [sortBy, setSortBy] = useState('date'); // date, category, status

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Modal state
  const [assignModal, setAssignModal] = useState(null);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [categoriesRes, itemsRes, usersRes] = await Promise.all([
        api.get('/waste/templates').catch(err => {
          console.error('Error loading templates:', err);
          return { data: [] };
        }),
        api.get('/waste/items').catch(err => {
          console.error('Error loading items:', err);
          return { data: [] };
        }),
        api.get('/admin/users').catch(() => ({ data: [] }))
      ]);

      setCategories(categoriesRes.data || []);

      const items = itemsRes.data;
      if (Array.isArray(items)) {
        setWasteItems(items);
      } else {
        setWasteItems([...(items?.active || []), ...(items?.history || [])]);
      }

      setUsers(usersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket listeners
  useEffect(() => {
    if (!onTaskEvent) return;

    const cleanups = [];

    const handleTaskUpdate = (data) => {
      const task = data?.task || data;
      if (task?.category === 'waste') {
        loadData();
      }
    };

    cleanups.push(onTaskEvent('task:created', handleTaskUpdate));
    cleanups.push(onTaskEvent('task:updated', handleTaskUpdate));
    cleanups.push(onTaskEvent('task:deleted', handleTaskUpdate));

    return () => cleanups.forEach(cleanup => cleanup?.());
  }, [onTaskEvent, loadData]);

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    setFormData(prev => ({
      ...prev,
      template_id: categoryId,
      unit: category?.default_unit || 'Stück'
    }));
  };

  // Create new waste item
  const handleCreateItem = async (e) => {
    e.preventDefault();

    if (!formData.template_id) {
      showWarning('Bitte wählen Sie eine Kategorie aus');
      return;
    }

    if (!formData.name?.trim()) {
      showWarning('Bitte geben Sie eine Beschreibung ein');
      return;
    }

    try {
      setSaving(true);
      await api.post('/waste/items', {
        template_id: formData.template_id,
        name: formData.name.trim(),
        location: formData.location?.trim() || null,
        quantity: formData.quantity ? parseFloat(formData.quantity) : null,
        unit: formData.unit || 'Stück',
        next_disposal_date: formData.next_disposal_date || null,
        notes: formData.notes?.trim() || null
      });

      showSuccess('Abfallelement erfolgreich erstellt');
      setFormData({
        template_id: '',
        name: '',
        location: '',
        quantity: '',
        unit: 'Stück',
        next_disposal_date: '',
        notes: ''
      });
      await loadData();
    } catch (error) {
      console.error('Error creating item:', error);
      showError(error?.response?.data?.error || 'Fehler beim Erstellen');
    } finally {
      setSaving(false);
    }
  };

  // Mark item as disposed
  const handleMarkDisposed = async (itemId) => {
    try {
      await api.put(`/waste/items/${itemId}`, {
        status: 'disposed',
        last_disposal_date: new Date().toISOString().split('T')[0]
      });
      showSuccess('Als entsorgt markiert');
      await loadData();
    } catch (error) {
      console.error('Error marking disposed:', error);
      showError(error?.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  // Open assign modal
  const openAssignModal = (item) => {
    setAssignModal(item);
    setSelectedAssignee(item.assigned_to || '');
  };

  // Assign user to item
  const handleAssignUser = async () => {
    if (!assignModal) return;

    try {
      await api.put(`/waste/items/${assignModal.id}`, {
        assigned_to: selectedAssignee || null
      });
      showSuccess('Benutzer zugewiesen');
      setAssignModal(null);
      setSelectedAssignee('');
      await loadData();
    } catch (error) {
      console.error('Error assigning user:', error);
      showError(error?.response?.data?.error || 'Fehler beim Zuweisen');
    }
  };

  // Open delete confirmation
  const openDeleteModal = (item) => {
    setDeleteModal(item);
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!deleteModal) return;

    try {
      await api.delete(`/waste/items/${deleteModal.id}`);
      showSuccess('Abfallelement gelöscht');
      setDeleteModal(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      showError(error?.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  // Apply filters and sorting
  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...wasteItems];

    // Filter by category
    if (filters.category) {
      filtered = filtered.filter(item => item.template_id === parseInt(filters.category));
    }

    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    // Filter by assigned user
    if (filters.assignedUser) {
      filtered = filtered.filter(item => item.assigned_to === parseInt(filters.assignedUser));
    }

    // Filter by search text
    if (filters.searchText) {
      const search = filters.searchText.toLowerCase();
      filtered = filtered.filter(item =>
        item.name?.toLowerCase().includes(search) ||
        item.location?.toLowerCase().includes(search) ||
        item.template_name?.toLowerCase().includes(search)
      );
    }

    // Filter by date range
    const now = new Date();
    if (filters.dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => {
        if (!item.next_disposal_date) return false;
        const date = new Date(item.next_disposal_date);
        return date >= weekAgo && date <= now;
      });
    } else if (filters.dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(item => {
        if (!item.next_disposal_date) return false;
        const date = new Date(item.next_disposal_date);
        return date >= monthAgo && date <= now;
      });
    } else if (filters.dateRange === 'custom') {
      if (filters.customStartDate && filters.customEndDate) {
        const start = new Date(filters.customStartDate);
        const end = new Date(filters.customEndDate);
        filtered = filtered.filter(item => {
          if (!item.next_disposal_date) return false;
          const date = new Date(item.next_disposal_date);
          return date >= start && date <= end;
        });
      }
    }

    // Sort items
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = a.next_disposal_date ? new Date(a.next_disposal_date) : new Date('9999-12-31');
        const dateB = b.next_disposal_date ? new Date(b.next_disposal_date) : new Date('9999-12-31');
        return dateA - dateB;
      } else if (sortBy === 'category') {
        return (a.template_name || '').localeCompare(b.template_name || '');
      } else if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });

    return filtered;
  }, [wasteItems, filters, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy]);

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      active: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, label: 'Aktiv' },
      disposed: { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Check, label: 'Entsorgt' },
      scheduled: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Calendar, label: 'Geplant' }
    };
    const badge = badges[status] || badges.active;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  // Check if date is overdue
  const isOverdue = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  // Get assigned user name
  const getAssignedUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.name || 'Unbekannt';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Lade Abfallverwaltung...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Abfallverwaltung</h1>
              <p className="text-gray-600">Verwalten Sie Abfälle effizient und nachhaltig</p>
            </div>
          </div>
        </div>

        {/* Quick Entry Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Schnellerfassung
          </h2>
          <form onSubmit={handleCreateItem} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategorie *
                </label>
                <select
                  value={formData.template_id}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Kategorie wählen...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.hazard_level && `(${cat.hazard_level})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name/Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name/Beschreibung *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="z.B. Chemikalienabfall Labor 3"
                  required
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Standort
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="z.B. Lager Raum 204"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline mr-1" />
                  Menge
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Einheit
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleInputChange('unit', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Stück">Stück</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="m³">m³</option>
                  <option value="Behälter">Behälter</option>
                </select>
              </div>

              {/* Next Disposal Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Nächste Entsorgung
                </label>
                <input
                  type="date"
                  value={formData.next_disposal_date}
                  onChange={(e) => handleInputChange('next_disposal_date', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notizen
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows="2"
                placeholder="Zusätzliche Informationen..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Erstellen
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Filter & Suche
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showFilters ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ausblenden
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Erweiterte Filter
                </>
              )}
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Suche nach Name, Standort oder Kategorie..."
              value={filters.searchText}
              onChange={(e) => setFilters(prev => ({ ...prev, searchText: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kategorie
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Alle Kategorien</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Alle Status</option>
                  <option value="active">Aktiv</option>
                  <option value="disposed">Entsorgt</option>
                  <option value="scheduled">Geplant</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zeitraum
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Alle Termine</option>
                  <option value="week">Diese Woche</option>
                  <option value="month">Dieser Monat</option>
                  <option value="custom">Benutzerdefiniert</option>
                </select>
              </div>

              {/* Assigned User Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zugewiesen an
                </label>
                <select
                  value={filters.assignedUser}
                  onChange={(e) => setFilters(prev => ({ ...prev, assignedUser: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Alle Benutzer</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              {/* Custom Date Range */}
              {filters.dateRange === 'custom' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Von
                    </label>
                    <input
                      type="date"
                      value={filters.customStartDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, customStartDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bis
                    </label>
                    <input
                      type="date"
                      value={filters.customEndDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, customEndDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sort Options */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Sortieren:
            </span>
            <button
              onClick={() => setSortBy('date')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'date' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Nach Datum
            </button>
            <button
              onClick={() => setSortBy('category')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'category' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Nach Kategorie
            </button>
            <button
              onClick={() => setSortBy('status')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                sortBy === 'status' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Nach Status
            </button>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-600">
            {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'Element' : 'Elemente'} gefunden
          </p>
          {filteredAndSortedItems.length > itemsPerPage && (
            <p className="text-sm text-gray-500">
              Seite {currentPage} von {totalPages}
            </p>
          )}
        </div>

        {/* Items List */}
        {paginatedItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Keine Abfallelemente gefunden</h3>
            <p className="text-gray-600">
              {filters.searchText || filters.category || filters.status !== 'all'
                ? 'Versuchen Sie, Ihre Filter anzupassen'
                : 'Erstellen Sie Ihr erstes Abfallelement mit dem Formular oben'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginatedItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{
                          backgroundColor: item.color ? `${item.color}20` : '#E5E7EB',
                          color: item.color || '#374151'
                        }}
                      >
                        {item.template_name || 'Unbekannte Kategorie'}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {item.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{item.location}</span>
                    </div>
                  )}
                  {item.quantity && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span>{item.quantity} {item.unit || 'Stück'}</span>
                    </div>
                  )}
                  {item.last_disposal_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>Letzte Entsorgung: {new Date(item.last_disposal_date).toLocaleDateString('de-DE')}</span>
                    </div>
                  )}
                  {item.next_disposal_date && (
                    <div className={`flex items-center gap-2 text-sm font-semibold ${
                      isOverdue(item.next_disposal_date) ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      <CalendarDays className="w-4 h-4" />
                      <span>
                        Nächste Entsorgung: {new Date(item.next_disposal_date).toLocaleDateString('de-DE')}
                        {isOverdue(item.next_disposal_date) && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Überfällig
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {item.assigned_to && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>Zugewiesen: {getAssignedUserName(item.assigned_to)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => openAssignModal(item)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    Zuweisen
                  </button>
                  {item.status !== 'disposed' && (
                    <button
                      onClick={() => handleMarkDisposed(item.id)}
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Als entsorgt markieren
                    </button>
                  )}
                  <button
                    onClick={() => openDeleteModal(item)}
                    className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Zurück
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
            </button>
          </div>
        )}
      </div>

      {/* Assign User Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Benutzer zuweisen</h3>
            <p className="text-gray-600 mb-4">
              Weisen Sie einen Benutzer zu: <strong>{assignModal.name}</strong>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Benutzer auswählen
              </label>
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Nicht zugewiesen</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAssignModal(null);
                  setSelectedAssignee('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAssignUser}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Zuweisen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Element löschen?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Möchten Sie <strong>{deleteModal.name}</strong> wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteItem}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WasteManagementV4;
