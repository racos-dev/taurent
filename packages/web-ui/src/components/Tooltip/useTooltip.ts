import { useEffect, useRef, useState } from 'react';

export function useTooltip(options?: { dismissOnBlur?: boolean }): {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  tooltipProps: {
    anchorRef: React.RefObject<HTMLElement | null>;
    visible: boolean;
    shortcut?: string;
  };
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
} {
  const { dismissOnBlur = false } = options ?? {};
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Dismiss tooltip when window loses focus or page becomes hidden
  // (e.g., clicking a button that opens a Tauri auxiliary window)
  useEffect(() => {
    if (!dismissOnBlur) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsHovered(false);
        setIsFocused(false);
      }
    };
    const handleWindowBlur = () => {
      setIsHovered(false);
      setIsFocused(false);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [dismissOnBlur]);

  const visible = isHovered || isFocused;

  return {
    anchorRef,
    tooltipProps: {
      anchorRef,
      visible,
    },
    handlers: {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    },
  };
}