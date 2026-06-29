// Re-exports the ServerManagerProvider component from the shared bindings module.
// The hook and context type are re-exported from useServerManager.ts to satisfy
// fast-refresh lint rules (only-export-components).
export { ServerManagerProvider } from './serverManagerBindings';
