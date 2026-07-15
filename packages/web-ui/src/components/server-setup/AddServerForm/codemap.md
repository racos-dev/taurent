# packages/web-ui/src/components/server-setup/AddServerForm/

## Responsibility

A pure presentational form for adding a new qBittorrent server connection. It collects server identity (name, URL), credentials (username/password or API key), and a "remember password" preference, then delegates submission to a parent controller. This component owns no state or side effects — it is fully controlled via props.

## Design

- **Fully controlled component**: All form state (`name`, `url`, `username`, `password`, `apiKey`, `rememberPassword`, `useApiKey`) is passed in as props alongside `on*Change` callbacks. The component is a pure leaf — it never calls `useState`, `useEffect`, or any bridge/controller API directly.
- **Wrapped in `React.memo`**: Renders are skipped when props haven't changed, which matters because the parent controller (`useAddServerScreenController`) re-renders on every keystroke debounce.
- **Dual auth modes** toggled by `useApiKey`:
  - When `false` (default): shows Username field, Password field (type `password`), and a "Remember password" checkbox.
  - When `true`: hides Username, shows API Key field (type `text`), hides Remember checkbox. The credential label and placeholder update reactively.
  - `useApiKey` is rendered as a card-style labeled `ToggleSwitch` at the bottom of the form.
- **Validation is local and derived**: `isFormValid` is computed inline from trimmed field lengths and the optional `validationErrors` map. The form submit handler short-circuits if `!isFormValid || isSubmitting`.
- **URL suggestion**: An optional inline banner below the URL field shows a corrected URL that the parent detected; clicking it fires `onUrlChange(urlSuggestion)`.
- **Error banner**: A top-of-form error box renders `error` (e.g. connection failure) using semantic error tokens.
- **Submit button shows a `Spinner`** and "Adding..." text while `isSubmitting` is true; both actions are disabled during submission.
- **Primitives consumed**: `Input`, `Button`, `Checkbox`, `ToggleSwitch` (from `../../primitives/`), and `Spinner` (from `../../shared/`).
- **Semantic Tailwind tokens only**: Uses `text-error`, `bg-error-20`, `text-text-secondary`, `text-text-primary`, `border-border`, `border-border-focus`, `bg-surface`, `text-primary` — no literal color classes.
- **Display name** set via `AddServerForm.displayName = 'AddServerForm'` for DevTools profiling.

## Flow

```
Parent (controller hook, e.g. useAddServerScreenController)
  │
  │  passes state + callbacks + validation + error as props
  ▼
AddServerForm (pure presentational)
  │
  │  renders form; user types / toggles / submits
  │  calls back on*Change / onSubmit / onCancel
  ▼
Parent controller
  │
  │  validates, tests connection, persists server
  │  feeds updated state/errors back into props
  ▼
AddServerForm re-renders (or skips via React.memo)
```

- Every user interaction calls straight back to the parent — no intermediate state, no debounce, no form library.
- On submit, `isSubmitting` goes true, fields and buttons lock, and the submit button shows a spinner.
- On error, the parent sets `error` prop and the error banner appears.
- On URL suggestion click, the parent replaces the URL value and clears the suggestion.

## Integration

- **Exported** via `index.ts` as both `AddServerForm` (component) and `AddServerFormProps` (type).
- **Primary consumer**: `ServerOverviewSettingsPanel` in `packages/web-ui/src/components/settings/ServerOverviewSettingsPanel/`. An `InlineAddServerForm` wrapper inside that panel creates a `useAddServerScreenController` from `@taurent/web-core/screens` and wires its return value into `AddServerForm`'s props. This is the only in-tree usage.
- **Controller hook** (`useAddServerScreenController`) lives in `@taurent/web-core` and owns validation, URL normalization via `bridgeServers.normalizeServerUrl`, async server creation, and error state.
- **Bridge dependency**: The controller indirectly depends on `@taurent/bridge` for the `normalizeServerUrl` call and the `addServer` async operation.
- **No `@tauri-apps/*` import**: This component is pure React + web-core primitives, so it works identically in both desktop (Tauri) and mobile (Tauri) shells, as well as browser-only dev mode.
