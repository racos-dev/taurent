# IconButton

## Responsibility

Compact icon-only button primitive with variant, tone, active state, and loading state. Used for header actions, inline toolbar buttons, and destructive row actions.

## Design

`React.memo` component. Renders a `<button>` with `inline-flex` centering, rounded corners, and semantic color classes. Density-aware sizing via `HEADER_ICON_BUTTON_SIZE_CLASSES[density]` from `controlSizing`.

- **Variants**: `surface` (default bg), `ghost` (transparent bg), `outline` (bordered).
- **Tones**: `default`, `primary`, `danger` — control hover/active color emphasis.
- **Active state**: `isActive` prop applies a persistent highlight matching the tone (e.g., `bg-primary/10 text-primary`).
- **Loading state**: Replaces children with `<Spinner variant="ring" size="md" />` and disables the button.
- **Types file**: Exports `IconButtonTone`, `IconButtonVariant`, and `IconButtonProps` (extends `ButtonHTMLAttributes` with `title`, `children`, `isActive`, `loading`, `tone`, `variant`).

## Flow

Controlled via props. Click calls `onClick` (suppressed when disabled/loading). No internal state.

## Integration

Used by `ServerCard` (delete button), `ScreenHeader` (back button), `FilterCategorySection` (refresh/add/delete buttons), `FilterTagSection` (refresh/add/delete buttons), `HomeScreenBody` (sort/add buttons), and other screens needing icon-only actions.
