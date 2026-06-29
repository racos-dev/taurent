# apps/mobile/src/platform/

## Responsibility

Mobile-specific platform adapters for persistent storage and native file picking. Provides a `PlatformStorage` implementation backed by `@tauri-apps/plugin-store` and a torrent file picker using `@tauri-apps/plugin-dialog`.

## Key Files

- **index.ts** — Exports `storage` (a `PlatformStorage` instance) and `pickTorrentFiles()`. Also re-exports the `PlatformStorage` type.

## Design

- **PlatformStorage implementation**: `storage` is an async key-value store backed by `@tauri-apps/plugin-store`. It lazily loads a `Store` instance for `settings.json` (with `autoSave: false` and empty defaults) and provides `getItem`, `setItem`, and `deleteItem` methods. The store instance is cached and only recreated if the storage path changes.
- **Singleton Store pattern**: `getStore()` maintains a single `Store` instance per path. All operations go through this cached instance. Saves are explicit (`store.save()` after each write).
- **File picker**: `pickTorrentFiles()` uses `open()` from `@tauri-apps/plugin-dialog` with a `.torrent` file filter and `multiple: true`. Returns an array of selected file paths (strings). Returns empty array if the user cancels. Filters results to only include `.torrent` extensions as a safety measure.

## Flow

1. A hook (e.g., `useSortPreference`) calls `storage.getItem(key)`.
2. `storage.getItem` lazily loads the `Store` for `settings.json` via `getStore()`.
3. The `Store` loads from disk on first access (or re-loads if the path changed).
4. `store.get(key)` returns the value, which is stringified if not already a string.
5. For file picking: `pickTorrentFiles()` calls `open()` with torrent filter, normalizes the result to an array, and returns the paths.

## Integration

- **@tauri-apps/plugin-store** — `Store` class for persistent key-value storage on the mobile device filesystem.
- **@tauri-apps/plugin-dialog** — `open()` function for the native file picker dialog.
- **@taurent/shared/platform** — `PlatformStorage` type definition that `storage` implements.
- **../hooks/useSortPreference.ts** — Primary consumer of `storage` for persisting sort field/order preferences.
- **../screens/AddTorrentScreen.tsx** — Consumer of `pickTorrentFiles` for selecting `.torrent` files from the device.
