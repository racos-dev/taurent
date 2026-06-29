# scripts/

## Responsibility

Root automation entrypoint that delegates to CI scripts. The directory exists to give CI runners and task runners a stable location to invoke workspace-level checks from.

## Design

Flat wrapper directory. All real logic lives in `scripts/ci/`; this folder simply shells into those scripts from automation.

## Flow

No direct runtime logic beyond shelling into child scripts from CI or task runners.

## Integration

Consumed by CI runners. Child scripts inspect workspace manifests and run package-filtered coverage and version checks.
