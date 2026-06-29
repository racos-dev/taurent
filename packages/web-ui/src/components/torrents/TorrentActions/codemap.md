# packages/web-ui/src/components/torrents/TorrentActions/

## Responsibility

Provides reusable action UI primitives (`ActionButton`, `ActionChip`, `TorrentActionsBar`) and a presentation model layer (`model.ts`) that converts headless mutation objects into UI-ready action descriptors. Used by both HomeScreen (batch actions) and TorrentDetailScreen (single-torrent actions).

## Design

- **UI Components (`TorrentActions.tsx`)**:
  - `ActionButton` — full-width button with icon + label, supports `tone` (primary/secondary/danger). Used for primary actions (Resume, Pause, Delete). Density-aware sizing via `ACTION_BUTTON_CONTROL_SIZE_CLASSES[density]` — mobile gets `min-h-11` with `text-sm`.
  - `ActionChip` — compact inline chip with icon + label, supports `isActive` toggle state. Used for secondary actions (Recheck, Announce, Force Start, DL/UL Limit, etc.). Density-aware sizing via `ACTION_CHIP_CONTROL_SIZE_CLASSES[density]` — mobile gets `min-h-11` with `text-sm`.
  - `TorrentActionsBar` — layout container with primary actions (grid) and horizontally scrollable secondary actions with gradient fade edges.
- **Presentation Model (`model.ts`)**:
  - `TorrentActionDescriptor` — UI-only descriptor type: `{ key, icon, label, tone, disabled, isPending, onClick }`.
  - `buildHashListAction()` — generic builder for hash-list mutations (pause, resume, recheck, reannounce, priority changes). Handles pending labels and batch-gating.
  - `buildPrimaryBatchActions()` — builds the Resume/Pause/Delete trio for batch selection bar.
  - `buildSecondaryBatchActions()` — builds the scrollable chips row: recheck, reannounce, DL/UL limit, category, tags, queue up/down.
  - `buildDetailActions()` — builds single-torrent action set for the detail screen (pause/resume, delete, force start, recheck, reannounce).
- **Decoupling** — `model.ts` defines minimal mutation shapes (`HashListMutation`, `DeleteMutation`, `SpeedLimitMutation`, `ForceStartMutation`, `CategoryMutation`, `TagsMutation`) without importing from web-core, preventing dependency cycles.

## Flow

1. Controller provides raw mutation objects (`{ isPending, mutateAsync }`) and selected hashes.
2. Builder functions convert mutations into `TorrentActionDescriptor[]`.
3. UI components (`ActionButton`, `ActionChip`) render descriptors; click handlers invoke `onClick` (which wraps `mutateAsync` or controller handler).
4. Parent (`HomeScreenBody` or `TorrentDetailScreenBody`) arranges descriptors into `TorrentActionsBar`.

## Integration

- **`@taurent/shared`** — `cn`, `Icon`, `AppIconName`.
- **HomeScreen** — `SelectionBar` uses `TorrentActionsBar` with batch action descriptors from `model.ts` builders.
- **TorrentDetailScreen** — uses `TorrentActionsBar` with detail action descriptors.
- **Exported from `index.ts`**: `ActionButton`, `ActionChip`, `TorrentActionsBar`, `buildPrimaryBatchActions`, `buildSecondaryBatchActions`, `buildHashListAction`, `TorrentActionDescriptor`.
