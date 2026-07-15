# Taurent — Agent Guide

Taurent is a pnpm/Rust monorepo for Tauri-based qBittorrent clients. Keep future work aligned with the existing codemaps and strict frontend/native boundaries.

## Required read order

1. Read `codemap.md` in the repo root before any task.
2. Read the narrow codemap for the area you will touch:
   - Apps: `apps/codemap.md`, then `apps/desktop/codemap.md` or `apps/mobile/codemap.md`.
   - Shared TS packages: `packages/codemap.md`, then the relevant `packages/*/codemap.md`.
   - Rust/native work: `crates/codemap.md`, then `crates/qb-core/codemap.md`, `crates/qb-tauri/codemap.md`, or the relevant `apps/*/src-tauri/codemap.md`.
3. Then read this file for repo-wide rules and command reminders.

## Toolchain and workspace facts

- Node floor: `>=24.0.0`; CI uses Node `24`.
- Package manager: pnpm `>=11.0.0`; root `packageManager` is `pnpm@11.0.0`.
- JS workspace packages live in `apps/*` and `packages/*`.
- Rust workspace members are `crates/qb-core`, `crates/qb-tauri`, `apps/desktop/src-tauri`, and `apps/mobile/src-tauri`.
- The stack is React 19, Vite 8, Tailwind CSS 4, Tauri 2, Vitest, Playwright, and WebdriverIO for native desktop E2E.

## Package names for `pnpm --filter`

- Desktop app: `taurent`
- Mobile app: `taurent-mobile`
- Shared packages: `@taurent/shared`, `@taurent/bridge`, `@taurent/web-core`, `@taurent/web-ui`

## Commands agents are likely to guess wrong

- Prefer `pnpm desktop:dev`. `pnpm desktop` only starts plain Vite in a browser and skips the native Tauri runtime.
- `pnpm desktop:build` runs the desktop frontend build (`pnpm --filter taurent build`), not a native Tauri bundle. For a native desktop bundle use `pnpm --filter taurent tauri:build`.
- Server capabilities are sourced from `crates/qb-core/capabilities/qbittorrent-capabilities.toml`. Generated Rust/TypeScript outputs are gitignored; when changing capability flags or version thresholds, edit that TOML first, then run `pnpm codegen:capabilities`. Common pnpm dev/build/test/CI scripts run codegen before they need those files.
- Mobile dev commands are long-lived watch processes: `pnpm mobile:dev`, `pnpm mobile:dev:ios`, `pnpm mobile:dev:android`. Use bounded timeouts when verifying.
- `pnpm mobile:smoke` is `tauri dev` for the mobile app, so it is also long-lived.
- Root `pnpm test:unit` covers `@taurent/shared`, `@taurent/bridge`, `@taurent/web-core`, and `taurent`; it does not include `taurent-mobile`.
- Root `pnpm desktop:ci` includes lint, typecheck, both app frontend builds, unit tests, and desktop renderer E2E. It still does not run native Tauri E2E.

## Focused verification

- Whole JS workspace: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`
- Local CI smoke: `pnpm ci:local`
- Full local CI path: `pnpm ci:local:full`
- Single package/app: `pnpm --filter <name> lint`, `pnpm --filter <name> typecheck`, `pnpm --filter <name> build`
- Desktop tests:
  - `pnpm desktop:test` -> Vitest
  - `pnpm desktop:test:browser` -> Vitest browser mode
  - `pnpm desktop:renderer:e2e` -> Playwright against mocked desktop renderer runtime
  - `pnpm desktop:tauri:e2e` -> native Tauri E2E runner
- Mobile tests:
  - `pnpm mobile:test` -> Vitest
  - `pnpm mobile:renderer:e2e` -> Playwright renderer E2E
- If you touch Rust, mirror CI with:
  - `cargo fmt --all --check`
  - `cargo check --workspace --locked -p qb-core`
  - `cargo check --workspace --locked --features desktop -p qb-tauri`
  - `cargo clippy --workspace --all-targets --locked -p qb-core`
  - `cargo clippy --workspace --all-targets --locked --features desktop -p qb-tauri`

## Architecture that changes where code belongs

- Layering is strict: `apps/*` -> `@taurent/web-core` + `@taurent/web-ui` -> `@taurent/bridge` -> Rust crates.
- Default new shared logic to `packages/shared`, `packages/web-core`, or `packages/web-ui`; keep `apps/*` thin and platform-specific.
- `packages/shared` owns canonical domain types, schemas, utilities, theme tokens, icon primitives, and small stores.
- `packages/web-core` owns session lifecycle, QueryClient factory/scoping, shared hooks, screen controllers, feature capability probing, and invalidation.
- `packages/web-ui` owns reusable UI primitives, domain components, dialogs, layout components, and screen bodies. Keep it presentational.
- `packages/bridge` owns frontend/native contracts, transport, adapters, logging, and the Tauri API dependency point.
- Rust owns qBittorrent HTTP/auth/session behavior, DTO validation/normalization, synchronization, persistence, filesystem/network/native-platform behavior, and Tauri command implementations when that logic is not purely UI.
- TypeScript/React owns rendering, visual state, route composition, interactions, and presentation view models.

## Frontend boundaries

- `packages/shared`, `packages/web-core`, and `packages/web-ui` must never import `@tauri-apps/*`.
- Route native work through `@taurent/bridge` contracts/adapters or app-specific platform glue.
- `packages/web-core` should stay headless: no UI rendering and no concrete platform imports.
- `packages/web-ui` should not own data fetching, routing, session lifecycle, or platform behavior.
- Apps create a single React Query client at the app shell level; do not introduce extra `QueryClient` instances.
- Both apps initialize `setupTauriLogging()` before importing/rendering `App`; preserve that bootstrap order.
- Renderer/backend version coupling is allowed: the React renderer ships with the Rust backend. Do not add backward-compatible IPC guards, fallback paths, or migration logic for older renderers unless explicitly requested.

## Tauri-native workflow

- Load/read the `tauri-v2` skill before any task that touches `src-tauri`, `tauri.conf.json`, capabilities, permissions, plugins, `@tauri-apps/*`, `invoke`, events, channels, updater, sidecars, tray/window APIs, or frontend <-> Rust IPC.
- For Tauri-heavy work, also read the relevant codemap first: `apps/desktop/src-tauri/codemap.md`, `apps/mobile/src-tauri/codemap.md`, `crates/qb-tauri/codemap.md`, or `packages/bridge/codemap.md`.
- Keep app-side Tauri crates thin and platform-specific; prefer shared native/domain logic in `crates/qb-tauri` or `crates/qb-core`.
- Keep `src-tauri/src/main.rs` as a thin passthrough; application bootstrap and builder setup belong in `src-tauri/src/lib.rs`.
- Register every Tauri command in `tauri::generate_handler![...]`; if the frontend invokes it, it must be wired there.
- Add or update capability permissions before using core APIs or plugins; Tauri v2 denies by default.
- Tauri plugin dependencies must be declared directly in each app crate's `Cargo.toml`, even if transitively available through `qb-tauri`. Tauri v2's build script resolves capability permissions such as `dialog:allow-open` and `fs:allow-read` from direct dependencies only.
- Use Tauri v2 APIs only. Prefer owned types in async commands, return `Result<T, E>` for fallible commands, and avoid blocking the main thread.
- Preserve the bridge boundary: shared frontend packages stay free of `@tauri-apps/*`, and renderer code should reach native behavior through `@taurent/bridge` contracts/adapters.

## Desktop-specific invariants

- Desktop renderer code must not create its own qBittorrent client/session lifecycle. Reuse session state through `BridgeAdapter.getSessionSnapshot()` and session events.
- Auxiliary desktop dialogs/windows are route-driven and live under `apps/desktop/src/windows/*`, wired in `apps/desktop/src/App.tsx` and rendered via `AuxWindowLayout` or `DialogWindowLayout`.
- Do not add new desktop-only in-tree overlay modals for create/edit/rename/delete flows.
- Desktop Playwright runs with `VITE_AUTOMATION=1` and Vite aliases that mock the desktop bridge and Tauri APIs. It does not exercise a real Tauri backend.
- Desktop Playwright is configured with `fullyParallel: false`; do not assume tests are parallel-safe.

## Mobile-specific invariants

- Mobile is a Tauri mobile renderer with route-driven screens and a bottom-tab authenticated shell.
- Mobile Vite dev server is fixed to port `1420` with `strictPort: true`; HMR host depends on `TAURI_DEV_HOST` / `TAURI_ENV_PLATFORM`.
- Mobile renderer E2E uses Playwright browser automation; native mobile dev/smoke commands are long-lived Tauri processes.

## Repo-specific lint/style rules

- No fractional Tailwind spacing utilities such as `p-2.5`, `gap-1.5`, or `px-3.5`; use the 4px base spacing scale.
- No literal Tailwind color classes such as `text-white`, `bg-black`, `text-slate-*`, `bg-gray-*`, or `text-amber-*`; use semantic tokens from `packages/shared/src/theme`.
- `console.log` is warned; `console.warn`, `console.error`, and `console.info` are allowed.
- `debugger` is an error.
- `prefer-const`, `no-var`, and strict equality are enforced.

## Icon sizes

`packages/shared/src/icons/sizes.ts` exports the canonical icon scale:

```ts
export const ICON_SIZES = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;
export type IconSize = keyof typeof ICON_SIZES;
```

The `Icon` component accepts `iconSize?: IconSize`. Direct Lucide usage should reference `ICON_SIZES` constants rather than magic numbers.


## Repository map

The full repository map is `codemap.md` in the project root. Use it to understand architecture, entry points, directory responsibilities, and data flow before making changes. For deep work, read the nearest folder-level `codemap.md` as well.
