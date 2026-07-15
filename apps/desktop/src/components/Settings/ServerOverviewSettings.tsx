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
    switchServer,
  } = useServerManager();
  const { connect, serverId: activeServerId } = useQBClient();

  const [editPassword, setEditPassword] = React.useState('');
  const [editApiKey, setEditApiKey] = React.useState('');
  const [editUseApiKey, setEditUseApiKey] = React.useState(false);

  const handleSwitchServer = React.useCallback(
    async (serverId: string) => {
      // Atomic switch: loads credentials, authenticates, probes — all before
      // touching session. No follow-up connect() call needed.
      await switchServer(serverId);
    },
    [switchServer],
  );

  // Atomic save handler — persists server profile and optionally the password/API key in
  // one call, then reconnects the live Rust session when the currently active
  // server was edited.  This invalidates sessionGeneration so the main window
  // refreshes its maindata and torrent list instead of showing stale content.
  const handleSaveServer = React.useCallback(
    async (
      serverId: string,
      data: { name: string; url: string; username: string; password?: string; apiKey?: string },
    ) => {
      await updateServer(serverId, {
        name: data.name,
        url: data.url,
        username: data.username,
        password: data.password,
        apiKey: data.apiKey ? data.apiKey : data.password ? null : undefined,
      });

      // Reconnect if the edited server is the currently active one.
      if (serverId === activeServerId) {
        await connect(serverId);
      }
    },
    [updateServer, activeServerId, connect],
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
      onSwitchServer={handleSwitchServer}
      bridgeServers={BridgeAdapter.servers}
      editPassword={editPassword}
      editApiKey={editApiKey}
      editUseApiKey={editUseApiKey}
      onEditPasswordChange={setEditPassword}
      onEditApiKeyChange={setEditApiKey}
      onEditUseApiKeyChange={setEditUseApiKey}
    />
  );
});

ServerOverviewSettings.displayName = 'ServerOverviewSettings';
