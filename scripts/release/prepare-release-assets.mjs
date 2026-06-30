import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const REQUIRED_SUFFIXES = new Set([
  'macos-arm64.dmg',
  'macos-arm64.app.tar.gz',
  'macos-arm64.app.tar.gz.sig',
  'macos-x64.dmg',
  'macos-x64.app.tar.gz',
  'macos-x64.app.tar.gz.sig',
  'windows-x64-setup.exe',
  'windows-x64-setup.exe.sig',
  'linux-x64.AppImage',
  'linux-x64.AppImage.sig',
  'linux-x64.deb',
  'linux-x64.rpm',
  'android-universal-unsigned.apk',
]);

function findFiles(root) {
  const files = [];
  const entries = readdirSync(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function firstPathSegment(path) {
  return path.split(sep)[0] ?? '';
}

function classifyAsset(sourceDir, file, releaseTag) {
  const relativePath = relative(sourceDir, file);
  const artifact = firstPathSegment(relativePath);
  const fileName = basename(file);
  const lowerName = fileName.toLowerCase();

  if (artifact === 'taurent-macos-apple-silicon') {
    if (lowerName.endsWith('.dmg')) {
      return `Taurent-${releaseTag}-macos-arm64.dmg`;
    }

    if (lowerName.endsWith('.app.tar.gz.sig')) {
      return `Taurent-${releaseTag}-macos-arm64.app.tar.gz.sig`;
    }

    if (lowerName.endsWith('.app.tar.gz')) {
      return `Taurent-${releaseTag}-macos-arm64.app.tar.gz`;
    }
  }

  if (artifact === 'taurent-macos-intel') {
    if (lowerName.endsWith('.dmg')) {
      return `Taurent-${releaseTag}-macos-x64.dmg`;
    }

    if (lowerName.endsWith('.app.tar.gz.sig')) {
      return `Taurent-${releaseTag}-macos-x64.app.tar.gz.sig`;
    }

    if (lowerName.endsWith('.app.tar.gz')) {
      return `Taurent-${releaseTag}-macos-x64.app.tar.gz`;
    }
  }

  if (artifact === 'taurent-windows' && lowerName.endsWith('.exe') && lowerName.includes('setup')) {
    return `Taurent-${releaseTag}-windows-x64-setup.exe`;
  }

  if (artifact === 'taurent-windows' && lowerName.endsWith('.exe.sig') && lowerName.includes('setup')) {
    return `Taurent-${releaseTag}-windows-x64-setup.exe.sig`;
  }

  if (artifact === 'taurent-linux') {
    if (fileName.endsWith('.AppImage')) {
      return `Taurent-${releaseTag}-linux-x64.AppImage`;
    }

    if (fileName.endsWith('.AppImage.sig')) {
      return `Taurent-${releaseTag}-linux-x64.AppImage.sig`;
    }

    if (fileName.endsWith('.AppImage.tar.gz.sig')) {
      return `Taurent-${releaseTag}-linux-x64.AppImage.tar.gz.sig`;
    }

    if (fileName.endsWith('.AppImage.tar.gz')) {
      return `Taurent-${releaseTag}-linux-x64.AppImage.tar.gz`;
    }

    if (lowerName.endsWith('.deb')) {
      return `Taurent-${releaseTag}-linux-x64.deb`;
    }

    if (lowerName.endsWith('.rpm')) {
      return `Taurent-${releaseTag}-linux-x64.rpm`;
    }
  }

  if (artifact.startsWith('taurent-android') && lowerName.endsWith('.apk')) {
    return `Taurent-${releaseTag}-android-universal-unsigned.apk`;
  }

  return '';
}

function updaterPlatform({ targetName, signatureName }) {
  return {
    signature: readFileSync(signatureName, 'utf8').trim(),
    url: `https://github.com/racos-dev/taurent/releases/download/${targetName.releaseTag}/${targetName.asset}`,
  };
}

function buildUpdaterManifest(selected, releaseTag) {
  const signaturePath = (suffix) => selected.get(`Taurent-${releaseTag}-${suffix}.sig`);
  const target = (asset) => ({ releaseTag, asset: `Taurent-${releaseTag}-${asset}` });

  return {
    version: releaseTag.slice(1),
    pub_date: new Date().toISOString(),
    platforms: {
      'darwin-aarch64': updaterPlatform({
        targetName: target('macos-arm64.app.tar.gz'),
        signatureName: signaturePath('macos-arm64.app.tar.gz'),
      }),
      'darwin-x86_64': updaterPlatform({
        targetName: target('macos-x64.app.tar.gz'),
        signatureName: signaturePath('macos-x64.app.tar.gz'),
      }),
      'linux-x86_64': updaterPlatform({
        targetName: target('linux-x64.AppImage'),
        signatureName: signaturePath('linux-x64.AppImage'),
      }),
      'windows-x86_64': updaterPlatform({
        targetName: target('windows-x64-setup.exe'),
        signatureName: signaturePath('windows-x64-setup.exe'),
      }),
    },
    notes: `Taurent ${releaseTag.slice(1)} release.`,
  };
}

export function prepareReleaseAssets({
  sourceDir,
  outputDir,
  releaseTag,
} = {}) {
  if (!releaseTag || !RELEASE_TAG_PATTERN.test(releaseTag)) {
    throw new Error(`RELEASE_TAG must be v-prefixed SemVer. Got: ${releaseTag || '<missing>'}`);
  }

  if (!sourceDir || !statSync(sourceDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Release asset source directory does not exist: ${sourceDir || '<missing>'}`);
  }

  if (!outputDir) {
    throw new Error('Release upload directory is required.');
  }

  const selected = new Map();
  const skipped = [];

  for (const file of findFiles(sourceDir)) {
    const targetName = classifyAsset(sourceDir, file, releaseTag);
    if (!targetName) {
      skipped.push(relative(sourceDir, file));
      continue;
    }

    const existing = selected.get(targetName);
    if (existing) {
      throw new Error(
        `Multiple files map to ${targetName}: ${relative(sourceDir, existing)} and ${relative(sourceDir, file)}`,
      );
    }

    selected.set(targetName, file);
  }

  const missing = [...REQUIRED_SUFFIXES]
    .map((suffix) => `Taurent-${releaseTag}-${suffix}`)
    .filter((targetName) => !selected.has(targetName));

  if (missing.length > 0) {
    throw new Error(`Missing required release assets:\n${missing.map((name) => `  - ${name}`).join('\n')}`);
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const copied = [];
  for (const [targetName, source] of [...selected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = join(outputDir, targetName);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied.push(targetName);
  }

  const latestJson = buildUpdaterManifest(selected, releaseTag);
  writeFileSync(join(outputDir, 'latest.json'), `${JSON.stringify(latestJson, null, 2)}\n`);
  copied.push('latest.json');
  copied.sort((a, b) => a.localeCompare(b));

  return { copied, skipped };
}

function main() {
  const releaseTag = process.env.RELEASE_TAG;
  const sourceDir = process.env.RELEASE_ASSETS_DIR ?? process.argv[2] ?? 'release-assets';
  const outputDir = process.env.RELEASE_UPLOAD_DIR ?? process.argv[3] ?? 'release-upload';
  const result = prepareReleaseAssets({ sourceDir, outputDir, releaseTag });

  console.log('Prepared release assets:');
  for (const asset of result.copied) {
    console.log(`  ${asset}`);
  }

  if (result.skipped.length > 0) {
    console.log('Skipped non-public release artifacts:');
    for (const asset of result.skipped.sort()) {
      console.log(`  ${asset}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}
