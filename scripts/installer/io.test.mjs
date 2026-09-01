import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireBundle, checksum, extractBundle, run } from './io.mjs';

test('verified split archives are merged in order and extracted with real tar', async () => {
  const root = mkdtempSync(join(tmpdir(), 'archive-split-test-'));
  const source = join(root, 'source'); mkdirSync(source);
  writeFileSync(join(source, 'hello.txt'), 'verified payload');
  const archiveName = 'archive-suite-offline-v1.5.2.tar.gz';
  const archive = join(root, archiveName);
  run('tar', ['-czf', archive, '-C', source, '.']);
  const bytes = readFileSync(archive), half = Math.floor(bytes.length / 2);
  const parts = [`${archiveName}.part-00`, `${archiveName}.part-01`];
  writeFileSync(join(root, parts[0]), bytes.subarray(0, half));
  writeFileSync(join(root, parts[1]), bytes.subarray(half));
  writeFileSync(join(root, 'SHA256SUMS'), `${await checksum(join(root, parts[0]))}  ${parts[0]}\n${await checksum(join(root, parts[1]))}  ${parts[1]}\n`);
  writeFileSync(join(root, 'OFFLINE-BUNDLE-SHA256'), `${await checksum(archive)}  ${archiveName}\n`);
  const merged = await acquireBundle({ version: '1.5.2', mode: 'offline', platform: process.platform, source: root, cache: join(root, 'cache'), download: () => { throw new Error('Offline must not access the network'); } });
  assert.deepEqual(readFileSync(merged), bytes);
  const destination = join(root, 'extracted');
  extractBundle(merged, destination);
  assert.equal(readFileSync(join(destination, 'hello.txt'), 'utf8'), 'verified payload');
  assert.throws(() => extractBundle(merged, destination), /موجود/);
});
