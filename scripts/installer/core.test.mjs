import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHost, parseChecksums, selectArtifacts, validateArchiveListing, validateSetup } from './core.mjs';

test('recommendation requires a supported host and a working runtime', () => {
  const host = { platform: 'win32', arch: 'x64', memory: 16e9, free: 180e9, writable: true, docker: true, native: true, ports: true };
  assert.equal(assessHost(host).recommended, 'docker');
  assert.equal(assessHost({ ...host, docker: false }).recommended, 'native');
  assert.equal(assessHost({ ...host, arch: 'arm64' }).recommended, null);
  assert.equal(assessHost({ ...host, free: 100 }).recommended, null);
});
test('checksum inventory accepts workflow prefixes and rejects ambiguous names', () => {
  const digest = 'ab'.repeat(32);
  assert.equal(parseChecksums(`${digest}  native-release-assets/bundle.tar.gz\n`).get('bundle.tar.gz'), digest);
  assert.throws(() => parseChecksums(`${digest}  a/x\n${digest}  b/x`), /duplicate/);
  assert.throws(() => parseChecksums('invalid'), /checksum/);
});
test('split parts must start at zero and be contiguous', () => {
  const files = ['archive-suite-offline-v1.5.2.tar.gz.part-00', 'archive-suite-offline-v1.5.2.tar.gz.part-01'];
  assert.deepEqual(selectArtifacts(files, 'offline', 'win32', '1.5.2'), files);
  assert.throws(() => selectArtifacts([files[1]], 'offline', 'win32', '1.5.2'), /part/);
});
test('archive preflight rejects absolute paths, traversal and escaping links', () => {
  validateArchiveListing('./scripts/main.mjs\n./runtime/node\n', '-rw-r--r-- file\ndrwxr-xr-x directory\n');
  for (const name of ['../escape', '/absolute', 'C:/drive', './ok/../../bad']) assert.throws(() => validateArchiveListing(name, ''), /archive/);
  assert.throws(() => validateArchiveListing('./link', 'lrwxrwxrwx x -> ../../outside'), /link/);
  validateArchiveListing('./runtime/bin/node\n./runtime/lib/main\n', 'lrwxrwxrwx x -> ../lib/main\n-rw-r--r-- file\n');
  assert.throws(() => validateArchiveListing('./a\n./link\n', 'lrwxrwxrwx a -> .\nlrwxrwxrwx link -> a/../outside\n'), /link/);
});
test('setup rejects credential injection and unsupported choices', () => {
  const input = { mode: 'docker', email: 'owner@example.org', password: 'A-long-secure-password', port: 3000 };
  assert.equal(validateSetup(input).port, 3000);
  assert.throws(() => validateSetup({ ...input, password: 'foo\nADMIN=true' }));
  assert.throws(() => validateSetup({ ...input, port: 0 }));
  assert.throws(() => validateSetup({ ...input, mode: 'unknown' }));
});
