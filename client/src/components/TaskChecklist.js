import React, { useState, useEffect } from 'react';
import { Check, X, Plus, Trash2, GripVertical } from 'lucide-react';

/**
 * TaskChecklist Component
 * Displays checklist with progress bar for tasks
 * @param {Array} checklist - Array of checklist items {id, text, completed}
 * @param {Function} onChange - Callback when checklist changes
 * @param {Boolean} readOnly - Whether checklist is read-only
 */
const TaskChecklist = ({ checklist = [], onChange, readOnly = false }) => {
  const [items, setItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);

  useEffect(() => {
    // Ensure checklist items have proper structure
    const normalizedItems = (checklist || []).map((item, index) => ({
      id: item.id || `item-${Date.now()}-${index}`,
      text: item.text || '',
      completed: Boolean(item.completed)
    }));
    setItems(normalizedItems);
  }, [checklist]);

  const calculateProgress = () => {
    if (items.length === 0) return 0;
    const completedCount = items.filter(item => item.completed).length;
    return Math.round((completedCount / items.length) * 100);
  };

  const handleToggle = (id) => {
    if (readOnly) return;

    const updatedItems = items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updatedItems);
    onChange?.(updatedItems);
  };

  const handleAdd = () => {
    if (!newItemText.trim() || readOnly) return;

    const newItem = {
      id: `item-${Date.now()}`,
      text: newItemText.trim(),
      completed: false
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    setNewItemText('');
    onChange?.(updatedItems);
  };

  const handleDelete = (id) => {
    if (readOnly) return;

    const updatedItems = items.filter(item => item.id !== id);
    setItems(updatedItems);
    onChange?.(updatedItems);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, item) => {
    if (readOnly) return;
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetItem) => {
    e.preventDefault();
    if (readOnly || !draggedItem || draggedItem.id === targetItem.id) return;

    const draggedIndex = items.findIndex(i => i.id === draggedItem.id);
    const targetIndex = items.findIndex(i => i.id === targetItem.id);

    const newItems = [...items];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setItems(newItems);
    setDraggedItem(null);
    onChange?.(newItems);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const progress = calculateProgress();
  const completedCount = items.filter(i => i.completed).length;

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      {items.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Fortschritt</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                {completedCount}/{items.length}
              </span>
            </div>
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>

          {/* Progress Bar */}
          <div className="relative h-4 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                progress === 100
                  ? 'bg-gradient-to-r from-green-500 to-green-600'
                  : progress >= 75
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                  : progress >= 50
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600'
              }`}
              style={{ width: `${progress}%` }}
            >
              {progress > 10 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow">
                    {progress}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Completion Message */}
          {progress === 100 && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-700 text-center flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                Alle Aufgaben abgeschlossen! 🎉
              </p>
            </div>
          )}
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-700">Checkliste</h4>
          {items.length > 0 && (
            <span className="text-xs text-slate-500">
              {items.length} {items.length === 1 ? 'Punkt' : 'Punkte'}
            </span>
          )}
        </div>

        {items.length === 0 && readOnly && (
          <div className="text-center py-6 text-slate-400">
            <p className="text-sm">Keine Checkliste vorhanden</p>
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            draggable={!readOnly}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item)}
            onDragEnd={handleDragEnd}
            className={`group flex items-center gap-3 p-3 bg-white border rounded-lg transition-all hover:shadow-sm ${
              item.completed
                ? 'border-green-200 bg-green-50/50'
                : 'border-slate-200 hover:border-slate-300'
            } ${draggedItem?.id === item.id ? 'opacity-50' : ''} ${
              readOnly ? '' : 'cursor-move'
            }`}
          >
            {/* Drag Handle */}
            {!readOnly && (
              <GripVertical className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition cursor-move flex-shrink-0" />
            )}

            {/* Checkbox */}
            <button
              onClick={() => handleToggle(item.id)}
              disabled={readOnly}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                item.completed
                  ? 'bg-green-500 border-green-500'
                  : 'border-slate-300 hover:border-blue-500'
              } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {item.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </button>

            {/* Item Text */}
            <span
              className={`flex-1 text-sm transition ${
                item.completed
                  ? 'text-slate-400 line-through'
                  : 'text-slate-700'
              }`}
            >
              {item.text}
            </span>

            {/* Delete Button */}
            {!readOnly && (
              <button
                onClick={() => handleDelete(item.id)}
                className="flex-shrink-0 p-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition"
                title="Löschen"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add New Item */}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Neuen Punkt hinzufügen..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newItemText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskChecklist;
