// Bridge adapters — platform-specific Tauri implementations
export { createDesktopBridge, BridgeAdapter } from './desktop';
export { createMobileTauriBridge } from './mobile-tauri';
export type * from './desktop';
export type * from './mobile-tauri';
