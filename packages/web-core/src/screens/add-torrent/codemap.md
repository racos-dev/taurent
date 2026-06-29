# add-torrent

## Responsibility

Headless controller for AddTorrentScreen orchestration. Manages form state for adding torrents by magnet URL or by torrent files, including advanced options (save path, category, tags, speed limits, content layout, etc.), validation, and submit logic.

## Key Files

- `useAddTorrentScreenController.ts` — Main controller hook with form fields, mode switching, file/tag management, validation, and submit orchestration

## Design Patterns

- **Dual-mode input**: Supports both magnet/URL mode and file mode; `desktopUnifiedMode` tracks last-used source for desktop's unified panel
- **Source-aware validation**: `validate()` checks magnet format or file selection depending on active source
- **Submit-in-flight guard**: `submitInFlightRef` prevents double-submission
- **File items derivation**: `selectedFiles` are transformed to `AddTorrentFileItem[]` for UI body consumption
- **Tag toggle/remove**: `handleToggleTag` and `handleRemoveTag` manage tag selection state
- **Advanced options**: Exposes savePath, category, tags, sequentialDownload, skipChecking, paused, rootFolder, rename, upLimit, dlLimit, autoTMM, firstLastPiecePrio, contentLayout, stopCondition, addToTop

## Flow

1. App route mounts controller with injected `addByUrl`/`addByFiles` and mode
2. User enters magnet URI or selects files
3. User configures advanced options (category, tags, limits, etc.)
4. `validate()` checks source-appropriate validation rules
5. `handleSubmit()` resolves active source, builds options object, calls appropriate add function
6. On success, calls `onSubmitSuccess` callback (navigation)

## Integration

- Imports `validateMagnetLink` from `@taurent/shared/schemas/addTorrent`
- Used by desktop/mobile AddTorrentScreen routes
- Consumes injected `addByUrl`/`addByFiles` from `torrents/useAddTorrent`
- `AddTorrentOptionsInput` maps to qBittorrent's add torrent API parameters
