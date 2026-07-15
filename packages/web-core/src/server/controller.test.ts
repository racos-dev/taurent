import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ServerBridgeInterface } from './controller';
import { useServerManagerController } from './controller';

function createBridge(): ServerBridgeInterface {
  return {
    listServers: vi.fn().mockResolvedValue([]),
    getActiveServer: vi.fn().mockResolvedValue(null),
    addServer: vi.fn().mockResolvedValue({
      id: 'server-1',
      name: 'Local qBittorrent',
      url: 'http://localhost:8080',
      username: 'admin',
    }),
    updateServer: vi.fn(),
    removeServer: vi.fn(),
    selectServer: vi.fn(),
    sessionSwitchServerById: vi.fn(),
  };
}

describe('useServerManagerController add flow', () => {
  it('does not select a newly persisted server before authentication succeeds', async () => {
    const bridge = createBridge();
    const { result } = renderHook(() => useServerManagerController({ bridge }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addServer(
        'Local qBittorrent',
        'http://localhost:8080',
        'admin',
        'adminadmin',
      );
    });

    expect(result.current.servers).toHaveLength(1);
    expect(result.current.currentServer).toBeNull();
    expect(bridge.sessionSwitchServerById).not.toHaveBeenCalled();
  });
});
