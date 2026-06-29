# ScreenHeader

## Responsibility

Sticky navigation header with title, optional subtitle (mobile only), optional back button, optional right action, and optional left icon.

## Design

`React.memo` component with `variant: 'desktop' | 'mobile'`. Desktop uses solid background and bordered back button. Mobile uses translucent backdrop blur and borderless back button, with a 3-column CSS grid layout for centering. Back button uses `IconButton` primitive. Mobile back button is conditionally rendered based on `onRightAction` presence to maintain centering. Density-aware icon button sizing via `HEADER_ICON_BUTTON_SIZE_CLASSES[density]` from `controlSizing`. Mobile content width is constrained via `mobileWidth` prop (`'compact' | 'wide'`).

## Flow

Pure presentational. Back button click calls `onBack`. No state.

## Integration

Used by screen bodies and app shells as the top header for each screen.
