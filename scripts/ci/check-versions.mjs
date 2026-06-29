import { readFileSync } from 'node:fs';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readCargoVersion(path) {
  const cargoToml = readFileSync(path, 'utf8');
  return cargoToml.match(/^version\s*=\s*["']([^"'\n]+)["']/m)?.[1] ?? '';
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function assertMatchingVersions(target, targetVersions) {
  console.log(`${target[0].toUpperCase()}${target.slice(1)} version sources:`);
  for (const [file, version] of Object.entries(targetVersions)) {
    console.log(`  ${file}: ${version || '<missing>'}`);
  }

  const uniqueVersions = new Set(Object.values(targetVersions));
  if (uniqueVersions.size !== 1 || uniqueVersions.has('')) {
    fail(`${target} version sources do not match.`);
  }

  const [version] = uniqueVersions;
  if (!SEMVER_PATTERN.test(version)) {
    fail(`${target} version must be SemVer. Got: ${version}`);
  }

  console.log(`All ${target} versions match: ${version}`);
  return version;
}

function resolveReleaseTag() {
  const candidates = [
    process.env.RELEASE_TAG,
    process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '',
    process.env.GITHUB_REF?.startsWith('refs/tags/') ? process.env.GITHUB_REF.slice('refs/tags/'.length) : '',
  ];

  return candidates.find(Boolean) ?? '';
}

const versions = {
  desktop: {
    'apps/desktop/package.json': JSON.parse(readFileSync('apps/desktop/package.json', 'utf8')).version,
    'apps/desktop/src-tauri/tauri.conf.json': JSON.parse(readFileSync('apps/desktop/src-tauri/tauri.conf.json', 'utf8')).version,
    'apps/desktop/src-tauri/Cargo.toml': readCargoVersion('apps/desktop/src-tauri/Cargo.toml'),
  },
  mobile: {
    'apps/mobile/package.json': JSON.parse(readFileSync('apps/mobile/package.json', 'utf8')).version,
    'apps/mobile/src-tauri/tauri.conf.json': JSON.parse(readFileSync('apps/mobile/src-tauri/tauri.conf.json', 'utf8')).version,
    'apps/mobile/src-tauri/Cargo.toml': readCargoVersion('apps/mobile/src-tauri/Cargo.toml'),
  },
};

const appVersions = Object.fromEntries(
  Object.entries(versions).map(([target, targetVersions]) => [
    target,
    assertMatchingVersions(target, targetVersions),
  ]),
);

if (appVersions.desktop !== appVersions.mobile) {
  fail(`desktop and mobile versions do not match: ${appVersions.desktop} !== ${appVersions.mobile}`);
}

console.log(`Desktop and mobile app versions match: ${appVersions.desktop}`);

const releaseTag = resolveReleaseTag();
if (releaseTag) {
  if (!releaseTag.startsWith('v')) {
    fail(`release tag must start with "v". Got: ${releaseTag}`);
  }

  const tagVersion = releaseTag.slice(1);
  if (tagVersion !== appVersions.desktop) {
    fail(`release tag ${releaseTag} does not match app version ${appVersions.desktop}`);
  }

  console.log(`Release tag matches app version: ${releaseTag}`);
}
