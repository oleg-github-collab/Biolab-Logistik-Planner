import React, { useState } from 'react';
import {
  Calendar, Clock, Users, Tag, Trash2, Copy, Edit3,
  ChevronDown, X, AlertCircle, CheckCircle, MapPin,
  Bell, Palette, Archive, Send, Download, Upload
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';

const BulkEventOperations = ({
  selectedEvents = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onExport,
  onClose,
  users = []
}) => {
  const [activeAction, setActiveAction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [duplicateOptions, setDuplicateOptions] = useState({
    offset: 1,
    offsetType: 'days',
    count: 1
  });

  const selectedCount = selectedEvents.length;

  if (selectedCount === 0) return null;

  const handleBulkUpdate = async (field, value) => {
    try {
      const updates = selectedEvents.map(event => ({
        id: event.id,
        [field]: value
      }));
      await onUpdate?.(updates);
      setActiveAction(null);
    } catch (error) {
      console.error('Bulk update error:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await onDelete?.(selectedEvents.map(e => e.id));
      setShowDeleteConfirm(false);
      onClose?.();
    } catch (error) {
      console.error('Bulk delete error:', error);
    }
  };

  const handleBulkDuplicate = async () => {
    try {
      const duplicates = [];
      selectedEvents.forEach(event => {
        for (let i = 1; i <= duplicateOptions.count; i++) {
          const offset = duplicateOptions.offset * i;
          let newStart, newEnd;

          switch (duplicateOptions.offsetType) {
            case 'weeks':
              newStart = addWeeks(new Date(event.start), offset);
              newEnd = addWeeks(new Date(event.end), offset);
              break;
            case 'months':
              newStart = addMonths(new Date(event.start), offset);
              newEnd = addMonths(new Date(event.end), offset);
              break;
            default:
              newStart = addDays(new Date(event.start), offset);
              newEnd = addDays(new Date(event.end), offset);
          }

          duplicates.push({
            ...event,
            id: undefined,
            start: newStart,
            end: newEnd,
            title: `${event.title} (Kopie ${i})`
          });
        }
      });

      await onDuplicate?.(duplicates);
      setActiveAction(null);
      onClose?.();
    } catch (error) {
      console.error('Bulk duplicate error:', error);
    }
  };

  const handleExport = async (format) => {
    try {
      await onExport?.(selectedEvents, format);
      setActiveAction(null);
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const eventTypes = [
    { value: 'Arbeit', label: 'Arbeit', color: 'bg-sky-500' },
    { value: 'Meeting', label: 'Meeting', color: 'bg-indigo-500' },
    { value: 'Urlaub', label: 'Urlaub', color: 'bg-amber-500' },
    { value: 'Krankheit', label: 'Krankheit', color: 'bg-rose-500' },
    { value: 'Projekt', label: 'Projekt', color: 'bg-violet-500' }
  ];

  const priorities = [
    { value: 'low', label: 'Niedrig', color: 'bg-green-500' },
    { value: 'medium', label: 'Mittel', color: 'bg-yellow-500' },
    { value: 'high', label: 'Hoch', color: 'bg-orange-500' }
  ];

  const colors = [
    '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981',
    '#6366F1', '#EC4899', '#14B8A6', '#F97316', '#84CC16'
  ];

  return (
    <>
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[1100] w-full max-w-4xl px-4">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white rounded-3xl shadow-2xl border border-white/20 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center font-bold text-lg">
                  {selectedCount}
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {selectedCount} {selectedCount === 1 ? 'Termin' : 'Termine'} ausgewählt
                  </p>
                  <p className="text-sm text-blue-100">
                    Bulk-Operationen verfügbar
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            {/* Update Type */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'type' ? null : 'type')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <Tag className="w-4 h-4" />
                <span>Typ ändern</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'type' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'type' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto">
                  {eventTypes.map(type => (
                    <button
                      key={type.value}
                      onClick={() => handleBulkUpdate('type', type.value)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <div className={`w-3 h-3 rounded-full ${type.color}`} />
                      {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Update Priority */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'priority' ? null : 'priority')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <AlertCircle className="w-4 h-4" />
                <span>Priorität</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'priority' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'priority' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-2">
                  {priorities.map(priority => (
                    <button
                      key={priority.value}
                      onClick={() => handleBulkUpdate('priority', priority.value)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <div className={`w-3 h-3 rounded-full ${priority.color}`} />
                      {priority.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assign Users */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'assign' ? null : 'assign')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <Users className="w-4 h-4" />
                <span>Zuweisen</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'assign' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'assign' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto">
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleBulkUpdate('attendees', [user.id])}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                        {user.name?.[0]?.toUpperCase()}
                      </div>
                      {user.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Update Color */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'color' ? null : 'color')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <Palette className="w-4 h-4" />
                <span>Farbe</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'color' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'color' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-3">
                  <div className="grid grid-cols-5 gap-2">
                    {colors.map(color => (
                      <button
                        key={color}
                        onClick={() => handleBulkUpdate('color', color)}
                        className="w-8 h-8 rounded-lg transition-transform hover:scale-110"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Duplicate */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'duplicate' ? null : 'duplicate')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <Copy className="w-4 h-4" />
                <span>Duplizieren</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'duplicate' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'duplicate' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-4 min-w-[250px]">
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Verschiebung</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={duplicateOptions.offset}
                          onChange={(e) => setDuplicateOptions({...duplicateOptions, offset: parseInt(e.target.value)})}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <select
                          value={duplicateOptions.offsetType}
                          onChange={(e) => setDuplicateOptions({...duplicateOptions, offsetType: e.target.value})}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="days">Tage</option>
                          <option value="weeks">Wochen</option>
                          <option value="months">Monate</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Anzahl Kopien</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={duplicateOptions.count}
                        onChange={(e) => setDuplicateOptions({...duplicateOptions, count: parseInt(e.target.value)})}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </div>
                    <button
                      onClick={handleBulkDuplicate}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Duplizieren
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setActiveAction(activeAction === 'export' ? null : 'export')}
                className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
              >
                <Download className="w-4 h-4" />
                <span>Exportieren</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeAction === 'export' ? 'rotate-180' : ''}`} />
              </button>

              {activeAction === 'export' && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl p-2">
                  <button
                    onClick={() => handleExport('ics')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Als iCal (.ics)
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Als CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Als JSON
                  </button>
                </div>
              )}
            </div>

            {/* Archive */}
            <button
              onClick={() => handleBulkUpdate('status', 'archived')}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur"
            >
              <Archive className="w-4 h-4" />
              <span>Archivieren</span>
            </button>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2 font-medium backdrop-blur border border-red-400/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>Löschen</span>
            </button>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="border-t border-white/20 px-6 py-4 bg-red-500/10 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-300" />
                  <span className="font-medium">
                    Wirklich {selectedCount} {selectedCount === 1 ? 'Termin' : 'Termine'} löschen?
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium"
                  >
                    Endgültig löschen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {activeAction && (
        <div
          className="fixed inset-0 z-[1000]"
          onClick={() => setActiveAction(null)}
        />
      )}
    </>
  );
};

export default BulkEventOperations;