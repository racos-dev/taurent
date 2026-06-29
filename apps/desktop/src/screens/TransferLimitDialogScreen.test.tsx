import React, { act } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferLimitDialogScreen } from './TransferLimitDialogScreen';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  setTitle: vi.fn(async () => {}),
  emit: vi.fn(async () => {}),
  dismissDialogWindow: vi.fn(async () => {}),
  getDownloadLimit: vi.fn(async () => ({ limit: 50 * 1024 })),
  getUploadLimit: vi.fn(async () => ({ limit: 100 * 1024 })),
  setDownloadLimit: vi.fn(async () => ({ ok: true })),
  setUploadLimit: vi.fn(async () => ({ ok: true })),
  setPreferences: vi.fn(async () => ({ ok: true })),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mocks.searchParams],
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setTitle: mocks.setTitle }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: mocks.emit,
}));

vi.mock('@taurent/bridge/adapters/desktop', () => ({
  BridgeAdapter: {
    transfer: {
      getDownloadLimit: mocks.getDownloadLimit,
      getUploadLimit: mocks.getUploadLimit,
      setDownloadLimit: mocks.setDownloadLimit,
      setUploadLimit: mocks.setUploadLimit,
    },
    application: {
      setPreferences: mocks.setPreferences,
    },
  },
}));

vi.mock('@taurent/web-ui', () => ({
  DialogActions: ({
    actions,
  }: {
    actions: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
  }) => (
    <div>
      {actions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </button>
      ))}
    </div>
  ),
  NumberInput: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & {
      unitMode?: 'bytes' | 'bytes-per-second';
      unitDefault?: string;
      onValueChange?: (value: number) => void;
    }
  >(({ unitMode, unitDefault, onValueChange, onChange, value, ...props }, ref) => {
    const factor = unitMode && unitDefault !== 'b' ? 1024 : 1;
    const displayValue = unitMode ? String(Number(value ?? 0) / factor) : value;

    return (
      <input
        ref={ref}
        type="number"
        value={displayValue}
        onChange={(event) => {
          onValueChange?.(unitMode ? Number(event.target.value) * factor : Number(event.target.value));
          onChange?.(event);
        }}
        {...props}
      />
    );
  }),
}));

vi.mock('../connection/QBClientProvider', () => ({
  useQBClient: () => ({ serverId: 'server-1', sessionGeneration: 42 }),
}));

vi.mock('../windows/dialogs/dialogHostWindow', () => ({
  dismissDialogWindow: mocks.dismissDialogWindow,
}));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('TransferLimitDialogScreen', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.setTitle.mockClear();
    mocks.emit.mockClear();
    mocks.dismissDialogWindow.mockClear();
    mocks.getDownloadLimit.mockResolvedValue({ limit: 50 * 1024 });
    mocks.getUploadLimit.mockResolvedValue({ limit: 100 * 1024 });
    mocks.getDownloadLimit.mockClear();
    mocks.getUploadLimit.mockClear();
    mocks.setDownloadLimit.mockClear();
    mocks.setUploadLimit.mockClear();
    mocks.setPreferences.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('submits combined global download and upload limits as bytes per second', async () => {
    mocks.searchParams = new URLSearchParams({ mode: 'combined' });

    const { container, getByText } = render(<TransferLimitDialogScreen />);
    await act(async () => {
      await delay(0);
    });

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('50');
    expect(inputs[1].value).toBe('100');

    fireEvent.change(inputs[0], { target: { value: '2048' } });
    fireEvent.change(inputs[1], { target: { value: '4096' } });
    await act(async () => {
      fireEvent.click(getByText('Set'));
    });

    expect(mocks.setDownloadLimit).toHaveBeenCalledWith(2048 * 1024);
    expect(mocks.setUploadLimit).toHaveBeenCalledWith(4096 * 1024);
    expect(mocks.setPreferences).not.toHaveBeenCalled();
    expect(mocks.emit).toHaveBeenCalledWith(
      'resource-invalidated',
      { resource: 'transfer', server_id: 'server-1', session_generation: 42 }
    );
    expect(mocks.emit).toHaveBeenCalledWith(
      'resource-invalidated',
      { resource: 'preferences', server_id: 'server-1', session_generation: 42 }
    );
    expect(mocks.dismissDialogWindow).toHaveBeenCalledTimes(1);
  });

  it('keeps single-direction global upload submission on the upload setter only', async () => {
    mocks.searchParams = new URLSearchParams({
      mode: 'single',
      direction: 'upload',
      value: String(256 * 1024),
      isAltSpeed: '0',
    });

    const { container, getByText } = render(<TransferLimitDialogScreen />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('256');

    fireEvent.change(input!, { target: { value: '512' } });
    await act(async () => {
      fireEvent.click(getByText('Set'));
    });

    expect(mocks.setDownloadLimit).not.toHaveBeenCalled();
    expect(mocks.setUploadLimit).toHaveBeenCalledWith(512 * 1024);
    expect(mocks.setPreferences).not.toHaveBeenCalled();
    expect(mocks.dismissDialogWindow).toHaveBeenCalledTimes(1);
  });
});
