import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LocalizationProvider,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  initializeLocalization,
  resetLocalizationForTests,
  useLocalization,
  useTaurentTranslation,
} from '@taurent/shared/i18n';

function StatefulServerEditor() {
  const { setPreference } = useLocalization();
  const { t } = useTaurentTranslation('auth');
  const [serverName, setServerName] = useState('');

  return (
    <div>
      <h1>{t('server.savedListTitle')}</h1>
      <label>
        {t('server.name')}
        <input value={serverName} onChange={(event) => setServerName(event.target.value)} />
      </label>
      <button type="button" onClick={() => void setPreference('ro')}>
        Română
      </button>
    </div>
  );
}

describe('shared LocalizationProvider', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, 'en');
    resetLocalizationForTests();
    await initializeLocalization();
  });

  it('rerenders visible text without discarding component state', async () => {
    render(
      <LocalizationProvider>
        <StatefulServerEditor />
      </LocalizationProvider>,
    );

    const input = screen.getByRole('textbox', { name: 'Server Name' });
    fireEvent.change(input, { target: { value: 'Home seedbox' } });
    fireEvent.click(screen.getByRole('button', { name: 'Română' }));

    await screen.findByRole('heading', { name: 'Lista serverelor salvate' });
    expect((screen.getByRole('textbox', { name: 'Numele serverului' }) as HTMLInputElement).value)
      .toBe('Home seedbox');
    await waitFor(() => expect(document.documentElement.lang).toBe('ro'));
  });
});
