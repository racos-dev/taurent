# apps/desktop/

## Responsibility

Desktop shell for the qBittorrent client built on Tauri 2 + React 19 + Vite 7. Provides a full-featured desktop experience with:

- Multi-window architecture (main window + route-driven auxiliary windows)
- TransferCommand system for menus, toolbars, keyboard shortcuts, and context menus
- Virtualized torrent table with column registry, drag-and-drop column reordering, and sorting
- Right-click context menus with Radix UI
- Search focus subsystem with keyboard shortcut integration
- Auth boundary with session-aware routing
- Theme provider with CSS variable injection

## Package Info

- **Package name**: `taurent`
- **Build**: Vite 7 + `@vitejs/plugin-react` + TypeScript 5.9 + Tailwind CSS 3
- **Key deps**: React 19, react-router-dom 6, @tanstack/react-query 5, zustand 5, lucide-react, @dnd-kit, @radix-ui/react-context-menu, @tanstack/react-virtual
- **Tauri plugins**: clipboard-manager, dialog, http, log, notification, opener, shell, store, window-state, autostart

## Source Structure

```
apps/desktop/src/
├── App.tsx                    # Provider composition + router definition
├── main.tsx                   # Bootstrap: setupTauriLogging() → mount App
├── queryClient.ts             # Shared QueryClient singleton
├── index.css                  # Tailwind CSS entrypoint
├── auth/                      # AuthBoundary: session-aware route gating
├── connection/                # QBClientProvider, ServerManager, session adapter
│   ├── QBClientProvider.tsx   # Session provider via createSessionProvider factory
│   ├── ServerManager.tsx      # Server manager via createServerManagerProvider
│   ├── sessionAdapter.ts      # Desktop SessionBridge + listeners + invalidator
│   ├── serverManagerBindings.tsx
│   └── useQBClientHooks.ts
├── contexts/                  # React contexts (SearchFocus subsystem)
│   ├── SearchFocusContext.ts
│   ├── SearchFocusProvider.tsx
│   ├── useSearchFocusContext.ts
│   └── useSearchFocusHooks.ts
├── hooks/                     # Platform, settings, shell, and torrent hooks
│   ├── platform/              # PlatformStorage, pickTorrentFiles, pickSavePath
│   ├── settings/              # Settings-specific hooks
│   ├── shell/                 # useKeyboardShortcuts, useTorrentFileOpen
│   ├── torrents/              # useLiveTorrentList, useLiveTorrentByHash, etc.
│   ├── useTrackerEntries.ts
│   └── useWindowState.ts
├── screens/                   # Route-level screen components
│   ├── HomeScreen.tsx         # Main torrent list with selection/batch actions
│   ├── LoginScreen.tsx
│   ├── AddServerScreen.tsx
│   ├── AddTorrentScreen.tsx   # Variant-aware (main vs aux window)
│   ├── FiltersScreen.tsx
│   ├── SearchScreen.tsx
│   ├── RSSScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── DialogHostScreen.tsx   # Hosts route-driven dialog windows
│   └── *DialogScreen.tsx      # CategorySelect, Confirm, TorrentDelete, etc.
├── layouts/                   # AppShell chrome
│   ├── AppShell/              # Main layout with sidebar, content, detail panel
│   ├── MenuBar/               # macOS native menu bar integration
│   ├── Sidebar/               # Navigation + filter sidebar
│   └── StatusBar/             # Bottom status bar with transfer stats
├── windows/                   # Auxiliary window system
│   ├── auxWindowManager.ts    # openAuxWindow() + window lifecycle management
│   ├── layout/                # MainWindowLayout, AuxWindowLayout, DialogWindowLayout, SettingsLayout, StatisticsLayout
│   ├── settings/              # Settings auxiliary window
│   ├── statistics/            # Statistics dialog window
│   └── dialogs/               # Dialog window configs (10 dialog types)
├── stores/                    # Desktop-local Zustand stores
│   ├── shellStore.ts          # UI preferences (sidebar width, detail panel, etc.)
│   ├── columnRegistry.ts      # Transfers table column metadata + registry
│   └── torrentSelectionStore.ts # Set-based torrent selection
├── components/                # Desktop-specific presentational components
│   ├── TorrentTable/          # Virtualized table with @tanstack/react-virtual
│   ├── TorrentDetail/         # Desktop torrent detail (files section with native file ops)
│   ├── DetailPanel/           # Right-side torrent detail inspector
│   ├── Toolbar/               # Action toolbar with TransferCommands
│   ├── ContextMenu/           # Right-click menu system
│   ├── Settings/              # Settings forms + nav config
│   ├── SettingsCloseOverlay/  # Unsaved-changes close confirmation prompt
│   ├── OverlayPrompt/         # Reusable blocking overlay with ARIA
│   ├── TorrentContextMenu.tsx
│   ├── DragDropOverlay.tsx
│   └── RootErrorBoundary.tsx
├── platform/                  # Platform abstractions
│   └── index.ts               # PlatformStorage, pickTorrentFiles, pickSavePath, notificationType
├── theme/                     # Desktop ThemeProvider with CSS variable injection
├── utils/                     # Desktop-specific formatters, cn(), etc.
└── testing/                   # Test utilities and mocks (mockDesktopBridge, mockTauriCore, mockTauriLogging, fixtures, etc.)
```

## Design Patterns

- **Provider stack** (`App.tsx`): `QueryClientProvider` → `RootErrorBoundary` → `SearchFocusProvider` → `ThemeProvider` → `ServerManagerProvider` → `QBClientProvider` → `RouterProvider`.
- **Route-driven windows**: Auxiliary windows (`/settings-window`, `/statistics-window`, `/add-torrent-window`, `/dialog-host-window`) render outside `AppShell` through `AuxWindowLayout` or `DialogWindowLayout`. Main window routes render inside `AppShell` via `ProtectedLayout`.
- **Lazy loading**: Heavy screens (AddTorrent, Search, RSS, Settings, Statistics) are `React.lazy()` loaded with `LazyContent` gate to avoid loading fallback flash.
- **TransferCommand DTO**: Canonical action shape (`{ id, label, icon, enabled, destructive, deferred, onClick }`) produced by hooks and consumed by menus, toolbars, and keyboard handlers.
- **Column Registry**: `columnRegistry.ts` defines transfers table metadata; persisted `shellStore` preferences normalize against registry constraints.
- **Live hooks**: `useLiveTorrentList`, `useLiveTorrentByHash` subscribe to the Zustand torrents map slice via `useMaindataSelector` and derive via `useMemo` to avoid full array subscriptions on unrelated maindata ticks.

## Runtime Flow

1. `src/main.tsx` calls `setupTauriLogging()` and mounts `<App />`.
2. `App.tsx` creates `QueryClient`, composes providers, and mounts the router.
3. `DesktopMainWindowRoot` wraps the main window path with `MainWindowLayout` (restores geometry, shows window) and `MainWindowOperationNotifications`.
4. `AuthBoundary` inside `MainWindowLayout` gates login/protected routes using shared `useSessionBootstrap`.
5. Auxiliary routes open via `openAuxWindow()` from `auxWindowManager.ts` and bootstrap from `BridgeAdapter.getSessionSnapshot()`.
6. Desktop hooks convert selection/session state into TransferCommands and mutations.

## Integration

- **@taurent/bridge**: `createDesktopBridge` / `BridgeAdapter` for all I/O. Desktop transport uses `cmd_*` Tauri commands.
- **@taurent/web-core**: `createSessionProvider`, `createServerManagerProvider`, shared query/mutation hooks, screen controllers, invalidation helpers.
- **@taurent/shared**: `torrentStore`, `uiStore`, theme tokens, types, formatters, `ICON_SIZES`, `Icon`.
- **@taurent/web-ui**: UI primitives, screen bodies (`HomeScreenBody`, `SearchScreenBody`, etc.), dialog components, layout components.
- **src-tauri**: Rust handlers for `qBClient`, `torrents`, `servers`, `session`, `notifications`, `clipboard`, `window-state`.

## Testing

- **Unit**: Vitest with jsdom — `pnpm desktop:test` or `pnpm --filter taurent test`.
- **Browser mode**: Vitest browser with Chromium — `pnpm desktop:test:browser`.
- **Renderer E2E**: Playwright with mocked bridge/tauri transport aliases — `pnpm desktop:renderer:e2e`. Runs with `fullyParallel: false`.
- **Bundle analysis**: `pnpm desktop:analyze`, `pnpm desktop:perf:baseline/compare/check`.
- **`scripts/`** — dev launcher (`dev/`), icon generation, and perf analysis (`perf/`).
- **`src/testing/`** — DesktopBridge mock with scenario/delta/fault injection, no-op Tauri core/logging/transport/event/webview/window/DPI/notification mocks, deterministic torrent fixture factories. Aliased via `VITE_AUTOMATION=1` in `vite.config.ts` and `playwright.config.ts`. Playwright E2E helpers (`e2e/helpers/desktop.ts`) provide torrent row locators and mocked webview polling.

## Invariants

- Keep client/session ownership in `connection/`.
- Keep transfer-command data serializable and UI-agnostic.
- Keep auxiliary dialogs routed through window configs, not in-tree overlays.
- Auxiliary windows must reuse session snapshot, not create independent sessions.
- Column registry is authoritative for transfers table metadata.
