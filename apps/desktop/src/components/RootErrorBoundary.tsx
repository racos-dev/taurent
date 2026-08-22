import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from '@taurent/shared';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTaurentTranslation } from '@taurent/shared/i18n';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
}

function RootErrorFallback({ onReload, onClose }: { onReload: () => void; onClose: () => void }) {
  const { t } = useTaurentTranslation('errors');

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-text-primary">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 shrink-0 text-error" />
        <h1 className="text-lg font-semibold">{t('renderer.title')}</h1>
        <p className="max-w-xs text-sm text-text-secondary">{t('renderer.message')}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReload}
          className="flex items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:bg-surface-interactive transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t('renderer.reload')}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2 text-sm text-text-primary hover:bg-surface-interactive transition-colors"
        >
          <X className="h-4 w-4" />
          {t('renderer.close')}
        </button>
      </div>
    </div>
  );
}

/**
 * Root-level React error boundary that catches renderer failures
 * at the top of the component tree, showing a recovery UI instead
 * of a blank window.
 *
 * Desktop-only — uses Tauri's `getCurrentWindow` API directly.
 */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  #handleReload = () => {
    window.location.reload();
  };

  #handleClose = () => {
    void getCurrentWindow()
      .close()
      .catch((err: unknown) => console.error('[RootErrorBoundary] close failed:', err));
  };

  override render() {
    if (this.state.hasError) {
      return <RootErrorFallback onReload={this.#handleReload} onClose={this.#handleClose} />;
    }

    return this.props.children;
  }
}
