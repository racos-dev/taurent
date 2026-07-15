import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../connection/QBClientProvider', () => ({
  useQBClient: vi.fn(),
}));

vi.mock('../../connection/ServerManager', () => ({
  useServerManager: vi.fn(),
}));

import { AuthBoundary } from '../AuthBoundary';
import { useQBClient } from '../../connection/QBClientProvider';
import { useServerManager } from '../../connection/ServerManager';
import { makeAppCapabilities } from '@taurent/web-core/capabilities';

const mockUseQBClient = vi.mocked(useQBClient);
const mockUseServerManager = vi.mocked(useServerManager);

describe('AuthBoundary', () => {
  it('renders loading screen while hydrating', () => {
    mockUseServerManager.mockReturnValue({
      servers: [],
      currentServer: null,
      loading: false,
      error: null,
      addServer: vi.fn(),
      removeServer: vi.fn(),
      updateServer: vi.fn(),
      refreshServers: vi.fn(),
      switchServer: vi.fn(),
    });
    mockUseQBClient.mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      retry: vi.fn(),
      isConnected: false,
      isConnecting: false,
      isHydrated: false,
      sessionGeneration: 0,
      serverId: null,
      serverName: null,
      serverUrl: null,
      apiVersion: null,
      appVersion: null,
      error: null,
      retryState: { isRetrying: false, attemptCount: 0, maxAttempts: 3 },
      capabilities: makeAppCapabilities({ supportsSearch: false, supportsRss: false, supportsWebseedManagement: false }),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthBoundary />
      </MemoryRouter>,
    );

    expect(screen.getByText('Initializing...')).toBeDefined();
  });

  it('renders loading screen while servers are loading', () => {
    mockUseServerManager.mockReturnValue({
      servers: [],
      currentServer: null,
      loading: true,
      error: null,
      addServer: vi.fn(),
      removeServer: vi.fn(),
      updateServer: vi.fn(),
      refreshServers: vi.fn(),
      switchServer: vi.fn(),
    });
    mockUseQBClient.mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      retry: vi.fn(),
      isConnected: false,
      isConnecting: false,
      isHydrated: true,
      sessionGeneration: 0,
      serverId: null,
      serverName: null,
      serverUrl: null,
      apiVersion: null,
      appVersion: null,
      error: null,
      retryState: { isRetrying: false, attemptCount: 0, maxAttempts: 3 },
      capabilities: makeAppCapabilities({ supportsSearch: false, supportsRss: false, supportsWebseedManagement: false }),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthBoundary />
      </MemoryRouter>,
    );

    expect(screen.getByText('Loading servers...')).toBeDefined();
  });
});
