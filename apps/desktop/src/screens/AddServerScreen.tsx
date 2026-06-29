import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import { useQBClient, useServerManager } from '../connection';
import { AddServerFormBody } from '@taurent/web-ui';
import { useAddServerScreenController } from '@taurent/web-core/screens';

const ServerIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

export function AddServerScreen() {
  const navigate = useNavigate();
  const { connect } = useQBClient();
  const { addServer, switchServer, loading } = useServerManager();

  const controller = useAddServerScreenController({
    addServer,
    bridgeServers: BridgeAdapter.servers,
    onSuccess: async (serverId) => {
      await switchServer(serverId);
      await connect(serverId);
      navigate('/', { replace: true });
    },
  });

  const isTestSuccess = controller.testResult?.success === true;
  const isTestFailed = controller.testResult?.success === false;
  const hasSuggestion = !!controller.urlSuggestion;

  const subtitle = useMemo(() => {
    if (isTestSuccess) return 'Connection verified! Click Add Server to save.';
    if (isTestFailed) return 'Connection failed. Check the details below.';
    return 'Connect your first qBittorrent instance';
  }, [isTestSuccess, isTestFailed]);

  const footerHelp = useMemo(() => {
    if (isTestSuccess) return 'Ready to save your server profile.';
    if (isTestFailed && hasSuggestion) return controller.urlSuggestion;
    return 'Need help? Make sure qBittorrent Web UI is enabled in your server settings.';
  }, [isTestSuccess, isTestFailed, hasSuggestion, controller.urlSuggestion]);

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4" data-testid="add-server-screen">
      <div className="max-w-md w-full">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="p-3 bg-primary/10 rounded-full mb-3">
            <ServerIcon className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-text-primary">Add New Server</h1>
          <p className="text-sm text-text-secondary mt-1">
            {subtitle}
          </p>
        </div>

        <div className="bg-surface border border-border border-t-2 border-t-primary rounded-md p-5 shadow-sm">
          <AddServerFormBody
            variant="desktop"
            name={controller.name}
            onNameChange={controller.setName}
            url={controller.url}
            onUrlChange={controller.setUrl}
            username={controller.username}
            onUsernameChange={controller.setUsername}
            password={controller.password}
            onPasswordChange={controller.setPassword}
            rememberPassword={controller.rememberPassword}
            onRememberPasswordChange={controller.setRememberPassword}
            error={controller.error}
            testResult={controller.testResult}
            testingConnection={controller.isTesting}
            loading={controller.isSubmitting || loading}
            onTestConnection={controller.handleTestConnection}
            onSubmit={controller.handleSubmit}
            validationErrors={controller.validationErrors}
            testErrorSuggestion={controller.urlSuggestion}
          />
        </div>

        <div className="mt-4 text-center text-xs text-text-muted">
          <p>{footerHelp}</p>
        </div>
      </div>
    </div>
  );
}
