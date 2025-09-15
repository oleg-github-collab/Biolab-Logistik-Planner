import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const EventTemplateManager = ({ isOpen, onClose, onApplyTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    titleTemplate: '',
    descriptionTemplate: '',
    type: 'Arbeit',
    defaultDuration: 60,
    defaultStartTime: '09:00',
    isAllDay: false,
    priority: 'medium',
    locationTemplate: '',
    category: 'work',
    color: '#3B82F6',
    tags: []
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Default templates
  const defaultTemplates = [
    {
      id: 'meeting-1h',
      name: 'Standard Meeting',
      titleTemplate: 'Team Meeting',
      descriptionTemplate: 'Weekly team sync meeting to discuss progress and blockers',
      type: 'Meeting',
      defaultDuration: 60,
      defaultStartTime: '10:00',
      priority: 'medium',
      locationTemplate: 'Konferenzraum A',
      category: 'work',
      color: '#3B82F6',
      icon: '👥'
    },
    {
      id: 'workday-full',
      name: 'Ganzer Arbeitstag',
      titleTemplate: 'Arbeitstag',
      descriptionTemplate: 'Regulärer Arbeitstag im Labor',
      type: 'Arbeit',
      defaultDuration: 480,
      defaultStartTime: '09:00',
      isAllDay: false,
      priority: 'medium',
      locationTemplate: 'Labor',
      category: 'work',
      color: '#10B981',
      icon: '💼'
    },
    {
      id: 'lunch-break',
      name: 'Mittagspause',
      titleTemplate: 'Mittagspause',
      descriptionTemplate: 'Pause zum Mittagessen',
      type: 'Pause',
      defaultDuration: 30,
      defaultStartTime: '12:00',
      priority: 'low',
      locationTemplate: 'Kantine',
      category: 'personal',
      color: '#F59E0B',
      icon: '🍽️'
    },
    {
      id: 'lab-maintenance',
      name: 'Labor Wartung',
      titleTemplate: 'Laborwartung - {equipment}',
      descriptionTemplate: 'Wartung und Kalibrierung der Laborgeräte',
      type: 'Wartung',
      defaultDuration: 120,
      defaultStartTime: '14:00',
      priority: 'high',
      locationTemplate: 'Labor {number}',
      category: 'maintenance',
      color: '#EF4444',
      icon: '🔧'
    },
    {
      id: 'training-session',
      name: 'Schulung/Training',
      titleTemplate: 'Training: {topic}',
      descriptionTemplate: 'Schulungsveranstaltung für Mitarbeiter',
      type: 'Training',
      defaultDuration: 180,
      defaultStartTime: '09:00',
      priority: 'medium',
      locationTemplate: 'Schulungsraum',
      category: 'education',
      color: '#8B5CF6',
      icon: '📚'
    },
    {
      id: 'client-visit',
      name: 'Kundenbesuch',
      titleTemplate: 'Besuch: {client}',
      descriptionTemplate: 'Kundenbesuch und Laborführung',
      type: 'Meeting',
      defaultDuration: 90,
      defaultStartTime: '11:00',
      priority: 'high',
      locationTemplate: 'Empfang & Labor',
      category: 'business',
      color: '#06B6D4',
      icon: '🤝'
    }
  ];

  useEffect(() => {
    setTemplates(defaultTemplates);
  }, []);

  const handleApplyTemplate = (template, customValues = {}) => {
    const eventData = {
      title: template.titleTemplate,
      description: template.descriptionTemplate,
      type: template.type,
      startTime: template.defaultStartTime,
      endTime: calculateEndTime(template.defaultStartTime, template.defaultDuration),
      isAllDay: template.isAllDay,
      priority: template.priority,
      location: template.locationTemplate,
      category: template.category,
      color: template.color,
      ...customValues
    };

    onApplyTemplate(eventData);
    onClose();
  };

  const calculateEndTime = (startTime, durationMinutes) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const handleCreateTemplate = () => {
    const template = {
      ...newTemplate,
      id: `custom-${Date.now()}`,
      icon: '📅'
    };
    setTemplates([...templates, template]);
    setNewTemplate({
      name: '',
      titleTemplate: '',
      descriptionTemplate: '',
      type: 'Arbeit',
      defaultDuration: 60,
      defaultStartTime: '09:00',
      isAllDay: false,
      priority: 'medium',
      locationTemplate: '',
      category: 'work',
      color: '#3B82F6',
      tags: []
    });
    setShowCreateForm(false);
  };

  const handleDeleteTemplate = (templateId) => {
    setTemplates(templates.filter(t => t.id !== templateId));
  };

  const TemplateCard = ({ template, onApply, onEdit, onDelete }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{template.icon}</span>
          <div>
            <h4 className="font-medium text-gray-800">{template.name}</h4>
            <p className="text-sm text-gray-500">{template.type}</p>
          </div>
        </div>
        <div className="flex space-x-1">
          {!template.id.startsWith('custom-') ? null : (
            <>
              <button
                onClick={() => onEdit(template)}
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(template.id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <p><strong>Titel:</strong> {template.titleTemplate}</p>
        {template.descriptionTemplate && (
          <p><strong>Beschreibung:</strong> {template.descriptionTemplate}</p>
        )}
        <div className="flex items-center space-x-4">
          <span><strong>Dauer:</strong> {Math.floor(template.defaultDuration / 60)}h {template.defaultDuration % 60}m</span>
          <span><strong>Start:</strong> {template.defaultStartTime}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            template.priority === 'high' ? 'bg-red-100 text-red-800' :
            template.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {template.priority === 'high' ? 'Hoch' :
             template.priority === 'medium' ? 'Mittel' : 'Niedrig'}
          </span>
        </div>
      </div>

      <button
        onClick={() => onApply(template)}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Vorlage anwenden
      </button>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Event-Vorlagen</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Neue Vorlage
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {showCreateForm ? (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Neue Vorlage erstellen</h3>
              {/* Create form would go here */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Vorlagenname"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Titel-Vorlage"
                  value={newTemplate.titleTemplate}
                  onChange={(e) => setNewTemplate({...newTemplate, titleTemplate: e.target.value})}
                  className="p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={handleApplyTemplate}
                onEdit={setEditingTemplate}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">Keine Vorlagen verfügbar</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Erste Vorlage erstellen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventTemplateManager;