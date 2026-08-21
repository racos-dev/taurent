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
});
