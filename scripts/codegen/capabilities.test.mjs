import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAddedInMap,
  buildRemovedInMap,
  buildResolverTestTable,
  check,
  collectCapabilities,
  compareSemver,
  generateAppCapabilitiesTs,
  generateRust,
  generateServerCapabilitiesTs,
  normalizeSemver,
  parseSemver,
  parseToml,
  snakeToCamel,
} from './capabilities.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = resolve(repoRoot, 'scripts/codegen/capabilities.mjs');
const realTomlPath = resolve(repoRoot, 'crates/qb-core/capabilities/qbittorrent-capabilities.toml');

const RUST_PATH = 'crates/qb-core/src/capability/generated.rs';
const SERVER_TS_PATH = 'packages/bridge/src/generated/server-capabilities.ts';
const APP_TS_PATH = 'packages/web-core/src/capabilities/generated/app-capabilities.ts';
const ALL_OUTPUTS = [RUST_PATH, SERVER_TS_PATH, APP_TS_PATH];

const EXPECTED_CAPABILITY_NAMES = [
  'supports_api_key_auth',
  'supports_basic_auth',
  'supports_categories_manage',
  'supports_file_download',
  'supports_file_renaming',
  'supports_folder_renaming',
  'supports_metadata_api',
  'supports_pause_resume',
  'supports_piece_availability',
  'supports_process_info',
  'supports_rss',
  'supports_rss_clone',
  'supports_rss_matching',
  'supports_rss_refresh',
  'supports_rss_rules',
  'supports_search',
  'supports_speed_limits_api',
  'supports_tags',
  'supports_torrent_comments',
  'supports_tracker_editing',
  'supports_webseed_management',
];

function createTempDir(prefix) {
  return mkdtempSync(resolve(tmpdir(), `taurent-codegen-${prefix}-`));
}

function runScript(args, env = {}) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

function runScriptInDir(args, cwd) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function readGenerated(outDir, relativePath) {
  return readFileSync(resolve(outDir, relativePath), 'utf8');
}

function writeTempToml(name, contents) {
  const tempDir = createTempDir(name);
  const tomlPath = resolve(tempDir, 'capabilities.toml');
  writeFileSync(tomlPath, contents);
  return tomlPath;
}

// ── Module-level unit tests ─────────────────────────────────────────────────

test('parseSemver handles missing patch and rejects malformed input', () => {
  assert.deepEqual(parseSemver('2.0'), [2, 0, 0]);
  assert.deepEqual(parseSemver('2.1.1'), [2, 1, 1]);
  assert.deepEqual(parseSemver('10.20.30'), [10, 20, 30]);
  assert.equal(parseSemver('2'), null);
  assert.equal(parseSemver(''), null);
  assert.equal(parseSemver('abc.def.ghi'), null);
  assert.equal(parseSemver('1.2abc.3'), null);
  assert.equal(parseSemver('1.-2.3'), null);
  assert.equal(parseSemver(null), null);
});

test('compareSemver orders by major, minor, then patch', () => {
  assert.ok(compareSemver([1, 0, 0], [2, 0, 0]) < 0);
  assert.ok(compareSemver([2, 0, 0], [2, 1, 0]) < 0);
  assert.ok(compareSemver([2, 1, 0], [2, 1, 1]) < 0);
  assert.equal(compareSemver([2, 0, 0], [2, 0, 0]), 0);
  assert.ok(compareSemver([2, 0, 1], [2, 0, 0]) > 0);
});

test('normalizeSemver pads missing patch to zero', () => {
  assert.equal(normalizeSemver('2.0'), '2.0.0');
  assert.equal(normalizeSemver('2.1.1'), '2.1.1');
  assert.equal(normalizeSemver('not-a-version'), 'not-a-version');
});

test('snakeToCamel converts common capability names', () => {
  assert.equal(snakeToCamel('supports_rss'), 'supportsRss');
  assert.equal(snakeToCamel('supports_api_key_auth'), 'supportsApiKeyAuth');
  assert.equal(snakeToCamel('supports_webseed_management'), 'supportsWebseedManagement');
  assert.equal(snakeToCamel('plain'), 'plain');
  assert.equal(snakeToCamel(''), '');
});

test('parseToml returns corrected shape with safe defaults', () => {
  const tomlData = parseToml(realTomlPath);
  assert.ok(tomlData.corrections && typeof tomlData.corrections === 'object');
  assert.ok(tomlData.versions && typeof tomlData.versions === 'object');
  assert.ok(tomlData.appVersions && typeof tomlData.appVersions === 'object');
  assert.equal(tomlData.corrections['2.7.0'], '2.8.0');
});

test('collectCapabilities returns all 21 names alphabetically sorted', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  assert.equal(caps.length, EXPECTED_CAPABILITY_NAMES.length);
  for (const name of EXPECTED_CAPABILITY_NAMES) {
    assert.ok(caps.includes(name), `missing capability ${name}`);
  }
  // Verify sorted order.
  assert.deepEqual(caps, [...caps].sort());
});

test('collectCapabilities handles missing adds/removes arrays gracefully', () => {
  const tomlData = parseToml(realTomlPath);
  // Simulate a sparse entry with no adds/removes — should not throw.
  tomlData.versions['2.99.0'] = { app_version: 'v99.0.0' };
  tomlData.appVersions['v99.0.0'] = {};
  const caps = collectCapabilities(tomlData);
  assert.ok(caps.includes('supports_rss'));
});

test('parseToml throws on missing file with helpful message', () => {
  assert.throws(() => parseToml(resolve(tmpdir(), 'definitely-not-a-real-file.toml')), /not found/i);
});

test('parseToml throws on malformed TOML', () => {
  const tempDir = createTempDir('parse-error');
  const brokenPath = resolve(tempDir, 'broken.toml');
  writeFileSync(brokenPath, 'this is = "not valid toml"\n[unterminated\n');
  assert.throws(() => parseToml(brokenPath), /Failed to parse TOML/);
});

test('parseToml throws on invalid semver version keys', () => {
  const tomlPath = writeTempToml('invalid-version', `
[versions."not-a-version"]
adds = [{ name = "supports_rss" }]
`);
  assert.throws(() => parseToml(tomlPath), /Invalid semver version key/);
});

test('parseToml throws on invalid correction semver', () => {
  const tomlPath = writeTempToml('invalid-correction', `
[corrections]
"2.7" = "2.8.0"

[versions."2.0"]
adds = [{ name = "supports_rss" }]
`);
  assert.throws(() => parseToml(tomlPath), /Invalid semver correction key/);
});

test('parseToml throws when removes references a non-existent capability', () => {
  const tomlPath = writeTempToml('remove-missing', `
[versions."2.0"]
removes = [{ name = "supports_rss" }]
`);
  assert.throws(() => parseToml(tomlPath), /was never adds'd/);
});

test('parseToml throws when removes references an already removed capability', () => {
  const tomlPath = writeTempToml('remove-duplicate', `
[versions."2.0"]
adds = [{ name = "supports_rss" }]

[versions."2.1.0"]
removes = [{ name = "supports_rss" }]

[versions."2.2.0"]
removes = [{ name = "supports_rss" }]
`);
  assert.throws(() => parseToml(tomlPath), /was never adds'd/);
});

test('parseToml throws on invalid app_version metadata', () => {
  const tomlPath = writeTempToml('invalid-app-version', `
[versions."2.0"]
app_version = "soon"
adds = [{ name = "supports_rss" }]
`);
  assert.throws(() => parseToml(tomlPath), /Invalid app_version/);
});

test('buildResolverTestTable produces ascending rows with 99.0.0 sentinel', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  const rows = buildResolverTestTable(tomlData, caps);
  assert.ok(rows.length > 1);
  assert.equal(rows[0].version, '2.0.0');
  assert.equal(rows.at(-1).version, '99.0.0');

  // Versions strictly ascending.
  for (let i = 1; i < rows.length; i += 1) {
    const prev = parseSemver(rows[i - 1].version);
    const curr = parseSemver(rows[i].version);
    assert.ok(
      compareSemver(prev, curr) < 0,
      `expected ${rows[i - 1].version} < ${rows[i].version}`,
    );
  }
});

test('buildResolverTestTable accumulates caps monotonically across versions', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  const rows = buildResolverTestTable(tomlData, caps);
  const capIndex = Object.fromEntries(caps.map((cap, idx) => [cap, idx]));
  const stateVector = (row) => caps.map((cap) => (row.state[cap] ? 1 : 0));

  for (let i = 1; i < rows.length; i += 1) {
    const prev = stateVector(rows[i - 1]);
    const curr = stateVector(rows[i]);
    for (let j = 0; j < prev.length; j += 1) {
      assert.ok(
        curr[j] >= prev[j],
        `capability ${caps[j]} regressed at ${rows[i].version}`,
      );
    }
  }

  // First row (2.0.0) should have only the caps declared at 2.0: supports_rss + supports_rss_rules.
  assert.equal(rows[0].state.supports_rss, true);
  assert.equal(rows[0].state.supports_rss_rules, true);
  assert.equal(rows[0].state.supports_search, false);
});

test('buildResolverTestTable enables webapi-driven caps at 99.0.0 sentinel', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  const rows = buildResolverTestTable(tomlData, caps);
  const last = rows.at(-1);
  assert.equal(last.version, '99.0.0');

  // Caps declared under `[app_versions]` (e.g. supports_pause_resume) are not
  // projected into the webapi-version test table — they are exercised by the
  // runtime QbResolver instead. Every cap declared under `[versions]` should
  // therefore be true at 99.0.0.
  const webapiCaps = new Set();
  for (const entry of Object.values(tomlData.versions)) {
    if (!entry) continue;
    for (const cap of entry.adds ?? []) webapiCaps.add(cap.name);
  }
  assert.ok(webapiCaps.size > 0, 'expected at least one webapi-version cap');
  for (const cap of webapiCaps) {
    assert.equal(last.state[cap], true, `expected webapi cap ${cap} true at 99.0.0`);
  }
});

test('buildResolverTestTable honours corrections table', () => {
  const tomlData = {
    corrections: { '2.7.0': '2.8.0' },
    versions: {
      '2.0': { adds: [{ name: 'supports_rss' }] },
      '2.7.0': { adds: [{ name: 'supports_search' }] },
      '2.8.0': { adds: [{ name: 'supports_search' }, { name: 'supports_tracker_editing' }] },
    },
    appVersions: {},
  };
  const caps = collectCapabilities(tomlData);
  const rows = buildResolverTestTable(tomlData, caps);
  const row270 = rows.find((row) => row.version === '2.7.0');
  assert.ok(row270, '2.7.0 row should be present');
  // Corrected to 2.8.0 → supports_search (via the 2.8.0 entry) + supports_tracker_editing both true.
  assert.equal(row270.state.supports_search, true);
  assert.equal(row270.state.supports_tracker_editing, true);
});

test('generateRust emits struct, known list, matcher, and test table', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  const output = generateRust(caps, tomlData);

  assert.match(output, /@generated by scripts\/codegen\/capabilities\.mjs\. DO NOT EDIT\./);
  assert.match(output, /pub struct ResolvedCapabilities \{/);
  assert.match(output, /pub supports_rss: bool,/);
  assert.match(output, /pub supports_api_key_auth: bool,/);
  assert.match(output, /pub const KNOWN_CAPABILITIES: &\[\&str/);
  assert.match(output, /"supports_api_key_auth"/);
  assert.match(output, /"supports_webseed_management"/);
  assert.match(output, /pub fn set_capability/);
  assert.match(output, /"supports_search" => caps\.supports_search = value,/);
  assert.match(output, /pub const RESOLVER_TEST_TABLE/);
  assert.match(output, /"2\.0\.0",\n\s+&\[/);
  assert.match(output, /"99\.0\.0",\n\s+&\[/);
  // Test table should list all caps in sorted order.
  const structOrder = [...output.matchAll(/pub (\w+): bool,/g)].map((match) => match[1]);
  assert.deepEqual(structOrder, [...structOrder].sort());
});

test('generateServerCapabilitiesTs emits snake_case interface and defaults', () => {
  const caps = EXPECTED_CAPABILITY_NAMES;
  const output = generateServerCapabilitiesTs(caps);

  assert.match(output, /@generated/);
  assert.match(output, /export interface ServerCapabilities \{/);
  assert.match(output, /supports_api_key_auth: boolean;/);
  assert.match(output, /supports_webseed_management: boolean;/);
  assert.match(output, /export function makeServerCapabilities/);
  assert.match(output, /supports_api_key_auth: false,/);
  assert.match(output, /\.\.\.overrides,/);
});

test('generateAppCapabilitiesTs emits camelCase interface, defaults, mapping, and lifecycle constants', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = EXPECTED_CAPABILITY_NAMES;
  const output = generateAppCapabilitiesTs(caps, tomlData);

  assert.match(output, /@generated/);
  assert.match(output, /export interface AppCapabilities \{/);
  assert.match(output, /supportsApiKeyAuth: boolean;/);
  assert.match(output, /supportsWebseedManagement: boolean;/);
  assert.match(output, /export const DEFAULT_APP_CAPABILITIES/);
  assert.match(output, /supportsApiKeyAuth: false,/);
  assert.match(output, /export function toAppCapabilities/);
  assert.match(output, /supportsApiKeyAuth: capabilities\.supports_api_key_auth,/);
  assert.match(output, /export function makeAppCapabilities/);
  assert.match(output, /\{ \.\.\.DEFAULT_APP_CAPABILITIES, \.\.\.overrides \}/);

  // CapabilityName + lifecycle constants.
  assert.match(output, /export type CapabilityName = keyof AppCapabilities;/);
  assert.match(output, /export const CAPABILITY_ADDED_IN: Record<CapabilityName, string>/);
  assert.match(output, /supportsApiKeyAuth: "v5\.2\.0",/);
  assert.match(output, /supportsRss: "v4\.1\.0",/);
  assert.match(output, /supportsRssClone: "unreleased",/);
  assert.match(output, /supportsPauseResume: "v4\.1\.0",/);
  assert.match(output, /export const CAPABILITY_REMOVED_IN: Partial<Record<CapabilityName, string>>/);
  assert.match(output, /supportsPauseResume: "v5\.0\.0",/);
});

test('buildAddedInMap returns correct app versions for known capabilities', () => {
  const tomlData = parseToml(realTomlPath);
  const map = buildAddedInMap(tomlData);

  // Capabilities declared under [versions] — uses entry.app_version.
  assert.equal(map.supports_rss, 'v4.1.0');
  assert.equal(map.supports_rss_rules, 'v4.1.0');
  assert.equal(map.supports_search, 'v4.1.4');
  assert.equal(map.supports_api_key_auth, 'v5.2.0');
  assert.equal(map.supports_basic_auth, 'v5.2.0');
  assert.equal(map.supports_piece_availability, 'v5.2.1');

  // Capability declared under [app_versions] — uses the section key.
  assert.equal(map.supports_pause_resume, 'v4.1.0');
});

test('buildAddedInMap marks unreleased caps as "unreleased"', () => {
  const tomlData = parseToml(realTomlPath);
  const map = buildAddedInMap(tomlData);

  // Three caps marked app_version = "unreleased" in [versions].
  assert.equal(map.supports_rss_clone, 'unreleased');
  assert.equal(map.supports_speed_limits_api, 'unreleased');
  assert.equal(map.supports_file_download, 'unreleased');
});

test('buildAddedInMap picks earliest semver occurrence regardless of TOML key order', () => {
  const tomlData = {
    corrections: {},
    versions: {
      '2.5.0': { app_version: 'v5.0.0', adds: [{ name: 'supports_rss' }] },
      '2.0': {
        app_version: 'v4.1.0',
        adds: [
          { name: 'supports_rss' },
          { name: 'supports_search' },
        ],
      },
    },
    appVersions: {
      'v4.3.0': { adds: [{ name: 'supports_rss' }] },
    },
  };
  const map = buildAddedInMap(tomlData);
  // Earliest wins: webapi 2.0 (v4.1.0) beats later duplicates.
  assert.equal(map.supports_rss, 'v4.1.0');
  assert.equal(map.supports_search, 'v4.1.0');
});

test('buildAddedInMap covers every capability in the provided list', () => {
  const tomlData = parseToml(realTomlPath);
  const caps = collectCapabilities(tomlData);
  const map = buildAddedInMap(tomlData);
  for (const cap of caps) {
    assert.ok(cap in map, `missing added-in entry for ${cap}`);
  }
});

test('buildRemovedInMap returns the removal app version per cap', () => {
  const tomlData = parseToml(realTomlPath);
  const map = buildRemovedInMap(tomlData);
  assert.equal(map.supports_pause_resume, 'v5.0.0');
});

test('buildRemovedInMap is empty when no caps are removed', () => {
  const tomlData = {
    corrections: {},
    versions: {
      '2.0': { app_version: 'v4.1.0', adds: [{ name: 'supports_rss' }] },
    },
    appVersions: {},
  };
  const map = buildRemovedInMap(tomlData);
  assert.equal(Object.keys(map).length, 0);
});

test('buildRemovedInMap processes both [versions] and [app_versions] removes', () => {
  const tomlData = {
    corrections: {},
    versions: {
      '2.0': {
        app_version: 'v4.1.0',
        adds: [{ name: 'supports_rss' }],
        removes: [{ name: 'supports_legacy_flag' }],
      },
    },
    appVersions: {
      'v5.0.0': { removes: [{ name: 'supports_pause_resume' }] },
    },
  };
  const map = buildRemovedInMap(tomlData);
  assert.equal(map.supports_legacy_flag, 'v4.1.0');
  assert.equal(map.supports_pause_resume, 'v5.0.0');
});

// ── End-to-end smoke + CLI tests ────────────────────────────────────────────

test('script generates all 3 output files with expected markers', () => {
  const outDir = createTempDir('smoke');
  const result = runScriptInDir([`--toml-path=${realTomlPath}`, `--out-dir=${outDir}`], repoRoot);
  assert.equal(result.status, 0, result.stderr);

  for (const relativePath of ALL_OUTPUTS) {
    const content = readGenerated(outDir, relativePath);
    assert.match(content, /@generated by scripts\/codegen\/capabilities\.mjs\. DO NOT EDIT\./);
  }

  assert.match(readGenerated(outDir, RUST_PATH), /pub struct ResolvedCapabilities/);
  assert.match(readGenerated(outDir, SERVER_TS_PATH), /export interface ServerCapabilities/);
  assert.match(readGenerated(outDir, APP_TS_PATH), /export interface AppCapabilities/);

  // App-capabilities.ts must carry the lifecycle constants.
  const appContent = readGenerated(outDir, APP_TS_PATH);
  assert.match(appContent, /export const CAPABILITY_ADDED_IN: Record<CapabilityName, string>/);
  assert.match(appContent, /export const CAPABILITY_REMOVED_IN: Partial<Record<CapabilityName, string>>/);
  assert.match(appContent, /supportsApiKeyAuth: "v5\.2\.0",/);
  assert.match(appContent, /supportsPauseResume: "v5\.0\.0",/);

  for (const name of EXPECTED_CAPABILITY_NAMES) {
    assert.match(readGenerated(outDir, RUST_PATH), new RegExp(`pub ${name}: bool,`));
    assert.match(readGenerated(outDir, SERVER_TS_PATH), new RegExp(`\\b${name}: boolean;`));
    const camel = snakeToCamel(name);
    assert.match(readGenerated(outDir, APP_TS_PATH), new RegExp(`\\b${camel}: boolean;`));
  }
});

test('script --check passes against freshly-generated files', () => {
  // --check generates into an internal temp dir and compares against the repo
  // outputs without mutating the working tree.
  const checkResult = runScript(['--check']);
  assert.equal(checkResult.status, 0, checkResult.stderr);
  assert.match(checkResult.stdout, /Codegen check passed\./);
});

test('script --check detects drift when a generated file is modified', () => {
  // Build a fresh tree in an isolated temp dir and ask the module-level check()
  // to compare against a copy that we then mutate.
  const expectedDir = createTempDir('expected');
  const actualDir = createTempDir('actual');

  // First, generate clean files into both directories using the script.
  for (const dir of [expectedDir, actualDir]) {
    const result = runScriptInDir([`--toml-path=${realTomlPath}`, `--out-dir=${dir}`], repoRoot);
    assert.equal(result.status, 0, result.stderr);
  }

  // Mutate one file in actualDir to simulate drift.
  const targetPath = resolve(actualDir, RUST_PATH);
  const original = readFileSync(targetPath, 'utf8');
  writeFileSync(targetPath, `${original}\n// drift marker\n`);

  const drift = check(actualDir, [RUST_PATH, SERVER_TS_PATH, APP_TS_PATH], expectedDir);
  assert.equal(drift, false, 'check() should report drift after file mutation');
});

test('CLI --check exits non-zero when generated output is mutated', () => {
  // Verify the actual CLI surfaces drift: mutate a generated file in
  // place, run `node scripts/codegen/capabilities.mjs --check`, and assert a
  // non-zero exit. Restore the file afterwards so other tests stay clean.
  const targetPath = resolve(repoRoot, RUST_PATH);
  const original = readFileSync(targetPath, 'utf8');
  writeFileSync(targetPath, `${original}\n// injected drift\n`);

  try {
    const result = runScript(['--check']);
    assert.notEqual(result.status, 0, 'expected non-zero exit on drift');
    assert.match(result.stderr, /Drift detected/);
  } finally {
    writeFileSync(targetPath, original);
  }
});

test('script prints help and exits 0 on --help', () => {
  const result = runScript(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
});

test('script exits non-zero on unknown CLI argument', () => {
  const result = runScript(['--bogus']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown argument/);
});
