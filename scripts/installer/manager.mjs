import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { validateSetup } from './core.mjs';
import { acquireBundle, extractBundle, portFree, probeHost, run } from './io.mjs';

const statePath = root => join(root, 'installation.json');
export function readState(root) {
  const state = JSON.parse(readFileSync(statePath(root), 'utf8'));
  if (state.schemaVersion !== 1 || !['docker', 'native', 'offline'].includes(state.mode) || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(state.version)) throw new Error('ملف حالة التثبيت غير صالح.');
  return state;
}
function saveState(root, state) { writeFileSync(statePath(root), JSON.stringify(state, null, 2) + '\n', { mode: 0o600 }); }
export function controllerRequest(root, state, command) {
  if (!['install', 'repair', 'status', 'start', 'stop', 'restart', 'logs', 'health', 'backup'].includes(command)) throw new Error('أمر إدارة غير مدعوم.');
  const payload = join(resolve(root), 'payload');
  const args = [join(payload, 'scripts/control-center.mjs'), ...(command === 'backup' ? ['exec', 'php', 'artisan', 'archive:backup-run'] : [command])];
  if (['install', 'repair'].includes(command)) args.push(`--config=${join(root, 'setup.json')}`);
  const env = {
    // Keep OS and Docker connection settings, but never inherit another
    // installation's app configuration or development-only bypass flags.
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(ARCHIVE_|COMPOSE_|ADMIN_|POSTGRES_|REDIS_|LARAVEL_|REVERB_|NEXT_|APP_|DB_|DATABASE_|ACCESS_MODE$|DOMAIN$|PUBLIC_DOMAIN$)/.test(key))),
    ARCHIVE_ENV_PATH: join(payload, 'infra/.env'),
    ARCHIVE_INSTALLATION_MANIFEST_PATH: join(payload, 'infra/setup/installation-manifest.json'),
    ARCHIVE_NATIVE_INSTALL_ROOT: payload,
    COMPOSE_PROJECT_NAME: `archive-${createHash('sha256').update(resolve(root)).digest('hex').slice(0, 12)}`,
  };
  if (state.mode === 'offline') env.ARCHIVE_OFFLINE_BUNDLE_PATH = join(root, 'offline', `archive-suite-offline-v${state.version}`);
  return { command: process.execPath, args, options: { cwd: payload, env, stdio: 'inherit', timeout: 30 * 60_000 } };
}
export function dispatch(root, state, command, invoke = run) {
  if (command === 'backup' && state.mode === 'native') {
    const payload = join(root, 'payload');
    return invoke(join(payload, process.platform === 'win32' ? 'runtime/php/php.exe' : 'runtime/php/bin/php'), [join(payload, 'app/laravel/artisan'), 'archive:backup-run'], { cwd: join(payload, 'app/laravel'), stdio: 'inherit' });
  }
  const request = controllerRequest(root, state, command);
  return invoke(request.command, request.args, request.options);
}
function envText(input) {
  const secret = () => randomBytes(24).toString('hex');
  const values = {
    ADMIN_EMAIL: input.email, ADMIN_PASSWORD: input.password, ADMIN_NAME: 'Archive Admin',
    POSTGRES_USER: 'archive', POSTGRES_DB: 'archive', POSTGRES_PASSWORD: secret(), REDIS_PASSWORD: secret(),
    LARAVEL_APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
    REVERB_APP_ID: secret(), REVERB_APP_KEY: secret(), REVERB_APP_SECRET: secret(),
    NEXT_PUBLIC_PORT: input.port, REVERB_SERVER_PUBLISHED_PORT: input.port + 1,
    APP_BASE_URL: `http://localhost:${input.port}`, LARAVEL_APP_URL: `http://localhost:${input.port}`,
    ARCHIVE_MODE: input.mode === 'native' ? 'native' : 'docker', ARCHIVE_SETUP_SOURCE: input.mode === 'offline' ? 'offline' : 'online',
  };
  return Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n') + '\n';
}
export function protect(path, invoke = run) {
  if (process.platform === 'win32') {
    const sid = invoke('whoami.exe', ['/user', '/fo', 'csv', '/nh']).match(/S-1-5-(?:\d+-)*\d+/)?.[0];
    if (!sid) throw new Error('تعذر تحديد صلاحيات ملف الإعدادات.');
    invoke('icacls.exe', [path, '/inheritance:r', '/grant:r', `*${sid}:(F)`, '*S-1-5-18:(F)', '*S-1-5-32-544:(F)']);
  } else invoke('chmod', ['600', path]);
}
export async function install(input, { kit, confirmed = false, invoke = run, probe = probeHost, acquire = acquireBundle, extract = extractBundle, isPortFree = portFree } = {}) {
  if (!confirmed) throw new Error('راجع الاختيارات وأكد التثبيت أولًا.');
  validateSetup(input);
  if (input.port > 65534) throw new Error('يلزم منفذ إضافي لخدمة الاتصال اللحظي.');
  const root = resolve(input.root);
  if (existsSync(root) && readdirSync(root).length) throw new Error('المجلد غير فارغ؛ استخدم repair للتثبيت الموجود أو اختر مجلدًا جديدًا.');
  const host = probe(root);
  const runtime = input.mode === 'native' ? 'native' : 'docker';
  if (!host.available.includes(runtime)) throw new Error([...host.errors, runtime === 'docker' ? 'شغّل Docker مع Linux containers وCompose أولًا.' : 'شغّل بصلاحية مسؤول، وعلى Linux يلزم systemd.'].join('\n'));
  const ports = runtime === 'native' ? [3000, 8443, 9000, 5432] : [input.port, input.port + 1];
  for (const port of ports) if (!await isPortFree(port)) throw new Error(`المنفذ ${port} غير متاح. أوقف الخدمة المتعارضة أو اختر منفذًا آخر.`);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  // The limited Native service user must be able to traverse the parent of
  // its installation; individual credential files remain owner-restricted.
  if (runtime === 'native' && process.platform !== 'win32') chmodSync(root, 0o755);
  const state = { schemaVersion: 1, version: input.version, mode: input.mode, phase: 'preparing', port: runtime === 'native' ? 8443 : input.port };
  saveState(root, state);
  try {
    const payload = join(root, 'payload');
    if (runtime === 'native') {
      const archive = await acquire({ version: input.version, mode: 'native', platform: process.platform, source: input.source, cache: join(root, 'downloads') });
      extract(archive, payload);
      if (!existsSync(join(payload, 'scripts/control-center.mjs')) || !existsSync(join(payload, 'runtime/node'))) throw new Error('حزمة Native ناقصة.');
    } else {
      mkdirSync(payload);
      for (const file of ['scripts', 'infra', 'package.json']) cpSync(join(kit, file), join(payload, file), { recursive: true, filter: path => !['.env', 'installation-manifest.json'].includes(basename(path)) && !basename(path).startsWith('.env.bak-') });
      if (input.mode === 'offline') {
        if (!input.source) throw new Error('حدد مجلد ملفات Offline باستخدام --source.');
        const archive = await acquire({ version: input.version, mode: 'offline', platform: process.platform, source: input.source, cache: join(root, 'downloads') });
        extract(archive, join(root, 'offline'));
      }
      // Give each installation its own bind-mounted application storage.
      const composePath = join(payload, 'infra/docker-compose.release.yml');
      const storage = join(root, 'storage');
      mkdirSync(storage);
      // Compose translates host bind paths for Docker Desktop. A local-volume
      // driver_opts.device would instead resolve inside the Linux daemon VM.
      const mount = JSON.stringify(`${storage.replaceAll('\\', '/')}:/app/storage/app`);
      const source = readFileSync(composePath, 'utf8');
      if (!source.includes('volumes: [storage:/app/storage/app]')) throw new Error('تعذر تحديد إعداد التخزين في حزمة Docker.');
      const compose = source.replaceAll('volumes: [storage:/app/storage/app]', `volumes: [${mount}]`);
      writeFileSync(composePath, compose);
    }
    const envPath = join(payload, 'infra/.env');
    writeFileSync(envPath, envText(input), { mode: 0o600, flag: 'wx' });
    protect(envPath, invoke);
    const setup = { schemaVersion: '1.0', mode: runtime, platform: runtime === 'native' ? `${process.platform === 'win32' ? 'windows' : 'linux'}-native` : process.platform === 'win32' ? 'windows-10-11-docker' : 'linux-docker', source: input.mode === 'offline' ? 'offline' : 'online', intent: 'fresh', access: 'local', runtimeProfiles: ['core'], capabilities: [], dataServices: { postgres: { enabled: true, ...(runtime === 'native' ? { kind: 'managed' } : {}) }, redis: runtime === 'native' ? { enabled: false } : { enabled: true } }, storage: { driver: 'local', path: join(root, 'storage') } };
    writeFileSync(join(root, 'setup.json'), JSON.stringify(setup, null, 2), { mode: 0o600 });
    state.phase = 'configured'; saveState(root, state);
    dispatch(root, state, 'install', invoke);
    if (runtime === 'native') bootstrapNativeAdmin(root, invoke);
    state.phase = 'installed'; saveState(root, state);
    return state;
  } catch (error) {
    state.failed = true; saveState(root, state);
    throw error;
  }
}
function bootstrapNativeAdmin(root, invoke) {
  const payload = join(root, 'payload');
  const entries = Object.fromEntries(readFileSync(join(payload, 'infra/.env'), 'utf8').split('\n').filter(Boolean).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 2, -1)]; }));
  invoke(join(payload, process.platform === 'win32' ? 'runtime/php/php.exe' : 'runtime/php/bin/php'), [join(payload, 'app/laravel/artisan'), 'db:seed', '--force'], { cwd: join(payload, 'app/laravel'), env: { ...process.env, ADMIN_EMAIL: entries.ADMIN_EMAIL, ADMIN_PASSWORD: entries.ADMIN_PASSWORD, ADMIN_NAME: entries.ADMIN_NAME }, stdio: 'inherit' });
}
export function manage(root, command, invoke = run) {
  const state = readState(root);
  if (state.phase === 'preparing') throw new Error('توقف تجهيز الحزمة قبل الإعداد. احتفظ بهذا المجلد للتشخيص واختر مجلدًا جديدًا لإعادة التثبيت.');
  dispatch(root, state, command, invoke);
  if (command === 'repair') {
    if (state.mode === 'native') bootstrapNativeAdmin(root, invoke);
    state.phase = 'installed'; delete state.failed; saveState(root, state);
  }
  return state;
}
