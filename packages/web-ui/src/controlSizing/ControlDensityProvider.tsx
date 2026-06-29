import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Shared control-density mode for the web-ui primitive set.
 *
 * `desktop` is the default and preserves the existing compact sizing of every
 * covered primitive. `mobile` opts the covered primitives into the larger
 * touch-target path used by the mobile app. The desktop path is intentionally
 * the default so shared surfaces stay desktop-safe when no provider is mounted.
 */
export type ControlDensity = 'desktop' | 'mobile';

const DEFAULT_DENSITY: ControlDensity = 'desktop';

const ControlDensityContext = createContext<ControlDensity | null>(null);

export interface ControlDensityProviderProps {
  /**
   * Density value to expose to covered primitives. Defaults to `'mobile'` so
   * the provider is a one-line opt-in at the mobile app shell. Desktop apps
   * should leave the provider unmounted to keep the existing sizing behavior.
   */
  value?: ControlDensity;
  children: ReactNode;
}

/**
 * Provider that exposes a `ControlDensity` value to the covered shared
 * primitives. The mobile app mounts this once at the app shell; desktop code
 * does not mount it, so every primitive falls back to the existing desktop
 * defaults.
 */
export function ControlDensityProvider({
  value = 'mobile',
  children,
}: ControlDensityProviderProps) {
  const memoisedValue = useMemo<ControlDensity>(() => value, [value]);
  return (
    <ControlDensityContext.Provider value={memoisedValue}>
      {children}
    </ControlDensityContext.Provider>
  );
}

/**
 * Read the active control density. Returns the default desktop density when no
 * provider is mounted, so covered primitives stay safe to render from any
 * shared surface without a forced provider.
 */
export function useControlDensity(): ControlDensity {
  const context = useContext(ControlDensityContext);
  return context ?? DEFAULT_DENSITY;
}
