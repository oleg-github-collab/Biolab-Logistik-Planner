import React, { useState, useEffect } from 'react';
import MobileQuickActions from './MobileQuickActions';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Quick actions for desktop
  const QUICK_ACTIONS = [
    {
      id: 'time',
      label: 'Zeit erfassen',
      icon: '⏱️',
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => {
        setShowQuickActions(true);
        setIsOpen(false);
      }
    },
    {
      id: 'task',
      label: 'Aufgabe',
      icon: '✓',
      color: 'bg-green-500 hover:bg-green-600',
      action: () => {
        setShowQuickActions(true);
        setIsOpen(false);
      }
    },
    {
      id: 'waste',
      label: 'Abfall',
      icon: '♻️',
      color: 'bg-orange-500 hover:bg-orange-600',
      action: () => {
        setShowQuickActions(true);
        setIsOpen(false);
      }
    }
  ];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowQuickActions(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Quick Action Menu */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 space-y-2 mb-2 animate-fadeIn">
            {QUICK_ACTIONS.map((action, index) => (
              <div
                key={action.id}
                className="flex items-center gap-3 animate-slideInRight"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <span className="bg-white text-gray-900 px-3 py-1.5 rounded-lg shadow-lg text-sm font-medium whitespace-nowrap">
                  {action.label}
                </span>
                <button
                  onClick={action.action}
                  className={`${action.color} text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transform transition-all hover:scale-110 active:scale-95`}
                  title={action.label}
                >
                  {action.icon}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main FAB */}
        <button
          onClick={() => {
            if (isMobile) {
              setShowQuickActions(true);
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transform transition-all hover:scale-110 active:scale-95 ${
            isOpen
              ? 'bg-red-500 hover:bg-red-600 rotate-45'
              : 'bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
          }`}
          aria-label="Quick Actions"
        >
          <span className="text-white">
            {isOpen ? '×' : '+'}
          </span>
        </button>

        {/* Pulse animation on first load */}
        <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping pointer-events-none" />
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Quick Actions Modal */}
      {showQuickActions && (
        <MobileQuickActions
          onClose={() => setShowQuickActions(false)}
        />
      )}
    </>
  );
};

// Add custom animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-slideInRight {
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  .animate-ping {
    animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
`;

if (!document.querySelector('style[data-fab-animations]')) {
  style.setAttribute('data-fab-animations', 'true');
  document.head.appendChild(style);
}

export default FloatingActionButton;
