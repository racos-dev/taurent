# SidebarFilterItem

## Responsibility

A single selectable button row for sidebar filter navigation, showing an icon, label, and optional count badge.

## Design

Plain functional component (not memoized). Uses `aria-pressed` for accessibility. Active state applies `bg-primary text-text-on-primary`. Supports `onContextMenu` for right-click/long-press actions.

## Flow

Props in → rendered button. Click calls `onClick`, context menu calls `onContextMenu`.

## Integration

Used in sidebar/rail filter lists on desktop and mobile. Consumed by `FiltersScreen` and related filter UI.
