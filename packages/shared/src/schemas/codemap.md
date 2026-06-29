# packages/shared/src/schemas/

## Responsibility

Zod schema definitions for validating qBittorrent API responses and form data at runtime. Provides runtime validation for all API responses to ensure type safety and catch malformed data. Schemas mirror the TypeScript types in `../types/`.

## Key Files

- `qbittorrent.ts` — Zod schemas for all qBittorrent API types:
  - **Enums**: `TorrentStateEnum` (19 states), `TrackerStatusEnum` (0–4), `FilePriorityEnum` (0/1/6/7), `PieceStateEnum` (0/1/2), `ConnectionStatusEnum`.
  - **Entity schemas**: `TorrentSchema` (39 fields), `TorrentPropertiesSchema`, `TrackerSchema`, `WebSeedSchema`, `TorrentFileSchema`, `CategorySchema`.
  - **Transfer/Build**: `TransferInfoSchema`, `BuildInfoSchema`.
  - **Sync payloads**: `SyncMainDataSchema` (with `FullUpdateSchema` transform normalizing boolean/number/string to boolean), `SyncTorrentPeersSchema`, `SyncTorrentPeersPeerDataSchema`.
  - **Search/RSS**: `SearchResultSchema`, `SearchStatusSchema`, `SearchPluginSchema`, `RSSItemSchema`, `RSSRuleSchema`.
  - **Cookie**: `CookieSchema` (API v2.11.3+).
  - `FullUpdateSchema` — custom Zod transform that normalizes the `full_update` field from qBittorrent's inconsistent representations (boolean, number 0/1, string "0"/"1"/"true"/"false") to a boolean.

- `addTorrent.ts` — `AddTorrentModeEnum` (`'file' | 'magnet'`), `AddTorrentFormSchema` (mode, magnetUri, files, savePath, category, tags, sequentialDownload, skipChecking, paused, rootFolder, rename, upLimit, dlLimit, autoTMM, firstLastPiecePrio, contentLayout, stopCondition, addToTop), `validateMagnetLink` helper.

## Design

- **Zod validation**: All schemas use Zod for compile-time type inference and runtime validation.
- **Enum matching**: Zod enums mirror TypeScript enums in `../types/qbittorrent.ts` for consistency.
- **Type inference**: Uses `z.infer` for deriving TypeScript types from schemas (e.g., `AddTorrentFormData`).
- **Full-update normalization**: `FullUpdateSchema` handles qBittorrent's inconsistent `full_update` field format across API versions.

## Integration

- Imported by `utils/validation.ts` which wraps schemas in `Validators.*` convenience functions.
- Used by web-core and bridge adapters for API response validation before pushing data into stores.
- `AddTorrentFormSchema` used by add-torrent forms in desktop and mobile apps.
- Must stay in sync with `types/qbittorrent.ts` — when DTOs change, update corresponding schemas.
