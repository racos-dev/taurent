// Global type augmentations for the @taurent/shared package.
//
// `__TAURENT_WINDOW_LABEL__` is set by the desktop entry points
// (apps/desktop/src/main.tsx, apps/desktop/src/settings-main.tsx) before the
// first render and read in automation helpers (apps/desktop/scripts/e2e/helpers.ts).
// The type must be available wherever `window.__TAURENT_WINDOW_LABEL__` is
// referenced; this declaration is re-exported through the package index so
// consumers automatically pick it up.

declare global {
  interface Window {
    __TAURENT_WINDOW_LABEL__?: string;
  }
}

export {};
