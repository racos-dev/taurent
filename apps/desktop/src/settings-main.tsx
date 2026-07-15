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

createRoot(settingsRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
