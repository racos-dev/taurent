import { emit, listen } from '@tauri-apps/api/event';
import type { ResourceInvalidatedEvent } from '@taurent/bridge/events';
import { createWindowLifecycle, openAuxWindow } from '../auxWindowManager';

const SETTINGS_WINDOW_LABEL = 'settings';
type SettingsSection = 'desktop-window' | 'desktop-theme' | 'desktop-about' | 'desktop-servers' | 'desktop-path-mappings';

const lc = createWindowLifecycle({
  label: SETTINGS_WINDOW_LABEL,
  route: '/settings-window',
  title: 'Settings',
  width: 1000,
  height: 700,
  minWidth: 1000,
  minHeight: 700,
  resizable: false,
  maximizable: false,
  decorations: true,
  centerOverOpener: true,
  idleTtlMs: 10 * 60_000,
});

const SETTINGS_WINDOW_CONFIG = lc.windowConfig;

export async function openSettingsWindow(section?: SettingsSection): Promise<void> {
  const payload = section ? { section } : undefined;
  await openAuxWindow(SETTINGS_WINDOW_CONFIG, payload ? { payload } : undefined);
}

export async function emitResourceInvalidated(payload: ResourceInvalidatedEvent): Promise<void> {
  await emit('resource-invalidated', payload);
}

// ─── Scroll-to-section bridge ────────────────────────────────────────────────

/** Ref written by SettingsScreen so this module can drive scrolling from Tauri events. */
let scrollToSectionRef: ((section: string) => void) | null = null;

export function setScrollToSectionRef(fn: ((section: string) => void) | null): void {
  scrollToSectionRef = fn;
}

/** Set up the scroll-to-section Tauri event listener inside the Settings window renderer.
 *  Called by SettingsScreen on mount; cleaned up on unmount via the returned unlisten fn. */
export function setupScrollToSectionListener(): () => void {
  let unlisten: (() => void) | undefined;
  let active = true;

  listen<{ section: string }>('scroll-to-section', (event) => {
    if (!active) return;
    if (scrollToSectionRef) {
      scrollToSectionRef(event.payload.section);
    }
  }).then((unlistenFn) => {
    if (!active) {
      unlistenFn();
      return;
    }
    unlisten = unlistenFn;
  });

  return () => {
    active = false;
    unlisten?.();
  };
}


export async function dismissSettingsWindow(): Promise<void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await lc.dismiss(() => getCurrentWindow().hide());
}