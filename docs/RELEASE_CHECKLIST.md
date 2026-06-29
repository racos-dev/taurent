# Release Checklist

Use this checklist for every public beta release.

Recommended first public beta: `0.9.0-beta.1`.

## Before Tagging

- [ ] Confirm the release scope and known limitations.
- [ ] Update app versions:

  ```bash
  pnpm version:app 0.9.0-beta.1
  ```

- [ ] Update `CHANGELOG.md`.
- [ ] Confirm `README.md` install/build instructions are still correct.
- [ ] Confirm `SECURITY.md` still describes current permissions and credential behavior.
- [ ] Add or refresh screenshots before posting publicly.
- [ ] Run local checks:

  ```bash
  pnpm ci:local:full
  ```

- [ ] If Rust/native code changed, run:

  ```bash
  pnpm ci:rust
  ```

- [ ] Check for unexpected tracked files:

  ```bash
  git status --short
  ```

## Tagging

Use signed tags if your local setup supports them.

```bash
git tag v0.9.0-beta.1
git push origin v0.9.0-beta.1
```

## GitHub Release

- [ ] Confirm release workflow completed.
- [ ] Confirm Linux, macOS, Windows, and Android artifacts are attached.
- [ ] Mark the release as pre-release.
- [ ] State clearly whether artifacts are signed.
- [ ] Include install warnings for unsigned macOS/Windows builds.
- [ ] Include Android unsigned APK warning.
- [ ] Include qBittorrent version used for smoke testing.
- [ ] Include checks that passed.

## Smoke Testing

For each available platform:

- [ ] App launches.
- [ ] User can add/connect to a qBittorrent server.
- [ ] Torrent list loads.
- [ ] Add magnet flow works against a test server or controlled environment.
- [ ] Pause/resume/delete actions behave correctly.
- [ ] Settings window/screen opens.
- [ ] App quits cleanly.

## Reddit Post Prep

- [ ] Include screenshots or a short demo clip.
- [ ] Call it a beta.
- [ ] Say which platforms need testers.
- [ ] Mention that qBittorrent Web UI is required.
- [ ] Mention unsigned build warnings honestly.
- [ ] Link to GitHub Releases, not only the repository root.
- [ ] Ask for specific feedback: install issues, connection issues, platform bugs, UX problems.
