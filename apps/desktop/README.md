# Taurent

A Tauri-based desktop application for managing qBittorrent installations remotely.

## Running the App

**Always use Tauri development mode:**

```bash
pnpm run desktop:dev
```

This runs the app in Tauri development mode, which:
- Compiles and opens the native desktop window
- Uses the Tauri HTTP plugin for native network calls (bypasses CORS)
- Provides hot module replacement for fast development

**Do NOT use `pnpm run desktop`** - that only runs the Vite dev server in a browser, which has CORS issues.

## First Run

The first time you run `pnpm run desktop:dev`, it will:
1. Compile Rust dependencies (can take several minutes)
2. Build the Tauri app bundle
3. Open the desktop application window

Subsequent builds will be much faster.

## Building Distributable

```bash
pnpm run desktop:build        # frontend build only (Vite output, not a native app)
pnpm --filter taurent tauri build   # native Tauri bundle (installers in src-tauri/target/release/bundle/)
```

`desktop:build` compiles the React/TypeScript frontend into `dist/`. To produce platform-native installers (`.dmg`, `.exe`, etc.), use the Tauri build command directly. Both commands require `pnpm install` first.

## Development

The desktop app uses:
- **React** with TypeScript for the UI
- **Vite** for bundling and hot module replacement
- **Tauri 2.x** for native desktop capabilities
- **Tauri HTTP Plugin** for native network calls (no CORS)
- **Tailwind CSS** for styling

## System tray menu

The desktop shell exposes a qBittorrent-style tray context menu for common native actions:

- `Show` / `Hide` toggles the main window and updates its label from the current window state.
- `Add Torrent File/Magnet...` opens the add-torrent window directly, without restoring the main window first.
- `Alternative Speed Limits` toggles the session's alternative speed mode from Rust and keeps the tray check state in sync with the renderer's next menu-state update.
- `Set Global Speed Limits...` opens the combined global upload/download speed-limit dialog directly, without restoring the main window first.
- `Quit` performs the app's intentional quit flow.

Tray behavior depends on the native runtime. Validate changes manually with `pnpm desktop:dev`, not only mocked renderer tests.

## Desktop testing layers

Use the narrowest layer that can prove the behavior honestly:

| Layer | Primary command | Use it for | Avoid using it for |
| --- | --- | --- | --- |
| Fast unit/contract suite | `pnpm test:unit` | shared/package Vitest plus desktop/web-core correctness checks that should stay cheap in CI | route orchestration or native runtime behavior |
| Desktop unit/browser tests | `pnpm desktop:test`, `pnpm desktop:test:browser` | hooks, components, selectors, state transitions, dirty-state logic | multi-window Tauri behavior |
| Mocked renderer integration | `pnpm desktop:renderer:e2e` | route orchestration, dialog routing, selection flows, mocked side-effect assertions | claiming native Tauri coverage |

### Choosing the right layer

- Put pure logic in package/app Vitest first.
- Keep `pnpm test:unit` as the default CI entrypoint for fast correctness coverage.
- Add mocked renderer Playwright only when the behavior depends on route orchestration or cross-component integration.
- Validate behavior that truly depends on real windows or Tauri plugins manually with `pnpm desktop:dev`.
- Rely on the Linux Tauri build in PR CI to catch native compilation and bundling integration failures.

## Local hooks and CI lanes

`pnpm install` now wires lightweight local git hooks through `simple-git-hooks`.

- `pre-commit` runs `pnpm ci:pre-commit`:
  - `node scripts/ci/check-versions.mjs`
  - `pnpm lint`
- `pre-push` runs `pnpm ci:pre-push`:
  - `node scripts/ci/check-versions.mjs`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test:unit`

These hooks are intentionally limited to cheap deterministic checks that developers can run locally.

The GitHub Actions lanes are split by purpose:

- `.github/workflows/pr-ci.yml` runs the review-time lane on pull requests:
  - `js-quality`
  - `rust-quality`
  - `native-build`
  - Run `pnpm ci:local:full` locally before opening high-risk PRs.
- `.github/workflows/release-build.yml` runs release preflight, multi-platform desktop packaging, unsigned Android APK packaging, and GitHub Release publishing for `v*` tags or manual dispatch.

Keep packaged release builds CI-owned; they are intentionally off the local hook path. Use `pnpm ci:rust` locally when touching Rust and `pnpm ci:local:full` when you want the heavier pre-flight suite without spending PR CI minutes.

If branch protection requires CI checks, keep it aligned with the current `pr-ci.yml` job names rather than the removed monolithic `CI` workflow.

### Required follow-through for new desktop-only flows

When you add or change a desktop-only user flow:

1. Choose the intended coverage layer before adding tests.
2. Document any coverage claim honestly in the PR description or related task notes.
3. Record runtime truthfully (`mocked-renderer` vs `native-tauri`) and whether the lane is CI-gated.
4. If no test is added yet, say that plainly instead of claiming coverage.
5. Keep `green CI` honest: do not rely on mocked Chromium to claim native runtime validation.

For public release prep, use the root `docs/RELEASE_CHECKLIST.md`.

### Project Structure

```
src/
├── api/client/       # Desktop-specific QBittorrentClient using Tauri HTTP
├── components/       # Reusable UI components
├── connection/       # Tauri store and QB client provider
├── platform/         # Platform-specific utilities (including tauriClient.ts)
├── routes/           # Application routes/screens
└── hooks/            # Custom React hooks

src-tauri/
├── Cargo.toml        # Rust dependencies (includes http plugin)
├── src/lib.rs        # Registers Tauri plugins
├── src-tauri.conf.json # Tauri configuration
└── capabilities/     # Permissions and capability definitions
```

### Key Files

- `src-tauri/Cargo.toml` - Added `tauri-plugin-http = "2"` dependency
- `src-tauri/src/lib.rs` - Registers HTTP plugin: `.plugin(tauri_plugin_http::init())`
- `src-tauri/capabilities/default.json` - HTTP permissions for fetch operations
- `src/platform/tauriClient.ts` - Native HTTP client using Tauri's fetch API

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
