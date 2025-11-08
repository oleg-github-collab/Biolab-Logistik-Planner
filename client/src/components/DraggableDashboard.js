import React, { useState, useEffect } from 'react';
import {
  LayoutGrid, GripVertical, Plus, X, Settings, Eye, EyeOff, Maximize2, Minimize2
} from 'lucide-react';
import { showSuccess } from '../utils/toast';

/**
 * DraggableDashboard Component
 * Customizable dashboard with draggable widgets
 */
const DraggableDashboard = ({ widgets = [], onWidgetOrderChange }) => {
  const [widgetLayout, setWidgetLayout] = useState([]);
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [availableWidgets, setAvailableWidgets] = useState([
    { id: 'tasks', title: 'Aufgaben', enabled: true, size: 'large' },
    { id: 'calendar', title: 'Kalender', enabled: true, size: 'large' },
    { id: 'messages', title: 'Nachrichten', enabled: true, size: 'medium' },
    { id: 'waste', title: 'Entsorgung', enabled: true, size: 'medium' },
    { id: 'kb', title: 'Knowledge Base', enabled: true, size: 'small' },
    { id: 'stats', title: 'Statistiken', enabled: true, size: 'medium' },
    { id: 'notifications', title: 'Benachrichtigungen', enabled: false, size: 'small' },
    { id: 'team', title: 'Team', enabled: false, size: 'small' }
  ]);

  useEffect(() => {
    // Load saved layout from localStorage
    const savedLayout = localStorage.getItem('dashboardLayout');
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout);
        setAvailableWidgets(parsed);
      } catch (error) {
        console.error('Error loading dashboard layout:', error);
      }
    }
  }, []);

  useEffect(() => {
    const enabled = availableWidgets.filter(w => w.enabled);
    setWidgetLayout(enabled);
  }, [availableWidgets]);

  const handleDragStart = (e, widget) => {
    setDraggedWidget(widget);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetWidget) => {
    e.preventDefault();

    if (!draggedWidget || draggedWidget.id === targetWidget.id) {
      return;
    }

    const newLayout = [...availableWidgets];
    const draggedIndex = newLayout.findIndex(w => w.id === draggedWidget.id);
    const targetIndex = newLayout.findIndex(w => w.id === targetWidget.id);

    // Swap positions
    [newLayout[draggedIndex], newLayout[targetIndex]] = [newLayout[targetIndex], newLayout[draggedIndex]];

    setAvailableWidgets(newLayout);
    saveLayout(newLayout);
    setDraggedWidget(null);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const toggleWidget = (widgetId) => {
    const newLayout = availableWidgets.map(w =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    setAvailableWidgets(newLayout);
    saveLayout(newLayout);
  };

  const changeWidgetSize = (widgetId, newSize) => {
    const newLayout = availableWidgets.map(w =>
      w.id === widgetId ? { ...w, size: newSize } : w
    );
    setAvailableWidgets(newLayout);
    saveLayout(newLayout);
  };

  const saveLayout = (layout) => {
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
    showSuccess('Dashboard-Layout gespeichert');
  };

  const resetLayout = () => {
    localStorage.removeItem('dashboardLayout');
    setAvailableWidgets([
      { id: 'tasks', title: 'Aufgaben', enabled: true, size: 'large' },
      { id: 'calendar', title: 'Kalender', enabled: true, size: 'large' },
      { id: 'messages', title: 'Nachrichten', enabled: true, size: 'medium' },
      { id: 'waste', title: 'Entsorgung', enabled: true, size: 'medium' },
      { id: 'kb', title: 'Knowledge Base', enabled: true, size: 'small' },
      { id: 'stats', title: 'Statistiken', enabled: true, size: 'medium' },
      { id: 'notifications', title: 'Benachrichtigungen', enabled: false, size: 'small' },
      { id: 'team', title: 'Team', enabled: false, size: 'small' }
    ]);
    showSuccess('Dashboard zurückgesetzt');
  };

  const getWidgetSizeClass = (size) => {
    switch (size) {
      case 'small':
        return 'col-span-1 row-span-1';
      case 'medium':
        return 'col-span-1 lg:col-span-2 row-span-1';
      case 'large':
        return 'col-span-1 lg:col-span-2 row-span-2';
      default:
        return 'col-span-1';
    }
  };

  const getWidgetContent = (widgetId) => {
    // Placeholder content for each widget
    const content = {
      tasks: (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="font-semibold text-blue-900">5 Offene Aufgaben</p>
            <p className="text-sm text-blue-700">2 heute fällig</p>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                Aufgabe {i}
              </div>
            ))}
          </div>
        </div>
      ),
      calendar: (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="font-semibold text-green-900">3 Termine heute</p>
            <p className="text-sm text-green-700">Nächster in 2 Stunden</p>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                Termin {i}
              </div>
            ))}
          </div>
        </div>
      ),
      messages: (
        <div className="space-y-3">
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="font-semibold text-purple-900">12 Ungelesene Nachrichten</p>
          </div>
        </div>
      ),
      waste: (
        <div className="space-y-3">
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="font-semibold text-orange-900">8 Ausstehende Entsorgungen</p>
          </div>
        </div>
      ),
      kb: (
        <div className="space-y-3">
          <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
            <p className="font-semibold text-cyan-900">42 KB Artikel</p>
          </div>
        </div>
      ),
      stats: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-blue-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-900">156</p>
              <p className="text-xs text-blue-700">Tasks</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-900">23</p>
              <p className="text-xs text-green-700">Events</p>
            </div>
          </div>
        </div>
      ),
      notifications: (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-2 bg-yellow-50 rounded border border-yellow-200 text-xs">
              Benachrichtigung {i}
            </div>
          ))}
        </div>
      ),
      team: (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <div className="w-8 h-8 bg-blue-200 rounded-full" />
              <span className="text-sm">Mitglied {i}</span>
            </div>
          ))}
        </div>
      )
    };

    return content[widgetId] || <p className="text-slate-400 text-sm">Widget Inhalt</p>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutGrid className="w-7 h-7 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCustomizeMode(!customizeMode)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              customizeMode
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            {customizeMode ? 'Fertig' : 'Anpassen'}
          </button>

          {customizeMode && (
            <button
              onClick={resetLayout}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
            >
              Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Customize Panel */}
      {customizeMode && (
        <div className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
          <h3 className="font-bold text-lg text-blue-900 mb-4">Widgets verwalten</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {availableWidgets.map(widget => (
              <div
                key={widget.id}
                className={`p-4 rounded-lg border-2 transition ${
                  widget.enabled
                    ? 'bg-white border-blue-300'
                    : 'bg-slate-100 border-slate-300 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-900">{widget.title}</span>
                  <button
                    onClick={() => toggleWidget(widget.id)}
                    className={`p-1 rounded transition ${
                      widget.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {widget.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-1">
                  {['small', 'medium', 'large'].map(size => (
                    <button
                      key={size}
                      onClick={() => changeWidgetSize(widget.id, size)}
                      className={`flex-1 px-2 py-1 text-xs rounded transition ${
                        widget.size === size
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-blue-700 mt-4">
            💡 Tipp: Ziehen Sie Widgets per Drag & Drop, um ihre Reihenfolge zu ändern
          </p>
        </div>
      )}

      {/* Widget Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 auto-rows-fr">
        {widgetLayout.map(widget => (
          <div
            key={widget.id}
            draggable={customizeMode}
            onDragStart={(e) => handleDragStart(e, widget)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, widget)}
            onDragEnd={handleDragEnd}
            className={`
              ${getWidgetSizeClass(widget.size)}
              p-6 bg-white rounded-xl border-2 border-slate-200 shadow-sm
              transition-all duration-200
              ${customizeMode ? 'cursor-move hover:border-blue-400 hover:shadow-lg' : ''}
              ${draggedWidget?.id === widget.id ? 'opacity-50' : ''}
            `}
          >
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-900">{widget.title}</h3>
              {customizeMode && (
                <GripVertical className="w-5 h-5 text-slate-400" />
              )}
            </div>

            {/* Widget Content */}
            <div className="h-full overflow-y-auto">
              {getWidgetContent(widget.id)}
            </div>
          </div>
        ))}

        {widgetLayout.length === 0 && (
          <div className="col-span-full p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 text-center">
            <LayoutGrid className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">Keine Widgets aktiviert</p>
            <button
              onClick={() => setCustomizeMode(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard anpassen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraggableDashboard;
