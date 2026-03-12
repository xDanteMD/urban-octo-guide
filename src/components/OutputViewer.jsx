import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ProgressBar from './ProgressBar';

export default function OutputViewer({
  isRunning,
  streamingPreview,
  streamText,
  currentPassTitle,
  currentFileName,
  completedResults,
  runFolderPath,
  theme,
  error,
}) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [outputFiles, setOutputFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const streamRef = useRef(null);

  // Auto-scroll stream view
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  // Load output files when run completes
  useEffect(() => {
    if (!isRunning && runFolderPath) {
      window.electronAPI.readOutputFiles(runFolderPath).then((files) => {
        setOutputFiles(files);
        if (files.length > 0) setSelectedFile(files[0]);
      });
    }
  }, [isRunning, runFolderPath]);

  // Streaming mode
  if (isRunning && streamingPreview) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border-soft shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-text-hi font-medium">
              [{currentPassTitle || '...'}] &rarr; {currentFileName || '...'}
            </span>
          </div>
          <ProgressBar progress={-1} theme={theme} animate={true} />
        </div>

        {/* Completed result tabs */}
        {completedResults.length > 0 && (
          <div className="flex overflow-x-auto border-b border-border-soft shrink-0 px-2">
            <button
              onClick={() => setSelectedTab(-1)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                selectedTab === -1 ? 'text-accent border-b-2 border-accent' : 'text-text-lo hover:text-text-mid'
              }`}
            >
              Live Stream
            </button>
            {completedResults.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedTab(i)}
                className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                  selectedTab === i ? 'text-accent border-b-2 border-accent' : 'text-text-lo hover:text-text-mid'
                }`}
              >
                {r.passTitle} &rarr; {r.fileName}
              </button>
            ))}
          </div>
        )}

        <div ref={streamRef} className="flex-1 overflow-y-auto p-4">
          {selectedTab === -1 || completedResults.length === 0 ? (
            <div className="markdown-content text-sm text-text-mid">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamText || '*Waiting for response...*'}
              </ReactMarkdown>
            </div>
          ) : (
            completedResults[selectedTab] && (
              <div className="markdown-content text-sm text-text-mid">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {completedResults[selectedTab].text}
                </ReactMarkdown>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="bg-coral/10 border border-coral/30 rounded-lg p-4 max-w-sm">
          <p className="text-coral text-sm font-medium mb-1">Error</p>
          <p className="text-text-mid text-xs">{error}</p>
        </div>
      </div>
    );
  }

  // File result browser
  if (outputFiles.length > 0 && !isRunning) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border-soft shrink-0 flex items-center gap-2">
          <select
            value={selectedFile?.name || ''}
            onChange={(e) => {
              const file = outputFiles.find(f => f.name === e.target.value);
              setSelectedFile(file);
            }}
            className="flex-1 bg-surface border border-border-soft rounded px-2 py-1 text-xs text-text-mid focus:border-accent focus:outline-none"
          >
            {outputFiles.map(f => (
              <option key={f.name} value={f.name}>{f.name}</option>
            ))}
          </select>
          {runFolderPath && (
            <button
              onClick={() => window.electronAPI.openOutputFolder(runFolderPath)}
              className="text-xs text-accent hover:text-accent/80 transition-colors whitespace-nowrap"
            >
              Open Folder
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {selectedFile && (
            <div className="markdown-content text-sm text-text-mid">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selectedFile.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  return (
    <div className="flex flex-col h-full items-center justify-center p-4 text-center">
      <svg className="w-12 h-12 text-text-lo mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <p className="text-sm text-text-lo">Output will appear here</p>
      <p className="text-xs text-text-lo/60 mt-1">Load files, configure passes, and run analysis</p>
    </div>
  );
}
