import { createRoot } from 'react-dom/client'
import './index.css'
import { setupTauriLogging } from '@taurent/bridge/logging'
import { registerOperationFailedNotifier } from '@taurent/bridge'
import { createOperationFailedListener } from '@taurent/bridge/transport/tauri'

async function bootstrap(): Promise<void> {
  try {
    await setupTauriLogging(import.meta.env.DEV)
  } catch (error) {
    console.warn('Failed to initialize Taurent mobile logging bridge', error)
  }

  const { default: App } = await import('./App.tsx')

  registerOperationFailedNotifier((callback) => {
    let unlisten: (() => void) | undefined;
    createOperationFailedListener(callback).then(fn => { unlisten = fn; });
    return () => { unlisten?.(); };
  });

  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Taurent mobile root element was not found')
  }

  createRoot(rootElement).render(
    <App />
  )
}

void bootstrap()
