import { readFileSync } from 'node:fs';
import { basename, posix } from 'node:path';

const contract = JSON.parse(readFileSync(new URL('../../infra/platform/compatibility.v1.json', import.meta.url)));
export const REQUIREMENTS = { disk: contract.resources.core.diskBytes, memory: 8 * 1024 ** 3 };
export function assessHost(host) {
  const errors = [];
  if (!['win32', 'linux'].includes(host.platform) || host.arch !== 'x64') errors.push('تدعم هذه الحزمة Windows وLinux بمعمارية x64 فقط.');
  if (!(host.memory >= REQUIREMENTS.memory)) errors.push('الذاكرة المطلوبة 8 GiB على الأقل.');
  if (!(host.free >= REQUIREMENTS.disk)) errors.push('يلزم توفير 100 GiB على الأقل في قرص التثبيت.');
  if (!host.writable) errors.push('مسار التثبيت غير قابل للكتابة؛ اختر مسارًا آخر أو شغّل الأداة بصلاحية مناسبة.');
  const available = errors.length ? [] : [host.docker && 'docker', host.native && 'native'].filter(Boolean);
  return { ...host, errors, available, recommended: available[0] || null };
}
export function parseChecksums(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const match = /^([a-f0-9]{64}) [ *](.+)$/i.exec(line);
    if (!match) throw new Error('Invalid checksum inventory.');
    const name = basename(match[2].replaceAll('\\', '/'));
    if (entries.has(name)) throw new Error('Ambiguous duplicate checksum name.');
    entries.set(name, match[1].toLowerCase());
  }
  if (!entries.size) throw new Error('Empty checksum inventory.');
  return entries;
}
export function selectArtifacts(names, mode, platform, version) {
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version.');
  if (mode === 'native') {
    const name = `archive-suite-v${version}-${platform === 'win32' ? 'windows' : 'linux'}-native.tar.gz`;
    if (!names.includes(name)) throw new Error('Native release asset is missing.');
    return [name];
  }
  const prefix = `archive-suite-offline-v${version}.tar.gz`;
  if (names.includes(prefix)) return [prefix];
  const parts = names.filter(name => name.startsWith(`${prefix}.part-`)).sort();
  if (!parts.length || parts.some((name, i) => name !== `${prefix}.part-${String(i).padStart(2, '0')}`)) throw new Error('Missing or non-contiguous offline parts.');
  return parts;
}
export function validateArchiveListing(names, verbose) {
  for (const path of names.split(/\r?\n/).filter(Boolean)) {
    if (/^[\\/]|^[a-z]:|[\x00-\x1f]/i.test(path) || path.replaceAll('\\', '/').split('/').includes('..')) throw new Error('Unsafe archive entry.');
  }
  // Allow only relative in-tree links. The tar implementation also refuses
  // extracting entries through symlinks; preflight rejects special devices.
  const paths = names.split(/\r?\n/).filter(Boolean);
  const links = new Map();
  for (const [index, line] of verbose.split(/\r?\n/).filter(Boolean).entries()) {
    if (/^[bcps]/.test(line)) throw new Error('Unsafe archive special entry.');
    if (/^[lh]/.test(line)) {
      const target = line.split(/ -> | link to /)[1];
      const resolved = target && posix.normalize(posix.join(line.startsWith('h') ? '.' : posix.dirname(paths[index] || '.'), target.replaceAll('\\', '/')));
      if (!target || /^[\\/]|^[a-z]:/i.test(target) || resolved === '..' || resolved.startsWith('../')) throw new Error('Unsafe archive link.');
      links.set(posix.normalize(paths[index]), { target: target.replaceAll('\\', '/'), hard: line.startsWith('h') });
    }
  }
  // Resolve link chains before extraction, including '..' AFTER following a
  // link. Lexical normalization alone can miss a linked-parent escape.
  for (const [name, link] of links) {
    let stack = [], traversed = 0;
    const queue = (link.hard ? link.target : `${posix.dirname(name)}/${link.target}`).split('/');
    while (queue.length) {
      const item = queue.shift();
      if (!item || item === '.') continue;
      if (item === '..') { if (!stack.length) throw new Error('Unsafe archive link traversal.'); stack.pop(); continue; }
      stack.push(item);
      const next = links.get(stack.join('/'));
      if (next) {
        if (++traversed > 40) throw new Error('Unsafe archive link cycle.');
        stack.pop(); if (next.hard) stack = [];
        queue.unshift(...next.target.split('/'));
      }
    }
  }
  for (const path of paths) {
    let parent = posix.dirname(posix.normalize(path));
    while (parent !== '.') {
      if (links.has(parent)) throw new Error('Unsafe archive entry beneath a link.');
      parent = posix.dirname(parent);
    }
  }
}
export function validateSetup(input) {
  if (!['docker', 'native', 'offline'].includes(input.mode)) throw new Error('اختر docker أو native أو offline.');
  if (!/^[^\s@'"$]+@[^\s@'"$]+\.[^\s@'"$]+$/.test(input.email) || input.email === 'test@example.com') throw new Error('أدخل بريدًا صالحًا للمدير.');
  if (typeof input.password !== 'string' || input.password.length < 12 || /[\r\n\0'"$\\]/.test(input.password) || /CHANGE_ME/i.test(input.password)) throw new Error('كلمة المرور: 12 حرفًا على الأقل، دون أسطر جديدة أو علامات اقتباس أو $ أو \\.');
  if (!Number.isInteger(input.port) || input.port < 1024 || input.port > 65535) throw new Error('اختر منفذًا بين 1024 و65535.');
  return input;
}
