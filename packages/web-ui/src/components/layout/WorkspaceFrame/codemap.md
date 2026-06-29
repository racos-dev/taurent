# WorkspaceFrame

## Responsibility

Top-level workspace layout shell that composes header, left rail, primary content, right inspector, and footer regions.

## Design

`React.memo` component with `variant: 'desktop' | 'mobile'`. Desktop renders a three-column layout (rail | content | inspector) with border separators. Mobile renders a single-column layout (header | scrollable content | footer). Rail and inspector are only rendered on desktop. All regions accept `className` overrides.

## Flow

Pure presentational. Accepts `ReactNode` slots for each region. No state.

## Integration

Used by screen bodies and app shells to define the overall page structure. The primary layout wrapper for desktop multi-pane views.
