import { useState, useCallback, useRef } from 'react';
import { getOutputFileName, getCollatedFileName } from '../utils/sanitize';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useRunQueue({
  files, passes, selectedModel, provider, apiKeys,
  cacheWarmDelay, interPassDelay, interFileDelay,
  separateFiles, collationFile, streamingPreview,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [streamText, setStreamText] = useState('');
  const [currentPassTitle, setCurrentPassTitle] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [completedResults, setCompletedResults] = useState([]);
  const [error, setError] = useState(null);
  const [runFolderPath, setRunFolderPath] = useState(null);
  const cleanupRef = useRef(null);

  const startRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setCompletedResults([]);
    setStreamText('');
    setProgress(null);
    window.electronAPI.resetStop();

    const apiKey = apiKeys.getKeyForProvider(provider);
    if (!apiKey) {
      setError(`No API key set for ${provider}`);
      setIsRunning(false);
      return;
    }

    let folder;
    try {
      folder = await window.electronAPI.createRunFolder();
      setRunFolderPath(folder);
    } catch (e) {
      setError(`Failed to create output folder: ${e.message}`);
      setIsRunning(false);
      return;
    }

    const totalFiles = files.length;
    const totalPasses = passes.length;

    for (let fi = 0; fi < totalFiles; fi++) {
      const file = files[fi];

      // Inter-file delay (skip for first file)
      if (fi > 0 && interFileDelay > 0) {
        setProgress({
          currentFileIndex: fi, totalFiles, currentPassIndex: 0, totalPasses,
          currentPassTitle: '', overallPercent: Math.round(((fi * totalPasses) / (totalFiles * totalPasses)) * 100),
        });
        await sleep(interFileDelay * 1000);
      }

      const stopCheck1 = await window.electronAPI.checkStopRequested();
      if (stopCheck1.stopRequested) break;

      const collatedParts = [];

      for (let pi = 0; pi < totalPasses; pi++) {
        const pass = passes[pi];

        const stepsDone = fi * totalPasses + pi;
        const overallPercent = Math.round((stepsDone / (totalFiles * totalPasses)) * 100);

        if (pi === 0 && cacheWarmDelay > 0 && provider === 'anthropic') {
          setProgress({
            currentFileIndex: fi, totalFiles, currentPassIndex: pi, totalPasses,
            currentPassTitle: pass.title, overallPercent,
          });
          await sleep(cacheWarmDelay * 1000);
        } else if (pi > 0 && interPassDelay > 0) {
          setProgress({
            currentFileIndex: fi, totalFiles, currentPassIndex: pi, totalPasses,
            currentPassTitle: pass.title, overallPercent,
          });
          await sleep(interPassDelay * 1000);
        }

        const stopCheck2 = await window.electronAPI.checkStopRequested();
        if (stopCheck2.stopRequested) break;

        setProgress({
          currentFileIndex: fi, totalFiles, currentPassIndex: pi, totalPasses,
          currentPassTitle: pass.title, overallPercent,
        });
        setCurrentPassTitle(pass.title);
        setCurrentFileName(file.name);
        setStreamText('');

        const requestId = `${Date.now()}-${fi}-${pi}`;
        let accumulated = '';

        if (streamingPreview) {
          const cleanup = window.electronAPI.onStreamChunk(requestId, (chunk) => {
            accumulated += chunk;
            setStreamText(accumulated);
          });
          cleanupRef.current = cleanup;
        }

        try {
          const result = await window.electronAPI.runInference({
            provider,
            apiKey,
            model: selectedModel,
            systemPrompt: pass.prompt,
            documentText: file.text,
            requestId,
          });

          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }

          if (!result.success) {
            if (result.aborted) break;
            setError(`Error on ${file.name} / ${pass.title}: ${result.error}`);
            continue;
          }

          const outputText = result.text;

          if (separateFiles) {
            const outName = getOutputFileName(pass.title, file.name);
            await window.electronAPI.saveOutputFile(folder, outName, outputText);
          }

          collatedParts.push({ title: pass.title, text: outputText });

          setCompletedResults(prev => [...prev, {
            passTitle: pass.title,
            fileName: file.name,
            text: outputText,
            outputName: getOutputFileName(pass.title, file.name),
          }]);

        } catch (e) {
          if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
          }
          setError(`Error: ${e.message}`);
        }

        const stopCheck3 = await window.electronAPI.checkStopRequested();
        if (stopCheck3.stopRequested) break;
      }

      const stopCheck4 = await window.electronAPI.checkStopRequested();
      if (stopCheck4.stopRequested) break;

      if (collationFile && collatedParts.length > 0) {
        const collatedContent = collatedParts
          .map(p => `## ${p.title}\n\n${p.text}`)
          .join('\n\n---\n\n');
        const collatedName = getCollatedFileName(file.name);
        await window.electronAPI.saveOutputFile(folder, collatedName, collatedContent);
      }
    }

    setProgress(null);
    setStreamText('');
    setIsRunning(false);
  }, [files, passes, selectedModel, provider, apiKeys, cacheWarmDelay, interPassDelay, interFileDelay, separateFiles, collationFile, streamingPreview]);

  const stopRun = useCallback(() => {
    window.electronAPI.stopRun();
  }, []);

  return {
    isRunning,
    progress,
    streamText,
    currentPassTitle,
    currentFileName,
    completedResults,
    error,
    runFolderPath,
    startRun,
    stopRun,
  };
}
