import { useState, useCallback, useRef } from 'react';
import { chunkByTurns } from '../utils/chunkByTurns';
import { parseRevisitMarkers } from '../utils/parseRevisitMarkers';
import { sanitizeFilename } from '../utils/sanitize';

const DEFAULT_SYNTHESIS_PROMPT = `You have finished reading {CONTEXT}.
Your complete notes so far:
{SCRATCHPAD_SO_FAR}

Now synthesize. Do not summarize flatly — reason about patterns,
contradictions, evolution over time, and what this reveals about the subject.
If any section warrants re-examination given what you now know in full,
output a revisit marker in this exact format on its own line:
[REVISIT: <filename_or_"global">, <one sentence reason>]`;

function buildChunkPrompt(systemPrompt, scratchpadSoFar, chunkText) {
  return `${systemPrompt}

---
You are building a rolling set of notes.
Current scratchpad so far:
${scratchpadSoFar || '(empty — this is the first chunk)'}

Next section of source material:
${chunkText}

Continue your notes. Do not repeat what is already in the scratchpad.
Append only new observations. If you find something that contradicts
an earlier note, prefix it with [INCONSISTENCY].`;
}

function buildSynthesisPrompt(promptTemplate, scratchpadSoFar, contextLabel) {
  return promptTemplate
    .replace('{CONTEXT}', contextLabel)
    .replace('{SCRATCHPAD_SO_FAR}', scratchpadSoFar || '(empty)');
}

// Hard cap for revisit re-processing: if total chars exceed this,
// only re-process the 2 most recent chunks plus the synthesis output
const REVISIT_HARD_CAP_CHARS = 120000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAgentQueue({ apiKeys, selectedModel, models }) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [scratchpads, setScratchpads] = useState({});           // { [fileName]: { [passTitle]: string } }
  const [perFileSynthesis, setPerFileSynthesis] = useState({});  // { [fileName]: string }
  const [globalSynthesis, setGlobalSynthesis] = useState('');
  const [revisitMarkers, setRevisitMarkers] = useState([]);
  const [streamText, setStreamText] = useState('');
  const [streamingPassTitle, setStreamingPassTitle] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [error, setError] = useState(null);
  const [runFolderPath, setRunFolderPath] = useState(null);
  const [processedFiles, setProcessedFiles] = useState([]);

  const stopRef = useRef(false);

  const getProvider = useCallback(() => {
    const modelGroup = models.find((g) => g.models.includes(selectedModel));
    return modelGroup?.provider || 'anthropic';
  }, [models, selectedModel]);

  const runInference = useCallback(async (systemPrompt, documentText, requestId, onChunk) => {
    const provider = getProvider();
    const apiKey = apiKeys.getKeyForProvider(provider);

    let cleanup = null;
    let accumulated = '';

    if (onChunk) {
      cleanup = window.electronAPI.onStreamChunk(requestId, (chunk) => {
        accumulated += chunk;
        onChunk(accumulated);
      });
    }

    try {
      const result = await window.electronAPI.runInference({
        provider,
        apiKey,
        model: selectedModel,
        systemPrompt,
        documentText,
        requestId,
      });

      if (cleanup) cleanup();
      return result;
    } catch (err) {
      if (cleanup) cleanup();
      throw err;
    }
  }, [getProvider, apiKeys, selectedModel]);

  const startRun = useCallback(async (files, agentPasses, chunkConfig, synthesisConfig) => {
    stopRef.current = false;
    setIsRunning(true);
    setError(null);
    setScratchpads({});
    setPerFileSynthesis({});
    setGlobalSynthesis('');
    setRevisitMarkers([]);
    setStreamText('');
    setStreamingPassTitle('');
    setProcessedFiles([]);

    await window.electronAPI.resetStop();

    let folder;
    try {
      folder = await window.electronAPI.createRunFolder();
      setRunFolderPath(folder);
    } catch (err) {
      setError(`Failed to create output folder: ${err.message}`);
      setIsRunning(false);
      return;
    }

    const allPerFileSyntheses = {};
    const allRevisitMarkers = [];
    const filesScratchpads = {};

    try {
      // ── MAIN LOOP: for each file ──
      for (let fi = 0; fi < files.length; fi++) {
        if (stopRef.current) break;

        const file = files[fi];
        setCurrentFileName(file.name);
        setProcessedFiles((prev) => [...new Set([...prev, file.name])]);

        const chunks = chunkByTurns(file.text, chunkConfig.maxChars, chunkConfig.respectTurns);
        const perFileScratchpad = {}; // { [passTitle]: string }
        agentPasses.forEach((p) => { perFileScratchpad[p.title] = ''; });

        // ── For each chunk ──
        for (let ci = 0; ci < chunks.length; ci++) {
          if (stopRef.current) break;

          // ── For each pass ──
          for (let pi = 0; pi < agentPasses.length; pi++) {
            if (stopRef.current) break;

            const pass = agentPasses[pi];
            const isFirstChunkFirstPass = ci === 0 && pi === 0;

            // Delay logic
            const delay = isFirstChunkFirstPass
              ? chunkConfig.cacheWarmDelay * 1000
              : pi === 0
                ? chunkConfig.interChunkDelay * 1000
                : chunkConfig.interPassDelay * 1000;

            // Skip delay for the very first operation of the very first file
            if (!(fi === 0 && ci === 0 && pi === 0)) {
              await sleep(delay);
            }

            const { stopRequested } = await window.electronAPI.checkStopRequested();
            if (stopRequested) { stopRef.current = true; break; }

            setProgress({
              currentFileIndex: fi,
              totalFiles: files.length,
              currentPassIndex: pi,
              totalPasses: agentPasses.length,
              currentPassTitle: pass.title,
              currentFileName: file.name,
              currentChunkIndex: ci,
              totalChunks: chunks.length,
              revisitRound: 0,
              overallPercent: Math.round(
                ((fi * chunks.length * agentPasses.length + ci * agentPasses.length + pi) /
                  (files.length * chunks.length * agentPasses.length)) * 100
              ),
            });

            setStreamingPassTitle(pass.title);
            setStreamText('');

            const systemPrompt = buildChunkPrompt(
              pass.prompt,
              perFileScratchpad[pass.title],
              chunks[ci]
            );

            const requestId = `agent-${Date.now()}-${fi}-${ci}-${pi}`;

            const result = await runInference(
              systemPrompt,
              '', // documentText is embedded in systemPrompt for agent mode
              requestId,
              (accumulated) => setStreamText(accumulated)
            );

            if (result.aborted) { stopRef.current = true; break; }
            if (!result.success) {
              setError(`Pass "${pass.title}" failed on ${file.name} chunk ${ci + 1}: ${result.error}`);
              setIsRunning(false);
              return;
            }

            perFileScratchpad[pass.title] += '\n\n' + result.text;

            // Update scratchpads state for UI
            setScratchpads((prev) => ({
              ...prev,
              [file.name]: { ...prev[file.name], [pass.title]: perFileScratchpad[pass.title].trim() },
            }));
          }
        }

        if (stopRef.current) break;

        filesScratchpads[file.name] = { ...perFileScratchpad };

        // Save per-pass outputs for this file
        for (const pass of agentPasses) {
          const content = perFileScratchpad[pass.title].trim();
          if (content) {
            const fileName = `agent_${sanitizeFilename(file.name)}_${sanitizeFilename(pass.title)}.md`;
            await window.electronAPI.saveOutputFile(folder, fileName, content);
          }
        }

        // ── Per-file synthesis ──
        if (synthesisConfig.perFileEnabled && !stopRef.current) {
          setStreamingPassTitle('Per-File Synthesis');
          setStreamText('');

          const allNotes = agentPasses
            .map((p) => `## ${p.title}\n\n${perFileScratchpad[p.title].trim()}`)
            .join('\n\n---\n\n');

          const prompt = buildSynthesisPrompt(
            synthesisConfig.perFilePrompt || DEFAULT_SYNTHESIS_PROMPT,
            allNotes,
            file.name
          );

          const requestId = `agent-synthesis-${Date.now()}-${fi}`;
          const result = await runInference(
            prompt,
            '',
            requestId,
            (accumulated) => setStreamText(accumulated)
          );

          if (result.aborted) { stopRef.current = true; break; }
          if (result.success) {
            allPerFileSyntheses[file.name] = result.text;
            setPerFileSynthesis((prev) => ({ ...prev, [file.name]: result.text }));

            const markers = parseRevisitMarkers(result.text);
            allRevisitMarkers.push(...markers);
            setRevisitMarkers([...allRevisitMarkers]);

            const synthFileName = `agent_${sanitizeFilename(file.name)}_synthesis.md`;
            await window.electronAPI.saveOutputFile(folder, synthFileName, result.text);
          }
        }

        // Inter-file delay
        if (fi < files.length - 1 && !stopRef.current) {
          await sleep(chunkConfig.interPassDelay * 1000);
        }
      }

      // ── Global synthesis ──
      if (synthesisConfig.globalEnabled && !stopRef.current) {
        setStreamingPassTitle('Global Synthesis');
        setStreamText('');
        setCurrentFileName('Global');

        const allSyntheses = Object.entries(allPerFileSyntheses)
          .map(([name, text]) => `# ${name}\n\n${text}`)
          .join('\n\n---\n\n');

        const prompt = buildSynthesisPrompt(
          synthesisConfig.globalPrompt || DEFAULT_SYNTHESIS_PROMPT,
          allSyntheses || 'No per-file syntheses were generated.',
          'all files'
        );

        const requestId = `agent-global-${Date.now()}`;
        const result = await runInference(
          prompt,
          '',
          requestId,
          (accumulated) => setStreamText(accumulated)
        );

        if (result.success && !result.aborted) {
          setGlobalSynthesis(result.text);

          const markers = parseRevisitMarkers(result.text);
          allRevisitMarkers.push(...markers);
          setRevisitMarkers([...allRevisitMarkers]);

          await window.electronAPI.saveOutputFile(folder, 'agent_GLOBAL_synthesis.md', result.text);

          // Save revisit log
          if (allRevisitMarkers.length > 0) {
            const logContent = allRevisitMarkers
              .map((m, i) => `${i + 1}. **${m.filename}** — ${m.reason} [${m.status}]`)
              .join('\n');
            await window.electronAPI.saveOutputFile(folder, 'agent_GLOBAL_revisit_log.md', logContent);
          }

          // ── REVISIT ROUNDS ──
          let currentGlobalResult = result.text;
          for (let round = 1; round <= chunkConfig.maxRevisitRounds; round++) {
            if (stopRef.current) break;

            const pendingMarkers = allRevisitMarkers.filter((m) => m.status === 'queued');
            if (pendingMarkers.length === 0) break;

            setProgress((prev) => ({ ...prev, revisitRound: round }));

            for (const marker of pendingMarkers) {
              if (stopRef.current) break;

              setCurrentFileName(`Revisit: ${marker.filename}`);
              setStreamingPassTitle(`Revisit: ${marker.reason}`);
              setStreamText('');

              let targetText;
              if (marker.filename === 'global') {
                targetText = Object.values(allPerFileSyntheses).join('\n\n---\n\n');
              } else {
                const targetFile = files.find((f) => f.name === marker.filename || f.name.includes(marker.filename));
                targetText = targetFile ? targetFile.text : '';
              }

              if (!targetText) {
                marker.status = 'complete';
                continue;
              }

              let revisitChunks = chunkByTurns(targetText, chunkConfig.maxChars, chunkConfig.respectTurns);

              // Hard cap: if total chars exceed threshold, only use the
              // 2 most recent chunks plus the synthesis output
              const totalRevisitChars = revisitChunks.reduce((sum, c) => sum + c.length, 0);
              if (totalRevisitChars > REVISIT_HARD_CAP_CHARS && revisitChunks.length > 2) {
                const recentChunks = revisitChunks.slice(-2);
                const synthesisText = marker.filename === 'global'
                  ? currentGlobalResult
                  : (allPerFileSyntheses[marker.filename] || '');
                if (synthesisText) {
                  recentChunks.unshift(`[SYNTHESIS CONTEXT]\n\n${synthesisText}`);
                }
                revisitChunks = recentChunks;
              }

              const revisitScratchpad = {};
              agentPasses.forEach((p) => { revisitScratchpad[p.title] = ''; });

              for (let ci = 0; ci < revisitChunks.length; ci++) {
                for (let pi = 0; pi < agentPasses.length; pi++) {
                  if (stopRef.current) break;

                  const pass = agentPasses[pi];
                  if (ci > 0 || pi > 0) await sleep(chunkConfig.interPassDelay * 1000);

                  const systemPrompt = buildChunkPrompt(
                    pass.prompt + `\n\nContext for revisit: ${marker.reason}`,
                    revisitScratchpad[pass.title],
                    revisitChunks[ci]
                  );

                  const requestId = `agent-revisit-${Date.now()}-${round}-${ci}-${pi}`;
                  const revisitResult = await runInference(
                    systemPrompt, '', requestId,
                    (accumulated) => setStreamText(accumulated)
                  );

                  if (revisitResult.success) {
                    revisitScratchpad[pass.title] += '\n\n' + revisitResult.text;
                  }
                }
              }

              marker.status = 'complete';
              setRevisitMarkers([...allRevisitMarkers]);
            }

            // Re-run global synthesis after revisit
            if (!stopRef.current) {
              setStreamingPassTitle('Global Synthesis (post-revisit)');
              setStreamText('');

              const revisitSynthPrompt = `Previous global synthesis:\n${currentGlobalResult}\n\nRevisit findings have been incorporated. Refine your synthesis.`;
              const requestId = `agent-revisit-synth-${Date.now()}-${round}`;
              const revisitSynthResult = await runInference(
                revisitSynthPrompt, '', requestId,
                (accumulated) => setStreamText(accumulated)
              );

              if (revisitSynthResult.success) {
                currentGlobalResult = revisitSynthResult.text;
                setGlobalSynthesis(revisitSynthResult.text);
                const newMarkers = parseRevisitMarkers(revisitSynthResult.text);
                allRevisitMarkers.push(...newMarkers);
                setRevisitMarkers([...allRevisitMarkers]);
              }
            }
          }

          // Save final lore dump
          const loreContent = currentGlobalResult;
          const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
          const timeStr = new Date().toTimeString().slice(0, 5).replace(':', '');
          await window.electronAPI.saveOutputFile(folder, `LORE_DUMP_${dateStr}_${timeStr}.md`, loreContent);
        }
      }

      setStreamingPassTitle('');
      setStreamText('');

    } catch (err) {
      setError(err.message || 'Agent run failed');
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [runInference]);

  const stopRun = useCallback(() => {
    stopRef.current = true;
    window.electronAPI.stopRun();
  }, []);

  return {
    isRunning,
    progress,
    scratchpads,
    perFileSynthesis,
    globalSynthesis,
    revisitMarkers,
    streamText,
    streamingPassTitle,
    currentFileName,
    error,
    runFolderPath,
    processedFiles,
    startRun,
    stopRun,
  };
}
