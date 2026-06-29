# TabBar

## Responsibility

Tab switcher with underline and segmented (default) variants.

## Design

`React.memo` component. Segmented variant: CSS grid layout with pill-style active state. Underline variant: bottom border indicator. Both use `role="tablist"` and `role="tab"` with `aria-selected`. Density-aware item sizing via `TAB_BAR_PILL_ITEM_CLASSES[density]` and `TAB_BAR_UNDERLINE_ITEM_CLASSES[density]` — mobile adds `min-h-11` for touch targets.

## Flow

Controlled via `activeTab`/`onTabChange`. Click calls `onTabChange(tabId)`. No internal state.

## Integration

Used by `TorrentDetailScreenBody` for detail section tabs, `RSSScreenBody` for RSS tabs, and `SearchScreenBody` for search tabs.
