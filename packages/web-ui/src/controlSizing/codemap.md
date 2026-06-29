# packages/web-ui/src/controlSizing/

## Responsibility

Cross-cutting density system that provides desktop/mobile control sizing for all web-ui primitives. Exposes a React context provider, a hook to read the active density, and static Tailwind class maps for every covered control family.

## Key Files

- `ControlDensityProvider.tsx` — React context provider and `useControlDensity()` hook
- `controlSizeClasses.ts` — Static class maps keyed by `ControlDensity` for each control family
- `index.ts` — Barrel re-export of provider, hook, types, and all class maps

## Design

- **ControlDensity**: `'desktop' | 'mobile'`. Desktop is the default when no provider is mounted, preserving existing compact sizing. Mobile opts in by mounting `<ControlDensityProvider value="mobile">` at the app shell.
- **ControlDensityProvider**: Thin context wrapper. Defaults to `'mobile'` so mobile apps opt in with a single-line mount; desktop apps leave it unmounted.
- **useControlDensity()**: Reads context, falls back to `'desktop'` when no provider is mounted.
- **Static class maps**: Every map is a `Record<ControlDensity, string | Partial<Record<...>>>`. Classes are statically enumerable so Tailwind's content scanner picks them up at build time. No dynamic class assembly at runtime.

## Covered Control Families

| Class Map | Consuming Primitive | What It Controls |
|-----------|-------------------|------------------|
| `BUTTON_CONTROL_SIZE_CLASSES` | Button | Per-size height/padding/text overrides |
| `INPUT_CONTROL_SIZE_CLASSES` | Input | Per-size height/padding/text |
| `INPUT_CONTROL_ICON_PADDING` | Input | Left padding when icon is present |
| `INPUT_CONTROL_CLEAR_PADDING` | Input | Right padding when clear button is present |
| `INPUT_CONTROL_ICON_OFFSET` | Input | Absolute left offset for icon container |
| `INPUT_CONTROL_CLEAR_OFFSET` | Input | Absolute right offset for clear button |
| `SELECT_CONTROL_TRIGGER_SIZE_CLASSES` | Select | Trigger button height/padding/text |
| `TOGGLE_CONTROL_WRAPPER_CLASSES` | ToggleSwitch | Outer wrapper negative margins for touch target |
| `TOGGLE_CONTROL_INNER_CLASSES` | ToggleSwitch | Inner pill geometry |
| `CHECKBOX_CONTROL_WRAPPER_CLASSES` | Checkbox | Outer wrapper padding for touch target |
| `TAB_BAR_PILL_ITEM_CLASSES` | TabBar | Pill tab item height/padding/text |
| `TAB_BAR_UNDERLINE_ITEM_CLASSES` | TabBar | Underline tab item height/padding/text |
| `ACTION_BUTTON_CONTROL_SIZE_CLASSES` | TorrentActions (ActionButton) | Full action button sizing |
| `ACTION_CHIP_CONTROL_SIZE_CLASSES` | TorrentActions (ActionChip) | Inline action chip sizing |
| `HEADER_ICON_BUTTON_SIZE_CLASSES` | ScreenHeader, IconButton | Icon button hit area (h-8/w-8 desktop, h-11/w-11 mobile) |
| `FILTER_LIST_ITEM_CONTROL_SIZE_CLASSES` | FilterListItem | Row height/padding/text |
| `FILTER_LIST_ITEM_LABEL_SIZE_CLASSES` | FilterListItem | Label font size |

## Flow

1. Mobile app shell mounts `<ControlDensityProvider value="mobile">` at root.
2. Desktop apps leave the provider unmounted (defaults to `'desktop'`).
3. Each covered primitive calls `useControlDensity()` and looks up the appropriate class map.
4. Desktop classes preserve existing compact sizing; mobile classes provide ~44px touch targets.

## Integration

- Consumed by all covered primitives in `components/primitives/`, `components/layout/ScreenHeader/`, `components/management/FilterListItem/`, `components/torrents/TorrentActions/`, `components/server-setup/AddTorrentScreenBody/`, and `components/settings/SettingsRow/` + `SettingsSection/`.
- Exported from `src/index.ts` for app-shell consumption.
