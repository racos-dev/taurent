import React from 'react';

import { appBuildMetadata } from '../../buildMetadata';

export const DesktopAboutSettings = React.memo(() => {
  return (
    <div className="rounded-sm border border-border bg-surface p-3">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-primary/10">
          <span className="text-lg font-bold text-primary">Q</span>
        </div>
        <h2 className="text-sm font-semibold text-text-primary">Taurent</h2>
        <p className="mt-1 text-xs text-text-secondary">Version {appBuildMetadata.version}</p>
        {appBuildMetadata.diagnostics.length > 0 ? (
          <p className="mt-1 text-xs text-text-muted">{appBuildMetadata.diagnostics.join(' · ')}</p>
        ) : null}
        <p className="mt-2 text-xs text-text-muted">
          Built by racos.dev
        </p>
        <a
          href="https://github.com/racos-dev/taurent"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
});

DesktopAboutSettings.displayName = 'DesktopAboutSettings';
