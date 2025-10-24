import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { WASTE_CATEGORIES, getMostCommonWaste } from '../data/wasteClassification';
import SmartTimeEntry from './SmartTimeEntry';
import QuickTaskEntry from './QuickTaskEntry';
import QuickWasteEntry from './QuickWasteEntry';
import { showSuccess } from '../utils/toast';

const MobileQuickActions = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('time');
  const [swipeStart, setSwipeStart] = useState(null);
  const containerRef = useRef(null);

  // Swipe handling
  const handleTouchStart = (e) => {
    setSwipeStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    });
  };

  const handleTouchEnd = (e) => {
    if (!swipeStart) return;

    const swipeEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = swipeEnd.x - swipeStart.x;
    const deltaY = Math.abs(swipeEnd.y - swipeStart.y);
    const deltaTime = swipeEnd.time - swipeStart.time;

    // Horizontal swipe detection
    if (Math.abs(deltaX) > 50 && deltaY < 50 && deltaTime < 300) {
      const tabs = ['time', 'task', 'waste'];
      const currentIndex = tabs.indexOf(activeTab);

      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - previous tab
        setActiveTab(tabs[currentIndex - 1]);
      } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left - next tab
        setActiveTab(tabs[currentIndex + 1]);
      }
    }

    setSwipeStart(null);
  };

  // Quick action shortcuts
  const QUICK_ACTIONS = {
    time: [
      {
        id: 'start-shift',
        label: 'Schicht starten',
        icon: '▶️',
        color: 'bg-green-500',
        action: (data) => console.log('Start shift', data)
      },
      {
        id: 'end-shift',
        label: 'Schicht beenden',
        icon: '⏹️',
        color: 'bg-red-500',
        action: (data) => console.log('End shift', data)
      },
      {
        id: 'break',
        label: 'Pause',
        icon: '☕',
        color: 'bg-yellow-500',
        action: (data) => console.log('Break', data)
      }
    ],
    task: [
      {
        id: 'quick-task',
        label: 'Schnellaufgabe',
        icon: '✓',
        color: 'bg-blue-500',
        priority: 'medium'
      },
      {
        id: 'urgent-task',
        label: 'Dringend',
        icon: '⚡',
        color: 'bg-red-500',
        priority: 'high'
      },
      {
        id: 'note',
        label: 'Notiz',
        icon: '📝',
        color: 'bg-purple-500',
        priority: 'low'
      }
    ],
    waste: getMostCommonWaste().slice(0, 3).map(waste => ({
      id: waste.code,
      label: waste.name,
      icon: WASTE_CATEGORIES[waste.category.toUpperCase()].icon,
      color: `bg-[${waste.color}]`,
      wasteData: waste
    }))
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl animate-slideUp max-h-[85vh] flex flex-col">
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Quick Actions</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('time')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'time'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">⏱️</span>
              <span>Zeiten</span>
            </div>
            {activeTab === 'time' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('task')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'task'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">✓</span>
              <span>Aufgaben</span>
            </div>
            {activeTab === 'task' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('waste')}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'waste'
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">♻️</span>
              <span>Abfall</span>
            </div>
            {activeTab === 'waste' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
            )}
          </button>
        </div>

        {/* Swipe indicator */}
        <div className="px-4 py-2 text-center text-xs text-gray-500">
          ← Wischen zum Wechseln →
        </div>

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Quick Action Buttons */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-2 mb-4">
              {QUICK_ACTIONS[activeTab]?.map((action) => (
                <button
                  key={action.id}
                  onClick={() => action.action && action.action()}
                  className={`${action.color} text-white rounded-xl p-3 flex flex-col items-center gap-1 shadow-lg active:scale-95 transition-transform`}
                >
                  <span className="text-2xl">{action.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-4 pb-6">
            {activeTab === 'time' && (
              <SmartTimeEntry onSave={(data) => {
                showSuccess('Zeit erfasst!');
                onClose();
              }} />
            )}

            {activeTab === 'task' && (
              <QuickTaskEntry onSave={(data) => {
                showSuccess('Aufgabe erstellt!');
                onClose();
              }} />
            )}

            {activeTab === 'waste' && (
              <QuickWasteEntry onSave={(data) => {
                showSuccess('Abfall erfasst!');
                onClose();
              }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add slideUp animation to CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .animate-slideUp {
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;
document.head.appendChild(style);

export default MobileQuickActions;
