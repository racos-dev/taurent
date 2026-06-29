#!/bin/bash
# runs-coverage.sh — run coverage for all in-scope packages, attempt every lane,
# aggregate exit codes so CI knows if anything failed but every artifact is produced.
set +e

shared_code=0
webcore_code=0
desktop_unit_code=0

echo "==> shared coverage"
pnpm --filter @taurent/shared test:coverage
shared_code=$?

echo "==> web-core coverage"
pnpm --filter @taurent/web-core test:coverage
webcore_code=$?

echo "==> desktop unit coverage"
pnpm --filter taurent test:coverage
desktop_unit_code=$?

echo ""
echo "Coverage lane results: shared=$shared_code web-core=$webcore_code desktop-unit=$desktop_unit_code"

# Exit non-zero if any lane failed
if [ $shared_code -ne 0 ] || [ $webcore_code -ne 0 ] || [ $desktop_unit_code -ne 0 ]; then
  echo "One or more coverage lanes failed."
  exit 1
fi
exit 0
