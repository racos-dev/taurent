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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

mark('react.mounted')
