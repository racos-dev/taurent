# apps/desktop/scripts/perf/

## Responsibility

Production bundle analysis, baseline management, regression detection, and hard guardrails for desktop build size and chunk metrics.

## Design

Shared metrics library in `common.ts` is reused by separate entrypoints for checking, comparing, and writing results. This keeps measurement code in one place and lets each command stay focused on its job (current build, baseline diff, baseline update).

## Flow

Reads built assets, computes gzip / chunk metrics, loads the stored baseline, writes `compare` and `current` JSON artifacts, and exits non-zero when a hard guardrail (budget or regression) fails.

## Integration

Consumes `apps/desktop/dist/assets` and the canonical `artifacts/desktop/bundle/stats.json`. Writes artifacts under `artifacts/desktop/perf/*` and the budget file `perf/desktop-budgets.json`.
