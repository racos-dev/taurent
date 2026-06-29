import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQBClient, useServerManager } from '../connection';
import { StateCard, CredentialHealthIndicator, CredentialWarningBanner, Spinner } from '@taurent/web-ui';
import { useLoginScreenController } from '@taurent/web-core';
import type { Server } from '@taurent/shared/types/server';
import { Button } from '@taurent/web-ui';
import { cn, Icon } from '@taurent/shared';
import { classifyError, formatUserMessageForContext } from '@taurent/shared/utils/error';
import { openServerDeleteDialogWindow } from '../windows/dialogs/serverDeleteDialogWindow';

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connect, isConnecting, isConnected, isHydrated, error: connectError, serverId: connectedServerId } = useQBClient();
  const { servers, removeServer } = useServerManager();
  const locationState = location.state as { error?: string; errorCategory?: string; suppressConnectedRedirect?: boolean } | null;
  const rawError = locationState?.error ?? connectError ?? null;
  const visibleError = rawError ? formatUserMessageForContext(rawError, 'connection') : null;

  const [dismissedWarning, setDismissedWarning] = useState(false);

  const activeServer = servers.find((s) => s.id === connectedServerId);
  const warningServer = activeServer ?? servers.find((s) => s.credentialWarning);
  const credentialWarning = warningServer?.credentialWarning;

  // ─── Shared controller (server selection + delete) ─────────────
  const controller = useLoginScreenController({
    connect,
    servers,
    removeServer,
    isConnecting,
    connectedServerId,
    onConnectSuccess: () => navigate('/', { replace: true }),
    onConnectError: (msg, category) => navigate('/login', { replace: true, state: { error: msg, errorCategory: category } }),
    classifyError,
  });

  // ─── Redirect if already connected ───────────────────────────
  useEffect(() => {
    if (isHydrated && isConnected && !locationState?.suppressConnectedRedirect) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, isConnected, locationState?.suppressConnectedRedirect, navigate]);

  const getServerStatus = (server: Server) => {
    if (isConnecting && connectedServerId === server.id) return 'connecting';
    if (isConnected && connectedServerId === server.id) return 'connected';
    return 'disconnected';
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-md bg-primary/10 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Icon name="server" className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Connect to Server</h1>
          <p className="text-sm text-text-secondary mt-1">Select your qBittorrent instance to continue</p>
        </div>

        {/* Error Section */}
        {visibleError && (
          <div className="mb-6 p-4 bg-error-20 border border-error rounded-md text-error text-sm text-center shadow-sm">
            {visibleError}
          </div>
        )}

        {/* Credential Warning Banner */}
        {credentialWarning && !dismissedWarning && (
          <div className="mb-4">
            <CredentialWarningBanner
              warning={credentialWarning}
              onDismiss={() => setDismissedWarning(true)}
            />
          </div>
        )}

        {/* Server List Section */}
        <div className="flex flex-col gap-4">
          {servers.length === 0 ? (
            <div className="bg-surface border border-border rounded-md p-6 shadow-sm">
              <StateCard
                title="No Servers Found"
                message="Add your first qBittorrent server to get started"
                className="flex-1 border-none shadow-none bg-transparent"
              />
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {servers.map((server) => {
                const status = getServerStatus(server);
                const isActive = status === 'connecting' || status === 'connected';
                return (
                  <div
                    key={server.id}
                    data-testid="login-server-card"
                    data-server-name={server.name}
                    className={cn(
                      'group relative flex items-center justify-between p-4 rounded-md border transition-all duration-200 cursor-pointer overflow-hidden',
                      isActive 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border bg-surface hover:border-border-focus hover:bg-surface-interactive hover:shadow-sm',
                      isConnecting && !isActive && 'opacity-50 pointer-events-none'
                    )}
                    onClick={() => !isConnecting && controller.handleSelectServer(server)}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
                    )}
                    
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                        isActive ? 'bg-primary/20 text-primary' : 'bg-surface-elevated text-text-secondary group-hover:text-primary group-hover:bg-primary/10'
                      )}>
                        <Icon name="server" className="h-5 w-5" />
                      </div>
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-text-primary">
                            {server.name}
                          </span>
                          {isActive && (
                            <span className="text-xs uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-1 rounded-sm">
                              {status}
                            </span>
                          )}
                        </div>
                        <span className="truncate text-xs text-text-secondary font-mono mt-1">
                          {server.url}
                        </span>
                        {server.credentialStatus && (
                          <CredentialHealthIndicator credentialStatus={server.credentialStatus} className="mt-1" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-4 shrink-0">
                      {status === 'connecting' ? (
                        <div className="flex h-8 w-8 items-center justify-center">
                          <Spinner variant="ring" size="md" />
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-error hover:bg-error-20 h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openServerDeleteDialogWindow({
                                serverId: server.id,
                                serverName: server.name,
                              });
                            }}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </Button>
                          <div className={cn(
                            "flex items-center justify-center h-8 px-3 rounded-md text-xs font-medium transition-all",
                            isActive 
                              ? "bg-primary text-text-on-primary" 
                              : "bg-surface-elevated text-text-secondary group-hover:bg-primary group-hover:text-text-on-primary"
                          )}>
                            Connect
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full py-6 mt-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 text-text-secondary hover:text-primary transition-colors"
            onClick={() => navigate('/add-server')}
            data-testid="login-add-server-button"
          >
            <Icon name="plus" className="mr-2 h-4 w-4" />
            Add New Server
          </Button>
        </div>
      </div>

    </div>
  );
}
