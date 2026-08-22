import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { englishCatalogs } from './catalogs/en';
import { romanianCatalogs } from './catalogs/ro';
import { createLocalizedFormatters } from './formatters';

async function createTranslator(locale: 'en' | 'ro') {
  const instance = createInstance();
  await instance.init({
    resources: { en: englishCatalogs, ro: romanianCatalogs },
    lng: locale,
    fallbackLng: 'en',
    initAsync: false,
  });
  return instance.t;
}

describe('localized formatters', () => {
  it('preserves byte units while localizing numbers and sentinel labels', async () => {
    const formatters = createLocalizedFormatters('ro', await createTranslator('ro'));
    expect(formatters.formatBytes(1536, 2)).toBe('1,50 KB');
    expect(formatters.formatBytes(-1)).toBe('Nelimitat');
  });

  it('uses localized boolean labels', async () => {
    const formatters = createLocalizedFormatters('ro', await createTranslator('ro'));
    expect(formatters.formatBoolean(true)).toBe('Da');
    expect(formatters.formatBoolean(false)).toBe('Nu');
  });

  it('formats counts, percentages, ratios, speeds, and compact durations with the locale', async () => {
    const formatters = createLocalizedFormatters('ro', await createTranslator('ro'));

    expect(formatters.formatCount(1234)).toBe('1.234');
    expect(formatters.formatPercent(0.125, 1)).toBe('12,5 %');
    expect(formatters.formatRatio(1.5)).toBe('1,50');
    expect(formatters.formatSpeed(1536, 2)).toBe('1,50 KB/s');
    expect(formatters.formatDuration(120)).toBe('2min');
    expect(formatters.formatEta(30)).toBe('30s');
  });

  it('preserves formatter sentinel semantics', async () => {
    const formatters = createLocalizedFormatters('ro', await createTranslator('ro'));

    expect(formatters.formatCount(-1)).toBe('-');
    expect(formatters.formatDuration(0)).toBe('-');
    expect(formatters.formatEta(0)).toBe('∞');
    expect(formatters.formatRatio(null)).toBe('Indisponibil');
    expect(formatters.formatSpeed(-1)).toBe('Nelimitat');
  });

  it('keeps formatter methods safe to pass as standalone callbacks', async () => {
    const { formatSpeed } = createLocalizedFormatters('ro', await createTranslator('ro'));

    expect(formatSpeed(1536, 2)).toBe('1,50 KB/s');
  });
});
