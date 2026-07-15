import { useNavigate } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import { useServerManager } from '../connection';
import { AddServerForm } from '@taurent/web-ui';
import { useAddServerScreenController } from '@taurent/web-core/screens';

const ServerIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

export function AddServerScreen() {
  const navigate = useNavigate();
  const { addServer, removeServer, switchServer, loading } = useServerManager();

  const controller = useAddServerScreenController({
    addServer,
    bridgeServers: BridgeAdapter.servers,
    onSuccess: async (serverId) => {
      try {
        // switchServer authenticates and atomically activates the saved candidate.
        await switchServer(serverId);
        navigate('/', { replace: true });
      } catch (error) {
        // A failed first connection should not leave a saved server that triggers
        // bootstrap navigation away from this form. Preserve the original error.
        try {
          await removeServer(serverId);
        } catch (cleanupError) {
          console.warn('Failed to roll back server after connection failure', cleanupError);
        }
        throw error;
      }
    },
  });

  const handleCancel = () => {
    if (!controller.isSubmitting && !loading) {
      navigate('/servers', { replace: true });
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4" data-testid="add-server-screen">
      <div className="max-w-md w-full">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="p-3 bg-primary/10 rounded-full mb-3">
            <ServerIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Add New Server</h1>
          <p className="text-sm text-text-secondary mt-1">
            Connect your first qBittorrent instance
          </p>
        </div>

        <div className="bg-surface border border-border border-t-2 border-t-primary rounded-md p-5 shadow-sm">
          <AddServerForm
            name={controller.name}
            onNameChange={controller.setName}
            url={controller.url}
            onUrlChange={controller.setUrl}
            username={controller.username}
            onUsernameChange={controller.setUsername}
            password={controller.password}
            onPasswordChange={controller.setPassword}
            apiKey={controller.apiKey}
            onApiKeyChange={controller.setApiKey}
            rememberPassword={controller.rememberPassword}
            onRememberPasswordChange={controller.setRememberPassword}
            useApiKey={controller.useApiKey}
            onUseApiKeyChange={controller.setUseApiKey}
            error={controller.error}
            isSubmitting={controller.isSubmitting || loading}
            onSubmit={controller.handleSubmit}
            onCancel={handleCancel}
            validationErrors={controller.validationErrors}
            urlSuggestion={controller.urlSuggestion}
          />
        </div>

        <div className="mt-4 text-center text-xs text-text-muted">
          <p>Need help? Make sure qBittorrent Web UI is enabled in your server settings.</p>
        </div>
      </div>
    </div>
  );
}
