import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { createQueryClient } from '@taurent/web-core/query';
import { ControlDensityProvider } from '@taurent/web-ui';
import { ThemeProvider } from '@taurent/web-ui/theme';
import { QBClientProvider } from './connection/QBClientProvider';
import { ServerManagerProvider } from './connection/ServerManager';
import { AuthBoundary } from './auth/AuthBoundary';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AddServerScreen } from './screens/AddServerScreen';
import { TorrentDetailScreen } from './screens/TorrentDetailScreen';
import { AddTorrentScreen } from './screens/AddTorrentScreen';
import { FiltersScreen } from './screens/FiltersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { RSSScreen } from './screens/RSSScreen';
import { StatisticsScreen } from './screens/StatisticsScreen';
import { MobileShell } from './shell/MobileShell';
import { Toaster } from '@taurent/web-ui/components/shared/Toast/Toaster';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { useOperationNotifications } from '@taurent/web-core/hooks/useOperationNotifications';

const queryClient = createQueryClient();

const router = createBrowserRouter([
  {
    element: <AuthBoundary />,
    children: [
      {
        path: '/servers',
        element: <LoginScreen />,
      },
      {
        path: '/add-server',
        element: <AddServerScreen />,
      },
      {
        element: <MobileShell />,
        children: [
          {
            index: true,
            element: <HomeScreen />,
          },
          {
            path: '/search',
            element: <SearchScreen />,
          },
          {
            path: '/rss',
            element: <RSSScreen />,
          },
          {
            path: '/settings',
            element: <SettingsScreen />,
          },
          {
            path: '/statistics',
            element: <StatisticsScreen />,
          },
        ],
      },
      {
        path: '/torrent/:hash',
        element: <TorrentDetailScreen />,
      },
      {
        path: '/add-torrent',
        element: <AddTorrentScreen />,
      },
      {
        path: '/filters',
        element: <FiltersScreen />,
      },
      {
        path: '/manage-servers',
        element: <LoginScreen />,
      },
    ],
  },
]);

function AppNotifications() {
  useOperationNotifications({ notify: toast.error });
  return <Toaster />;
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="solarized-dark">
        <ControlDensityProvider>
          <ServerManagerProvider>
            <QBClientProvider>
              <AppNotifications />
              <RouterProvider router={router} />
            </QBClientProvider>
          </ServerManagerProvider>
        </ControlDensityProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function App() {
  return <AppContent />;
}

export default App;
