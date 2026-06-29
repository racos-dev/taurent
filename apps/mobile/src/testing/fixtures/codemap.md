# apps/mobile/src/testing/fixtures/

## Responsibility

Deterministic fixture factories for tests and browser automation. Generates fully-populated `Torrent`, `SyncMainData`, and `MaindataState` objects with incrementing, reproducible content. Used by both unit tests and the mocked bridge in automation mode.

## Key Files

- **torrent.ts** — Exports five factory functions:
  - `createTorrent(index)` — Creates a single `Torrent` with all fields populated. Hash is deterministic per index (`abcd...{n}`), name reflects index (`Torrent N`), and field values cycle through realistic distributions (categories cycle through `videos`/`audio`/empty, states cycle through uploading/downloading/pausedUP/pausedDL/stalledUP, etc.).
  - `createTorrentList(count)` — Creates an array of `count` torrents with incrementing indices.
  - `createFullMaindataDelta(count)` — Builds a `SyncMainData` full-update delta containing `count` torrents, two categories (`videos`, `audio`), three tags (`tag-a`, `tag-b`, `tag-c`), and a `server_state` with realistic values.
  - `createMaindataState(count)` — Builds a `MaindataState` (the accumulated form after one full merge) from a full delta.
  - `createDeltaMaindata(current, modifyHash, newName, removeHash, addedHash, addedTorrent)` — Creates an incremental delta that modifies one torrent's name, removes one torrent, adds a new torrent, and updates categories/tags/server_state. Used to test delta merging.

## Design

- **Deterministic generation**: All values are derived from the index parameter using simple arithmetic and modulo operations. This ensures identical output across runs, which is critical for snapshot testing and deterministic E2E scenarios.
- **Complete field coverage**: `createTorrent` populates every field required by the `Torrent` type from `@taurent/shared/types/qbittorrent`. No fields are left undefined or optional.
- **Realistic distributions**: Field values cycle through realistic states (e.g., `state` cycles through 5 qBittorrent states, `category` cycles through 3 options, `eta` is `-1` for 20% of torrents to represent unknown ETA).
- **Delta semantics**: `createDeltaMaindata` produces a proper incremental delta with `full_update: false`, `torrents_removed`, `categories_removed`, and `tags_removed` arrays, testing the full delta-merge contract.

## Flow

1. Test or mock code calls `createMaindataState(count)` to build initial state.
2. The mock bridge (`mockMobileBridge.ts`) stores this as `_currentState`.
3. When `syncMaindata()` is polled, the mock returns a full-update delta built from `_currentState`.
4. When `injectDelta()` is called, it uses `createDeltaMaindata` to build an incremental delta, applies it to `_currentState`, and queues it for the next poll.
5. Tests can assert on the resulting UI state after delta merging.

## Integration

- **../mockMobileBridge.ts** — Primary consumer. Uses `createMaindataState` for initial state and `createDeltaMaindata` for delta injection.
- **@taurent/shared/types/qbittorrent** — `Torrent`, `SyncMainData`, `MaindataState`, `Category`, `SyncServerState` types that the fixtures implement.
