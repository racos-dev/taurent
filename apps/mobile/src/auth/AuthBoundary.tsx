import { AuthLoadingScreen } from '@taurent/web-ui';
import { createAuthBoundary } from '@taurent/web-core/session';
import { useQBClient } from '../connection/QBClientProvider';
import { useServerManager } from '../connection/ServerManager';

const { AuthBoundary } = createAuthBoundary({
  useQBClient,
  useServerManager,
  LoadingComponent: AuthLoadingScreen,
});

export { AuthBoundary };
