# packages/web-ui/src/screens/RSSScreen/

## Responsibility

Provides the platform-agnostic presentational body for the qBittorrent RSS feed and rule management screen. Manages two tabs (Feeds, Rules), CRUD operations for RSS feeds and auto-downloading rules, and capability gating. Pure UI: all data and mutations arrive via props.

## Design

- **`RSSScreenBody`** — top-level `React.memo` component (`RSSScreenProps`). Contains capability gating (loading → unsupported → offline), tab switching, feed list, rule list, and dialog orchestration.
- **Sub-components**:
  - `RSSItemRow` — memo; renders feed name, URL link, folder badge, edit/remove buttons (hidden for folders).
  - `RSSRuleRow` — memo; renders rule name, enabled badge, match info rows (must contain, excludes, episode, feeds, category, save path, last match), edit/remove buttons.
  - `FeedDialog` — memo; handles both add and edit modes for RSS feed URLs; normalizes forward slashes to backslashes for qBittorrent compatibility.
  - `RuleEditor` — memo; full rule creation/editing form with fields: name (read-only when editing, separate rename), enabled toggle, must contain/exclude, regex toggle, episode filter, smart filter, affected feeds textarea, assigned category, save path, add paused toggle, ignore days.
- **Normalized types** — `NormalizedRSSItem` (with `path` as canonical ID) and `NormalizedRSSRule` (with `WriteSafeRssRuleInput` excluding read-only fields like `lastMatch`).
- **Local state** — the body manages dialog open/close state, active tab, and delete confirmation target internally, unlike most other screens where all dialog state is external.

## Flow

1. Controller checks RSS capability → passes `isSupported`, `isUnsupported`, `isCapabilityLoading`.
2. Tab switch between Feeds and Rules → local `activeTab` state.
3. Feed CRUD: Add → opens `FeedDialog` (add mode) → submit → `onAddFeed(path, url)`. Edit → opens `FeedDialog` (edit mode) → `onEditFeedUrl(path, url)`. Delete → `ConfirmDialog` → `onRemoveItem(path)`.
4. Rule CRUD: Create → opens `RuleEditor` (no initial rule) → submit → `onSetRule(ruleName, rule)`. Edit → opens `RuleEditor` (with initial rule) → submit. Rename → inline in editor → `onRenameRule(ruleName, newRuleName)`. Delete → `ConfirmDialog` → `onRemoveRule(ruleName)`.

## Integration

- **`@taurent/web-ui`** — `TabBar`.
- **`@taurent/shared`** — `cn`, `Icon`, `Edit2`, `Trash2`.
- **Local shared components** — `StateSurface`, `InfoRow`, `SkeletonBlock`, `ConfirmDialog`, `Dialog`, `Input`, `Button`, `RetryButton`, `ToggleSwitch`.
- **Controller layer** — all mutation states and action handlers are injected; controller owns React Query mutations.
- **Exported from `index.ts`**: `RSSScreenBody`, `RSSScreenProps`, `NormalizedRSSItem`, `NormalizedRSSRule`, `WriteSafeRssRuleInput`.
