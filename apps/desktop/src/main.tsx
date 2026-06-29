import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { setupTauriLogging } from '@taurent/bridge/logging'
import { mark } from '@taurent/shared/utils/perfAudit'
import { registerOperationFailedNotifier } from '@taurent/bridge'
import { createOperationFailedListener } from '@taurent/bridge/transport/tauri'

// Initialize logging before importing app code so startup errors are forwarded to Tauri runtime
console.info('[debug:main] about to call setupTauriLogging');
await setupTauriLogging(import.meta.env.DEV).catch((err: unknown) => {
  console.error('[startup] Failed to initialize logging:', err)
})
console.info('[debug:main] setupTauriLogging done');

// Dynamic import to ensure logging is set up before any module evaluation that may log
console.info('[debug:main] about to dynamic import App');
const { default: App } = await import('./App.tsx').catch((err: unknown) => {
  console.error('[startup] Failed to import App:', err);
  throw err;
})
console.info('[debug:main] App imported successfully');

mark('app.module.loaded')

registerOperationFailedNotifier((callback) => {
  let unlisten: (() => void) | undefined;
  createOperationFailedListener(callback).then(fn => { unlisten = fn; });
  return () => { unlisten?.(); };
});

// ── Window label for investigation perf counters ──────────────────────────────
// Set before first render so all code sees a consistent label from the first cycle.
// Guard against non-Tauri environments (browser automation, vite dev server preview).
try {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  window.__TAURENT_WINDOW_LABEL__ = getCurrentWindow().label;
} catch {
  // getCurrentWindow is unavailable outside Tauri runtime — this is expected in
  // browser automation, plain vite preview, and unit test environments.
  window.__TAURENT_WINDOW_LABEL__ = 'main';
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

mark('react.mounted')
