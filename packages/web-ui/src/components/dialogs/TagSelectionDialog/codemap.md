# TagSelectionDialog

## Responsibility

Multi-select dialog for adding/removing tags on selected torrents.

## Design

`React.memo` component wrapping `Dialog` + `DialogActions`. Manages internal `selectedTags: Set<string>` state. Computes add/remove sets by comparing selections against `assignedTags`. Footer has three sections: add button, remove button (danger tone), and cancel.

## Flow

Always open. Toggle tags by clicking. Add/remove buttons call `onAddTags(tags[])` / `onRemoveTags(tags[])` with the computed diff. Parent closes dialog. `isPending` disables actions.

## Integration

Used by `HomeScreenBody` and `TorrentDetailScreenBody` for batch tag assignment.
