import React from 'react';

const TypingIndicator = ({ userName }) => {
  if (!userName) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 w-fit">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
        {userName[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">{userName} schreibt</span>
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
