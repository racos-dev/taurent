import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { setupTauriLogging } from '@taurent/bridge/logging';

// Initialize logging before importing app code so startup errors are forwarded to Tauri runtime
await setupTauriLogging(import.meta.env.DEV).catch((err: unknown) => {
  console.error('[startup] Failed to initialize logging:', err);
});

// Dynamic import to ensure logging is set up before any module evaluation that may log
const { default: App } = await import('./App').catch((err: unknown) => {
  console.error('[startup] Failed to import App:', err);
  throw err;
});

const settingsRoot = document.getElementById('root');
if (!settingsRoot) {
  throw new Error('Settings root element not found');
}

declare global {
  interface Window {
    __IS_SETTINGS_WINDOW__?: boolean;
  }
}

window.__IS_SETTINGS_WINDOW__ = true;

// ── Window label for investigation perf counters ──────────────────────────────
// Set before first render; guard against non-Tauri environments (browser automation,
// vite dev server preview).
try {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  window.__TAURENT_WINDOW_LABEL__ = getCurrentWindow().label;
} catch {
  // getCurrentWindow is unavailable outside Tauri runtime — this is expected in
  // browser automation, plain vite preview, and unit test environments.
  window.__TAURENT_WINDOW_LABEL__ = 'settings';
}

createRoot(settingsRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
