/**
 * Theme background color data and generators.
 * Node-safe: no browser globals (localStorage, window, matchMedia).
 *
 * Used by:
 * - apps/desktop/vite.config.ts (Vite plugin): injects <style> and <script> into HTML at build time
 * - packages/shared/src/theme/backgroundRuntime.ts: browser-only runtime resolvers
 *
 * Must stay in sync with --color-background in packages/shared/src/theme/themes.css.
 */

/** Background color for each theme class. */
export const THEME_BACKGROUND_COLORS = {
  'theme-solarized-dark': '#002b36',
  'theme-solarized-light': '#fdf6e3',
  'theme-midnight': '#000000',
  'theme-catppuccin-mocha': '#1e1e2e',
  'theme-catppuccin-latte': '#eff1f5',
  'theme-nord': '#2e3440',
  'theme-dracula': '#282a36',
  'theme-gruvbox-dark': '#282828',
  'theme-gruvbox-light': '#fbf1c7',
  'theme-tokyonight': '#1a1b26',
  'theme-monokai': '#272822',
  'theme-onedark': '#282c34',
} as const satisfies Record<string, string>;

/** Default fallback background used when theme resolution fails. */
export const DEFAULT_THEME_BACKGROUND = '#002b36';

/** Convert a hex color string (#rrggbb or #rrggbbaa) to an RGBA tuple for Tauri's Color type. */
export function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace(/^#/, '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255,
  ];
}

/** Get the background hex color for a theme class, falling back to the default. */
export function getThemeBackground(themeClass: string): string {
  return (THEME_BACKGROUND_COLORS as Record<string, string>)[themeClass] ?? DEFAULT_THEME_BACKGROUND;
}

/**
 * Generate the CSS rules for per-theme background colors.
 * Used by the Vite plugin to inject into <style> in HTML files.
 * Solarized-dark is the html,body fallback; all other themes override via html.{cls} selectors.
 */
export function generateThemeBackgroundStyles(): string {
  const rules: string[] = [`html,body{background-color:${DEFAULT_THEME_BACKGROUND};}`];
  for (const [cls, color] of Object.entries(THEME_BACKGROUND_COLORS)) {
    if (cls !== 'theme-solarized-dark') {
      rules.push(`html.${cls}{background-color:${color};}`);
    }
  }
  return rules.join('');
}

/**
 * Generate the inline script body for theme initialization (without <script> tags).
 * Sets document.documentElement.className from localStorage before any JS bundle loads.
 * Colors are handled by the companion <style> block — not embedded here.
 *
 * Handles: current keys (system/manual), dark-only palette enforcement.
 * Uses ES5 syntax for maximum webview compatibility.
 */
export function generateThemeInitScript(): string {
  const darkOnly = ['midnight', 'nord', 'dracula', 'tokyonight', 'monokai', 'onedark'];

  const d = JSON.stringify(darkOnly);

  return (
    `(function(){try{` +
    `var d=${d};` +
    `function c(p,v){if(p==='catppuccin')return 'theme-catppuccin-'+(v==='dark'?'mocha':'latte');` +
    `if(d.indexOf(p)!==-1)return 'theme-'+p;return 'theme-'+p+'-'+v;}` +
    `function s(){return typeof matchMedia==='function'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}` +
    `var p='solarized',v=s(),m=localStorage.getItem('app_theme_mode');` +
    `if(m==='system'){p=localStorage.getItem('app_system_palette')||'solarized';` +
    `v=s();}` +
    `else if(m==='manual'){p=localStorage.getItem('app_manual_palette')||'solarized';` +
    `v=localStorage.getItem('app_manual_variant')||'dark';}` +
    `if(d.indexOf(p)!==-1)v='dark';` +
    `document.documentElement.className=c(p,v);` +
    `}catch(e){}})();`
  );
}

/**
 * Generate the inline script body for applying a saved accent override
 * before React mounts (companion to {@link generateThemeInitScript}).
 *
 * Reads the saved accent from localStorage key `app_accent_hex` and applies
 * CSS custom-property overrides to `document.documentElement.style` when:
 * 1. The saved accent value is a valid 6-digit hex color.
 * 2. The current effective theme class is `theme-midnight`.
 *
 * The override layer prevents a visual flash from Midnight's default blue
 * accent to the user's saved custom accent before React hydrates.
 *
 * Only core tokens needed to avoid a visible flash are set here:
 * `--color-primary`, `--color-primary-rgb`, `--color-text-on-primary`,
 * and `--color-border-focus` (focus rings are very visible).
 * The full derived token set is applied by the React provider once it mounts.
 *
 * Returns an empty string if no accent logic is needed.
 * Uses ES5 syntax for maximum webview compatibility.
 */
export function generateAccentInitScript(): string {
  return (
    `(function(){try{` +
    `var a=localStorage.getItem('app_accent_hex');` +
    `if(a&&/^#[0-9a-f]{6}$/i.test(a)&&` +
    `document.documentElement.className.indexOf('theme-midnight')!==-1){` +
    `var r=parseInt(a.slice(1,3),16),g=parseInt(a.slice(3,5),16),b=parseInt(a.slice(5,7),16);` +
    `var l=0.2126*(r/255<=0.04045?r/255/12.92:((r/255+0.055)/1.055)**2.4)+` +
    `0.7152*(g/255<=0.04045?g/255/12.92:((g/255+0.055)/1.055)**2.4)+` +
    `0.0722*(b/255<=0.04045?b/255/12.92:((b/255+0.055)/1.055)**2.4);` +
    `var tx=l>0.179?'#000000':'#ffffff';` +
    `var s=document.documentElement.style;` +
    `s.setProperty('--color-primary',a);` +
    `s.setProperty('--color-primary-rgb',r+' '+g+' '+b);` +
    `s.setProperty('--color-text-on-primary',tx);` +
    `s.setProperty('--color-border-focus',a);` +
    `}}catch(e){}})();`
  );
}
