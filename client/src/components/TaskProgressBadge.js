import React from 'react';
import { CheckCircle2 } from 'lucide-react';

/**
 * TaskProgressBadge Component
 * Displays compact progress indicator for task cards
 * @param {Array} checklist - Array of checklist items
 * @param {String} size - 'sm' or 'md'
 */
const TaskProgressBadge = ({ checklist = [], size = 'sm' }) => {
  if (!checklist || checklist.length === 0) return null;

  const completedCount = checklist.filter(item => item.completed).length;
  const totalCount = checklist.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  const isSmall = size === 'sm';

  return (
    <div className={`flex items-center gap-2 ${isSmall ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-center gap-1">
        <CheckCircle2 className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} ${
          percentage === 100 ? 'text-green-600' : 'text-slate-400'
        }`} />
        <span className={`font-medium ${
          percentage === 100 ? 'text-green-700' : 'text-slate-600'
        }`}>
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Mini Progress Bar */}
      <div className={`flex-1 ${isSmall ? 'h-1.5 max-w-[60px]' : 'h-2 max-w-[80px]'} bg-slate-200 rounded-full overflow-hidden`}>
        <div
          className={`h-full transition-all duration-300 ${
            percentage === 100
              ? 'bg-green-500'
              : percentage >= 50
              ? 'bg-blue-500'
              : 'bg-orange-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {percentage === 100 && (
        <span className="text-green-600 font-semibold">✓</span>
      )}
    </div>
  );
};

export default TaskProgressBadge;
