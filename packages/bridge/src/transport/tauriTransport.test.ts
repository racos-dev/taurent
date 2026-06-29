import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

import {
  createOperationFailedListener,
  createResourceInvalidatedListener,
  createSessionEventListener,
  createTauriTransport,
  createThemeChangedListener,
  invokeWrap,
  tauriInvoke,
} from './tauriTransport';

type ListenerCallback = (event: { payload: unknown }) => void;

describe('tauriTransport', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it('passes Error instances through invokeWrap', async () => {
    const error = new Error('boom');

    await expect(invokeWrap(Promise.reject(error))).rejects.toBe(error);
  });

  it('normalizes non-Error rejections in invokeWrap', async () => {
    await expect(invokeWrap(Promise.reject('boom'))).rejects.toThrow('boom');
  });

  it('delegates tauriInvoke to the tauri invoke API', async () => {
    invokeMock.mockResolvedValue({ ok: true });

    await expect(tauriInvoke('ping', { id: 1 })).resolves.toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledWith('ping', { id: 1 });
  });

  it('creates a transport that unwraps listen payloads', async () => {
    const unlisten = vi.fn();
    let handler: ((event: { payload: unknown }) => void) | undefined;

    listenMock.mockImplementation(async (_event: string, callback: ListenerCallback) => {
      handler = callback;
      return unlisten;
    });

    const transport = createTauriTransport();
    const received: unknown[] = [];
    const returned = await transport.listen('resource-invalidated', (payload) => {
      received.push(payload);
    });

    handler?.({ payload: { resource: 'torrents' } });

    expect(returned).toBe(unlisten);
    expect(listenMock).toHaveBeenCalledWith('resource-invalidated', expect.any(Function));
    expect(received).toEqual([{ resource: 'torrents' }]);
  });

  it.each<[
    string,
    (callback: (event: unknown) => void) => Promise<() => void | Promise<void>>,
    unknown,
  ]>([
    ['session-changed', createSessionEventListener, { generation: 1 }],
    ['resource-invalidated', createResourceInvalidatedListener, { resource: 'tags' }],
    ['operation-failed', createOperationFailedListener, { operation: 'pause' }],
    ['theme-changed', createThemeChangedListener, { theme: 'dark' }],
  ])('registers %s listeners and forwards payloads', async (eventName, factory, payload) => {
    const unlisten = vi.fn();
    let handler: ((event: { payload: unknown }) => void) | undefined;
    const received: unknown[] = [];

    listenMock.mockImplementationOnce(async (event: string, callback: ListenerCallback) => {
      expect(event).toBe(eventName);
      handler = callback;
      return unlisten;
    });

    const returned = await factory((event: unknown) => {
      received.push(event);
    });

    handler?.({ payload });

    expect(returned).toBe(unlisten);
    expect(received).toEqual([payload]);
  });
});
