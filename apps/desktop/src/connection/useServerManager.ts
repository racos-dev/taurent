// Re-exports the useServerManager hook and ServerManagerContextType from the
// shared bindings module. The type is also re-exported to satisfy consumers
// of the connection barrel.
export { useServerManager, type ServerManagerContextType } from './serverManagerBindings';
