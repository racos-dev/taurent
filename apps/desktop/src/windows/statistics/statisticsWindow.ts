import { createWindowLifecycle, openAuxWindow } from '../auxWindowManager';

// i18n-audit-ignore: stable Tauri window identifier, not display copy
const STATISTICS_WINDOW_LABEL = 'statistics';

const lc = createWindowLifecycle({
  label: STATISTICS_WINDOW_LABEL,
  route: '/statistics-window',
  titleKey: 'windows.statistics',
  width: 480,
  height: 520,
  minWidth: 400,
  minHeight: 400,
  resizable: false,
  minimizable: false,
  maximizable: false,
  decorations: true,
  centerOverOpener: true,
  idleTtlMs: 10 * 60_000,
});

const STATISTICS_WINDOW_CONFIG = lc.windowConfig;

export async function openStatisticsWindow(): Promise<void> {
  await openAuxWindow(STATISTICS_WINDOW_CONFIG);
}
