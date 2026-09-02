import test from 'node:test';
import assert from 'node:assert/strict';
import { colorize, parseMenuChoice, promptUntil, renderMenu, safeText, useColor } from './terminal-ui.mjs';

test('numbered menus are readable with and without terminal colors', () => {
  assert.equal(renderMenu('Choose a runtime', ['Docker', 'Native'], { color: false }), 'Choose a runtime\n  1) Docker\n  2) Native');
  const colored = renderMenu('Choose a runtime', ['Docker', 'Native'], { color: true });
  assert.match(colored, /\x1b\[36mChoose a runtime\x1b\[0m/);
  assert.match(colored, /1\) Docker/);
  assert.equal(useColor({ isTTY: true, NO_COLOR: '1' }), false);
  assert.equal(useColor({ isTTY: false }), false);
  assert.equal(useColor({ isTTY: true }), true);
});

test('status colors remain optional and preserve the original text', () => {
  assert.equal(colorize('Ready', 'success', false), 'Ready');
  assert.equal(colorize('Ready', 'success', true), '\x1b[32mReady\x1b[0m');
  assert.equal(colorize('Check Docker', 'warning', true), '\x1b[33mCheck Docker\x1b[0m');
  assert.equal(colorize('Failed', 'error', true), '\x1b[31mFailed\x1b[0m');
});

test('user-provided terminal text cannot inject control sequences', () => {
  assert.equal(safeText('owner\x1b[31m@example.org\nnext'), 'owner[31m@example.org next');
  assert.equal(safeText('normal path'), 'normal path');
});

test('menu choices accept only displayed numbers and support a default', () => {
  assert.equal(parseMenuChoice('2', ['docker', 'native'], 'docker'), 'native');
  assert.equal(parseMenuChoice('', ['docker', 'native'], 'docker'), 'docker');
  assert.throws(() => parseMenuChoice('native', ['docker', 'native'], 'docker'), /number from 1 to 2/);
  assert.throws(() => parseMenuChoice('9', ['docker', 'native']), /number from 1 to 2/);
});

test('validated prompts explain invalid input and retry until it is valid', async () => {
  const answers = ['bad', 'owner@example.org'];
  const messages = [];
  const answer = await promptUntil(
    async () => answers.shift(),
    value => { if (!value.includes('@')) throw new Error('Enter a valid email address.'); return value; },
    message => messages.push(message),
  );
  assert.equal(answer, 'owner@example.org');
  assert.deepEqual(messages, ['Enter a valid email address.']);
});
