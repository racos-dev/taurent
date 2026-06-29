# packages/shared/src/components/Icon/

## Responsibility

Type-safe icon component that resolves a string `AppIconName` to the corresponding lucide-react or custom SVG React component and renders it with consistent props.

## Design

- **Adapter pattern**: `Icon` wraps `getIconComponent(name)` from `icons/iconMap.ts` and renders the resolved component with uniform `size`, `strokeWidth`, `className`, and `...props`.
- **Size resolution**: Accepts either a raw `size` number or an `iconSize` key (`xs|sm|md|lg|xl`) which maps to pixel values via `ICON_SIZES` from `icons/sizes.ts`.
- **Memoized resolution**: `useMemo` caches the resolved component reference keyed on `name` to avoid re-renders.
- **Re-exports**: Exports `AppIconName` type for consumers to use in their prop types.

## Flow

1. Consumer renders `<Icon name="search" iconSize="md" />`.
2. `Icon` resolves `iconSize` → `ICON_SIZES.md` = `16` (or uses raw `size` prop).
3. `useMemo` looks up `iconMap[name]` → if custom key (via `isCustomIcon`), resolves to `CUSTOM_ICONS[key]`; otherwise returns the lucide component.
4. Renders `<IconComponent size={16} strokeWidth={2} className="" ...props />`.

## Integration

- Imports `iconMap`, `CUSTOM_ICONS`, `isCustomIcon`, `AppIconName` from `../../icons/iconMap`.
- Imports `ICON_SIZES`, `IconSize` from `../../icons/sizes`.
- Re-exported from `packages/shared/src/index.ts` as `{ Icon, type AppIconName }`.
- Consumed by desktop and mobile apps for all inline icon usage.
