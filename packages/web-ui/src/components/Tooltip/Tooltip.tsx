import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_PADDING = 8;
const TOOLTIP_OFFSET = 8;

interface TooltipProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
  children: ReactNode;
  shortcut?: string;
}

export function Tooltip({
  anchorRef,
  visible,
  children,
  shortcut,
}: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!anchorRef.current || !tooltipRef.current) {
        return;
      }

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      const idealLeft = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
      const left = Math.min(
        Math.max(VIEWPORT_PADDING, idealLeft),
        window.innerWidth - tooltipRect.width - VIEWPORT_PADDING
      );

      const idealTop = anchorRect.bottom + TOOLTIP_OFFSET;
      const top = Math.min(
        Math.max(VIEWPORT_PADDING, idealTop),
        window.innerHeight - tooltipRect.height - VIEWPORT_PADDING
      );

      setPosition({ left, top });
    };

    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(anchorRef.current);
    resizeObserver.observe(tooltipRef.current);
    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, children, shortcut, visible]);

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      className="fixed z-40 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-text-primary shadow-sm pointer-events-none"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
    >
      <span>{children}</span>
      {shortcut ? (
        <span className="ml-2 font-mono text-text-secondary">
          {shortcut}
        </span>
      ) : null}
    </div>,
    document.body
  );
}