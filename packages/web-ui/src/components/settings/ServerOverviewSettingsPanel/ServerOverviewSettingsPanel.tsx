import React, { useCallback, useState, type FormEvent } from 'react';
import { cn, Icon, normalizeServerUrl } from '@taurent/shared';
import { formatUserMessageForContext } from '@taurent/shared/utils/error';
import type { CredentialStatus } from '@taurent/shared/types/server';
import { useAddServerScreenController } from '@taurent/web-core/screens';
import { AddServerForm } from '../../server-setup/AddServerForm';
import { Button } from '../../primitives/Button';
import { Input } from '../../primitives/Input';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { CredentialHealthIndicator } from '../../CredentialHealthIndicator';
import { SettingsCard } from '../SettingsCard';
import { StatusPanel } from '../../shared/StatusPanel';

// Subset of Server from @taurent/shared/types/server — omits isAuthenticated
// so desktop's useServerManager result (which spreads anonymous server objects)
// can be passed directly without casting.
export interface ServerOverviewSettingsPanelServer {
  id: string;
  name: string;
  url: string;
  username?: string;
  credentialStatus?: CredentialStatus;
}

export interface SaveServerData {
  name: string;
  url: string;
  username: string;
  /** Omit or pass empty string to leave the existing password unchanged. */
  password?: string;
  /** Omit or pass empty string to leave the existing API key unchanged. */
  apiKey?: string;
}

export interface ServerOverviewSettingsPanelProps {
  servers: ServerOverviewSettingsPanelServer[];
  currentServer: ServerOverviewSettingsPanelServer | null;
  /** When provided, overrides currentServer?.id for the "active" indicator.
   *  This ensures the active badge reflects the real-time session state even
   *  when the ServerManager's currentServer reference is stale. */
  activeServerIdOverride?: string | null;
  isLoading: boolean;
  error: string | null;
  onAddServer: (
    name: string,
    url: string,
    username: string,
    password: string
  ) => Promise<ServerOverviewSettingsPanelServer>;
  /** Atomic save: updates server profile and optionally the password/API key in one call.
   *  Callers can reconnect the live session after this succeeds. */
  onSaveServer: (serverId: string, data: SaveServerData) => Promise<void>;
  onRemoveServer: (serverId: string) => Promise<void>;
  onSwitchServer: (serverId: string) => Promise<void>;
  /** Bridge servers interface for URL normalization (add-server flow). */
  bridgeServers: {
    normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }>;
  };

  // Edit-mode credential fields
  editPassword: string;
  editApiKey: string;
  editUseApiKey: boolean;
  onEditPasswordChange: (value: string) => void;
  onEditApiKeyChange: (value: string) => void;
  onEditUseApiKeyChange: (value: boolean) => void;
}

interface InlineAddServerFormProps {
  onAddServer: (
    name: string,
    url: string,
    username: string,
    password: string
  ) => Promise<ServerOverviewSettingsPanelServer>;
  onCancel: () => void;
  bridgeServers: {
    normalizeServerUrl(input: { url: string; defaultScheme?: string }): Promise<{ normalized: string }>;
  };
}

const InlineAddServerForm = React.memo<InlineAddServerFormProps>(({
  onAddServer,
  onCancel,
  bridgeServers,
}) => {
  const addController = useAddServerScreenController({
    addServer: async (name, url, username, password) => {
      const server = await onAddServer(name, url, username, password);
      return { id: server.id };
    },
    bridgeServers,
    onSuccess: async () => {
      onCancel();
    },
  });

  return (
    <div className="space-y-4">
      <AddServerForm
        name={addController.name}
        onNameChange={addController.setName}
        url={addController.url}
        onUrlChange={addController.setUrl}
        username={addController.username}
        onUsernameChange={addController.setUsername}
        password={addController.password}
        onPasswordChange={addController.setPassword}
        apiKey=""
        onApiKeyChange={() => {}}
        rememberPassword={addController.rememberPassword}
        onRememberPasswordChange={addController.setRememberPassword}
        useApiKey={false}
        onUseApiKeyChange={() => {}}
        error={addController.error}
        isSubmitting={addController.isSubmitting}
        onSubmit={addController.handleSubmit}
        onCancel={onCancel}
        validationErrors={addController.validationErrors}
        urlSuggestion={addController.urlSuggestion}
      />
    </div>
  );
});

InlineAddServerForm.displayName = 'InlineAddServerForm';

export const ServerOverviewSettingsPanel = React.memo<ServerOverviewSettingsPanelProps>(({
  servers,
  currentServer,
  activeServerIdOverride,
  isLoading,
  error,
  onAddServer,
  onSaveServer,
  onRemoveServer,
  onSwitchServer,
  bridgeServers,
  editPassword,
  editApiKey,
  editUseApiKey,
  onEditPasswordChange,
  onEditApiKeyChange,
  onEditUseApiKeyChange,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditServer = useCallback(
    (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        setEditingServerId(serverId);
        setEditName(server.name);
        setEditUrl(server.url);
        setEditUsername(server.username || '');
        onEditPasswordChange('');
        onEditApiKeyChange('');
        onEditUseApiKeyChange(false);
        setEditError(null);
      }
    },
    [servers, onEditPasswordChange, onEditApiKeyChange, onEditUseApiKeyChange]
  );

  const handleSaveEdit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setEditError(null);

      if (!editingServerId) return;
      if (!editName.trim() || !editUrl.trim()) {
        setEditError('Please fill in all required fields');
        return;
      }
      if (!editUseApiKey && !editUsername.trim()) {
        setEditError('Please fill in all required fields');
        return;
      }

      try {
        const trimmedUrl = editUrl.trim();
        let finalUrl = trimmedUrl;

        if (trimmedUrl.includes('://')) {
          finalUrl = normalizeServerUrl(trimmedUrl);
        } else {
          finalUrl = trimmedUrl.replace(/\/+$/, '').replace(/\/api\/v2$/, '');
          setEditUrl(finalUrl);
        }

        await onSaveServer(editingServerId, {
          name: editName.trim(),
          url: finalUrl,
          username: editUseApiKey ? '' : editUsername.trim(),
          password: editUseApiKey ? undefined : editPassword || undefined,
          apiKey: editUseApiKey ? editApiKey || undefined : undefined,
        });

        setEditingServerId(null);
        setEditName('');
        setEditUrl('');
        setEditUsername('');
        onEditPasswordChange('');
        onEditApiKeyChange('');
        onEditUseApiKeyChange(false);
      } catch (err) {
        setEditError(formatUserMessageForContext(err, 'settings-save'));
      }
    },
    [
      editingServerId,
      editName,
      editUrl,
      editUsername,
      editUseApiKey,
      editPassword,
      editApiKey,
      onSaveServer,
      onEditPasswordChange,
      onEditApiKeyChange,
      onEditUseApiKeyChange,
    ]
  );

  const handleDeleteServer = useCallback(
    async (serverId: string) => {
      try {
        await onRemoveServer(serverId);
      } catch (err) {
        console.error('Failed to delete server:', err);
      }
    },
    [onRemoveServer]
  );

  const handleSwitchServer = useCallback(
    async (serverId: string) => {
      setSwitchError(null);
      try {
        await onSwitchServer(serverId);
      } catch (err) {
        setSwitchError(formatUserMessageForContext(err, 'server-switch'));
      }
    },
    [onSwitchServer]
  );

  return (
    <div className="max-w-4xl space-y-3">
      <SettingsCard
        title="Saved Server List"
        description="Add, switch, edit, or delete saved server profiles. Credentials are saved locally on this device."
      >
        <div className="flex flex-col gap-4 mt-2">
          {!showAddForm && (
            <div>
              <Button onClick={() => setShowAddForm(true)} size="sm" variant="secondary">
                <Icon name="plus" iconSize="md" className="mr-2" />
                Add New Server
              </Button>
            </div>
          )}

          {showAddForm && (
            <div className="rounded-sm border border-border bg-surface p-4">
              <h4 className="text-sm font-semibold text-text-primary mb-4">Add New Server</h4>
              <InlineAddServerForm
                onAddServer={onAddServer}
                onCancel={() => setShowAddForm(false)}
                bridgeServers={bridgeServers}
              />
            </div>
          )}

          {isLoading ? (
            <StatusPanel
              title="Loading saved servers"
              description="Reading saved server profiles."
            />
          ) : error ? (
            <StatusPanel title="Unable to read saved servers" description={error} tone="error" />
          ) : servers.length === 0 && !showAddForm ? (
            <StatusPanel title="No saved server profiles" description="Add a server to get started." />
          ) : (
            <>
              {switchError && (
                <div className="rounded-md border border-error bg-error-20 p-3 text-sm text-error flex items-center gap-2">
                  <Icon name="alert" iconSize="md" className="shrink-0" />
                  <span>{switchError}</span>
                  <button
                    onClick={() => setSwitchError(null)}
                    className="ml-auto shrink-0 rounded-md p-1 hover:bg-error/20 transition-colors"
                    aria-label="Dismiss error"
                  >
                    <Icon name="x" iconSize="xs" />
                  </button>
                </div>
              )}
              <div className="flex flex-col gap-3">
              {servers.map((server) => {
                const isCurrent = activeServerIdOverride != null
                  ? server.id === activeServerIdOverride
                  : currentServer?.id === server.id;

                return (
                  <div
                    key={server.id}
                    className={cn(
                      'group relative flex flex-col rounded-sm border transition-all duration-200 overflow-hidden',
                      isCurrent
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-surface hover:border-border-focus'
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                    )}

                    <div className="p-3">
                      {editingServerId === server.id ? (
                        <form onSubmit={handleSaveEdit} className="space-y-4">
                          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <Icon name="settings" iconSize="md" /> Edit Server
                          </h4>

                          {editError && (
                            <div className="rounded-md border border-error bg-error-20 p-3 text-sm text-error">
                              {editError}
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                Server Name <span className="text-error">*</span>
                              </label>
                              <Input
                                type="text"
                                value={editName}
                                onChange={setEditName}
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                Server URL <span className="text-error">*</span>
                              </label>
                              <Input
                                type="text"
                                value={editUrl}
                                onChange={setEditUrl}
                              />
                            </div>

                            {!editUseApiKey && (
                              <div className="space-y-1">
                                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                  Username <span className="text-error">*</span>
                                </label>
                                <Input
                                  type="text"
                                  value={editUsername}
                                  onChange={setEditUsername}
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                {editUseApiKey ? 'API Key' : 'Password'}
                              </label>
                              <Input
                                type={editUseApiKey ? 'text' : 'password'}
                                value={editUseApiKey ? editApiKey : editPassword}
                                onChange={editUseApiKey ? onEditApiKeyChange : onEditPasswordChange}
                                placeholder={editUseApiKey ? 'Enter API key' : 'Enter password to update'}
                              />
                            </div>
                          </div>

                          <label className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background p-3 cursor-pointer select-none transition-colors hover:border-border-focus">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-medium text-text-primary">Use API Key</span>
                              <span className="text-xs text-text-secondary">
                                Authenticate with a qBittorrent API key instead of a username and password
                              </span>
                            </div>
                            <ToggleSwitch checked={editUseApiKey} onChange={onEditUseApiKeyChange} />
                          </label>

                          <div className="flex gap-3 pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingServerId(null)}
                            >
                              Cancel
                            </Button>
                            <Button type="submit">
                              Save Changes
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-4">

                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors",
                                isCurrent ? "bg-primary/20 text-primary" : "bg-surface-elevated text-text-secondary group-hover:text-primary group-hover:bg-primary/10"
                              )}>
                                <Icon name="server" iconSize="lg" />
                              </div>

                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-semibold text-text-primary" title={server.name}>
                                    {server.name}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-xs uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-1 rounded-sm">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary font-mono truncate" title={`${server.url} ${server.username ? `• ${server.username}` : ''}`}>
                                  <span>{server.url}</span>
                                  {server.username ? (
                                    <>
                                      <span className="text-text-muted">•</span>
                                      <span className="text-text-muted font-sans">{server.username}</span>
                                    </>
                                  ) : null}
                                </div>
                                {server.credentialStatus ? (
                                  <CredentialHealthIndicator
                                    credentialStatus={server.credentialStatus}
                                    className="mt-1"
                                  />
                                ) : null}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!isCurrent && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleSwitchServer(server.id)}
                                  className="mr-2"
                                >
                                  Connect
                                </Button>
                              )}

                              <div className="flex items-center gap-1 border-l border-border pl-2">
                                <button
                                  onClick={() => handleEditServer(server.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-interactive hover:text-text-primary transition-colors"
                                  title="Edit server"
                                >
                                  <Icon name="settings" iconSize="md" />
                                </button>
                                <button
                                  onClick={() => handleDeleteServer(server.id)}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-error-20 hover:text-error transition-colors"
                                  title="Delete server"
                                >
                                  <Icon name="trash" iconSize="md" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
      </SettingsCard>
    </div>
  );
});

ServerOverviewSettingsPanel.displayName = 'ServerOverviewSettingsPanel';
