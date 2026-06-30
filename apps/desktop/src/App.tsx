import { lazy, Suspense, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter, Outlet } from 'react-router-dom';
import { QBClientProvider } from './connection';
import { ServerManagerProvider } from './connection/ServerManager';
import { AppShell } from './layouts/AppShell/AppShell';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { AddServerScreen } from './screens/AddServerScreen';
import { FiltersScreen } from './screens/FiltersScreen';
import { DialogHostScreen } from './screens/DialogHostScreen';
import { useKeyboardShortcuts } from './hooks/shell/useKeyboardShortcuts';
import { useTorrentFileOpen } from './hooks/shell/useTorrentFileOpen';
import { useMagnetLinkOpen } from './hooks/shell/useMagnetLinkOpen';
import { useDisableWebviewContextMenu } from './hooks/shell/useDisableWebviewContextMenu';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthBoundary } from './auth/AuthBoundary';
import { AuxWindowLayout } from './windows/layout/AuxWindowLayout';
import { DialogWindowLayout } from './windows/layout/DialogWindowLayout';
import { MainWindowLayout } from './windows/layout/MainWindowLayout';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { queryClient } from './queryClient';
import { SearchFocusProvider } from './contexts/SearchFocusProvider';
import { useFocusSearch } from './contexts/useSearchFocusHooks';
import { mark } from '@taurent/shared/utils/perfAudit';
import { Toaster } from '@taurent/web-ui/components/shared/Toast/Toaster';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { useOperationNotifications } from '@taurent/web-core/hooks/useOperationNotifications';
import { notifyNative } from '@taurent/bridge/desktop/notification';

// Lazy-load auxiliary windows and heavier non-initial routes
const AddTorrentScreen = lazy(() => import('./screens/AddTorrentScreen').then(m => ({ default: m.AddTorrentScreen })));
const SearchScreen = lazy(() => import('./screens/SearchScreen').then(m => ({ default: m.SearchScreen })));
const RSSScreen = lazy(() => import('./screens/RSSScreen').then(m => ({ default: m.RSSScreen })));
const SettingsLayout = lazy(() => import('./windows/layout/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const StatisticsLayout = lazy(() => import('./windows/layout/StatisticsLayout').then(m => ({ default: m.StatisticsLayout })));

function SuspenseFallback({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
      <span>Loading {label}…</span>
    </div>
  );
}

function LazyContent({ label, children }: { label: string; children: React.ReactNode }) {
  return <Suspense fallback={<SuspenseFallback label={label} />}>{children}</Suspense>;
}

function ProtectedLayout() {
  const focusSearch = useFocusSearch();
  useKeyboardShortcuts({ onFocusSearch: focusSearch });
  useTorrentFileOpen();
  useMagnetLinkOpen();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const router = createBrowserRouter([
  // Auxiliary window routes (outside AppShell)
  {
    path: '/settings-window',
    element: (
      <AuxWindowLayout label="settings" closeOnSessionLoss={false}>
        <LazyContent label="settings">
          <SettingsLayout />
        </LazyContent>
      </AuxWindowLayout>
    ),
  },
  {
    path: '/statistics-window',
    element: (
      <DialogWindowLayout label="statistics">
        <LazyContent label="statistics">
          <StatisticsLayout />
        </LazyContent>
      </DialogWindowLayout>
    ),
  },
  {
    path: '/add-torrent-window',
    element: (
      <DialogWindowLayout label="add-torrent">
        <LazyContent label="add-torrent">
          <AddTorrentScreen variant="aux" />
        </LazyContent>
      </DialogWindowLayout>
    ),
  },
  {
    path: '/dialog-host-window',
    element: (
      <DialogWindowLayout label="dialog-host">
        <LazyContent label="dialog-host">
          <DialogHostScreen />
        </LazyContent>
      </DialogWindowLayout>
    ),
  },
  // Auth-gated routes (login + add-server are accessible without session; home screens require session)
  // MainWindowLayout restores last geometry and shows the window — must wrap
  // the main window root so it fires exactly once for the main window path.
  {
    element: <DesktopMainWindowRoot />,
    children: [
      {
        path: '/login',
        element: <LoginScreen />,
      },
      {
        path: '/add-server',
        element: <AddServerScreen />,
      },
      {
        element: <ProtectedLayout />,
        children: [
          { index: true, element: <HomeScreen /> },
          { path: 'add-torrent', element: <Suspense fallback={<SuspenseFallback label="add-torrent" />}><AddTorrentScreen variant="main" /></Suspense> },
          { path: 'filters', element: <FiltersScreen /> },
          { path: 'search', element: <Suspense fallback={<SuspenseFallback label="search" />}><SearchScreen /></Suspense> },
          { path: 'rss', element: <Suspense fallback={<SuspenseFallback label="rss" />}><RSSScreen /></Suspense> },
        ],
      },
    ],
  },
]);

function MainWindowOperationNotifications() {
  useOperationNotifications({ toast: toast.error, native: notifyNative });
  return null;
}
function DesktopMainWindowRoot() {
  return (
    <>
      <MainWindowOperationNotifications />
      <MainWindowLayout>
        <AuthBoundary />
      </MainWindowLayout>
    </>
  );
}

function AppNotifications() {
  return <Toaster />;
}

function AppContent() {
  const routerReadyRef = useRef(false);
  useDisableWebviewContextMenu();

  useEffect(() => {
    if (!routerReadyRef.current) {
      routerReadyRef.current = true;
      mark('router.ready');
    }
  }, []);

  return (
    <SearchFocusProvider>
      <ThemeProvider defaultTheme="solarized-dark">
        <ServerManagerProvider>
          <QBClientProvider>
            <AppNotifications />
            <RouterProvider router={router} />
          </QBClientProvider>
        </ServerManagerProvider>
      </ThemeProvider>
    </SearchFocusProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <AppContent />
      </RootErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
