import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  LocalizationProvider,
  initializeLocalization,
  resetLocalizationForTests,
} from '@taurent/shared/i18n';
import { reportOperationFailure } from './operationFailureReporter';
import { useOperationNotifications } from './useOperationNotifications';

vi.mock('@taurent/bridge', () => ({
  onOperationFailed: vi.fn(() => vi.fn()),
}));

function NotificationProbe({ notify }: { notify: (message: string) => void }) {
  useOperationNotifications({ notify });
  return null;
}

describe('useOperationNotifications localization', () => {
  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, 'ro');
    resetLocalizationForTests();
    await initializeLocalization();
  });

  it('shows localized semantic summaries without leaking raw backend details', async () => {
    const notify = vi.fn();
    render(
      <LocalizationProvider>
        <NotificationProbe notify={notify} />
      </LocalizationProvider>,
    );

    act(() => {
      reportOperationFailure({
        operation: 'unclassified-operation',
        error: new Error('raw backend diagnostic sentinel'),
      });
      reportOperationFailure({
        operation: 'another-operation',
        error: new Error('ECONNREFUSED'),
      });
    });

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
    expect(notify).toHaveBeenNthCalledWith(1, 'Ceva nu a funcționat. Încearcă din nou.');
    expect(notify).toHaveBeenNthCalledWith(
      2,
      'Serverul nu poate fi contactat. Verifică adresa și conexiunea la rețea.',
    );
    expect(notify.mock.calls.flat().join(' ')).not.toContain('raw backend diagnostic sentinel');
  });
});
