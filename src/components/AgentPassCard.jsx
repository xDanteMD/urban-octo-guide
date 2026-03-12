import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ROLES = ['Analytical', 'Emotional', 'Inconsistency', 'Synthesis', 'Custom'];

const ROLE_COLORS = {
  Analytical: 'border-accent text-accent bg-accent/10',
  Emotional: 'border-coral text-coral bg-coral/10',
  Inconsistency: 'border-amber-500 text-amber-500 bg-amber-500/10',
  Synthesis: 'border-teal-400 text-teal-400 bg-teal-400/10',
  Custom: 'border-border-mid text-text-lo bg-border-faint',
};

const ROLE_BORDER_COLORS = {
  Analytical: 'border-accent/40',
  Emotional: 'border-coral/40',
  Inconsistency: 'border-amber-500/40',
  Synthesis: 'border-teal-400/40',
  Custom: 'border-border-soft',
};

const INJECTED_CHUNK_PREVIEW = `---
You are building a rolling set of notes.
Current scratchpad so far: {SCRATCHPAD_SO_FAR}

Next section of source material: {CHUNK_TEXT}

Continue your notes. Do not repeat what is already in the scratchpad.
Append only new observations. If you find something that contradicts
an earlier note, prefix it with [INCONSISTENCY].`;

export default function AgentPassCard({ pass, index, total, onChange, onDelete, isActive, isDone }) {
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

  const roleBorder = ROLE_BORDER_COLORS[pass.role] || ROLE_BORDER_COLORS.Custom;
  const activeClass = isActive
    ? `card-active ${roleBorder}`
    : `border-border-soft hover:border-border-mid`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-surface rounded-lg border ${activeClass} p-3 mb-2 transition-all`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg transition-colors duration-300 ${
        isActive ? 'bg-accent' : isDone ? 'bg-emerald opacity-40' : 'bg-transparent'
      }`} />

      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-text-lo hover:text-text-mid cursor-grab active:cursor-grabbing shrink-0 text-sm"
          title="Drag to reorder"
        >
          ⠿
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-text-lo text-[10px] shrink-0">#{index + 1}</span>
            <input
              type="text"
              value={pass.title}
              onChange={(e) => onChange({ ...pass, title: e.target.value })}
              placeholder="Pass title"
              className="flex-1 bg-elevated border border-border-faint font-display font-semibold text-text-hi rounded px-2 py-1 text-sm placeholder-text-lo focus:border-accent focus:outline-none"
            />
            <select
              value={pass.role}
              onChange={(e) => onChange({ ...pass, role: e.target.value })}
              className={`text-[10px] font-display font-bold rounded px-1.5 py-0.5 border cursor-pointer focus:outline-none ${ROLE_COLORS[pass.role] || ROLE_COLORS.Custom}`}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {total > 1 && (
              <button
                onClick={() => onDelete(pass.id)}
                className="text-text-lo hover:text-coral transition-colors shrink-0"
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
            rows={3}
            className="w-full bg-elevated border border-border-faint rounded px-2 py-1.5 text-[11.5px] text-text-mid leading-relaxed placeholder-text-lo focus:border-accent focus:outline-none resize-y min-h-[60px]"
          />

          {/* Injected template preview */}
          <details className="mt-1.5">
            <summary className="text-[9px] text-text-lo cursor-pointer hover:text-text-mid select-none">
              Auto-injected prompt suffix
            </summary>
            <pre className="mt-1 text-[9px] text-text-lo/60 bg-base rounded p-2 leading-relaxed whitespace-pre-wrap font-mono border border-border-faint">
              {INJECTED_CHUNK_PREVIEW}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
