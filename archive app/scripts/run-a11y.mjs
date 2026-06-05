import { spawn } from 'node:child_process';

const SERVER_URL = 'http://127.0.0.1:4173';
const isWindows = process.platform === 'win32';
let previewProcess = null;
let shuttingDown = false;

function spawnShell(command, options = {}) {
  return spawn(command, {
    cwd: process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? 'inherit',
    shell: true,
    windowsHide: true
  });
}

function runCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnShell(command, options);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(SERVER_URL);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for ${SERVER_URL}`);
}

function stopPreview() {
  if (!previewProcess || previewProcess.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    if (isWindows) {
      const killer = spawn('taskkill', ['/pid', String(previewProcess.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
      killer.on('exit', resolve);
      setTimeout(resolve, 3000).unref();
      return;
    }

    previewProcess.kill('SIGTERM');
    previewProcess.on('exit', resolve);
    setTimeout(resolve, 3000).unref();
  });
}

async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopPreview();
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(130));
process.on('SIGTERM', () => void shutdown(143));
process.on('SIGHUP', () => void shutdown(129));

try {
  await runCommand('npx vite build --mode spa --configLoader runner');
  previewProcess = spawnShell('npx vite preview --host 127.0.0.1 --configLoader runner --port 4173');
  await waitForServer();
  await runCommand('npx playwright test');
  await shutdown(0);
} catch (error) {
  console.error(error);
  await shutdown(1);
}
