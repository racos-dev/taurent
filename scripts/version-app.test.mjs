import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const scriptPath = resolve(repoRoot, 'scripts/version-app.mjs');

function createFixture({ includeCargoLockAppPackages = true } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'taurent-version-app-'));
  const cargoLock = includeCargoLockAppPackages
    ? [
        '[[package]]',
        'name = "taurent"',
        'version = "1.0.0"',
        '',
        '[[package]]',
        'name = "taurent-mobile"',
        'version = "1.0.0"',
        '',
        '[[package]]',
        'name = "unrelated"',
        'version = "1.0.0"',
        '',
      ].join('\n')
    : [
        '[[package]]',
        'name = "unrelated"',
        'version = "1.0.0"',
        '',
      ].join('\n');
  const files = {
    'apps/desktop/package.json': JSON.stringify({ version: '1.0.0' }, null, 2),
    'apps/desktop/src-tauri/tauri.conf.json': JSON.stringify({ version: '1.0.0' }, null, 2),
    'apps/desktop/src-tauri/Cargo.toml': '[package]\nname = "taurent"\nversion = "1.0.0"\n',
    'apps/mobile/package.json': JSON.stringify({ version: '1.0.0' }, null, 2),
    'apps/mobile/src-tauri/tauri.conf.json': JSON.stringify({ version: '1.0.0' }, null, 2),
    'apps/mobile/src-tauri/Cargo.toml': '[package]\nname = "taurent-mobile"\nversion = "1.0.0"\n',
    'Cargo.lock': cargoLock,
  };

  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(resolve(root, dirname(file)), { recursive: true });
    writeFileSync(resolve(root, file), contents);
  }

  return root;
}

test('updates app manifests and Cargo.lock workspace package versions', () => {
  const root = createFixture();
  const result = spawnSync(process.execPath, [scriptPath, '0.9.0-beta.3'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(resolve(root, 'apps/desktop/package.json'), 'utf8')).version, '0.9.0-beta.3');
  assert.equal(
    JSON.parse(readFileSync(resolve(root, 'apps/mobile/src-tauri/tauri.conf.json'), 'utf8')).version,
    '0.9.0-beta.3',
  );
  assert.match(
    readFileSync(resolve(root, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8'),
    /version = "0\.9\.0-beta\.3"/,
  );
  assert.match(
    readFileSync(resolve(root, 'Cargo.lock'), 'utf8'),
    /name = "taurent"\nversion = "0\.9\.0-beta\.3"/,
  );
  assert.match(
    readFileSync(resolve(root, 'Cargo.lock'), 'utf8'),
    /name = "taurent-mobile"\nversion = "0\.9\.0-beta\.3"/,
  );
  assert.match(readFileSync(resolve(root, 'Cargo.lock'), 'utf8'), /name = "unrelated"\nversion = "1\.0\.0"/);
});

test('allows Cargo.lock files without app package entries', () => {
  const root = createFixture({ includeCargoLockAppPackages: false });
  const result = spawnSync(process.execPath, [scriptPath, '0.9.0-beta.3'], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Cargo\.lock does not contain package taurent/);
  assert.match(result.stderr, /Cargo\.lock does not contain package taurent-mobile/);
  assert.equal(JSON.parse(readFileSync(resolve(root, 'apps/desktop/package.json'), 'utf8')).version, '0.9.0-beta.3');
  assert.match(
    readFileSync(resolve(root, 'apps/mobile/src-tauri/Cargo.toml'), 'utf8'),
    /version = "0\.9\.0-beta\.3"/,
  );
  assert.match(readFileSync(resolve(root, 'Cargo.lock'), 'utf8'), /name = "unrelated"\nversion = "1\.0\.0"/);
});

test('rejects invalid versions', () => {
  const result = spawnSync(process.execPath, [scriptPath, 'v0.9.0'], {
    cwd: createFixture(),
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Version must be valid SemVer/);
});
