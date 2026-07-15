# scripts/ci/

## Responsibility

CI validation scripts covering two concerns: version consistency across workspace manifests, and combined coverage reporting across packages.

## Design

Three independent entrypoints: `check-versions.mjs` (Node), `runs-coverage.sh` (shell), and `write-pr-ci-summary.mjs` (Node). They share no library, run in isolation, and exit non-zero on failure so CI fails the build.

- `write-pr-ci-summary.mjs`: Writes compact Markdown job summaries to `GITHUB_STEP_SUMMARY` for the JavaScript and Rust quality jobs in `pr-ci.yml`.

## Flow

The version check reads multiple manifests in sequence and fails on the first mismatch. The coverage script runs several pnpm coverage lanes in series, captures each exit code, and re-emits a single aggregate failure status at the end.

## Integration

References the desktop manifest / config files for version checks. Runs package-filtered coverage for `@taurent/shared`, `@taurent/web-core`, and `taurent` (the desktop app).
