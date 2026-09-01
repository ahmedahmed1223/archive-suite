import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { controllerRequest, install, readState, manage } from './manager.mjs';
import { verifyFile, checksum } from './io.mjs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildInstaller } from '../build-installer.mjs';

test('unconfirmed and failed preflight installs never create the destination', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'archive-installer-test-'));
  const root = join(parent, 'install');
  const input = { root, mode: 'docker', email: 'owner@example.org', password: 'Secure-password-12345', port: 3000, version: '1.5.2' };
  await assert.rejects(install(input), /أكد/);
  assert.equal(existsSync(root), false);
  await assert.rejects(install(input, { confirmed: true, probe: () => ({ available: [], errors: ['disk unavailable'] }) }), /disk unavailable/);
  assert.equal(existsSync(root), false);
});
test('management isolates compose project and does not put credentials in argv', () => {
  const previous = process.env.ARCHIVE_DEVELOPMENT_MODE;
  process.env.ARCHIVE_DEVELOPMENT_MODE = '1';
  const request = controllerRequest('/installation', { mode: 'docker', version: '1.5.2' }, 'repair');
  if (previous === undefined) delete process.env.ARCHIVE_DEVELOPMENT_MODE; else process.env.ARCHIVE_DEVELOPMENT_MODE = previous;
  assert.equal(request.options.env.ARCHIVE_DEVELOPMENT_MODE, undefined);
  assert.match(request.options.env.COMPOSE_PROJECT_NAME, /^archive-[a-f0-9]{12}$/);
  assert.ok(request.args.some(arg => arg.startsWith('--config=')));
  assert.ok(!request.args.join(' ').includes('PASSWORD'));
  assert.throws(() => controllerRequest('/installation', {}, 'delete-everything'));
});
test('checksum detects modified downloaded files', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'archive-checksum-test-'));
  const file = join(parent, 'payload'); writeFileSync(file, 'valid package');
  const expected = await checksum(file);
  await verifyFile(file, expected);
  writeFileSync(file, 'modified package');
  await assert.rejects(verifyFile(file, expected), /SHA256/);
});
test('Docker setup produces a valid control-center plan and resumes a failed install', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'archive-install-journey-'));
  const root = join(parent, 'installation');
  const kit = join(parent, 'kit');
  await buildInstaller({ platform: 'windows', out: kit, archive: false, stageNode: async ({ destDir }) => mkdirSync(destDir, { recursive: true }) });
  const input = { root, version: '1.5.2', mode: 'docker', email: 'owner@example.org', password: 'Secure-test-password-9281', port: 3456 };
  const calls = [];
  const invoke = (command, args) => {
    calls.push({ command, args });
    if (command === 'whoami.exe') return 'S-1-5-21-123-456-789-1000';
    if (args.includes('install')) throw new Error('simulated runtime failure');
    return '';
  };
  await assert.rejects(install(input, { kit, confirmed: true, invoke, probe: () => ({ available: ['docker'], errors: [] }), isPortFree: async () => true }), /simulated/);
  assert.equal(readState(root).phase, 'configured');
  assert.equal(readState(root).failed, true);
  const compose = readFileSync(join(root, 'payload/infra/docker-compose.release.yml'), 'utf8');
  assert.ok(compose.includes(JSON.stringify(`${join(root, 'storage').replaceAll('\\', '/')}:/app/storage/app`)));
  assert.ok(!compose.includes('driver_opts'));
  assert.ok(!readFileSync(join(root, 'installation.json'), 'utf8').includes(input.password));
  const plan = spawnSync(process.execPath, [join(root, 'payload/scripts/control-center.mjs'), 'plan', `--config=${join(root, 'setup.json')}`, '--json'], { encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr + plan.stdout);
  assert.equal(JSON.parse(plan.stdout).ok, true);
  manage(root, 'repair', invoke);
  assert.equal(readState(root).phase, 'installed');
  assert.equal(readState(root).failed, undefined);
  assert.equal(calls.some(call => call.args.join(' ').includes(input.password)), false);
});
