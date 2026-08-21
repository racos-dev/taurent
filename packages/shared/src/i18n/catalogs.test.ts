import { describe, expect, it } from 'vitest';
import { englishCatalogs } from './catalogs/en';
import { romanianCatalogs } from './catalogs/ro';

function flatten(value: object, prefix = ''): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') entries[path] = child;
    else Object.assign(entries, flatten(child, path));
  }
  return entries;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*([^},\s]+).*?}}/g)].map((match) => match[1]).sort();
}

describe('localization catalogs', () => {
  const english = flatten(englishCatalogs);
  const romanian = flatten(romanianCatalogs);

  it('has complete, non-empty Romanian keys', () => {
    expect(Object.keys(romanian).sort()).toEqual(Object.keys(english).sort());
    expect(Object.values(romanian).every((value) => value.trim().length > 0)).toBe(true);
  });

  it('preserves interpolation placeholders', () => {
    for (const key of Object.keys(english)) {
      expect(placeholders(romanian[key]), key).toEqual(placeholders(english[key]));
    }
  });

  it('provides Romanian one, few, and other plural forms', () => {
    expect(romanian['torrents.selected_one']).toBeTruthy();
    expect(romanian['torrents.selected_few']).toBeTruthy();
    expect(romanian['torrents.selected_other']).toBeTruthy();
  });
});
