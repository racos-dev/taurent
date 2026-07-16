import { chmodSync, copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const APP_ID = 'com.taurent.desktop';
const RUNTIME = 'org.gnome.Platform';
const SDK = 'org.gnome.Sdk';
const RUNTIME_VERSION = process.env.FLATPAK_RUNTIME_VERSION ?? '50';

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
}

function installFile(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function writeTextFile(target, contents) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function requireFile(path, label) {
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`${label} does not exist: ${path}`);
  }
}

export function buildFlatpakBundle({
  rootDir = process.cwd(),
  binaryPath = process.env.TAURENT_FLATPAK_BINARY ?? 'target/release/taurent',
  outputDir = process.env.TAURENT_FLATPAK_OUTPUT_DIR ?? 'artifacts/release/flatpak',
  releaseTag = process.env.RELEASE_TAG ?? 'dev',
} = {}) {
  const root = resolve(rootDir);
  const binary = resolve(root, binaryPath);
  const outDir = resolve(root, outputDir);
  const buildDir = resolve(root, 'artifacts/flatpak/build-dir');
  const repoDir = resolve(root, 'artifacts/flatpak/repo');
  const bundlePath = join(outDir, `Taurent-${releaseTag}-linux-x64.flatpak`);

  requireFile(binary, 'Taurent release binary');

  rmSync(buildDir, { recursive: true, force: true });
  rmSync(repoDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  run('flatpak', [
    'remote-add',
    '--user',
    '--if-not-exists',
    'flathub',
    'https://flathub.org/repo/flathub.flatpakrepo',
  ]);
  run('flatpak', ['install', '--user', '-y', 'flathub', `${RUNTIME}//${RUNTIME_VERSION}`, `${SDK}//${RUNTIME_VERSION}`]);
  run('flatpak', ['build-init', buildDir, APP_ID, SDK, RUNTIME, RUNTIME_VERSION]);

  installFile(binary, join(buildDir, 'files/bin/taurent'));
  chmodSync(join(buildDir, 'files/bin/taurent'), 0o755);

  installFile(
    resolve(root, 'packaging/flatpak/com.taurent.desktop.desktop'),
    join(buildDir, `files/share/applications/${APP_ID}.desktop`),
  );
  installFile(
    resolve(root, 'packaging/flatpak/com.taurent.desktop.metainfo.xml'),
    join(buildDir, `files/share/metainfo/${APP_ID}.metainfo.xml`),
  );

  const iconRoot = resolve(root, 'apps/desktop/src-tauri/icons');
  for (const size of ['32x32', '64x64', '128x128']) {
    installFile(
      join(iconRoot, `${size}.png`),
      join(buildDir, `files/share/icons/hicolor/${size}/apps/${APP_ID}.png`),
    );
  }

  writeTextFile(
    join(buildDir, 'metadata'),
    [
      '[Application]',
      `name=${APP_ID}`,
      `runtime=${RUNTIME}/x86_64/${RUNTIME_VERSION}`,
      `sdk=${SDK}/x86_64/${RUNTIME_VERSION}`,
      '',
    ].join('\n'),
  );

  run('flatpak', [
    'build-finish',
    '--command=taurent',
    '--share=network',
    '--share=ipc',
    '--socket=wayland',
    '--socket=fallback-x11',
    '--device=dri',
    '--talk-name=org.freedesktop.Notifications',
    '--filesystem=xdg-download:rw',
    buildDir,
  ]);
  run('flatpak', ['build-export', repoDir, buildDir]);
  run('flatpak', ['build-bundle', repoDir, bundlePath, APP_ID]);

  return bundlePath;
}

function main() {
  const bundlePath = buildFlatpakBundle();
  console.log(`Built Flatpak bundle: ${bundlePath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}
