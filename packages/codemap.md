# packages/

## Responsibility

Workspace package folder containing the platform-agnostic feature surface, UI component library, and Tauri runtime bridge. These four packages provide canonical TypeScript types, runtime validation, utilities, React Query orchestration, hooks/controllers, and the platform transport adapters consumed by `apps/desktop` and `apps/mobile`.

## Packages

| Directory | Package name | Description |
|-----------|-------------|-------------|
| `packages/shared` | `@taurent/shared` | Canonical domain types, Zod schemas, pure utilities, Zustand stores, theme tokens, icon system, and minimal UI primitives (Icon, StatusBadge). Platform-agnostic foundation layer. |
| `packages/bridge` | `@taurent/bridge` | Typed bridge contracts, transport abstraction, and desktop/mobile adapter factories. The only package allowed to import `@tauri-apps/*`. |
| `packages/web-core` | `@taurent/web-core` | Session lifecycle, query scoping, shared React Query hooks, screen controllers/models, and feature gating (RSS, search, capabilities). Consumed by both app shells. |
| `packages/web-ui` | `@taurent/web-ui` | Reusable React UI primitives, domain-grouped components (dialogs, settings, torrents, management), screen bodies, and theme provider. Consumed by both app shells. |

## Dependency Graph

```
apps/desktop, apps/mobile
         │
         ├── @taurent/web-ui    (UI components + screen bodies)
         ├── @taurent/web-core  (hooks + session + controllers)
         │         │
         │         ├── @taurent/shared  (types, utils, stores, theme)
         │         └── @taurent/bridge  (types only; no @tauri-apps/* in web-core)
         │
         └── @taurent/shared    (types, utils, stores, theme)
              └── @taurent/bridge (types only)

@taurent/bridge ──► @taurent/shared (types only)
@taurent/bridge ──► @tauri-apps/*   (only allowed location)
```

## Architecture Constraints

- **Platform import boundary**: `@taurent/shared`, `@taurent/web-core`, and `@taurent/web-ui` must never import `@tauri-apps/*`. All native/Tauri interactions route through `@taurent/bridge`.
- **Stable barrels**: Each package exposes a root `src/index.ts` as the canonical import surface. Consumers import from barrels, not internal paths.
- **Single QueryClient**: Applications create a single `QueryClient` via `createQueryClient()` from `@taurent/web-core/query` and provide it to React Query providers.
- **No extra QueryClients**: Do not introduce additional `QueryClient` instances in shared packages.

## Common Design Patterns

- **API-first typing**: TypeScript interfaces mirror qBittorrent Web API shapes; Zod schemas provide compatibility/test parsing for un-migrated DTO families. The canonical network-response boundary for the migrated DTO families (categories, tags, `sync_torrent_peers`) is `qb-core::dto` inside Rust Tauri commands.
- **Transport abstraction**: Bridge defines a `Transport` contract (`invoke` + `listen`) so concrete transports (Tauri, web) can be injected; enables test doubles.
- **Factory & adapter composition**: Bridge exposes factory functions (`createDesktopBridge`, `createMobileTauriBridge`) that assemble sub-bridges as thin wrappers over `transport.invoke`.
- **Query scope pattern**: All server-backed queries are keyed by `serverId + sessionGeneration` for per-server cache isolation.
- **Optimistic mutation lifecycle**: Shared `onMutate/onError/onSettled` pattern (snapshot → setQueryData → rollback → invalidate).
- **Capability gating**: RSS, search, and per-torrent features are gated by tri-state `ProbeResult` from bridge probing endpoints.
- **Local UI state**: Minimal Zustand stores (`torrentStore`, `uiStore`) expose typed state and imperative actions; they do not own session lifecycle.

## Call Flow (high level)

1. UI components call hooks from `@taurent/web-core`.
2. Hooks call bridge interfaces (types only) or injected adapter functions.
3. Bridge adapters compose a `Transport` and map calls to `transport.invoke(cmd, args)`.
4. Transport delegates to `@tauri-apps/api invoke/listen`.
5. Rust handlers talk to qBittorrent. For migrated DTO families (categories, tags, `sync_torrent_peers`) `qb-core::dto` parses and validates the response inside the Tauri command and returns a typed envelope; the renderer receives structured data. For the remaining DTO families the renderer fallback path still relies on Zod schemas from `@taurent/shared` for shape validation.
6. Validated data enters React Query cache and/or Zustand stores.
7. Events (session-changed, resource-invalidated) trigger query invalidation and store updates.

## Recommended Read Order (for contributors)

1. `packages/bridge/src/contracts/interfaces.ts` — canonical contract surface
2. `packages/shared/src/types` and `packages/shared/src/schemas` — domain types and validation
3. `packages/web-core/src/query/query-client.ts` — QueryClient factory
4. `packages/web-core/src/query/optimistic-updates.ts` — standardized mutation lifecycle
5. `packages/web-core/src/session/sessionController.ts` — session lifecycle and query key scoping
6. `packages/bridge/src/transport/tauriTransport.ts` — concrete transport wiring
7. `packages/web-ui/src/index.ts` — UI export surface

---

For implementation-level details, see each package's codemap: `packages/<pkg>/codemap.md`.
