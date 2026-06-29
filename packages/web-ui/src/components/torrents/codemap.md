# packages/web-ui/src/components/torrents/

## Responsibility

Contains shared presentational components for torrent-related UI across both HomeScreen and TorrentDetailScreen. Provides the torrent detail header, action primitives (buttons, chips, action bar), and the presentation model layer that bridges headless mutations to UI descriptors. Sub-modules: `TorrentDetailHeader/`, `TorrentActions/`.

## Design

- **`TorrentDetailHeader/`** — read-only header card for a single torrent (name, status, progress, stats grid). Render prop for badges.
- **`TorrentActions/`** — reusable action UI components (`ActionButton`, `ActionChip`, `TorrentActionsBar`) plus `model.ts` presentation model with builder functions that convert mutation objects to `TorrentActionDescriptor[]`. The model is decoupled from web-core via local mutation shape interfaces.
- **Pattern** — all components are `React.memo` wrapped. Data flows down via props; callbacks flow up. No internal data fetching or state management beyond UI-local concerns.

## Flow

- **HomeScreen batch flow**: controller mutations → `buildPrimaryBatchActions()` / `buildSecondaryBatchActions()` → `SelectionBar` renders `TorrentActionsBar`.
- **Detail screen flow**: controller mutations → `buildDetailActions()` → `TorrentDetailScreenBody` renders `TorrentActionsBar`.
- **Header flow**: parent passes `torrent` + `properties` → `TorrentDetailHeader` renders stat grid.

## Integration

- **HomeScreen** — imports `TorrentActionsBar`, `ActionButton`, `ActionChip` for selection bar; imports batch action builders from `model.ts`.
- **TorrentDetailScreen** — imports `TorrentDetailHeader` for desktop header; uses `TorrentActionsBar` for action bar.
- **`@taurent/shared`** — `cn`, `Icon`, `AppIconName`.
- **Also contains** — `TorrentDetailsSections/` (sub-component directory for overview, trackers, peers, files sections used by `TorrentDetailScreen`).
- **Exported barrel** — `index.ts` re-exports from both `TorrentDetailHeader/` and `TorrentActions/`.
