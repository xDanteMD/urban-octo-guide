import React, { useCallback, useRef, useState } from 'react';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(charCount) {
  const tokens = Math.round(charCount / 4);
  if (tokens < 1000) return `~${tokens} tokens`;
  return `~${(tokens / 1000).toFixed(1)}k tokens`;
}

export default function FilePanel({ files, setFiles }) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  const parseFiles = useCallback(async (filePaths) => {
    setParsing(true);
    const results = [];
    for (const fp of filePaths) {
      const result = await window.electronAPI.parseFile(fp);
      if (result.success) {
        results.push({
          name: result.name,
          size: result.size,
          text: result.text,
          path: result.path,
          id: `${result.name}-${Date.now()}-${Math.random()}`,
        });
      }
    }
    setFiles(prev => [...prev, ...results]);
    setParsing(false);
  }, [setFiles]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validExts = ['.txt', '.md', '.pdf', '.docx'];
    const validPaths = droppedFiles
      .filter(f => validExts.some(ext => f.name.toLowerCase().endsWith(ext)))
      .map(f => f.path);
    if (validPaths.length > 0) parseFiles(validPaths);
  }, [parseFiles]);

  const handleBrowse = useCallback(async () => {
    const filePaths = await window.electronAPI.dialogOpenFiles();
    if (filePaths.length > 0) parseFiles(filePaths);
  }, [parseFiles]);

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, [setFiles]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3">
      <h3 className="font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-lo mb-2">
        Files ({files.length})
      </h3>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={handleBrowse}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors mb-2 shrink-0 ${
          isDragging ? 'drop-zone-active border-accent' : 'border-border-soft hover:border-accent/50'
        }`}
      >
        <svg className="mx-auto mb-1 text-text-lo" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p className="text-xs text-text-mid">
          {parsing ? 'Parsing...' : 'Drop files or click to browse'}
        </p>
        <p className="text-[10px] text-text-lo mt-1">.txt .md .pdf .docx</p>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-2 bg-surface rounded px-2 py-1.5 group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c6af7" strokeWidth="2" className="shrink-0">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-hi truncate">{file.name}</p>
              <p className="text-[10px] text-text-lo">{formatSize(file.size)}{file.text ? ` · ${formatTokens(file.text.length)}` : ''}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
              className="opacity-0 group-hover:opacity-100 text-text-lo hover:text-coral text-sm transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
