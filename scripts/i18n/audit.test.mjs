import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditSource,
  compareWithBaseline,
  createBaseline,
} from './audit.mjs';

test('auditSource detects JSX text, display attributes, and display models', () => {
  const result = auditSource('packages/web-ui/src/Sample.tsx', `
    const model = { id: 'pause', label: 'Pause torrent' };
    export const Sample = () => (
      <section aria-label="Torrent actions">
        No torrents yet
        {true ? 'Loading torrents' : 'Ready'}
      </section>
    );
  `);

  assert.deepEqual(
    result.findings.map(({ kind, text }) => ({ kind, text })),
    [
      { kind: 'display-property:label', text: 'Pause torrent' },
      { kind: 'jsx-attribute:aria-label', text: 'Torrent actions' },
      { kind: 'jsx-text', text: 'No torrents yet' },
      { kind: 'jsx-expression', text: 'Loading torrents' },
      { kind: 'jsx-expression', text: 'Ready' },
    ],
  );
});

test('auditSource ignores dynamic domain data and records exact approved literals', () => {
  const result = auditSource('apps/mobile/src/Sample.tsx', `
    export const Sample = ({ torrent }) => (
      <section>
        <h1>{torrent.name}</h1>
        <span>qBittorrent</span>
      </section>
    );
  `);

  assert.equal(result.findings.length, 0);
  assert.equal(result.suppressed.length, 1);
  assert.equal(result.suppressed[0].suppression, 'upstream product name');
});

test('auditSource accepts only inline suppressions with a meaningful rationale', () => {
  const result = auditSource('packages/shared/src/sample.ts', `
    // i18n-audit-ignore: example username is intentionally verbatim
    const placeholder = 'admin';
    // i18n-audit-ignore: short
    const message = 'Visible message';
  `);

  assert.equal(result.suppressed.length, 1);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].text, 'Visible message');
});

test('auditSource ignores conditional values in non-display JSX attributes', () => {
  const result = auditSource('packages/web-ui/src/Component.tsx', `
    export const Component = ({ active }) => (
      <input
        className={active ? 'text-primary' : 'text-secondary'}
        type={active ? 'text' : 'password'}
      />
    );
  `);

  assert.equal(result.findings.length, 0);
});

test('baseline comparison permits reductions and rejects group regressions', () => {
  const original = {
    findings: [
      { workspace: 'web-ui', kind: 'jsx-text', file: 'a.tsx' },
      { workspace: 'web-ui', kind: 'jsx-text', file: 'a.tsx' },
    ],
  };
  const baseline = createBaseline(original);

  assert.equal(compareWithBaseline({ findings: original.findings.slice(0, 1) }, baseline).regressions.length, 0);
  assert.deepEqual(
    compareWithBaseline({ findings: [...original.findings, ...original.findings] }, baseline).regressions,
    [{ group: 'web-ui|jsx-text|a.tsx', allowed: 2, actual: 4 }],
  );
});
