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
          className="w-full bg-surface border border-border rounded px-2 py-1 text-xs text-text-body placeholder-text-body/30 focus:border-accent focus:outline-none pr-7"
        />
        <button
          onClick={() => setShow(!show)}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-body/40 hover:text-text-body text-[10px]"
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#c8c8d4">
    <path d="M13.827 3.52h3.603L24 20.48h-3.603L13.827 3.52zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H.001L6.569 3.522zm2.327 10.116L7.22 9.098l-1.885 4.538h3.56z"/>
  </svg>
);

const GeminiIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#c8c8d4">
    <path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12"/>
  </svg>
);

const DeepSeekIcon = (
  <span className="text-[10px] font-bold text-text-body/70">DS</span>
);

export default function ApiKeysPanel({ apiKeys }) {
  return (
    <div className="p-3 border-t border-border shrink-0">
      <h3 className="text-xs font-semibold text-text-heading uppercase tracking-wider mb-2">
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
