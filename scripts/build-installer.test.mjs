import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildInstaller, releaseDescriptor } from './build-installer.mjs';
import { loadReleaseDescriptor } from './control-center/release-descriptor.mjs';

test('installer kits carry their controller, runtime launchers and read-only help', async () => {
  const parent = mkdtempSync(join(tmpdir(), 'archive-kit-test-'));
  for (const platform of ['windows', 'linux']) {
    const out = join(parent, platform);
    await buildInstaller({ platform, out, archive: false, stageNode: async ({ destDir }) => { mkdirSync(destDir, { recursive: true }); writeFileSync(join(destDir, 'fixture'), 'runtime fixture'); } });
    assert.ok(existsSync(join(out, 'scripts/control-center.mjs')));
    assert.ok(existsSync(join(out, 'infra/offline/verify-bundle.mjs')));
    assert.equal(existsSync(join(out, 'infra/setup/installation-manifest.json')), false);
    assert.ok(readFileSync(join(out, 'SHA256SUMS'), 'utf8').includes('scripts/installer/cli.mjs'));
    const help = spawnSync(process.execPath, [join(out, 'scripts/installer/cli.mjs'), 'help'], { encoding: 'utf8' });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /doctor/);
  }
});
test('runtime descriptor keeps verified source digests and service identities', () => {
  const descriptor = releaseDescriptor({ version: 'v1.5.2', images: [{ id: 'next', source: `ghcr.io/org/next@sha256:${'ab'.repeat(32)}`, bundleRef: 'archive-suite/next:1.5.2' }] });
  assert.equal(descriptor.version, '1.5.2');
  assert.equal(descriptor.images[0].online, `ghcr.io/org/next:1.5.2@sha256:${'ab'.repeat(32)}`);
  assert.equal(descriptor.images[0].offlineRef, 'archive-suite/next:$VERSION');
});

test('a complete verified image manifest produces a loadable release descriptor', () => {
  const parent = mkdtempSync(join(tmpdir(), 'archive-descriptor-test-'));
  const images = ['postgres', 'redis', 'laravel', 'laravel-fpm', 'laravel-worker', 'laravel-reverb', 'next'].map(id => ({
    id, source: `ghcr.io/org/${id}@sha256:${'ab'.repeat(32)}`, bundleRef: `archive-suite/${id}:1.5.2`,
  }));
  const file = join(parent, 'release.json');
  writeFileSync(file, JSON.stringify(releaseDescriptor({ version: 'v1.5.2', images })));
  assert.equal(loadReleaseDescriptor(file).images.length, 7);
});
