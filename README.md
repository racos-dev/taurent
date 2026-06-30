# Taurent

Taurent is a beta qBittorrent remote client built with Tauri, React, and Rust.

It is designed for people who already run qBittorrent with the Web UI enabled and want a native-feeling desktop or mobile client for managing transfers, search, RSS, server profiles, and common qBittorrent settings.

<img width="1080" height="515" alt="image" src="https://github.com/user-attachments/assets/7a4aca06-f750-4ccd-8d89-8123de7e2631" />
> Beta status: Taurent is usable enough for early testers, but it is not a stable 1.0 release. Expect rough edges, unsigned builds, incomplete mobile distribution, and occasional behavior changes between beta releases.

## Features

- Connect to a remote qBittorrent Web UI server.
- Manage torrents: add, pause, resume, delete, rename, recheck, reannounce, move, and adjust limits.
- Browse live transfer state with status, category, tag, and tracker filters.
- Inspect torrent details, trackers, peers, files, and general properties.
- Manage categories, tags, transfer limits, queueing, privacy, and other qBittorrent preferences.
- Use qBittorrent search and RSS features when the connected server supports them.
- Save multiple server profiles with credentials stored through platform secure storage when available.
- Desktop native integrations: tray menu, torrent file association, multiple utility windows, notifications, and local path mapping.
- Mobile renderer with touch-focused screens for Android/iOS-oriented Tauri mobile builds.

## Project Status

Recommended version is latest from: https://github.com/racos-dev/taurent/releases

Taurent is currently best described as a public beta:

- Desktop is the primary target.
- Linux, macOS, and Windows builds are produced by GitHub Actions.
- Android APKs are built as unsigned beta artifacts.
- iOS is present in the Tauri mobile workspace but is not a public distribution target yet.
- Packaged builds may be unsigned unless release notes say otherwise.

## Requirements

To use Taurent, you need:

- qBittorrent with Web UI enabled.
- Network access from the device running Taurent to your qBittorrent Web UI URL.
- A qBittorrent username and password.

To build from source, you need:

- Node.js `>=24.0.0`
- pnpm `>=11.0.0`
- Rust `1.90.0`
- Platform dependencies required by Tauri 2

## Install

For beta builds, use the latest GitHub Release once release artifacts are published.

Current beta caveats:

- macOS and Windows builds may show unsigned-app warnings.
- Android APKs are unsigned and intended for testing.
- If an artifact is not available for your platform, build from source.

## Build From Source

Install dependencies:

```bash
pnpm install
```

Run the desktop app in Tauri development mode:

```bash
pnpm desktop:dev
```

Build the desktop frontend only:

```bash
pnpm desktop:build
```

Build a native desktop bundle:

```bash
pnpm --filter taurent tauri:build
```

Run the mobile renderer in development mode:

```bash
pnpm mobile:dev
```

Mobile native commands are long-lived Tauri processes. Prefer bounded runs when using them for verification.

## Verification

Common checks:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm ci:rust
```

Broader local check:

```bash
pnpm ci:local:full
```

Desktop renderer E2E:

```bash
pnpm desktop:renderer:e2e
```

Native desktop smoke:

```bash
pnpm desktop:tauri:e2e
```

## Repository Layout

```text
apps/desktop          Tauri desktop app shell
apps/mobile           Tauri mobile app shell
packages/shared       Shared types, schemas, utilities, theme tokens, icons
packages/bridge       Frontend/native bridge contracts and Tauri adapters
packages/web-core     Shared hooks, sessions, query orchestration, screen controllers
packages/web-ui       Reusable UI primitives, dialogs, layouts, screen bodies
crates/qb-core        Rust qBittorrent HTTP/session/domain layer
crates/qb-tauri       Rust Tauri commands, state, sync, and platform glue
```

The app boundaries are intentionally strict: app shells stay thin, shared UI stays presentational, `packages/bridge` is the frontend/native boundary, and Rust owns qBittorrent HTTP/session behavior.

## Security And Privacy

Taurent connects directly to qBittorrent Web UI servers that you configure. It does not intentionally collect telemetry.

Important details:

- Server metadata is stored locally.
- Saved passwords use platform secure storage when available.
- If secure storage is unavailable, Taurent may keep credentials only for the current session and warn you.
- Taurent needs broad HTTP access because users connect to self-hosted qBittorrent instances on arbitrary hosts and ports.
- Desktop file-opening permissions exist so torrent content paths can be opened or revealed from the UI.


## Contributing

Bug reports, platform testing, docs fixes, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

Good first contributions:

- Test a beta artifact on your OS and report install/runtime issues.
- Improve installation docs for a platform you use.
- Add screenshots or short demo clips.
- File focused bugs with qBittorrent version, OS, Taurent version, and reproduction steps.

## Roadmap

Near-term beta priorities:

- Public release polish: screenshots, signed/notarized builds where possible, clearer install docs.
- More real-world platform testing.
- Better mobile packaging story.
- Tighter docs around supported qBittorrent versions and feature availability.
- Continued hardening of native permissions and release automation.

## Name And Affiliation

Taurent is not affiliated with qBittorrent. qBittorrent is a separate open-source project.

## License

MIT. See [LICENSE](LICENSE).
