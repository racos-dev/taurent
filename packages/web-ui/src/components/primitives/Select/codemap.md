# Select

## Responsibility

Custom dropdown select with options, disabled items, label, error, hidden form input, and keyboard navigation.

## Design

Uses `useDropdownPanel` + `DropdownPanel` from the Dropdown primitive. Generic component supporting `string | number` option values. Renders a trigger button with chevron, a portal-based listbox panel, and optional hidden `<input>` for form submission. Supports right-aligned panel positioning. Density-aware trigger sizing via `SELECT_CONTROL_TRIGGER_SIZE_CLASSES[density]`.

## Flow

1. Click/keyboard opens the dropdown panel.
2. Arrow keys navigate options. Enter/Space selects. Escape closes.
3. Selection calls `onChange(value)` and closes the panel.
4. Typeahead searches options by label prefix.

## Integration

Used by `AddTorrentScreenBody`, `RemoteSettingsPanel`, and other forms for select inputs.
