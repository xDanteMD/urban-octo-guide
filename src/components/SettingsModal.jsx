import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const THEMES = [
  { id: 'chrome', label: 'Chrome', desc: 'Animated silver/grey shimmer' },
  { id: 'rainbow', label: 'Rainbow', desc: 'Slow hue-rotate gradient' },
  { id: 'pink', label: 'Pink', desc: 'Soft pink-to-violet pulse' },
  { id: 'neon', label: 'Neon', desc: 'Cyan + violet glow bloom' },
  { id: 'minimal', label: 'Minimal', desc: 'Static violet accent (default)' },
];

export default function SettingsModal({ theme, setTheme, apiKeys, onClose }) {
  const [scale, setScale] = useState(100);
  const [outputFolder, setOutputFolder] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.electronAPI.storeGet('uiScale', 100).then(setScale);
    window.electronAPI.getOutputFolder().then(setOutputFolder);
    window.electronAPI.getAppVersion().then(setVersion);
  }, []);

  const handleScaleChange = useCallback((val) => {
    const num = Number(val);
    setScale(num);
    window.electronAPI.setZoom(num / 100);
  }, []);

  const handleChangeFolder = useCallback(async () => {
    const newFolder = await window.electronAPI.changeOutputFolder();
    if (newFolder) setOutputFolder(newFolder);
  }, []);

  const handleClearKeys = useCallback(() => {
    if (confirm('Are you sure you want to clear all API keys?')) {
      apiKeys.clearAll();
    }
  }, [apiKeys]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface border border-border-soft rounded-xl w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border-soft">
          <h2 className="text-text-hi font-display font-bold text-base">Settings</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-hover text-text-lo hover:text-text-mid transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* UI Scale */}
          <div>
            <label className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo block mb-2">UI Scale: {scale}%</label>
            <input
              type="range"
              min={75}
              max={150}
              value={scale}
              onChange={(e) => handleScaleChange(e.target.value)}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-text-lo mt-1">
              <span>75%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>

          {/* Theme Picker */}
          <div>
            <label className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo block mb-2">Theme</label>
            <div className="grid grid-cols-1 gap-1.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    theme === t.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border-soft hover:border-accent/30'
                  }`}
                >
                  <div className={`w-8 h-2 rounded-full theme-${t.id}`} />
                  <div>
                    <p className="text-xs text-text-hi font-medium">{t.label}</p>
                    <p className="text-[10px] text-text-lo">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Output Folder */}
          <div>
            <label className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo block mb-2">Output Folder</label>
            <div className="flex items-center gap-2">
              <p className="flex-1 text-xs text-text-mid truncate bg-base rounded px-2 py-1.5 border border-border-soft">
                {outputFolder}
              </p>
              <button
                onClick={handleChangeFolder}
                className="text-xs text-accent hover:text-accent/80 transition-colors whitespace-nowrap"
              >
                Change Folder
              </button>
            </div>
          </div>

          {/* Clear API Keys */}
          <div>
            <button
              onClick={handleClearKeys}
              className="text-xs text-coral hover:text-coral/80 transition-colors"
            >
              Clear All API Keys
            </button>
          </div>

          {/* Version */}
          <div className="pt-2 border-t border-border-soft">
            <p className="text-[10px] text-text-lo">xDMD-PPLX-Analyzer v{version}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
