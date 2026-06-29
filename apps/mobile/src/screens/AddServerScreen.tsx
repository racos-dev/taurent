import { useNavigate } from 'react-router-dom';
import { BridgeAdapter } from '@taurent/bridge/adapters/mobile-tauri';
import { useServerManager } from '../connection/ServerManager';
import { Button, StateCard } from '@taurent/web-ui';
import { Icon } from '../ui/Icon';
import { AddServerFormBody } from '@taurent/web-ui';
import { useAddServerScreenController } from '@taurent/web-core/screens';
import {
  mobileCenteredStateClassName,
  mobileScreenHeaderInnerClassName,
  mobileScreenRootClassName,
} from '../ui/mobileScreenLayout';

export function AddServerScreen() {
  const navigate = useNavigate();
  const { addServer, switchServer, loading } = useServerManager();

  const controller = useAddServerScreenController({
    addServer,
    bridgeServers: BridgeAdapter.servers,
    onSuccess: async (serverId) => {
      await switchServer(serverId);
      navigate('/', { replace: true });
    },
  });

  const handleCancel = () => {
    if (!controller.isTesting && !controller.isSubmitting) {
      navigate('/servers', { replace: true });
    }
  };

  // Mobile combines test + submit: validate, test, then add on success
  const handleAddServer = async () => {
    if (!controller.isFormValid) {
      return;
    }

    controller.clearTestResult();

    // Test first - if fails, error surfaces through testResult
    const testResult = await controller.handleTestConnection();

    // Only proceed if test succeeded
    if (!testResult?.success) {
      return;
    }

    // Now add the server
    await controller.handleSubmit();
  };

  // Use test error as the displayed error when test has run
  const displayError = controller.error ?? (controller.testResult && !controller.testResult.success ? controller.testResult.error : null);

  if (loading) {
    return (
      <div className={mobileCenteredStateClassName()}>
        <StateCard
          title="Loading..."
          icon={<Icon name="server" iconSize="lg" />}
          className="max-w-sm"
        />
      </div>
    );
  }

  return (
    <div className={mobileScreenRootClassName({ className: 'flex flex-col' })}>
      <header className="sticky top-0 z-20 touch-none select-none border-b border-border bg-background/90 px-2 py-2 backdrop-blur-lg">
        <div className={mobileScreenHeaderInnerClassName({ className: 'flex items-center justify-between' })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={controller.isTesting || controller.isSubmitting}
          >
            Cancel
          </Button>
          <h1 className="text-sm font-semibold text-text-primary">Add Server</h1>
          <div className="w-14" />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-lg px-2 pb-[calc(2rem+var(--sab))]">
          {/* Page description */}
          <div className="mb-4 text-center">
            <h2 className="text-sm font-semibold text-text-primary">Connect to qBittorrent</h2>
            <p className="mt-1 text-xs text-text-secondary">Enter your server details below</p>
          </div>

          {/* Polished form card */}
          <div className="overflow-hidden rounded-md border border-border bg-surface shadow-sm">
            <div className="space-y-4 p-4">
              <AddServerFormBody
                variant="mobile"
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
                validationErrors={controller.validationErrors}
                error={displayError}
                testingConnection={controller.isTesting || controller.isSubmitting}
                testErrorSuggestion={controller.urlSuggestion}
                onSubmit={handleAddServer}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
