import { AuthLoadingScreen } from '@taurent/web-ui';
import { createAuthBoundary } from '@taurent/web-core/session';
import { useQBClient, useServerManager } from '../connection';

const { AuthBoundary } = createAuthBoundary({
  useQBClient,
  useServerManager,
  LoadingComponent: AuthLoadingScreen,
  publicPaths: ['/login', '/add-server'],
  serverListPath: '/login',
});

export { AuthBoundary };
