# rss

## Responsibility

Capability-gated RSS controller and screen model hooks. Provides data fetching for RSS feeds and rules, and composition with RSS mutations. RSS is treated as experimental since not all servers enable it. RSS response normalization is now owned by Rust (`qb-core::dto`); this module consumes typed bridge DTOs directly.

## Key Files

- `index.ts` — Barrel export
- `useRssController.ts` — Main hook that fetches RSS items and rules with capability gating; consumes typed `RssItem[]`/`RssRule[]` bridge DTOs directly (Rust owns normalization); coerces optional `url` field to `null` for downstream compatibility
- `useRssScreenModel.ts` — Composes `useRssController` with all RSS mutations (addFeed, editFeedUrl, removeItem, setRule, renameRule, removeRule) into a single screen model
- `createRssAdapterFns.ts` — Adapter factory that constructs fetch functions and mutation object from a `QBClientBridge`; moves bridge bundle construction from app-level screens into shared web-core

## Design Patterns

- **Capability gating**: Only fetches when `supported === true`; returns empty arrays when unsupported; `null` = probing state
- **Dual queries**: Fetches both items and rules in parallel via separate React Query hooks
- **Typed Rust DTOs**: RSS normalization is owned by `qb-core::dto` (T142.1/T142.2); the hook consumes typed `RssItem[]`/`RssRule[]` bridge DTOs directly, applying only narrow UI compatibility (coercing optional `url` to `null`)
- **Adapter factory**: `createRssAdapterFns` constructs fetch functions and mutations from a `QBClientBridge`, reducing route-level contract knowledge
- **Screen model composition**: `useRssScreenModel` wires controller + mutations + capability state into a flat result object

## Flow

1. `useRssController` checks `supported` flag before enabling queries
2. Items/rules are fetched as typed `RssItem[]`/`RssRule[]` bridge envelopes (Rust owns normalization)
3. Optional `url` field is coerced from `undefined` to `null` for downstream compatibility
4. `useRssScreenModel` composes controller with mutation hooks from `hooks/useRssMutations.ts`
5. Mutations invalidate RSS items and rules queries on success

## Architecture notes

- RSS response normalization is now owned by Rust (`qb-core::dto::parse_rss_items` / `parse_rss_rules` — T142.1). The typed `RssItem`/`RssRule` bridge types are re-exported from `@taurent/bridge` and consumed directly by this module. The only UI-facing normalization remaining is coercing `undefined` optional fields to `null` for downstream compatibility.

## Integration

- Imports React Query from `@tanstack/react-query`
- Imports `QueryScope` from `query/scope`
- Gated by `capabilities/supportsRss` from `capabilities/resolver.ts`
- Mutation hooks imported from `hooks/useRssMutations.ts`
- Used by desktop/mobile RSS UI screens
