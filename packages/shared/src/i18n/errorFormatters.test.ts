import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalizedErrorFormatter } from './errorFormatters';
import { initializeLocalization, localization, resetLocalizationForTests } from './runtime';

describe('localized error summaries', () => {
  beforeEach(async () => {
    resetLocalizationForTests();
    await initializeLocalization();
  });

  it('translates classified failures without exposing raw backend copy', async () => {
    const english = createLocalizedErrorFormatter(localization.getFixedT('en', 'errors'));
    expect(english(new Error('network error: socket closed'), 'connection')).toBe(
      'Cannot reach the server. Check the address and your network connection.',
    );

    const { romanianCatalogs } = await import('./catalogs/ro');
    for (const [namespace, resources] of Object.entries(romanianCatalogs)) {
      localization.addResourceBundle('ro', namespace, resources, true, true);
    }
    const romanian = createLocalizedErrorFormatter(localization.getFixedT('ro', 'errors'));
    expect(romanian(new Error('opaque backend failure'), 'connection')).toBe(
      'Conectarea la server a eșuat. Încearcă din nou.',
    );
  });
});
