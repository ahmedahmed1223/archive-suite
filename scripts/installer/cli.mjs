#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeHost } from './io.mjs';
import { install, manage, readState } from './manager.mjs';

const kit = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const options = {};
let command;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--yes' || arg === '--json') options[arg.slice(2)] = true;
  else if (arg.startsWith('--')) {
    const [key, inline] = arg.slice(2).split('=');
    if (!['root', 'mode', 'source', 'email', 'port'].includes(key)) throw new Error('خيار غير معروف. استخدم help.');
    options[key] = inline ?? argv[++i];
  } else if (!command) command = arg;
  else throw new Error('وسائط إضافية غير متوقعة.');
}
let root = resolve(options.root || join(process.cwd(), 'archive-suite'));
const version = JSON.parse(readFileSync(join(kit, 'package.json'), 'utf8')).version;
let muted = false;
const output = new Writable({ write(chunk, encoding, next) { if (!muted) process.stdout.write(chunk, encoding); next(); } });
output.isTTY = process.stdout.isTTY;
output.columns = process.stdout.columns;
let ui;
async function ask(text, fallback = '', secret = false) {
  if (!ui) ui = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
  if (secret) { process.stdout.write(`${text}: `); muted = true; }
  try { return (await ui.question(secret ? '' : `${text}${fallback ? ` [${fallback}]` : ''}: `)).trim() || fallback; }
  finally { if (secret) { muted = false; process.stdout.write('\n'); } }
}
function showHost(host) {
  if (options.json) { console.log(JSON.stringify(host)); return; }
  console.log(`النظام: ${host.platform} ${host.arch} | الذاكرة: ${(host.memory / 1024 ** 3).toFixed(1)} GiB | المساحة: ${(host.free / 1024 ** 3).toFixed(1)} GiB`);
  console.log(`Docker: ${host.docker ? 'جاهز' : 'غير جاهز: ثبّت Docker Compose وشغّل Linux containers'} | Native: ${host.native ? 'جاهز' : 'يلزم حساب مسؤول ومدير خدمات مناسب'}`);
  for (const error of host.errors) console.log(error);
  console.log(`الخيار المقترح: ${host.recommended || 'لا يوجد خيار جاهز بعد'}`);
}
async function main() {
  if (!command && !process.stdin.isTTY) command = 'help';
  if (command === 'help') {
    console.log('Archive Suite — أداة التثبيت والإدارة\nالأوامر: doctor | install | status | start | stop | restart | logs | health | repair | backup\n--root مسار التثبيت، --mode docker|native|offline، --source مجلد أصول الإصدار، --email بريد المدير، --port المنفذ، --yes لتأكيد التثبيت غير التفاعلي.\nكلمة مرور التثبيت غير التفاعلي من ARCHIVE_INSTALLER_PASSWORD. لا تمررها كوسيط أمر.');
    return;
  }
  if (command === 'doctor') { showHost(probeHost(root)); return; }
  if (!command) {
    if (existsSync(join(root, 'installation.json'))) {
      const state = readState(root);
      console.log(`التثبيت: ${state.version} / ${state.mode} / ${state.phase}\nstatus عرض الحالة | start تشغيل | stop إيقاف | restart إعادة تشغيل | logs السجلات | health فحص | repair إصلاح | backup نسخة احتياطية | q خروج`);
      command = await ask('الأمر', 'status');
      if (command === 'q') return;
    } else command = 'install';
  }
  if (command !== 'install') {
    const state = manage(root, command);
    console.log(`اكتمل الأمر ${command}. رابط التطبيق: http://localhost:${state.port}`);
    return;
  }
  const interactive = Boolean(process.stdin.isTTY) && !options.yes;
  if (!interactive && !options.yes) throw new Error('التثبيت غير التفاعلي يتطلب --yes بعد مراجعة doctor.');
  if (interactive && !options.root) root = resolve(await ask('مجلد التثبيت', root));
  const host = probeHost(root);
  showHost(host);
  const detected = readdirSync(process.cwd()).some(name => name.startsWith(`archive-suite-offline-v${version}.tar.gz`));
  const defaultMode = host.docker && detected ? 'offline' : host.recommended;
  const mode = options.mode || (interactive ? await ask('طريقة التشغيل: docker أو native أو offline', defaultMode || '') : defaultMode);
  const source = options.source || (mode === 'offline' && interactive ? await ask('مجلد أجزاء Offline وملفات SHA256', process.cwd()) : undefined);
  const email = options.email || (interactive ? await ask('البريد الإلكتروني للمدير') : '');
  const password = process.env.ARCHIVE_INSTALLER_PASSWORD || (interactive ? await ask('كلمة مرور المدير (12 حرفًا على الأقل)', '', true) : '');
  const port = Number(options.port || (mode !== 'native' && interactive ? await ask('منفذ التطبيق', '3000') : 3000));
  console.log(`الإصدار: ${version}\nالمسار: ${root}\nطريقة التشغيل: ${mode}\nالمدير: ${email}\nNative يستخدم المنفذ 8443؛ Docker يستخدم المنفذ المختار والمنفذ التالي للاتصال اللحظي.`);
  const confirmed = options.yes || ['نعم', 'yes', 'y'].includes((await ask('هل تبدأ التثبيت؟ اكتب نعم')).toLowerCase());
  if (!confirmed) { console.log('أُلغي التثبيت دون تغيير النظام.'); return; }
  const state = await install({ root, mode, source: source ? resolve(source) : undefined, email, password, port, version }, { kit, confirmed });
  console.log(`اكتمل التثبيت. افتح http://localhost:${state.port}\nلإدارة التثبيت لاحقًا شغّل الأداة مع --root ${root}`);
}
try { await main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
finally { ui?.close(); }
