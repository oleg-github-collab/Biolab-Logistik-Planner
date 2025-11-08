import React, { useState } from 'react';
import {
  CheckSquare, Trash2, Users, Tag, Calendar, AlertCircle, X, ChevronDown
} from 'lucide-react';
import { bulkUpdateTasks, bulkDeleteTasks, bulkAssignTasks } from '../utils/apiEnhanced';
import { showError, showSuccess } from '../utils/toast';

/**
 * BulkActionsPanel Component
 * Toolbar for bulk task operations with multi-select
 */
const BulkActionsPanel = ({ selectedIds = [], onActionComplete, users = [] }) => {
  const [showActions, setShowActions] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const selectedCount = selectedIds.length;

  if (selectedCount === 0) return null;

  const handleBulkUpdate = async (field, value) => {
    try {
      const updates = { [field]: value };
      await bulkUpdateTasks(selectedIds, updates);
      showSuccess(`${selectedCount} Aufgaben aktualisiert`);
      onActionComplete?.();
    } catch (error) {
      console.error('Bulk update error:', error);
      showError('Fehler beim Aktualisieren');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteTasks(selectedIds);
      showSuccess(`${selectedCount} Aufgaben gelöscht`);
      setShowConfirmDelete(false);
      onActionComplete?.();
    } catch (error) {
      console.error('Bulk delete error:', error);
      showError('Fehler beim Löschen');
    }
  };

  const handleBulkAssign = async (userId) => {
    try {
      await bulkAssignTasks(selectedIds, userId);
      showSuccess(`${selectedCount} Aufgaben zugewiesen`);
      onActionComplete?.();
    } catch (error) {
      console.error('Bulk assign error:', error);
      showError('Fehler beim Zuweisen');
    }
  };

  const handleActionSelect = (action) => {
    setBulkAction(action);
    setBulkValue('');
    setShowActions(true);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-2xl border-2 border-blue-500">
        {/* Main Bar */}
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">
              {selectedCount}
            </div>
            <span className="font-semibold">
              {selectedCount} {selectedCount === 1 ? 'Aufgabe' : 'Aufgaben'} ausgewählt
            </span>
          </div>

          <div className="h-6 w-px bg-white/30" />

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Status Change */}
            <div className="relative group">
              <button
                onClick={() => handleActionSelect('status')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-2 font-medium"
              >
                <CheckSquare className="w-4 h-4" />
                Status
                <ChevronDown className="w-4 h-4" />
              </button>
              {bulkAction === 'status' && showActions && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl p-2 min-w-[150px]">
                  {['todo', 'in_progress', 'done', 'cancelled'].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        handleBulkUpdate('status', status);
                        setShowActions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded"
                    >
                      {status === 'todo' ? 'Zu erledigen' :
                       status === 'in_progress' ? 'In Bearbeitung' :
                       status === 'done' ? 'Erledigt' : 'Abgebrochen'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority Change */}
            <div className="relative group">
              <button
                onClick={() => handleActionSelect('priority')}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-2 font-medium"
              >
                <Tag className="w-4 h-4" />
                Priorität
                <ChevronDown className="w-4 h-4" />
              </button>
              {bulkAction === 'priority' && showActions && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl p-2 min-w-[150px]">
                  {[
                    { value: 'low', label: 'Niedrig', color: 'bg-green-100' },
                    { value: 'medium', label: 'Mittel', color: 'bg-yellow-100' },
                    { value: 'high', label: 'Hoch', color: 'bg-orange-100' },
                    { value: 'urgent', label: 'Dringend', color: 'bg-red-100' }
                  ].map(priority => (
                    <button
                      key={priority.value}
                      onClick={() => {
                        handleBulkUpdate('priority', priority.value);
                        setShowActions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded flex items-center gap-2"
                    >
                      <span className={`w-3 h-3 rounded-full ${priority.color}`} />
                      {priority.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assign User */}
            {users.length > 0 && (
              <div className="relative group">
                <button
                  onClick={() => handleActionSelect('assign')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition flex items-center gap-2 font-medium"
                >
                  <Users className="w-4 h-4" />
                  Zuweisen
                  <ChevronDown className="w-4 h-4" />
                </button>
                {bulkAction === 'assign' && showActions && (
                  <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-xl p-2 min-w-[200px] max-h-60 overflow-y-auto">
                    {users.map(user => (
                      <button
                        key={user.id}
                        onClick={() => {
                          handleBulkAssign(user.id);
                          setShowActions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {user.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        {user.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete */}
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition flex items-center gap-2 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </button>
          </div>

          <div className="h-6 w-px bg-white/30" />

          {/* Close Button */}
          <button
            onClick={() => onActionComplete?.()}
            className="p-2 hover:bg-white/20 rounded-lg transition"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Delete Confirmation */}
        {showConfirmDelete && (
          <div className="border-t border-white/20 px-6 py-4 bg-red-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-300" />
                <span className="font-medium">
                  {selectedCount} {selectedCount === 1 ? 'Aufgabe' : 'Aufgaben'} wirklich löschen?
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition font-medium"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {showActions && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActions(false)}
        />
      )}
    </div>
  );
};

export default BulkActionsPanel;
