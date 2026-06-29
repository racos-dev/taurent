# packages/web-ui/src/components/layout/

## Responsibility

Workspace framing, navigation headers, toolbar bars, and section containers for multi-pane desktop layouts and mobile single-pane layouts.

## Design

- **WorkspaceFrame**: Top-level layout shell with `header`, `rail`, `content`, `inspector`, and `footer` regions. Desktop variant renders a three-column layout (rail | content | inspector). Mobile variant renders a single-column layout (header | content | footer). Rail and inspector are ignored on mobile.
- **ScreenHeader**: Sticky header with title, optional back button (different styling per platform), optional right action slot, and optional left icon.
- **CommandBar**: Horizontal toolbar bar with bottom border. `CommandBarGroup` nests items within the bar.
- **ContextRailSection**: Titled section container for the left rail with optional description.
- **InspectorSection**: Titled section container for the right inspector panel with bottom border separators.

## Flow

Layout components are pure presentational shells — they accept `ReactNode` slots and render them in the correct layout regions. No state, no effects (except WorkspaceFrame which has none).

## Integration

Composed by screen bodies (`HomeScreenBody`, `TorrentDetailScreenBody`, etc.) and app shells to build the overall page structure. Consumed via `src/index.ts` barrel.
