import React from 'react';
import { ServerOverviewSettingsPanel } from '@taurent/web-ui';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import { useQBClient, useServerManager } from '../../connection';
import { openServerDeleteDialogWindow } from '../../windows/dialogs/serverDeleteDialogWindow';

export const ServerOverviewSettings = React.memo(() => {
  const {
    servers,
    currentServer,
    loading,
    error,
    addServer,
    updateServer,
    updateServerCredentials,
    testServerConnection,
    testSavedServerConnection,
    switchServer,
  } = useServerManager();
  const { connect, serverId: activeServerId } = useQBClient();

  const handleSwitchServer = React.useCallback(
    async (serverId: string) => {
      // Atomic switch: loads credentials, authenticates, probes — all before
      // touching session. No follow-up connect() call needed.
      await switchServer(serverId);
    },
    [switchServer],
  );

  // Atomic save handler — persists server profile and optionally the password in
  // one call, then reconnects the live Rust session when the currently active
  // server was edited.  This invalidates sessionGeneration so the main window
  // refreshes its maindata and torrent list instead of showing stale content.
  const handleSaveServer = React.useCallback(
    async (
      serverId: string,
      data: { name: string; url: string; username: string; password?: string },
    ) => {
      // Persist the name/url/username fields.
      await updateServer(serverId, {
        name: data.name,
        url: data.url,
        username: data.username,
      });

      // Persist the password only when a new one is supplied.
      if (data.password) {
        await updateServerCredentials(serverId, data.url, data.username, data.password);
      }

      // Reconnect if the edited server is the currently active one.
      if (serverId === activeServerId) {
        await connect(serverId);
      }
    },
    [updateServer, updateServerCredentials, activeServerId, connect],
  );

  const requestRemoveServer = React.useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      await openServerDeleteDialogWindow({ serverId, serverName: server?.name ?? '' });
    },
    [servers],
  );

  return (
    <ServerOverviewSettingsPanel
      servers={servers}
      currentServer={currentServer}
      activeServerIdOverride={activeServerId}
      isLoading={loading}
      error={error}
      onAddServer={addServer}
      onSaveServer={handleSaveServer}
      onRemoveServer={requestRemoveServer}
      onTestConnection={testServerConnection}
      onTestSavedServerConnection={testSavedServerConnection}
      onSwitchServer={handleSwitchServer}
      bridgeServers={BridgeAdapter.servers}
    />
  );
});

ServerOverviewSettings.displayName = 'ServerOverviewSettings';
