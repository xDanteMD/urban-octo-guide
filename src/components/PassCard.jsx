import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function PassCard({ pass, index, total, onChange, onDelete, isActive, theme }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: pass.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const activeClass = isActive
    ? theme === 'neon'
      ? 'neon-border border-cyan-400'
      : 'border-accent shadow-lg shadow-accent/20'
    : 'border-border';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-surface rounded-lg border ${activeClass} p-3 mb-2 transition-all`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-text-body/30 hover:text-text-body cursor-grab active:cursor-grabbing shrink-0 text-sm"
          title="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-text-body/40 font-mono shrink-0">
              #{index + 1}
            </span>
            <input
              type="text"
              value={pass.title}
              onChange={(e) => onChange({ ...pass, title: e.target.value })}
              placeholder="e.g. EmoBeats"
              className="flex-1 bg-base border border-border rounded px-2 py-1 text-sm text-text-heading placeholder-text-body/30 focus:border-accent focus:outline-none"
            />
            {total > 1 && (
              <button
                onClick={() => onDelete(pass.id)}
                className="text-text-body/30 hover:text-coral transition-colors shrink-0"
                title="Delete pass"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            )}
          </div>
          <textarea
            value={pass.prompt}
            onChange={(e) => onChange({ ...pass, prompt: e.target.value })}
            placeholder="Enter system prompt for this pass..."
            rows={4}
            className="w-full bg-base border border-border rounded px-2 py-1.5 text-xs text-text-body placeholder-text-body/30 focus:border-accent focus:outline-none resize-y min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
}
