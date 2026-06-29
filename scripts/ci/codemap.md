# scripts/ci/

## Responsibility

CI validation scripts covering two concerns: version consistency across workspace manifests, and combined coverage reporting across packages.

## Design

Two independent entrypoints: `check-versions.mjs` (Node) and `runs-coverage.sh` (shell). They share no library, run in isolation, and exit non-zero on failure so CI fails the build.

## Flow

The version check reads multiple manifests in sequence and fails on the first mismatch. The coverage script runs several pnpm coverage lanes in series, captures each exit code, and re-emits a single aggregate failure status at the end.

## Integration

References the desktop manifest / config files for version checks. Runs package-filtered coverage for `@taurent/shared`, `@taurent/web-core`, and `taurent` (the desktop app).
