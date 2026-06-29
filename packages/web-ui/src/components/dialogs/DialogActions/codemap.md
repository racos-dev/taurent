# DialogActions

## Responsibility

Renders an array of action buttons in a row or stacked layout for dialog footers.

## Design

`React.memo` component. Maps `DialogAction[]` to `Button` components. Supports `layout: 'row' | 'stack'`, `size`, and `stretch` (flex-1 on all buttons). Each action can specify `variant`, `disabled`, `loading`, `type`, and custom `className`.

## Flow

Props in → rendered button group. Button clicks call `action.onClick`.

## Integration

Used as the `footer` prop of `Dialog`, `ConfirmDialog`, `DeleteTorrentDialog`, `InputDialog`, `NumberInputModal`, `CategorySelectionDialog`, `TagSelectionDialog`, `FilePriorityDialog`, and `AddTorrentScreenBody`.
