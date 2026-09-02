#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeHost } from './io.mjs';
import { install, manage, readState } from './manager.mjs';
import { validateSetup } from './core.mjs';
import { colorize, parseMenuChoice, promptUntil, renderMenu, safeText, useColor } from './terminal-ui.mjs';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const version = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8')).version;
let muted = false;
let ui;
let colors = false;
const output = new Writable({ write(chunk, encoding, next) { if (!muted) process.stdout.write(chunk, encoding); next(); } });
output.isTTY = process.stdout.isTTY;
output.columns = process.stdout.columns;

function parseArguments(argv) {
  const options = {};
  let command;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes' || arg === '--json') options[arg.slice(2)] = true;
    else if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      if (!['root', 'mode', 'source', 'email', 'port'].includes(key)) throw new Error('Unknown option. Use help.');
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`Option --${key} requires a value.`);
      options[key] = value;
    } else if (!command) command = arg;
    else throw new Error('Unexpected extra argument. Use help.');
  }
  return { options, command };
}

async function ask(text, fallback = '', secret = false) {
  if (!ui) ui = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  if (secret) { process.stdout.write(`${text}: `); muted = true; }
  try { return (await ui.question(secret ? '' : `${text}${fallback ? ` [${fallback}]` : ''}: `)).trim() || fallback; }
  finally { if (secret) { muted = false; process.stdout.write('\n'); } }
}

function reportInputError(message) { console.error(colorize(`! ${message}`, 'error', colors)); }

async function choose(title, entries, fallback) {
  console.log(renderMenu(title, entries.map(entry => entry.label), { color: colors }));
  const fallbackIndex = Math.max(0, entries.findIndex(entry => entry.value === fallback));
  return promptUntil(
    () => ask('Selection', String(fallbackIndex + 1)),
    answer => parseMenuChoice(answer, entries.map(entry => entry.value), fallback),
    reportInputError,
  );
}

function validateField(field, value) {
  const setup = { mode: 'docker', email: 'owner@example.org', password: 'A-secure-password-123', port: 3000, [field]: value };
  validateSetup(setup);
  return value;
}

async function validatedAsk(label, field, fallback = '', secret = false, transform = value => value) {
  return promptUntil(() => ask(label, fallback, secret), answer => validateField(field, transform(answer)), reportInputError);
}

function showHost(host, json = false) {
  if (json) { console.log(JSON.stringify(host)); return; }
  console.log(colorize('Environment check', 'info', colors));
  console.log(`System: ${host.platform} ${host.arch} | Memory: ${(host.memory / 1024 ** 3).toFixed(1)} GiB | Free disk: ${(host.free / 1024 ** 3).toFixed(1)} GiB`);
  console.log(`Docker: ${colorize(host.docker ? 'Ready' : 'Not ready - install Docker Compose and enable Linux containers', host.docker ? 'success' : 'warning', colors)}`);
  console.log(`Native: ${colorize(host.native ? 'Ready' : 'Not ready - administrator privileges and a supported service manager are required', host.native ? 'success' : 'warning', colors)}`);
  for (const error of host.errors) console.log(colorize(`! ${error}`, 'error', colors));
  console.log(`Recommended runtime: ${host.recommended || 'None is ready yet'}`);
}

async function main() {
  const { options, command: initialCommand } = parseArguments(process.argv.slice(2));
  let command = initialCommand;
  let root = resolve(options.root || join(process.cwd(), 'archive-suite'));
  colors = useColor({ isTTY: process.stdout.isTTY, NO_COLOR: process.env.NO_COLOR });
  if (!command && !process.stdin.isTTY) command = 'help';
  if (command === 'help') {
    console.log('Archive Suite Installer and Manager\nCommands: doctor | install | status | start | stop | restart | logs | health | repair | backup\n--root installation path, --mode docker|native|offline, --source release assets folder, --email administrator email, --port application port, --yes confirm unattended installation.\nFor unattended installation, provide the password through ARCHIVE_INSTALLER_PASSWORD. Never pass it as a command-line argument.');
    return;
  }
  if (command === 'doctor') { showHost(probeHost(root), options.json); return; }
  if (!command) {
    if (existsSync(join(root, 'installation.json'))) {
      const state = readState(root);
      console.log(colorize(`Installation ${state.version} - ${state.mode} - ${state.phase}`, 'info', colors));
      command = await choose('Choose an action', [
        ['status', 'Show status'], ['start', 'Start'], ['stop', 'Stop'], ['restart', 'Restart'], ['logs', 'Show logs'],
        ['health', 'Run health check'], ['repair', 'Repair'], ['backup', 'Create backup'], ['q', 'Exit'],
      ].map(([value, label]) => ({ value, label })), 'status');
      if (command === 'q') return;
    } else command = 'install';
  }
  if (command !== 'install') {
    const state = manage(root, command);
    console.log(colorize(`Command '${command}' completed.`, 'success', colors));
    console.log(`Application URL: http://localhost:${state.port}`);
    return;
  }
  const interactive = Boolean(process.stdin.isTTY) && !options.yes;
  if (!interactive && !options.yes) throw new Error('Unattended installation requires --yes after reviewing the doctor report.');
  if (interactive && !options.root) root = resolve(await ask('Installation directory', root));
  const host = probeHost(root);
  showHost(host);
  const detected = readdirSync(process.cwd()).some(name => name.startsWith(`archive-suite-offline-v${version}.tar.gz`));
  const defaultMode = host.docker && detected ? 'offline' : host.recommended;
  const mode = options.mode || (interactive ? await choose('Choose a runtime', [
    { value: 'docker', label: 'Docker - online images' },
    { value: 'native', label: 'Native - local system services' },
    { value: 'offline', label: 'Docker - offline release bundle' },
  ], defaultMode || 'docker') : defaultMode);
  validateField('mode', mode);
  const source = options.source || (mode === 'offline' && interactive ? await ask('Folder containing Offline parts and checksum files', process.cwd()) : undefined);
  const email = options.email || (interactive ? await validatedAsk('Administrator email', 'email') : '');
  const password = process.env.ARCHIVE_INSTALLER_PASSWORD || (interactive ? await validatedAsk('Administrator password (at least 12 characters)', 'password', '', true) : '');
  const port = Number(options.port || (mode !== 'native' && interactive ? await validatedAsk('Application port', 'port', '3000', false, Number) : 3000));
  validateSetup({ mode, email, password, port });
  console.log(colorize('Installation summary', 'info', colors));
  console.log(`Version: ${version}\nDirectory: ${safeText(root)}\nRuntime: ${mode}\nAdministrator: ${safeText(email)}`);
  console.log('Native uses port 8443. Docker uses the selected port and the next port for realtime connections.');
  const confirmed = options.yes || await choose('Start the installation?', [
    { value: true, label: 'Yes, install now' }, { value: false, label: 'No, cancel' },
  ], false);
  if (!confirmed) { console.log(colorize('Installation canceled. No system changes were made.', 'warning', colors)); return; }
  const state = await install({ root, mode, source: source ? resolve(source) : undefined, email, password, port, version }, { kit, confirmed });
  console.log(colorize('Installation completed.', 'success', colors));
  console.log(`Open http://localhost:${state.port}\nTo manage it later, run this tool with --root ${safeText(root)}`);
}

try { await main(); }
catch (error) { console.error(colorize(safeText(error.message), 'error', colors)); process.exitCode = 1; }
finally { ui?.close(); }
