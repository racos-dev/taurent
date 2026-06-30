# Taurent

**A native, open-source remote client for qBittorrent.**

Taurent is a desktop and mobile qBittorrent remote client built with Tauri, React, and Rust. It connects to an existing qBittorrent Web UI server and gives you a native-feeling app for managing transfers, search, RSS, server profiles, and common qBittorrent settings.

> **Beta:** Taurent is ready for early testers, but it is not a stable 1.0 release yet. Expect rough edges, unsigned builds, and behavior changes between beta releases.

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/b3f4c17a-e746-4e1e-b83d-0bd2c7a247de"
    alt="Taurent desktop overview"
    width="900"
  />
</p>

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/10a4027f-c064-406d-90b4-23f07a37e419"
    alt="Taurent mobile torrent list"
    width="260"
  />
  <img
    src="https://github.com/user-attachments/assets/8349c43b-84a0-4e02-ac17-115095f14921"
    alt="Taurent mobile torrent details"
    width="260"
  />
  <img
    src="https://github.com/user-attachments/assets/155b1a64-a986-44b4-8165-44145a4935b0"
    alt="Taurent mobile settings"
    width="260"
  />
</p>


## Why Taurent?

qBittorrent’s Web UI is powerful, but it still lives in a browser tab. Taurent is for people who already run qBittorrent on a server, NAS, seedbox, or home machine and want a dedicated app for day-to-day torrent management across desktop and mobile.

Taurent is:

* **Remote-first** — connect to qBittorrent through its Web UI API.
* **Native-feeling** — desktop integrations, tray support, file associations, notifications, and utility windows.
* **Mobile-friendly** — a touch-focused interface for managing qBittorrent from your phone.
* **Multi-server friendly** — save and switch between multiple qBittorrent profiles.
* **Privacy-conscious** — no intentional telemetry; your configured servers and credentials stay local.
* **FOSS** — open source, MIT licensed, and built in public.

Taurent is **not** a standalone BitTorrent client. You still need qBittorrent running somewhere with the Web UI enabled.

## Download

Get the latest beta from the [GitHub Releases](../../releases) page.

Current beta notes:

* Linux, macOS, and Windows builds are produced by GitHub Actions.
* Some packaged builds may be unsigned.
* macOS and Windows may show unsigned-app warnings.
* Android APKs are available as beta artifacts for testing.
* iOS support exists in the Tauri mobile workspace, but is not currently distributed through the App Store.

## Features

### Torrent management

* Add torrents and magnet links.
* Pause, resume, delete, rename, recheck, and reannounce torrents.
* Move torrents and adjust per-torrent limits.
* Inspect torrent details, files, trackers, peers, and properties.

### Organization

* Filter by status, category, tag, and tracker.
* Manage categories and tags.
* Configure common qBittorrent preferences.
* Adjust transfer limits, queueing, privacy, and related settings.

### Themes

* Switch between multiple built-in themes.
* Included themes: Solarized, Catppuccin, Gruvbox, Midnight, Nord, Dracula, Tokyo Night, Monokai, and One Dark.
* Pick a look that fits your desktop, terminal, or mobile setup.

### Search and RSS

* Use qBittorrent search when the connected server supports it.
* Manage RSS features when available on the connected server.

### Server profiles

* Save multiple qBittorrent Web UI connections.
* Store credentials with platform secure storage when available.
* Fall back safely when secure storage is unavailable.

### Desktop integrations

* Tray menu.
* `.torrent` file association.
* Native notifications.
* Multiple utility windows.
* Local path mapping.
* Open or reveal torrent content paths from the UI.

### Mobile app

Taurent includes a polished, touch-focused mobile interface designed for managing qBittorrent from a phone or tablet. The mobile app shares the same core qBittorrent integration as the desktop app while adapting the experience for smaller screens and touch navigation.

Android builds are available for beta testing. iOS support exists in the codebase, but public iOS distribution is not available yet.

## Requirements

To use Taurent, you need:

* qBittorrent with the Web UI enabled.
* Network access from your device to the qBittorrent Web UI URL.
* A qBittorrent username and password.

To build Taurent from source, you need:

* Node.js `>=24.0.0`
* pnpm `>=11.0.0`
* Rust `1.90.0`
* Platform dependencies required by Tauri 2

## Getting started

1. Enable the Web UI in qBittorrent.
2. Make sure the device running Taurent can reach your qBittorrent Web UI URL.
3. Download Taurent from [Releases](../../releases), or build it from source.
4. Add a server profile in Taurent using your qBittorrent Web UI URL, username, and password.
5. Start managing your torrents from Taurent.

## Build from source

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

## Development checks

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

Native desktop smoke test:

```bash
pnpm desktop:tauri:e2e
```

## Repository layout

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

## Privacy and security

Taurent connects directly to the qBittorrent Web UI servers that you configure. It does not intentionally collect telemetry.

Important details:

* Server metadata is stored locally.
* Saved passwords use platform secure storage when available.
* If secure storage is unavailable, Taurent may keep credentials only for the current session and warn you.
* Taurent needs broad HTTP access because users connect to self-hosted qBittorrent instances on arbitrary hosts and ports.
* Desktop file-opening permissions exist so torrent content paths can be opened or revealed from the UI.

Please report security issues privately according to the project’s security policy.

## Contributing

Bug reports, platform testing, documentation fixes, and focused pull requests are welcome.

Good first contributions:

* Test a beta build on your operating system and report install/runtime issues.
* Improve platform-specific installation docs.
* Add screenshots or short demo clips.
* File focused bugs with your qBittorrent version, OS, Taurent version, and reproduction steps.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Name and affiliation

Taurent is not affiliated with qBittorrent. qBittorrent is a separate open-source project.

## License

MIT. See [LICENSE](LICENSE).
