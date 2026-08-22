#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { exactLiteralAllowlist } from './audit-allowlist.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baselinePath = resolve(repoRoot, 'scripts/i18n/baseline.json');

const sourceRoots = [
  'apps/desktop/src',
  'apps/mobile/src',
  'packages/shared/src',
  'packages/web-core/src',
  'packages/web-ui/src',
];

const displayAttributeNames = new Set([
  'aria-description',
  'aria-label',
  'cancelText',
  'confirmText',
  'description',
  'emptyText',
  'errorText',
  'helperText',
  'label',
  'loadingText',
  'message',
  'placeholder',
  'successText',
  'title',
  'tooltip',
]);

const displayPropertyNames = new Set([
  ...displayAttributeNames,
  'actionLabel',
  'disabledLabel',
  'enabledLabel',
  'heading',
  'subtitle',
  'summary',
]);

const visibleCallNames = new Set([
  'alert',
  'confirm',
  'prompt',
  'setTitle',
]);

const ignoredPathFragments = [
  '/__tests__/',
  '/dist/',
  '/generated/',
  '/i18n/catalogs/',
  '/node_modules/',
  '/testing/',
];

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function containsNaturalLanguage(value) {
  return /\p{L}/u.test(value);
}

function literalText(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  let text = node.head.text;
  for (const span of node.templateSpans) text += '{{…}}' + span.literal.text;
  return text;
}

function propertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function isToastCall(expression) {
  return ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'toast'
    && ['error', 'info', 'success', 'warning'].includes(expression.name.text);
}

function isRenderedJsxLiteral(node) {
  let current = node;
  while (current.parent && !ts.isJsxExpression(current.parent)) {
    const parent = current.parent;
    if (
      ts.isJsxAttribute(parent)
      || ts.isJsxElement(parent)
      || ts.isJsxSelfClosingElement(parent)
      || ts.isCallExpression(parent)
    ) {
      return false;
    }
    if (ts.isConditionalExpression(parent)) {
      if (current === parent.condition) return false;
    } else if (ts.isBinaryExpression(parent)) {
      const isRenderedRightOperand = parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        && current === parent.right;
      if (!isRenderedRightOperand) return false;
    } else if (
      !ts.isParenthesizedExpression(parent)
      && !ts.isAsExpression(parent)
      && !ts.isSatisfiesExpression(parent)
    ) {
      return false;
    }
    current = parent;
  }
  if (!current.parent || !ts.isJsxExpression(current.parent)) return false;
  const jsxAttribute = current.parent.parent;
  if (jsxAttribute && ts.isJsxAttribute(jsxAttribute)) {
    return displayAttributeNames.has(jsxAttribute.name.getText());
  }
  return true;
}

function workspaceFor(relativePath) {
  if (relativePath.startsWith('apps/desktop/')) return 'desktop';
  if (relativePath.startsWith('apps/mobile/')) return 'mobile';
  if (relativePath.startsWith('packages/shared/')) return 'shared';
  if (relativePath.startsWith('packages/web-core/')) return 'web-core';
  if (relativePath.startsWith('packages/web-ui/')) return 'web-ui';
  return 'other';
}

function suppressionFor(sourceFile, node) {
  const start = node.getStart(sourceFile);
  const { line } = sourceFile.getLineAndCharacterOfPosition(start);
  const lines = sourceFile.text.split(/\r?\n/);
  const candidates = [lines[line], lines[line - 1]].filter(Boolean);
  for (const candidate of candidates) {
    const match = candidate.match(/i18n-audit-ignore:\s*(.+)$/);
    if (match && match[1].trim().length >= 8) return match[1].trim();
  }
  return null;
}

function createFinding(sourceFile, file, node, kind, rawText) {
  const text = normalizeText(rawText);
  if (!text || !containsNaturalLanguage(text)) return null;
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const inlineReason = suppressionFor(sourceFile, node);
  const allowlistReason = exactLiteralAllowlist.get(text);
  return {
    file,
    workspace: workspaceFor(file),
    kind,
    line: line + 1,
    column: character + 1,
    text,
    suppression: inlineReason ?? allowlistReason ?? null,
  };
}

export function auditSource(file, source) {
  const scriptKind = extname(file).toLowerCase() === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);
  const findings = [];
  const suppressed = [];

  const record = (node, kind, text) => {
    if (text === null) return;
    const finding = createFinding(sourceFile, file, node, kind, text);
    if (!finding) return;
    if (finding.suppression) suppressed.push(finding);
    else findings.push(finding);
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      record(node, 'jsx-text', node.text);
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (displayAttributeNames.has(name) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) {
          record(node.initializer, `jsx-attribute:${name}`, node.initializer.text);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          record(
            node.initializer.expression,
            `jsx-attribute:${name}`,
            literalText(node.initializer.expression),
          );
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name);
      if (name && displayPropertyNames.has(name)) {
        record(node.initializer, `display-property:${name}`, literalText(node.initializer));
      }
    } else if (ts.isBindingElement(node) && node.initializer) {
      const name = propertyNameText(node.name);
      if (name && displayPropertyNames.has(name)) {
        record(node.initializer, `display-default:${name}`, literalText(node.initializer));
      }
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (/(?:label|title|description|message|placeholder|tooltip|heading|subtitle|summary|text)$/i.test(node.name.text)) {
        record(node.initializer, `display-variable:${node.name.text}`, literalText(node.initializer));
      }
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const name = callName(node.expression);
      if ((name && visibleCallNames.has(name)) || isToastCall(node.expression)) {
        record(node.arguments[0], `visible-call:${name ?? 'toast'}`, literalText(node.arguments[0]));
      }
    } else if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      if (isRenderedJsxLiteral(node)) {
        record(node, 'jsx-expression', literalText(node));
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { findings, suppressed };
}

function shouldScan(path) {
  const normalized = path.replaceAll('\\', '/');
  if (!/\.[cm]?[jt]sx?$/.test(normalized)) return false;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return false;
  return !ignoredPathFragments.some((fragment) => normalized.includes(fragment));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (shouldScan(path)) files.push(path);
  }
  return files;
}

export function auditRepository(root = repoRoot) {
  const findings = [];
  const suppressed = [];
  for (const sourceRoot of sourceRoots) {
    const absoluteRoot = resolve(root, sourceRoot);
    if (!existsSync(absoluteRoot)) continue;
    for (const absoluteFile of walk(absoluteRoot)) {
      const file = relative(root, absoluteFile).replaceAll('\\', '/');
      const result = auditSource(file, readFileSync(absoluteFile, 'utf8'));
      findings.push(...result.findings);
      suppressed.push(...result.suppressed);
    }
  }
  findings.sort(compareFindings);
  suppressed.sort(compareFindings);
  return { findings, suppressed };
}

function compareFindings(a, b) {
  return a.file.localeCompare(b.file)
    || a.line - b.line
    || a.column - b.column
    || a.kind.localeCompare(b.kind);
}

function groupKey(finding) {
  return `${finding.workspace}|${finding.kind}|${finding.file}`;
}

export function createBaseline(result) {
  const groups = {};
  for (const finding of result.findings) {
    const key = groupKey(finding);
    groups[key] = (groups[key] ?? 0) + 1;
  }
  return {
    version: 1,
    total: result.findings.length,
    groups: Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function compareWithBaseline(result, baseline) {
  const current = createBaseline(result);
  const regressions = [];
  for (const [group, count] of Object.entries(current.groups)) {
    const allowed = baseline.groups?.[group] ?? 0;
    if (count > allowed) regressions.push({ group, allowed, actual: count });
  }
  return { current, regressions };
}

function summarize(result) {
  const byWorkspace = new Map();
  const byFile = new Map();
  for (const finding of result.findings) {
    byWorkspace.set(finding.workspace, (byWorkspace.get(finding.workspace) ?? 0) + 1);
    byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
  }

  console.log(
    `Localization audit: ${result.findings.length} findings, `
      + `${result.suppressed.length} approved literals, ${byFile.size} affected files.`,
  );
  console.log('');
  console.log('By workspace:');
  for (const [workspace, count] of [...byWorkspace].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${workspace.padEnd(10)} ${count}`);
  }
  console.log('');
  console.log('Largest files:');
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${String(count).padStart(4)}  ${file}`);
  }
}

function parseArgs(args) {
  return {
    ci: args.includes('--ci'),
    json: args.includes('--json'),
    writeBaseline: args.includes('--write-baseline'),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = auditRepository();

  if (options.writeBaseline) {
    const baseline = createBaseline(result);
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Wrote ${relative(repoRoot, baselinePath)} with ${baseline.total} findings.`);
    return;
  }

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else summarize(result);

  if (!options.ci) return;
  if (!existsSync(baselinePath)) {
    console.error(`Missing localization baseline: ${relative(repoRoot, baselinePath)}`);
    process.exitCode = 1;
    return;
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const comparison = compareWithBaseline(result, baseline);
  if (comparison.regressions.length === 0) {
    console.log(`No localization regressions (current ${comparison.current.total}, baseline ${baseline.total}).`);
    return;
  }
  console.error('Localization regressions:');
  for (const regression of comparison.regressions) {
    console.error(`  ${regression.group}: ${regression.actual} > ${regression.allowed}`);
  }
  process.exitCode = 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
