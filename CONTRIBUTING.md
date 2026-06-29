# Contributing To Taurent

Thanks for helping test and improve Taurent. This project is in beta, so the most valuable contributions are focused bug reports, platform testing, docs fixes, and small pull requests with clear verification.

## Before You Start

Read:

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [codemap.md](codemap.md)

The codemaps explain where code belongs. Taurent has strict frontend/native boundaries, and pull requests should preserve them.

## Development Setup

Requirements:

- Node.js `>=24.0.0`
- pnpm `>=11.0.0`
- Rust `1.90.0`
- Tauri 2 platform dependencies for your OS

Install dependencies:

```bash
pnpm install
```

Run desktop development mode:

```bash
pnpm desktop:dev
```

Do not use `pnpm desktop` for normal app development. It starts plain Vite in a browser and skips the native Tauri runtime.

## Common Commands

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm ci:rust
pnpm ci:local:full
```

Desktop-specific:

```bash
pnpm desktop:test
pnpm desktop:renderer:e2e
pnpm desktop:tauri:e2e
```

Mobile-specific:

```bash
pnpm mobile:test
pnpm mobile:renderer:e2e
```

## Pull Request Guidelines

Keep PRs small and focused.

For each PR:

- Explain the user-facing problem or technical reason.
- Describe the change.
- List the commands you ran.
- Include screenshots or clips for visible UI changes.
- Call out any platform you could not test.

Avoid:

- Large unrelated refactors.
- Moving code across package boundaries without a clear reason.
- Adding new Tauri permissions without explaining the feature that needs them.
- Adding extra `QueryClient` instances in app renderers.
- Importing `@tauri-apps/*` outside the allowed bridge/app-specific boundaries.

## Architecture Boundaries

Default ownership:

- `apps/*`: platform app shells, routing, platform-specific glue.
- `packages/shared`: domain types, schemas, utilities, theme tokens, icons, small stores.
- `packages/web-core`: session lifecycle, query orchestration, hooks, screen controllers.
- `packages/web-ui`: presentational components, dialogs, layouts, screen bodies.
- `packages/bridge`: frontend/native contracts, transport, Tauri adapters.
- `crates/qb-core`: qBittorrent HTTP/auth/session/domain behavior.
- `crates/qb-tauri`: Tauri commands, state, eventing, sync, native integration.

Shared packages must not import `@tauri-apps/*`. Route native work through `packages/bridge` or app-specific platform glue.

## Style

- Use the existing TypeScript, React, Rust, and Tailwind patterns.
- Use semantic theme tokens instead of literal Tailwind color classes.
- Use the 4px spacing scale. Avoid fractional Tailwind spacing such as `p-2.5`.
- Prefer `ICON_SIZES` constants instead of magic icon sizes.
- Keep comments rare and useful.

## Reporting Bugs

Use the bug report issue template and include:

- Taurent version or commit SHA.
- OS and architecture.
- qBittorrent version.
- Whether you used a release artifact or built from source.
- Steps to reproduce.
- Expected and actual behavior.
- Logs/screenshots when useful.

Do not include real credentials, cookies, private tracker URLs, or sensitive file paths.

## Security Issues

Do not open public issues for vulnerabilities. Follow [SECURITY.md](SECURITY.md).
