import { describe, expect, it } from 'vitest';
import { buildNativeUiLabels } from './nativeUiLabels';

describe('buildNativeUiLabels', () => {
  it('maps every native label to a semantic desktop catalog key', () => {
    const labels = buildNativeUiLabels((key) => `translated:${key}`);

    expect(labels.menu_app).toBe('translated:menu.app');
    expect(labels.menu_undo).toBe('translated:menu.undo');
    expect(labels.tray_show).toBe('translated:tray.show');
    expect(labels.tray_hide).toBe('translated:tray.hide');
    expect(labels.window_add_torrent).toBe('translated:windows.addTorrent');
    expect(labels.window_global_speed_limits).toBe('translated:windows.globalSpeedLimits');
    expect(Object.values(labels)).toHaveLength(46);
  });
});
