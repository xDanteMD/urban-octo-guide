import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import AgentPassCard from './AgentPassCard';
import ProgressBar from './ProgressBar';

function makePass(title = '', role = 'Custom', prompt = '') {
  return { id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title, role, prompt };
}

export default function AgentPassQueue({
  models,
  selectedModel,
  setSelectedModel,
  agentPasses,
  setAgentPasses,
  chunkConfig,
  setChunkConfig,
  synthesisConfig,
  setSynthesisConfig,
  canRun,
  isRunning,
  blockedByOtherTab,
  onRun,
  onStop,
  progress,
  theme,
}) {
  const [showChunkConfig, setShowChunkConfig] = useState(false);
  const [showSynthesisConfig, setShowSynthesisConfig] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setAgentPasses((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id);
        const newIndex = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, [setAgentPasses]);

  const updatePass = useCallback((updated) => {
    setAgentPasses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, [setAgentPasses]);

  const deletePass = useCallback((id) => {
    setAgentPasses((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }, [setAgentPasses]);

  const addPass = useCallback(() => {
    setAgentPasses((prev) => [...prev, makePass()]);
  }, [setAgentPasses]);

  const loadAgentPreset = useCallback(async () => {
    try {
      const presets = await window.electronAPI.loadPresets();
      const agentPreset = presets.find((p) => p.passes?.[0]?.role);
      if (agentPreset) {
        setAgentPasses(agentPreset.passes.map((p) => makePass(p.title, p.role || 'Custom', p.prompt)));
      }
    } catch (err) {
      console.error('Failed to load agent presets:', err);
    }
  }, [setAgentPasses]);

  const saveAgentPreset = useCallback(async () => {
    const name = prompt('Preset name:');
    if (!name) return;
    try {
      await window.electronAPI.savePreset({
        name,
        passes: agentPasses.map((p) => ({ title: p.title, role: p.role, prompt: p.prompt })),
      });
    } catch (err) {
      console.error('Failed to save agent preset:', err);
    }
  }, [agentPasses]);

  const currentRunningPassIndex = progress?.currentPassIndex ?? -1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Model selector */}
      <div className="p-3 border-b border-border-soft shrink-0">
        <label className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo block mb-1.5">
          Model
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-surface border border-border-soft rounded px-2 py-1.5 text-sm text-text-hi focus:border-accent focus:outline-none"
        >
          {models.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Agent pass cards */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo">
            Agent Passes
          </span>
          <div className="flex gap-1">
            <button
              onClick={loadAgentPreset}
              className="text-[10px] font-sans font-medium text-text-mid hover:text-accent transition-colors"
            >
              Load Preset
            </button>
            <span className="text-text-lo text-[10px]">·</span>
            <button
              onClick={saveAgentPreset}
              className="text-[10px] font-sans font-medium text-text-mid hover:text-accent transition-colors"
            >
              Save Preset
            </button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={agentPasses.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {agentPasses.map((pass, i) => (
              <AgentPassCard
                key={pass.id}
                pass={pass}
                index={i}
                total={agentPasses.length}
                onChange={updatePass}
                onDelete={deletePass}
                isActive={isRunning && i === currentRunningPassIndex}
                isDone={isRunning && i < currentRunningPassIndex}
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

      {/* Chunk configuration (collapsible) */}
      <div className="border-t border-border-soft shrink-0">
        <button
          onClick={() => setShowChunkConfig(!showChunkConfig)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo">
            Chunk Configuration
          </span>
          <span className="text-text-lo text-xs">{showChunkConfig ? '▲' : '▼'}</span>
        </button>
        {showChunkConfig && (
          <div className="px-3 pb-3 space-y-2.5">
            <div>
              <label className="text-[10px] text-text-lo block mb-0.5">
                Max characters per chunk (~30-32k tokens safety margin)
              </label>
              <input
                type="number"
                value={chunkConfig.maxChars}
                onChange={(e) => setChunkConfig({ ...chunkConfig, maxChars: parseInt(e.target.value) || 30000 })}
                className="w-24 bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={chunkConfig.respectTurns}
                onChange={(e) => setChunkConfig({ ...chunkConfig, respectTurns: e.target.checked })}
                className="accent-accent"
              />
              <label className="text-[10px] text-text-mid">
                Respect turn boundaries
              </label>
              <span className="text-[9px] text-text-lo italic">
                Never split mid-conversation-turn
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-text-lo block mb-0.5">Inter-chunk delay (s)</label>
                <input
                  type="number"
                  value={chunkConfig.interChunkDelay}
                  onChange={(e) => setChunkConfig({ ...chunkConfig, interChunkDelay: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-lo block mb-0.5">Inter-pass delay (s)</label>
                <input
                  type="number"
                  value={chunkConfig.interPassDelay}
                  onChange={(e) => setChunkConfig({ ...chunkConfig, interPassDelay: parseFloat(e.target.value) || 1 })}
                  className="w-full bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-lo block mb-0.5">Cache warm delay (s)</label>
                <input
                  type="number"
                  value={chunkConfig.cacheWarmDelay}
                  onChange={(e) => setChunkConfig({ ...chunkConfig, cacheWarmDelay: parseFloat(e.target.value) || 15 })}
                  className="w-full bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-text-lo block mb-0.5">Max revisit rounds (0-3)</label>
                <input
                  type="number"
                  min="0"
                  max="3"
                  value={chunkConfig.maxRevisitRounds}
                  onChange={(e) => setChunkConfig({ ...chunkConfig, maxRevisitRounds: Math.min(3, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className="w-full bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Synthesis configuration (collapsible) */}
      <div className="border-t border-border-soft shrink-0">
        <button
          onClick={() => setShowSynthesisConfig(!showSynthesisConfig)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <span className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo">
            Synthesis Passes
          </span>
          <span className="text-text-lo text-xs">{showSynthesisConfig ? '▲' : '▼'}</span>
        </button>
        {showSynthesisConfig && (
          <div className="px-3 pb-3 space-y-3">
            {/* Per-file synthesis */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="checkbox"
                  checked={synthesisConfig.perFileEnabled}
                  onChange={(e) => setSynthesisConfig({ ...synthesisConfig, perFileEnabled: e.target.checked })}
                  className="accent-accent"
                />
                <label className="text-[10px] text-text-mid font-medium">Per-file synthesis</label>
              </div>
              {synthesisConfig.perFileEnabled && (
                <textarea
                  value={synthesisConfig.perFilePrompt}
                  onChange={(e) => setSynthesisConfig({ ...synthesisConfig, perFilePrompt: e.target.value })}
                  rows={3}
                  className="w-full bg-elevated border border-border-faint rounded px-2 py-1.5 text-[11px] text-text-mid leading-relaxed placeholder-text-lo focus:border-accent focus:outline-none resize-y"
                  placeholder="Per-file synthesis system prompt..."
                />
              )}
            </div>
            {/* Global synthesis */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <input
                  type="checkbox"
                  checked={synthesisConfig.globalEnabled}
                  onChange={(e) => setSynthesisConfig({ ...synthesisConfig, globalEnabled: e.target.checked })}
                  className="accent-accent"
                />
                <label className="text-[10px] text-text-mid font-medium">Global synthesis</label>
              </div>
              {synthesisConfig.globalEnabled && (
                <textarea
                  value={synthesisConfig.globalPrompt}
                  onChange={(e) => setSynthesisConfig({ ...synthesisConfig, globalPrompt: e.target.value })}
                  rows={3}
                  className="w-full bg-elevated border border-border-faint rounded px-2 py-1.5 text-[11px] text-text-mid leading-relaxed placeholder-text-lo focus:border-accent focus:outline-none resize-y"
                  placeholder="Global synthesis system prompt..."
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Run controls */}
      <div className="p-3 border-t border-border-soft shrink-0 space-y-2">
        {isRunning && progress && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-text-mid font-mono leading-relaxed">
              <div>
                File {(progress.currentFileIndex || 0) + 1} of {progress.totalFiles || '?'}
                {progress.currentFileName && <span className="text-text-lo"> — {progress.currentFileName}</span>}
              </div>
              <div>
                Pass: {progress.currentPassTitle || '...'}
                {progress.totalChunks > 1 && (
                  <span> — Chunk {(progress.currentChunkIndex || 0) + 1} of {progress.totalChunks}</span>
                )}
              </div>
              {progress.revisitRound > 0 && (
                <div>Revisit round: {progress.revisitRound} of {chunkConfig.maxRevisitRounds}</div>
              )}
            </div>
            <ProgressBar progress={progress.overallPercent ?? -1} theme={theme} animate={true} />
          </div>
        )}

        {isRunning ? (
          <button
            onClick={onStop}
            className="w-full bg-coral/20 hover:bg-coral/30 text-coral rounded-lg py-2 font-display font-bold uppercase tracking-widest text-xs transition-colors"
          >
            ⏹ Stop
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={!canRun}
            title={blockedByOtherTab ? 'Stop current run before switching modes.' : undefined}
            className="w-full bg-accent hover:bg-accent/90 text-white rounded-lg py-2 font-display font-bold uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ▶ Run Agent
          </button>
        )}
      </div>
    </div>
  );
}
