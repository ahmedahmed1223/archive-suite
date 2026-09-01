import { spawnSync } from 'node:child_process';
import { accessSync, constants, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, renameSync, statfsSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { cpus, totalmem } from 'node:os';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { assessHost, parseChecksums, selectArtifacts, validateArchiveListing } from './core.mjs';

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { shell: false, encoding: 'utf8', stdio: 'pipe', timeout: 300_000, maxBuffer: 32 * 1024 ** 2, ...options });
  if (result.error || result.status !== 0) throw new Error(`تعذر تنفيذ ${command}; رمز الخروج ${result.status ?? 'غير متاح'}.`);
  return result.stdout || '';
}
export async function portFree(port) {
  return new Promise(resolveResult => {
    const server = createServer();
    server.once('error', () => resolveResult(false));
    server.listen({ host: '0.0.0.0', port, exclusive: true }, () => server.close(() => resolveResult(true)));
  });
}
export function probeHost(target) {
  let parent = resolve(target);
  while (!existsSync(parent) && dirname(parent) !== parent) parent = dirname(parent);
  let free = 0, writable = false;
  try { const stat = statfsSync(parent); free = stat.bavail * stat.bsize; accessSync(parent, constants.W_OK); writable = true; } catch { /* Report an unproven path as unavailable. */ }
  const probe = (cmd, args) => { try { run(cmd, args, { timeout: 15_000 }); return true; } catch { return false; } };
  const administrator = process.platform === 'win32'
    ? probe('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { exit 1 }'])
    : process.getuid?.() === 0;
  const serviceManager = process.platform === 'win32' || (existsSync('/run/systemd/system') && probe('systemctl', ['--version']));
  const docker = probe('docker', ['compose', 'version']) && probe('docker', ['info', '--format', '{{.OSType}}'])
    && (() => { try { return run('docker', ['info', '--format', '{{.OSType}}'], { timeout: 15_000 }).trim() === 'linux'; } catch { return false; } })();
  return assessHost({ platform: process.platform, arch: process.arch, cpus: cpus().length, memory: totalmem(), free, writable, administrator, serviceManager, docker, native: administrator && serviceManager });
}
export async function checksum(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyFile(path, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected || '') || await checksum(path) !== expected) throw new Error('فشل التحقق من SHA256؛ أعد تنزيل الحزمة.');
}
const REPO = 'ahmedahmed1223/archive-suite';
export async function fetchReleaseFile(version, name, target) {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid release asset.');
  const response = await fetch(`https://github.com/${REPO}/releases/download/v${version}/${name}`, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`تعذر تنزيل أصل الإصدار: HTTP ${response.status}.`);
  const partial = `${target}.download`;
  const fd = openSync(partial, 'wx', 0o600);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { fd, autoClose: true }));
    renameSync(partial, target);
  } catch (error) { if (existsSync(partial)) unlinkSync(partial); throw error; }
}
export async function acquireBundle({ version, mode, platform, source, cache, download = fetchReleaseFile }) {
  mkdirSync(cache, { recursive: true, mode: 0o700 });
  const inventoryPath = source ? join(source, 'SHA256SUMS') : join(cache, 'SHA256SUMS');
  if (!source && !existsSync(inventoryPath)) await download(version, 'SHA256SUMS', inventoryPath);
  const inventory = parseChecksums(readFileSync(inventoryPath, 'utf8'));
  const names = selectArtifacts([...inventory.keys()], mode, platform, version);
  const paths = [];
  for (const name of names) {
    const file = join(source || cache, name);
    if (!source && !existsSync(file)) await download(version, name, file);
    await verifyFile(file, inventory.get(name));
    paths.push(file);
  }
  if (paths.length === 1 && !names[0].includes('.part-')) return paths[0];
  const merged = join(cache, 'offline.tar.gz');
  const output = createWriteStream(merged, { flags: 'wx', mode: 0o600 });
  await pipeline(Readable.from((async function* () { for (const file of paths) for await (const chunk of createReadStream(file)) yield chunk; })()), output);
  const fullInventory = source ? join(source, 'OFFLINE-BUNDLE-SHA256') : join(cache, 'OFFLINE-BUNDLE-SHA256');
  if (!source && !existsSync(fullInventory)) await download(version, 'OFFLINE-BUNDLE-SHA256', fullInventory);
  const fullName = `archive-suite-offline-v${version}.tar.gz`;
  await verifyFile(merged, parseChecksums(readFileSync(fullInventory, 'utf8')).get(fullName));
  return merged;
}
export function extractBundle(archive, destination) {
  if (existsSync(destination)) throw new Error('مجلد الاستخراج موجود مسبقًا. اختر تثبيتًا جديدًا أو أمر repair.');
  const options = { cwd: dirname(resolve(archive)) };
  const file = resolve(archive);
  const names = run('tar', ['-tzf', file], options);
  const verbose = run('tar', ['-tvzf', file], options);
  validateArchiveListing(names, verbose);
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  run('tar', ['-xzf', file, '-C', destination], options);
  return destination;
}
