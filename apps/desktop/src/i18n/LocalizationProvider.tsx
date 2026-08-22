import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { BridgeAdapter } from '@taurent/bridge/adapters/desktop';
import { createLanguageChangedListener } from '@taurent/bridge/transport/tauri';
import type { LanguageChangedEvent } from '@taurent/bridge/events';
import {
  LocalizationProvider as SharedLocalizationProvider,
  applyLanguagePreference,
  useLocalization,
  useTaurentTranslation,
} from '@taurent/shared/i18n';
import { buildNativeUiLabels } from './nativeUiLabels';

function signature(event: LanguageChangedEvent): string {
  return `${event.preference}:${event.resolved_locale}`;
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  return (
    <SharedLocalizationProvider>
      <DesktopLocalizationBridge />
      {children}
    </SharedLocalizationProvider>
  );
}

function DesktopLocalizationBridge() {
  const { preference, locale } = useLocalization();
  const { t } = useTaurentTranslation('desktop');
  const event = useMemo<LanguageChangedEvent>(() => ({
    preference,
    resolved_locale: locale,
  }), [locale, preference]);
  const eventRef = useRef(event);
  const lastEmittedRef = useRef<string | null>(null);
  const skipNextEmitRef = useRef(false);

  useEffect(() => {
    eventRef.current = event;
  }, [event]);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;
    void createLanguageChangedListener((incoming) => {
      if (signature(incoming) === signature(eventRef.current)) return;
      skipNextEmitRef.current = true;
      void applyLanguagePreference(incoming.preference, {
        persist: true,
        resolvedLocale: incoming.resolved_locale,
      });
    }).then((fn) => {
      if (mounted) unlisten = fn;
      else fn();
    });
    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const nextSignature = signature(event);
    if (lastEmittedRef.current === null) {
      lastEmittedRef.current = nextSignature;
      return;
    }
    if (skipNextEmitRef.current) {
      skipNextEmitRef.current = false;
      lastEmittedRef.current = nextSignature;
      return;
    }
    if (lastEmittedRef.current === nextSignature) return;
    lastEmittedRef.current = nextSignature;
    void emit('language-changed', event).catch((error) => {
      console.warn('[i18n] Failed to broadcast language change:', error);
    });
  }, [event]);

  useEffect(() => {
    const labels = buildNativeUiLabels(t);
    void BridgeAdapter.syncNativeUiLabels(labels).catch((error) => {
      console.warn('[i18n] Failed to synchronize native UI labels:', error);
    });

    const currentWindow = getCurrentWindow();
    const titleKey = {
      settings: 'windows.settings',
      statistics: 'windows.statistics',
      'add-torrent': 'windows.addTorrent',
    }[currentWindow.label];
    if (titleKey) void currentWindow.setTitle(t(titleKey));
  }, [locale, t]);

  return null;
}
