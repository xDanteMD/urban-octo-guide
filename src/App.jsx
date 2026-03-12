import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import TitleBar from './components/TitleBar';
import FilePanel from './components/FilePanel';
import ApiKeysPanel from './components/ApiKeysPanel';
import InferenceQueue from './components/InferenceQueue';
import OutputViewer from './components/OutputViewer';
import AgentPassQueue from './components/AgentPassQueue';
import ScratchpadViewer from './components/ScratchpadViewer';
import SettingsModal from './components/SettingsModal';
import WarningBanner from './components/WarningBanner';
import { useApiKeys, useStoreValue } from './hooks/useStore';
import { useRunQueue } from './hooks/useRunQueue';
import { useAgentQueue } from './hooks/useAgentQueue';

const MODELS = [
  {
    group: 'Anthropic', provider: 'anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
  },
  {
    group: 'Gemini', provider: 'gemini',
    models: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']
  },
  {
    group: 'DeepSeek', provider: 'deepseek',
    models: ['deepseek-reasoner', 'deepseek-chat']
  },
];

function getProviderForModel(modelId) {
  for (const group of MODELS) {
    if (group.models.includes(modelId)) return group.provider;
  }
  return null;
}

const TABS = [
  { id: 'analysis', label: 'Analysis Mode' },
  { id: 'agent', label: 'Agent Mode' },
];

const DEFAULT_SYNTHESIS_PROMPT = `You have finished reading {CONTEXT}.
Your complete notes so far:
{SCRATCHPAD_SO_FAR}

Now synthesize. Do not summarize flatly — reason about patterns,
contradictions, evolution over time, and what this reveals about the subject.
If any section warrants re-examination given what you now know in full,
output a revisit marker in this exact format on its own line:
[REVISIT: <filename_or_"global">, <one sentence reason>]`;

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useStoreValue('activeTab', 'analysis');
  const [theme, setTheme] = useStoreValue('theme', 'minimal');
  const [selectedModel, setSelectedModel] = useStoreValue('selectedModel', 'claude-sonnet-4-6');
  const [streamingSpeed, setStreamingSpeed] = useStoreValue('streamingSpeed', 4);
  const [files, setFiles] = useState([]);
  const [passes, setPasses] = useState([
    { id: '1', title: '', prompt: '' },
  ]);
  const [warnings, setWarnings] = useState([]);

  // Timing config (shared)
  const [cacheWarmDelay, setCacheWarmDelay] = useStoreValue('cacheWarmDelay', 15);
  const [interPassDelay, setInterPassDelay] = useStoreValue('interPassDelay', 1);
  const [interFileDelay, setInterFileDelay] = useStoreValue('interFileDelay', 2);

  // Output options (analysis mode)
  const [separateFiles, setSeparateFiles] = useStoreValue('separateFiles', true);
  const [collationFile, setCollationFile] = useStoreValue('collationFile', false);
  const [streamingPreview, setStreamingPreview] = useStoreValue('streamingPreview', true);

  // Agent mode state
  const [agentPasses, setAgentPasses] = useState([
    { id: 'ap-1', title: 'Analytical', role: 'Analytical', prompt: 'Extract factual patterns: preferences, recurring decisions, technical choices, stated rules, workflow habits. Be precise and list-oriented. Cite brief direct quotes to anchor each observation.' },
    { id: 'ap-2', title: 'EmotionalSignal', role: 'Emotional', prompt: 'Extract emotionally salient moments: milestones, frustrations, breakthroughs, expressions of identity or values. Reproduce the most resonant quotes verbatim. Note the emotional texture, not just the content.' },
    { id: 'ap-3', title: 'Inconsistencies', role: 'Inconsistency', prompt: 'Flag contradictions, changed opinions, evolving stances, or moments where stated preferences conflict with observed behavior. Be specific — cite both instances.' },
  ]);

  const [chunkConfig, setChunkConfig] = useStoreValue('agentChunkConfig', {
    maxChars: 30000,
    respectTurns: true,
    interChunkDelay: 1,
    interPassDelay: 1,
    cacheWarmDelay: 15,
    maxRevisitRounds: 2,
  });

  const [synthesisConfig, setSynthesisConfig] = useStoreValue('agentSynthesisConfig', {
    perFileEnabled: true,
    perFilePrompt: DEFAULT_SYNTHESIS_PROMPT,
    globalEnabled: true,
    globalPrompt: DEFAULT_SYNTHESIS_PROMPT,
  });

  const [agentScratchpadFile, setAgentScratchpadFile] = useState(null);

  const apiKeys = useApiKeys();
  const provider = getProviderForModel(selectedModel);

  // Analysis mode run queue
  const runQueue = useRunQueue({
    files,
    passes,
    selectedModel,
    provider,
    apiKeys,
    cacheWarmDelay,
    interPassDelay,
    interFileDelay,
    separateFiles,
    collationFile,
    streamingPreview,
  });

  // Agent mode run queue
  const agentQueue = useAgentQueue({
    apiKeys,
    selectedModel,
    models: MODELS,
  });

  // Check for short file warnings when using Anthropic
  useEffect(() => {
    if (provider === 'anthropic' && files.length > 0) {
      const shortFiles = files.filter(f => f.text && f.text.length < 3000);
      setWarnings(shortFiles.map(f =>
        `${f.name} may be too short to benefit from Anthropic prompt caching (minimum ~1024 tokens). The 15s warm-up delay will still apply but caching may not activate.`
      ));
    } else {
      setWarnings([]);
    }
  }, [files, provider]);

  // Cross-tab run guard: only one mode can run at a time
  const hasApiKey = apiKeys.getKeyForProvider(provider);
  const hasFiles = files.length > 0;
  const isEitherRunning = runQueue.isRunning || agentQueue.isRunning;

  // Analysis mode canRun
  const hasValidPasses = passes.every(p => p.title.trim() && p.prompt.trim());
  const canRunAnalysis = hasApiKey && hasFiles && hasValidPasses && !isEitherRunning;
  const analysisBlockedByAgent = agentQueue.isRunning && !runQueue.isRunning;

  // Agent mode canRun
  const hasValidAgentPasses = agentPasses.every(p => p.title.trim() && p.prompt.trim());
  const canRunAgent = hasApiKey && hasFiles && hasValidAgentPasses && !isEitherRunning;
  const agentBlockedByAnalysis = runQueue.isRunning && !agentQueue.isRunning;

  const handleAgentRun = useCallback(() => {
    agentQueue.startRun(files, agentPasses, chunkConfig, synthesisConfig);
  }, [agentQueue, files, agentPasses, chunkConfig, synthesisConfig]);

  return (
    <div className="h-full w-full flex flex-col bg-base text-text-mid font-sans">
      <TitleBar
        onSettingsClick={() => setSettingsOpen(true)}
        isRunning={isEitherRunning}
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-border-soft shrink-0 bg-surface px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-2 text-xs font-display font-bold uppercase tracking-[0.1em] transition-colors ${
              activeTab === tab.id ? 'text-text-hi' : 'text-text-lo hover:text-text-mid'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      {warnings.length > 0 && (
        <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
      )}

      {/* Analysis Mode Layout */}
      <div className="flex flex-1 overflow-hidden" style={{ display: activeTab === 'analysis' ? 'flex' : 'none' }}>
        {/* Left Sidebar */}
        <div className="w-72 min-w-[280px] flex flex-col border-r border-border-soft overflow-y-auto">
          <FilePanel files={files} setFiles={setFiles} />
          <ApiKeysPanel apiKeys={apiKeys} />
        </div>

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border-soft">
          <InferenceQueue
            models={MODELS}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            passes={passes}
            setPasses={setPasses}
            canRun={canRunAnalysis}
            isRunning={runQueue.isRunning}
            blockedByOtherTab={analysisBlockedByAgent}
            onRun={runQueue.startRun}
            onStop={runQueue.stopRun}
            progress={runQueue.progress}
            theme={theme}
            cacheWarmDelay={cacheWarmDelay}
            setCacheWarmDelay={setCacheWarmDelay}
            interPassDelay={interPassDelay}
            setInterPassDelay={setInterPassDelay}
            interFileDelay={interFileDelay}
            setInterFileDelay={setInterFileDelay}
            separateFiles={separateFiles}
            setSeparateFiles={setSeparateFiles}
            collationFile={collationFile}
            setCollationFile={setCollationFile}
            streamingPreview={streamingPreview}
            setStreamingPreview={setStreamingPreview}
          />
        </div>

        {/* Right Panel */}
        <div className="w-96 min-w-[320px] flex flex-col overflow-hidden">
          <OutputViewer
            isRunning={runQueue.isRunning}
            streamingPreview={streamingPreview}
            streamText={runQueue.streamText}
            currentPassTitle={runQueue.currentPassTitle}
            currentFileName={runQueue.currentFileName}
            completedResults={runQueue.completedResults}
            runFolderPath={runQueue.runFolderPath}
            theme={theme}
            error={runQueue.error}
          />
        </div>
      </div>

      {/* Agent Mode Layout */}
      <div className="flex flex-1 overflow-hidden" style={{ display: activeTab === 'agent' ? 'flex' : 'none' }}>
        {/* Left Sidebar (shared) */}
        <div className="w-72 min-w-[280px] flex flex-col border-r border-border-soft overflow-y-auto">
          <FilePanel files={files} setFiles={setFiles} />
          <ApiKeysPanel apiKeys={apiKeys} />
        </div>

        {/* Center Panel — Agent Pass Queue */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border-soft">
          <AgentPassQueue
            models={MODELS}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            agentPasses={agentPasses}
            setAgentPasses={setAgentPasses}
            chunkConfig={chunkConfig}
            setChunkConfig={setChunkConfig}
            synthesisConfig={synthesisConfig}
            setSynthesisConfig={setSynthesisConfig}
            canRun={canRunAgent}
            isRunning={agentQueue.isRunning}
            blockedByOtherTab={agentBlockedByAnalysis}
            onRun={handleAgentRun}
            onStop={agentQueue.stopRun}
            progress={agentQueue.progress}
            theme={theme}
          />
        </div>

        {/* Right Panel — Scratchpad Viewer */}
        <div className="w-96 min-w-[320px] flex flex-col overflow-hidden">
          <ScratchpadViewer
            isRunning={agentQueue.isRunning}
            scratchpads={agentQueue.scratchpads[agentScratchpadFile] || {}}
            streamingPassTitle={agentQueue.streamingPassTitle}
            perFileSynthesis={agentQueue.perFileSynthesis}
            globalSynthesis={agentQueue.globalSynthesis}
            revisitMarkers={agentQueue.revisitMarkers}
            fileNames={agentQueue.processedFiles}
            selectedFile={agentScratchpadFile || (agentQueue.processedFiles[0] || '__global__')}
            onSelectFile={setAgentScratchpadFile}
            streamText={agentQueue.streamText}
            theme={theme}
          />
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          theme={theme}
          setTheme={setTheme}
          apiKeys={apiKeys}
          streamingSpeed={streamingSpeed}
          setStreamingSpeed={setStreamingSpeed}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
