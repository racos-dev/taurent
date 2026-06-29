# apps/desktop/src/testing/fixtures/

## Responsibility

Provides deterministic fixture factories for generating torrent and maindata test data. Used by the mock desktop bridge and by direct test consumption.

## Design

- **Deterministic hashes**: Torrent hashes are generated from index-based padding (`abcd0000...0001`) for stable identity across test runs.
- **Full field coverage**: `createTorrent()` populates every field required by the `Torrent` type with realistic, index-derived values.
- **Delta generation**: `createDeltaMaindata()` builds incremental `SyncMainData` deltas that modify, remove, and add torrents in a single operation.

## Key Files

- **torrent.ts** — Exports `createTorrent(index)`, `createTorrentList(count)`, `createFullMaindataDelta(count)`, `createMaindataState(count)`, and `createDeltaMaindata(current, modifyHash, newName, removeHash, addedHash, addedTorrent)`.

## Integration

- Consumed by `mockDesktopBridge.ts` for scenario data generation.
- Available for direct test import in Vitest and Playwright tests.
