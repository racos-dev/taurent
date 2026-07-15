#!/usr/bin/env node
// Capability codegen — derives TypeScript and Rust capability shapes from the
// single-source-of-truth TOML profile at
// `crates/qb-core/capabilities/qbittorrent-capabilities.toml`.
//
// Usage:
//   node scripts/codegen/capabilities.mjs            # write to repoRoot
//   node scripts/codegen/capabilities.mjs --check    # verify current outputs
//                                                    #   match a fresh generation
//   node scripts/codegen/capabilities.mjs --toml-path=PATH --out-dir=PATH
//                                                    # write to a custom location
//                                                    #   (used by tests)
//
// Regenerate with: pnpm codegen:capabilities

import toml from '@iarna/toml';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const DEFAULT_TOML_PATH = 'crates/qb-core/capabilities/qbittorrent-capabilities.toml';

const OUTPUT_PATHS = Object.freeze({
  rust: 'crates/qb-core/src/capability/generated.rs',
  server: 'packages/bridge/src/generated/server-capabilities.ts',
  app: 'packages/web-core/src/capabilities/generated/app-capabilities.ts',
});

// ── Version helpers ─────────────────────────────────────────────────────────

/**
 * Parse a "X.Y" or "X.Y.Z" semver-ish string into a numeric tuple.
 * Returns null when the string is not a recognisable version.
 *
 * Missing patch component is treated as 0 (matches qBittorrent's
 * `webapiVersion` reporting style, e.g. "2.0" -> 2.0.0).
 */
export function parseSemver(version) {
  if (typeof version !== 'string' || version.length === 0) return null;
  const rawParts = version.split('.');
  if (rawParts.length < 2 || rawParts.length > 3) return null;
  if (rawParts.some((part) => !/^\d+$/.test(part))) return null;
  const parts = rawParts.map((part) => Number.parseInt(part, 10));
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

/** Normalise "X.Y" / "X.Y.Z" to "X.Y.0" / "X.Y.Z". Passes through unparseable input. */
export function normalizeSemver(version) {
  const parsed = parseSemver(version);
  if (!parsed) return version;
  return `${parsed[0]}.${parsed[1]}.${parsed[2]}`;
}

function parseStrictSemver(version) {
  if (typeof version !== 'string') return null;
  const parts = version.split('.');
  if (parts.length !== 3) return null;
  return parseSemver(version);
}

function parseAppSemver(version) {
  if (typeof version !== 'string') return null;
  return parseSemver(version.startsWith('v') ? version.slice(1) : version);
}

// ── Naming helpers ──────────────────────────────────────────────────────────

/**
 * Convert snake_case identifiers to camelCase.
 * `"supports_rss"` -> `"supportsRss"`
 * `"supports_api_key_auth"` -> `"supportsApiKeyAuth"`
 */
export function snakeToCamel(snake) {
  return snake.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

// ── TOML loading ────────────────────────────────────────────────────────────

/**
 * Parse and validate the capabilities TOML profile.
 *
 * The file is expected to expose (all optional except `versions`):
 *   [corrections]  — { "2.7.0" = "2.8.0", ... }
 *   [versions]     — { "2.0" = { app_version = "v4.1.0", adds = [...] }, ... }
 *   [app_versions] — { "v4.1.0" = { adds = [...] }, "v5.0.0" = { removes = [...] } }
 *
 * Each `adds` / `removes` entry is `{ name = "snake_case", description = "..." }`.
 */
export function parseToml(tomlPath) {
  if (!existsSync(tomlPath)) {
    throw new Error(`Capabilities TOML not found: ${tomlPath}`);
  }
  const raw = readFileSync(tomlPath, 'utf8');

  let parsed;
  try {
    parsed = toml.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse TOML ${tomlPath}: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Capabilities TOML ${tomlPath} must be a table at the root`);
  }

  const corrections = parsed.corrections && typeof parsed.corrections === 'object'
    ? parsed.corrections
    : {};
  const versions = parsed.versions && typeof parsed.versions === 'object'
    ? parsed.versions
    : {};
  const appVersions = parsed.app_versions && typeof parsed.app_versions === 'object'
    ? parsed.app_versions
    : {};

  const tomlData = { corrections, versions, appVersions };
  validateTomlData(tomlData, tomlPath);
  return tomlData;
}

function validateTomlData(tomlData, tomlPath) {
  validateCorrections(tomlData.corrections, tomlPath);
  validateVersionTable(tomlData.versions, 'versions', tomlPath, parseSemver);
  validateVersionTable(tomlData.appVersions, 'app_versions', tomlPath, parseAppSemver);
  validateRemovesBeforeAdds(tomlData.versions, 'versions', tomlPath, parseSemver);
  validateRemovesBeforeAdds(tomlData.appVersions, 'app_versions', tomlPath, parseAppSemver);
}

function validateCorrections(corrections, tomlPath) {
  for (const [from, to] of Object.entries(corrections ?? {})) {
    if (!parseStrictSemver(from)) {
      throw new Error(
        `Invalid semver correction key ${JSON.stringify(from)} in [corrections] of ${tomlPath} `
        + '(expected "MAJOR.MINOR.PATCH")',
      );
    }
    if (!parseStrictSemver(to)) {
      throw new Error(
        `Invalid semver correction value ${JSON.stringify(to)} for ${JSON.stringify(from)} `
        + `in [corrections] of ${tomlPath} (expected "MAJOR.MINOR.PATCH")`,
      );
    }
  }
}

function validateVersionTable(map, section, tomlPath, parseFn) {
  for (const [version, entry] of Object.entries(map ?? {})) {
    if (!parseFn(version)) {
      const suffix = section === 'app_versions' ? ", optionally with a leading 'v'" : '';
      throw new Error(
        `Invalid semver version key ${JSON.stringify(version)} under [${section}] in ${tomlPath} `
        + `(expected "MAJOR.MINOR.PATCH"${suffix})`,
      );
    }

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Capability profile [${section}.${version}] in ${tomlPath} must be a table`);
    }

    if (
      entry.app_version
      && entry.app_version !== 'unreleased'
      && !parseAppSemver(entry.app_version)
    ) {
      throw new Error(
        `Invalid app_version ${JSON.stringify(entry.app_version)} under [${section}.${version}] `
        + `in ${tomlPath} (expected "vMAJOR.MINOR.PATCH" or "unreleased")`,
      );
    }

    for (const field of ['adds', 'removes']) {
      if (entry[field] !== undefined && !Array.isArray(entry[field])) {
        throw new Error(`Capability profile [${section}.${version}].${field} in ${tomlPath} must be an array`);
      }
      for (const cap of entry[field] ?? []) {
        if (!cap || typeof cap !== 'object' || Array.isArray(cap) || typeof cap.name !== 'string' || cap.name.length === 0) {
          throw new Error(
            `Capability entries in [${section}.${version}].${field} of ${tomlPath} `
            + 'must be tables with a non-empty string name',
          );
        }
      }
    }
  }
}

function validateRemovesBeforeAdds(map, section, tomlPath, parseFn) {
  const thresholds = Object.entries(map ?? {})
    .map(([version, entry]) => ({ version, entry, parsed: parseFn(version) }))
    .sort((a, b) => compareSemver(a.parsed, b.parsed));
  const active = new Set();

  for (const { version, entry } of thresholds) {
    for (const cap of entry.removes ?? []) {
      if (!active.has(cap.name)) {
        throw new Error(
          `Capability ${JSON.stringify(cap.name)} is removes'd at [${section}.${version}] `
          + `in ${tomlPath} but was never adds'd at an earlier threshold`,
        );
      }
    }
    for (const cap of entry.removes ?? []) active.delete(cap.name);
    for (const cap of entry.adds ?? []) active.add(cap.name);
  }
}

// ── Capability collection ───────────────────────────────────────────────────

/** Collect the union of every `adds` / `removes` name across both section families, sorted alphabetically. */
export function collectCapabilities(tomlData) {
  const names = new Set();
  for (const entry of Object.values(tomlData.versions)) {
    if (!entry) continue;
    for (const cap of entry.adds ?? []) names.add(cap.name);
    for (const cap of entry.removes ?? []) names.add(cap.name);
  }
  for (const entry of Object.values(tomlData.appVersions)) {
    if (!entry) continue;
    for (const cap of entry.adds ?? []) names.add(cap.name);
    for (const cap of entry.removes ?? []) names.add(cap.name);
  }
  return [...names].sort();
}

// ── Two-pass resolver simulation (webapi versions only) ─────────────────────

/**
 * Build the auto-generated test table consumed by `crates/qb-core`'s resolver
 * tests. One row per [versions] entry (sorted ascending), plus an explicit
 * `"2.0.0"` baseline row (when not already present) and a final `"99.0.0"`
 * row representing a far-future server with everything enabled.
 *
 * [app_versions] deltas are intentionally NOT folded into this table — they
 * are exercised by the runtime `QbResolver` separately. Only webapi-version
 * deltas drive the test table so it stays a pure projection of [versions].
 */
export function buildResolverTestTable(tomlData, capabilities) {
  const corrections = tomlData.corrections ?? {};

  const versionEntries = Object.entries(tomlData.versions ?? {})
    .map(([key, entry]) => {
      if (!entry) return null;
      if (!Array.isArray(entry.adds) || entry.adds.length === 0) return null;
      const normalized = normalizeSemver(key);
      if (parseSemver(normalized) === null) {
        console.warn(`capabilities: skipping non-semver version key ${JSON.stringify(key)}`);
        return null;
      }
      return {
        version: normalized,
        adds: entry.adds.map((cap) => cap.name),
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareSemver(parseSemver(a.version), parseSemver(b.version)));

  const rowKeys = [];
  if (!rowKeys.includes('2.0.0')) rowKeys.push('2.0.0');
  for (const entry of versionEntries) {
    if (!rowKeys.includes(entry.version)) rowKeys.push(entry.version);
  }
  if (!rowKeys.includes('99.0.0')) rowKeys.push('99.0.0');

  const rows = rowKeys.map((rowKey) => {
    const corrected = normalizeSemver(corrections[rowKey] ?? rowKey);
    const rowVer = parseSemver(corrected);
    const state = Object.fromEntries(capabilities.map((cap) => [cap, false]));

    if (rowVer) {
      for (const entry of versionEntries) {
        const entryVer = parseSemver(entry.version);
        if (entryVer && compareSemver(entryVer, rowVer) <= 0) {
          for (const cap of entry.adds) {
            if (cap in state) state[cap] = true;
          }
        }
      }
    }

    return { version: rowKey, state };
  });

  return rows;
}

// ── Capability lifecycle maps ──────────────────────────────────────────────

/**
 * Build `capability_name -> app_version` for each capability, using the
 * earliest semver-ordered occurrence across both `[versions]` and
 * `[app_versions]`. `[versions]` keys are webapi versions whose
 * `app_version` metadata field is the app version that introduced the cap;
 * `[app_versions]` keys ARE app versions directly.
 *
 * Earliest version wins per cap (the first `adds` is the effective intro
 * version). `entry.app_version` may be the literal string `"unreleased"`
 * for caps that have not yet shipped in any app release.
 */
export function buildAddedInMap(tomlData) {
  const map = Object.create(null);

  const webapiEntries = Object.entries(tomlData.versions ?? {})
    .filter(([, entry]) => entry != null)
    .map(([key, entry]) => ({ entry, parsed: parseSemver(key) }))
    .filter((entry) => entry.parsed !== null)
    .sort((a, b) => compareSemver(a.parsed, b.parsed));

  for (const { entry } of webapiEntries) {
    for (const cap of entry.adds ?? []) {
      if (!(cap.name in map)) {
        map[cap.name] = entry.app_version ?? 'unreleased';
      }
    }
  }

  const appEntries = Object.entries(tomlData.appVersions ?? {})
    .filter(([, entry]) => entry != null)
    .map(([key, entry]) => ({ entry, key, parsed: parseAppSemver(key) }))
    .filter((entry) => entry.parsed !== null)
    .sort((a, b) => compareSemver(a.parsed, b.parsed));

  for (const { entry, key } of appEntries) {
    for (const cap of entry.adds ?? []) {
      if (!(cap.name in map)) {
        map[cap.name] = key;
      }
    }
  }

  return map;
}

/**
 * Build `capability_name -> app_version` for each removed capability. Walks
 * both sections in app-version order so the last `removes` entry is the
 * effective one (later overrides earlier). `unreleased` app versions sort
 * after concrete ones.
 */
export function buildRemovedInMap(tomlData) {
  const map = Object.create(null);

  const all = [];
  for (const [key, entry] of Object.entries(tomlData.versions ?? {})) {
    if (!entry) continue;
    all.push({ entry, appVersion: entry.app_version ?? key });
  }
  for (const [key, entry] of Object.entries(tomlData.appVersions ?? {})) {
    if (!entry) continue;
    all.push({ entry, appVersion: key });
  }

  all.sort((a, b) => {
    const aParsed = parseAppSemver(a.appVersion ?? '');
    const bParsed = parseAppSemver(b.appVersion ?? '');
    if (aParsed && bParsed) return compareSemver(aParsed, bParsed);
    if (aParsed) return -1;
    if (bParsed) return 1;
    return 0;
  });

  for (const { entry, appVersion } of all) {
    for (const cap of entry.removes ?? []) {
      map[cap.name] = appVersion;
    }
  }

  return map;
}

// ── Code generators ─────────────────────────────────────────────────────────

export function generateRust(capabilities, tomlData) {
  const structFields = capabilities.map((cap) => `    pub ${cap}: bool,`).join('\n');
  const knownList = capabilities.map((cap) => `    "${cap}",`).join('\n');
  const matchArms = capabilities
    .map((cap) => `        "${cap}" => caps.${cap} = value,`)
    .join('\n');

  const rows = buildResolverTestTable(tomlData, capabilities);
  const tableRows = rows
    .map((row) => {
      const pairs = capabilities
        .map((cap) => `            ("${cap}", ${row.state[cap]}),`)
        .join('\n');
      return `    (\n        "${row.version}",\n        &[\n${pairs}\n        ],\n    ),`;
    })
    .join('\n');

  return `// @generated by scripts/codegen/capabilities.mjs. DO NOT EDIT.

use serde::{Deserialize, Serialize};

/// Boolean capability set returned to the Tauri host and renderer.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ResolvedCapabilities {
${structFields}
}

/// Canonical list of all recognised capabilities.
pub const KNOWN_CAPABILITIES: &[&str] = &[
${knownList}
];

/// Set a single capability field by name. Unknown names are silently ignored.
pub fn set_capability(caps: &mut ResolvedCapabilities, name: &str, value: bool) {
    match name {
${matchArms}
        _ => {}
    }
}

/// Auto-generated test table: one entry per version boundary.
/// Each entry: (webapi_version, expected_capability_values)
/// Generated by simulating the two-pass resolver algorithm.
pub const RESOLVER_TEST_TABLE: &[(&str, &[(&str, bool)])] = &[
${tableRows}
];
`;
}

export function generateServerCapabilitiesTs(capabilities) {
  const ifaceFields = capabilities.map((cap) => `  ${cap}: boolean;`).join('\n');
  const defaults = capabilities.map((cap) => `    ${cap}: false,`).join('\n');

  return `// @generated by scripts/codegen/capabilities.mjs. DO NOT EDIT.

/** Capabilities resolved from qBittorrent webapi version profile. */
export interface ServerCapabilities {
${ifaceFields}
}

export function makeServerCapabilities(
  overrides?: Partial<ServerCapabilities>,
): ServerCapabilities {
  return {
${defaults}
    ...overrides,
  };
}
`;
}

export function generateAppCapabilitiesTs(capabilities, tomlData = { versions: {}, appVersions: {} }) {
  const camel = capabilities.map(snakeToCamel);
  const ifaceFields = camel.map((cap) => `  ${cap}: boolean;`).join('\n');
  const defaults = camel.map((cap) => `  ${cap}: false,`).join('\n');
  const mappings = camel
    .map((cap, index) => `    ${cap}: capabilities.${capabilities[index]},`)
    .join('\n');

  const addedInMap = buildAddedInMap(tomlData);
  const removedInMap = buildRemovedInMap(tomlData);

  const addedInEntries = capabilities
    .map((cap) => `  ${snakeToCamel(cap)}: ${JSON.stringify(addedInMap[cap] ?? 'unreleased')},`)
    .join('\n');
  const removedInEntries = capabilities
    .filter((cap) => cap in removedInMap)
    .map((cap) => `  ${snakeToCamel(cap)}: ${JSON.stringify(removedInMap[cap])},`)
    .join('\n');

  return `// @generated by scripts/codegen/capabilities.mjs. DO NOT EDIT.

/** Application-level capabilities (camelCase). */
export interface AppCapabilities {
${ifaceFields}
}

/** Union of all known capability names (camelCase). */
export type CapabilityName = keyof AppCapabilities;

export const DEFAULT_APP_CAPABILITIES: AppCapabilities = {
${defaults}
};

export function toAppCapabilities(
  capabilities: import('@taurent/bridge').ServerCapabilities,
): AppCapabilities {
  return {
${mappings}
  };
}

export function makeAppCapabilities(
  overrides?: Partial<AppCapabilities>,
): AppCapabilities {
  return { ...DEFAULT_APP_CAPABILITIES, ...overrides };
}

/** App version where each capability was first introduced. */
export const CAPABILITY_ADDED_IN: Record<CapabilityName, string> = {
${addedInEntries}
};

/** App version where each capability was removed. Only set for removed caps. */
export const CAPABILITY_REMOVED_IN: Partial<Record<CapabilityName, string>> = {
${removedInEntries}
};
`;
}

// ── File I/O ────────────────────────────────────────────────────────────────

function writeOutputs(generated, baseDir) {
  for (const [relativePath, content] of Object.entries(generated)) {
    const fullPath = resolve(baseDir, relativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

function generateAll(tomlData) {
  const capabilities = collectCapabilities(tomlData);
  return {
    [OUTPUT_PATHS.rust]: generateRust(capabilities, tomlData),
    [OUTPUT_PATHS.server]: generateServerCapabilitiesTs(capabilities),
    [OUTPUT_PATHS.app]: generateAppCapabilitiesTs(capabilities, tomlData),
  };
}

// ── --check mode ────────────────────────────────────────────────────────────

/**
 * Compare a freshly-generated tree against an "expected" tree (defaults to the
 * current generated outputs at `repoRoot`). Returns true when every file matches
 * byte-for-byte; false otherwise (and logs the drift).
 */
export function check(actualDir, expectedFiles, expectedDir = repoRoot) {
  let drifted = false;
  for (const relativePath of expectedFiles) {
    const actualPath = resolve(actualDir, relativePath);
    const expectedPath = resolve(expectedDir, relativePath);

    if (!existsSync(actualPath)) {
      console.error(`Drift: missing generated file ${relativePath}`);
      drifted = true;
      continue;
    }
    if (!existsSync(expectedPath)) {
      console.error(`Drift: missing expected file ${relativePath}`);
      drifted = true;
      continue;
    }

    const actual = readFileSync(actualPath);
    const expected = readFileSync(expectedPath);
    if (!actual.equals(expected)) {
      console.error(`Drift detected in: ${relativePath}`);
      drifted = true;
    }
  }
  return !drifted;
}

// ── CLI entrypoint ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { check: false, tomlPath: null, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      args.check = true;
    } else if (arg === '--toml-path' || arg.startsWith('--toml-path=')) {
      args.tomlPath = arg.includes('=') ? arg.slice('--toml-path='.length) : argv[++i];
    } else if (arg === '--out-dir' || arg.startsWith('--out-dir=')) {
      args.outDir = arg.includes('=') ? arg.slice('--out-dir='.length) : argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/codegen/capabilities.mjs [options]

Options:
  --check               Generate to a temp dir and diff against current outputs
  --toml-path=PATH      Override input TOML location (default: repo profile)
  --out-dir=PATH        Override output directory (default: repo root)
  -h, --help            Show this help
`);
}

function main() {
  const args = parseArgs(process.argv);
  const tomlPath = args.tomlPath
    ? resolve(args.tomlPath)
    : resolve(repoRoot, DEFAULT_TOML_PATH);

  let tomlData;
  try {
    tomlData = parseToml(tomlPath);
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const generated = generateAll(tomlData);
  const expectedFiles = Object.keys(generated);

  if (args.check) {
    const tempDir = mkdtempSync(resolve(tmpdir(), 'taurent-codegen-'));
    writeOutputs(generated, tempDir);
    const ok = check(tempDir, expectedFiles);
    if (!ok) {
      console.error('Codegen check FAILED — run `pnpm codegen:capabilities` to refresh.');
      process.exit(1);
    }
    console.log('Codegen check passed.');
    return;
  }

  const outDir = args.outDir ? resolve(args.outDir) : repoRoot;
  writeOutputs(generated, outDir);
  console.log(`Generated ${expectedFiles.length} capability files under ${outDir}`);
  for (const relativePath of expectedFiles) {
    console.log(`  - ${relativePath}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
