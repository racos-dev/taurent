# DeleteTorrentDialog

## Responsibility

Three-action delete confirmation dialog: delete torrent only, delete torrent + files, or cancel.

## Design

`React.memo` component wrapping `Dialog` + `DialogActions` with `layout="stack"`. Pluralizes noun based on `count`. Uses danger tone for the "delete + files" button.

## Flow

Always open. `onDelete(deleteFiles: boolean)` fires with `false` (torrent only) or `true` (torrent + files). `isPending` disables all buttons during mutation.

## Integration

Used by `HomeScreenBody` and `TorrentDetailScreenBody` for torrent deletion.
