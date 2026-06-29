# packages/web-core/src/

## Responsibility

Root of the web-core source tree. Provides shared React hooks, query utilities, and context providers for building qBittorrent client UIs that work across desktop and mobile platforms.

## Key Files

- `index.ts` — Public API barrel export for the entire package
- `codemap.md` — This file (root codemap for src/)

## Subdirectories

| Directory | Responsibility |
|-----------|---------------|
| `session/` | Session lifecycle, provider/context factories, auth bootstrap, resource invalidation |
| `query/` | React Query keys, invalidation helpers, optimistic updates |
| `hooks/` | Data-fetching hooks + factory creators (categories, tags, torrents, preferences, transfer, etc.) |
| `screens/` | Screen controllers/models that compose hooks into view models |
| `torrents/` | Torrent action controllers, action adapter factories, add torrent |
| `server/` | Server manager, connection testing |
| `sync/` | Backend-owned maindata live sync via snapshot + event contract, detail-pane coordination, protected request health |
| `capabilities/` | Server capability probing and gating |
| `rss/` | RSS controller/model layer |
| `search/` | Search controller/model layer |

## Design Patterns

- **Dependency injection**: Hooks and screen controllers accept injected query/mutation functions rather than importing bridges directly
- **Query scoping**: All server-backed requests use `QueryScope` (`serverId` + `sessionGeneration`) for proper cache isolation and invalidation
- **Session bootstrap**: `session/` centralizes provider/context creation so app shells only supply platform-specific bridge/listener implementations once
- **Feature composition**: Screen controllers/models combine shared hooks, mutations, sync sources, and derived state into UI-ready models
- **Injected-function pattern**: Search/RSS feature layers accept `searchFn`/`stopSearchFn`/`getPluginsFn` and similar callbacks instead of owning bridge references
- **Factory pattern**: Platform-specific hooks are created via factory functions (e.g., `createPlatformHooks`, `createTorrentsHook`, `createTorrentDetailHooks`) that accept a BridgeAdapter and scopeProvider

## Integration

- Re-exports all submodules as a single public API
- Desktop and mobile apps import from `@taurent/web-core` directly
- Uses `@taurent/shared` for types and utilities
- Uses `@taurent/bridge` type definitions only (no runtime imports)
- **Removed**: old `connection/` layout in favor of `session/`; `auth/` moved to app shells, `logs/` removed, `theme/` moved to app shells
