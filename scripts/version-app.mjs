import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const version = process.argv[2];

if (!version || !VERSION_PATTERN.test(version)) {
  console.error('Usage: pnpm version:app X.Y.Z');
  console.error('Version must be valid SemVer, for example: 1.2.3');
  process.exit(1);
}

const jsonFiles = [
  'apps/desktop/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/mobile/package.json',
  'apps/mobile/src-tauri/tauri.conf.json',
];

const cargoFiles = [
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/mobile/src-tauri/Cargo.toml',
];

const cargoLockPackages = new Set(['taurent', 'taurent-mobile']);

function replaceVersion(file, pattern, replacement) {
  const contents = readFileSync(file, 'utf8');
  if (!pattern.test(contents)) {
    console.error(`Could not find version in ${file}`);
    process.exit(1);
  }

  const next = contents.replace(pattern, replacement);
  writeFileSync(file, next);
}

function replaceCargoLockPackageVersions() {
  const file = 'Cargo.lock';
  const contents = readFileSync(file, 'utf8');
  const seenPackages = new Set();

  const next = contents
    .split(/(?=^\[\[package\]\]$)/m)
    .map((block) => {
      const packageName = block.match(/^name\s*=\s*"([^"\n]+)"$/m)?.[1] ?? '';
      if (!cargoLockPackages.has(packageName)) {
        return block;
      }

      const versionPattern = /^version\s*=\s*"[^"\n]+"/m;
      if (!versionPattern.test(block)) {
        console.error(`Could not find Cargo.lock version for package ${packageName}`);
        process.exit(1);
      }

      seenPackages.add(packageName);
      return block.replace(versionPattern, `version = "${version}"`);
    })
    .join('');

  writeFileSync(file, next);

  for (const packageName of cargoLockPackages) {
    if (!seenPackages.has(packageName)) {
      console.warn(`Cargo.lock does not contain package ${packageName}; skipped lockfile version update.`);
    }
  }
}

for (const file of jsonFiles) {
  replaceVersion(file, /"version"\s*:\s*"[^"\n]+"/, `"version": "${version}"`);
}

for (const file of cargoFiles) {
  replaceVersion(file, /^version\s*=\s*["'][^"'\n]+["']/m, `version = "${version}"`);
}

replaceCargoLockPackageVersions();

console.log(`Updated Taurent app version to ${version}`);
