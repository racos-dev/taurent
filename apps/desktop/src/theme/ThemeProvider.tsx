import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { emit } from '@tauri-apps/api/event';
import { createThemeChangedListener } from '@taurent/bridge/transport/tauri';
import type { ThemeChangedEvent } from '@taurent/bridge/events';
import { parseThemeId, resolveThemeClass } from '@taurent/shared/theme/resolver';
import type { AccentPreference } from '@taurent/shared/theme/types';
import {
  ThemeProvider as SharedThemeProvider,
  useTheme as useSharedTheme,
} from '@taurent/web-ui/theme';

function getThemeEventSignature(event: ThemeChangedEvent) {
  return JSON.stringify({
    themeClass: event.theme_class,
    mode: event.mode ?? null,
    systemPalette: event.system_palette ?? null,
    manualPalette: event.manual_palette ?? null,
    manualVariant: event.manual_variant ?? null,
    accent: event.accent ?? null,
  });
}

/**
 * Desktop ThemeProvider:
 * 1. Wraps the shared web-ui ThemeProvider (which reads/writes localStorage synchronously)
 * 2. Synchronizes theme changes across Tauri desktop windows via theme-changed events
 */
export function ThemeProvider({ children, defaultTheme = 'catppuccin' }: { children: ReactNode; defaultTheme?: string }) {
  return (
    <SharedThemeProvider defaultTheme={defaultTheme}>
      <DesktopThemeEventBridge />
      {children}
    </SharedThemeProvider>
  );
}

function DesktopThemeEventBridge() {
  const {
    config,
    effectivePalette,
    effectiveVariant,
    setMode,
    setSystemPalette,
    setManualPalette,
    setManualVariant,
    setAccent,
  } = useSharedTheme();
  const currentThemeClass = resolveThemeClass(effectivePalette, effectiveVariant);
  const currentEventRef = useRef<ThemeChangedEvent>({
    theme_class: currentThemeClass,
    mode: config.mode,
    system_palette: config.systemPalette,
    manual_palette: config.manualPalette,
    manual_variant: config.manualVariant,
    accent: config.accent,
  });
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const skipNextEmitRef = useRef(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const currentEvent = useMemo<ThemeChangedEvent>(() => ({
    theme_class: currentThemeClass,
    mode: config.mode,
    system_palette: config.systemPalette,
    manual_palette: config.manualPalette,
    manual_variant: config.manualVariant,
    accent: config.accent,
  }), [currentThemeClass, config.mode, config.systemPalette, config.manualPalette, config.manualVariant, config.accent]);
  const currentSignature = useMemo(() => getThemeEventSignature(currentEvent), [currentEvent]);

  useEffect(() => {
    currentEventRef.current = currentEvent;
  }, [currentEvent]);

  useEffect(() => {
    let mounted = true;

    createThemeChangedListener((event) => {
      const nextSignature = getThemeEventSignature(event);
      if (nextSignature === getThemeEventSignature(currentEventRef.current)) {
        return;
      }

      if (!event.mode || !event.system_palette || !event.manual_palette || !event.manual_variant) {
        const parsed = parseThemeId(event.theme_class);
        if (!parsed) {
          return;
        }

        skipNextEmitRef.current = true;
        setManualPalette(parsed.palette);
        setManualVariant(parsed.variant);
        setMode('manual');
        return;
      }

      skipNextEmitRef.current = true;
      setSystemPalette(event.system_palette);
      setManualPalette(event.manual_palette);
      setManualVariant(event.manual_variant);
      setMode(event.mode);
      if (event.accent !== undefined) {
        setAccent(event.accent as AccentPreference);
      }
    }).then((unlistenFn) => {
      if (!mounted) {
        unlistenFn();
        return;
      }

      unlistenRef.current = unlistenFn;
    });

    return () => {
      mounted = false;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [setManualPalette, setManualVariant, setMode, setSystemPalette, setAccent]);

  useEffect(() => {
    if (lastEmittedSignatureRef.current === null) {
      lastEmittedSignatureRef.current = currentSignature;
      return;
    }

    if (skipNextEmitRef.current) {
      skipNextEmitRef.current = false;
      lastEmittedSignatureRef.current = currentSignature;
      return;
    }

    if (lastEmittedSignatureRef.current === currentSignature) {
      return;
    }

    lastEmittedSignatureRef.current = currentSignature;
    emit('theme-changed', currentEvent).catch((err) => {
      console.warn('[theme] Failed to emit theme-changed event:', err);
    });
  }, [currentEvent, currentSignature]);

  return null;
}
