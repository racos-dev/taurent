import React, { useCallback, useState, type FormEvent } from 'react';
import { cn, Icon, normalizeServerUrl } from '@taurent/shared';
import { formatUserMessageForContext, getErrorMessage } from '@taurent/shared/utils/error';
import type { CredentialStatus } from '@taurent/shared/types/server';
import type { ServerUrlProbeBridge } from '@taurent/bridge';
import { useAddServerScreenController } from '@taurent/web-core/screens';
import { AddServerFormBody } from '../../server-setup/AddServerForm/AddServerFormBody';
import { Button } from '../../primitives/Button';
import { Input } from '../../primitives/Input';
import { CredentialHealthIndicator } from '../../CredentialHealthIndicator';
import { SettingsCard } from '../SettingsCard';
import { StatusPanel } from '../../shared/StatusPanel';
import { Spinner } from '../../shared/Spinner';

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
  /** Atomic save: updates server profile and optionally the password in one call.
   *  Callers can reconnect the live session after this succeeds. */
  onSaveServer: (serverId: string, data: SaveServerData) => Promise<void>;
  onRemoveServer: (serverId: string) => Promise<void>;
  /** Test connection for a new (unsaved) server before adding it. */
  onTestConnection: (
    url: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onTestSavedServerConnection: (
    serverId: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSwitchServer: (serverId: string) => Promise<void>;
  /** Bridge servers interface for URL normalization and scheme probing (add-server flow). */
  bridgeServers: ServerUrlProbeBridge;
}

interface TestResult {
  success: boolean;
  message: string;
}

interface InlineAddServerFormProps {
  onAddServer: (
    name: string,
    url: string,
    username: string,
    password: string
  ) => Promise<ServerOverviewSettingsPanelServer>;
  onCancel: () => void;
  bridgeServers: ServerUrlProbeBridge;
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
      <AddServerFormBody
        variant="desktop"
        name={addController.name}
        onNameChange={addController.setName}
        url={addController.url}
        onUrlChange={addController.setUrl}
        username={addController.username}
        onUsernameChange={addController.setUsername}
        password={addController.password}
        onPasswordChange={addController.setPassword}
        error={addController.error}
        testResult={addController.testResult}
        testingConnection={addController.isTesting}
        loading={addController.isSubmitting}
        onTestConnection={addController.handleTestConnection}
        onSubmit={addController.handleSubmit}
        validationErrors={addController.validationErrors}
        testErrorSuggestion={addController.urlSuggestion}
      />
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
});

InlineAddServerForm.displayName = 'InlineAddServerForm';

/**
 * Check whether a URL already has an http/https scheme.
 */
function hasScheme(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Check whether an error message indicates a network-level failure
 * that may be scheme-dependent (e.g., https port closed but http open).
 */
function isNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('connection refused') ||
    lower.includes('connection failed') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('error sending request')
  );
}

/**
 * Auto-detect the scheme for a URL. Tries https first, falls back to http
 * on network-level failures. Does NOT retry on auth failures, TLS errors,
 * or HTTP errors.
 *
 * Returns the full URL with discovered scheme and the test result on success,
 * or an error string on failure.
 */
async function detectScheme(
  rawUrl: string,
  username: string,
  password: string,
  testConnection: (
    url: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>,
): Promise<{ fullUrl: string; result: { success: boolean; error?: string } } | { error: string }> {
  // If URL already has a scheme, just test it directly
  if (hasScheme(rawUrl)) {
    const normalized = normalizeServerUrl(rawUrl);
    try {
      const result = await testConnection(normalized, username, password);
      return { fullUrl: normalized, result };
    } catch (err) {
      return { error: formatUserMessageForContext(err, 'connection') };
    }
  }

  const httpsUrl = normalizeServerUrl(rawUrl, 'https://');
  const httpUrl = normalizeServerUrl(rawUrl, 'http://');

  // Try https first
  let httpsResult: { success: boolean; error?: string };
  try {
    httpsResult = await testConnection(httpsUrl, username, password);
  } catch (err) {
    httpsResult = { success: false, error: getErrorMessage(err) };
  }

  if (httpsResult.success) {
    return { fullUrl: httpsUrl, result: httpsResult };
  }

  // Only retry on network-level failures
  if (httpsResult.error && isNetworkError(httpsResult.error)) {
    let httpResult: { success: boolean; error?: string };
    try {
      httpResult = await testConnection(httpUrl, username, password);
    } catch (err) {
      httpResult = { success: false, error: getErrorMessage(err) };
    }

    if (httpResult.success) {
      return { fullUrl: httpUrl, result: httpResult };
    }
    // Both failed — return https error (primary attempt)
    return { error: formatUserMessageForContext(httpsResult.error, 'connection') };
  }

  // Non-network error (auth, TLS, HTTP error, etc.) — surface to user
  return { error: formatUserMessageForContext(httpsResult.error || 'Connection failed', 'connection') };
}

export const ServerOverviewSettingsPanel = React.memo<ServerOverviewSettingsPanelProps>(({
  servers,
  currentServer,
  activeServerIdOverride,
  isLoading,
  error,
  onAddServer,
  onSaveServer,
  onRemoveServer,
  onTestConnection,
  onTestSavedServerConnection,
  onSwitchServer,
  bridgeServers,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [switchError, setSwitchError] = useState<string | null>(null);

  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const handleEditServer = useCallback(
    (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        setEditingServerId(serverId);
        setEditName(server.name);
        setEditUrl(server.url);
        setEditUsername(server.username || '');
        setEditPassword('');
        setEditError(null);
      }
    },
    [servers]
  );

  const handleSaveEdit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setEditError(null);

      if (!editingServerId) return;
      if (!editName.trim() || !editUrl.trim() || !editUsername.trim()) {
        setEditError('Please fill in all required fields');
        return;
      }

      try {
        let saveUrl = editUrl.trim();

        // If the edited URL has no scheme, run auto-detect before saving
        if (!hasScheme(saveUrl)) {
          setTestingServerId(editingServerId);
          const detection = await detectScheme(
            saveUrl,
            editUsername.trim(),
            editPassword,
            onTestConnection,
          );
          setTestingServerId(null);

          if ('error' in detection) {
            setEditError(detection.error);
            return;
          }

          // Use the discovered scheme URL for saving
          saveUrl = detection.fullUrl;
          setEditUrl(saveUrl);
        }

        await onSaveServer(editingServerId, {
          name: editName.trim(),
          url: saveUrl,
          username: editUsername.trim(),
          password: editPassword || undefined,
        });

        setEditingServerId(null);
        setEditName('');
        setEditUrl('');
        setEditUsername('');
        setEditPassword('');
      } catch (err) {
        setEditError(formatUserMessageForContext(err, 'settings-save'));
      }
    },
    [editingServerId, editName, editUrl, editUsername, editPassword, onSaveServer, onTestConnection],
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

  const handleTestConnection = useCallback(
    async (serverId: string) => {
      setTestingServerId(serverId);
      try {
        // If this server is currently being edited and the URL was changed without a scheme,
        // test the edited URL with auto-detect instead of the saved server
        if (editingServerId === serverId) {
          const server = servers.find((s) => s.id === serverId);
          const trimmedEditUrl = editUrl.trim();
          const urlChanged = server && trimmedEditUrl !== server.url;
          const noScheme = !hasScheme(trimmedEditUrl);

          if (urlChanged && noScheme) {
            const detection = await detectScheme(
              trimmedEditUrl,
              editUsername.trim(),
              editPassword,
              onTestConnection,
            );

            if ('error' in detection) {
              setTestResults((prev) => ({
                ...prev,
                [serverId]: {
                  success: false,
                  message: detection.error,
                },
              }));
            } else {
              // Update editUrl with the discovered scheme
              setEditUrl(detection.fullUrl);
              setTestResults((prev) => ({
                ...prev,
                [serverId]: {
                  success: detection.result.success,
                  message: detection.result.success
                    ? 'Connection successful!'
                    : formatUserMessageForContext(detection.result.error ?? 'Connection failed', 'connection'),
                },
              }));
            }
          } else {
            // URL has scheme or wasn't changed — test the edited URL directly
            const result = await onTestConnection(trimmedEditUrl, editUsername.trim(), editPassword);
            setTestResults((prev) => ({
              ...prev,
              [serverId]: {
                success: result.success,
                message: result.success
                  ? 'Connection successful!'
                  : formatUserMessageForContext(result.error ?? 'Connection failed', 'connection'),
              },
            }));
          }
        } else {
          const result = await onTestSavedServerConnection(serverId);
          setTestResults((prev) => ({
            ...prev,
            [serverId]: {
              success: result.success,
              message: result.success
                ? 'Connection successful!'
                : formatUserMessageForContext(result.error ?? 'Connection failed', 'connection'),
            },
          }));
        }
      } catch {
        setTestResults((prev) => ({
          ...prev,
          [serverId]: {
            success: false,
            message: 'Connection test failed',
          },
        }));
      } finally {
        setTestingServerId(null);
      }
    },
    [editingServerId, editUrl, editUsername, editPassword, onTestConnection, onTestSavedServerConnection, servers],
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
        description="Add, switch, test, edit, or delete saved server profiles. Credentials are saved locally on this device."
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

                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                New Password <span className="text-text-muted lowercase normal-case font-normal">(leave blank to keep current)</span>
                              </label>
                              <Input
                                type="password"
                                value={editPassword}
                                onChange={setEditPassword}
                              />
                            </div>
                          </div>

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
                                <div className="flex items-center gap-2 mt-1 text-xs text-text-secondary font-mono truncate" title={`${server.url} • ${server.username ? server.username : 'No username'}`}>
                                  <span>{server.url}</span>
                                  <span className="text-text-muted">•</span>
                                  <span className="text-text-muted font-sans">{server.username ? server.username : 'No username'}</span>
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
                                  onClick={() => handleTestConnection(server.id)}
                                  disabled={testingServerId === server.id}
                                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-interactive hover:text-text-primary transition-colors disabled:text-text-disabled"
                                  title="Test connection"
                                >
                                  {testingServerId === server.id ? (
                                    <Spinner variant="ring" size="md" />
                                  ) : (
                                    <Icon name="globe" iconSize="md" />
                                  )}
                                </button>
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

                          {testResults[server.id] && (
                            <div
                              className={cn(
                                'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium mt-1 w-fit',
                                testResults[server.id].success
                                  ? 'bg-success-20 text-success'
                                  : 'bg-error-20 text-error'
                              )}
                            >
                              {testResults[server.id].success ? (
                                <Icon name="check" iconSize="md" />
                              ) : (
                                <Icon name="x" iconSize="md" />
                              )}
                              {testResults[server.id].message}
                            </div>
                          )}
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
