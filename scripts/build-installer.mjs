import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stageNodeRuntime as windowsNode } from './control-center/windows-bundle/stage-node.mjs';
import { stageNodeRuntime as linuxNode } from './control-center/linux-bundle/stage-node.mjs';
import { run, checksum } from './installer/io.mjs';
import { loadReleaseDescriptor } from './control-center/release-descriptor.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function releaseDescriptor(manifest) {
  const version = manifest.version.replace(/^v/, '');
  return { schemaVersion: '1.0', version, images: manifest.images.map(image => {
    let online = image.source;
    const [base, digest] = online.split('@');
    if (!base.split('/').at(-1).includes(':')) online = `${base}:${version}@${digest}`;
    return { id: image.id, service: image.id, profile: 'core', online, offlineRef: image.bundleRef.replace(/:[^:]+$/, ':$VERSION') };
  }) };
}
export async function buildInstaller({ platform, out, manifestPath, stageNode, archive = true }) {
  if (!['windows', 'linux'].includes(platform)) throw new Error('Expected windows or linux.');
  if (existsSync(out)) throw new Error('Installer output already exists.');
  mkdirSync(out, { recursive: true });
  for (const directory of ['scripts', 'infra/platform']) cpSync(join(ROOT, directory), join(out, directory), { recursive: true, filter: path => !path.endsWith('.test.mjs') });
  for (const file of ['package.json', 'infra/.env.example', 'infra/docker-compose.yml', 'infra/docker-compose.release.yml', 'infra/offline/verify-bundle.mjs', 'infra/deploy/Caddyfile']) {
    mkdirSync(dirname(join(out, file)), { recursive: true }); cpSync(join(ROOT, file), join(out, file));
  }
  mkdirSync(join(out, 'infra/setup'), { recursive: true });
  if (manifestPath) {
    const descriptor = releaseDescriptor(JSON.parse(readFileSync(manifestPath, 'utf8')));
    if (descriptor.version !== JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')).version) throw new Error('Installer and image release versions differ.');
    writeFileSync(join(out, 'infra/platform/release.v1.json'), JSON.stringify(descriptor, null, 2));
    loadReleaseDescriptor(join(out, 'infra/platform/release.v1.json'));
  } else if (archive) throw new Error('Published installers require a verified release manifest.');
  const nodeDir = join(out, 'runtime/node');
  if (stageNode) await stageNode({ destDir: nodeDir });
  else if (platform === 'windows') await windowsNode({ destDir: nodeDir, extract: async (bytes, dest) => {
    mkdirSync(dest, { recursive: true });
    const zip = join(out, 'node-runtime.zip'); writeFileSync(zip, bytes);
    // CI builds both installer archives on Ubuntu after image verification.
    if (process.platform === 'win32') run('tar', ['-xf', zip, '-C', dest]);
    else run('unzip', ['-q', zip, '-d', dest]);
    const { unlinkSync } = await import('node:fs'); unlinkSync(zip);
  } });
  else await linuxNode({ destDir: nodeDir });
  writeFileSync(join(out, 'Archive-Suite-Installer.bat'), '@echo off\r\n"%~dp0runtime\\node\\node.exe" "%~dp0scripts\\installer\\cli.mjs" %*\r\nexit /b %ERRORLEVEL%\r\n');
  writeFileSync(join(out, 'Archive-Suite-Installer.ps1'), '$ErrorActionPreference = "Stop"\r\n& (Join-Path $PSScriptRoot "runtime/node/node.exe") (Join-Path $PSScriptRoot "scripts/installer/cli.mjs") @args\r\nexit $LASTEXITCODE\r\n');
  const launcher = join(out, 'archive-suite-installer');
  writeFileSync(launcher, '#!/bin/sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$ROOT/runtime/node/bin/node" "$ROOT/scripts/installer/cli.mjs" "$@"\n');
  chmodSync(launcher, 0o755);
  cpSync(join(ROOT, 'docs/installer-manager.md'), join(out, 'README.md'));
  cpSync(join(ROOT, 'docs/installer-manager.ar.md'), join(out, 'README.ar.md'));
  const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
  const { relative } = await import('node:path');
  const inventory = [];
  for (const file of files(out).sort()) inventory.push(`${await checksum(file)}  ${relative(out, file).replaceAll('\\', '/')}`);
  writeFileSync(join(out, 'SHA256SUMS'), inventory.join('\n') + '\n');
  const asset = join(dirname(out), platform === 'windows' ? 'Archive-Suite-Installer-Windows.zip' : 'archive-suite-installer-linux.tar.gz');
  if (archive) {
    if (platform === 'windows') run('zip', ['-q', '-r', resolve(asset), '.'], { cwd: out });
    else run('tar', ['-czf', resolve(asset), '-C', out, '.']);
  }
  return { out, asset };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [platform, out, manifestPath] = process.argv.slice(2);
  await buildInstaller({ platform, out: resolve(out), manifestPath: manifestPath === '--smoke' ? undefined : resolve(manifestPath), archive: manifestPath !== '--smoke' });
}
