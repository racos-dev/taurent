import { lazy, Suspense, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter, Outlet } from 'react-router-dom';
import { QBClientProvider } from './connection';
import { ServerManagerProvider } from './connection/ServerManager';
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
import { AppUpdateBanner } from './components/AppUpdateBanner';
import { queryClient } from './queryClient';
import { SearchFocusProvider } from './contexts/SearchFocusProvider';
import { useFocusSearch } from './contexts/useSearchFocusHooks';
import { mark } from '@taurent/shared/utils/perfAudit';
import { Toaster } from '@taurent/web-ui/components/shared/Toast/Toaster';
import { toast } from '@taurent/web-ui/components/shared/Toast/toast';
import { useOperationNotifications } from '@taurent/web-core/hooks/useOperationNotifications';
import { notifyNative } from '@taurent/bridge/desktop/notification';
import { LazyContentFallback, type LazyContentKind } from './components/LazyContentFallback';

// Lazy-load auxiliary windows and heavier non-initial routes
const AppShell = lazy(() => import('./layouts/AppShell/AppShell').then(m => ({ default: m.AppShell })));
const LoginScreen = lazy(() => import('./screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const HomeScreen = lazy(() => import('./screens/HomeScreen').then(m => ({ default: m.HomeScreen })));
const AddServerScreen = lazy(() => import('./screens/AddServerScreen').then(m => ({ default: m.AddServerScreen })));
const FiltersScreen = lazy(() => import('./screens/FiltersScreen').then(m => ({ default: m.FiltersScreen })));
const AddTorrentScreen = lazy(() => import('./screens/AddTorrentScreen').then(m => ({ default: m.AddTorrentScreen })));
const SearchScreen = lazy(() => import('./screens/SearchScreen').then(m => ({ default: m.SearchScreen })));
const RSSScreen = lazy(() => import('./screens/RSSScreen').then(m => ({ default: m.RSSScreen })));
const DialogHostScreen = lazy(() => import('./screens/DialogHostScreen').then(m => ({ default: m.DialogHostScreen })));
const SettingsLayout = lazy(() => import('./windows/layout/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const StatisticsLayout = lazy(() => import('./windows/layout/StatisticsLayout').then(m => ({ default: m.StatisticsLayout })));

function LazyContent({ kind, children }: { kind: LazyContentKind; children: React.ReactNode }) {
  return <Suspense fallback={<LazyContentFallback kind={kind} />}>{children}</Suspense>;
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
        <LazyContent kind="settings">
          <SettingsLayout />
        </LazyContent>
      </AuxWindowLayout>
    ),
  },
  {
    path: '/statistics-window',
    element: (
      <DialogWindowLayout label="statistics">
        <LazyContent kind="statistics">
          <StatisticsLayout />
        </LazyContent>
      </DialogWindowLayout>
    ),
  },
  {
    path: '/add-torrent-window',
    element: (
      <DialogWindowLayout label="add-torrent">
        <LazyContent kind="add-torrent">
          <AddTorrentScreen variant="aux" />
        </LazyContent>
      </DialogWindowLayout>
    ),
  },
  {
    path: '/dialog-host-window',
    element: (
      <DialogWindowLayout label="dialog-host">
        <LazyContent kind="dialog">
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
        element: <LazyContent kind="auth"><LoginScreen /></LazyContent>,
      },
      {
        path: '/add-server',
        element: <LazyContent kind="auth"><AddServerScreen /></LazyContent>,
      },
      {
        element: <LazyContent kind="app-shell"><ProtectedLayout /></LazyContent>,
        children: [
          {
            index: true,
            element: <LazyContent kind="torrent-list"><HomeScreen /></LazyContent>,
          },
          {
            path: 'add-torrent',
            element: <LazyContent kind="add-torrent"><AddTorrentScreen variant="main" /></LazyContent>,
          },
          {
            path: 'filters',
            element: <LazyContent kind="filters"><FiltersScreen /></LazyContent>,
          },
          {
            path: 'search',
            element: <LazyContent kind="search"><SearchScreen /></LazyContent>,
          },
          {
            path: 'rss',
            element: <LazyContent kind="rss"><RSSScreen /></LazyContent>,
          },
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
      <AppUpdateBanner />
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
      <ThemeProvider defaultTheme="catppuccin">
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
