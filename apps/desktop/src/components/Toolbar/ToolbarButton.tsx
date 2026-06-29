import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { getColor } from '@taurent/shared/theme/helpers';
import { cn, ICON_SIZES } from '@taurent/shared';
import { Tooltip, useTooltip } from '@taurent/web-ui';

interface ToolbarButtonProps {
  icon: LucideIcon;
  tooltip: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  ariaLabel?: string;
  dataTestId?: string;
}

function getTooltipLabel(tooltip: string, shortcut?: string): string {
  return shortcut ? `${tooltip} (${shortcut})` : tooltip;
}

export function ToolbarButton({
  icon: Icon,
  tooltip,
  shortcut,
  onClick,
  disabled = false,
  variant = 'default',
  ariaLabel,
  dataTestId,
}: ToolbarButtonProps) {
  const tooltipLabel = getTooltipLabel(tooltip, shortcut);
  const { anchorRef, tooltipProps, handlers } = useTooltip({ dismissOnBlur: true });

  const iconStyle: CSSProperties = {
    color: getColor(disabled ? 'text-muted' : variant === 'primary' ? 'text-on-primary' : 'text-secondary'),
  };

  return (
    <div
      ref={anchorRef}
      className="group relative inline-flex"
      {...handlers}
    >
      <button
        type="button"
        aria-label={ariaLabel ?? tooltipLabel}
        data-testid={dataTestId}
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-sm p-1',
          'outline-none focus-visible:ring-1 focus-visible:ring-border-focus',
          variant === 'primary'
            ? 'bg-primary text-text-on-primary enabled:hover:bg-primary-hover disabled:bg-bg-disabled disabled:text-text-disabled disabled:border-border-disabled'
            : 'enabled:hover:bg-surface-interactive enabled:active:bg-surface-elevated disabled:text-text-disabled'
        )}
      >
        <Icon aria-hidden="true" size={ICON_SIZES.md} style={iconStyle} />
      </button>

      <Tooltip anchorRef={tooltipProps.anchorRef} visible={tooltipProps.visible} shortcut={shortcut}>
        {tooltip}
      </Tooltip>
    </div>
  );
}