# packages/shared/src/icons/

## Responsibility

Centralized icon module providing a curated set of lucide-react icons, custom SVG icons, a string-to-component resolution map, and size constants. Acts as the single source of truth for all icon assets used in the shared package and consuming apps.

## Key Files

- `index.ts` — Re-exports 60+ icons from `lucide-react` (ArrowLeft, Check, Download, Search, Settings, etc.) and exposes the `LucideProps` type.
- `custom.tsx` — Four custom SVG icon components: `RatioIcon`, `SeedsIcon`, `SortIcon`, `ArrowUpDownIcon`. Each accepts `LucideProps` (minus `ref`) and renders an inline `<svg>` with `viewBox="0 0 24 24"`.
- `iconMap.ts` — Defines:
  - `AppIconName` — union of 42 string literal icon names (`'alert' | 'arrow-left' | ... | 'zap'`).
  - `CUSTOM_ICONS` — maps custom icon keys (`CUSTOM_RATIO`, `CUSTOM_SEEDS`, `CUSTOM_SORT`, `CUSTOM_ARROW_UP_DOWN`) to their components.
  - `iconMap` — `Record<AppIconName, LucideIcon | CustomIconKey>` mapping each name to either a lucide component or a custom key string.
  - `isCustomIcon(name)` — type guard narrowing `LucideIcon | CustomIconKey` to `CustomIconKey`.
  - `getIconComponent(name)` — resolves an `AppIconName` to its React component (lucide or custom).
- `sizes.ts` — `ICON_SIZES` constant: `{ xs: 10, sm: 12, md: 16, lg: 20, xl: 24 }` and `IconSize` type.

## Design

- **Icon registry/adapter**: `iconMap` acts as a registry mapping application string icon names to concrete React components, decoupling consumers from the underlying icon library.
- **Type safety**: `AppIconName` union ensures only allowed icon names; `iconMap` typed as `Record<AppIconName, LucideIcon | CustomIconKey>`.
- **Custom icon extensibility**: New icons are added by creating a component in `custom.tsx`, adding an entry to `CUSTOM_ICONS`, mapping an `AppIconName` to the custom key in `iconMap`, and adding the name to the `AppIconName` union.

## Flow

1. Consumer uses `<Icon name="search" />` or imports `AppIconName` for prop typing.
2. `Icon` component calls `getIconComponent(name)` from `iconMap.ts`.
3. `getIconComponent` looks up `iconMap[name]`; if the value is a custom key (`isCustomIcon`), returns `CUSTOM_ICONS[key]`; otherwise returns the lucide icon.
4. Resulting component renders with props (`size`, `strokeWidth`, `className`).

## Integration

- **Internal**: `components/Icon/Icon.tsx` imports `iconMap`, `CUSTOM_ICONS`, `isCustomIcon` from `icons/iconMap`.
- **External**: Exported from `packages/shared/src/index.ts` as `export * from './icons/index'`, `export { RatioIcon } from './icons/custom'`, `export { ICON_SIZES, type IconSize } from './icons/sizes'`.
- **Dependencies**: `lucide-react` (base icons), React (rendering custom SVG components).
- Consumed by desktop and mobile apps for all inline icon usage.
