# SettingsSection

## Responsibility

Collapsible section container with icon, title, summary, and chevron indicator.

## Design

`React.memo` component. Supports controlled (`expanded`/`onToggle`) and uncontrolled (`defaultExpanded`) modes. Renders as a bordered card with a clickable header. Children rendered below the header when expanded, with a bottom border separator. Density-aware header sizing via `useControlDensity()` — mobile uses `min-h-11 px-3 py-2`, desktop uses `px-2 py-2`.

## Flow

Click toggles expansion. Controlled mode calls `onToggle`. Uncontrolled mode manages internal state.

## Integration

Used by `FiltersScreenBody` for filter sections and by `SettingsScreenBody` for settings sections.
