import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAddServerScreenController } from '../useAddServerScreenController';

describe('useAddServerScreenController', () => {
  it('keeps entered values and shows an error when connection after add fails', async () => {
    const addServer = vi.fn().mockResolvedValue({ id: 'server-1' });
    const onSuccess = vi.fn().mockRejectedValue(new Error('auth error: invalid credentials'));
    const bridgeServers = {
      normalizeServerUrl: vi.fn().mockResolvedValue({ normalized: 'http://localhost:8080' }),
    };
    const { result } = renderHook(() =>
      useAddServerScreenController({ addServer, onSuccess, bridgeServers }),
    );

    act(() => {
      result.current.setName('Local qBittorrent');
      result.current.setUrl('localhost:8080');
      result.current.setUsername('admin');
      result.current.setPassword('adminadmin');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.name).toBe('Local qBittorrent');
    expect(result.current.url).toBe('http://localhost:8080');
    expect(result.current.username).toBe('admin');
    expect(result.current.password).toBe('adminadmin');
    expect(result.current.error).toBe('invalid credentials');
    expect(result.current.isSubmitting).toBe(false);
  });
});
