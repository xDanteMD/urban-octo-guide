import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import PassCard from './PassCard';
import ProgressBar from './ProgressBar';

export default function InferenceQueue({
  models,
  selectedModel,
  setSelectedModel,
  passes,
  setPasses,
  canRun,
  isRunning,
  onRun,
  onStop,
  progress,
  theme,
  cacheWarmDelay, setCacheWarmDelay,
  interPassDelay, setInterPassDelay,
  interFileDelay, setInterFileDelay,
  separateFiles, setSeparateFiles,
  collationFile, setCollationFile,
  streamingPreview, setStreamingPreview,
}) {
  const [presets, setPresets] = useState([]);
  const [timingOpen, setTimingOpen] = useState(false);
  const [outputOptsOpen, setOutputOptsOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    window.electronAPI.loadPresets().then(setPresets);
  }, []);

  const handlePassChange = useCallback((updatedPass) => {
    setPasses(prev => prev.map(p => p.id === updatedPass.id ? updatedPass : p));
  }, [setPasses]);

  const handleDeletePass = useCallback((id) => {
    setPasses(prev => prev.filter(p => p.id !== id));
  }, [setPasses]);

  const addPass = useCallback(() => {
    setPasses(prev => [...prev, { id: String(Date.now()), title: '', prompt: '' }]);
  }, [setPasses]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setPasses(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id);
        const newIndex = prev.findIndex(p => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, [setPasses]);

  const loadPreset = useCallback((preset) => {
    const newPasses = preset.passes.map((p, i) => ({
      id: String(Date.now() + i),
      title: p.title,
      prompt: p.prompt,
    }));
    setPasses(newPasses);
  }, [setPasses]);

  const savePreset = useCallback(async () => {
    const name = prompt('Preset name:');
    if (!name) return;
    const preset = {
      name,
      passes: passes.map(p => ({ title: p.title, prompt: p.prompt })),
    };
    await window.electronAPI.savePreset(preset);
    const updated = await window.electronAPI.loadPresets();
    setPresets(updated);
  }, [passes]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Model Selector */}
      <div className="p-3 border-b border-border-soft shrink-0">
        <label className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo block mb-1">Model</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-surface border border-border-soft rounded px-2 py-1.5 text-sm text-text-hi focus:border-accent focus:outline-none"
          disabled={isRunning}
        >
          {models.map(group => (
            <optgroup key={group.group} label={`── ${group.group} ──`}>
              {group.models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Preset Toolbar */}
      <div className="px-3 pt-3 pb-1 flex items-center gap-2 shrink-0 flex-wrap">
        <select
          className="bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
          defaultValue=""
          onChange={(e) => {
            const preset = presets.find(p => p.name === e.target.value);
            if (preset) loadPreset(preset);
            e.target.value = '';
          }}
          disabled={isRunning}
        >
          <option value="" disabled>Load Preset...</option>
          {presets.map((p, i) => (
            <option key={i} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button
          onClick={savePreset}
          disabled={isRunning}
          className="font-sans font-medium text-text-mid text-xs hover:text-accent disabled:opacity-50 transition-colors"
        >
          Save Preset
        </button>
        <button
          onClick={() => window.electronAPI.openPresetsFolder()}
          className="font-sans font-medium text-text-mid text-xs hover:text-text-hi transition-colors"
        >
          Open Folder
        </button>
      </div>

      {/* Pass Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={passes.map(p => p.id)} strategy={verticalListSortingStrategy}>
            {passes.map((pass, idx) => (
              <PassCard
                key={pass.id}
                pass={pass}
                index={idx}
                total={passes.length}
                onChange={handlePassChange}
                onDelete={handleDeletePass}
                isActive={isRunning && progress?.currentPassIndex === idx}
                isDone={isRunning && progress?.currentPassIndex != null && idx < progress.currentPassIndex}
                theme={theme}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={addPass}
          disabled={isRunning}
          className="w-full border-2 border-dashed border-border-soft rounded-lg py-2 font-sans font-medium text-text-mid text-xs hover:text-accent hover:border-accent/50 disabled:opacity-50 transition-colors"
        >
          + Add Pass
        </button>
      </div>

      {/* Timing Configuration */}
      <div className="border-t border-border-soft shrink-0">
        <button
          onClick={() => setTimingOpen(!timingOpen)}
          className="w-full px-3 py-2 font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo hover:text-text-mid flex items-center justify-between transition-colors"
        >
          <span>Timing Configuration</span>
          <span className="text-[10px]">{timingOpen ? '▲' : '▼'}</span>
        </button>
        {timingOpen && (
          <div className="px-3 pb-3 space-y-2">
            <div>
              <label className="text-[10px] text-text-lo block mb-0.5">First-pass delay per file (prompt cache warm-up)</label>
              <input
                type="number"
                value={cacheWarmDelay}
                onChange={(e) => setCacheWarmDelay(Number(e.target.value))}
                min={0}
                className="w-24 bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
              />
              <span className="text-[10px] text-text-lo ml-1">seconds</span>
            </div>
            <div>
              <label className="text-[10px] text-text-lo block mb-0.5">Delay between passes on same file</label>
              <input
                type="number"
                value={interPassDelay}
                onChange={(e) => setInterPassDelay(Number(e.target.value))}
                min={0}
                className="w-24 bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
              />
              <span className="text-[10px] text-text-lo ml-1">seconds</span>
            </div>
            <div>
              <label className="text-[10px] text-text-lo block mb-0.5">Delay between files</label>
              <input
                type="number"
                value={interFileDelay}
                onChange={(e) => setInterFileDelay(Number(e.target.value))}
                min={0}
                className="w-24 bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
              />
              <span className="text-[10px] text-text-lo ml-1">seconds</span>
            </div>
          </div>
        )}
      </div>

      {/* Output Options */}
      <div className="border-t border-border-soft shrink-0">
        <button
          onClick={() => setOutputOptsOpen(!outputOptsOpen)}
          className="w-full px-3 py-2 font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo hover:text-text-mid flex items-center justify-between transition-colors"
        >
          <span>Output Options</span>
          <span className="text-[10px]">{outputOptsOpen ? '▲' : '▼'}</span>
        </button>
        {outputOptsOpen && (
          <div className="px-3 pb-3 space-y-2">
            <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
              <input
                type="checkbox"
                checked={separateFiles}
                onChange={(e) => setSeparateFiles(e.target.checked)}
                className="rounded accent-accent"
              />
              Separate files
            </label>
            <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
              <input
                type="checkbox"
                checked={collationFile}
                onChange={(e) => setCollationFile(e.target.checked)}
                className="rounded accent-accent"
              />
              Collation file
            </label>
            <label className="flex items-center gap-2 text-xs text-text-mid cursor-pointer">
              <input
                type="checkbox"
                checked={streamingPreview}
                onChange={(e) => setStreamingPreview(e.target.checked)}
                className="rounded accent-accent"
              />
              Streaming preview
            </label>
          </div>
        )}
      </div>

      {/* Run Controls */}
      <div className="p-3 border-t border-border-soft shrink-0 space-y-2">
        {isRunning && progress && (
          <>
            <ProgressBar
              progress={progress.overallPercent || 0}
              theme={theme}
              animate={true}
            />
            <p className="text-xs text-text-lo text-center">
              Processing file {progress.currentFileIndex + 1} of {progress.totalFiles} — Pass {progress.currentPassIndex + 1} of {progress.totalPasses}
              {progress.currentPassTitle ? ` (${progress.currentPassTitle})` : ''}
            </p>
          </>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={onRun}
              disabled={!canRun}
              className="flex-1 bg-accent hover:bg-accent/80 disabled:bg-accent/30 disabled:cursor-not-allowed text-white font-display font-bold uppercase tracking-widest py-2 px-4 rounded-lg text-sm transition-colors"
            >
              &#9654; Run Analysis
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex-1 bg-coral hover:bg-coral/80 text-white font-display font-bold uppercase tracking-widest py-2 px-4 rounded-lg text-sm transition-colors"
            >
              &#9209; Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
