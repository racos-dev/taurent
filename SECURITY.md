# Security Policy

Taurent is a beta application that connects to user-configured qBittorrent Web UI servers. Please report security issues privately instead of opening a public issue.

## Supported Versions

Security fixes target the latest beta release and the `main` branch.

| Version | Supported |
| --- | --- |
| `0.9.x-beta` | Yes |
| Older beta builds | No |

## Reporting A Vulnerability

If you find a vulnerability, please contact the maintainer privately.

Include as much of this as you can:

- Taurent version or commit SHA.
- Operating system and version.
- qBittorrent version.
- Whether the issue affects desktop, mobile, or both.
- Steps to reproduce.
- Impact: credential exposure, arbitrary file access, network request abuse, privilege escalation, denial of service, or another category.
- Any proof-of-concept code or screenshots that help reproduce the issue.

Please do not include real qBittorrent credentials, private tracker URLs, cookies, or tokens in reports.

## Scope

In scope:

- Credential storage and accidental credential exposure.
- Unsafe Tauri permissions or IPC behavior.
- Unauthorized local file opening or path handling.
- Unexpected network requests.
- qBittorrent session/cookie handling.
- Build or release artifact integrity problems.

Out of scope:

- Vulnerabilities in qBittorrent itself.
- Issues caused by exposing qBittorrent Web UI to an untrusted network.
- Social engineering.
- Denial-of-service issues that require local machine access and do not expose data.
- Reports based only on unsigned beta builds warning users during install.

## Security Model

Taurent runs locally and connects to qBittorrent servers you configure. It does not intentionally collect telemetry.

Credential handling:

- Server metadata is stored locally.
- Saved passwords use platform secure storage when available.
- Passwords are not intentionally serialized to frontend-safe server summaries.
- If secure storage is unavailable, Taurent may keep credentials only in memory for the current session and warn the user.

Native permissions:

- Taurent needs HTTP/HTTPS access to arbitrary hosts and ports because qBittorrent Web UI instances are self-hosted.
- Desktop builds include file-opening/reveal permissions so users can open or reveal downloaded content paths from qBittorrent.
- Tauri capabilities are reviewed as part of release readiness and should stay as narrow as practical for the feature set.

## Disclosure

The project aims to acknowledge credible reports within 7 days and provide a fix or mitigation plan as soon as practical. Public disclosure should wait until a fix is available or until a coordinated disclosure date is agreed.
