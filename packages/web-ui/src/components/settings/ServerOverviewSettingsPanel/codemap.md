# ServerOverviewSettingsPanel

## Responsibility

Server profile management — list, add, edit, delete, test connection, switch servers, with auto-scheme detection.

## Design

`React.memo` component. Full CRUD for server profiles. Includes auto-scheme detection: tries HTTPS first, falls back to HTTP on network-level errors. Inline edit forms with validation. Test connection results shown per-server. Active server highlighted with badge and left accent bar. Uses `useAddServerScreenController` from `@taurent/web-core` for inline add form.

## Flow

1. Add: Opens inline add form → uses `AddServerFormBody` + controller → `onAddServer(name, url, username, password)`.
2. Edit: Clicks edit → inline form → Save → `onSaveServer(id, data)`.
3. Delete: Clicks trash → `onRemoveServer(id)`.
4. Test: Clicks test → `onTestConnection(url, username, password)` or `onTestSavedServerConnection(id)`.
5. Switch: Clicks Connect → `onSwitchServer(id)`.

## Integration

Used by `SettingsScreenBody` for the server overview section. Depends on `@taurent/web-core` for `useAddServerScreenController`.
