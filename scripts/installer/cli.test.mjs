import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const CLI = join(import.meta.dirname, 'cli.mjs');

test('help is plain English ASCII when output is not an interactive terminal', () => {
  const result = spawnSync(process.execPath, [CLI, 'help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Archive Suite Installer and Manager/);
  assert.match(result.stdout, /Commands: doctor \| install/);
  assert.doesNotMatch(result.stdout, /[^\x00-\x7f]/);
  assert.doesNotMatch(result.stdout, /\x1b\[/);
});

test('argument errors are English and terminal-safe', () => {
  const result = spawnSync(process.execPath, [CLI, 'help', '--unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown option/);
  assert.doesNotMatch(result.stderr, /[^\x00-\x7f]/);
  assert.doesNotMatch(result.stderr, /\x1b\[/);

  const injected = spawnSync(process.execPath, [CLI, 'help', '--\x1b[31m'], { encoding: 'utf8' });
  assert.equal(injected.status, 1);
  assert.doesNotMatch(injected.stderr, /\x1b\[/);
});
