const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { promisify } = require('util');
const stream = require('stream');
const got = require('got');
const unzipper = require('unzipper');
const tar = require('tar');
const { spawn } = require('child_process');

const pipeline = promisify(stream.pipeline);

// Map Node.js platform → Foldseek download URL
const FOLDS_URL = {
  win32:  'https://mmseqs.com/foldseek/foldseek-linux-gpu.tar.gz',
  darwin: 'https://mmseqs.com/foldseek/foldseek-linux-gpu.tar.gz',
  linux:  'https://github.com/soedinglab/foldseek/releases/download/v4.4.0/foldseek-linux64.tar.gz'
};

function getFoldseekUrl() {
  const url = FOLDS_URL[process.platform];
  if (!url) throw new Error(`Unsupported OS for Foldseek: ${process.platform}`);
  return url;
}

async function ensureFoldseek(resourcesPath) {
  const fsBin = path.join(resourcesPath, 'foldseek', 'bin');
  if (fs.existsSync(fsBin)) return;  // already present

  // 1) Download archive to temp
  const url     = getFoldseekUrl();
  const tmpFile = path.join(os.tmpdir(), path.basename(url));
  await pipeline(
    got.stream(url),
    fs.createWriteStream(tmpFile)
  );

  // 2) Extract only the 'bin/' subtree
  const destRoot = path.join(resourcesPath, 'foldseek');
  if (url.endsWith('.zip')) {
    await fs.createReadStream(tmpFile)
      .pipe(unzipper.Parse())
      .on('entry', entry => {
        const parts = entry.path.split(/\/|\\/);
        // e.g. ['foldseek-4.4.0-linux64','bin','foldseek']
        if (parts[1] === 'bin') {
          const relPath = parts.slice(1).join(path.sep);
          const outPath = path.join(destRoot, relPath);
          entry.pipe(fs.createWriteStream(outPath));
        } else entry.autodrain();
      })
      .promise();
  } else {
    await tar.x({
      file: tmpFile,
      cwd: destRoot,
      strip: 1,            // drop top-level folder
      filter: (path) => path.includes('bin/')
    });
  }
  fs.unlinkSync(tmpFile);

  // 3) Ensure executables
  for (const file of fs.readdirSync(fsBin)) {
    const full = path.join(fsBin, file);
    fs.chmodSync(full, 0o755);
  }
}

let pyProc = null;
let mainWindow = null;

function startPythonBackend(resourcesPath) {
  // choose platform-specific python
  const pyDir = path.join(resourcesPath, 'python-portable', process.platform);
  const pythonExe = process.platform === 'win32'
    ? path.join(pyDir, 'python.exe')
    : path.join(pyDir, 'bin', 'python3');

  // give execute perms if needed
  try { fs.chmodSync(pythonExe, 0o755); } catch {}

  // spawn Flask app
  pyProc = spawn(pythonExe, ['your_flask_app.py'], {
    cwd: path.join(resourcesPath, 'backend'),
    env: {
      ...process.env,
      // prepend Foldseek/bin to PATH
      PATH: path.join(resourcesPath, 'foldseek','bin') + path.delimiter + process.env.PATH
    }
  });

  pyProc.stdout.on('data', d => console.log(`[python] ${d}`));
  pyProc.stderr.on('data', d => console.error(`[python-err] ${d}`));
  pyProc.on('close', code => {
    console.log(`Python exited ${code}`);
    if (mainWindow) {
      dialog.showErrorBox('Error', 'Backend exited unexpectedly');
      app.quit();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadURL('http://127.0.0.1:5000');
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  const resources = process.resourcesPath;
  try {
    await ensureFoldseek(resources);
    startPythonBackend(resources);
    // wait a moment for Flask to bind
    setTimeout(createWindow, 1500);
  } catch (err) {
    dialog.showErrorBox('Startup Error', err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (pyProc) pyProc.kill();
  if (process.platform !== 'darwin') app.quit();
});
