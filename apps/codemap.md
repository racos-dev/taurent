# apps/

## Responsibility

Platform-specific application renderers and Tauri sidecars for the qBittorrent clients. Contains two apps:

- `apps/desktop` — Desktop shell (Vite + React 19 + Tauri 2 + Tailwind CSS 3)
- `apps/mobile` — Mobile renderer (Vite + React 19 + Tauri 2 mobile + Tailwind CSS 3)

Both apps are thin shells that compose shared providers from `@taurent/web-core` and `@taurent/web-ui`, delegate business logic to those packages, and own only platform-specific glue: provider composition, routing, selection semantics, TransferCommand orchestration (desktop), and native window/shell management.

## Sub-packages

| Directory | Package name | Description |
|-----------|-------------|-------------|
| `apps/desktop` | `taurent` | Desktop Tauri renderer with auxiliary windows, keyboard shortcuts, TransferCommand system, drag-and-drop, column registry, virtualized torrent table, and native menu integration. |
| `apps/mobile` | `taurent-mobile` | Mobile Tauri renderer with touch-optimized navigation (react-router-dom), bottom tab shell, FAB actions, and mobile BridgeAdapter. |

## Shared Design Patterns

- **Provider Composition**: Both apps layer providers in the same order: `QueryClientProvider` → `ThemeProvider` → `ServerManagerProvider` → `QBClientProvider` → `RouterProvider`. The provider stack centralizes lifecycle and cache scoping.
- **Bridge Adapter Pattern**: Both apps implement a `BridgeAdapter` that translates shared bridge contracts into Tauri transport calls. Desktop and mobile adapters are separate files.
- **Session Scoping**: Both apps derive a `QueryScope` from `useQBClient()` (serverId, sessionGeneration, isConnected) to isolate TanStack Query caches per-server and per-session generation.
- **Event-Driven Invalidation**: Both apps wire `createResourceInvalidatedListener` and session events to centralized web-core invalidators (`invalidateTorrents`, `invalidateFiles`, etc.) rather than ad-hoc refetches.

## Runtime Flow

1. `main.tsx` initializes platform logging via `setupTauriLogging()` and mounts `App`.
2. `App.tsx` creates a single `QueryClient` (via `createQueryClient` or `queryClient.ts`) and composes the provider stack around the router.
3. `QBClientProvider` (from web-core `createSessionProvider`) wires session methods, registers event listeners, probes capabilities, and starts maindata sync.
4. UI screens call hooks that call `BridgeAdapter.*` methods; mutations use web-core invalidators on success.
5. Selection state (desktop: Zustand store; mobile: local Set-based hooks) feeds action orchestration.

## Integration

- **@taurent/shared**: Types, schemas, formatters, theme tokens, Zustand stores (`torrentStore`, `uiStore`), icon system.
- **@taurent/web-core**: Session/provider factories, query key factories, hooks, screen controllers, invalidation helpers.
- **@taurent/web-ui**: UI primitives, screen bodies, dialog components, layout components.
- **@taurent/bridge**: Platform transport, bridge adapters (desktop/mobile), Tauri invoke/listen wrappers.
- **src-tauri**: Rust sidecars per app that expose native Tauri commands for qBittorrent communication.

## Key Constraints

- Both apps must call `setupTauriLogging()` before importing/rendering `App`.
- Do not instantiate `QBittorrentClient` in renderer components; use provider/adapter surface.
- Do not add `@tauri-apps/*` imports to shared/web-core/web-ui; route native work through bridge.
- Each app owns a single `QueryClient`; do not create additional QueryClient instances.
- Auxiliary windows (desktop) must bootstrap from `BridgeAdapter.getSessionSnapshot()`, not independent sessions.

## Testing

- Desktop: Vitest unit tests (`pnpm desktop:test`), Vitest browser mode (`pnpm desktop:test:browser`), Playwright renderer E2E (`pnpm desktop:renderer:e2e`), native Tauri E2E (`pnpm desktop:tauri:e2e`).
- Mobile: Vitest unit tests (`pnpm mobile:test`), Playwright renderer E2E (`pnpm mobile:renderer:e2e`).
- Workspace-wide: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`.

---

For implementation-level details, see the per-app codemaps: `apps/desktop/codemap.md` and `apps/mobile/codemap.md`.
