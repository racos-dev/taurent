# apps/desktop/src/hooks/platform/

## Responsibility

Provides the single desktop instantiation of platform hooks (categories, tags, preferences) and the Tauri drag-and-drop hook. All hooks are created via `createPlatformHooks` from `@taurent/web-core`, wired with `BridgeAdapter` for RPC transport and `useQBClient` for server scope.

## Design

- **Single factory call**: `platform.ts` calls `createPlatformHooks({ bridge: BridgeAdapter, scopeProvider: useQBClient })` once and re-exports all resulting hooks.
- **Re-export pattern**: `useCategories.ts` and `useTags.ts` are thin re-export barrels, not factories — they pull from the single instantiation in `platform.ts`.
- **Tauri-native DnD**: `useDragAndDrop.ts` hooks into `getCurrentWebview().onDragDropEvent` to detect window-level file drags, far more reliable than DOM-level events for cross-app drops.

## Files

- **platform.ts** — single `createPlatformHooks` call producing all category, tag, and preference hooks; exports `useCategories`, `useCreateCategory`, `useEditCategory`, `useRemoveCategories`, `useSetTorrentCategory`, `useTags`, `useCreateTags`, `useDeleteTags`, `useAddTorrentTags`, `useRemoveTorrentTags`, and all preference hooks.
- **useCategories.ts** — re-exports category hooks from `platform.ts`: `useCategories`, `useCreateCategory`, `useEditCategory`, `useRemoveCategories`, `useSetTorrentCategory`.
- **useTags.ts** — re-exports tag hooks from `platform.ts`: `useTags`, `useCreateTags`, `useDeleteTags`, `useAddTorrentTags`, `useRemoveTorrentTags`.
- **useDragAndDrop.ts** — Tauri window drag/drop hook. Listens via `getCurrentWebview().onDragDropEvent`, filters by accepted types, and returns `{ isDragging }` state for UI feedback.
- **index.ts** — barrel re-exports of all four modules.

## Flow

1. `platform.ts` calls `createPlatformHooks` once at module scope with the desktop `BridgeAdapter` and `useQBClient` scope provider.
2. Category and tag hooks propagate `serverId`, `sessionGeneration`, and `isConnected` from `useQBClient()` into every query and mutation.
3. `useDragAndDrop.ts` registers a single `onDragDropEvent` listener on mount, tracks `isDragging` via `useState`, and cleans up on unmount.

## Integration

- `@taurent/bridge/adapters/desktop` — `BridgeAdapter` provides RPC transport for all platform hooks.
- `@taurent/web-core` — `createPlatformHooks` factory.
- `@tauri-apps/api/webview` — `getCurrentWebview().onDragDropEvent` for native drag detection.
- `src/contexts` — `useQBClient` for server scope propagation.
