import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareReleaseAssets } from './prepare-release-assets.mjs';

function createFixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'taurent-release-assets-'));
  const sourceDir = join(root, 'release-assets');
  const outputDir = join(root, 'release-upload');

  for (const file of files) {
    const path = join(sourceDir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file);
  }

  return { sourceDir, outputDir };
}

const completeAssetSet = [
  'taurent-macos-apple-silicon/Taurent_1.0.0_aarch64.dmg',
  'taurent-macos-apple-silicon/Taurent.app.tar.gz',
  'taurent-macos-apple-silicon/Taurent.app.tar.gz.sig',
  'taurent-macos-intel/Taurent_1.0.0_x64.dmg',
  'taurent-macos-intel/Taurent.app.tar.gz',
  'taurent-macos-intel/Taurent.app.tar.gz.sig',
  'taurent-windows/Taurent_1.0.0_x64-setup.exe',
  'taurent-windows/Taurent_1.0.0_x64-setup.exe.sig',
  'taurent-windows/taurent.exe',
  'taurent-windows/Taurent_1.0.0_x64_en-US.msi',
  'taurent-linux/Taurent_1.0.0_amd64.AppImage',
  'taurent-linux/Taurent_1.0.0_amd64.AppImage.sig',
  'taurent-linux/Taurent_1.0.0_amd64.AppImage.tar.gz',
  'taurent-linux/Taurent_1.0.0_amd64.AppImage.tar.gz.sig',
  'taurent-linux/Taurent_1.0.0_amd64.deb',
  'taurent-linux/Taurent-1.0.0-1.x86_64.rpm',
  'taurent-android-unsigned-release-apk/app-universal-release-unsigned.apk',
];

test('copies only public assets with tag-prefixed names', () => {
  const fixture = createFixture(completeAssetSet);
  const result = prepareReleaseAssets({
    ...fixture,
    releaseTag: 'v0.9.0-beta.3',
  });

  assert.deepEqual(result.copied, [
    'latest.json',
    'Taurent-v0.9.0-beta.3-android-universal-unsigned.apk',
    'Taurent-v0.9.0-beta.3-linux-x64.AppImage',
    'Taurent-v0.9.0-beta.3-linux-x64.AppImage.sig',
    'Taurent-v0.9.0-beta.3-linux-x64.AppImage.tar.gz',
    'Taurent-v0.9.0-beta.3-linux-x64.AppImage.tar.gz.sig',
    'Taurent-v0.9.0-beta.3-linux-x64.deb',
    'Taurent-v0.9.0-beta.3-linux-x64.rpm',
    'Taurent-v0.9.0-beta.3-macos-arm64.app.tar.gz',
    'Taurent-v0.9.0-beta.3-macos-arm64.app.tar.gz.sig',
    'Taurent-v0.9.0-beta.3-macos-arm64.dmg',
    'Taurent-v0.9.0-beta.3-macos-x64.app.tar.gz',
    'Taurent-v0.9.0-beta.3-macos-x64.app.tar.gz.sig',
    'Taurent-v0.9.0-beta.3-macos-x64.dmg',
    'Taurent-v0.9.0-beta.3-windows-x64-setup.exe',
    'Taurent-v0.9.0-beta.3-windows-x64-setup.exe.sig',
  ]);

  assert.equal(
    readFileSync(join(fixture.outputDir, 'Taurent-v0.9.0-beta.3-android-universal-unsigned.apk'), 'utf8'),
    'taurent-android-unsigned-release-apk/app-universal-release-unsigned.apk',
  );
  const latestJson = JSON.parse(readFileSync(join(fixture.outputDir, 'latest.json'), 'utf8'));
  assert.equal(latestJson.version, '0.9.0-beta.3');
  assert.equal(
    latestJson.platforms['darwin-aarch64'].url,
    'https://github.com/racos-dev/taurent/releases/download/v0.9.0-beta.3/Taurent-v0.9.0-beta.3-macos-arm64.app.tar.gz',
  );
  assert.equal(
    latestJson.platforms['windows-x86_64'].signature,
    'taurent-windows/Taurent_1.0.0_x64-setup.exe.sig',
  );
  assert.ok(result.skipped.includes('taurent-windows/taurent.exe'));
  assert.ok(result.skipped.includes('taurent-windows/Taurent_1.0.0_x64_en-US.msi'));
});

test('fails when split Android APKs would map to the universal APK name', () => {
  const fixture = createFixture([
    ...completeAssetSet,
    'taurent-android-unsigned-release-apk/app-arm64-v8a-release-unsigned.apk',
  ]);

  assert.throws(
    () => prepareReleaseAssets({ ...fixture, releaseTag: 'v0.9.0-beta.3' }),
    /Multiple files map to Taurent-v0\.9\.0-beta\.3-android-universal-unsigned\.apk/,
  );
});

test('fails when a required public asset is missing', () => {
  const fixture = createFixture(completeAssetSet.filter((file) => !file.endsWith('.rpm')));

  assert.throws(
    () => prepareReleaseAssets({ ...fixture, releaseTag: 'v0.9.0-beta.3' }),
    /Missing required release assets:/,
  );
});

test('fails when required updater signatures are missing', () => {
  const fixture = createFixture(completeAssetSet.filter((file) => !file.endsWith('.sig')));

  assert.throws(
    () => prepareReleaseAssets({ ...fixture, releaseTag: 'v0.9.0-beta.3' }),
    /Taurent-v0\.9\.0-beta\.3-macos-arm64\.app\.tar\.gz\.sig/,
  );
});

test('rejects non-SemVer release tags', () => {
  const fixture = createFixture(completeAssetSet);

  assert.throws(
    () => prepareReleaseAssets({ ...fixture, releaseTag: 'vnext' }),
    /RELEASE_TAG must be v-prefixed SemVer/,
  );
});
