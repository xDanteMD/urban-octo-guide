import React, { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar';
import FilePanel from './components/FilePanel';
import ApiKeysPanel from './components/ApiKeysPanel';
import InferenceQueue from './components/InferenceQueue';
import OutputViewer from './components/OutputViewer';
import SettingsModal from './components/SettingsModal';
import WarningBanner from './components/WarningBanner';
import { useApiKeys, useStoreValue } from './hooks/useStore';
import { useRunQueue } from './hooks/useRunQueue';

const MODELS = [
  { group: 'Anthropic', provider: 'anthropic', models: ['claude-3-7-sonnet-20250219', 'claude-3-5-haiku-20241022'] },
  { group: 'Gemini', provider: 'gemini', models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'] },
  { group: 'DeepSeek', provider: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'] },
];

function getProviderForModel(modelId) {
  for (const group of MODELS) {
    if (group.models.includes(modelId)) return group.provider;
  }
  return null;
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useStoreValue('theme', 'minimal');
  const [selectedModel, setSelectedModel] = useStoreValue('selectedModel', 'claude-3-7-sonnet-20250219');
  const [files, setFiles] = useState([]);
  const [passes, setPasses] = useState([
    { id: '1', title: '', prompt: '' },
  ]);
  const [warnings, setWarnings] = useState([]);

  // Timing config
  const [cacheWarmDelay, setCacheWarmDelay] = useStoreValue('cacheWarmDelay', 15);
  const [interPassDelay, setInterPassDelay] = useStoreValue('interPassDelay', 1);
  const [interFileDelay, setInterFileDelay] = useStoreValue('interFileDelay', 2);

  // Output options
  const [separateFiles, setSeparateFiles] = useStoreValue('separateFiles', true);
  const [collationFile, setCollationFile] = useStoreValue('collationFile', false);
  const [streamingPreview, setStreamingPreview] = useStoreValue('streamingPreview', true);

  const apiKeys = useApiKeys();
  const provider = getProviderForModel(selectedModel);

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

  const hasApiKey = apiKeys.getKeyForProvider(provider);
  const hasFiles = files.length > 0;
  const hasValidPasses = passes.every(p => p.title.trim() && p.prompt.trim());
  const canRun = hasApiKey && hasFiles && hasValidPasses && !runQueue.isRunning;

  return (
    <div className="h-full w-full flex flex-col bg-base text-text-body font-sans">
      <TitleBar
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {warnings.length > 0 && (
        <WarningBanner warnings={warnings} onDismiss={() => setWarnings([])} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 min-w-[280px] flex flex-col border-r border-border overflow-y-auto">
          <FilePanel files={files} setFiles={setFiles} />
          <ApiKeysPanel apiKeys={apiKeys} />
        </div>

        {/* Center Panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          <InferenceQueue
            models={MODELS}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            passes={passes}
            setPasses={setPasses}
            canRun={canRun}
            isRunning={runQueue.isRunning}
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

      {settingsOpen && (
        <SettingsModal
          theme={theme}
          setTheme={setTheme}
          apiKeys={apiKeys}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
