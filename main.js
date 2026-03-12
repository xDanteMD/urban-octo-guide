const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let activeAbortController = null;
let stopRequested = false;
let forceStopRequested = false;

function getPresetsFolder() {
  const userDataPath = app.getPath('userData');
  const presetsDir = path.join(userDataPath, 'presets');
  if (!fs.existsSync(presetsDir)) {
    fs.mkdirSync(presetsDir, { recursive: true });
    const defaultPresetSrc = app.isPackaged
      ? path.join(process.resourcesPath, 'presets', 'default-narrative.json')
      : path.join(__dirname, 'presets', 'default-narrative.json');
    if (fs.existsSync(defaultPresetSrc)) {
      fs.copyFileSync(defaultPresetSrc, path.join(presetsDir, 'default-narrative.json'));
    }
  }
  return presetsDir;
}

function getOutputFolder() {
  const custom = store.get('outputFolder');
  if (custom && fs.existsSync(custom)) return custom;
  const docs = path.join(os.homedir(), 'Documents', 'xDMD-PPLX-Analyzer');
  if (!fs.existsSync(docs)) fs.mkdirSync(docs, { recursive: true });
  return docs;
}

function createWindow() {
  const isDev = !app.isPackaged;
  const savedScale = store.get('uiScale', 100);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: savedScale / 100,
    },
    icon: fs.existsSync(path.join(__dirname, 'assets', 'icon.ico'))
      ? path.join(__dirname, 'assets', 'icon.ico')
      : undefined,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); });

// ─── Window Controls ───
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ─── Zoom / Scale ───
ipcMain.handle('set-zoom', (_, factor) => {
  mainWindow?.webContents.setZoomFactor(factor);
  store.set('uiScale', Math.round(factor * 100));
  return true;
});

// ─── Store ───
ipcMain.handle('store-get', (_, key, defaultVal) => store.get(key, defaultVal));
ipcMain.handle('store-set', (_, key, val) => { store.set(key, val); });
ipcMain.handle('store-delete', (_, key) => { store.delete(key); });

// ─── File Parsing (pdf-parse + mammoth) ───
ipcMain.handle('parse-file', async (_, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  const stats = fs.statSync(filePath);
  try {
    let text = '';
    if (ext === '.txt' || ext === '.md') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else {
      return { success: false, error: `Unsupported file type: ${ext}` };
    }
    return { success: true, text, name: fileName, size: stats.size, path: filePath };
  } catch (err) {
    return { success: false, error: `Failed to parse ${fileName}: ${err.message}` };
  }
});

// ─── File Dialog ───
ipcMain.handle('dialog-open-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Documents', extensions: ['txt', 'md', 'pdf', 'docx'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

// ─── Presets ───
ipcMain.handle('load-presets', async () => {
  const dir = getPresetsFolder();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const presets = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      presets.push(data);
    } catch { /* skip invalid */ }
  }
  return presets;
});

ipcMain.handle('save-preset', async (_, preset) => {
  const dir = getPresetsFolder();
  const safeName = preset.name.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '-').toLowerCase();
  const filePath = path.join(dir, `${safeName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
  return true;
});

ipcMain.handle('open-presets-folder', async () => {
  shell.openPath(getPresetsFolder());
});

// ─── Output Folder ───
ipcMain.handle('get-output-folder', () => getOutputFolder());

ipcMain.handle('change-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Output Folder',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('outputFolder', result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-output-folder', async (_, folderPath) => {
  const target = folderPath || getOutputFolder();
  if (fs.existsSync(target)) shell.openPath(target);
});

// ─── File Save ───
ipcMain.handle('save-output-file', async (_, folderPath, fileName, content) => {
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  const filePath = path.join(folderPath, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

ipcMain.handle('create-run-folder', async () => {
  const base = getOutputFolder();
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(now.getDate()).padStart(2, '0');
  const mon = months[now.getMonth()];
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const folderName = `${dd}-${mon}-${yyyy}_${hh}${mm}`;
  const folderPath = path.join(base, folderName);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  return folderPath;
});

// ─── Read output files from a run folder ───
ipcMain.handle('read-output-files', async (_, folderPath) => {
  if (!fs.existsSync(folderPath)) return [];
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
  return files.map(f => ({
    name: f,
    content: fs.readFileSync(path.join(folderPath, f), 'utf-8'),
  }));
});

// ─── App Info ───
ipcMain.handle('get-app-version', () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    return pkg.version;
  } catch { return '1.0.0'; }
});

// ─── Stop Control ───
ipcMain.on('stop-run', () => {
  if (stopRequested) {
    forceStopRequested = true;
    if (activeAbortController) activeAbortController.abort();
  }
  stopRequested = true;
});

ipcMain.on('reset-stop', () => {
  stopRequested = false;
  forceStopRequested = false;
  activeAbortController = null;
});

ipcMain.handle('check-stop-requested', () => {
  return { stopRequested, forceStopRequested };
});

// ─── API Streaming: Anthropic ───
async function streamAnthropic(apiKey, model, systemPrompt, documentText, event, requestId) {
  const controller = new AbortController();
  activeAbortController = controller;

  const useCache = documentText.length >= 3000;
  const userContent = useCache
    ? [{ type: 'text', text: documentText, cache_control: { type: 'ephemeral' } }]
    : [{ type: 'text', text: documentText }];

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      stream: true,
    }),
    signal: controller.signal,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${errText}`);
  }

  let fullText = '';
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
          fullText += parsed.delta.text;
          event.sender.send(`stream-chunk-${requestId}`, parsed.delta.text);
        }
      } catch { /* skip */ }
    }
  }

  activeAbortController = null;
  return fullText;
}

// ─── API Streaming: Gemini ───
async function streamGemini(apiKey, model, systemPrompt, documentText, event, requestId, retries = 0) {
  const controller = new AbortController();
  activeAbortController = controller;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + documentText }] }],
    }),
    signal: controller.signal,
  });

  if (resp.status === 429 && retries < 5) {
    activeAbortController = null;
    const delay = Math.min(2000 * Math.pow(2, retries), 32000);
    await new Promise(r => setTimeout(r, delay));
    return streamGemini(apiKey, model, systemPrompt, documentText, event, requestId, retries + 1);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  let fullText = '';
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.candidates?.[0]?.content?.parts) {
          for (const part of parsed.candidates[0].content.parts) {
            if (part.text) {
              fullText += part.text;
              event.sender.send(`stream-chunk-${requestId}`, part.text);
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  activeAbortController = null;
  return fullText;
}

// ─── API Streaming: DeepSeek ───
async function streamDeepSeek(apiKey, model, systemPrompt, documentText, event, requestId, retries = 0) {
  const controller = new AbortController();
  activeAbortController = controller;

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: documentText },
      ],
      stream: true,
    }),
    signal: controller.signal,
  });

  if (resp.status === 429 && retries < 5) {
    activeAbortController = null;
    const delay = Math.min(2000 * Math.pow(2, retries), 32000);
    await new Promise(r => setTimeout(r, delay));
    return streamDeepSeek(apiKey, model, systemPrompt, documentText, event, requestId, retries + 1);
  }

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`DeepSeek API error ${resp.status}: ${errText}`);
  }

  let fullText = '';
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullText += content;
          event.sender.send(`stream-chunk-${requestId}`, content);
        }
      } catch { /* skip */ }
    }
  }

  activeAbortController = null;
  return fullText;
}

// ─── Run Inference (unified handler) ───
ipcMain.handle('run-inference', async (event, { provider, apiKey, model, systemPrompt, documentText, requestId }) => {
  try {
    let result;
    if (provider === 'anthropic') {
      result = await streamAnthropic(apiKey, model, systemPrompt, documentText, event, requestId);
    } else if (provider === 'gemini') {
      result = await streamGemini(apiKey, model, systemPrompt, documentText, event, requestId);
    } else if (provider === 'deepseek') {
      result = await streamDeepSeek(apiKey, model, systemPrompt, documentText, event, requestId);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return { success: true, text: result };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request aborted', aborted: true };
    }
    return { success: false, error: err.message };
  }
});
