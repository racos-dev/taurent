import React, { useEffect, useRef, useState } from 'react';
import { cn, X, ICON_SIZES, usePrefersReducedMotion } from '@taurent/shared';
import type { DialogProps } from './types';

type DialogPhase = 'open' | 'closing' | 'closed';

const maxWidthClasses: Record<NonNullable<DialogProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export const Dialog = React.memo<DialogProps>(({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md'
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<DialogPhase>(isOpen ? 'open' : 'closed');
  const [phase, setPhaseState] = useState<DialogPhase>(isOpen ? 'open' : 'closed');
  const animationEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimationEndHandlerActiveRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const setPhase = (next: DialogPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Clear animation fallback timer
  const clearAnimationTimer = () => {
    if (animationEndTimerRef.current !== null) {
      clearTimeout(animationEndTimerRef.current);
      animationEndTimerRef.current = null;
    }
  };

  // Handle animation end during closing phase
  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (
      e.target === dialogRef.current &&
      phaseRef.current === 'closing' &&
      isAnimationEndHandlerActiveRef.current
    ) {
      isAnimationEndHandlerActiveRef.current = false;
      clearAnimationTimer();
      setPhase('closed');
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      // Rapid toggle: if we're closing, go back to open and clear timers
      if (phaseRef.current === 'closing') {
        clearAnimationTimer();
        isAnimationEndHandlerActiveRef.current = false;
      }
      setPhase('open');
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else if (phaseRef.current === 'open') {
      if (prefersReducedMotion) {
        // Reduced-motion fast path: skip closing animation, unmount immediately
        document.body.style.overflow = '';
        setPhase('closed');
      } else {
        // Normal path: transition to closing with animation
        setPhase('closing');
        document.body.style.overflow = '';

        // Start animation end detection
        isAnimationEndHandlerActiveRef.current = true;

        // Fallback timer in case animationend doesn't fire
        animationEndTimerRef.current = setTimeout(() => {
          if (phaseRef.current === 'closing') {
            isAnimationEndHandlerActiveRef.current = false;
            setPhase('closed');
          }
        }, 300);
      }
    }

    return () => {
      clearAnimationTimer();
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, prefersReducedMotion]);

  if (phase === 'closed') return null;

  const dataState = phase === 'open' ? 'open' : 'closed';

  return (
    <div
      ref={dialogRef}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-backdrop/60 backdrop-blur-sm',
        !prefersReducedMotion && 'animate-in fade-in duration-200',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
      )}
      onClick={handleBackdropClick}
      onAnimationEnd={handleAnimationEnd}
      data-state={dataState}
    >
      <div
        className={cn(
          'w-full bg-surface rounded-sm border border-border max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col',
          !prefersReducedMotion && 'animate-in zoom-in-95 duration-200',
          'data-[state=closed]:animate-out data-[state=closed]:zoom-out-95',
          maxWidthClasses[maxWidth],
        )}
        role="dialog"
        aria-modal="true"
        data-state={dataState}
      >
        {(title || description) && (
          <div className="shrink-0 px-3 py-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {title && (
                  <h2 className="text-sm font-medium text-text-primary">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-xs text-text-secondary mt-1">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-interactive rounded-sm transition-colors"
              >
                <X size={ICON_SIZES.md} className="text-text-muted" />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-3 py-2">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex justify-end gap-2 border-t border-border px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

Dialog.displayName = 'Dialog';
