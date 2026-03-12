import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStreamBuffer } from '../hooks/useStreamBuffer';

function ScratchpadSection({ title, status, content, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef(null);

  // Auto-expand when streaming starts
  useEffect(() => {
    if (status === 'streaming') setOpen(true);
  }, [status]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (open && contentRef.current && status === 'streaming') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, open, status]);

  const statusBadge = {
    waiting: <span className="text-[9px] text-text-lo">waiting...</span>,
    streaming: <span className="text-[9px] text-accent blink">streaming...</span>,
    done: <span className="text-[9px] text-emerald">done ✓</span>,
  }[status] || null;

  return (
    <div className="border-b border-border-faint last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-hover/50 transition-colors text-left"
      >
        <span className="font-display text-[10px] font-bold text-text-mid">
          {open ? '▼' : '▶'} {title}
        </span>
        {statusBadge}
      </button>
      {open && (
        <div
          ref={contentRef}
          className="px-3 pb-3 max-h-[300px] overflow-y-auto"
        >
          {content ? (
            <div className="markdown-content text-sm text-text-mid">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-[10px] text-text-lo italic">No content yet</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScratchpadViewer({
  isRunning,
  scratchpads,       // Map<passTitle, string>
  streamingPassTitle, // currently streaming pass title
  perFileSynthesis,   // Map<fileName, string>
  globalSynthesis,    // string
  revisitMarkers,     // Array<{filename, reason, status}>
  fileNames,          // string[] of processed file names
  selectedFile,       // currently selected file tab
  onSelectFile,       // callback to change file tab
  streamText,         // buffered stream text for display
  theme,
}) {
  const showGlobal = selectedFile === '__global__';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* File tabs */}
      {fileNames.length > 0 && (
        <div className="flex overflow-x-auto border-b border-border-soft shrink-0 px-2">
          {fileNames.map((name) => (
            <button
              key={name}
              onClick={() => onSelectFile(name)}
              className={`px-3 py-1.5 text-[10px] whitespace-nowrap transition-colors font-mono ${
                selectedFile === name
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-lo hover:text-text-mid'
              }`}
            >
              {name}
            </button>
          ))}
          <button
            onClick={() => onSelectFile('__global__')}
            className={`px-3 py-1.5 text-[10px] whitespace-nowrap transition-colors font-display font-bold ${
              showGlobal
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-lo hover:text-text-mid'
            }`}
          >
            Global Synthesis
          </button>
        </div>
      )}

      {/* Scratchpad sections */}
      <div className="flex-1 overflow-y-auto">
        {showGlobal ? (
          <>
            <ScratchpadSection
              title="Global Synthesis"
              status={globalSynthesis ? 'done' : isRunning ? 'waiting' : 'waiting'}
              content={globalSynthesis}
              defaultOpen={true}
            />
            <ScratchpadSection
              title={`Revisit Log (${revisitMarkers.length} markers)`}
              status={revisitMarkers.length > 0 ? 'done' : 'waiting'}
              content={
                revisitMarkers.length > 0
                  ? revisitMarkers.map((m, i) =>
                      `${i + 1}. **${m.filename}** — ${m.reason} \`[${m.status}]\``
                    ).join('\n\n')
                  : null
              }
              defaultOpen={revisitMarkers.length > 0}
            />
          </>
        ) : scratchpads && Object.keys(scratchpads).length > 0 ? (
          <>
            {Object.entries(scratchpads).map(([passTitle, content]) => (
              <ScratchpadSection
                key={passTitle}
                title={passTitle}
                status={
                  streamingPassTitle === passTitle ? 'streaming'
                    : content ? 'done'
                    : 'waiting'
                }
                content={streamingPassTitle === passTitle ? (streamText || content) : content}
                defaultOpen={streamingPassTitle === passTitle}
              />
            ))}
            {perFileSynthesis && perFileSynthesis[selectedFile] && (
              <ScratchpadSection
                title="Per-File Synthesis"
                status="done"
                content={perFileSynthesis[selectedFile]}
                defaultOpen={true}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <svg className="w-10 h-10 text-text-lo mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm text-text-lo">Scratchpad</p>
            <p className="text-xs text-text-lo/60 mt-1">Agent notes will appear here as passes run</p>
          </div>
        )}
      </div>
    </div>
  );
}
