import { useId } from 'react';

interface OverlayPromptProps {
  icon: React.ReactNode;
  iconContainerClassName?: string;
  title: string;
  description: string;
  error?: string | null;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Reusable blocking overlay prompt component.
 * Follows the ConnectedServerUnavailableOverlay visual pattern.
 */
export function OverlayPrompt({
  icon,
  iconContainerClassName = 'bg-warning/10 text-warning',
  title,
  description,
  error,
  children,
  className,
}: OverlayPromptProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 backdrop-blur-sm p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={`w-full max-w-sm overflow-hidden rounded-sm border border-border bg-surface ${className ?? ''}`}
      >
        <div className="flex items-start gap-2 border-b border-border px-3 py-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm ${iconContainerClassName}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 role="heading" aria-level={2} className="text-sm font-medium text-text-primary">
              {title}
            </h2>
            <p id={descriptionId} className="mt-1 text-xs text-text-secondary whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-error px-3">
            {error}
          </p>
        )}

        {children && (
          <div className="px-3 py-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}