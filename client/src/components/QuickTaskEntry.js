import React, { useState } from 'react';
import { format, addDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const QuickTaskEntry = ({ onSave }) => {
  const { user } = useAuth();
  const [taskData, setTaskData] = useState({
    title: '',
    priority: 'medium',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    category: 'general',
    assignee: user.name
  });

  const [useVoice, setUseVoice] = useState(false);

  // Quick task templates
  const TASK_TEMPLATES = [
    {
      id: 'sample-check',
      title: 'Probenkontrolle',
      icon: '🧪',
      category: 'lab',
      priority: 'high',
      color: 'bg-blue-500'
    },
    {
      id: 'inventory',
      title: 'Bestandsaufnahme',
      icon: '📦',
      category: 'inventory',
      priority: 'medium',
      color: 'bg-green-500'
    },
    {
      id: 'cleaning',
      title: 'Reinigung',
      icon: '🧹',
      category: 'cleaning',
      priority: 'low',
      color: 'bg-yellow-500'
    },
    {
      id: 'documentation',
      title: 'Dokumentation',
      icon: '📝',
      category: 'admin',
      priority: 'medium',
      color: 'bg-purple-500'
    },
    {
      id: 'quality-check',
      title: 'Qualitätskontrolle',
      icon: '✓',
      category: 'quality',
      priority: 'high',
      color: 'bg-red-500'
    },
    {
      id: 'waste-disposal',
      title: 'Abfallentsorgung',
      icon: '♻️',
      category: 'waste',
      priority: 'high',
      color: 'bg-orange-500'
    }
  ];

  // Priority presets
  const PRIORITY_LEVELS = [
    { value: 'low', label: 'Niedrig', icon: '⬇️', color: 'bg-gray-500' },
    { value: 'medium', label: 'Mittel', icon: '➡️', color: 'bg-yellow-500' },
    { value: 'high', label: 'Hoch', icon: '⬆️', color: 'bg-orange-500' },
    { value: 'urgent', label: 'Dringend', icon: '🔥', color: 'bg-red-500' }
  ];

  // Due date presets
  const DUE_DATE_PRESETS = [
    { label: 'Heute', days: 0, icon: '📅' },
    { label: 'Morgen', days: 1, icon: '🌅' },
    { label: 'Diese Woche', days: 7, icon: '📆' },
    { label: 'Nächste Woche', days: 14, icon: '🗓️' }
  ];

  const applyTemplate = (template) => {
    setTaskData({
      ...taskData,
      title: template.title,
      category: template.category,
      priority: template.priority
    });
  };

  const setDueDate = (days) => {
    setTaskData({
      ...taskData,
      dueDate: format(addDays(new Date(), days), 'yyyy-MM-dd')
    });
  };

  const handleSave = () => {
    if (!taskData.title.trim()) {
      alert('Bitte Titel eingeben');
      return;
    }

    onSave({
      ...taskData,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      status: 'todo'
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Templates */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Schnellvorlagen
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TASK_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className={`${template.color} text-white rounded-lg p-3 flex flex-col items-center gap-1 shadow-md hover:shadow-lg active:scale-95 transition-all`}
            >
              <span className="text-2xl">{template.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">
                {template.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aufgabe
        </label>
        <div className="relative">
          <input
            type="text"
            value={taskData.title}
            onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
            placeholder="z.B. Proben analysieren..."
            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={() => setUseVoice(!useVoice)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
              useVoice ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🎤
          </button>
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Priorität
        </label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITY_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => setTaskData({ ...taskData, priority: level.value })}
              className={`py-2 px-2 rounded-lg font-medium text-xs flex flex-col items-center gap-1 transition-all ${
                taskData.priority === level.value
                  ? `${level.color} text-white shadow-lg scale-105`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-lg">{level.icon}</span>
              <span>{level.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Due Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fällig am
        </label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {DUE_DATE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => setDueDate(preset.days)}
              className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 rounded-lg py-2 px-2 text-xs font-medium flex flex-col items-center gap-1 transition-colors active:scale-95"
            >
              <span className="text-lg">{preset.icon}</span>
              <span className="leading-tight">{preset.label}</span>
            </button>
          ))}
        </div>
        <input
          type="date"
          value={taskData.dueDate}
          onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Category (hidden but auto-set from template) */}
      {taskData.category !== 'general' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-700">
            <span className="font-medium">Kategorie:</span> {taskData.category}
          </div>
        </div>
      )}

      {/* Assignee */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zugewiesen an
        </label>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">{user.name}</div>
            <div className="text-xs text-gray-500">Mir zuweisen</div>
          </div>
        </div>
      </div>

      {/* Summary */}
      {taskData.title && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-900 mb-2">
            {taskData.title}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <span>
                {PRIORITY_LEVELS.find(p => p.value === taskData.priority)?.icon}
              </span>
              <span className="capitalize">{taskData.priority}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{format(new Date(taskData.dueDate), 'dd.MM.yyyy')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Aufgabe erstellen
      </button>
    </div>
  );
};

export default QuickTaskEntry;
