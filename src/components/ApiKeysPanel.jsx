import React, { useState } from 'react';

function KeyRow({ label, icon, value, onChange }) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 flex items-center justify-center shrink-0" title={label}>
        {icon}
      </div>
      <div className="flex-1 relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${label} API Key`}
          className="w-full bg-surface border border-border-soft rounded px-2 py-1 font-mono text-[10px] text-text-mid placeholder-text-lo focus:border-accent focus:outline-none pr-7"
        />
        <button
          onClick={() => setShow(!show)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-lo hover:text-text-mid text-[10px]"
          title={show ? 'Hide' : 'Show'}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c6af7" strokeWidth="2" className="shrink-0 opacity-40" title="Stored locally on your machine only.">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>
  );
}

// Simple SVG icons for providers
const AnthropicIcon = (
  <span className="font-display font-bold text-[10px] bg-accent/15 text-accent w-5 h-5 flex items-center justify-center rounded">A</span>
);

const GeminiIcon = (
  <span className="font-display font-bold text-[10px] bg-emerald/15 text-emerald w-5 h-5 flex items-center justify-center rounded">G</span>
);

const DeepSeekIcon = (
  <span className="font-display font-bold text-[10px] bg-coral/15 text-coral w-5 h-5 flex items-center justify-center rounded">DS</span>
);

export default function ApiKeysPanel({ apiKeys }) {
  return (
    <div className="p-3 border-t border-border-soft shrink-0">
      <h3 className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo mb-2">
        API Keys
      </h3>
      <div className="space-y-2">
        <KeyRow
          label="Anthropic"
          icon={AnthropicIcon}
          value={apiKeys.anthropicKey}
          onChange={apiKeys.setAnthropicKey}
        />
        <KeyRow
          label="Gemini"
          icon={GeminiIcon}
          value={apiKeys.geminiKey}
          onChange={apiKeys.setGeminiKey}
        />
        <KeyRow
          label="DeepSeek"
          icon={DeepSeekIcon}
          value={apiKeys.deepseekKey}
          onChange={apiKeys.setDeepseekKey}
        />
      </div>
    </div>
  );
}
