# FilePriorityDialog

## Responsibility

Single-select dialog for choosing a file download priority (Do Not Download, Normal, High, Maximal).

## Design

`React.memo` component wrapping `Dialog`. Renders a list of priority buttons; the currently active priority is highlighted. Each button click immediately calls `onSubmit(priority)`.

## Flow

Always open. Button click calls `onSubmit` with the `FilePriority` enum value. Parent closes dialog. `isPending` disables buttons during mutation.

## Integration

Used by `TorrentDetailScreenBody` for changing individual file priorities within a torrent.
