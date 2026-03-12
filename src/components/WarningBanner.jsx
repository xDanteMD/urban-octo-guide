import React from 'react';

export default function WarningBanner({ warnings, onDismiss }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="bg-yellow-900/30 border-b border-yellow-600/30 px-4 py-2 shrink-0">
      <div className="flex items-start gap-2">
        <span className="text-yellow-400 text-sm mt-0.5">&#9888;</span>
        <div className="flex-1">
          {warnings.map((w, i) => (
            <p key={i} className="text-yellow-200 text-xs leading-relaxed">{w}</p>
          ))}
        </div>
        <button
          onClick={onDismiss}
          className="text-yellow-400 hover:text-yellow-200 transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
