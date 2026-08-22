import { describe, expect, it } from 'vitest';
import { englishCatalogs } from './catalogs/en';
import { createPseudoCatalog, pseudoLocalizeText } from './pseudo';

describe('pseudo localization', () => {
  it('expands copy while preserving named interpolation and markup', () => {
    const result = pseudoLocalizeText('Delete {{count}} <strong>torrents</strong>');

    expect(result).toContain('{{count}}');
    expect(result).toContain('<strong>');
    expect(result).toContain('</strong>');
    expect(result).toMatch(/^［.*］$/);
    expect(result.length).toBeGreaterThan('Delete {{count}} <strong>torrents</strong>'.length);
  });

  it('creates a new complete catalog without mutating English', () => {
    const pseudo = createPseudoCatalog(englishCatalogs);

    expect(pseudo.common.language.title).not.toBe(englishCatalogs.common.language.title);
    expect(pseudo.torrents.selected_other).toContain('{{count}}');
    expect(englishCatalogs.common.language.title).toBe('Language');
    expect(Object.keys(pseudo)).toEqual(Object.keys(englishCatalogs));
  });
});

